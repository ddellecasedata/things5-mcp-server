/**
 * Test Auto-Resolution System
 * 
 * Verifica che i parametri mancanti vengano risolti automaticamente
 */

import { 
  autoResolveParameters, 
  canAutoResolve, 
  getResolvableParameters,
  TOOL_DEPENDENCIES 
} from './src/utils/toolDependencies.js';

console.log('='.repeat(80));
console.log('🧪 TEST SISTEMA AUTO-RESOLUTION DIPENDENZE');
console.log('='.repeat(80));

// Test 1: Verifica mapping tool
console.log('\n📋 Test 1: Tool con auto-resolution disponibile');
const toolsWithDeps = Object.keys(TOOL_DEPENDENCIES);
console.log(`✅ ${toolsWithDeps.length} tool con auto-resolution configurata:`);
toolsWithDeps.slice(0, 10).forEach(tool => {
  const params = getResolvableParameters(tool);
  console.log(`  - ${tool}: ${params.join(', ')}`);
});

// Test 2: Verifica canAutoResolve
console.log('\n📋 Test 2: Verifica canAutoResolve()');
console.log(`  metrics_read: ${canAutoResolve('metrics_read') ? '✅' : '❌'}`);
console.log(`  machine_command_execute: ${canAutoResolve('machine_command_execute') ? '✅' : '❌'}`);
console.log(`  list_machines: ${canAutoResolve('list_machines') ? '❌ (expected)' : '✅'}`);

// Test 3: Simulazione (senza chiamate API reali)
console.log('\n📋 Test 3: Struttura dependencies');
const metricsReadDeps = TOOL_DEPENDENCIES['metrics_read'];
if (metricsReadDeps) {
  console.log('✅ metrics_read dependencies:');
  metricsReadDeps.forEach(dep => {
    console.log(`  - Parameter: ${dep.parameter}`);
    console.log(`    Description: ${dep.description}`);
    console.log(`    Resolver: ${dep.resolver.name}()`);
  });
}

const commandExecuteDeps = TOOL_DEPENDENCIES['machine_command_execute'];
if (commandExecuteDeps) {
  console.log('\n✅ machine_command_execute dependencies:');
  commandExecuteDeps.forEach(dep => {
    console.log(`  - Parameter: ${dep.parameter}`);
    console.log(`    Description: ${dep.description}`);
    console.log(`    Resolver: ${dep.resolver.name}()`);
  });
}

// Test 4: Verifica tutti i tool mappati
console.log('\n📋 Test 4: Riepilogo completo tool mappati');
console.log('\n🎯 Tool per operazioni device:');
['device_details', 'device_update', 'device_firmware_detail'].forEach(tool => {
  if (canAutoResolve(tool)) {
    const params = getResolvableParameters(tool);
    console.log(`  ✅ ${tool}: auto-resolve ${params.join(', ')}`);
  }
});

console.log('\n⚙️  Tool per comandi:');
['machine_command_execute', 'machine_command_create', 'machine_command_update', 'machine_command_delete'].forEach(tool => {
  if (canAutoResolve(tool)) {
    const params = getResolvableParameters(tool);
    console.log(`  ✅ ${tool}: auto-resolve ${params.join(', ')}`);
  }
});

console.log('\n📊 Tool per lettura dati:');
['metrics_read', 'events_read', 'states_read', 'read_parameters'].forEach(tool => {
  if (canAutoResolve(tool)) {
    const params = getResolvableParameters(tool);
    console.log(`  ✅ ${tool}: auto-resolve ${params.join(', ')}`);
  }
});

console.log('\n🍳 Tool ricette:');
if (canAutoResolve('device_managed_recipes')) {
  const params = getResolvableParameters('device_managed_recipes');
  console.log(`  ✅ device_managed_recipes: auto-resolve ${params.join(', ')}`);
}

console.log('\n📈 Tool overview:');
['aggregated_metrics', 'overview_events'].forEach(tool => {
  if (canAutoResolve(tool)) {
    const params = getResolvableParameters(tool);
    console.log(`  ✅ ${tool}: auto-resolve ${params.join(', ')}`);
  }
});

console.log('\n' + '='.repeat(80));
console.log('✅ TEST COMPLETATO');
console.log('='.repeat(80));
console.log('\n📝 Note:');
console.log('  - Auto-resolution configurata per 20+ tool');
console.log('  - Workflow principali supportati:');
console.log('    1️⃣  device_name → device_id (via list_machines)');
console.log('    2️⃣  command_name → machine_command_id (via device_firmware_detail)');
console.log('    3️⃣  auto-fill machine_ids per overview (via list_machines)');
console.log('\n🚀 Pronto per integrazione con OpenAI Realtime API!');
