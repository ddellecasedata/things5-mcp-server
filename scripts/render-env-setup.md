# Setup Variabili d'Ambiente su Render

## Variabili Obbligatorie

Vai su Render Dashboard → Il tuo Service → Environment e aggiungi:

```
PORT=3000
NODE_ENV=production
```

## Variabili per Things5 Integration

```
KEYCLOAK_BASE_URL=https://your-keycloak-instance.com
THINGS5_BASE_URL=https://api.things5.com  
THINGS5_RECIPES_BASE_URL=https://recipes.things5.com
```

## Variabili Opzionali per Debug

```
DEBUG=mcp:*
LOG_LEVEL=info
```

## Setup via Render CLI

Se preferisci usare la CLI:

```bash
# Installa Render CLI
npm install -g @render/cli

# Login
render auth login

# Imposta variabili (sostituisci SERVICE_ID con il tuo)
render env set PORT=3000 --service-id=YOUR_SERVICE_ID
render env set NODE_ENV=production --service-id=YOUR_SERVICE_ID
render env set KEYCLOAK_BASE_URL=https://your-keycloak.com --service-id=YOUR_SERVICE_ID
render env set THINGS5_BASE_URL=https://api.things5.com --service-id=YOUR_SERVICE_ID
render env set THINGS5_RECIPES_BASE_URL=https://recipes.things5.com --service-id=YOUR_SERVICE_ID
```

## Verifica Setup

Dopo aver impostato le variabili:

1. **Redeploy**: Render farà automaticamente redeploy
2. **Controlla Logs**: Dashboard → Service → Logs
3. **Test Health**: `curl https://your-app.onrender.com/health`

## Sicurezza

⚠️ **IMPORTANTE**: 
- Non committare mai secrets nel codice
- Usa sempre Environment Variables per API keys
- Ruota regolarmente le credenziali
