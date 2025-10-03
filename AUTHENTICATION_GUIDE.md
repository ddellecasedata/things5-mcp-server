# Guida Completa Autenticazione Things5 MCP

## 🔐 Come Configurare l'Autenticazione

### 1. **Configurazione Base**

```python
from auth_manager import Things5AuthManager

# Inizializza il gestore autenticazione
auth_manager = Things5AuthManager(
    username="your-username@example.com",
    password="your-password"
)

# Autentica (ottiene token iniziale)
if auth_manager.authenticate():
    print("✅ Authenticated successfully!")
else:
    print("❌ Authentication failed")
```

### 2. **Rinnovo Automatico Token**

Il token si rinnova **automaticamente**! 🎉

```python
# Il gestore si occupa automaticamente di:
# ✅ Rinnovare il token prima della scadenza
# ✅ Gestire refresh token
# ✅ Thread-safety per applicazioni multi-thread
# ✅ Retry automatici in caso di errori

# Ottieni sempre un token valido
token = auth_manager.get_access_token()  # Sempre fresco!
```

### 3. **Integrazione con OpenAI MCP**

```python
from openai_integration_complete import Things5OpenAIIntegration

# Setup completo con gestione automatica
integration = Things5OpenAIIntegration(
    username="your-username@example.com", 
    password="your-password"
)

# Una sola volta: setup iniziale
integration.setup()

# Usa quanto vuoi - l'autenticazione è automatica!
response = integration.chat("Show me my IoT devices")
print(response)
```

## 🔄 Gestione Automatica Token

### **Cosa Succede Automaticamente:**

1. **🔑 Ottenimento Token Iniziale**
   - Login con username/password
   - Ottiene access_token + refresh_token
   - Calcola scadenza con margine di sicurezza

2. **⏰ Monitoraggio Scadenza**
   - Thread in background controlla ogni 5 minuti
   - Rinnova automaticamente 10 minuti prima della scadenza
   - Non interrompe mai le tue operazioni

3. **🔄 Rinnovo Automatico**
   - Usa refresh_token per ottenere nuovo access_token
   - Aggiorna automaticamente tutte le configurazioni
   - Fallback: ri-autentica se refresh fallisce

4. **🛡️ Thread Safety**
   - Sicuro per applicazioni multi-thread
   - Lock per evitare race conditions
   - Gestione errori robusta

### **Configurazione Avanzata:**

```python
# Personalizza il comportamento
auth_manager = Things5AuthManager(
    username="your-username",
    password="your-password",
    keycloak_url="https://auth.things5.digital",  # Personalizzabile
    realm="demo10",                               # Realm corretto
    client_id="api"                              # Client ID corretto
)

# Controlla stato token
token_info = auth_manager.get_token_info()
print(f"Token expires in: {token_info['time_to_expiry']} seconds")
print(f"Has refresh token: {token_info['has_refresh_token']}")
```

## 🚀 Esempi Pratici

### **Esempio 1: Chat Semplice**

```python
from openai_integration_complete import Things5OpenAIIntegration

# Setup una volta
integration = Things5OpenAIIntegration("user@example.com", "password")
integration.setup()

# Usa per ore/giorni - l'auth è automatica!
while True:
    message = input("Ask about your IoT: ")
    if message.lower() == 'quit':
        break
    
    response = integration.chat(message)
    print(f"🤖 {response}")

# Cleanup alla fine
integration.cleanup()
```

### **Esempio 2: Applicazione Web**

```python
from flask import Flask, request, jsonify
from openai_integration_complete import Things5OpenAIIntegration

app = Flask(__name__)

# Inizializza una volta all'avvio
integration = Things5OpenAIIntegration(
    username=os.getenv("THINGS5_USERNAME"),
    password=os.getenv("THINGS5_PASSWORD")
)
integration.setup()

@app.route('/chat', methods=['POST'])
def chat():
    message = request.json.get('message')
    
    # L'autenticazione è sempre valida!
    response = integration.chat(message)
    
    return jsonify({"response": response})

if __name__ == '__main__':
    app.run()
    # L'auth manager continua a rinnovare i token in background
```

### **Esempio 3: Script Batch/Cron**

```python
#!/usr/bin/env python3
"""
Script che gira ogni ora per monitorare IoT
L'autenticazione si gestisce da sola!
"""

from openai_integration_complete import Things5OpenAIIntegration
import schedule
import time

def monitor_iot():
    integration = Things5OpenAIIntegration("user@example.com", "password")
    integration.setup()
    
    # Analisi automatica
    report = integration.chat(
        "Give me a summary of IoT system health, any alerts, and device status"
    )
    
    # Salva report o invia email
    with open(f"iot_report_{time.strftime('%Y%m%d_%H%M')}.txt", "w") as f:
        f.write(report)
    
    integration.cleanup()

# Programma esecuzione ogni ora
schedule.every().hour.do(monitor_iot)

while True:
    schedule.run_pending()
    time.sleep(60)
```

## 🔧 Configurazione Produzione

### **Variabili d'Ambiente (Raccomandato)**

```bash
# .env file
THINGS5_USERNAME=your-username@example.com
THINGS5_PASSWORD=your-secure-password
OPENAI_API_KEY=your-openai-key

# Opzionali
THINGS5_KEYCLOAK_URL=https://auth.things5.digital
THINGS5_REALM=demo10
THINGS5_CLIENT_ID=api
```

```python
import os
from dotenv import load_dotenv

load_dotenv()

integration = Things5OpenAIIntegration(
    username=os.getenv("THINGS5_USERNAME"),
    password=os.getenv("THINGS5_PASSWORD")
)
```

### **Docker Configuration**

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Variabili d'ambiente
ENV THINGS5_USERNAME=""
ENV THINGS5_PASSWORD=""
ENV OPENAI_API_KEY=""

CMD ["python", "your_app.py"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  things5-app:
    build: .
    environment:
      - THINGS5_USERNAME=${THINGS5_USERNAME}
      - THINGS5_PASSWORD=${THINGS5_PASSWORD}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    restart: unless-stopped
```

## 🛡️ Sicurezza e Best Practices

### **✅ Cosa Fare:**

1. **Usa variabili d'ambiente** per credenziali
2. **Non hardcodare** username/password nel codice
3. **Usa HTTPS** sempre in produzione
4. **Monitora i log** per errori di autenticazione
5. **Implementa retry logic** per robustezza
6. **Usa il cleanup()** quando termini l'applicazione

### **❌ Cosa NON Fare:**

1. **Non committare** credenziali nel repository
2. **Non disabilitare** il rinnovo automatico
3. **Non ignorare** gli errori di autenticazione
4. **Non usare** credenziali di test in produzione

### **🔍 Monitoraggio:**

```python
# Controlla stato autenticazione
status = integration.get_status()
if not status['authenticated']:
    # Invia alert, log errore, etc.
    logger.error("Authentication lost!")

# Controlla scadenza token
token_info = status['token_info']
if token_info['time_to_expiry'] < 300:  # Meno di 5 minuti
    logger.warning("Token expiring soon")
```

## 🚀 Deployment

### **Test Locale:**

```bash
# Installa dipendenze
pip install requests openai python-dotenv

# Configura credenziali
export THINGS5_USERNAME="your-username"
export THINGS5_PASSWORD="your-password"
export OPENAI_API_KEY="your-openai-key"

# Testa
python openai-integration-complete.py
```

### **Produzione:**

```bash
# Usa un process manager
pm2 start your_app.py --name "things5-integration"

# O systemd service
sudo systemctl enable your-things5-service
sudo systemctl start your-things5-service
```

## 📞 Supporto

Se hai problemi:

1. **Controlla le credenziali** - Sono corrette?
2. **Verifica la connettività** - Raggiungi auth.things5.digital?
3. **Controlla i log** - Cosa dicono gli errori?
4. **Testa manualmente** - Il token endpoint risponde?

```bash
# Test manuale token
curl -X POST 'https://auth.things5.digital/auth/realms/demo10/protocol/openid-connect/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'client_id=api&grant_type=password&scope=openid&username=YOUR_USER&password=YOUR_PASS'
```

---

## 🎯 Riepilogo

✅ **Il token si rinnova automaticamente**  
✅ **Setup una volta, funziona per sempre**  
✅ **Thread-safe e robusto**  
✅ **Pronto per produzione**  

**Non devi preoccuparti dell'autenticazione - è tutto automatico!** 🎉
