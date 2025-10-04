import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LoggingLevel, SetLevelRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import * as toolFactories from "../tools/index.js";
import { createRequire } from "node:module";
import { z } from "zod";
import { jsonSchemaPropertiesToZodShape } from "../utils/jsonSchemaToZod.js";
import { autoResolveParameters, canAutoResolve } from "../utils/toolDependencies.js";
import { getAvailableMachines, getMachinesSummary, getCacheInfo } from "../utils/machineContext.js";
import { fullSanitize } from "../utils/inputSanitizer.js";
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
        console.log('\n' + '='.repeat(80));
        console.log(`[MCP] 🔧 Tool Call: ${tool.name}`);
        console.log('='.repeat(80));
        console.log('[MCP] Original input:', JSON.stringify(input, null, 2));
        
        // Step 0: Sanitize input to fix common AI mistakes
        console.log('\n[MCP] 🧹 Sanitizing input...');
        input = fullSanitize(tool.name, input);
        
        // Step 1: Pre-load machine context for AI awareness
        let machineContext;
        if (auth_token) {
          try {
            console.log('\n[MCP] 📋 Pre-loading machine context...');
            machineContext = await getAvailableMachines(auth_token);
            
            const cacheInfo = getCacheInfo();
            if (cacheInfo) {
              console.log(`[MCP] ✅ Machine context loaded: ${cacheInfo.machines} machines`);
              console.log(`[MCP] Cache age: ${cacheInfo.age_seconds}s, expires in: ${cacheInfo.expires_in_seconds}s`);
            }
            
            // Log summary for debugging
            if (machineContext.length > 0) {
              const connected = machineContext.filter(m => m.is_connected).length;
              console.log(`[MCP] 🟢 ${connected} connected, 🔴 ${machineContext.length - connected} disconnected`);
              
              // Log first few machines for reference
              console.log('[MCP] Available machines:');
              machineContext.slice(0, 5).forEach(m => {
                const status = m.is_connected ? '🟢' : '🔴';
                console.log(`  ${status} ${m.name} (${m.serial}) - ID: ${m.id.substring(0, 8)}...`);
              });
              if (machineContext.length > 5) {
                console.log(`  ... and ${machineContext.length - 5} more`);
              }
            }
          } catch (error: any) {
            console.error('[MCP] ⚠️  Failed to pre-load machine context:', error.message);
            console.error('[MCP] Continuing without context, auto-resolution will use API calls');
          }
        }
        
        // Step 2: Auto-resolve missing parameters using machine context
        let resolvedInput = input;
        if (canAutoResolve(tool.name) && auth_token) {
          console.log('\n[MCP] 🔄 Auto-resolving dependencies...');
          resolvedInput = await autoResolveParameters(
            tool.name, 
            input, 
            auth_token,
            machineContext
          );
          
          if (JSON.stringify(resolvedInput) !== JSON.stringify(input)) {
            console.log('[MCP] ✅ Parameters auto-resolved:');
            console.log(JSON.stringify(resolvedInput, null, 2));
          } else {
            console.log('[MCP] ℹ️  No parameters needed resolution');
          }
        }
        
        // Step 3: Execute tool handler
        console.log('\n[MCP] ⚡ Executing tool handler...');
        const result = await tool.handler(resolvedInput, {} as any);
        
        console.log('[MCP] ✅ Tool execution completed');
        console.log('='.repeat(80) + '\n');
        
        return result;
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
