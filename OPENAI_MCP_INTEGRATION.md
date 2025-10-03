# OpenAI MCP Integration Guide

Questo server MCP Things5 è stato adattato per essere completamente compatibile con le specifiche OpenAI MCP. Supporta entrambi i protocolli di trasporto richiesti:

## Protocolli Supportati

### 1. Streamable HTTP Transport
- **Endpoint**: `POST /mcp`
- **Utilizzo**: Per richieste MCP standard con sessioni HTTP

### 2. HTTP/SSE Transport  
- **Endpoint**: `GET /sse`
- **Utilizzo**: Per connessioni Server-Sent Events come richiesto da OpenAI

## Configurazione

### Variabili d'Ambiente (.env.local)

```bash
NODE_ENV=production
PORT=3000
KEYCLOAK_BASE_URL=https://auth.things5.digital
KEYCLOAK_CLIENT_ID=mcp-server
THINGS5_BASE_URL=http://api.things5.digital/v1
THINGS5_RECIPES_BASE_URL=https://api.things5.digital/v1/recipes
```

## Utilizzo con OpenAI Responses API

### Esempio di Configurazione

```python
from openai import OpenAI

client = OpenAI()

resp = client.responses.create(
    model="gpt-5",
    tools=[
        {
            "type": "mcp",
            "server_label": "things5",
            "server_description": "Things5 IoT platform MCP server for device management and data access.",
            "server_url": "https://your-server-domain.com/sse",
            "authorization": "Bearer YOUR_ACCESS_TOKEN",
            "require_approval": "never",  # o configurare approvazioni specifiche
        },
    ],
    input="Mostra i dispositivi nella mia organizzazione",
)

print(resp.output_text)
```

### Con Approvazioni Selettive

```python
resp = client.responses.create(
    model="gpt-5",
    tools=[
        {
            "type": "mcp",
            "server_label": "things5",
            "server_url": "https://your-server-domain.com/sse",
            "authorization": "Bearer YOUR_ACCESS_TOKEN",
            "require_approval": {
                "never": {
                    "tool_names": ["devicesList", "devicesGroupsList", "overviewEvents"]
                }
            },
            "allowed_tools": ["devicesList", "deviceDetails", "overviewEvents", "overviewAlarms"]
        },
    ],
    input="Analizza lo stato dei miei dispositivi IoT",
)
```

## Autenticazione

Il server supporta l'autenticazione OAuth 2.0 tramite Keycloak:

1. **Token Bearer**: Includi il token di accesso nell'header `Authorization: Bearer <token>`
2. **Modalità No-Auth**: Per test, aggiungi `?no_auth=true` all'URL dell'endpoint

## Endpoints Disponibili

- `POST /mcp` - Streamable HTTP transport
- `GET /sse` - HTTP/SSE transport (raccomandato per OpenAI)
- `DELETE /mcp` - Terminazione sessione
- `GET /health` - Health check
- `GET /.well-known/oauth-authorization-server` - OAuth metadata
- `POST /register` - Dynamic client registration

## Tools Disponibili

Il server espone tutti i tools Things5 esistenti:

- **Device Management**: `devicesList`, `deviceDetails`, `deviceCreate`, `deviceUpdate`
- **Device Groups**: `devicesGroupsList`, `showDeviceGroup`, `createDeviceGroupUser`
- **Data Access**: `readParameters`, `readSingleParameter`, `statesRead`, `metricsRead`
- **Machine Commands**: `machineCommandCreate`, `machineCommandExecute`, `machineCommandUpdate`
- **Overview**: `overviewEvents`, `overviewAlarms`
- **User Management**: `usersList`, `usersDetail`, `userCreate`
- **Firmware**: `deviceFirmwareDetail`, `deviceFirmwareUpdateRequest`

## Sicurezza e Best Practices

1. **Sempre utilizzare HTTPS** in produzione
2. **Configurare approvazioni** per azioni sensibili
3. **Limitare i tools** con `allowed_tools` se necessario
4. **Monitorare i log** per richieste sospette
5. **Validare i token** OAuth regolarmente

## Esempio di Risposta MCP

Quando il modello utilizza un tool, riceverai output come:

```json
{
    "id": "mcp_68a6102d8948819c9b1490d36d5ffa4a0679e572a900e618",
    "type": "mcp_call",
    "approval_request_id": null,
    "arguments": "{\"organization_id\":\"123\"}",
    "error": null,
    "name": "devicesList",
    "output": "{\"devices\": [...]}",
    "server_label": "things5"
}
```

## Troubleshooting

### Errori Comuni

1. **Token Validation Failed**: Verifica che il token sia valido e non scaduto
2. **Missing Bearer Token**: Assicurati di includere l'header Authorization
3. **Session ID Issues**: Per Streamable HTTP, gestisci correttamente i session ID
4. **CORS Errors**: Il server ha CORS abilitato per `*`, ma verifica la configurazione del client

### Debug

Abilita i log dettagliati impostando:
```bash
DEBUG=mcp:*
LOG_LEVEL=debug
```
