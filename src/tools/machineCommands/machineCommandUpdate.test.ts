import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { getMachineCommandUpdateTool, MachineCommandUpdateSchema } from './machineCommandUpdate.js';
import { THINGS5_BASE_URL } from '../../config.js';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as any;

describe('machineCommandUpdate', () => {
  const mockAuthToken = 'test-auth-token';
  const mockCommandId = 'cmd-123';
  const mockCommandName = 'Updated Command';
  const mockParameters = [
    {
      machine_variable_id: 'var-1',
      value: 'updated-value',
      allow_override: false,
      label: 'Updated Parameter'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('input validation', () => {
    it('should validate required machine_command_id parameter', () => {
      const result = MachineCommandUpdateSchema.safeParse({
        name: mockCommandName,
        parameters: mockParameters
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('machine_command_id');
      }
    });

    it('should accept machine_command_id only', () => {
      const result = MachineCommandUpdateSchema.safeParse({
        machine_command_id: mockCommandId
      });

      expect(result.success).toBe(true);
    });

    it('should accept optional name parameter', () => {
      const result = MachineCommandUpdateSchema.safeParse({
        machine_command_id: mockCommandId,
        name: mockCommandName
      });

      expect(result.success).toBe(true);
    });

    it('should accept optional parameters array', () => {
      const result = MachineCommandUpdateSchema.safeParse({
        machine_command_id: mockCommandId,
        parameters: mockParameters
      });

      expect(result.success).toBe(true);
    });

    it('should validate parameter structure when provided', () => {
      const result = MachineCommandUpdateSchema.safeParse({
        machine_command_id: mockCommandId,
        parameters: [
          {
            machine_variable_id: 'var-1',
            value: 'test-value',
            // Missing allow_override and label
          }
        ]
      });

      expect(result.success).toBe(false);
    });

    it('should accept all valid fields', () => {
      const result = MachineCommandUpdateSchema.safeParse({
        machine_command_id: mockCommandId,
        name: mockCommandName,
        parameters: mockParameters
      });

      expect(result.success).toBe(true);
    });
  });

  describe('API integration', () => {
    it('should make correct API call with name update only', async () => {
      const mockResponse = {
        data: {
          data: {
            id: mockCommandId,
            name: mockCommandName,
            parameters: []
          }
        }
      };

      mockedAxios.patch.mockResolvedValueOnce(mockResponse);

      const tool = getMachineCommandUpdateTool(mockAuthToken);
      const result = await (tool.handler as any)({
        machine_command_id: mockCommandId,
        name: mockCommandName
      });

      expect(mockedAxios.patch).toHaveBeenCalledWith(
        `${THINGS5_BASE_URL}/machine_commands/${mockCommandId}`,
        {
          machine_command: {
            name: mockCommandName
          }
        },
        {
          headers: {
            Authorization: `Bearer ${mockAuthToken}`
          }
        }
      );

      expect(result.content[0].text).toContain('✅ Machine command updated');
      expect(result.structuredContent.command.id).toBe(mockCommandId);
    });

    it('should make correct API call with parameters update only', async () => {
      const mockResponse = {
        data: {
          data: {
            id: mockCommandId,
            name: 'Original Name',
            parameters: mockParameters
          }
        }
      };

      mockedAxios.patch.mockResolvedValueOnce(mockResponse);

      const tool = getMachineCommandUpdateTool(mockAuthToken);
      await (tool.handler as any)({
        machine_command_id: mockCommandId,
        parameters: mockParameters
      });

      expect(mockedAxios.patch).toHaveBeenCalledWith(
        `${THINGS5_BASE_URL}/machine_commands/${mockCommandId}`,
        {
          machine_command: {
            parameters: mockParameters
          }
        },
        expect.any(Object)
      );
    });

    it('should make correct API call with both name and parameters', async () => {
      const mockResponse = {
        data: {
          data: {
            id: mockCommandId,
            name: mockCommandName,
            parameters: mockParameters
          }
        }
      };

      mockedAxios.patch.mockResolvedValueOnce(mockResponse);

      const tool = getMachineCommandUpdateTool(mockAuthToken);
      await (tool.handler as any)({
        machine_command_id: mockCommandId,
        name: mockCommandName,
        parameters: mockParameters
      });

      expect(mockedAxios.patch).toHaveBeenCalledWith(
        `${THINGS5_BASE_URL}/machine_commands/${mockCommandId}`,
        {
          machine_command: {
            name: mockCommandName,
            parameters: mockParameters
          }
        },
        expect.any(Object)
      );
    });

    it('should make API call without authentication when no token provided', async () => {
      const mockResponse = {
        data: {
          data: {
            id: mockCommandId,
            name: mockCommandName,
            parameters: mockParameters
          }
        }
      };

      mockedAxios.patch.mockResolvedValueOnce(mockResponse);

      const tool = getMachineCommandUpdateTool('');
      await (tool.handler as any)({
        machine_command_id: mockCommandId,
        name: mockCommandName
      });

      expect(mockedAxios.patch).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        {
          headers: undefined
        }
      );
    });

    it('should properly encode command ID in URL', async () => {
      const specialId = 'cmd/with/slashes';
      const mockResponse = {
        data: {
          data: {
            id: specialId,
            name: mockCommandName,
            parameters: mockParameters
          }
        }
      };

      mockedAxios.patch.mockResolvedValueOnce(mockResponse);

      const tool = getMachineCommandUpdateTool(mockAuthToken);
      await (tool.handler as any)({
        machine_command_id: specialId,
        name: mockCommandName
      });

      expect(mockedAxios.patch).toHaveBeenCalledWith(
        `${THINGS5_BASE_URL}/machine_commands/${encodeURIComponent(specialId)}`,
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('error handling', () => {
    it('should handle invalid input arguments', async () => {
      const tool = getMachineCommandUpdateTool(mockAuthToken);

      await expect((tool.handler as any)({
        // Missing required machine_command_id
        name: mockCommandName
      })).rejects.toThrow('Invalid arguments for machine_command_update tool');
    });

    it('should handle missing update fields', async () => {
      const tool = getMachineCommandUpdateTool(mockAuthToken);

      await expect((tool.handler as any)({
        machine_command_id: mockCommandId
        // No name or parameters provided
      })).rejects.toThrow('At least one field (name or parameters) must be provided for update');
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      mockedAxios.patch.mockRejectedValueOnce(networkError);

      const tool = getMachineCommandUpdateTool(mockAuthToken);
      const result = await (tool.handler as any)({
        machine_command_id: mockCommandId,
        name: mockCommandName
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('❌ Error updating machine command');
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
      mockedAxios.patch.mockRejectedValueOnce(authError);

      const tool = getMachineCommandUpdateTool(mockAuthToken);
      const result = await (tool.handler as any)({
        machine_command_id: mockCommandId,
        name: mockCommandName
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('❌ Error updating machine command');
      expect(result.content[0].text).toContain('Unauthorized');
      expect(result.structuredContent.status).toBe(401);
      expect(result.structuredContent.data.message).toBe('Unauthorized');
    });

    it('should handle not found errors', async () => {
      const notFoundError = {
        response: {
          status: 404,
          data: {
            message: 'Machine command not found'
          }
        }
      };
      mockedAxios.patch.mockRejectedValueOnce(notFoundError);

      const tool = getMachineCommandUpdateTool(mockAuthToken);
      const result = await (tool.handler as any)({
        machine_command_id: mockCommandId,
        name: mockCommandName
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.status).toBe(404);
      expect(result.structuredContent.data.message).toBe('Machine command not found');
    });

    it('should handle validation errors from API', async () => {
      const validationError = {
        response: {
          status: 422,
          data: {
            message: 'Validation failed',
            errors: {
              parameters: ['invalid format']
            }
          }
        }
      };
      mockedAxios.patch.mockRejectedValueOnce(validationError);

      const tool = getMachineCommandUpdateTool(mockAuthToken);
      const result = await (tool.handler as any)({
        machine_command_id: mockCommandId,
        name: mockCommandName
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.status).toBe(422);
      expect(result.structuredContent.data.errors).toBeDefined();
    });
  });

  describe('response formatting', () => {
    it('should format success response correctly', async () => {
      const mockCommand = {
        id: mockCommandId,
        name: mockCommandName,
        parameters: mockParameters
      };

      const mockResponse = {
        data: {
          data: mockCommand
        }
      };

      mockedAxios.patch.mockResolvedValueOnce(mockResponse);

      const tool = getMachineCommandUpdateTool(mockAuthToken);
      const result = await (tool.handler as any)({
        machine_command_id: mockCommandId,
        name: mockCommandName,
        parameters: mockParameters
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('✅ Machine command updated');
      expect(result.content[0].text).toContain(mockCommandId);
      expect(result.content[0].text).toContain(mockCommandName);
      expect(result.content[0].text).toContain('Parameters: 1');

      expect(result.structuredContent.command).toEqual(mockCommand);
      expect(result.isError).toBeUndefined();
    });

    it('should handle missing command data in response', async () => {
      const mockResponse = {
        data: {}
      };

      mockedAxios.patch.mockResolvedValueOnce(mockResponse);

      const tool = getMachineCommandUpdateTool(mockAuthToken);
      const result = await (tool.handler as any)({
        machine_command_id: mockCommandId,
        name: mockCommandName
      });

      expect(result.content[0].text).toContain('✅ Machine command updated');
      expect(result.content[0].text).toContain('Parameters: 0');
      expect(result.structuredContent.command).toBeUndefined();
    });
  });

  describe('partial updates', () => {
    it('should handle name-only updates', async () => {
      const mockResponse = {
        data: {
          data: {
            id: mockCommandId,
            name: mockCommandName,
            parameters: []
          }
        }
      };

      mockedAxios.patch.mockResolvedValueOnce(mockResponse);

      const tool = getMachineCommandUpdateTool(mockAuthToken);
      const result = await (tool.handler as any)({
        machine_command_id: mockCommandId,
        name: mockCommandName
      });

      expect(mockedAxios.patch).toHaveBeenCalledWith(
        expect.any(String),
        {
          machine_command: {
            name: mockCommandName
          }
        },
        expect.any(Object)
      );

      expect(result.content[0].text).toContain('✅ Machine command updated');
    });

    it('should handle parameters-only updates', async () => {
      const mockResponse = {
        data: {
          data: {
            id: mockCommandId,
            name: 'Original Name',
            parameters: mockParameters
          }
        }
      };

      mockedAxios.patch.mockResolvedValueOnce(mockResponse);

      const tool = getMachineCommandUpdateTool(mockAuthToken);
      const result = await (tool.handler as any)({
        machine_command_id: mockCommandId,
        parameters: mockParameters
      });

      expect(mockedAxios.patch).toHaveBeenCalledWith(
        expect.any(String),
        {
          machine_command: {
            parameters: mockParameters
          }
        },
        expect.any(Object)
      );

      expect(result.content[0].text).toContain('✅ Machine command updated');
    });
  });
});