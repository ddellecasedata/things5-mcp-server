# Guida Integrazione App Mobile - Things5 MCP + OpenAI

## 🎯 **Panoramica per Sviluppatori Mobile**

L'integrazione è **estremamente semplice** per l'app mobile:

1. **L'utente inserisce** username e password nell'UI
2. **L'app configura** OpenAI con l'URL del server MCP
3. **Il server MCP gestisce tutto** - autenticazione, rinnovo token, API calls
4. **L'app riceve** solo le risposte finali da OpenAI

**L'app mobile NON deve gestire OAuth, token, o API Things5 direttamente!**

## 📱 **Implementazione App Mobile**

### **1. UI Configuration Screen**

```typescript
// Configurazione nell'app
interface MCPConfig {
  serverUrl: string;
  username: string;
  password: string;
  enabled: boolean;
}

const defaultConfig: MCPConfig = {
  serverUrl: "https://things5-mcp-server.onrender.com/sse",
  username: "",
  password: "",
  enabled: false
};
```

### **2. OpenAI Integration (React Native/Flutter/Native)**

#### **React Native Example:**

```typescript
import OpenAI from 'openai';

class Things5Integration {
  private openai: OpenAI;
  private mcpConfig: MCPConfig;

  constructor(apiKey: string, mcpConfig: MCPConfig) {
    this.openai = new OpenAI({ apiKey });
    this.mcpConfig = mcpConfig;
  }

  async chatWithThings5(message: string): Promise<string> {
    if (!this.mcpConfig.enabled) {
      throw new Error("Things5 integration not enabled");
    }

    // Crea configurazione MCP con credenziali utente
    const mcpTool = {
      type: "mcp" as const,
      server_label: "things5",
      server_description: "Things5 IoT platform for device management",
      server_url: `${this.mcpConfig.serverUrl}?username=${encodeURIComponent(this.mcpConfig.username)}&password=${encodeURIComponent(this.mcpConfig.password)}`,
      require_approval: "never" as const
    };

    try {
      const response = await this.openai.responses.create({
        model: "gpt-4o",
        tools: [mcpTool],
        input: message
      });

      return response.output_text;
    } catch (error) {
      throw new Error(`Things5 integration error: ${error.message}`);
    }
  }
}

// Utilizzo nell'app
const integration = new Things5Integration(OPENAI_API_KEY, userMcpConfig);
const response = await integration.chatWithThings5("Show me my IoT devices");
```

#### **Flutter Example:**

```dart
import 'package:openai_dart/openai_dart.dart';

class Things5Integration {
  final OpenAIClient _openai;
  final MCPConfig _config;

  Things5Integration(String apiKey, this._config) 
    : _openai = OpenAIClient(apiKey: apiKey);

  Future<String> chatWithThings5(String message) async {
    if (!_config.enabled) {
      throw Exception("Things5 integration not enabled");
    }

    final mcpTool = CreateResponseRequestTool(
      type: 'mcp',
      serverLabel: 'things5',
      serverDescription: 'Things5 IoT platform for device management',
      serverUrl: '${_config.serverUrl}?username=${Uri.encodeComponent(_config.username)}&password=${Uri.encodeComponent(_config.password)}',
      requireApproval: 'never',
    );

    try {
      final response = await _openai.createResponse(
        request: CreateResponseRequest(
          model: 'gpt-4o',
          tools: [mcpTool],
          input: message,
        ),
      );

      return response.outputText ?? '';
    } catch (error) {
      throw Exception('Things5 integration error: $error');
    }
  }
}
```

#### **iOS Swift Example:**

```swift
import OpenAI

class Things5Integration {
    private let openAI: OpenAI
    private let config: MCPConfig
    
    init(apiKey: String, config: MCPConfig) {
        self.openAI = OpenAI(apiToken: apiKey)
        self.config = config
    }
    
    func chatWithThings5(message: String) async throws -> String {
        guard config.enabled else {
            throw IntegrationError.notEnabled
        }
        
        let serverUrl = "\(config.serverUrl)?username=\(config.username.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")&password=\(config.password.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")"
        
        let mcpTool = MCPTool(
            type: "mcp",
            serverLabel: "things5",
            serverDescription: "Things5 IoT platform for device management",
            serverUrl: serverUrl,
            requireApproval: "never"
        )
        
        let request = ResponseRequest(
            model: .gpt4o,
            tools: [mcpTool],
            input: message
        )
        
        let response = try await openAI.responses(query: request)
        return response.outputText
    }
}
```

#### **Android Kotlin Example:**

```kotlin
import com.openai.client.OpenAIClient
import com.openai.models.*

class Things5Integration(
    private val openAI: OpenAIClient,
    private val config: MCPConfig
) {
    suspend fun chatWithThings5(message: String): String {
        if (!config.enabled) {
            throw IllegalStateException("Things5 integration not enabled")
        }

        val serverUrl = "${config.serverUrl}?username=${URLEncoder.encode(config.username, "UTF-8")}&password=${URLEncoder.encode(config.password, "UTF-8")}"
        
        val mcpTool = ResponseCreateParams.Tool.builder()
            .type("mcp")
            .serverLabel("things5")
            .serverDescription("Things5 IoT platform for device management")
            .serverUrl(serverUrl)
            .requireApproval("never")
            .build()

        val request = ResponseCreateParams.builder()
            .model("gpt-4o")
            .tools(listOf(mcpTool))
            .input(message)
            .build()

        val response = openAI.responses().create(request)
        return response.outputText()
    }
}
```

## 🔧 **Configurazione Server MCP Avanzata**

Per maggiore sicurezza, il server MCP può gestire l'autenticazione in modo più sofisticato:

### **Opzione 1: Credenziali in URL (Semplice)**
```
https://things5-mcp-server.onrender.com/sse?username=user@example.com&password=mypassword
```

### **Opzione 2: Header Authorization (Più Sicuro)**
```typescript
// L'app mobile invia credenziali nell'header
const mcpTool = {
  type: "mcp",
  server_label: "things5",
  server_url: "https://things5-mcp-server.onrender.com/sse",
  authorization: `Basic ${btoa(`${username}:${password}`)}`,
  require_approval: "never"
};
```

### **Opzione 3: Token Pre-ottenuto (Più Performante)**
```typescript
// L'app ottiene un token una volta e lo riusa
async function getThings5Token(username: string, password: string): Promise<string> {
  const response = await fetch('https://auth.things5.digital/auth/realms/demo10/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: 'api',
      grant_type: 'password',
      scope: 'openid',
      username,
      password
    })
  });
  
  const data = await response.json();
  return data.access_token;
}

// Usa il token con OpenAI
const token = await getThings5Token(username, password);
const mcpTool = {
  type: "mcp",
  server_label: "things5", 
  server_url: "https://things5-mcp-server.onrender.com/sse",
  authorization: `Bearer ${token}`,
  require_approval: "never"
};
```

## 🎨 **UI/UX Recommendations**

### **Settings Screen:**
```typescript
interface SettingsScreen {
  // Things5 Integration Section
  things5Enabled: boolean;
  things5ServerUrl: string;     // Default: https://things5-mcp-server.onrender.com/sse
  things5Username: string;      // User input
  things5Password: string;      // User input (secure)
  
  // Test Connection Button
  testConnection(): Promise<boolean>;
  
  // Status Indicator
  connectionStatus: 'connected' | 'disconnected' | 'testing' | 'error';
}
```

### **Chat Interface:**
```typescript
// Indica quando vengono usati i tools Things5
interface ChatMessage {
  text: string;
  timestamp: Date;
  mcpToolsUsed?: string[];  // ["devicesList", "overviewEvents"]
  things5Data?: boolean;    // Indica se la risposta include dati IoT
}
```

## 🔒 **Sicurezza per App Mobile**

### **Best Practices:**

1. **Credenziali Locali:**
   ```typescript
   // Salva credenziali in modo sicuro
   import { SecureStore } from 'expo-secure-store';
   
   await SecureStore.setItemAsync('things5_username', username);
   await SecureStore.setItemAsync('things5_password', password);
   ```

2. **Validazione Input:**
   ```typescript
   function validateThings5Credentials(username: string, password: string): boolean {
     return username.includes('@') && password.length >= 6;
   }
   ```

3. **Error Handling:**
   ```typescript
   try {
     const response = await integration.chatWithThings5(message);
     return response;
   } catch (error) {
     if (error.message.includes('authentication')) {
       // Mostra schermata login Things5
       showThings5LoginScreen();
     } else {
       // Mostra errore generico
       showError('Unable to connect to IoT system');
     }
   }
   ```

## 📋 **Checklist Implementazione**

### **Per gli Sviluppatori Mobile:**

- [ ] **UI Settings** - Campi username/password Things5
- [ ] **Secure Storage** - Salvataggio sicuro credenziali  
- [ ] **OpenAI Integration** - Configurazione MCP tool
- [ ] **Error Handling** - Gestione errori autenticazione
- [ ] **Connection Test** - Pulsante test connessione
- [ ] **Status Indicator** - Mostra stato connessione IoT
- [ ] **Chat Enhancement** - Indica quando usa dati IoT

### **Testing:**

```typescript
// Test di integrazione
async function testThings5Integration() {
  const integration = new Things5Integration(OPENAI_API_KEY, {
    serverUrl: "https://things5-mcp-server.onrender.com/sse",
    username: "test@example.com",
    password: "testpassword",
    enabled: true
  });
  
  try {
    const response = await integration.chatWithThings5("Hello, show me available IoT tools");
    console.log("✅ Integration working:", response);
    return true;
  } catch (error) {
    console.log("❌ Integration failed:", error);
    return false;
  }
}
```

## 🚀 **Deployment Notes**

### **Environment Variables:**
```bash
# Per l'app mobile (build time)
THINGS5_MCP_SERVER_URL=https://things5-mcp-server.onrender.com/sse
THINGS5_DEFAULT_REALM=demo10
THINGS5_CLIENT_ID=api
```

### **Server URLs:**
- **Production**: `https://things5-mcp-server.onrender.com/sse`
- **Staging**: `https://things5-mcp-server-staging.onrender.com/sse`
- **Development**: `http://localhost:3000/sse?no_auth=true`

## 💡 **Esempio Completo Funzionante**

```typescript
// Complete working example for mobile app
class Things5ChatBot {
  private integration: Things5Integration;
  
  constructor(openaiApiKey: string, things5Config: MCPConfig) {
    this.integration = new Things5Integration(openaiApiKey, things5Config);
  }
  
  async askAboutIoT(question: string): Promise<string> {
    // L'app mobile fa solo questo - tutto il resto è automatico!
    return await this.integration.chatWithThings5(question);
  }
}

// Utilizzo nell'app
const chatBot = new Things5ChatBot(OPENAI_API_KEY, {
  serverUrl: "https://things5-mcp-server.onrender.com/sse",
  username: userSettings.things5Username,
  password: userSettings.things5Password,
  enabled: true
});

// L'utente chiede qualcosa sui suoi dispositivi IoT
const answer = await chatBot.askAboutIoT("Show me my smart home devices status");
// Il server MCP gestisce automaticamente: auth, API calls, data formatting
// L'app riceve la risposta finale formattata da OpenAI
```

---

## 🎯 **Riassunto per Team Mobile**

**L'app mobile deve solo:**
1. ✅ Raccogliere username/password dall'utente
2. ✅ Configurare OpenAI con l'URL del server MCP  
3. ✅ Inviare domande a OpenAI
4. ✅ Mostrare le risposte all'utente

**Il server MCP gestisce automaticamente:**
- 🔐 Autenticazione OAuth con Keycloak
- 🔄 Rinnovo automatico token
- 🌐 Chiamate API Things5
- 📊 Elaborazione dati IoT
- 🔧 Gestione errori e retry

**Risultato: Integrazione IoT con ~20 righe di codice!** 🚀
