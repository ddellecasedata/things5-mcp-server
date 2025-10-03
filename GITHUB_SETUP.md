# 🚀 Setup GitHub e Deploy su Render

## 1. Inizializza Repository Git

```bash
# Vai nella directory del progetto
cd /Users/daniele/Downloads/things5-mcp-server-staging

# Inizializza Git
git init

# Aggiungi tutti i file
git add .

# Primo commit
git commit -m "Initial commit: MCP Things5 Server with SDK corrections"
```

## 2. Crea Repository su GitHub

1. Vai su [github.com](https://github.com)
2. Click "New repository" (+ in alto a destra)
3. Nome repository: `things5-mcp-server` (o nome a tua scelta)
4. Descrizione: `MCP Server for Things5 integration with OAuth2 and Docker deploy`
5. **NON** inizializzare con README (abbiamo già i file)
6. Click "Create repository"

## 3. Collega Repository Locale a GitHub

```bash
# Aggiungi remote origin (sostituisci USERNAME con il tuo username GitHub)
git remote add origin https://github.com/USERNAME/things5-mcp-server.git

# Verifica remote
git remote -v

# Push iniziale
git branch -M main
git push -u origin main
```

## 4. Verifica File Sensibili (.gitignore)

Assicurati che `.gitignore` includa:

```
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/

# Environment variables
.env
.env.local
.env.production

# Logs
*.log
npm-debug.log*

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Secrets (IMPORTANTE!)
*.key
*.pem
secrets/
```

## 5. Deploy su Render

Una volta su GitHub:

1. **Vai su Render**: [dashboard.render.com](https://dashboard.render.com)
2. **New Web Service** → Connetti GitHub
3. **Seleziona repository**: `things5-mcp-server`
4. **Configurazione**:
   ```
   Name: mcp-things5-server
   Environment: Docker
   Branch: main
   Dockerfile Path: ./Dockerfile
   ```

5. **Environment Variables**:
   ```
   PORT=3000
   NODE_ENV=production
   KEYCLOAK_BASE_URL=https://your-keycloak.com
   THINGS5_BASE_URL=https://api.things5.com
   THINGS5_RECIPES_BASE_URL=https://recipes.things5.com
   ```

6. **Deploy**: Click "Create Web Service"

## 6. Auto-Deploy Setup

Render farà automaticamente deploy ad ogni push su `main`:

```bash
# Modifiche future
git add .
git commit -m "Update: description of changes"
git push origin main
# → Render farà automaticamente redeploy
```

## 7. Verifica Deploy

Dopo il deploy:

```bash
# Test health check (sostituisci URL)
curl https://your-app-name.onrender.com/health

# Test MCP endpoint
curl -X POST https://your-app-name.onrender.com/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'
```

## 8. Connetti a Claude

```bash
# Claude Desktop
claude mcp add --transport http mcp-things5 https://your-app-name.onrender.com/mcp

# MCP Inspector per test
npx @modelcontextprotocol/inspector
# URL: https://your-app-name.onrender.com/mcp
```

## Troubleshooting

### Build Fails
- Controlla logs su Render Dashboard
- Verifica Dockerfile e dipendenze
- Testa build locale: `./scripts/deploy-local.sh`

### Runtime Errors
- Controlla Environment Variables su Render
- Verifica logs: Dashboard → Service → Logs
- Test locale con stesse variabili

### GitHub Issues
```bash
# Se hai problemi con remote
git remote remove origin
git remote add origin https://github.com/USERNAME/REPO.git

# Se hai conflitti
git pull origin main --allow-unrelated-histories
```

## Sicurezza

⚠️ **IMPORTANTE**:
- Mai committare `.env` files
- Usa GitHub Secrets per CI/CD se necessario
- Configura branch protection su `main`
- Review code prima del merge

🎉 **Il tuo server MCP sarà online e accessibile da Claude!**
