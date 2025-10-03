#!/usr/bin/env node

/**
 * Test autenticazione con realm demo10 e client frontend
 */

const https = require('https');
const querystring = require('querystring');

const USERNAME = process.argv[2] || 'ddellecasedata+test@gmail.com';
const PASSWORD = process.argv[3] || 'Password';
const KEYCLOAK_BASE_URL = 'https://auth.things5.digital';
const REALM = 'demo10';
const CLIENT_ID = 'frontend'; // Dal tuo URL di auth

console.log('🔐 Testing Authentication with demo10 realm');
console.log('===========================================');
console.log(`Keycloak URL: ${KEYCLOAK_BASE_URL}`);
console.log(`Realm: ${REALM}`);
console.log(`Client ID: ${CLIENT_ID}`);
console.log(`Username: ${USERNAME}`);
console.log('');

async function testDemo10Auth() {
  // Costruiamo l'endpoint del token basandoci sulla struttura standard
  const tokenEndpoint = `${KEYCLOAK_BASE_URL}/auth/realms/${REALM}/protocol/openid-connect/token`;
  
  console.log('🔑 Step 1: Attempting to get access token...');
  console.log(`Token endpoint: ${tokenEndpoint}`);
  
  try {
    // Prova con client frontend
    const token = await getToken(tokenEndpoint, CLIENT_ID, USERNAME, PASSWORD);
    
    if (token) {
      console.log('✅ Successfully obtained access token!');
      console.log(`Token type: ${token.token_type}`);
      console.log(`Expires in: ${token.expires_in} seconds`);
      console.log(`Access token (first 50 chars): ${token.access_token.substring(0, 50)}...`);
      console.log('');
      
      // Test con il nostro server MCP
      console.log('🧪 Step 2: Testing token with MCP server...');
      await testTokenWithMcp(token.access_token);
      
      // Prova a ottenere user info
      console.log('👤 Step 3: Getting user info...');
      const userInfoEndpoint = `${KEYCLOAK_BASE_URL}/auth/realms/${REALM}/protocol/openid-connect/userinfo`;
      await getUserInfo(userInfoEndpoint, token.access_token);
      
      console.log('');
      console.log('🎉 Authentication test completed successfully!');
      console.log('');
      console.log('📝 Configuration for OpenAI MCP:');
      console.log('```python');
      console.log('resp = client.responses.create(');
      console.log('    model="gpt-5",');
      console.log('    tools=[{');
      console.log('        "type": "mcp",');
      console.log('        "server_label": "things5",');
      console.log('        "server_url": "https://your-server.com/sse",');
      console.log(`        "authorization": "Bearer ${token.access_token.substring(0, 30)}...",`);
      console.log('        "require_approval": "never"');
      console.log('    }],');
      console.log('    input="Show me my IoT devices"');
      console.log(')');
      console.log('```');
      
    } else {
      console.log('❌ Failed to obtain access token');
    }
    
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    
    console.log('');
    console.log('💡 Troubleshooting suggestions:');
    console.log('1. Verify username and password are correct');
    console.log('2. Check if the "frontend" client allows password grant type');
    console.log('3. Try with "mcp-server" client if it exists in demo10 realm');
    console.log('4. Contact admin to create "mcp-server" client with password grant');
  }
}

async function getToken(tokenEndpoint, clientId, username, password) {
  console.log(`   Trying with client: ${clientId}`);
  
  const tokenData = querystring.stringify({
    grant_type: 'password',
    client_id: clientId,
    username: username,
    password: password,
    scope: 'openid profile email'
  });
  
  try {
    const response = await postData(tokenEndpoint, tokenData, {
      'Content-Type': 'application/x-www-form-urlencoded'
    });
    
    return response;
    
  } catch (error) {
    console.log(`   ❌ Failed with client ${clientId}: ${error.message}`);
    
    // Prova con mcp-server se frontend fallisce
    if (clientId === 'frontend') {
      console.log('   🔄 Trying with mcp-server client...');
      
      const mcpTokenData = querystring.stringify({
        grant_type: 'password',
        client_id: 'mcp-server',
        username: username,
        password: password,
        scope: 'openid profile email'
      });
      
      try {
        const mcpResponse = await postData(tokenEndpoint, mcpTokenData, {
          'Content-Type': 'application/x-www-form-urlencoded'
        });
        
        console.log('   ✅ Success with mcp-server client!');
        return mcpResponse;
        
      } catch (mcpError) {
        console.log(`   ❌ Failed with mcp-server: ${mcpError.message}`);
      }
    }
    
    throw error;
  }
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
          name: 'demo10-test-client',
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
    
  } catch (error) {
    console.log(`❌ MCP server rejected token: ${error.message}`);
    console.log('   This might be expected if the server cannot validate the token');
  }
}

async function getUserInfo(userInfoEndpoint, token) {
  try {
    const userInfo = await fetchJson(userInfoEndpoint, {
      'Authorization': `Bearer ${token}`
    });
    
    console.log('✅ User info retrieved:');
    console.log(`   Username: ${userInfo.preferred_username || userInfo.sub}`);
    console.log(`   Email: ${userInfo.email || 'N/A'}`);
    console.log(`   Name: ${userInfo.name || (userInfo.given_name + ' ' + userInfo.family_name) || 'N/A'}`);
    
  } catch (error) {
    console.log(`⚠️  Could not get user info: ${error.message}`);
  }
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
    const client = urlObj.protocol === 'https:' ? https : require('http');
    
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
            reject(new Error(parsed.error_description || parsed.error || `HTTP ${res.statusCode}`));
          }
        } catch (parseError) {
          reject(new Error(`Parse error: ${responseData}`));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    
    req.write(data);
    req.end();
  });
}

// Avvia il server MCP prima del test
console.log('🚀 Starting MCP server for testing...');
const { spawn } = require('child_process');

const serverProcess = spawn('npm', ['run', 'start:streamableHttp'], {
  cwd: process.cwd(),
  stdio: 'pipe'
});

// Aspetta che il server si avvii
setTimeout(() => {
  testDemo10Auth().finally(() => {
    console.log('');
    console.log('🛑 Stopping MCP server...');
    serverProcess.kill();
  });
}, 3000);

serverProcess.on('error', (error) => {
  console.error('Failed to start server:', error);
});

// Cleanup on exit
process.on('SIGINT', () => {
  serverProcess.kill();
  process.exit();
});
