# Things5 MCP Server

Server MCP per Things5: gestione autenticazione OAuth2, integrazione API Things5, strumenti modulari e deploy Docker-ready.

## Funzionalità principali
- **Autenticazione OAuth2** (Keycloak)
- **Strumenti MCP** modulari (es. lista macchine, lettura parametri)
- **Configurazione centralizzata** via variabili ambiente (`src/config.ts`)
- **Server HTTP Express** con router dedicati
- **Build e deploy Docker** ottimizzati

## Struttura del progetto
- `src/server/things5.ts` — Entry point server MCP
- `src/tools/` — Tool MCP modulari (es. `listMachines`, `readParameters`)
- `src/oauth.ts`, `src/keycloak.ts` — Middleware OAuth2/Keycloak
- `src/config.ts` — Configurazione variabili ambiente

## Tool disponibili
- **list_machines**: Elenca i device registrati
- **read_parameters**: Leggi parametri di un device (con parsing custom)
- *(aggiungi altri tool in `src/tools/`)*

## Quick Start

### Sviluppo locale
```bash
# Installa dipendenze
npm install

# Compila il progetto
npm run build

# Avvia il server
npm run start:streamableHttp
```

### Test con MCP Inspector
```bash
npx @modelcontextprotocol/inspector --url http://localhost:3001/mcp --transport streamable-http
```

### Deploy su Render

1. **Push su Git**: Carica il codice su GitHub/GitLab
2. **Crea Web Service** su [Render](https://dashboard.render.com)
3. **Configura**:
   - Environment: Docker
   - Dockerfile Path: `./Dockerfile`
   - Aggiungi variabili d'ambiente (vedi `.env.example`)

📖 **Guida completa**: [DEPLOY_RENDER.md](./DEPLOY_RENDER.md)

### Test Docker locale
```bash
# Test build Docker
./scripts/deploy-local.sh

# Health check
curl http://localhost:3000/health
```

- Puoi esplorare tool, inviare richieste e vedere le risposte in tempo reale.
- Inspector supporta anche autenticazione Bearer se richiesta.

## Build & Run

```sh
pnpm install
pnpm build
pnpm start
```

Per build Docker:
```sh
docker build -t things5-mcp-server .
docker run -p 3001:3001 things5-mcp-server
```

## Configurazione
- Modifica le variabili in `.env` o esportale nell’ambiente (es. `KEYCLOAK_BASE_URL`).
- Vedi `src/config.ts` per dettagli.

## Note
- Il server è pensato per essere esteso facilmente: aggiungi tool in `src/tools/` e saranno registrati automaticamente.
- Per domande o contributi: [contatta Andrea Grossetti](mailto:andrea@visup.it)
