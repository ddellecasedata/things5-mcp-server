import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { getMachineCommandExecuteTool, MachineCommandExecuteSchema } from './machineCommandExecute.js';
import { THINGS5_BASE_URL } from '../../config.js';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as any;

describe('machineCommandExecute', () => {
  const mockAuthToken = 'test-auth-token';
  const mockDeviceId = 'device-123';
  const mockMachineCommandId = 'command-456';
  const mockOverrides = {
    'Delay Thermostat Alarm': '11',
    'Temperature Setpoint': '25.5'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('input validation', () => {
    it('should validate required device_id parameter', () => {
      const result = MachineCommandExecuteSchema.safeParse({
        machine_command_id: mockMachineCommandId
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('device_id');
      }
    });

    it('should validate required machine_command_id parameter', () => {
      const result = MachineCommandExecuteSchema.safeParse({
        device_id: mockDeviceId
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('machine_command_id');
      }
    });

    it('should accept valid input without overrides', () => {
      const result = MachineCommandExecuteSchema.safeParse({
        device_id: mockDeviceId,
        machine_command_id: mockMachineCommandId
      });

      expect(result.success).toBe(true);
    });

    it('should accept valid input with overrides', () => {
      const result = MachineCommandExecuteSchema.safeParse({
        device_id: mockDeviceId,
        machine_command_id: mockMachineCommandId,
        overrides: mockOverrides
      });

      expect(result.success).toBe(true);
    });

    it('should validate overrides as record of strings', () => {
      const result = MachineCommandExecuteSchema.safeParse({
        device_id: mockDeviceId,
        machine_command_id: mockMachineCommandId,
        overrides: {
          'param1': 123 // Should be string
        }
      });

      expect(result.success).toBe(false);
    });
  });

  describe('API integration', () => {
    it('should make correct API call with authentication and overrides', async () => {
      const mockResponse = {
        data: {
          data: {
            execution_id: 'exec-789',
            status: 'completed',
            result: 'success'
          }
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const tool = getMachineCommandExecuteTool(mockAuthToken);
      const result = await (tool.handler as any)({
        device_id: mockDeviceId,
        machine_command_id: mockMachineCommandId,
        overrides: mockOverrides
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${THINGS5_BASE_URL}/devices/${mockDeviceId}/machine_commands/${mockMachineCommandId}/execute`,
        {
          overrides: mockOverrides
        },
        {
          headers: {
            Authorization: `Bearer ${mockAuthToken}`
          }
        }
      );

      expect(result.content[0].text).toContain('✅ Machine command executed successfully');
      expect(result.content[0].text).toContain(mockDeviceId);
      expect(result.content[0].text).toContain(mockMachineCommandId);
      expect(result.structuredContent.result.execution_id).toBe('exec-789');
    });

    it('should make API call without overrides', async () => {
      const mockResponse = {
        data: {
          data: {
            execution_id: 'exec-789',
            status: 'completed'
          }
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const tool = getMachineCommandExecuteTool(mockAuthToken);
      await (tool.handler as any)({
        device_id: mockDeviceId,
        machine_command_id: mockMachineCommandId
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${THINGS5_BASE_URL}/devices/${mockDeviceId}/machine_commands/${mockMachineCommandId}/execute`,
        {},
        {
          headers: {
            Authorization: `Bearer ${mockAuthToken}`
          }
        }
      );
    });

    it('should make API call without authentication when no token provided', async () => {
      const mockResponse = {
        data: {
          data: {
            execution_id: 'exec-789'
          }
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const tool = getMachineCommandExecuteTool('');
      await (tool.handler as any)({
        device_id: mockDeviceId,
        machine_command_id: mockMachineCommandId
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${THINGS5_BASE_URL}/devices/${mockDeviceId}/machine_commands/${mockMachineCommandId}/execute`,
        {},
        {
          headers: undefined
        }
      );
    });

    it('should properly encode device and command IDs in URL', async () => {
      const specialDeviceId = 'device/with/slashes';
      const specialCommandId = 'command@with#special!chars';
      const mockResponse = {
        data: {
          data: {
            execution_id: 'exec-789'
          }
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const tool = getMachineCommandExecuteTool(mockAuthToken);
      await (tool.handler as any)({
        device_id: specialDeviceId,
        machine_command_id: specialCommandId
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${THINGS5_BASE_URL}/devices/${encodeURIComponent(specialDeviceId)}/machine_commands/${encodeURIComponent(specialCommandId)}/execute`,
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('error handling', () => {
    it('should handle invalid input arguments', async () => {
      const tool = getMachineCommandExecuteTool(mockAuthToken);

      await expect((tool.handler as any)({
        device_id: mockDeviceId,
        // Missing required machine_command_id
      })).rejects.toThrow('Invalid arguments for machine_command_execute tool');
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      mockedAxios.post.mockRejectedValueOnce(networkError);

      const tool = getMachineCommandExecuteTool(mockAuthToken);
      const result = await (tool.handler as any)({
        device_id: mockDeviceId,
        machine_command_id: mockMachineCommandId
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('❌ Error executing machine command');
      expect(result.content[0].text).toContain('Network error');
      expect(result.structuredContent.error).toBe(true);
      expect(result.structuredContent.message).toContain('Network error');
    });

    it('should handle authentication errors', async () => {
      const authError = {
        response: {
          status: 401,
          data: {
            message: 'Unauthorized'
          }
        }
      };
      mockedAxios.post.mockRejectedValueOnce(authError);

      const tool = getMachineCommandExecuteTool(mockAuthToken);
      const result = await (tool.handler as any)({
        device_id: mockDeviceId,
        machine_command_id: mockMachineCommandId
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('❌ Error executing machine command');
      expect(result.content[0].text).toContain('Unauthorized');
      expect(result.structuredContent.status).toBe(401);
      expect(result.structuredContent.data.message).toBe('Unauthorized');
    });

    it('should handle device not found errors', async () => {
      const notFoundError = {
        response: {
          status: 404,
          data: {
            message: 'Device not found'
          }
        }
      };
      mockedAxios.post.mockRejectedValueOnce(notFoundError);

      const tool = getMachineCommandExecuteTool(mockAuthToken);
      const result = await (tool.handler as any)({
        device_id: mockDeviceId,
        machine_command_id: mockMachineCommandId
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.status).toBe(404);
      expect(result.structuredContent.data.message).toBe('Device not found');
    });

    it('should handle command execution errors', async () => {
      const executionError = {
        response: {
          status: 422,
          data: {
            message: 'Command execution failed',
            errors: {
              overrides: ['Invalid parameter value']
            }
          }
        }
      };
      mockedAxios.post.mockRejectedValueOnce(executionError);

      const tool = getMachineCommandExecuteTool(mockAuthToken);
      const result = await (tool.handler as any)({
        device_id: mockDeviceId,
        machine_command_id: mockMachineCommandId,
        overrides: mockOverrides
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.status).toBe(422);
      expect(result.structuredContent.data.errors).toBeDefined();
    });
  });

  describe('response formatting', () => {
    it('should format success response correctly with overrides', async () => {
      const mockResult = {
        execution_id: 'exec-789',
        status: 'completed',
        result: 'success'
      };

      const mockResponse = {
        data: {
          data: mockResult
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const tool = getMachineCommandExecuteTool(mockAuthToken);
      const result = await (tool.handler as any)({
        device_id: mockDeviceId,
        machine_command_id: mockMachineCommandId,
        overrides: mockOverrides
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('✅ Machine command executed successfully');
      expect(result.content[0].text).toContain(`Device: ${mockDeviceId}`);
      expect(result.content[0].text).toContain(`Command: ${mockMachineCommandId}`);
      expect(result.content[0].text).toContain('Overrides:');
      expect(result.content[0].text).toContain(JSON.stringify(mockOverrides));

      expect(result.structuredContent.result).toEqual(mockResult);
      expect(result.isError).toBeUndefined();
    });

    it('should format success response correctly without overrides', async () => {
      const mockResult = {
        execution_id: 'exec-789',
        status: 'completed'
      };

      const mockResponse = {
        data: {
          data: mockResult
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const tool = getMachineCommandExecuteTool(mockAuthToken);
      const result = await (tool.handler as any)({
        device_id: mockDeviceId,
        machine_command_id: mockMachineCommandId
      });

      expect(result.content[0].text).toContain('✅ Machine command executed successfully');
      expect(result.content[0].text).toContain(`Device: ${mockDeviceId}`);
      expect(result.content[0].text).toContain(`Command: ${mockMachineCommandId}`);
      expect(result.content[0].text).not.toContain('Overrides:');

      expect(result.structuredContent.result).toEqual(mockResult);
    });

    it('should handle missing result data in response', async () => {
      const mockResponse = {
        data: {}
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const tool = getMachineCommandExecuteTool(mockAuthToken);
      const result = await (tool.handler as any)({
        device_id: mockDeviceId,
        machine_command_id: mockMachineCommandId
      });

      expect(result.content[0].text).toContain('✅ Machine command executed successfully');
      expect(result.structuredContent.result).toBeUndefined();
    });
  });
});