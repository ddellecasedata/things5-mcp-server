#!/usr/bin/env node

/**
 * Test autenticazione con la configurazione reale Things5
 * Usa client_id=api e realm=demo10
 */

const https = require('https');
const http = require('http');
const querystring = require('querystring');
const { spawn } = require('child_process');

const USERNAME = process.argv[2] || 'ddellecasedata+test@gmail.com';
const PASSWORD = process.argv[3] || 'Password';

// Configurazione corretta basata sulla curl fornita
const KEYCLOAK_BASE_URL = 'https://auth.things5.digital';
const REALM = 'demo10';
const CLIENT_ID = 'api';
const TOKEN_ENDPOINT = `${KEYCLOAK_BASE_URL}/auth/realms/${REALM}/protocol/openid-connect/token`;

console.log('🔐 Testing Real Things5 Authentication');
console.log('====================================');
console.log(`Keycloak URL: ${KEYCLOAK_BASE_URL}`);
console.log(`Realm: ${REALM}`);
console.log(`Client ID: ${CLIENT_ID}`);
console.log(`Username: ${USERNAME}`);
console.log(`Token Endpoint: ${TOKEN_ENDPOINT}`);
console.log('');

async function testRealAuth() {
  try {
    console.log('🔑 Step 1: Getting access token...');
    
    // Usa esattamente gli stessi parametri della curl fornita
    const tokenData = querystring.stringify({
      client_id: CLIENT_ID,
      grant_type: 'password',
      scope: 'openid',
      username: USERNAME,
      password: PASSWORD
    });
    
    console.log('📤 Sending token request...');
    const tokenResponse = await postData(TOKEN_ENDPOINT, tokenData, {
      'Content-Type': 'application/x-www-form-urlencoded'
    });
    
    console.log('✅ Successfully obtained access token!');
    console.log(`Token type: ${tokenResponse.token_type}`);
    console.log(`Expires in: ${tokenResponse.expires_in} seconds`);
    console.log(`Access token (first 50 chars): ${tokenResponse.access_token.substring(0, 50)}...`);
    
    if (tokenResponse.refresh_token) {
      console.log(`Refresh token available: ${tokenResponse.refresh_token.substring(0, 30)}...`);
    }
    console.log('');
    
    // Avvia il server MCP per i test
    console.log('🚀 Starting MCP server for testing...');
    const serverProcess = await startMcpServer();
    
    try {
      // Test con il server MCP
      console.log('🧪 Step 2: Testing token with MCP server...');
      await testTokenWithMcp(tokenResponse.access_token);
      
      // Test userinfo endpoint
      console.log('👤 Step 3: Getting user info...');
      const userInfoEndpoint = `${KEYCLOAK_BASE_URL}/auth/realms/${REALM}/protocol/openid-connect/userinfo`;
      await getUserInfo(userInfoEndpoint, tokenResponse.access_token);
      
      // Test SSE endpoint
      console.log('📡 Step 4: Testing SSE endpoint...');
      await testSSEEndpoint(tokenResponse.access_token);
      
      console.log('');
      console.log('🎉 ALL TESTS PASSED! Authentication is working perfectly!');
      console.log('');
      
      // Mostra configurazione per OpenAI
      showOpenAIConfig(tokenResponse.access_token);
      
    } finally {
      console.log('🛑 Stopping MCP server...');
      if (serverProcess) {
        serverProcess.kill();
      }
    }
    
  } catch (error) {
    console.error('❌ Authentication test failed:', error.message);
    
    if (error.message.includes('invalid_grant')) {
      console.log('');
      console.log('💡 Possibili cause:');
      console.log('1. Username o password non corretti');
      console.log('2. Account bloccato o disabilitato');
      console.log('3. Credenziali scadute');
    } else if (error.message.includes('unauthorized_client')) {
      console.log('');
      console.log('💡 Il client "api" potrebbe non essere configurato per password grant');
    } else {
      console.log('');
      console.log('💡 Verifica:');
      console.log('1. Connessione internet');
      console.log('2. URL Keycloak corretto');
      console.log('3. Realm "demo10" esistente');
    }
  }
}

async function startMcpServer() {
  return new Promise((resolve, reject) => {
    const serverProcess = spawn('npm', ['run', 'start:streamableHttp'], {
      cwd: process.cwd(),
      stdio: 'pipe'
    });
    
    let resolved = false;
    
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('listening on port 3000') && !resolved) {
        resolved = true;
        console.log('✅ MCP server started successfully');
        setTimeout(() => resolve(serverProcess), 1000);
      }
    });
    
    serverProcess.on('error', (error) => {
      if (!resolved) {
        resolved = true;
        reject(error);
      }
    });
    
    // Timeout di sicurezza
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error('Server startup timeout'));
      }
    }, 10000);
  });
}

async function testTokenWithMcp(token) {
  try {
    const response = await postData('http://localhost:3000/mcp', JSON.stringify({
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: { listChanged: true },
          sampling: {}
        },
        clientInfo: {
          name: 'real-auth-test-client',
          version: '1.0.0'
        }
      },
      id: 1
    }), {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${token}`
    });
    
    console.log('✅ MCP server accepted the token!');
    console.log(`Server: ${response.result?.serverInfo?.name} v${response.result?.serverInfo?.version}`);
    
    // Test tools list
    const toolsResponse = await postData('http://localhost:3000/mcp', JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
      id: 2
    }), {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${token}`,
      'mcp-session-id': 'test-session-' + Date.now()
    });
    
    const toolCount = toolsResponse.result?.tools?.length || 0;
    console.log(`📋 Available tools: ${toolCount}`);
    
    if (toolCount > 0) {
      const sampleTools = toolsResponse.result.tools.slice(0, 5).map(t => t.name);
      console.log(`   Sample tools: ${sampleTools.join(', ')}`);
    }
    
  } catch (error) {
    console.log(`❌ MCP server test failed: ${error.message}`);
    throw error;
  }
}

async function getUserInfo(userInfoEndpoint, token) {
  try {
    const userInfo = await fetchJson(userInfoEndpoint, {
      'Authorization': `Bearer ${token}`
    });
    
    console.log('✅ User info retrieved successfully:');
    console.log(`   Username: ${userInfo.preferred_username || userInfo.sub}`);
    console.log(`   Email: ${userInfo.email || 'N/A'}`);
    console.log(`   Name: ${userInfo.name || (userInfo.given_name + ' ' + userInfo.family_name) || 'N/A'}`);
    
  } catch (error) {
    console.log(`⚠️  User info failed: ${error.message}`);
  }
}

async function testSSEEndpoint(token) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/sse',
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      if (res.statusCode === 200) {
        console.log('✅ SSE endpoint accepts the token');
      } else {
        console.log(`⚠️  SSE endpoint returned status ${res.statusCode}`);
      }
      resolve();
    });
    
    req.on('error', (error) => {
      console.log(`⚠️  SSE test error: ${error.message}`);
      resolve();
    });
    
    req.setTimeout(2000, () => {
      req.destroy();
      resolve();
    });
    
    req.end();
  });
}

function showOpenAIConfig(token) {
  console.log('🚀 OpenAI MCP Configuration');
  console.log('===========================');
  console.log('');
  console.log('**Per uso locale (sviluppo):**');
  console.log('```python');
  console.log('from openai import OpenAI');
  console.log('');
  console.log('client = OpenAI()');
  console.log('');
  console.log('resp = client.responses.create(');
  console.log('    model="gpt-5",');
  console.log('    tools=[{');
  console.log('        "type": "mcp",');
  console.log('        "server_label": "things5",');
  console.log('        "server_description": "Things5 IoT platform for device management and monitoring",');
  console.log('        "server_url": "http://localhost:3000/sse",');
  console.log(`        "authorization": "Bearer ${token.substring(0, 30)}...",`);
  console.log('        "require_approval": "never"');
  console.log('    }],');
  console.log('    input="Show me all my IoT devices and their current status"');
  console.log(')');
  console.log('```');
  console.log('');
  console.log('**Per produzione:**');
  console.log('```python');
  console.log('# Prima ottieni un nuovo token (i token scadono!)');
  console.log('import requests');
  console.log('');
  console.log('def get_things5_token():');
  console.log('    response = requests.post(');
  console.log(`        "${TOKEN_ENDPOINT}",`);
  console.log('        data={');
  console.log(`            "client_id": "${CLIENT_ID}",`);
  console.log('            "grant_type": "password",');
  console.log('            "scope": "openid",');
  console.log('            "username": "your-username",');
  console.log('            "password": "your-password"');
  console.log('        }');
  console.log('    )');
  console.log('    return response.json()["access_token"]');
  console.log('');
  console.log('# Usa con OpenAI');
  console.log('token = get_things5_token()');
  console.log('resp = client.responses.create(');
  console.log('    model="gpt-5",');
  console.log('    tools=[{');
  console.log('        "type": "mcp",');
  console.log('        "server_label": "things5",');
  console.log('        "server_url": "https://your-production-server.com/sse",');
  console.log('        "authorization": f"Bearer {token}",');
  console.log('        "require_approval": "never"');
  console.log('    }],');
  console.log('    input="Analyze my IoT infrastructure"');
  console.log(')');
  console.log('```');
}

function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        } catch (parseError) {
          reject(new Error(`Parse error: ${parseError.message}`));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

function postData(url, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Length': Buffer.byteLength(data),
        ...headers
      }
    };
    
    const req = client.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.error_description || parsed.error || `HTTP ${res.statusCode}: ${responseData}`));
          }
        } catch (parseError) {
          reject(new Error(`Parse error: ${responseData}`));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.write(data);
    req.end();
  });
}

// Cleanup on exit
process.on('SIGINT', () => {
  process.exit();
});

// Avvia il test
testRealAuth();
