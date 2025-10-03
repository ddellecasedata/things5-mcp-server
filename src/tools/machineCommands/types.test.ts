import { describe, it, expect } from 'vitest';
import type {
  MachineCommandParameter,
  MachineCommandResponse,
  CreateMachineCommandRequest,
  UpdateMachineCommandRequest,
  MachineCommandCreateInput,
  MachineCommandUpdateInput,
  MachineCommandDeleteInput
} from './types.js';

describe('machineCommands types', () => {
  describe('MachineCommandParameter', () => {
    it('should have correct structure', () => {
      const parameter: MachineCommandParameter = {
        machine_variable_id: 'var-123',
        value: 'test-value',
        allow_override: true,
        label: 'Test Parameter'
      };

      expect(parameter.machine_variable_id).toBe('var-123');
      expect(parameter.value).toBe('test-value');
      expect(parameter.allow_override).toBe(true);
      expect(parameter.label).toBe('Test Parameter');
    });

    it('should allow boolean false for allow_override', () => {
      const parameter: MachineCommandParameter = {
        machine_variable_id: 'var-123',
        value: 'test-value',
        allow_override: false,
        label: 'Test Parameter'
      };

      expect(parameter.allow_override).toBe(false);
    });
  });

  describe('MachineCommandResponse', () => {
    it('should have correct structure', () => {
      const response: MachineCommandResponse = {
        id: 'cmd-123',
        name: 'Test Command',
        parameters: [
          {
            value: 'test-value',
            machine_variable_id: 'var-123',
            allow_override: true
          }
        ],
        machine_variables: []
      };

      expect(response.id).toBe('cmd-123');
      expect(response.name).toBe('Test Command');
      expect(response.parameters).toHaveLength(1);
      expect(response.parameters[0].value).toBe('test-value');
      expect(response.parameters[0].machine_variable_id).toBe('var-123');
      expect(response.parameters[0].allow_override).toBe(true);
      expect(Array.isArray(response.machine_variables)).toBe(true);
    });

    it('should allow empty parameters array', () => {
      const response: MachineCommandResponse = {
        id: 'cmd-123',
        name: 'Test Command',
        parameters: [],
        machine_variables: []
      };

      expect(response.parameters).toHaveLength(0);
    });

    it('should allow unknown machine_variables', () => {
      const response: MachineCommandResponse = {
        id: 'cmd-123',
        name: 'Test Command',
        parameters: [],
        machine_variables: [
          { id: 'var-1', name: 'Variable 1' },
          { id: 'var-2', name: 'Variable 2' }
        ]
      };

      expect(response.machine_variables).toHaveLength(2);
    });
  });

  describe('CreateMachineCommandRequest', () => {
    it('should have correct structure', () => {
      const request: CreateMachineCommandRequest = {
        machine_command: {
          name: 'Test Command',
          parameters: [
            {
              machine_variable_id: 'var-123',
              value: 'test-value',
              allow_override: true,
              label: 'Test Parameter'
            }
          ]
        }
      };

      expect(request.machine_command.name).toBe('Test Command');
      expect(request.machine_command.parameters).toHaveLength(1);
      expect(request.machine_command.parameters[0].machine_variable_id).toBe('var-123');
    });

    it('should allow empty parameters array', () => {
      const request: CreateMachineCommandRequest = {
        machine_command: {
          name: 'Test Command',
          parameters: []
        }
      };

      expect(request.machine_command.parameters).toHaveLength(0);
    });
  });

  describe('UpdateMachineCommandRequest', () => {
    it('should have correct structure with all fields', () => {
      const request: UpdateMachineCommandRequest = {
        machine_command: {
          name: 'Updated Command',
          parameters: [
            {
              machine_variable_id: 'var-123',
              value: 'updated-value',
              allow_override: false,
              label: 'Updated Parameter'
            }
          ]
        }
      };

      expect(request.machine_command.name).toBe('Updated Command');
      expect(request.machine_command.parameters).toHaveLength(1);
    });

    it('should allow optional name field', () => {
      const request: UpdateMachineCommandRequest = {
        machine_command: {
          parameters: [
            {
              machine_variable_id: 'var-123',
              value: 'test-value',
              allow_override: true,
              label: 'Test Parameter'
            }
          ]
        }
      };

      expect(request.machine_command.name).toBeUndefined();
      expect(request.machine_command.parameters).toHaveLength(1);
    });

    it('should allow optional parameters field', () => {
      const request: UpdateMachineCommandRequest = {
        machine_command: {
          name: 'Updated Command'
        }
      };

      expect(request.machine_command.name).toBe('Updated Command');
      expect(request.machine_command.parameters).toBeUndefined();
    });

    it('should allow empty machine_command object', () => {
      const request: UpdateMachineCommandRequest = {
        machine_command: {}
      };

      expect(request.machine_command.name).toBeUndefined();
      expect(request.machine_command.parameters).toBeUndefined();
    });
  });

  describe('MachineCommandCreateInput', () => {
    it('should have correct structure', () => {
      const input: MachineCommandCreateInput = {
        machine_firmware_id: 'firmware-123',
        name: 'Test Command',
        parameters: [
          {
            machine_variable_id: 'var-123',
            value: 'test-value',
            allow_override: true,
            label: 'Test Parameter'
          }
        ]
      };

      expect(input.machine_firmware_id).toBe('firmware-123');
      expect(input.name).toBe('Test Command');
      expect(input.parameters).toHaveLength(1);
    });
  });

  describe('MachineCommandUpdateInput', () => {
    it('should have correct structure with all fields', () => {
      const input: MachineCommandUpdateInput = {
        machine_command_id: 'cmd-123',
        name: 'Updated Command',
        parameters: [
          {
            machine_variable_id: 'var-123',
            value: 'updated-value',
            allow_override: false,
            label: 'Updated Parameter'
          }
        ]
      };

      expect(input.machine_command_id).toBe('cmd-123');
      expect(input.name).toBe('Updated Command');
      expect(input.parameters).toHaveLength(1);
    });

    it('should allow optional name field', () => {
      const input: MachineCommandUpdateInput = {
        machine_command_id: 'cmd-123',
        parameters: [
          {
            machine_variable_id: 'var-123',
            value: 'test-value',
            allow_override: true,
            label: 'Test Parameter'
          }
        ]
      };

      expect(input.machine_command_id).toBe('cmd-123');
      expect(input.name).toBeUndefined();
      expect(input.parameters).toHaveLength(1);
    });

    it('should allow optional parameters field', () => {
      const input: MachineCommandUpdateInput = {
        machine_command_id: 'cmd-123',
        name: 'Updated Command'
      };

      expect(input.machine_command_id).toBe('cmd-123');
      expect(input.name).toBe('Updated Command');
      expect(input.parameters).toBeUndefined();
    });
  });

  describe('MachineCommandDeleteInput', () => {
    it('should have correct structure', () => {
      const input: MachineCommandDeleteInput = {
        machine_command_id: 'cmd-123'
      };

      expect(input.machine_command_id).toBe('cmd-123');
    });
  });

  describe('type compatibility', () => {
    it('should allow MachineCommandParameter in CreateMachineCommandRequest', () => {
      const parameter: MachineCommandParameter = {
        machine_variable_id: 'var-123',
        value: 'test-value',
        allow_override: true,
        label: 'Test Parameter'
      };

      const request: CreateMachineCommandRequest = {
        machine_command: {
          name: 'Test Command',
          parameters: [parameter]
        }
      };

      expect(request.machine_command.parameters[0]).toEqual(parameter);
    });

    it('should allow MachineCommandParameter in UpdateMachineCommandRequest', () => {
      const parameter: MachineCommandParameter = {
        machine_variable_id: 'var-123',
        value: 'test-value',
        allow_override: true,
        label: 'Test Parameter'
      };

      const request: UpdateMachineCommandRequest = {
        machine_command: {
          parameters: [parameter]
        }
      };

      expect(request.machine_command.parameters?.[0]).toEqual(parameter);
    });

    it('should allow MachineCommandParameter in input types', () => {
      const parameter: MachineCommandParameter = {
        machine_variable_id: 'var-123',
        value: 'test-value',
        allow_override: true,
        label: 'Test Parameter'
      };

      const createInput: MachineCommandCreateInput = {
        machine_firmware_id: 'firmware-123',
        name: 'Test Command',
        parameters: [parameter]
      };

      const updateInput: MachineCommandUpdateInput = {
        machine_command_id: 'cmd-123',
        parameters: [parameter]
      };

      expect(createInput.parameters[0]).toEqual(parameter);
      expect(updateInput.parameters?.[0]).toEqual(parameter);
    });
  });
});