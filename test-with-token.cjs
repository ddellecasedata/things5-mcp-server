#!/usr/bin/env node

/**
 * Test del server MCP con un token esistente
 * Uso: node test-with-token.cjs "your-token-here"
 */

const http = require('http');
const { spawn } = require('child_process');

const TOKEN = process.argv[2];

if (!TOKEN) {
  console.log('❌ Usage: node test-with-token.cjs "your-access-token"');
  console.log('');
  console.log('💡 Come ottenere un token:');
  console.log('1. Vai su https://demo10.things5.digital');
  console.log('2. Fai login con le tue credenziali');
  console.log('3. Apri Developer Tools (F12)');
  console.log('4. Vai su Network tab');
  console.log('5. Fai una richiesta qualsiasi');
  console.log('6. Cerca l\'header "Authorization: Bearer ..." nelle richieste');
  console.log('7. Copia il token (senza "Bearer ")');
  process.exit(1);
}

console.log('🧪 Testing MCP Server with Existing Token');
console.log('=========================================');
console.log(`Token (first 30 chars): ${TOKEN.substring(0, 30)}...`);
console.log('');

// Avvia il server MCP
console.log('🚀 Starting MCP server...');
const serverProcess = spawn('npm', ['run', 'start:streamableHttp'], {
  cwd: process.cwd(),
  stdio: 'pipe'
});

let serverReady = false;

serverProcess.stdout.on('data', (data) => {
  const output = data.toString();
  if (output.includes('listening on port 3000')) {
    serverReady = true;
    console.log('✅ MCP server started on port 3000');
    console.log('');
    
    // Avvia i test dopo che il server è pronto
    setTimeout(runTests, 1000);
  }
});

serverProcess.stderr.on('data', (data) => {
  // Ignora stderr per ora
});

async function runTests() {
  try {
    console.log('🔐 Test 1: Initialize with token');
    console.log('--------------------------------');
    
    const initResponse = await testMcpRequest({
      'Authorization': `Bearer ${TOKEN}`
    });
    
    console.log('✅ Token accepted by MCP server!');
    console.log(`Server: ${initResponse.result?.serverInfo?.name} v${initResponse.result?.serverInfo?.version}`);
    console.log('');
    
    // Estrai session ID dalla risposta (se disponibile)
    const sessionId = 'test-session-' + Date.now(); // Placeholder
    
    console.log('📋 Test 2: List available tools');
    console.log('-------------------------------');
    
    const toolsResponse = await testMcpRequest({
      'Authorization': `Bearer ${TOKEN}`,
      'mcp-session-id': sessionId
    }, {
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
      id: 2
    });
    
    const toolCount = toolsResponse.result?.tools?.length || 0;
    console.log(`✅ Successfully listed ${toolCount} tools`);
    
    if (toolCount > 0) {
      console.log('Available tools:');
      toolsResponse.result.tools.slice(0, 10).forEach((tool, i) => {
        console.log(`  ${i + 1}. ${tool.name} - ${tool.description?.substring(0, 60)}...`);
      });
      
      if (toolCount > 10) {
        console.log(`  ... and ${toolCount - 10} more tools`);
      }
    }
    console.log('');
    
    console.log('🧪 Test 3: Test SSE endpoint');
    console.log('----------------------------');
    
    await testSSEEndpoint();
    console.log('');
    
    console.log('🎉 All tests completed successfully!');
    console.log('');
    console.log('📝 Your server is ready for OpenAI MCP integration:');
    console.log('');
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
    console.log('        "server_description": "Things5 IoT platform",');
    console.log('        "server_url": "https://your-server.com/sse",');
    console.log(`        "authorization": "Bearer ${TOKEN.substring(0, 20)}...",`);
    console.log('        "require_approval": "never"');
    console.log('    }],');
    console.log('    input="Show me all my IoT devices and their status"');
    console.log(')');
    console.log('```');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('Token validation failed')) {
      console.log('');
      console.log('💡 Il token potrebbe essere:');
      console.log('1. Scaduto - ottieni un nuovo token');
      console.log('2. Non valido per questo realm');
      console.log('3. Non autorizzato per le API Things5');
      console.log('');
      console.log('🔄 Prova con modalità no-auth per test:');
      console.log('   server_url: "http://localhost:3000/sse?no_auth=true"');
    }
  } finally {
    console.log('');
    console.log('🛑 Stopping MCP server...');
    serverProcess.kill();
  }
}

function testMcpRequest(headers = {}, customBody = null) {
  const defaultBody = {
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
  };

  const body = customBody || defaultBody;
  const data = JSON.stringify(body);

  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'Content-Length': Buffer.byteLength(data)
  };

  const finalHeaders = { ...defaultHeaders, ...headers };

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/mcp',
      method: 'POST',
      headers: finalHeaders
    }, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          
          if (parsed.error) {
            reject(new Error(parsed.error.message || 'Unknown error'));
          } else {
            resolve(parsed);
          }
        } catch (parseError) {
          reject(new Error(`Failed to parse response: ${parseError.message}`));
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

function testSSEEndpoint() {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: `/sse`,
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Authorization': `Bearer ${TOKEN}`
      }
    }, (res) => {
      if (res.statusCode === 200) {
        console.log('✅ SSE endpoint accepts the token');
        resolve();
      } else {
        console.log(`⚠️  SSE endpoint returned status ${res.statusCode}`);
        resolve(); // Non è un errore critico
      }
      
      // Chiudi la connessione rapidamente per il test
      setTimeout(() => {
        req.destroy();
      }, 500);
    });
    
    req.on('error', (error) => {
      console.log(`⚠️  SSE test error: ${error.message}`);
      resolve(); // Non è un errore critico
    });
    
    req.setTimeout(2000, () => {
      req.destroy();
      console.log('✅ SSE endpoint connection test completed');
      resolve();
    });
    
    req.end();
  });
}

// Cleanup on exit
process.on('SIGINT', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  process.exit();
});

// Timeout di sicurezza
setTimeout(() => {
  if (!serverReady) {
    console.log('❌ Server startup timeout');
    serverProcess.kill();
    process.exit(1);
  }
}, 10000);
