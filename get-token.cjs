#!/usr/bin/env node

/**
 * Script per ottenere un token OAuth da Keycloak
 * Prova diversi realm e configurazioni comuni
 */

const https = require('https');
const querystring = require('querystring');

const USERNAME = process.argv[2] || 'ddellecasedata+test@gmail.com';
const PASSWORD = process.argv[3] || 'Password';
const KEYCLOAK_BASE_URL = 'https://auth.things5.digital';
const CLIENT_ID = 'mcp-server';

// Lista di realm comuni da provare
const REALMS_TO_TRY = [
  'things5',
  'production', 
  'prod',
  'main',
  'default',
  'master',
  'things5-prod',
  'things5-production',
  'app',
  'api'
];

console.log('🔍 Searching for valid Keycloak realm...');
console.log(`Base URL: ${KEYCLOAK_BASE_URL}`);
console.log(`Username: ${USERNAME}`);
console.log(`Client ID: ${CLIENT_ID}`);
console.log('');

async function findValidRealm() {
  for (const realm of REALMS_TO_TRY) {
    console.log(`🔍 Testing realm: ${realm}`);
    
    try {
      // Step 1: Check if realm exists by getting OIDC config
      const oidcUrl = `${KEYCLOAK_BASE_URL}/auth/realms/${realm}/.well-known/openid_configuration`;
      const oidcConfig = await fetchJson(oidcUrl);
      
      if (oidcConfig.token_endpoint) {
        console.log(`✅ Realm "${realm}" exists!`);
        console.log(`   Token endpoint: ${oidcConfig.token_endpoint}`);
        
        // Step 2: Try to get a token
        const token = await getToken(oidcConfig.token_endpoint, realm);
        if (token) {
          console.log(`🎉 Successfully obtained token from realm "${realm}"!`);
          console.log(`   Token (first 50 chars): ${token.access_token.substring(0, 50)}...`);
          console.log(`   Token type: ${token.token_type}`);
          console.log(`   Expires in: ${token.expires_in} seconds`);
          
          // Test the token with our MCP server
          await testTokenWithMcp(token.access_token);
          
          return { realm, token, oidcConfig };
        }
      }
    } catch (error) {
      console.log(`❌ Realm "${realm}": ${error.message}`);
    }
    console.log('');
  }
  
  console.log('❌ No valid realm found with working authentication');
  return null;
}

async function getToken(tokenEndpoint, realm) {
  console.log(`   🔑 Attempting authentication...`);
  
  const tokenData = querystring.stringify({
    grant_type: 'password',
    client_id: CLIENT_ID,
    username: USERNAME,
    password: PASSWORD,
    scope: 'openid profile email'
  });
  
  try {
    const response = await postData(tokenEndpoint, tokenData, {
      'Content-Type': 'application/x-www-form-urlencoded'
    });
    
    console.log(`   ✅ Authentication successful!`);
    return response;
    
  } catch (error) {
    console.log(`   ❌ Authentication failed: ${error.message}`);
    
    // Try without scope
    try {
      console.log(`   🔄 Retrying without scope...`);
      const tokenDataNoScope = querystring.stringify({
        grant_type: 'password',
        client_id: CLIENT_ID,
        username: USERNAME,
        password: PASSWORD
      });
      
      const response = await postData(tokenEndpoint, tokenDataNoScope, {
        'Content-Type': 'application/x-www-form-urlencoded'
      });
      
      console.log(`   ✅ Authentication successful (without scope)!`);
      return response;
      
    } catch (error2) {
      console.log(`   ❌ Authentication failed (no scope): ${error2.message}`);
      return null;
    }
  }
}

async function testTokenWithMcp(token) {
  console.log(`   🧪 Testing token with MCP server...`);
  
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
          name: 'token-test-client',
          version: '1.0.0'
        }
      },
      id: 1
    }), {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${token}`
    });
    
    console.log(`   ✅ MCP server accepted the token!`);
    console.log(`   📋 Server: ${response.result?.serverInfo?.name} v${response.result?.serverInfo?.version}`);
    
  } catch (error) {
    console.log(`   ❌ MCP server rejected token: ${error.message}`);
  }
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.error || `HTTP ${res.statusCode}`));
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
          reject(new Error(`Parse error: ${parseError.message} - Response: ${responseData}`));
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

// Main execution
findValidRealm()
  .then(result => {
    if (result) {
      console.log('');
      console.log('🎯 SUCCESS! Authentication working');
      console.log('================================');
      console.log(`Realm: ${result.realm}`);
      console.log(`Token endpoint: ${result.oidcConfig.token_endpoint}`);
      console.log('');
      console.log('🚀 You can now use this configuration with OpenAI:');
      console.log('');
      console.log('```python');
      console.log('resp = client.responses.create(');
      console.log('    model="gpt-5",');
      console.log('    tools=[{');
      console.log('        "type": "mcp",');
      console.log('        "server_label": "things5",');
      console.log('        "server_url": "http://localhost:3000/sse",');
      console.log(`        "authorization": "Bearer ${result.token.access_token.substring(0, 20)}...",`);
      console.log('        "require_approval": "never"');
      console.log('    }],');
      console.log('    input="Show me my IoT devices"');
      console.log(')');
      console.log('```');
    } else {
      console.log('');
      console.log('❌ Authentication setup needed');
      console.log('=============================');
      console.log('Possible issues:');
      console.log('1. Keycloak server might be using a different URL structure');
      console.log('2. The client "mcp-server" might not exist');
      console.log('3. Username/password might be incorrect');
      console.log('4. The realm might have a different name');
      console.log('');
      console.log('💡 For now, you can use the no-auth mode for testing:');
      console.log('   server_url: "http://localhost:3000/sse?no_auth=true"');
    }
  })
  .catch(console.error);
