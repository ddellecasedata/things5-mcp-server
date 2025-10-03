/**
 * iOS Swift - Things5 MCP Integration
 * Esempio completo pronto all'uso
 */

import Foundation
import UIKit

// MARK: - Models

struct Things5Config: Codable {
    var enabled: Bool = false
    var serverUrl: String = "https://things5-mcp-server.onrender.com/sse"
    var username: String = ""
    var password: String = ""
}

struct OpenAIResponse: Codable {
    let outputText: String
    
    enum CodingKeys: String, CodingKey {
        case outputText = "output_text"
    }
}

// MARK: - Things5 Service

class Things5Service {
    static let shared = Things5Service()
    private let configKey = "things5_config"
    private let openaiApiKey = "YOUR_OPENAI_API_KEY" // Sostituisci con la tua chiave
    
    private init() {}
    
    // MARK: - Configuration Management
    
    func loadConfig() -> Things5Config {
        guard let data = UserDefaults.standard.data(forKey: configKey),
              let config = try? JSONDecoder().decode(Things5Config.self, from: data) else {
            return Things5Config()
        }
        return config
    }
    
    func saveConfig(_ config: Things5Config) {
        guard let data = try? JSONEncoder().encode(config) else { return }
        UserDefaults.standard.set(data, forKey: configKey)
    }
    
    // MARK: - Connection Testing
    
    func testConnection(config: Things5Config, completion: @escaping (Bool) -> Void) {
        guard !config.username.isEmpty && !config.password.isEmpty else {
            completion(false)
            return
        }
        
        // Test con health check del server
        let healthUrl = config.serverUrl.replacingOccurrences(of: "/sse", with: "/health")
        guard let url = URL(string: healthUrl) else {
            completion(false)
            return
        }
        
        URLSession.shared.dataTask(with: url) { _, response, _ in
            DispatchQueue.main.async {
                completion((response as? HTTPURLResponse)?.statusCode == 200)
            }
        }.resume()
    }
    
    // MARK: - Chat with OpenAI + Things5
    
    func sendMessage(_ message: String, config: Things5Config, completion: @escaping (Result<String, Error>) -> Void) {
        guard config.enabled else {
            completion(.success("Things5 integration is disabled. Enable it in settings."))
            return
        }
        
        guard !config.username.isEmpty && !config.password.isEmpty else {
            completion(.success("Please configure Things5 credentials in settings."))
            return
        }
        
        // Costruisci URL con credenziali
        let encodedUsername = config.username.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let encodedPassword = config.password.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let serverUrlWithAuth = "\(config.serverUrl)?username=\(encodedUsername)&password=\(encodedPassword)"
        
        // Configurazione MCP tool
        let mcpTool: [String: Any] = [
            "type": "mcp",
            "server_label": "things5",
            "server_description": "Things5 IoT platform for device management and monitoring",
            "server_url": serverUrlWithAuth,
            "require_approval": "never"
        ]
        
        // Richiesta OpenAI
        let requestBody: [String: Any] = [
            "model": "gpt-4o",
            "tools": [mcpTool],
            "input": message
        ]
        
        guard let url = URL(string: "https://api.openai.com/v1/responses"),
              let jsonData = try? JSONSerialization.data(withJSONObject: requestBody) else {
            completion(.failure(NSError(domain: "Things5Service", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid request"])))
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(openaiApiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = jsonData
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    completion(.failure(error))
                    return
                }
                
                guard let data = data else {
                    completion(.failure(NSError(domain: "Things5Service", code: -2, userInfo: [NSLocalizedDescriptionKey: "No data received"])))
                    return
                }
                
                do {
                    let openaiResponse = try JSONDecoder().decode(OpenAIResponse.self, from: data)
                    completion(.success(openaiResponse.outputText))
                } catch {
                    // Fallback per errori di parsing
                    if let responseString = String(data: data, encoding: .utf8) {
                        if responseString.contains("authentication") || responseString.contains("401") {
                            completion(.success("❌ Authentication failed. Please check your Things5 credentials in settings."))
                        } else {
                            completion(.success("❌ Error: \(error.localizedDescription)"))
                        }
                    } else {
                        completion(.failure(error))
                    }
                }
            }
        }.resume()
    }
}

// MARK: - Settings View Controller

class Things5SettingsViewController: UIViewController {
    
    @IBOutlet weak var enabledSwitch: UISwitch!
    @IBOutlet weak var serverUrlTextField: UITextField!
    @IBOutlet weak var usernameTextField: UITextField!
    @IBOutlet weak var passwordTextField: UITextField!
    @IBOutlet weak var testButton: UIButton!
    @IBOutlet weak var saveButton: UIButton!
    @IBOutlet weak var statusLabel: UILabel!
    
    private var config = Things5Config()
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        loadConfig()
    }
    
    private func setupUI() {
        title = "Things5 IoT Settings"
        
        // Setup text fields
        serverUrlTextField.placeholder = "https://things5-mcp-server.onrender.com/sse"
        usernameTextField.placeholder = "your-email@example.com"
        passwordTextField.placeholder = "Your password"
        passwordTextField.isSecureTextEntry = true
        
        // Setup buttons
        testButton.setTitle("Test Connection", for: .normal)
        saveButton.setTitle("Save Configuration", for: .normal)
        
        // Setup switch
        enabledSwitch.addTarget(self, action: #selector(enabledSwitchChanged), for: .valueChanged)
    }
    
    private func loadConfig() {
        config = Things5Service.shared.loadConfig()
        updateUI()
    }
    
    private func updateUI() {
        enabledSwitch.isOn = config.enabled
        serverUrlTextField.text = config.serverUrl
        usernameTextField.text = config.username
        passwordTextField.text = config.password
        
        // Show/hide configuration fields
        let configViews = [serverUrlTextField, usernameTextField, passwordTextField, testButton, saveButton]
        configViews.forEach { $0?.isHidden = !config.enabled }
    }
    
    @objc private func enabledSwitchChanged() {
        config.enabled = enabledSwitch.isOn
        updateUI()
    }
    
    @IBAction func testConnectionTapped() {
        updateConfigFromUI()
        
        testButton.isEnabled = false
        testButton.setTitle("Testing...", for: .normal)
        statusLabel.text = "Testing connection..."
        
        Things5Service.shared.testConnection(config: config) { [weak self] success in
            self?.testButton.isEnabled = true
            self?.testButton.setTitle("Test Connection", for: .normal)
            
            if success {
                self?.statusLabel.text = "✅ Connection successful!"
                self?.statusLabel.textColor = .systemGreen
            } else {
                self?.statusLabel.text = "❌ Connection failed"
                self?.statusLabel.textColor = .systemRed
            }
        }
    }
    
    @IBAction func saveConfigurationTapped() {
        updateConfigFromUI()
        Things5Service.shared.saveConfig(config)
        
        statusLabel.text = "✅ Configuration saved!"
        statusLabel.textColor = .systemBlue
        
        // Hide status after 2 seconds
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            self.statusLabel.text = ""
        }
    }
    
    private func updateConfigFromUI() {
        config.serverUrl = serverUrlTextField.text ?? ""
        config.username = usernameTextField.text ?? ""
        config.password = passwordTextField.text ?? ""
    }
}

// MARK: - Chat View Controller

class Things5ChatViewController: UIViewController {
    
    @IBOutlet weak var statusView: UIView!
    @IBOutlet weak var statusLabel: UILabel!
    @IBOutlet weak var messageTextView: UITextView!
    @IBOutlet weak var sendButton: UIButton!
    @IBOutlet weak var responseTextView: UITextView!
    @IBOutlet weak var examplesStackView: UIStackView!
    @IBOutlet weak var loadingIndicator: UIActivityIndicatorView!
    
    private var config = Things5Config()
    
    private let examples = [
        "Show me all my IoT devices",
        "What are the recent events?",
        "Are there any alarms?",
        "Give me a status overview"
    ]
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        loadConfig()
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        loadConfig()
    }
    
    private func setupUI() {
        title = "Chat with Things5 IoT"
        
        // Navigation bar
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            image: UIImage(systemName: "gear"),
            style: .plain,
            target: self,
            action: #selector(settingsTapped)
        )
        
        // Setup text views
        messageTextView.layer.borderColor = UIColor.systemGray4.cgColor
        messageTextView.layer.borderWidth = 1
        messageTextView.layer.cornerRadius = 8
        
        responseTextView.layer.borderColor = UIColor.systemGray4.cgColor
        responseTextView.layer.borderWidth = 1
        responseTextView.layer.cornerRadius = 8
        responseTextView.isEditable = false
        
        // Setup examples
        setupExamples()
        
        // Setup send button
        sendButton.addTarget(self, action: #selector(sendMessageTapped), for: .touchUpInside)
    }
    
    private func setupExamples() {
        examples.forEach { example in
            let button = UIButton(type: .system)
            button.setTitle(example, for: .normal)
            button.titleLabel?.numberOfLines = 0
            button.contentHorizontalAlignment = .left
            button.addTarget(self, action: #selector(exampleTapped(_:)), for: .touchUpInside)
            examplesStackView.addArrangedSubview(button)
        }
    }
    
    private func loadConfig() {
        config = Things5Service.shared.loadConfig()
        updateStatusUI()
    }
    
    private func updateStatusUI() {
        if config.enabled {
            statusView.backgroundColor = UIColor.systemGreen.withAlphaComponent(0.1)
            statusLabel.text = "Things5 Connected"
            statusLabel.textColor = .systemGreen
        } else {
            statusView.backgroundColor = UIColor.systemGray.withAlphaComponent(0.1)
            statusLabel.text = "Things5 Disabled"
            statusLabel.textColor = .systemGray
        }
    }
    
    @objc private func settingsTapped() {
        let storyboard = UIStoryboard(name: "Main", bundle: nil)
        if let settingsVC = storyboard.instantiateViewController(withIdentifier: "Things5SettingsViewController") as? Things5SettingsViewController {
            navigationController?.pushViewController(settingsVC, animated: true)
        }
    }
    
    @objc private func exampleTapped(_ sender: UIButton) {
        messageTextView.text = sender.title(for: .normal)
    }
    
    @objc private func sendMessageTapped() {
        guard let message = messageTextView.text, !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return
        }
        
        sendButton.isEnabled = false
        loadingIndicator.startAnimating()
        responseTextView.text = "Sending message..."
        
        Things5Service.shared.sendMessage(message, config: config) { [weak self] result in
            self?.sendButton.isEnabled = true
            self?.loadingIndicator.stopAnimating()
            
            switch result {
            case .success(let response):
                self?.responseTextView.text = response
            case .failure(let error):
                self?.responseTextView.text = "❌ Error: \(error.localizedDescription)"
            }
        }
    }
}

// MARK: - Custom Things5 Widget

class Things5Widget: UIView {
    
    private let config = Things5Service.shared.loadConfig()
    private var onResponse: ((String) -> Void)?
    
    private lazy var statusLabel: UILabel = {
        let label = UILabel()
        label.font = UIFont.systemFont(ofSize: 14, weight: .medium)
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private lazy var askButton: UIButton = {
        let button = UIButton(type: .system)
        button.setTitle("Ask Things5", for: .normal)
        button.addTarget(self, action: #selector(askTapped), for: .touchUpInside)
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }()
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupUI()
    }
    
    private func setupUI() {
        addSubview(statusLabel)
        addSubview(askButton)
        
        NSLayoutConstraint.activate([
            statusLabel.topAnchor.constraint(equalTo: topAnchor, constant: 8),
            statusLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            statusLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            
            askButton.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 8),
            askButton.centerXAnchor.constraint(equalTo: centerXAnchor),
            askButton.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8)
        ])
        
        updateStatus()
    }
    
    private func updateStatus() {
        if config.enabled {
            statusLabel.text = "✅ Things5 Ready"
            statusLabel.textColor = .systemGreen
            askButton.isEnabled = true
        } else {
            statusLabel.text = "⚠️ Things5 Disabled"
            statusLabel.textColor = .systemOrange
            askButton.isEnabled = false
        }
    }
    
    func setResponseHandler(_ handler: @escaping (String) -> Void) {
        onResponse = handler
    }
    
    func askThings5(_ question: String) {
        askButton.isEnabled = false
        askButton.setTitle("Asking...", for: .normal)
        
        Things5Service.shared.sendMessage(question, config: config) { [weak self] result in
            self?.askButton.isEnabled = true
            self?.askButton.setTitle("Ask Things5", for: .normal)
            
            switch result {
            case .success(let response):
                self?.onResponse?(response)
            case .failure(let error):
                self?.onResponse?("Error: \(error.localizedDescription)")
            }
        }
    }
    
    @objc private func askTapped() {
        // Mostra un alert per inserire la domanda
        let alert = UIAlertController(title: "Ask Things5", message: "What would you like to know about your IoT devices?", preferredStyle: .alert)
        
        alert.addTextField { textField in
            textField.placeholder = "Enter your question..."
        }
        
        alert.addAction(UIAlertAction(title: "Ask", style: .default) { [weak self] _ in
            if let question = alert.textFields?.first?.text, !question.isEmpty {
                self?.askThings5(question)
            }
        })
        
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        
        if let viewController = self.findViewController() {
            viewController.present(alert, animated: true)
        }
    }
}

// MARK: - Extensions

extension UIView {
    func findViewController() -> UIViewController? {
        if let nextResponder = self.next as? UIViewController {
            return nextResponder
        } else if let nextResponder = self.next as? UIView {
            return nextResponder.findViewController()
        } else {
            return nil
        }
    }
}
