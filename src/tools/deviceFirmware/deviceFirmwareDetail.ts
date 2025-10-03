import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { fetchFirstOrganizationId } from "../../tools/organizationUtils.js";
import { THINGS5_BASE_URL } from "../../config.js";
import { success, failure } from "../utils/toolResult.js";

export const DeviceFirmwareDetailSchema = z.object({
  machine_id: z.string().describe("Machine (device) ID to get firmware detail for"),
  include_machine_variables: z.boolean().optional().describe("Include machine_variables in the firmware detail response"),
  include_machine_commands: z.boolean().optional().describe("Include machine_commands in the firmware detail response")
});

export type DeviceFirmwareDetailArgs = z.infer<typeof DeviceFirmwareDetailSchema>;

export const getDeviceFirmwareDetailTool = (auth_token: string): Tool => ({
  name: "device_firmware_detail",
  description: "Get detail for the firmware currently associated with a device. Machine commands and machine variables can be found here",
  inputSchema: zodToJsonSchema(DeviceFirmwareDetailSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    filters: DeviceFirmwareDetailSchema,
    firmware: z.any().nullable(),
    machine_variables: z.array(z.object({
      id: z.string(),
      name: z.string().nullable(),
      description: z.string().nullable(),
      label: z.string().nullable(),
      source: z.string().nullable(),
      type: z.string().nullable(),
      unit: z.string().nullable(),
      ui_unit: z.string().nullable(),
      values: z.array(z.any()),
      writable: z.boolean()
    })).nullable(),
    machine_commands: z.array(z.object({
      id: z.string(),
      name: z.string(),
      parameters: z.array(z.object({
        value: z.string(),
        machine_variable_id: z.string(),
        allow_override: z.boolean()
      })),
      machine_variables: z.array(z.any())
    })).nullable()
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: DeviceFirmwareDetailArgs;
    try {
      args = DeviceFirmwareDetailSchema.parse(rawArgs);
    } catch (e) {
      throw new Error('Invalid arguments for device_firmware_detail tool: ' + e);
    }
    const { machine_id, include_machine_variables, include_machine_commands } = args;
    const organization_id = await fetchFirstOrganizationId(auth_token);
    try {
      // Build URL with query parameters
      const queryParams = new URLSearchParams();
      if (include_machine_variables) {
        queryParams.append('include_machine_variables', 'true');
      }
      if (include_machine_commands) {
        queryParams.append('include_machine_commands', 'true');
      }

      const url = `${THINGS5_BASE_URL}/organizations/${organization_id}/machines/${encodeURIComponent(machine_id)}/machine_firmware` +
        (queryParams.toString() ? `?${queryParams.toString()}` : '');

      const resp = await axios.get(url, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined
      });
      const fw = resp.data?.data;
      const machineVariables = fw?.machine_variables;
      const machineCommands = fw?.machine_commands;

      let summary = `Firmware for device ${machine_id}:\n`;
      if (!fw) {
        summary += 'No firmware found.';
      } else {
        summary += `ID: ${fw.id}\nVersion: ${fw.version}\nArchived: ${fw.archived}\nDraft: ${fw.draft}\nBuild: ${fw.build ?? ''}\n`;
      }

      if (machineVariables && machineVariables.length > 0) {
        summary += `\nMachine Variables (${machineVariables.length}):\n`;
        machineVariables.forEach((variable: any) => {
          summary += `- ${variable.label || variable.id} (${variable.name || 'no name'}): ${variable.description || 'No description'} (${variable.type})\n`;
        });
      }

      if (machineCommands && machineCommands.length > 0) {
        summary += `\nMachine Commands (${machineCommands.length}):\n`;
        machineCommands.forEach((command: any) => {
          const commandDisplay = command.name && command.id ? `${command.name} (ID: ${command.id})` : (command.name || command.id);
          summary += `- ${commandDisplay}: `;
          if (command.parameters && command.parameters.length > 0) {
            summary += `${command.parameters.length} parameter(s)`;
          } else {
            summary += 'no parameters';
          }
          summary += '\n';
        });
      }

      // Filter machine variables to include only specified fields
      const filteredMachineVariables = machineVariables?.map((variable: any) => ({
        id: variable.id,
        name: variable.name,
        description: variable.description,
        label: variable.label,
        source: variable.source,
        type: variable.type,
        unit: variable.unit,
        ui_unit: variable.ui_unit,
        values: variable.values,
        writable: variable.writable
      }));

      // Filter machine commands to include only specified fields
      const filteredMachineCommands = machineCommands?.map((command: any) => ({
        id: command.id,
        name: command.name,
        parameters: command.parameters?.map((param: any) => ({
          value: param.value,
          machine_variable_id: param.machine_variable_id,
          allow_override: param.allow_override
        })) || [],
        machine_variables: command.machine_variables || []
      }));

      return success({
        text: summary,
        structured: {
          filters: args,
          firmware: fw ?? null,
          machine_variables: filteredMachineVariables ?? null,
          machine_commands: filteredMachineCommands ?? null
        }
      });
    } catch (error: any) {
      const message = `❌ Error fetching firmware detail: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});