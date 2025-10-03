# Guida Configurazione Autenticazione Things5 MCP Server

## Informazioni Identificate

Dall'URL di autenticazione fornito, abbiamo identificato:

- **Keycloak Server**: `https://auth.things5.digital`
- **Realm**: `demo10`
- **Client ID Frontend**: `frontend`
- **Redirect URI**: `https://demo10.things5.digital`

## Problema Attuale

Il client `frontend` non è configurato per permettere "Direct Access Grants" (Resource Owner Password Credentials flow), che è necessario per l'autenticazione programmatica del server MCP.

## Soluzioni

### Opzione 1: Configurare Client MCP in Keycloak (Raccomandato)

**Passi per l'amministratore Keycloak:**

1. **Accedi alla console admin Keycloak**
   - URL: `https://auth.things5.digital/auth/admin`
   - Seleziona realm: `demo10`

2. **Crea nuovo client per MCP**
   - Vai su "Clients" → "Create"
   - Client ID: `mcp-server`
   - Client Protocol: `openid-connect`
   - Access Type: `public` o `confidential`

3. **Configura il client MCP**
   ```
   Settings:
   - Access Type: public
   - Standard Flow Enabled: ON
   - Direct Access Grants Enabled: ON ✅ (Importante!)
   - Service Accounts Enabled: OFF
   - Authorization Enabled: OFF
   
   Valid Redirect URIs:
   - http://localhost:3000/*
   - https://your-production-domain.com/*
   
   Web Origins:
   - http://localhost:3000
   - https://your-production-domain.com
   ```

4. **Assegna ruoli appropriati**
   - Vai su "Service Account Roles" (se confidential)
   - Assegna i ruoli necessari per accedere alle API Things5

### Opzione 2: Utilizzare Token Esistente

Se hai già un token valido dal frontend, puoi utilizzarlo direttamente:

```bash
# Ottieni il token dal browser (Developer Tools → Network → Headers)
export ACCESS_TOKEN="your-existing-token-here"

# Testa con il server MCP
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {"roots": {"listChanged": true}, "sampling": {}},
      "clientInfo": {"name": "test-client", "version": "1.0.0"}
    },
    "id": 1
  }'
```

### Opzione 3: Modalità No-Auth per Sviluppo

Per test e sviluppo, puoi utilizzare la modalità senza autenticazione:

```bash
# Avvia il server
npm run start:streamableHttp

# Testa senza autenticazione
curl -X POST 'http://localhost:3000/mcp?no_auth=true' \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc": "2.0", "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {"roots": {"listChanged": true}, "sampling": {}}, "clientInfo": {"name": "test-client", "version": "1.0.0"}}, "id": 1}'
```

## Configurazione Server MCP

Aggiorna il file `.env` con le informazioni corrette:

```bash
NODE_ENV=production
PORT=3000
KEYCLOAK_BASE_URL=https://auth.things5.digital
KEYCLOAK_CLIENT_ID=mcp-server
THINGS5_BASE_URL=http://api.things5.digital/v1
THINGS5_RECIPES_BASE_URL=https://api.things5.digital/v1/recipes
```

## Test Autenticazione

Una volta configurato il client `mcp-server`, testa l'autenticazione:

```bash
# Test con credenziali
node test-demo10-auth.cjs "ddellecasedata+test@gmail.com" "Password"
```

## Utilizzo con OpenAI MCP

### Con Autenticazione

```python
from openai import OpenAI

client = OpenAI()

# Prima ottieni un token (esempio con requests)
import requests

token_response = requests.post(
    'https://auth.things5.digital/auth/realms/demo10/protocol/openid-connect/token',
    data={
        'grant_type': 'password',
        'client_id': 'mcp-server',
        'username': 'ddellecasedata+test@gmail.com',
        'password': 'Password',
        'scope': 'openid profile email'
    }
)

access_token = token_response.json()['access_token']

# Usa con OpenAI MCP
resp = client.responses.create(
    model="gpt-5",
    tools=[{
        "type": "mcp",
        "server_label": "things5",
        "server_description": "Things5 IoT platform for device management",
        "server_url": "https://your-server.com/sse",
        "authorization": f"Bearer {access_token}",
        "require_approval": "never"
    }],
    input="Show me all my IoT devices"
)
```

### Senza Autenticazione (Solo Sviluppo)

```python
resp = client.responses.create(
    model="gpt-5",
    tools=[{
        "type": "mcp",
        "server_label": "things5",
        "server_url": "http://localhost:3000/sse?no_auth=true",
        "require_approval": "never"
    }],
    input="Show me all my IoT devices"
)
```

## Troubleshooting

### Errore: "Client not allowed for direct access grants"
- Il client non ha "Direct Access Grants Enabled"
- Contatta l'admin per abilitarlo o creare il client `mcp-server`

### Errore: "Token validation failed"
- Il token potrebbe essere scaduto
- Verifica che il server possa raggiungere Keycloak
- Controlla che il realm sia corretto (`demo10`)

### Errore: "Realm does not exist"
- Verifica che il realm `demo10` esista
- Controlla l'URL base di Keycloak

## Sicurezza

⚠️ **Importante per la produzione:**

1. **Non utilizzare mai `no_auth=true` in produzione**
2. **Utilizza HTTPS per tutti gli endpoint**
3. **Configura CORS appropriatamente**
4. **Monitora i log di autenticazione**
5. **Ruota regolarmente i token**
6. **Utilizza scopi (scopes) appropriati**

## Contatti

Per configurare il client `mcp-server` in Keycloak, contatta l'amministratore del sistema con queste specifiche:

- Realm: `demo10`
- Client ID: `mcp-server`
- Direct Access Grants: `Enabled`
- Valid Redirect URIs: `http://localhost:3000/*`, `https://your-domain.com/*`
