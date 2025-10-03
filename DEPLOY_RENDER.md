# Deploy MCP Things5 Server su Render

## Prerequisiti

1. Account Render (gratuito): https://render.com
2. Repository Git (GitHub, GitLab, o Bitbucket)
3. Codice del server MCP Things5

## Preparazione del Codice

### 1. Verifica Dockerfile

Il progetto include già un `Dockerfile` ottimizzato:

```dockerfile
FROM node:22-alpine AS base
WORKDIR /app

COPY package.json pnpm-lock.yaml ./

# install only runtime dependencies
RUN NODE_ENV=production corepack enable && \
    corepack prepare pnpm@10.12.1 --activate && \
    pnpm install --prod --frozen-lockfile --ignore-scripts

FROM base AS build
COPY . .

# install everything for the build
RUN pnpm install --frozen-lockfile
RUN pnpm run build

FROM base AS runtime
COPY --from=build /app/dist ./dist

EXPOSE 3000
USER node

CMD ["node", "dist/streamableHttp.js"]
```

### 2. Aggiorna package.json per Render

Assicurati che il `package.json` abbia gli script corretti:

```json
{
  "scripts": {
    "build": "tsc && shx chmod +x dist/*.js",
    "start": "node dist/streamableHttp.js",
    "start:streamableHttp": "node dist/streamableHttp.js"
  }
}
```

### 3. Crea file render.yaml (Opzionale)

Crea un file `render.yaml` per configurazione Infrastructure as Code:

```yaml
services:
  - type: web
    name: mcp-things5-server
    env: docker
    dockerfilePath: ./Dockerfile
    plan: free
    region: oregon
    envVars:
      - key: PORT
        value: 3000
      - key: NODE_ENV
        value: production
      - key: KEYCLOAK_BASE_URL
        sync: false
      - key: THINGS5_BASE_URL
        sync: false
      - key: THINGS5_RECIPES_BASE_URL
        sync: false
```

## Deploy su Render

### Metodo 1: Dashboard Web

1. **Accedi a Render**: https://dashboard.render.com

2. **Crea nuovo Web Service**:
   - Click "New" → "Web Service"
   - Connetti il tuo repository Git
   - Seleziona il repository del progetto

3. **Configurazione Service**:
   ```
   Name: mcp-things5-server
   Environment: Docker
   Region: Oregon (o più vicina)
   Branch: main
   Dockerfile Path: ./Dockerfile
   ```

4. **Configurazione Build**:
   ```
   Build Command: (lascia vuoto - usa Dockerfile)
   Start Command: (lascia vuoto - usa Dockerfile CMD)
   ```

5. **Piano**:
   - Seleziona "Free" per test
   - Upgrade a "Starter" ($7/mese) per produzione

### Metodo 2: Render CLI

```bash
# Installa Render CLI
npm install -g @render/cli

# Login
render auth login

# Deploy
render deploy
```

## Variabili d'Ambiente

Configura le seguenti variabili d'ambiente su Render:

### Obbligatorie:
```
PORT=3000
NODE_ENV=production
```

### Per integrazione Things5:
```
KEYCLOAK_BASE_URL=https://your-keycloak-instance.com
THINGS5_BASE_URL=https://api.things5.com
THINGS5_RECIPES_BASE_URL=https://recipes.things5.com
```

### Per debug (opzionali):
```
DEBUG=mcp:*
LOG_LEVEL=info
```

## Configurazione Avanzata

### 1. Custom Domain

1. Nel dashboard Render, vai al tuo service
2. Settings → Custom Domains
3. Aggiungi il tuo dominio
4. Configura DNS CNAME record

### 2. Health Checks

Render controllerà automaticamente:
- Endpoint: `GET /health`
- Timeout: 30 secondi
- Intervallo: 30 secondi

### 3. Auto-Deploy

Configura auto-deploy da Git:
1. Settings → Auto-Deploy
2. Abilita "Auto-Deploy"
3. Seleziona branch (es. `main`)

### 4. Scaling

Per traffico elevato:
1. Upgrade al piano "Standard" o superiore
2. Settings → Scaling
3. Configura istanze multiple

## Monitoraggio

### Logs
```bash
# Via CLI
render logs -s your-service-id

# Via Dashboard
Dashboard → Service → Logs
```

### Metriche
- CPU usage
- Memory usage  
- Request count
- Response time

## Test del Deploy

Dopo il deploy, testa il server:

```bash
# Health check
curl https://your-app.onrender.com/health

# MCP endpoint
curl -X POST https://your-app.onrender.com/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'
```

## Connessione da Claude

Una volta deployato, puoi connettere Claude al tuo server:

```bash
# Claude Desktop
claude mcp add --transport http mcp-things5 https://your-app.onrender.com/mcp

# MCP Inspector
npx @modelcontextprotocol/inspector
# URL: https://your-app.onrender.com/mcp
```

## Troubleshooting

### Build Failures
- Verifica Node.js version (22+ richiesta)
- Controlla dipendenze in package.json
- Verifica Dockerfile syntax

### Runtime Errors
- Controlla logs: `render logs -s service-id`
- Verifica variabili d'ambiente
- Testa localmente con Docker

### Performance Issues
- Upgrade piano Render
- Ottimizza queries database
- Implementa caching

### SSL/HTTPS
- Render fornisce SSL automatico
- Usa sempre HTTPS in produzione
- Configura CORS per domini esterni

## Costi

### Piano Free
- 750 ore/mese
- Sleep dopo 15 min inattività
- Perfetto per test/sviluppo

### Piano Starter ($7/mese)
- Sempre attivo
- Custom domains
- Perfetto per produzione piccola

### Piani superiori
- Più risorse CPU/RAM
- Multiple istanze
- SLA garantiti

## Sicurezza

### Variabili d'Ambiente
- Mai committare secrets nel codice
- Usa Render Environment Variables
- Ruota regolarmente le chiavi API

### HTTPS
- Sempre abilitato su Render
- Certificati SSL automatici
- HTTP redirect a HTTPS

### Autenticazione
- Configura correttamente Keycloak
- Usa token JWT sicuri
- Implementa rate limiting

Con questa configurazione, il tuo server MCP Things5 sarà deployato professionalmente su Render con tutte le best practices di sicurezza e performance.
