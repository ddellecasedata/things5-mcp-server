#!/usr/bin/env python3
"""
Esempio di integrazione OpenAI MCP con Things5
Mostra come ottenere un token e utilizzarlo con OpenAI Responses API
"""

import requests
import json
from openai import OpenAI

# Configurazione Things5
KEYCLOAK_TOKEN_URL = "https://auth.things5.digital/auth/realms/demo10/protocol/openid-connect/token"
CLIENT_ID = "api"
MCP_SERVER_URL = "http://localhost:3000/sse"  # Cambia con il tuo server in produzione

# Credenziali (in produzione usa variabili d'ambiente!)
USERNAME = "ddellecasedata+test@gmail.com"
PASSWORD = "Password"

def get_things5_token(username: str, password: str) -> str:
    """
    Ottiene un token di accesso da Keycloak Things5
    """
    print("🔐 Ottenendo token di accesso da Things5...")
    
    response = requests.post(
        KEYCLOAK_TOKEN_URL,
        data={
            "client_id": CLIENT_ID,
            "grant_type": "password",
            "scope": "openid",
            "username": username,
            "password": password
        },
        headers={
            "Content-Type": "application/x-www-form-urlencoded"
        }
    )
    
    if response.status_code == 200:
        token_data = response.json()
        print(f"✅ Token ottenuto con successo!")
        print(f"   Scade in: {token_data['expires_in']} secondi")
        return token_data["access_token"]
    else:
        print(f"❌ Errore nell'ottenere il token: {response.status_code}")
        print(f"   Risposta: {response.text}")
        raise Exception(f"Failed to get token: {response.status_code}")

def test_mcp_with_openai(token: str):
    """
    Testa l'integrazione MCP con OpenAI
    """
    print("\n🤖 Testando integrazione con OpenAI MCP...")
    
    client = OpenAI()
    
    try:
        # Configurazione MCP per Things5
        mcp_config = {
            "type": "mcp",
            "server_label": "things5",
            "server_description": "Things5 IoT platform for device management, monitoring, and data analysis",
            "server_url": MCP_SERVER_URL,
            "authorization": f"Bearer {token}",
            "require_approval": "never",  # Per demo - in produzione considera "always" per azioni sensibili
            # Opzionale: limita i tools disponibili
            # "allowed_tools": ["devicesList", "deviceDetails", "overviewEvents", "readParameters"]
        }
        
        # Test 1: Richiesta semplice
        print("\n📋 Test 1: Lista dispositivi IoT")
        resp1 = client.responses.create(
            model="gpt-4o",  # Usa il modello disponibile
            tools=[mcp_config],
            input="Show me all my IoT devices and their current connection status"
        )
        
        print("✅ Risposta OpenAI:")
        print(resp1.output_text)
        
        # Mostra le chiamate MCP effettuate
        mcp_calls = [item for item in resp1.output if item.type == "mcp_call"]
        if mcp_calls:
            print(f"\n🔧 Chiamate MCP effettuate: {len(mcp_calls)}")
            for call in mcp_calls:
                print(f"   - {call.name}: {call.arguments}")
        
        # Test 2: Richiesta più complessa
        print("\n📊 Test 2: Analisi avanzata")
        resp2 = client.responses.create(
            model="gpt-4o",
            tools=[mcp_config],
            input="Analyze my IoT infrastructure: show device health, recent events, and any potential issues"
        )
        
        print("✅ Risposta OpenAI:")
        print(resp2.output_text)
        
        # Test 3: Con approvazioni selettive (esempio)
        print("\n🔒 Test 3: Con controllo approvazioni")
        mcp_config_with_approvals = mcp_config.copy()
        mcp_config_with_approvals["require_approval"] = {
            "never": {
                "tool_names": ["devicesList", "overviewEvents", "readParameters"]
            }
        }
        
        resp3 = client.responses.create(
            model="gpt-4o",
            tools=[mcp_config_with_approvals],
            input="Give me a summary of my IoT devices and recent activity"
        )
        
        print("✅ Risposta OpenAI (con approvazioni):")
        print(resp3.output_text)
        
        print("\n🎉 Tutti i test completati con successo!")
        
    except Exception as e:
        print(f"❌ Errore nell'integrazione OpenAI: {e}")
        
        # Suggerimenti per il troubleshooting
        print("\n💡 Suggerimenti per il troubleshooting:")
        print("1. Verifica che il server MCP sia in esecuzione")
        print("2. Controlla che il token sia valido e non scaduto")
        print("3. Assicurati che l'URL del server sia corretto")
        print("4. Verifica la connettività di rete")

def main():
    """
    Funzione principale
    """
    print("🚀 Things5 MCP + OpenAI Integration Demo")
    print("=" * 50)
    
    try:
        # Step 1: Ottieni token
        token = get_things5_token(USERNAME, PASSWORD)
        
        # Step 2: Testa con OpenAI
        test_mcp_with_openai(token)
        
    except Exception as e:
        print(f"❌ Demo fallita: {e}")
        print("\n💡 Assicurati che:")
        print("1. Le credenziali siano corrette")
        print("2. Il server MCP Things5 sia in esecuzione")
        print("3. Hai configurato correttamente OpenAI API key")

if __name__ == "__main__":
    # Esempio di utilizzo alternativo senza autenticazione (solo per sviluppo)
    print("\n" + "="*50)
    print("ALTERNATIVA: Modalità No-Auth per sviluppo")
    print("="*50)
    print("""
Per test rapidi senza autenticazione, puoi usare:

from openai import OpenAI

client = OpenAI()

resp = client.responses.create(
    model="gpt-4o",
    tools=[{
        "type": "mcp",
        "server_label": "things5",
        "server_url": "http://localhost:3000/sse?no_auth=true",
        "require_approval": "never"
    }],
    input="Show me available IoT tools and capabilities"
)

print(resp.output_text)
""")
    
    # Esegui la demo principale
    main()
