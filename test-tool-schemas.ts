/**
 * Test per verificare che gli schemi dei tool siano esposti correttamente
 */

import { createServer } from './src/server/things5.js';

const server = createServer('test-token');

// Ottieni i tool registrati
const tools = (server as any)._tools || (server as any).tools || {};

console.log('='.repeat(80));
console.log('📋 VERIFICA ESPOSIZIONE TOOL SCHEMAS');
console.log('='.repeat(80));

const toolNames = Object.keys(tools);
console.log(`\n✅ Tool registrati: ${toolNames.length}`);

// Verifica alcuni tool campione
const sampleTools = ['metrics_read', 'events_read', 'overview_alarms', 'users_list'];

for (const toolName of sampleTools) {
  const tool = tools[toolName];
  if (tool) {
    console.log(`\n🔍 ${toolName}:`);
    console.log(`  - Description: ${tool.description?.substring(0, 60)}...`);
    
    const schema = tool.inputSchema;
    if (schema) {
      console.log(`  - Schema type: ${schema.type || 'unknown'}`);
      console.log(`  - Properties: ${Object.keys(schema.properties || {}).length}`);
      
      // Verifica array items
      const props = schema.properties || {};
      for (const [key, prop] of Object.entries(props) as any) {
        if (prop.type === 'array') {
          if (prop.items) {
            console.log(`  - ✅ ${key}: array<${prop.items.type || 'object'}>`);
          } else {
            console.log(`  - ❌ ${key}: array WITHOUT items!`);
          }
        }
      }
    } else {
      console.log(`  - ❌ NO SCHEMA!`);
    }
  } else {
    console.log(`\n❌ ${toolName}: NOT FOUND`);
  }
}

console.log('\n' + '='.repeat(80));
console.log('✅ Test completato');
console.log('='.repeat(80));
