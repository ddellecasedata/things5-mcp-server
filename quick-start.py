#!/usr/bin/env python3
"""
🚀 Things5 MCP + OpenAI - Quick Start
Esempio minimo per iniziare subito
"""

import os
from openai import OpenAI
from auth_manager import Things5AuthManager

def quick_start():
    """
    Esempio rapido per iniziare con Things5 MCP + OpenAI
    """
    print("🚀 Things5 MCP + OpenAI - Quick Start")
    print("=" * 45)
    
    # 1. Configura credenziali (modifica qui o usa variabili d'ambiente)
    USERNAME = os.getenv("THINGS5_USERNAME", "ddellecasedata+test@gmail.com")
    PASSWORD = os.getenv("THINGS5_PASSWORD", "Password")
    
    print(f"👤 Using username: {USERNAME}")
    
    # 2. Inizializza autenticazione Things5
    print("\n🔐 Setting up Things5 authentication...")
    auth_manager = Things5AuthManager(USERNAME, PASSWORD)
    
    if not auth_manager.authenticate():
        print("❌ Authentication failed! Check your credentials.")
        return
    
    print("✅ Things5 authentication successful!")
    
    # 3. Inizializza OpenAI
    print("\n🤖 Setting up OpenAI client...")
    if not os.getenv("OPENAI_API_KEY"):
        print("❌ OPENAI_API_KEY not found!")
        print("   Set it with: export OPENAI_API_KEY='your-key-here'")
        return
    
    client = OpenAI()
    print("✅ OpenAI client ready!")
    
    # 4. Crea configurazione MCP
    print("\n🔧 Creating MCP configuration...")
    mcp_config = auth_manager.create_openai_mcp_config(
        server_url="https://things5-mcp-server.onrender.com/sse"
    )
    print("✅ MCP configuration ready!")
    
    # 5. Test con OpenAI
    print("\n💬 Testing OpenAI + Things5 integration...")
    
    try:
        response = client.responses.create(
            model="gpt-4o",
            tools=[mcp_config],
            input="Hello! Can you show me what IoT tools are available?"
        )
        
        print("✅ Integration test successful!")
        print(f"\n🤖 OpenAI Response:")
        print("-" * 50)
        print(response.output_text)
        print("-" * 50)
        
        # Mostra chiamate MCP effettuate
        mcp_calls = [item for item in response.output if item.type == "mcp_call"]
        if mcp_calls:
            print(f"\n🔧 MCP Tools Used: {len(mcp_calls)}")
            for call in mcp_calls:
                print(f"   - {call.name}")
        
    except Exception as e:
        print(f"❌ Integration test failed: {e}")
        return
    
    # 6. Esempi interattivi
    print(f"\n🎯 Ready for interactive use!")
    print("Try these example questions:")
    
    examples = [
        "Show me all my IoT devices",
        "What are the recent events in my system?",
        "Give me an overview of any alarms",
        "List the users in my Things5 system"
    ]
    
    for i, example in enumerate(examples, 1):
        print(f"   {i}. {example}")
    
    print(f"\n💡 Interactive mode:")
    
    try:
        while True:
            question = input("\n❓ Ask about your IoT (or 'quit' to exit): ").strip()
            
            if question.lower() in ['quit', 'exit', 'q']:
                break
            
            if not question:
                continue
            
            print("🤖 Thinking...")
            
            # Ottieni token fresco automaticamente
            fresh_config = auth_manager.create_openai_mcp_config(
                server_url="https://things5-mcp-server.onrender.com/sse"
            )
            
            response = client.responses.create(
                model="gpt-4o",
                tools=[fresh_config],
                input=question
            )
            
            print(f"\n💬 Response:")
            print(response.output_text)
            
    except KeyboardInterrupt:
        print(f"\n\n👋 Goodbye!")
    
    except Exception as e:
        print(f"\n❌ Error: {e}")
    
    finally:
        # Cleanup
        auth_manager.stop_auto_refresh()
        print("🧹 Cleanup completed")

if __name__ == "__main__":
    # Verifica setup
    print("🔍 Checking setup...")
    
    missing = []
    if not os.getenv("OPENAI_API_KEY"):
        missing.append("OPENAI_API_KEY")
    
    if missing:
        print(f"\n⚠️  Missing environment variables: {', '.join(missing)}")
        print("\nSetup instructions:")
        print("1. Get OpenAI API key from https://platform.openai.com/api-keys")
        print("2. Set environment variable:")
        print("   export OPENAI_API_KEY='your-key-here'")
        print("\nOptional (or modify in code):")
        print("   export THINGS5_USERNAME='your-username'")
        print("   export THINGS5_PASSWORD='your-password'")
        print("")
    
    # Avvia quick start
    quick_start()
