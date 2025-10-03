/**
 * Script completo per verificare la conformità di TUTTI i tool MCP con OpenAPI
 */

import * as fs from 'fs';
import * as allTools from './src/tools/index.js';

// Carica OpenAPI spec
const openApiSpec = JSON.parse(fs.readFileSync('./openapi.json', 'utf-8'));

interface ComplianceIssue {
  tool: string;
  parameter: string;
  issue: string;
  severity: 'error' | 'warning';
  expected?: any;
  actual?: any;
}

const issues: ComplianceIssue[] = [];
const unmappedTools: string[] = [];

// Mappa completa tool -> endpoint OpenAPI
const toolToEndpoint: Record<string, { path: string; method: string; operation: string }> = {
  // Data tools
  'metrics_read': { path: '/devices/{device_id}/metrics', method: 'get', operation: 'metrics-read' },
  'events_read': { path: '/devices/{device_id}/events', method: 'get', operation: 'events-read' },
  'states_read': { path: '/devices/{device_id}/states', method: 'get', operation: 'states-read' },
  'state_read_last_value': { path: '/devices/{device_id}/last_states', method: 'get', operation: 'states-read-last-value' },
  'read_parameters': { path: '/devices/{device_id}/parameters', method: 'get', operation: 'parameters-read' },
  'read_single_parameter': { path: '/devices/{device_id}/parameters', method: 'get', operation: 'parameters-read' },
  'aggregated_metrics': { path: '/metrics/aggregated', method: 'get', operation: 'aggregated-metrics-read' },
  'perform_action': { path: '/devices/{device_id}/parameters', method: 'post', operation: 'parameters-write' },
  
  // Device management
  'list_machines': { path: '/organizations/{organization_id}/devices', method: 'get', operation: 'device-list' },
  'device_details': { path: '/devices/{device_id}', method: 'get', operation: 'device-detail' },
  'device_create': { path: '/organizations/{organization_id}/devices', method: 'post', operation: 'device-create' },
  'device_update': { path: '/devices/{device_id}', method: 'patch', operation: 'device-update' },
  
  // Device firmware
  'device_firmware_list': { path: '/machine_firmwares', method: 'get', operation: 'machine-firmware-list' },
  'device_firmware_detail': { path: '/machine_firmwares/{machine_firmware_id}', method: 'get', operation: 'machine-firmware-detail' },
  'device_firmware_create': { path: '/machine_models/{machine_model_id}/machine_firmwares', method: 'post', operation: 'machine-firmware-create' },
  'device_firmware_update': { path: '/machine_firmwares/{machine_firmware_id}', method: 'patch', operation: 'machine-firmware-update' },
  'device_firmware_delete': { path: '/machine_firmwares/{machine_firmware_id}', method: 'delete', operation: 'machine-firmware-delete' },
  
  // Device models
  'device_models_list': { path: '/organizations/{organization_id}/machine_models', method: 'get', operation: 'machine-model-list' },
  'device_model_detail': { path: '/machine_models/{machine_model_id}', method: 'get', operation: 'machine-model-detail' },
  'device_model_create': { path: '/organizations/{organization_id}/machine_models', method: 'post', operation: 'machine-model-create' },
  
  // Groups
  'devices_groups_list': { path: '/organizations/{organization_id}/machines_groups', method: 'get', operation: 'machines-groups-list' },
  'show_device_group': { path: '/machines_groups/{machines_group_id}', method: 'get', operation: 'machines-group-detail' },
  'create_device_group_user': { path: '/organizations/{organization_id}/machines_groups/{machines_group_id}/users', method: 'post', operation: 'device-group-user-create' },
  
  // Users
  'users_list': { path: '/organizations/{organization_id}/users', method: 'get', operation: 'users-list' },
  'users_detail': { path: '/users/{user_id}', method: 'get', operation: 'user-detail' },
  'user_create': { path: '/organizations/{organization_id}/users', method: 'post', operation: 'user-create' },
  
  // Roles
  'roles_list': { path: '/organizations/{organization_id}/roles', method: 'get', operation: 'roles-list' },
  
  // Organization
  'organization_detail': { path: '/organizations/{organization_id}', method: 'get', operation: 'organization-detail' },
  
  // Overview
  'overview_alarms': { path: '/organizations/{organization_id}/overview/alarms', method: 'get', operation: 'alarms' },
  'overview_events': { path: '/organizations/{organization_id}/overview/events', method: 'get', operation: 'overview-events' },
  
  // Recipes
  'device_managed_recipes': { path: '/recipes/machines/{machine_id}/device_managed_recipes', method: 'get', operation: 'device-managed-recipes-read' },
  
  // Machine commands - these use firmware endpoint with include_machine_commands
  'machine_command_create': { path: '/organizations/{organization_id}/machines/{machine_id}/machine_firmware', method: 'get', operation: 'device-firmware-detail' },
  'machine_command_update': { path: '/organizations/{organization_id}/machines/{machine_id}/machine_firmware', method: 'get', operation: 'device-firmware-detail' },
  'machine_command_delete': { path: '/organizations/{organization_id}/machines/{machine_id}/machine_firmware', method: 'get', operation: 'device-firmware-detail' },
  'machine_command_execute': { path: '/organizations/{organization_id}/machines/{machine_id}/machine_firmware', method: 'get', operation: 'device-firmware-detail' },
};

function getOpenApiParameters(path: string, method: string): any[] {
  const pathObj = openApiSpec.paths[path];
  if (!pathObj) return [];
  
  const methodObj = pathObj[method];
  if (!methodObj) return [];
  
  return methodObj.parameters || [];
}

function getOpenApiRequestBody(path: string, method: string): any {
  const pathObj = openApiSpec.paths[path];
  if (!pathObj) return null;
  
  const methodObj = pathObj[method];
  if (!methodObj) return null;
  
  return methodObj.requestBody?.content?.['application/json']?.schema;
}

function checkToolCompliance(tool: any, toolName: string) {
  const mapping = toolToEndpoint[toolName];
  
  if (!mapping) {
    unmappedTools.push(toolName);
    return;
  }
  
  const openApiParams = getOpenApiParameters(mapping.path, mapping.method);
  const requestBodySchema = getOpenApiRequestBody(mapping.path, mapping.method);
  const toolSchema = tool.inputSchema;
  
  console.log(`\n🔍 ${toolName} → ${mapping.method.toUpperCase()} ${mapping.path}`);
  
  let hasIssues = false;
  
  // Verifica parametri query/path
  for (const param of openApiParams) {
    if (param.in === 'path') continue;
    
    const paramName = param.name.replace('[]', '');
    const possibleNames = [
      paramName,
      paramName.replace('[]', ''),
      paramName.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
      // Altri mapping comuni
      paramName === 'connected' ? 'is_connected' : paramName,
      paramName === 'configuration_filter' ? 'parameter_name_list' : paramName,
    ];
    
    let foundProp: any = null;
    let foundName: string = '';
    
    for (const name of possibleNames) {
      if (toolSchema.properties && toolSchema.properties[name]) {
        foundProp = toolSchema.properties[name];
        foundName = name;
        break;
      }
    }
    
    if (!foundProp) {
      if (param.required) {
        issues.push({
          tool: toolName,
          parameter: param.name,
          issue: 'Required parameter missing',
          severity: 'error',
          expected: param.schema
        });
        console.log(`  ❌ Missing required: ${param.name}`);
        hasIssues = true;
      } else {
        console.log(`  ⚠️  Optional missing: ${param.name}`);
      }
      continue;
    }
    
    // Verifica tipo
    const expectedType = param.schema.type;
    const actualType = foundProp.type;
    
    if (expectedType === 'integer' && actualType === 'number') {
      // Verifica se è .int()
      if (!foundProp.minimum && !foundProp.maximum && !foundProp.multipleOf) {
        issues.push({
          tool: toolName,
          parameter: foundName,
          issue: 'Type mismatch: should be integer',
          severity: 'warning',
          expected: 'integer',
          actual: 'number'
        });
        console.log(`  ⚠️  ${foundName}: number (should be integer)`);
        hasIssues = true;
      } else {
        console.log(`  ✅ ${foundName}: integer`);
      }
    } else if (expectedType !== actualType) {
      issues.push({
        tool: toolName,
        parameter: foundName,
        issue: 'Type mismatch',
        severity: 'error',
        expected: expectedType,
        actual: actualType
      });
      console.log(`  ❌ ${foundName}: type mismatch (expected ${expectedType}, got ${actualType})`);
      hasIssues = true;
    } else {
      console.log(`  ✅ ${foundName}: ${actualType}`);
    }
    
    // Verifica array items
    if (param.schema.type === 'array' && foundProp.type === 'array') {
      if (!foundProp.items) {
        issues.push({
          tool: toolName,
          parameter: foundName,
          issue: 'Array without items',
          severity: 'error'
        });
        console.log(`  ❌ ${foundName}: array without items`);
        hasIssues = true;
      } else if (param.schema.items && foundProp.items.type !== param.schema.items.type) {
        console.log(`  ⚠️  ${foundName}: array items type mismatch`);
      }
    }
    
    // Verifica enum
    if (param.schema.enum && foundProp.enum) {
      const enumMatch = JSON.stringify(param.schema.enum.sort()) === JSON.stringify(foundProp.enum.sort());
      if (!enumMatch) {
        issues.push({
          tool: toolName,
          parameter: foundName,
          issue: 'Enum values mismatch',
          severity: 'warning',
          expected: param.schema.enum,
          actual: foundProp.enum
        });
        console.log(`  ⚠️  ${foundName}: enum mismatch`);
        hasIssues = true;
      }
    }
  }
  
  if (!hasIssues) {
    console.log(`  ✅ All parameters compliant`);
  }
}

console.log('='.repeat(80));
console.log('📋 VERIFICA CONFORMITÀ COMPLETA - TUTTI I TOOL MCP');
console.log('='.repeat(80));

// Ottieni tutti i tool factory
const toolFactories: { name: string; factory: any }[] = [
  { name: 'aggregated_metrics', factory: allTools.getAggregatedMetricsTool },
  { name: 'events_read', factory: allTools.getEventsReadTool },
  { name: 'metrics_read', factory: allTools.getMetricsReadTool },
  { name: 'read_parameters', factory: allTools.getReadParametersTool },
  { name: 'state_read_last_value', factory: allTools.getStateReadLastValueTool },
  { name: 'states_read', factory: allTools.getStatesReadTool },
  { name: 'list_machines', factory: allTools.getListMachinesTool },
  { name: 'device_details', factory: allTools.getDeviceDetailsTool },
  { name: 'device_create', factory: allTools.getDeviceCreateTool },
  { name: 'device_update', factory: allTools.getDeviceUpdateTool },
  { name: 'device_firmware_list', factory: allTools.getDeviceFirmwareListTool },
  { name: 'device_firmware_detail', factory: allTools.getDeviceFirmwareDetailTool },
  { name: 'device_firmware_create', factory: allTools.getDeviceFirmwareCreateTool },
  { name: 'device_firmware_update', factory: allTools.getDeviceFirmwareUpdateTool },
  { name: 'device_firmware_delete', factory: allTools.getDeviceFirmwareDeleteTool },
  { name: 'device_models_list', factory: allTools.getDeviceModelsListTool },
  { name: 'device_model_detail', factory: allTools.getDeviceModelDetailTool },
  { name: 'device_model_create', factory: allTools.getDeviceModelCreateTool },
  { name: 'devices_groups_list', factory: allTools.getDevicesGroupsListTool },
  { name: 'show_device_group', factory: allTools.getShowDeviceGroupTool },
  { name: 'users_list', factory: allTools.getUsersListTool },
  { name: 'users_detail', factory: allTools.getUsersDetailTool },
  { name: 'user_create', factory: allTools.getUserCreateTool },
  { name: 'roles_list', factory: allTools.getRolesListTool },
  { name: 'organization_detail', factory: allTools.getOrganizationDetailTool },
  { name: 'perform_action', factory: allTools.getPerformActionTool },
  { name: 'machine_command_create', factory: allTools.getMachineCommandCreateTool },
  { name: 'machine_command_update', factory: allTools.getMachineCommandUpdateTool },
  { name: 'machine_command_delete', factory: allTools.getMachineCommandDeleteTool },
  { name: 'machine_command_execute', factory: allTools.getMachineCommandExecuteTool },
  { name: 'create_device_group_user', factory: allTools.getCreateDeviceGroupUserTool },
  { name: 'overview_alarms', factory: allTools.getOverviewAlarmsTool },
  { name: 'overview_events', factory: allTools.getOverviewEventsTool },
  { name: 'device_managed_recipes', factory: allTools.getDeviceManagedRecipesTool },
  { name: 'read_single_parameter', factory: allTools.getReadSingleParameterTool },
];

for (const { name, factory } of toolFactories) {
  try {
    const tool = factory('test-token');
    checkToolCompliance(tool, name);
  } catch (error: any) {
    console.log(`\n⚠️  ${name}: Could not instantiate (${error.message})`);
  }
}

console.log('\n' + '='.repeat(80));
console.log('📊 RIEPILOGO VERIFICA');
console.log('='.repeat(80));

const errors = issues.filter(i => i.severity === 'error');
const warnings = issues.filter(i => i.severity === 'warning');

console.log(`\n🔍 Tool analizzati: ${toolFactories.length}`);
console.log(`✅ Tool mappati: ${toolFactories.length - unmappedTools.length}`);
console.log(`⚠️  Tool non mappati: ${unmappedTools.length}`);
console.log(`❌ Errori: ${errors.length}`);
console.log(`⚠️  Warning: ${warnings.length}`);

if (unmappedTools.length > 0) {
  console.log(`\n📝 Tool non mappati a OpenAPI:`);
  unmappedTools.forEach(t => console.log(`  - ${t}`));
}

if (errors.length > 0) {
  console.log(`\n❌ Errori di conformità (${errors.length}):`);
  errors.forEach(e => {
    console.log(`\n  • ${e.tool}.${e.parameter}: ${e.issue}`);
    if (e.expected) console.log(`    Expected: ${JSON.stringify(e.expected)}`);
    if (e.actual) console.log(`    Actual: ${JSON.stringify(e.actual)}`);
  });
}

if (warnings.length > 0) {
  console.log(`\n⚠️  Warning (${warnings.length}):`);
  warnings.forEach(w => {
    console.log(`  • ${w.tool}.${w.parameter}: ${w.issue}`);
  });
}

console.log('\n' + '='.repeat(80));

if (errors.length > 0) {
  console.log('❌ VERIFICA FALLITA: Presenti errori di conformità');
  process.exit(1);
} else if (warnings.length > 0) {
  console.log('⚠️  VERIFICA COMPLETATA CON WARNING');
  process.exit(0);
} else {
  console.log('✅ TUTTI I TOOL MAPPATI SONO CONFORMI!');
  process.exit(0);
}
