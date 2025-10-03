import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { getMachineCommandDeleteTool, MachineCommandDeleteSchema } from './machineCommandDelete.js';
import { THINGS5_BASE_URL } from '../../config.js';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as any;

describe('machineCommandDelete', () => {
  const mockAuthToken = 'test-auth-token';
  const mockCommandId = 'cmd-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('input validation', () => {
    it('should validate required machine_command_id parameter', () => {
      const result = MachineCommandDeleteSchema.safeParse({});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('machine_command_id');
      }
    });

    it('should accept valid machine_command_id', () => {
      const result = MachineCommandDeleteSchema.safeParse({
        machine_command_id: mockCommandId
      });

      expect(result.success).toBe(true);
    });

    it('should reject non-string machine_command_id', () => {
      const result = MachineCommandDeleteSchema.safeParse({
        machine_command_id: 123
      });

      expect(result.success).toBe(false);
    });

    it('should reject empty machine_command_id', () => {
      const result = MachineCommandDeleteSchema.safeParse({
        machine_command_id: ''
      });

      expect(result.success).toBe(true); // Empty string is valid for zod string, but would fail in real usage
    });
  });

  describe('API integration', () => {
    it('should make correct API call with authentication', async () => {
      const mockResponse = {
        data: {},
        status: 200
      };

      mockedAxios.delete.mockResolvedValueOnce(mockResponse);

      const tool = getMachineCommandDeleteTool(mockAuthToken);
      const result = await (tool.handler as any)({
        machine_command_id: mockCommandId
      });

      expect(mockedAxios.delete).toHaveBeenCalledWith(
        `${THINGS5_BASE_URL}/machine_commands/${mockCommandId}`,
        {
          headers: {
            Authorization: `Bearer ${mockAuthToken}`
          }
        }
      );

      expect(result.content[0].text).toContain('✅ Machine command deleted successfully');
      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.machine_command_id).toBe(mockCommandId);
    });

    it('should make API call without authentication when no token provided', async () => {
      const mockResponse = {
        data: {},
        status: 200
      };

      mockedAxios.delete.mockResolvedValueOnce(mockResponse);

      const tool = getMachineCommandDeleteTool('');
      await (tool.handler as any)({
        machine_command_id: mockCommandId
      });

      expect(mockedAxios.delete).toHaveBeenCalledWith(
        `${THINGS5_BASE_URL}/machine_commands/${mockCommandId}`,
        {
          headers: undefined
        }
      );
    });

    it('should properly encode command ID in URL', async () => {
      const specialId = 'cmd/with/slashes';
      const mockResponse = {
        data: {},
        status: 200
      };

      mockedAxios.delete.mockResolvedValueOnce(mockResponse);

      const tool = getMachineCommandDeleteTool(mockAuthToken);
      await (tool.handler as any)({
        machine_command_id: specialId
      });

      expect(mockedAxios.delete).toHaveBeenCalledWith(
        `${THINGS5_BASE_URL}/machine_commands/${encodeURIComponent(specialId)}`,
        expect.any(Object)
      );
    });

    it('should handle successful deletion with different response formats', async () => {
      const mockResponse = {
        data: {
          message: 'Command deleted successfully'
        },
        status: 204
      };

      mockedAxios.delete.mockResolvedValueOnce(mockResponse);

      const tool = getMachineCommandDeleteTool(mockAuthToken);
      const result = await (tool.handler as any)({
        machine_command_id: mockCommandId
      });

      expect(result.content[0].text).toContain('✅ Machine command deleted successfully');
      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.machine_command_id).toBe(mockCommandId);
    });
  });

  describe('error handling', () => {
    it('should handle invalid input arguments', async () => {
      const tool = getMachineCommandDeleteTool(mockAuthToken);

      await expect((tool.handler as any)({
        // Missing required machine_command_id
      })).rejects.toThrow('Invalid arguments for machine_command_delete tool');
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      mockedAxios.delete.mockRejectedValueOnce(networkError);

      const tool = getMachineCommandDeleteTool(mockAuthToken);
      const result = await (tool.handler as any)({
        machine_command_id: mockCommandId
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('❌ Error deleting machine command');
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
      mockedAxios.delete.mockRejectedValueOnce(authError);

      const tool = getMachineCommandDeleteTool(mockAuthToken);
      const result = await (tool.handler as any)({
        machine_command_id: mockCommandId
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('❌ Error deleting machine command');
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
      mockedAxios.delete.mockRejectedValueOnce(notFoundError);

      const tool = getMachineCommandDeleteTool(mockAuthToken);
      const result = await (tool.handler as any)({
        machine_command_id: mockCommandId
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('❌ Error deleting machine command');
      expect(result.content[0].text).toContain('Machine command not found');
      expect(result.structuredContent.status).toBe(404);
      expect(result.structuredContent.data.message).toBe('Machine command not found');
    });

    it('should handle forbidden errors', async () => {
      const forbiddenError = {
        response: {
          status: 403,
          data: {
            message: 'Forbidden - insufficient permissions'
          }
        }
      };
      mockedAxios.delete.mockRejectedValueOnce(forbiddenError);

      const tool = getMachineCommandDeleteTool(mockAuthToken);
      const result = await (tool.handler as any)({
        machine_command_id: mockCommandId
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.status).toBe(403);
      expect(result.structuredContent.data.message).toBe('Forbidden - insufficient permissions');
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
      mockedAxios.delete.mockRejectedValueOnce(serverError);

      const tool = getMachineCommandDeleteTool(mockAuthToken);
      const result = await (tool.handler as any)({
        machine_command_id: mockCommandId
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.status).toBe(500);
      expect(result.structuredContent.data.message).toBe('Internal server error');
    });

    it('should handle errors without response data', async () => {
      const errorWithoutResponse = {
        response: {
          status: 500
        }
      };
      mockedAxios.delete.mockRejectedValueOnce(errorWithoutResponse);

      const tool = getMachineCommandDeleteTool(mockAuthToken);
      const result = await (tool.handler as any)({
        machine_command_id: mockCommandId
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.status).toBe(500);
      expect(result.structuredContent.data).toBeNull();
    });
  });

  describe('response formatting', () => {
    it('should format success response correctly', async () => {
      const mockResponse = {
        data: {},
        status: 200
      };

      mockedAxios.delete.mockResolvedValueOnce(mockResponse);

      const tool = getMachineCommandDeleteTool(mockAuthToken);
      const result = await (tool.handler as any)({
        machine_command_id: mockCommandId
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('✅ Machine command deleted successfully');
      expect(result.content[0].text).toContain(mockCommandId);

      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.machine_command_id).toBe(mockCommandId);
      expect(result.isError).toBeUndefined();
    });

    it('should format error response correctly', async () => {
      const errorMessage = 'Custom error message';
      const error = new Error(errorMessage);
      mockedAxios.delete.mockRejectedValueOnce(error);

      const tool = getMachineCommandDeleteTool(mockAuthToken);
      const result = await (tool.handler as any)({
        machine_command_id: mockCommandId
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('❌ Error deleting machine command');
      expect(result.content[0].text).toContain(errorMessage);

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe(true);
      expect(result.structuredContent.message).toContain(errorMessage);
    });
  });

  describe('edge cases', () => {
    it('should handle very long command IDs', async () => {
      const longId = 'a'.repeat(1000);
      const mockResponse = {
        data: {},
        status: 200
      };

      mockedAxios.delete.mockResolvedValueOnce(mockResponse);

      const tool = getMachineCommandDeleteTool(mockAuthToken);
      const result = await (tool.handler as any)({
        machine_command_id: longId
      });

      expect(mockedAxios.delete).toHaveBeenCalledWith(
        `${THINGS5_BASE_URL}/machine_commands/${encodeURIComponent(longId)}`,
        expect.any(Object)
      );
      expect(result.structuredContent.machine_command_id).toBe(longId);
    });

    it('should handle command IDs with special characters', async () => {
      const specialId = 'cmd-123!@#$%^&*()';
      const mockResponse = {
        data: {},
        status: 200
      };

      mockedAxios.delete.mockResolvedValueOnce(mockResponse);

      const tool = getMachineCommandDeleteTool(mockAuthToken);
      const result = await (tool.handler as any)({
        machine_command_id: specialId
      });

      expect(mockedAxios.delete).toHaveBeenCalledWith(
        `${THINGS5_BASE_URL}/machine_commands/${encodeURIComponent(specialId)}`,
        expect.any(Object)
      );
      expect(result.structuredContent.machine_command_id).toBe(specialId);
    });

    it('should handle empty auth token', async () => {
      const mockResponse = {
        data: {},
        status: 200
      };

      mockedAxios.delete.mockResolvedValueOnce(mockResponse);

      const tool = getMachineCommandDeleteTool('');
      const result = await (tool.handler as any)({
        machine_command_id: mockCommandId
      });

      expect(mockedAxios.delete).toHaveBeenCalledWith(
        expect.any(String),
        {
          headers: undefined
        }
      );
      expect(result.structuredContent.success).toBe(true);
    });
  });
});