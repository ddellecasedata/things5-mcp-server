import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { THINGS5_BASE_URL } from "../../config.js";
import { success, failure } from '../utils/toolResult.js';
import { fixArraySchemas } from '../utils/schemaUtils.js';

export const MachineCommandCreateSchema = z.object({
  machine_firmware_id: z.string().describe("Machine firmware ID to create command for"),
  name: z.string().describe("Name of the machine command"),
  parameters: z.array(z.object({
    machine_variable_id: z.string().describe("ID of the machine variable"),
    value: z.string().describe("Parameter value"),
    allow_override: z.boolean().describe("Allow parameter value override during command execution"),
    label: z.string().describe("Human-readable label for the parameter")
  })).describe("Array of command parameters")
});

export type MachineCommandCreateArgs = z.infer<typeof MachineCommandCreateSchema>;

export const getMachineCommandCreateTool = (auth_token: string): Tool => ({
  name: "machine_command_create",
  description: "Create a new machine command for a given machine firmware.",
  inputSchema: fixArraySchemas(zodToJsonSchema(MachineCommandCreateSchema)) as any,
  outputSchema: zodToJsonSchema(z.object({
    command: z.any(),
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: MachineCommandCreateArgs;
    try {
      args = MachineCommandCreateSchema.parse(rawArgs);
    } catch (e) {
      throw new Error('Invalid arguments for machine_command_create tool: ' + e);
    }

    const { machine_firmware_id, name, parameters } = args;

    try {
      const body = {
        machine_command: {
          name,
          parameters
        }
      };

      const resp = await axios.post(
        `${THINGS5_BASE_URL}/machine_firmwares/${encodeURIComponent(machine_firmware_id)}/machine_commands`,
        body,
        { headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined }
      );

      const command = resp.data?.data;
      const summary = `✅ Machine command created for firmware ${machine_firmware_id}:\nID: ${command?.id}\nName: ${command?.name}\nParameters: ${command?.parameters?.length || 0}`;

      return success({ text: summary, structured: { command } });
    } catch (error: any) {
      const message = `❌ Error creating machine command: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});