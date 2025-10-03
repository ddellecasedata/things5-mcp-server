import { describe, it, expect } from 'vitest';
import { getMachineCommandCreateTool } from './machineCommandCreate.js';
import { getMachineCommandUpdateTool } from './machineCommandUpdate.js';
import { getMachineCommandDeleteTool } from './machineCommandDelete.js';
import { getMachineCommandExecuteTool } from './machineCommandExecute.js';

describe('machineCommands integration', () => {
  const mockAuthToken = 'test-token';

  describe('tool instantiation', () => {
    it('should create machineCommandCreate tool with correct properties', () => {
      const tool = getMachineCommandCreateTool(mockAuthToken);

      expect(tool.name).toBe('machine_command_create');
      expect(tool.description).toContain('Create a new machine command');
      expect(tool.inputSchema).toBeDefined();
      expect(tool.outputSchema).toBeDefined();
      expect(typeof tool.handler).toBe('function');
    });

    it('should create machineCommandUpdate tool with correct properties', () => {
      const tool = getMachineCommandUpdateTool(mockAuthToken);

      expect(tool.name).toBe('machine_command_update');
      expect(tool.description).toContain('Update an existing machine command');
      expect(tool.inputSchema).toBeDefined();
      expect(tool.outputSchema).toBeDefined();
      expect(typeof tool.handler).toBe('function');
    });

    it('should create machineCommandDelete tool with correct properties', () => {
      const tool = getMachineCommandDeleteTool(mockAuthToken);

      expect(tool.name).toBe('machine_command_delete');
      expect(tool.description).toContain('Delete an existing machine command');
      expect(tool.inputSchema).toBeDefined();
      expect(tool.outputSchema).toBeDefined();
      expect(typeof tool.handler).toBe('function');
    });

    it('should create machineCommandExecute tool with correct properties', () => {
      const tool = getMachineCommandExecuteTool(mockAuthToken);

      expect(tool.name).toBe('machine_command_execute');
      expect(tool.description).toContain('Execute a machine command');
      expect(tool.inputSchema).toBeDefined();
      expect(tool.outputSchema).toBeDefined();
      expect(typeof tool.handler).toBe('function');
    });
  });

  describe('tool schemas', () => {
    it('should have valid input schemas', () => {
      const createTool = getMachineCommandCreateTool(mockAuthToken);
      const updateTool = getMachineCommandUpdateTool(mockAuthToken);
      const deleteTool = getMachineCommandDeleteTool(mockAuthToken);
      const executeTool = getMachineCommandExecuteTool(mockAuthToken);

      // Check that schemas have required properties
      expect(createTool.inputSchema).toHaveProperty('type', 'object');
      expect(createTool.inputSchema).toHaveProperty('properties');
      expect((createTool.inputSchema as any).properties).toHaveProperty('machine_firmware_id');
      expect((createTool.inputSchema as any).properties).toHaveProperty('name');
      expect((createTool.inputSchema as any).properties).toHaveProperty('parameters');

      expect(updateTool.inputSchema).toHaveProperty('type', 'object');
      expect(updateTool.inputSchema).toHaveProperty('properties');
      expect((updateTool.inputSchema as any).properties).toHaveProperty('machine_command_id');
      expect((updateTool.inputSchema as any).properties).toHaveProperty('name');
      expect((updateTool.inputSchema as any).properties).toHaveProperty('parameters');

      expect(deleteTool.inputSchema).toHaveProperty('type', 'object');
      expect(deleteTool.inputSchema).toHaveProperty('properties');
      expect((deleteTool.inputSchema as any).properties).toHaveProperty('machine_command_id');

      expect(executeTool.inputSchema).toHaveProperty('type', 'object');
      expect(executeTool.inputSchema).toHaveProperty('properties');
      expect((executeTool.inputSchema as any).properties).toHaveProperty('device_id');
      expect((executeTool.inputSchema as any).properties).toHaveProperty('machine_command_id');
      expect((executeTool.inputSchema as any).properties).toHaveProperty('overrides');
    });

    it('should have valid output schemas', () => {
      const createTool = getMachineCommandCreateTool(mockAuthToken);
      const updateTool = getMachineCommandUpdateTool(mockAuthToken);
      const deleteTool = getMachineCommandDeleteTool(mockAuthToken);
      const executeTool = getMachineCommandExecuteTool(mockAuthToken);

      expect(createTool.outputSchema).toHaveProperty('type', 'object');
      expect(createTool.outputSchema).toHaveProperty('properties');
      expect((createTool.outputSchema as any).properties).toHaveProperty('command');

      expect(updateTool.outputSchema).toHaveProperty('type', 'object');
      expect(updateTool.outputSchema).toHaveProperty('properties');
      expect((updateTool.outputSchema as any).properties).toHaveProperty('command');

      expect(deleteTool.outputSchema).toHaveProperty('type', 'object');
      expect(deleteTool.outputSchema).toHaveProperty('properties');
      expect((deleteTool.outputSchema as any).properties).toHaveProperty('success');
      expect((deleteTool.outputSchema as any).properties).toHaveProperty('machine_command_id');

      expect(executeTool.outputSchema).toHaveProperty('type', 'object');
      expect(executeTool.outputSchema).toHaveProperty('properties');
      expect((executeTool.outputSchema as any).properties).toHaveProperty('result');
    });
  });

  describe('tool consistency', () => {
    it('should have consistent naming pattern', () => {
      const createTool = getMachineCommandCreateTool(mockAuthToken);
      const updateTool = getMachineCommandUpdateTool(mockAuthToken);
      const deleteTool = getMachineCommandDeleteTool(mockAuthToken);
      const executeTool = getMachineCommandExecuteTool(mockAuthToken);

      expect(createTool.name).toMatch(/^machine_command_/);
      expect(updateTool.name).toMatch(/^machine_command_/);
      expect(deleteTool.name).toMatch(/^machine_command_/);
      expect(executeTool.name).toMatch(/^machine_command_/);
    });

    it('should have consistent description format', () => {
      const createTool = getMachineCommandCreateTool(mockAuthToken);
      const updateTool = getMachineCommandUpdateTool(mockAuthToken);
      const deleteTool = getMachineCommandDeleteTool(mockAuthToken);
      const executeTool = getMachineCommandExecuteTool(mockAuthToken);

      expect(createTool.description).toMatch(/^(Create|Update|Delete|Execute)/);
      expect(updateTool.description).toMatch(/^(Create|Update|Delete|Execute)/);
      expect(deleteTool.description).toMatch(/^(Create|Update|Delete|Execute)/);
      expect(executeTool.description).toMatch(/^(Create|Update|Delete|Execute)/);
    });

    it('should all accept auth token parameter', () => {
      const emptyToken = '';
      const validToken = 'valid-token';

      expect(() => getMachineCommandCreateTool(emptyToken)).not.toThrow();
      expect(() => getMachineCommandCreateTool(validToken)).not.toThrow();

      expect(() => getMachineCommandUpdateTool(emptyToken)).not.toThrow();
      expect(() => getMachineCommandUpdateTool(validToken)).not.toThrow();

      expect(() => getMachineCommandDeleteTool(emptyToken)).not.toThrow();
      expect(() => getMachineCommandDeleteTool(validToken)).not.toThrow();

      expect(() => getMachineCommandExecuteTool(emptyToken)).not.toThrow();
      expect(() => getMachineCommandExecuteTool(validToken)).not.toThrow();
    });
  });

  describe('parameter validation schemas', () => {
    it('should have consistent parameter structure in create and update schemas', () => {
      const createTool = getMachineCommandCreateTool(mockAuthToken);
      const updateTool = getMachineCommandUpdateTool(mockAuthToken);

      const createParametersSchema = (createTool.inputSchema as any).properties.parameters;
      const updateParametersSchema = (updateTool.inputSchema as any).properties.parameters;

      // Both should be arrays
      expect(createParametersSchema.type).toBe('array');
      expect(updateParametersSchema.type).toBe('array');

      // Both should have items with the same structure
      const createItemSchema = createParametersSchema.items;
      const updateItemSchema = updateParametersSchema.items;

      expect(createItemSchema.properties).toHaveProperty('machine_variable_id');
      expect(createItemSchema.properties).toHaveProperty('value');
      expect(createItemSchema.properties).toHaveProperty('allow_override');
      expect(createItemSchema.properties).toHaveProperty('label');

      expect(updateItemSchema.properties).toHaveProperty('machine_variable_id');
      expect(updateItemSchema.properties).toHaveProperty('value');
      expect(updateItemSchema.properties).toHaveProperty('allow_override');
      expect(updateItemSchema.properties).toHaveProperty('label');
    });

    it('should have required fields properly marked', () => {
      const createTool = getMachineCommandCreateTool(mockAuthToken);
      const updateTool = getMachineCommandUpdateTool(mockAuthToken);
      const deleteTool = getMachineCommandDeleteTool(mockAuthToken);

      // Create tool should require all main fields
      expect((createTool.inputSchema as any).required).toContain('machine_firmware_id');
      expect((createTool.inputSchema as any).required).toContain('name');
      expect((createTool.inputSchema as any).required).toContain('parameters');

      // Update tool should only require machine_command_id
      expect((updateTool.inputSchema as any).required).toContain('machine_command_id');
      expect((updateTool.inputSchema as any).required).not.toContain('name');
      expect((updateTool.inputSchema as any).required).not.toContain('parameters');

      // Delete tool should only require machine_command_id
      expect((deleteTool.inputSchema as any).required).toContain('machine_command_id');
    });
  });
});