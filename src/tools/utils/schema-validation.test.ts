import { describe, it, expect } from 'vitest';
import { getAggregatedMetricsTool } from '../data/aggregatedMetrics.js';
import { getEventsReadTool } from '../data/eventsRead.js';
import { getMetricsReadTool } from '../data/metricsRead.js';
import { getReadParametersTool } from '../data/readParameters.js';
import { getStateReadLastValueTool } from '../data/stateReadLastValue.js';
import { getStatesReadTool } from '../data/statesRead.js';
import { getPerformActionTool } from '../performAction.js';
import { getMachineCommandCreateTool } from '../machineCommands/machineCommandCreate.js';
import { getMachineCommandUpdateTool } from '../machineCommands/machineCommandUpdate.js';
import { getUsersListTool } from '../user/usersList.js';
import { getListMachinesTool } from '../listMachines.js';

/**
 * Validates that all array types in a JSON Schema have an 'items' property.
 * This is required by JSON Schema specification and MCP clients.
 */
function validateArraySchemas(schema: any, path: string = 'root'): string[] {
  const errors: string[] = [];

  if (!schema || typeof schema !== 'object') {
    return errors;
  }

  // Check if this is an array without items
  if (schema.type === 'array' && !schema.items) {
    errors.push(`${path}: array type without 'items' property`);
  }

  // Recursively check properties
  if (schema.properties) {
    for (const [key, value] of Object.entries(schema.properties)) {
      errors.push(...validateArraySchemas(value, `${path}.properties.${key}`));
    }
  }

  // Recursively check items
  if (schema.items) {
    if (Array.isArray(schema.items)) {
      schema.items.forEach((item: any, index: number) => {
        errors.push(...validateArraySchemas(item, `${path}.items[${index}]`));
      });
    } else {
      errors.push(...validateArraySchemas(schema.items, `${path}.items`));
    }
  }

  // Recursively check allOf, anyOf, oneOf
  if (schema.allOf) {
    schema.allOf.forEach((s: any, i: number) => {
      errors.push(...validateArraySchemas(s, `${path}.allOf[${i}]`));
    });
  }
  if (schema.anyOf) {
    schema.anyOf.forEach((s: any, i: number) => {
      errors.push(...validateArraySchemas(s, `${path}.anyOf[${i}]`));
    });
  }
  if (schema.oneOf) {
    schema.oneOf.forEach((s: any, i: number) => {
      errors.push(...validateArraySchemas(s, `${path}.oneOf[${i}]`));
    });
  }

  return errors;
}

describe('Tool Schema Validation', () => {
  const toolFactories = [
    { name: 'aggregated_metrics', factory: getAggregatedMetricsTool },
    { name: 'events_read', factory: getEventsReadTool },
    { name: 'metrics_read', factory: getMetricsReadTool },
    { name: 'read_parameters', factory: getReadParametersTool },
    { name: 'state_read_last_value', factory: getStateReadLastValueTool },
    { name: 'states_read', factory: getStatesReadTool },
    { name: 'perform_action', factory: getPerformActionTool },
    { name: 'machine_command_create', factory: getMachineCommandCreateTool },
    { name: 'machine_command_update', factory: getMachineCommandUpdateTool },
    { name: 'users_list', factory: getUsersListTool },
    { name: 'list_machines', factory: getListMachinesTool }
  ];

  for (const { name, factory } of toolFactories) {
    it(`${name} should have valid array schemas`, () => {
      const tool = factory('test-token');
      const errors = validateArraySchemas(tool.inputSchema, name);
      
      if (errors.length > 0) {
        console.error(`\nSchema errors for ${name}:`, errors);
        console.error('Schema:', JSON.stringify(tool.inputSchema, null, 2));
      }
      
      expect(errors).toHaveLength(0);
    });

    it(`${name} should have a valid input schema structure`, () => {
      const tool = factory('test-token');
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties).toBeDefined();
    });
  }
});
