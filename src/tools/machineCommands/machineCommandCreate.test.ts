import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { getMachineCommandCreateTool, MachineCommandCreateSchema } from './machineCommandCreate.js';
import { THINGS5_BASE_URL } from '../../config.js';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as any;

describe('machineCommandCreate', () => {
  const mockAuthToken = 'test-auth-token';
  const mockMachineFirmwareId = 'firmware-123';
  const mockCommandName = 'Test Command';
  const mockParameters = [
    {
      machine_variable_id: 'var-1',
      value: 'test-value',
      allow_override: true,
      label: 'Test Parameter'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('input validation', () => {
    it('should validate required machine_firmware_id parameter', () => {
      const result = MachineCommandCreateSchema.safeParse({
        name: mockCommandName,
        parameters: mockParameters
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('machine_firmware_id');
      }
    });

    it('should validate required name parameter', () => {
      const result = MachineCommandCreateSchema.safeParse({
        machine_firmware_id: mockMachineFirmwareId,
        parameters: mockParameters
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('name');
      }
    });

    it('should validate required parameters array', () => {
      const result = MachineCommandCreateSchema.safeParse({
        machine_firmware_id: mockMachineFirmwareId,
        name: mockCommandName
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('parameters');
      }
    });

    it('should validate parameter structure', () => {
      const result = MachineCommandCreateSchema.safeParse({
        machine_firmware_id: mockMachineFirmwareId,
        name: mockCommandName,
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

    it('should accept valid input', () => {
      const result = MachineCommandCreateSchema.safeParse({
        machine_firmware_id: mockMachineFirmwareId,
        name: mockCommandName,
        parameters: mockParameters
      });

      expect(result.success).toBe(true);
    });
  });

  describe('API integration', () => {
    it('should make correct API call with authentication', async () => {
      const mockResponse = {
        data: {
          data: {
            id: 'cmd-123',
            name: mockCommandName,
            parameters: mockParameters
          }
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const tool = getMachineCommandCreateTool(mockAuthToken);
      const result = await (tool.handler as any)({
        machine_firmware_id: mockMachineFirmwareId,
        name: mockCommandName,
        parameters: mockParameters
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${THINGS5_BASE_URL}/machine_firmwares/${mockMachineFirmwareId}/machine_commands`,
        {
          machine_command: {
            name: mockCommandName,
            parameters: mockParameters
          }
        },
        {
          headers: {
            Authorization: `Bearer ${mockAuthToken}`
          }
        }
      );

      expect(result.content[0].text).toContain('✅ Machine command created');
      expect(result.structuredContent.command.id).toBe('cmd-123');
    });

    it('should make API call without authentication when no token provided', async () => {
      const mockResponse = {
        data: {
          data: {
            id: 'cmd-123',
            name: mockCommandName,
            parameters: mockParameters
          }
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const tool = getMachineCommandCreateTool('');
      await (tool.handler as any)({
        machine_firmware_id: mockMachineFirmwareId,
        name: mockCommandName,
        parameters: mockParameters
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${THINGS5_BASE_URL}/machine_firmwares/${mockMachineFirmwareId}/machine_commands`,
        {
          machine_command: {
            name: mockCommandName,
            parameters: mockParameters
          }
        },
        {
          headers: undefined
        }
      );
    });

    it('should properly encode machine firmware ID in URL', async () => {
      const specialId = 'firmware/with/slashes';
      const mockResponse = {
        data: {
          data: {
            id: 'cmd-123',
            name: mockCommandName,
            parameters: mockParameters
          }
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const tool = getMachineCommandCreateTool(mockAuthToken);
      await (tool.handler as any)({
        machine_firmware_id: specialId,
        name: mockCommandName,
        parameters: mockParameters
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${THINGS5_BASE_URL}/machine_firmwares/${encodeURIComponent(specialId)}/machine_commands`,
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('error handling', () => {
    it('should handle invalid input arguments', async () => {
      const tool = getMachineCommandCreateTool(mockAuthToken);

      await expect((tool.handler as any)({
        machine_firmware_id: mockMachineFirmwareId,
        // Missing required fields
      })).rejects.toThrow('Invalid arguments for machine_command_create tool');
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      mockedAxios.post.mockRejectedValueOnce(networkError);

      const tool = getMachineCommandCreateTool(mockAuthToken);
      const result = await (tool.handler as any)({
        machine_firmware_id: mockMachineFirmwareId,
        name: mockCommandName,
        parameters: mockParameters
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('❌ Error creating machine command');
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

      const tool = getMachineCommandCreateTool(mockAuthToken);
      const result = await (tool.handler as any)({
        machine_firmware_id: mockMachineFirmwareId,
        name: mockCommandName,
        parameters: mockParameters
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('❌ Error creating machine command');
      expect(result.content[0].text).toContain('Unauthorized');
      expect(result.structuredContent.status).toBe(401);
      expect(result.structuredContent.data.message).toBe('Unauthorized');
    });

    it('should handle server errors', async () => {
      const serverError = {
        response: {
          status: 500,
          data: {
            message: 'Internal server error'
          }
        }
      };
      mockedAxios.post.mockRejectedValueOnce(serverError);

      const tool = getMachineCommandCreateTool(mockAuthToken);
      const result = await (tool.handler as any)({
        machine_firmware_id: mockMachineFirmwareId,
        name: mockCommandName,
        parameters: mockParameters
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.status).toBe(500);
      expect(result.structuredContent.data.message).toBe('Internal server error');
    });

    it('should handle validation errors from API', async () => {
      const validationError = {
        response: {
          status: 422,
          data: {
            message: 'Validation failed',
            errors: {
              name: ['is required']
            }
          }
        }
      };
      mockedAxios.post.mockRejectedValueOnce(validationError);

      const tool = getMachineCommandCreateTool(mockAuthToken);
      const result = await (tool.handler as any)({
        machine_firmware_id: mockMachineFirmwareId,
        name: mockCommandName,
        parameters: mockParameters
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.status).toBe(422);
      expect(result.structuredContent.data.errors).toBeDefined();
    });
  });

  describe('response formatting', () => {
    it('should format success response correctly', async () => {
      const mockCommand = {
        id: 'cmd-123',
        name: mockCommandName,
        parameters: mockParameters
      };

      const mockResponse = {
        data: {
          data: mockCommand
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const tool = getMachineCommandCreateTool(mockAuthToken);
      const result = await (tool.handler as any)({
        machine_firmware_id: mockMachineFirmwareId,
        name: mockCommandName,
        parameters: mockParameters
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('✅ Machine command created');
      expect(result.content[0].text).toContain(mockMachineFirmwareId);
      expect(result.content[0].text).toContain('cmd-123');
      expect(result.content[0].text).toContain(mockCommandName);
      expect(result.content[0].text).toContain('Parameters: 1');

      expect(result.structuredContent.command).toEqual(mockCommand);
      expect(result.isError).toBeUndefined();
    });

    it('should handle missing command data in response', async () => {
      const mockResponse = {
        data: {}
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const tool = getMachineCommandCreateTool(mockAuthToken);
      const result = await (tool.handler as any)({
        machine_firmware_id: mockMachineFirmwareId,
        name: mockCommandName,
        parameters: mockParameters
      });

      expect(result.content[0].text).toContain('✅ Machine command created');
      expect(result.content[0].text).toContain('Parameters: 0');
      expect(result.structuredContent.command).toBeUndefined();
    });
  });
});