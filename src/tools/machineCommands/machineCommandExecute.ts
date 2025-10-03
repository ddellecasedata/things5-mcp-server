import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { THINGS5_BASE_URL } from "../../config.js";
import { success, failure } from '../utils/toolResult.js';

export const MachineCommandExecuteSchema = z.object({
  device_id: z.string().describe("Device ID to execute command on"),
  machine_command_id: z.string().describe("Machine command ID to execute. It's the UUID of the command id not the label"),
  overrides: z.record(z.string(), z.string()).optional().describe("Optional parameter overrides as key-value pairs")
});

export type MachineCommandExecuteArgs = z.infer<typeof MachineCommandExecuteSchema>;

export const getMachineCommandExecuteTool = (auth_token: string): Tool => ({
  name: "machine_command_execute",
  description: "Execute a machine command on a device with optional parameter overrides.",
  inputSchema: zodToJsonSchema(MachineCommandExecuteSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    result: z.any(),
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: MachineCommandExecuteArgs;
    try {
      args = MachineCommandExecuteSchema.parse(rawArgs);
    } catch (e) {
      throw new Error('Invalid arguments for machine_command_execute tool: ' + e);
    }

    const { device_id, machine_command_id, overrides } = args;

    try {
      const body = overrides ? { overrides } : {};

      const resp = await axios.put(
        `${THINGS5_BASE_URL}/devices/${encodeURIComponent(device_id)}/machine_commands/${encodeURIComponent(machine_command_id)}/execute`,
        body,
        { headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined }
      );

      const result = resp.data?.data;
      const overridesText = overrides ? `\nOverrides: ${JSON.stringify(overrides)}` : '';
      const summary = `✅ Machine command executed successfully:\nDevice: ${device_id}\nCommand: ${machine_command_id}${overridesText}`;

      return success({ text: summary, structured: { result } });
    } catch (error: any) {
      const message = `❌ Error executing machine command: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});