import { describe, it, expect, beforeEach } from 'vitest';
import { createServer } from './things5.js';

describe('Things5 MCP Server', () => {
  let server: any;
  let cleanup: () => Promise<void>;

  beforeEach(() => {
    const result = createServer('test-token');
    server = result.server;
    cleanup = result.cleanup;
  });

  it('should create a server instance', () => {
    expect(server).toBeDefined();
    expect(server.connect).toBeDefined();
  });

  it('should have correct server info', () => {
    expect(server.serverInfo.name).toBe('things5-staging');
    expect(server.serverInfo.version).toBeDefined();
  });

  it('should have tools capability', () => {
    expect(server.capabilities.tools).toBeDefined();
  });

  it('should have resources capability with subscribe', () => {
    expect(server.capabilities.resources).toBeDefined();
    expect(server.capabilities.resources.subscribe).toBe(true);
  });

  it('should have logging capability', () => {
    expect(server.capabilities.logging).toBeDefined();
  });

  it('should cleanup without errors', async () => {
    await expect(cleanup()).resolves.not.toThrow();
  });
});
