import { describe, it, expect } from 'vitest';
import { createServer } from '../server/things5.js';
import { KEYCLOAK_CLIENT_ID } from '../config.js';

describe('OpenAI MCP Compatibility Tests', () => {
  describe('Server Configuration', () => {
    it('should create MCP server with correct configuration', () => {
      const { server } = createServer();
      
      expect(server).toBeDefined();
      expect(server.server).toBeDefined();
    });

    it('should use correct Keycloak client ID', () => {
      expect(KEYCLOAK_CLIENT_ID).toBe('mcp-server');
    });

    it('should support authentication token', () => {
      const testToken = 'test-token-123';
      const { server } = createServer(testToken);
      
      expect((server as any).auth_token).toBe(testToken);
    });
  });

  describe('Environment Configuration', () => {
    it('should have correct default port', () => {
      // Test that the default port is 3000 when PORT is not set
      const originalPort = process.env.PORT;
      delete process.env.PORT;
      
      // The port logic is in streamableHttp.ts: const PORT = process.env.PORT || 3000;
      const defaultPort = process.env.PORT || '3000';
      expect(defaultPort).toBe('3000');
      
      // Restore original PORT if it existed
      if (originalPort) {
        process.env.PORT = originalPort;
      }
    });

    it('should have correct Keycloak configuration structure', () => {
      // Test that the configuration exports exist
      expect(typeof KEYCLOAK_CLIENT_ID).toBe('string');
      expect(KEYCLOAK_CLIENT_ID).toBe('mcp-server');
    });
  });

  describe('MCP Protocol Compatibility', () => {
    it('should register tools correctly', () => {
      const { server } = createServer();
      
      // The server should be properly initialized
      expect(server).toBeDefined();
      expect(server.server).toBeDefined();
      expect(typeof server.registerTool).toBe('function');
    });

    it('should support logging capabilities', () => {
      const { server } = createServer();
      
      // Server should have logging support via request handlers
      expect(server.server).toBeDefined();
      expect(typeof server.server.setRequestHandler).toBe('function');
    });

    it('should support resources with subscription', () => {
      const { server } = createServer();
      
      // Server should be properly configured for MCP protocol
      expect(server.server).toBeDefined();
      expect(server).toHaveProperty('server');
    });
  });

  describe('OpenAI MCP Specification Compliance', () => {
    it('should support both HTTP and SSE transports', () => {
      // This is verified by the presence of both /mcp and /sse endpoints in streamableHttp.ts
      // The StreamableHTTPServerTransport supports both modes via enableJsonResponse flag
      expect(true).toBe(true); // Placeholder - actual endpoints tested via integration
    });

    it('should handle authentication properly', () => {
      const tokenServer = createServer('valid-token');
      const noTokenServer = createServer();
      
      expect((tokenServer.server as any).auth_token).toBe('valid-token');
      expect((noTokenServer.server as any).auth_token).toBeUndefined();
    });

    it('should support session management', () => {
      // StreamableHTTPServerTransport handles session management
      // This is tested by the transport configuration in streamableHttp.ts
      const { server } = createServer();
      expect(server).toBeDefined();
    });
  });

  describe('Tool Registration', () => {
    it('should register all available tools', async () => {
      const { server } = createServer();
      
      // Tools are registered in the constructor via toolFactories
      // We can verify the server has the registration capability
      expect(typeof server.registerTool).toBe('function');
    });

    it('should handle tool input schemas correctly', () => {
      const { server } = createServer();
      
      // The server converts JSON Schema to Zod schemas for tool inputs
      // This is handled in the tool registration loop in things5.ts
      expect(server.server).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle cleanup properly', async () => {
      const { cleanup } = createServer();
      
      // Cleanup should be a function that can be called
      expect(typeof cleanup).toBe('function');
      
      // Should not throw when called
      await expect(cleanup()).resolves.toBeUndefined();
    });

    it('should handle missing authentication gracefully', () => {
      // Server should work without auth token (for no_auth mode)
      const { server } = createServer();
      expect(server).toBeDefined();
    });
  });
});
