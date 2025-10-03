import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { THINGS5_BASE_URL } from "../../config.js";
import { success, failure } from '../utils/toolResult.js';

export const DeviceFirmwareUpdateStatusSchema = z.object({
  device_id: z.string().describe("Device ID to get firmware update status for")
});

export type DeviceFirmwareUpdateStatusArgs = z.infer<typeof DeviceFirmwareUpdateStatusSchema>;

export const getDeviceFirmwareUpdateStatusTool = (auth_token: string): Tool => ({
  name: "device_firmware_update_status",
  description: "Get the last firmware update status and progress for a device.",
  inputSchema: zodToJsonSchema(DeviceFirmwareUpdateStatusSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    device_id: z.string(),
    status: z.any(),
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: DeviceFirmwareUpdateStatusArgs;
    try {
      args = DeviceFirmwareUpdateStatusSchema.parse(rawArgs);
    } catch (e) {
      throw new Error('Invalid arguments for device_firmware_update_status tool: ' + e);
    }
    const { device_id } = args;
    try {
      const resp = await axios.get(`${THINGS5_BASE_URL}/devices/${encodeURIComponent(device_id)}/firmware_update/status`, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined
      });
      const status = resp.data?.data;
      let summary = `Firmware update status for device ${device_id}:\n`;
      if (!status) {
        summary += 'No update status found.';
      } else {
        summary += `Status: ${status.status || 'unknown'}\nProgress: ${status.progress || 'n/a'}\n`;
      }
      return success({ text: summary, structured: { device_id, status } });
    } catch (error: any) {
      const message = `❌ Error fetching firmware update status: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
