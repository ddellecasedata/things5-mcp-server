import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { THINGS5_BASE_URL } from "../../config.js";
import { success, failure } from '../utils/toolResult.js';

export const MachineCommandUpdateSchema = z.object({
  machine_command_id: z.string().describe("Machine command ID to update"),
  name: z.string().optional().describe("Updated name of the machine command"),
  parameters: z.array(z.object({
    machine_variable_id: z.string().describe("ID of the machine variable"),
    value: z.string().describe("Parameter value"),
    allow_override: z.boolean().describe("Allow parameter value override during command execution"),
    label: z.string().describe("Human-readable label for the parameter")
  })).optional().describe("Updated array of command parameters")
});

export type MachineCommandUpdateArgs = z.infer<typeof MachineCommandUpdateSchema>;

export const getMachineCommandUpdateTool = (auth_token: string): Tool => ({
  name: "machine_command_update",
  description: "Update an existing machine command with new name and/or parameters.",
  inputSchema: zodToJsonSchema(MachineCommandUpdateSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    command: z.any(),
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: MachineCommandUpdateArgs;
    try {
      args = MachineCommandUpdateSchema.parse(rawArgs);
    } catch (e) {
      throw new Error('Invalid arguments for machine_command_update tool: ' + e);
    }

    const { machine_command_id, name, parameters } = args;

    // Validate that at least one field is provided for update
    if (!name && !parameters) {
      throw new Error('At least one field (name or parameters) must be provided for update');
    }

    try {
      const body: { machine_command: { name?: string; parameters?: any[] } } = {
        machine_command: {}
      };

      // Only include fields that are provided
      if (name !== undefined) {
        body.machine_command.name = name;
      }
      if (parameters !== undefined) {
        body.machine_command.parameters = parameters;
      }

      const resp = await axios.patch(
        `${THINGS5_BASE_URL}/machine_commands/${encodeURIComponent(machine_command_id)}`,
        body,
        { headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined }
      );

      const command = resp.data?.data;
      const summary = `✅ Machine command updated:\nID: ${command?.id}\nName: ${command?.name}\nParameters: ${command?.parameters?.length || 0}`;

      return success({ text: summary, structured: { command } });
    } catch (error: any) {
      const message = `❌ Error updating machine command: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});