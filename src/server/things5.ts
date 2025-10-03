import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LoggingLevel, SetLevelRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import * as toolFactories from "../tools/index.js";
import { createRequire } from "node:module";
import { z } from "zod";
const require = createRequire(import.meta.url);
const pkg = require("../../package.json");

export const createServer = (auth_token?: string) => {
  // 1. Instantiate the MCP Server using McpServer (high-level API)
  const server = new McpServer(
    {
      name: "things5-staging",
      version: (pkg as any).version,
    },
    {
      capabilities: {
        prompts: {},
        resources: { subscribe: true },
        tools: {},
        logging: {},
      },
    },
  );

  // Save token for handlers that need it
  (server as any).auth_token = auth_token;

  // 2. Register tools using the high-level registerTool API
  Object.values(toolFactories).forEach((factory: any) => {
    const tool = factory(auth_token);
    
    // Convert inputSchema to Zod schema if it's a JSON Schema object
    let zodSchema: any = {};
    if (tool.inputSchema && typeof tool.inputSchema === 'object') {
      // Create a Zod object schema from the JSON Schema properties
      const properties = tool.inputSchema.properties || {};
      const required = tool.inputSchema.required || [];
      
      Object.keys(properties).forEach(key => {
        const prop = properties[key];
        let fieldSchema: any;
        
        // Map JSON Schema types to Zod types
        switch (prop.type) {
          case 'string':
            fieldSchema = z.string();
            if (prop.description) fieldSchema = fieldSchema.describe(prop.description);
            break;
          case 'number':
            fieldSchema = z.number();
            if (prop.description) fieldSchema = fieldSchema.describe(prop.description);
            break;
          case 'boolean':
            fieldSchema = z.boolean();
            if (prop.description) fieldSchema = fieldSchema.describe(prop.description);
            break;
          case 'array':
            fieldSchema = z.array(z.any());
            if (prop.description) fieldSchema = fieldSchema.describe(prop.description);
            break;
          case 'object':
            fieldSchema = z.record(z.any());
            if (prop.description) fieldSchema = fieldSchema.describe(prop.description);
            break;
          default:
            fieldSchema = z.any();
        }
        
        // Make optional if not in required array
        if (!required.includes(key)) {
          fieldSchema = fieldSchema.optional();
        }
        
        zodSchema[key] = fieldSchema;
      });
    }

    // Register the tool with the high-level API
    server.registerTool(
      tool.name,
      {
        title: tool.name,
        description: tool.description || '',
        inputSchema: zodSchema
      },
      async (input: any) => {
        console.log('[MCP] call_tool input:', JSON.stringify(input));
        return await tool.handler(input, {} as any);
      }
    );
  });

  // 3. Simple dynamic logging level handler
  let currentLevel: LoggingLevel = "info";
  server.server.setRequestHandler(SetLevelRequestSchema, async (req) => {
    currentLevel = req.params.level;
    await server.server.notification({
      method: "notifications/message",
      params: { level: "info", data: `Logging level set to ${currentLevel}` },
    });
    return {};
  });

  return { server, cleanup: async () => {} };
};
