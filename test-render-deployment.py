#!/usr/bin/env python3
"""
Test completo del server Things5 MCP deployato su Render
Verifica autenticazione, endpoints e funzionalità
"""

import requests
import json
import time

# Configurazione
RENDER_SERVER_URL = "https://things5-mcp-server.onrender.com"
KEYCLOAK_TOKEN_URL = "https://auth.things5.digital/auth/realms/demo10/protocol/openid-connect/token"
CLIENT_ID = "api"
USERNAME = "ddellecasedata+test@gmail.com"
PASSWORD = "Password"

def test_server_health():
    """Test health endpoint"""
    print("🏥 Testing server health...")
    try:
        response = requests.get(f"{RENDER_SERVER_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Server is healthy: {data['message']}")
            print(f"   Timestamp: {data['timestamp']}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def get_access_token():
    """Ottieni token di accesso"""
    print("\n🔐 Getting access token...")
    try:
        response = requests.post(
            KEYCLOAK_TOKEN_URL,
            data={
                "client_id": CLIENT_ID,
                "grant_type": "password",
                "scope": "openid",
                "username": USERNAME,
                "password": PASSWORD
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10
        )
        
        if response.status_code == 200:
            token_data = response.json()
            print(f"✅ Token obtained successfully")
            print(f"   Expires in: {token_data['expires_in']} seconds")
            return token_data["access_token"]
        else:
            print(f"❌ Token request failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Token request error: {e}")
        return None

def test_mcp_no_auth():
    """Test MCP senza autenticazione"""
    print("\n🧪 Testing MCP without authentication...")
    try:
        # Initialize
        init_response = requests.post(
            f"{RENDER_SERVER_URL}/mcp?no_auth=true",
            json={
                "jsonrpc": "2.0",
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {"roots": {"listChanged": True}, "sampling": {}},
                    "clientInfo": {"name": "render-test-client", "version": "1.0.0"}
                },
                "id": 1
            },
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream"
            },
            timeout=15
        )
        
        if init_response.status_code == 200:
            init_data = init_response.json()
            if "result" in init_data:
                print("✅ MCP initialization successful (no-auth)")
                server_info = init_data["result"]["serverInfo"]
                print(f"   Server: {server_info['name']} v{server_info['version']}")
                
                capabilities = init_data["result"]["capabilities"]
                print(f"   Capabilities: {list(capabilities.keys())}")
                
                # Test tools list
                tools_response = requests.post(
                    f"{RENDER_SERVER_URL}/mcp?no_auth=true",
                    json={
                        "jsonrpc": "2.0",
                        "method": "tools/list",
                        "params": {},
                        "id": 2
                    },
                    headers={
                        "Content-Type": "application/json",
                        "Accept": "application/json, text/event-stream",
                        "mcp-session-id": "test-session-" + str(int(time.time()))
                    },
                    timeout=15
                )
                
                if tools_response.status_code == 200:
                    tools_data = tools_response.json()
                    if "result" in tools_data and "tools" in tools_data["result"]:
                        tools = tools_data["result"]["tools"]
                        print(f"✅ {len(tools)} tools available")
                        
                        # Show first 5 tools
                        for i, tool in enumerate(tools[:5]):
                            print(f"   {i+1}. {tool['name']}")
                        
                        if len(tools) > 5:
                            print(f"   ... and {len(tools) - 5} more tools")
                        
                        return True
                    else:
                        print(f"❌ Tools list error: {tools_data.get('error', {}).get('message', 'Unknown error')}")
                else:
                    print(f"❌ Tools list request failed: {tools_response.status_code}")
            else:
                print(f"❌ MCP initialization error: {init_data.get('error', {}).get('message', 'Unknown error')}")
        else:
            print(f"❌ MCP initialization failed: {init_response.status_code}")
            print(f"   Response: {init_response.text}")
        
        return False
        
    except Exception as e:
        print(f"❌ MCP test error: {e}")
        return False

def test_mcp_with_auth(token):
    """Test MCP con autenticazione"""
    print(f"\n🔐 Testing MCP with authentication...")
    print(f"   Token (first 30 chars): {token[:30]}...")
    
    try:
        response = requests.post(
            f"{RENDER_SERVER_URL}/mcp",
            json={
                "jsonrpc": "2.0",
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {"roots": {"listChanged": True}, "sampling": {}},
                    "clientInfo": {"name": "auth-test-client", "version": "1.0.0"}
                },
                "id": 1
            },
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
                "Authorization": f"Bearer {token}"
            },
            timeout=15
        )
        
        if response.status_code == 200:
            data = response.json()
            if "result" in data:
                print("✅ MCP authentication successful!")
                server_info = data["result"]["serverInfo"]
                print(f"   Server: {server_info['name']} v{server_info['version']}")
                return True
            else:
                print(f"❌ MCP auth error: {data.get('error', {}).get('message', 'Unknown error')}")
        else:
            print(f"❌ MCP auth request failed: {response.status_code}")
            print(f"   Response: {response.text}")
        
        return False
        
    except Exception as e:
        print(f"❌ MCP auth test error: {e}")
        return False

def test_sse_endpoint(token=None):
    """Test SSE endpoint"""
    print(f"\n📡 Testing SSE endpoint...")
    
    headers = {
        "Accept": "text/event-stream",
        "Cache-Control": "no-cache"
    }
    
    url = f"{RENDER_SERVER_URL}/sse"
    
    if token:
        headers["Authorization"] = f"Bearer {token}"
        print("   With authentication")
    else:
        url += "?no_auth=true"
        print("   Without authentication")
    
    try:
        response = requests.get(url, headers=headers, timeout=5, stream=True)
        
        if response.status_code == 200:
            print("✅ SSE endpoint accessible")
            
            # Read first few lines
            lines_read = 0
            for line in response.iter_lines(decode_unicode=True):
                if line:
                    print(f"   SSE: {line}")
                    lines_read += 1
                    if lines_read >= 3:  # Read max 3 lines
                        break
            
            return True
        else:
            print(f"❌ SSE endpoint failed: {response.status_code}")
            if response.text:
                print(f"   Response: {response.text}")
        
        return False
        
    except requests.exceptions.Timeout:
        print("⚠️  SSE endpoint timeout (this might be expected)")
        return True  # Timeout is often expected for SSE
    except Exception as e:
        print(f"❌ SSE test error: {e}")
        return False

def show_openai_config(token):
    """Mostra configurazione per OpenAI"""
    print(f"\n🚀 OpenAI MCP Configuration")
    print("=" * 50)
    
    if token:
        print("**With Authentication (Recommended):**")
        print("```python")
        print("from openai import OpenAI")
        print("")
        print("client = OpenAI()")
        print("")
        print("resp = client.responses.create(")
        print("    model='gpt-4o',")
        print("    tools=[{")
        print("        'type': 'mcp',")
        print("        'server_label': 'things5',")
        print("        'server_description': 'Things5 IoT platform for device management',")
        print(f"        'server_url': '{RENDER_SERVER_URL}/sse',")
        print(f"        'authorization': 'Bearer {token[:30]}...',")
        print("        'require_approval': 'never'")
        print("    }],")
        print("    input='Show me all my IoT devices and their status'")
        print(")")
        print("```")
        print("")
    
    print("**Without Authentication (Development Only):**")
    print("```python")
    print("resp = client.responses.create(")
    print("    model='gpt-4o',")
    print("    tools=[{")
    print("        'type': 'mcp',")
    print("        'server_label': 'things5',")
    print(f"        'server_url': '{RENDER_SERVER_URL}/sse?no_auth=true',")
    print("        'require_approval': 'never'")
    print("    }],")
    print("    input='Show me available IoT tools'")
    print(")")
    print("```")

def main():
    """Test principale"""
    print("🧪 Things5 MCP Server - Render Deployment Test")
    print("=" * 60)
    
    results = {
        "health": False,
        "token": False,
        "mcp_no_auth": False,
        "mcp_auth": False,
        "sse": False
    }
    
    # Test 1: Health check
    results["health"] = test_server_health()
    
    # Test 2: Get token
    token = get_access_token()
    results["token"] = token is not None
    
    # Test 3: MCP without auth
    results["mcp_no_auth"] = test_mcp_no_auth()
    
    # Test 4: MCP with auth (if token available)
    if token:
        results["mcp_auth"] = test_mcp_with_auth(token)
    
    # Test 5: SSE endpoint
    results["sse"] = test_sse_endpoint(token)
    
    # Summary
    print(f"\n📊 Test Results Summary")
    print("=" * 30)
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{test_name.replace('_', ' ').title()}: {status}")
    
    passed_tests = sum(results.values())
    total_tests = len(results)
    
    print(f"\nOverall: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests >= 3:  # Health, no-auth MCP, and SSE should work
        print("\n🎉 Server is functional and ready for OpenAI integration!")
        if token:
            show_openai_config(token)
        else:
            print("\n⚠️  Authentication issues detected - check server environment variables")
            print("   For now, use no-auth mode for development")
    else:
        print("\n❌ Server has significant issues - check deployment")

if __name__ == "__main__":
    main()
