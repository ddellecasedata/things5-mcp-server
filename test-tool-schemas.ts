/**
 * Test per verificare che gli schemi dei tool siano esposti correttamente con Zod
 */

import { createServer } from './src/server/things5.js';

const { server } = createServer('test-token');

console.log('='.repeat(80));
console.log('📋 VERIFICA REGISTRAZIONE TOOL CON ZOD SCHEMAS');
console.log('='.repeat(80));

// Accedi ai tool tramite l'API interna del server
const mcpServer = (server as any).server || server;

console.log('\n✅ Server creato con successo');
console.log(`   Server type: ${mcpServer.constructor?.name}`);

// Verifica che i tool siano stati registrati
// L'SDK MCP dovrebbe avere i tool registrati internamente
const toolsMap = (mcpServer as any)._requestHandlers || 
                 (mcpServer as any).requestHandlers ||
                 (server as any)._tools ||
                 {};

console.log(`\n📊 Request handlers registrati: ${Object.keys(toolsMap).length}`);

// Cerca handler tools/list
const toolsListHandler = toolsMap['tools/list'];
if (toolsListHandler) {
  console.log('✅ tools/list handler trovato');
  
  // Prova a chiamare il handler per vedere i tool registrati
  try {
    const result = await toolsListHandler({});
    console.log(`\n✅ Tool disponibili: ${result.tools?.length || 0}`);
    
    // Mostra primi 5 tool
    const sampleTools = (result.tools || []).slice(0, 5);
    for (const tool of sampleTools) {
      console.log(`\n📋 ${tool.name}:`);
      console.log(`   Description: ${tool.description?.substring(0, 60)}...`);
      if (tool.inputSchema) {
        console.log(`   InputSchema: ${JSON.stringify(tool.inputSchema).substring(0, 80)}...`);
      }
    }
  } catch (e: any) {
    console.log('❌ Errore chiamando tools/list:', e.message);
  }
} else {
  console.log('❌ tools/list handler NON trovato');
  console.log('   Handlers disponibili:', Object.keys(toolsMap).slice(0, 10));
}

console.log('\n' + '='.repeat(80));
console.log('✅ Test completato');
console.log('='.repeat(80));
