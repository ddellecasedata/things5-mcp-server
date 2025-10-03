import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { THINGS5_BASE_URL } from "../../config.js";
import { success, failure } from "../utils/toolResult.js";

export const DeviceFirmwareListSchema = z.object({
  machine_model_id: z.string().describe("Device model ID to list firmwares for")
});

export type DeviceFirmwareListArgs = z.infer<typeof DeviceFirmwareListSchema>;

export const getDeviceFirmwareListTool = (auth_token: string): Tool => ({
  name: "device_firmware_list",
  description: "List all device firmwares for a given device model.",
  inputSchema: zodToJsonSchema(DeviceFirmwareListSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    filters: DeviceFirmwareListSchema,
    firmwares: z.array(z.any()),
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: DeviceFirmwareListArgs;
    try {
      args = DeviceFirmwareListSchema.parse(rawArgs);
    } catch (e) {
      throw new Error('Invalid arguments for device_firmware_list tool: ' + e);
    }
    const { machine_model_id } = args;
    try {
      const resp = await axios.get(`${THINGS5_BASE_URL}/machine_models/${encodeURIComponent(machine_model_id)}/machine_firmwares`, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined
      });
      const firmwares = resp.data?.data || [];
      let summary = `Firmwares for model ${machine_model_id}:\n`;
      if (firmwares.length === 0) {
        summary += 'No firmwares found.';
      } else {
        summary += '| ID | Version | Archived | Draft | Build |\n';
        summary += '|----|---------|----------|-------|-------|\n';
        for (const fw of firmwares) {
          summary += `| ${fw.id} | ${fw.version} | ${fw.archived} | ${fw.draft} | ${fw.build ?? ''} |\n`;
        }
      }
      return success({ text: summary, structured: { filters: args, firmwares } });
    } catch (error: any) {
      const message = `❌ Error listing firmwares: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
