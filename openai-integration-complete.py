#!/usr/bin/env python3
"""
Integrazione completa OpenAI MCP con Things5
Include gestione automatica dell'autenticazione e rinnovo token
"""

import os
import time
from openai import OpenAI
from auth_manager import Things5AuthManager

class Things5OpenAIIntegration:
    """
    Integrazione completa Things5 + OpenAI MCP con gestione automatica auth
    """
    
    def __init__(self, username: str, password: str, 
                 server_url: str = "https://things5-mcp-server.onrender.com/sse"):
        """
        Inizializza l'integrazione
        
        Args:
            username: Username Things5
            password: Password Things5  
            server_url: URL del server MCP Things5
        """
        self.server_url = server_url
        
        # Inizializza gestore autenticazione
        self.auth_manager = Things5AuthManager(username, password)
        
        # Inizializza client OpenAI
        self.openai_client = OpenAI()
        
        # Stato autenticazione
        self._authenticated = False
    
    def setup(self) -> bool:
        """
        Configura l'integrazione (autentica con Things5)
        
        Returns:
            True se la configurazione è riuscita
        """
        print("🚀 Setting up Things5 + OpenAI MCP integration...")
        
        # Autentica con Things5
        if self.auth_manager.authenticate():
            self._authenticated = True
            print("✅ Integration setup complete!")
            return True
        else:
            print("❌ Integration setup failed - authentication error")
            return False
    
    def chat(self, message: str, model: str = "gpt-4o", 
             require_approval: str = "never") -> str:
        """
        Invia un messaggio a OpenAI con accesso ai tools Things5
        
        Args:
            message: Messaggio da inviare
            model: Modello OpenAI da utilizzare
            require_approval: Livello di approvazione per i tools
            
        Returns:
            Risposta di OpenAI
        """
        if not self._authenticated:
            return "❌ Error: Not authenticated. Call setup() first."
        
        try:
            # Ottieni configurazione MCP aggiornata (con token fresco)
            mcp_config = self.auth_manager.create_openai_mcp_config(
                server_url=self.server_url,
                require_approval=require_approval
            )
            
            print(f"💬 Sending message to OpenAI with Things5 tools...")
            print(f"   Message: {message}")
            
            # Invia richiesta a OpenAI
            response = self.openai_client.responses.create(
                model=model,
                tools=[mcp_config],
                input=message
            )
            
            # Estrai risposta
            output_text = response.output_text
            
            # Mostra informazioni sulle chiamate MCP effettuate
            mcp_calls = [item for item in response.output if item.type == "mcp_call"]
            if mcp_calls:
                print(f"🔧 MCP calls made: {len(mcp_calls)}")
                for call in mcp_calls:
                    print(f"   - {call.name}({call.arguments})")
            
            return output_text
            
        except Exception as e:
            error_msg = f"❌ Chat error: {e}"
            print(error_msg)
            return error_msg
    
    def get_status(self) -> dict:
        """
        Ottiene lo stato dell'integrazione
        
        Returns:
            Dizionario con informazioni di stato
        """
        token_info = self.auth_manager.get_token_info()
        
        return {
            "authenticated": self._authenticated,
            "server_url": self.server_url,
            "token_info": token_info
        }
    
    def cleanup(self):
        """
        Pulisce le risorse (ferma auto-refresh)
        """
        self.auth_manager.stop_auto_refresh()
        print("🧹 Integration cleanup completed")

# Esempi di utilizzo
def demo_basic_usage():
    """
    Demo utilizzo base
    """
    print("🧪 Demo: Basic Usage")
    print("=" * 30)
    
    # Inizializza integrazione
    integration = Things5OpenAIIntegration(
        username=os.getenv("THINGS5_USERNAME", "ddellecasedata+test@gmail.com"),
        password=os.getenv("THINGS5_PASSWORD", "Password")
    )
    
    # Setup
    if not integration.setup():
        return
    
    try:
        # Esempi di chat
        examples = [
            "Show me all my IoT devices",
            "What are the recent events in my IoT system?", 
            "Give me an overview of device alarms",
            "List the users in my system"
        ]
        
        for i, message in enumerate(examples, 1):
            print(f"\n📝 Example {i}: {message}")
            print("-" * 50)
            
            response = integration.chat(message)
            print(f"🤖 OpenAI Response:")
            print(response)
            
            if i < len(examples):
                print("\n⏱️  Waiting 3 seconds before next example...")
                time.sleep(3)
    
    finally:
        integration.cleanup()

def demo_advanced_usage():
    """
    Demo utilizzo avanzato con approvazioni
    """
    print("\n🧪 Demo: Advanced Usage with Approvals")
    print("=" * 45)
    
    integration = Things5OpenAIIntegration(
        username=os.getenv("THINGS5_USERNAME", "ddellecasedata+test@gmail.com"),
        password=os.getenv("THINGS5_PASSWORD", "Password")
    )
    
    if not integration.setup():
        return
    
    try:
        # Esempio con approvazioni selettive
        response = integration.chat(
            "Analyze my IoT infrastructure and suggest optimizations",
            require_approval={
                "never": {
                    "tool_names": ["devicesList", "overviewEvents", "overviewAlarms"]
                }
            }
        )
        
        print(f"🤖 Advanced Response:")
        print(response)
        
    finally:
        integration.cleanup()

def demo_token_management():
    """
    Demo gestione token automatica
    """
    print("\n🧪 Demo: Automatic Token Management")
    print("=" * 40)
    
    integration = Things5OpenAIIntegration(
        username=os.getenv("THINGS5_USERNAME", "ddellecasedata+test@gmail.com"),
        password=os.getenv("THINGS5_PASSWORD", "Password")
    )
    
    if not integration.setup():
        return
    
    try:
        # Mostra stato iniziale
        status = integration.get_status()
        print(f"📊 Initial Status:")
        print(f"   Authenticated: {status['authenticated']}")
        print(f"   Token expires in: {status['token_info']['time_to_expiry']:.0f} seconds")
        
        # Simula utilizzo prolungato
        print(f"\n⏱️  Simulating extended usage...")
        for i in range(3):
            print(f"\n🔄 Usage cycle {i+1}/3")
            
            response = integration.chat("Give me a quick status of my IoT devices")
            print(f"   Response length: {len(response)} characters")
            
            # Mostra stato token
            status = integration.get_status()
            print(f"   Token status: {status['token_info']['time_to_expiry']:.0f}s remaining")
            
            if i < 2:
                time.sleep(5)
        
        print(f"\n✅ Token management working correctly!")
        
    finally:
        integration.cleanup()

def main():
    """
    Funzione principale con menu di scelta
    """
    print("🚀 Things5 + OpenAI MCP Integration")
    print("=" * 50)
    
    print("\nAvailable demos:")
    print("1. Basic Usage - Simple chat examples")
    print("2. Advanced Usage - With approval controls") 
    print("3. Token Management - Automatic refresh demo")
    print("4. All demos")
    
    choice = input("\nSelect demo (1-4, or Enter for basic): ").strip()
    
    if choice == "2":
        demo_advanced_usage()
    elif choice == "3":
        demo_token_management()
    elif choice == "4":
        demo_basic_usage()
        demo_advanced_usage() 
        demo_token_management()
    else:
        demo_basic_usage()

if __name__ == "__main__":
    # Verifica variabili d'ambiente
    if not os.getenv("OPENAI_API_KEY"):
        print("⚠️  Warning: OPENAI_API_KEY not set")
        print("   Set it with: export OPENAI_API_KEY='your-key-here'")
        print("")
    
    # Suggerimenti per le credenziali
    if not os.getenv("THINGS5_USERNAME"):
        print("💡 Tip: Set environment variables for credentials:")
        print("   export THINGS5_USERNAME='your-username'")
        print("   export THINGS5_PASSWORD='your-password'")
        print("")
    
    main()
