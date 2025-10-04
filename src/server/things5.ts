import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LoggingLevel, SetLevelRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import * as toolFactories from "../tools/index.js";
import { createRequire } from "node:module";
import { z } from "zod";
import { jsonSchemaPropertiesToZodShape } from "../utils/jsonSchemaToZod.js";
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
    
    // Convert JSON Schema to Zod RawShape
    // This preserves all type information (array items, integer vs number, enums, etc.)
    const jsonSchema = tool.inputSchema || {
      type: 'object',
      properties: {},
      additionalProperties: false
    };
    
    const zodShape = jsonSchemaPropertiesToZodShape(jsonSchema);

    // Register the tool with the high-level API
    server.registerTool(
      tool.name,
      {
        title: tool.name,
        description: tool.description || '',
        inputSchema: zodShape  // Pass Zod RawShape
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
