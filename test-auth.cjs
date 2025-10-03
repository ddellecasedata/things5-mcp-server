#!/usr/bin/env node

/**
 * Script per testare l'autenticazione OAuth con Keycloak
 * Utilizza il flusso Resource Owner Password Credentials per ottenere un token
 */

const https = require('https');
const http = require('http');
const querystring = require('querystring');

// Configurazione da .env
const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL || 'https://auth.things5.digital';
const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'mcp-server';

// Credenziali utente
const USERNAME = process.argv[2] || 'ddellecasedata+test@gmail.com';
const PASSWORD = process.argv[3] || 'Password';

console.log('🔐 Testing OAuth Authentication');
console.log('================================');
console.log(`Keycloak URL: ${KEYCLOAK_BASE_URL}`);
console.log(`Client ID: ${KEYCLOAK_CLIENT_ID}`);
console.log(`Username: ${USERNAME}`);
console.log('');

async function testAuthentication() {
  try {
    // Step 1: Prova a ottenere la configurazione OIDC
    console.log('📋 Step 1: Getting OIDC Configuration...');
    
    // Assumiamo che il realm sia 'things5' (comune per Things5)
    const realm = 'things5';
    const oidcConfigUrl = `${KEYCLOAK_BASE_URL}/auth/realms/${realm}/.well-known/openid_configuration`;
    
    console.log(`Fetching: ${oidcConfigUrl}`);
    
    const oidcConfig = await fetchJson(oidcConfigUrl);
    console.log('✅ OIDC Configuration retrieved');
    console.log(`Token endpoint: ${oidcConfig.token_endpoint}`);
    console.log('');
    
    // Step 2: Ottieni token usando Resource Owner Password Credentials
    console.log('🔑 Step 2: Getting Access Token...');
    
    const tokenData = querystring.stringify({
      grant_type: 'password',
      client_id: KEYCLOAK_CLIENT_ID,
      username: USERNAME,
      password: PASSWORD,
      scope: 'openid profile email'
    });
    
    const tokenResponse = await postData(oidcConfig.token_endpoint, tokenData, {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(tokenData)
    });
    
    if (tokenResponse.access_token) {
      console.log('✅ Access token obtained successfully!');
      console.log(`Token type: ${tokenResponse.token_type}`);
      console.log(`Expires in: ${tokenResponse.expires_in} seconds`);
      console.log(`Access token (first 50 chars): ${tokenResponse.access_token.substring(0, 50)}...`);
      console.log('');
      
      // Step 3: Testa il token con il nostro server MCP
      console.log('🧪 Step 3: Testing token with MCP server...');
      
      const mcpResponse = await testMcpWithToken(tokenResponse.access_token);
      console.log('✅ MCP server authentication test completed');
      console.log('');
      
      // Step 4: Testa userinfo endpoint
      console.log('👤 Step 4: Getting user info...');
      const userInfo = await fetchJson(oidcConfig.userinfo_endpoint, {
        'Authorization': `Bearer ${tokenResponse.access_token}`
      });
      
      console.log('✅ User info retrieved:');
      console.log(`- Username: ${userInfo.preferred_username || userInfo.sub}`);
      console.log(`- Email: ${userInfo.email || 'N/A'}`);
      console.log(`- Name: ${userInfo.name || userInfo.given_name + ' ' + userInfo.family_name || 'N/A'}`);
      console.log('');
      
      console.log('🎉 Authentication test completed successfully!');
      console.log('');
      console.log('📝 You can now use this token with OpenAI MCP:');
      console.log(`Authorization: Bearer ${tokenResponse.access_token}`);
      
    } else {
      console.error('❌ Failed to obtain access token');
      console.error('Response:', tokenResponse);
    }
    
  } catch (error) {
    console.error('❌ Authentication test failed:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    console.log('');
    console.log('💡 Troubleshooting tips:');
    console.log('1. Check if Keycloak server is accessible');
    console.log('2. Verify username and password are correct');
    console.log('3. Ensure the client_id exists in Keycloak');
    console.log('4. Check if the realm name is correct (trying "things5")');
  }
}

async function testMcpWithToken(token) {
  const mcpRequest = {
    jsonrpc: '2.0',
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: { listChanged: true },
        sampling: {}
      },
      clientInfo: {
        name: 'auth-test-client',
        version: '1.0.0'
      }
    },
    id: 1
  };
  
  try {
    const response = await postData('http://localhost:3000/mcp', JSON.stringify(mcpRequest), {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${token}`
    });
    
    console.log('✅ MCP server accepted the token');
    console.log(`Server info: ${response.result?.serverInfo?.name} v${response.result?.serverInfo?.version}`);
    return response;
    
  } catch (error) {
    console.log('⚠️  MCP server test failed (this might be expected if auth is required)');
    console.log('Error:', error.message);
    return null;
  }
}

function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    
    const req = client.get(url, { headers }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            const error = new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`);
            error.response = { status: res.statusCode, data: data };
            reject(error);
          }
        } catch (parseError) {
          reject(new Error(`Failed to parse JSON: ${parseError.message}`));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
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
      headers: headers
    };
    
    const req = client.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(responseData));
          } else {
            const error = new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`);
            error.response = { status: res.statusCode, data: responseData };
            reject(error);
          }
        } catch (parseError) {
          reject(new Error(`Failed to parse JSON response: ${parseError.message}`));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.write(data);
    req.end();
  });
}

// Avvia il test
testAuthentication();
