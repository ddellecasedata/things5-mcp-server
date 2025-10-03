import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { THINGS5_BASE_URL } from "../../config.js";
import { success, failure } from '../utils/toolResult.js';

export const MachineCommandDeleteSchema = z.object({
  machine_command_id: z.string().describe("Machine command ID to delete")
});

export type MachineCommandDeleteArgs = z.infer<typeof MachineCommandDeleteSchema>;

export const getMachineCommandDeleteTool = (auth_token: string): Tool => ({
  name: "machine_command_delete",
  description: "Delete an existing machine command by its ID.",
  inputSchema: zodToJsonSchema(MachineCommandDeleteSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    success: z.boolean(),
    machine_command_id: z.string(),
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: MachineCommandDeleteArgs;
    try {
      args = MachineCommandDeleteSchema.parse(rawArgs);
    } catch (e) {
      throw new Error('Invalid arguments for machine_command_delete tool: ' + e);
    }

    const { machine_command_id } = args;

    try {
      const resp = await axios.delete(
        `${THINGS5_BASE_URL}/machine_commands/${encodeURIComponent(machine_command_id)}`,
        { headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined }
      );

      const summary = `✅ Machine command deleted successfully:\nID: ${machine_command_id}`;

      return success({
        text: summary,
        structured: {
          success: true,
          machine_command_id
        }
      });
    } catch (error: any) {
      const message = `❌ Error deleting machine command: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});