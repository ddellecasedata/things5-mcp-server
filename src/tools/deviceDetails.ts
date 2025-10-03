import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { THINGS5_BASE_URL } from '../config.js';
import { success, failure } from './utils/toolResult.js';

export const DeviceDetailsSchema = z.object({
  device_id: z.string().describe("Device id (UUID)"),
  include_machine_model: z.boolean().optional().describe("Include machine model details in the response"),
  include_machines_group: z.boolean().optional().describe("Include machines group details in the response")
});

export type DeviceDetailsArgs = z.infer<typeof DeviceDetailsSchema>;

export const getDeviceDetailsTool = (auth_token: string): Tool => ({
  name: "device_details",
  description: `Get details for a device, including connection status, firmware, model, and group info. Uses the device-details endpoint from the API.`,
  inputSchema: zodToJsonSchema(DeviceDetailsSchema) as any,
  outputSchema: zodToJsonSchema(z.object({ device: z.any() })) as any,
  handler: async (rawArgs: unknown) => {
    let args: DeviceDetailsArgs;
    try {
      args = DeviceDetailsSchema.parse(rawArgs);
    } catch (e) {
      throw new Error('Invalid arguments for device_details tool: ' + e);
    }
    const { device_id, include_machine_model, include_machines_group } = args;
    const url = `${THINGS5_BASE_URL}/devices/${encodeURIComponent(device_id)}`;
    const params: Record<string, any> = {};
    if (typeof include_machine_model !== 'undefined') params.include_machine_model = include_machine_model;
    if (typeof include_machines_group !== 'undefined') params.include_machines_group = include_machines_group;
    try {
      const resp = await axios.get(url, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined,
        params
      });
      const data = resp.data?.data;
      let summary = `# Device Details\n`;
      summary += `**ID:** ${data.id}\n`;
      summary += `**Name:** ${data.name}\n`;
      summary += `**Serial:** ${data.serial}\n`;
      summary += `**Active:** ${data.active ? 'Yes' : 'No'}\n`;
      summary += `**Connected:** ${data.is_connected ? 'Yes' : 'No'}\n`;
      summary += `**Last Seen:** ${data.last_seen}\n`;
      if (data.machine_firmware_id) summary += `**Firmware ID:** ${data.machine_firmware_id}\n`;
      if (data.machine_model) {
        summary += `\n## Machine Model\n`;
        summary += `- ID: ${data.machine_model.id}\n`;
        summary += `- Name: ${data.machine_model.name}\n`;
        summary += `- Identifier: ${data.machine_model.identifier}\n`;
        if (data.machine_model.image) summary += `- Image: ${data.machine_model.image}\n`;
      }
      if (data.machines_groups) {
        summary += `\n## Machines Group\n`;
        summary += `- ID: ${data.machines_groups.id}\n`;
        summary += `- Name: ${data.machines_groups.name}\n`;
        summary += `- Category ID: ${data.machines_groups.category_id}\n`;
        summary += `- Organization ID: ${data.machines_groups.organization_id}\n`;
      }
      return success({ text: summary, structured: { device: data } });
    } catch (error: any) {
      const message = `❌ Error fetching device details: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
