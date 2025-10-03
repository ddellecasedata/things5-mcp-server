#!/usr/bin/env python3
"""
Gestore autenticazione Things5 con rinnovo automatico token
Gestisce OAuth 2.0 flow, refresh token e integrazione OpenAI MCP
"""

import requests
import json
import time
import threading
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import os

class Things5AuthManager:
    """
    Gestore autenticazione Things5 con rinnovo automatico
    """
    
    def __init__(self, username: str, password: str, 
                 keycloak_url: str = "https://auth.things5.digital",
                 realm: str = "demo10",
                 client_id: str = "api"):
        """
        Inizializza il gestore autenticazione
        
        Args:
            username: Username Things5
            password: Password Things5
            keycloak_url: URL base Keycloak
            realm: Realm Keycloak
            client_id: Client ID per l'autenticazione
        """
        self.username = username
        self.password = password
        self.keycloak_url = keycloak_url
        self.realm = realm
        self.client_id = client_id
        
        # Token storage
        self._access_token: Optional[str] = None
        self._refresh_token: Optional[str] = None
        self._token_expires_at: Optional[datetime] = None
        
        # Thread safety
        self._lock = threading.Lock()
        self._refresh_thread: Optional[threading.Thread] = None
        self._stop_refresh = threading.Event()
        
        # Endpoints
        self.token_endpoint = f"{keycloak_url}/auth/realms/{realm}/protocol/openid-connect/token"
        
    def authenticate(self) -> bool:
        """
        Esegue l'autenticazione iniziale
        
        Returns:
            True se l'autenticazione è riuscita
        """
        print("🔐 Authenticating with Things5...")
        
        try:
            response = requests.post(
                self.token_endpoint,
                data={
                    "client_id": self.client_id,
                    "grant_type": "password",
                    "scope": "openid profile email",
                    "username": self.username,
                    "password": self.password
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=10
            )
            
            if response.status_code == 200:
                token_data = response.json()
                
                with self._lock:
                    self._access_token = token_data["access_token"]
                    self._refresh_token = token_data.get("refresh_token")
                    
                    # Calcola scadenza (con margine di sicurezza di 5 minuti)
                    expires_in = token_data.get("expires_in", 3600)
                    self._token_expires_at = datetime.now() + timedelta(seconds=expires_in - 300)
                
                print(f"✅ Authentication successful!")
                print(f"   Token expires in: {expires_in} seconds")
                print(f"   Refresh token available: {'Yes' if self._refresh_token else 'No'}")
                
                # Avvia il thread di rinnovo automatico
                self._start_auto_refresh()
                
                return True
            else:
                print(f"❌ Authentication failed: {response.status_code}")
                print(f"   Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Authentication error: {e}")
            return False
    
    def get_access_token(self) -> Optional[str]:
        """
        Ottiene il token di accesso corrente (con rinnovo automatico se necessario)
        
        Returns:
            Token di accesso valido o None se non disponibile
        """
        with self._lock:
            # Controlla se il token è ancora valido
            if self._access_token and self._token_expires_at:
                if datetime.now() < self._token_expires_at:
                    return self._access_token
                else:
                    print("⚠️  Token expired, attempting refresh...")
                    if self._refresh_token_sync():
                        return self._access_token
            
            # Se non c'è token valido, prova a riautenticarsi
            if not self._access_token:
                print("🔄 No valid token, re-authenticating...")
                if self.authenticate():
                    return self._access_token
            
            return None
    
    def _refresh_token_sync(self) -> bool:
        """
        Rinnova il token usando il refresh token (versione sincrona)
        
        Returns:
            True se il rinnovo è riuscito
        """
        if not self._refresh_token:
            return False
            
        try:
            response = requests.post(
                self.token_endpoint,
                data={
                    "client_id": self.client_id,
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=10
            )
            
            if response.status_code == 200:
                token_data = response.json()
                
                self._access_token = token_data["access_token"]
                if "refresh_token" in token_data:
                    self._refresh_token = token_data["refresh_token"]
                
                expires_in = token_data.get("expires_in", 3600)
                self._token_expires_at = datetime.now() + timedelta(seconds=expires_in - 300)
                
                print(f"✅ Token refreshed successfully!")
                return True
            else:
                print(f"❌ Token refresh failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Token refresh error: {e}")
            return False
    
    def _start_auto_refresh(self):
        """
        Avvia il thread per il rinnovo automatico del token
        """
        if self._refresh_thread and self._refresh_thread.is_alive():
            return
            
        self._stop_refresh.clear()
        self._refresh_thread = threading.Thread(target=self._auto_refresh_loop, daemon=True)
        self._refresh_thread.start()
        print("🔄 Auto-refresh thread started")
    
    def _auto_refresh_loop(self):
        """
        Loop per il rinnovo automatico del token
        """
        while not self._stop_refresh.is_set():
            try:
                with self._lock:
                    if self._token_expires_at:
                        # Rinnova 10 minuti prima della scadenza
                        refresh_time = self._token_expires_at - timedelta(minutes=10)
                        
                        if datetime.now() >= refresh_time:
                            print("🔄 Auto-refreshing token...")
                            self._refresh_token_sync()
                
                # Controlla ogni 5 minuti
                self._stop_refresh.wait(300)
                
            except Exception as e:
                print(f"❌ Auto-refresh error: {e}")
                self._stop_refresh.wait(60)  # Riprova dopo 1 minuto in caso di errore
    
    def stop_auto_refresh(self):
        """
        Ferma il rinnovo automatico del token
        """
        self._stop_refresh.set()
        if self._refresh_thread:
            self._refresh_thread.join(timeout=5)
        print("🛑 Auto-refresh stopped")
    
    def get_token_info(self) -> Dict[str, Any]:
        """
        Ottiene informazioni sul token corrente
        
        Returns:
            Dizionario con informazioni sul token
        """
        with self._lock:
            return {
                "has_token": self._access_token is not None,
                "expires_at": self._token_expires_at.isoformat() if self._token_expires_at else None,
                "has_refresh_token": self._refresh_token is not None,
                "time_to_expiry": (self._token_expires_at - datetime.now()).total_seconds() 
                                if self._token_expires_at else None
            }
    
    def create_openai_mcp_config(self, server_url: str, 
                                require_approval: str = "never") -> Dict[str, Any]:
        """
        Crea la configurazione per OpenAI MCP
        
        Args:
            server_url: URL del server MCP
            require_approval: Livello di approvazione richiesto
            
        Returns:
            Configurazione per OpenAI MCP
        """
        token = self.get_access_token()
        if not token:
            raise Exception("No valid access token available")
            
        return {
            "type": "mcp",
            "server_label": "things5",
            "server_description": "Things5 IoT platform for device management and monitoring",
            "server_url": server_url,
            "authorization": f"Bearer {token}",
            "require_approval": require_approval
        }

# Esempio di utilizzo
def example_usage():
    """
    Esempio di utilizzo del gestore autenticazione
    """
    print("🧪 Things5 Authentication Manager - Example Usage")
    print("=" * 60)
    
    # Inizializza il gestore (usa variabili d'ambiente in produzione!)
    auth_manager = Things5AuthManager(
        username=os.getenv("THINGS5_USERNAME", "ddellecasedata+test@gmail.com"),
        password=os.getenv("THINGS5_PASSWORD", "Password")
    )
    
    # Autentica
    if not auth_manager.authenticate():
        print("❌ Authentication failed")
        return
    
    # Mostra info token
    token_info = auth_manager.get_token_info()
    print(f"\n📋 Token Info:")
    print(f"   Has token: {token_info['has_token']}")
    print(f"   Expires at: {token_info['expires_at']}")
    print(f"   Time to expiry: {token_info['time_to_expiry']:.0f} seconds")
    
    # Ottieni token per uso immediato
    token = auth_manager.get_access_token()
    print(f"\n🔑 Current token: {token[:30]}..." if token else "❌ No token available")
    
    # Crea configurazione OpenAI MCP
    try:
        mcp_config = auth_manager.create_openai_mcp_config(
            server_url="https://things5-mcp-server.onrender.com/sse"
        )
        
        print(f"\n🚀 OpenAI MCP Configuration:")
        print("```python")
        print("from openai import OpenAI")
        print("")
        print("client = OpenAI()")
        print("")
        print("resp = client.responses.create(")
        print("    model='gpt-4o',")
        print(f"    tools=[{json.dumps(mcp_config, indent=8)}],")
        print("    input='Show me all my IoT devices and their status'")
        print(")")
        print("```")
        
    except Exception as e:
        print(f"❌ MCP config error: {e}")
    
    # Simula utilizzo per qualche tempo
    print(f"\n⏱️  Simulating usage for 30 seconds...")
    for i in range(6):
        time.sleep(5)
        token = auth_manager.get_access_token()
        status = "✅ Valid" if token else "❌ Invalid"
        print(f"   Check {i+1}/6: Token {status}")
    
    # Cleanup
    auth_manager.stop_auto_refresh()
    print(f"\n✅ Example completed!")

if __name__ == "__main__":
    example_usage()
