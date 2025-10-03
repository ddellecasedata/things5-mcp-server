/**
 * Flutter - Things5 MCP Integration
 * Esempio completo pronto all'uso
 */

import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;

// Modello configurazione
class Things5Config {
  bool enabled;
  String serverUrl;
  String username;
  String password;

  Things5Config({
    this.enabled = false,
    this.serverUrl = 'https://things5-mcp-server.onrender.com/sse',
    this.username = '',
    this.password = '',
  });

  Map<String, dynamic> toJson() => {
    'enabled': enabled,
    'serverUrl': serverUrl,
    'username': username,
    'password': password,
  };

  factory Things5Config.fromJson(Map<String, dynamic> json) => Things5Config(
    enabled: json['enabled'] ?? false,
    serverUrl: json['serverUrl'] ?? 'https://things5-mcp-server.onrender.com/sse',
    username: json['username'] ?? '',
    password: json['password'] ?? '',
  );
}

// Servizio Things5
class Things5Service {
  static const String _configKey = 'things5_config';
  static const String _openaiApiKey = 'YOUR_OPENAI_API_KEY'; // Sostituisci con la tua chiave

  // Carica configurazione
  static Future<Things5Config> loadConfig() async {
    final prefs = await SharedPreferences.getInstance();
    final configJson = prefs.getString(_configKey);
    
    if (configJson != null) {
      return Things5Config.fromJson(json.decode(configJson));
    }
    
    return Things5Config();
  }

  // Salva configurazione
  static Future<void> saveConfig(Things5Config config) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_configKey, json.encode(config.toJson()));
  }

  // Test connessione
  static Future<bool> testConnection(Things5Config config) async {
    if (config.username.isEmpty || config.password.isEmpty) {
      return false;
    }

    try {
      // Test semplice con health check del server
      final healthUrl = config.serverUrl.replaceAll('/sse', '/health');
      final response = await http.get(Uri.parse(healthUrl));
      return response.statusCode == 200;
    } catch (e) {
      print('Test connection error: $e');
      return false;
    }
  }

  // Invia messaggio a OpenAI con Things5 MCP
  static Future<String> sendMessage(String message, Things5Config config) async {
    if (!config.enabled) {
      return "Things5 integration is disabled. Enable it in settings.";
    }

    if (config.username.isEmpty || config.password.isEmpty) {
      return "Please configure Things5 credentials in settings.";
    }

    try {
      // Costruisci URL con credenziali
      final serverUrlWithAuth = '${config.serverUrl}?username=${Uri.encodeComponent(config.username)}&password=${Uri.encodeComponent(config.password)}';

      // Configurazione MCP tool per OpenAI
      final mcpTool = {
        'type': 'mcp',
        'server_label': 'things5',
        'server_description': 'Things5 IoT platform for device management and monitoring',
        'server_url': serverUrlWithAuth,
        'require_approval': 'never'
      };

      // Richiesta a OpenAI
      final openaiResponse = await http.post(
        Uri.parse('https://api.openai.com/v1/responses'),
        headers: {
          'Authorization': 'Bearer $_openaiApiKey',
          'Content-Type': 'application/json',
        },
        body: json.encode({
          'model': 'gpt-4o',
          'tools': [mcpTool],
          'input': message,
        }),
      );

      if (openaiResponse.statusCode == 200) {
        final responseData = json.decode(openaiResponse.body);
        return responseData['output_text'] ?? 'No response received';
      } else {
        throw Exception('OpenAI API error: ${openaiResponse.statusCode}');
      }
    } catch (e) {
      print('Send message error: $e');
      
      if (e.toString().contains('authentication') || e.toString().contains('401')) {
        return "❌ Authentication failed. Please check your Things5 credentials in settings.";
      }
      
      return "❌ Error: ${e.toString()}";
    }
  }
}

// Schermata Settings
class Things5SettingsScreen extends StatefulWidget {
  @override
  _Things5SettingsScreenState createState() => _Things5SettingsScreenState();
}

class _Things5SettingsScreenState extends State<Things5SettingsScreen> {
  Things5Config _config = Things5Config();
  bool _testing = false;
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _serverUrlController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadConfig();
  }

  Future<void> _loadConfig() async {
    final config = await Things5Service.loadConfig();
    setState(() {
      _config = config;
      _usernameController.text = config.username;
      _passwordController.text = config.password;
      _serverUrlController.text = config.serverUrl;
    });
  }

  Future<void> _saveConfig() async {
    _config.username = _usernameController.text;
    _config.password = _passwordController.text;
    _config.serverUrl = _serverUrlController.text;
    
    await Things5Service.saveConfig(_config);
    
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Configuration saved!')),
    );
  }

  Future<void> _testConnection() async {
    setState(() => _testing = true);
    
    final tempConfig = Things5Config(
      enabled: true,
      serverUrl: _serverUrlController.text,
      username: _usernameController.text,
      password: _passwordController.text,
    );
    
    final success = await Things5Service.testConnection(tempConfig);
    
    setState(() => _testing = false);
    
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(success ? '✅ Connection successful!' : '❌ Connection failed'),
        backgroundColor: success ? Colors.green : Colors.red,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Things5 IoT Settings'),
        backgroundColor: Colors.blue,
      ),
      body: Padding(
        padding: EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Toggle abilitazione
            SwitchListTile(
              title: Text('Enable Things5 Integration'),
              subtitle: Text('Connect to your IoT devices'),
              value: _config.enabled,
              onChanged: (value) {
                setState(() => _config.enabled = value);
              },
            ),
            
            if (_config.enabled) ...[
              SizedBox(height: 20),
              
              // Server URL
              TextField(
                controller: _serverUrlController,
                decoration: InputDecoration(
                  labelText: 'Server URL',
                  hintText: 'https://things5-mcp-server.onrender.com/sse',
                  border: OutlineInputBorder(),
                ),
              ),
              
              SizedBox(height: 16),
              
              // Username
              TextField(
                controller: _usernameController,
                decoration: InputDecoration(
                  labelText: 'Things5 Username',
                  hintText: 'your-email@example.com',
                  border: OutlineInputBorder(),
                ),
                keyboardType: TextInputType.emailAddress,
              ),
              
              SizedBox(height: 16),
              
              // Password
              TextField(
                controller: _passwordController,
                decoration: InputDecoration(
                  labelText: 'Password',
                  border: OutlineInputBorder(),
                ),
                obscureText: true,
              ),
              
              SizedBox(height: 20),
              
              // Pulsanti
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _testing ? null : _testConnection,
                      child: Text(_testing ? 'Testing...' : 'Test Connection'),
                    ),
                  ),
                  SizedBox(width: 16),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _saveConfig,
                      child: Text('Save'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.green,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    _serverUrlController.dispose();
    super.dispose();
  }
}

// Schermata Chat
class Things5ChatScreen extends StatefulWidget {
  @override
  _Things5ChatScreenState createState() => _Things5ChatScreenState();
}

class _Things5ChatScreenState extends State<Things5ChatScreen> {
  Things5Config _config = Things5Config();
  final _messageController = TextEditingController();
  String _response = '';
  bool _loading = false;

  final List<String> _examples = [
    "Show me all my IoT devices",
    "What are the recent events?", 
    "Are there any alarms?",
    "Give me a status overview"
  ];

  @override
  void initState() {
    super.initState();
    _loadConfig();
  }

  Future<void> _loadConfig() async {
    final config = await Things5Service.loadConfig();
    setState(() => _config = config);
  }

  Future<void> _sendMessage() async {
    final message = _messageController.text.trim();
    if (message.isEmpty) return;

    setState(() => _loading = true);

    try {
      final response = await Things5Service.sendMessage(message, _config);
      setState(() => _response = response);
    } catch (e) {
      setState(() => _response = 'Error: ${e.toString()}');
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Chat with Things5 IoT'),
        backgroundColor: Colors.blue,
        actions: [
          IconButton(
            icon: Icon(Icons.settings),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => Things5SettingsScreen()),
              ).then((_) => _loadConfig());
            },
          ),
        ],
      ),
      body: Padding(
        padding: EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Status indicator
            Container(
              padding: EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _config.enabled ? Colors.green.shade100 : Colors.grey.shade100,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Icon(
                    _config.enabled ? Icons.check_circle : Icons.error,
                    color: _config.enabled ? Colors.green : Colors.grey,
                  ),
                  SizedBox(width: 8),
                  Text(
                    _config.enabled ? 'Things5 Connected' : 'Things5 Disabled',
                    style: TextStyle(
                      color: _config.enabled ? Colors.green.shade800 : Colors.grey.shade600,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
            
            SizedBox(height: 20),
            
            // Input messaggio
            TextField(
              controller: _messageController,
              decoration: InputDecoration(
                labelText: 'Ask about your IoT devices...',
                border: OutlineInputBorder(),
                suffixIcon: IconButton(
                  icon: Icon(Icons.send),
                  onPressed: _loading ? null : _sendMessage,
                ),
              ),
              maxLines: 3,
              onSubmitted: (_) => _sendMessage(),
            ),
            
            SizedBox(height: 16),
            
            // Pulsante invio
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _loading ? null : _sendMessage,
                child: Text(_loading ? 'Sending...' : 'Send Message'),
              ),
            ),
            
            SizedBox(height: 20),
            
            // Risposta
            if (_response.isNotEmpty) ...[
              Text(
                'Response:',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  _response,
                  style: TextStyle(fontSize: 16),
                ),
              ),
            ],
            
            SizedBox(height: 20),
            
            // Esempi
            Text(
              'Try asking:',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 8),
            
            Expanded(
              child: ListView.builder(
                itemCount: _examples.length,
                itemBuilder: (context, index) {
                  return Padding(
                    padding: EdgeInsets.only(bottom: 8),
                    child: OutlinedButton(
                      onPressed: () {
                        _messageController.text = _examples[index];
                      },
                      child: Text(_examples[index]),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
  }
}

// App principale
class Things5App extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Things5 IoT Chat',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        visualDensity: VisualDensity.adaptivePlatformDensity,
      ),
      home: Things5ChatScreen(),
    );
  }
}

// Main
void main() {
  runApp(Things5App());
}

// Widget personalizzato per integrazione facile
class Things5Widget extends StatefulWidget {
  final String openaiApiKey;
  final Function(String)? onResponse;

  Things5Widget({
    required this.openaiApiKey,
    this.onResponse,
  });

  @override
  _Things5WidgetState createState() => _Things5WidgetState();
}

class _Things5WidgetState extends State<Things5Widget> {
  Things5Config _config = Things5Config();
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _loadConfig();
  }

  Future<void> _loadConfig() async {
    final config = await Things5Service.loadConfig();
    setState(() => _config = config);
  }

  Future<String> askThings5(String question) async {
    setState(() => _loading = true);
    
    try {
      final response = await Things5Service.sendMessage(question, _config);
      
      if (widget.onResponse != null) {
        widget.onResponse!(response);
      }
      
      return response;
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(16),
      child: Column(
        children: [
          if (!_config.enabled)
            Card(
              color: Colors.orange.shade100,
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Text(
                  'Things5 integration is disabled. Enable it in settings to access your IoT devices.',
                  style: TextStyle(color: Colors.orange.shade800),
                ),
              ),
            ),
          
          if (_loading)
            CircularProgressIndicator(),
        ],
      ),
    );
  }
}
