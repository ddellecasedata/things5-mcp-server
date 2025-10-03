import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { THINGS5_BASE_URL } from "../../config.js";
import { success, failure } from '../utils/toolResult.js';

export const DeviceFirmwareUpdateCancelSchema = z.object({
  device_id: z.string().describe("Device ID to cancel firmware update for")
});

export type DeviceFirmwareUpdateCancelArgs = z.infer<typeof DeviceFirmwareUpdateCancelSchema>;

export const getDeviceFirmwareUpdateCancelTool = (auth_token: string): Tool => ({
  name: "device_firmware_update_cancel",
  description: "Cancel a pending firmware update for a device. No message is sent to the device; the update is deleted only on Things5 side.",
  inputSchema: zodToJsonSchema(DeviceFirmwareUpdateCancelSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    canceled: z.boolean(),
    device_id: z.string(),
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: DeviceFirmwareUpdateCancelArgs;
    try {
      args = DeviceFirmwareUpdateCancelSchema.parse(rawArgs);
    } catch (e) {
      throw new Error('Invalid arguments for device_firmware_update_cancel tool: ' + e);
    }
    const { device_id } = args;
    try {
      await axios.post(`${THINGS5_BASE_URL}/devices/${encodeURIComponent(device_id)}/send_firmware_update_cancel_request`, {}, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined
      });
      return success({ text: `✅ Firmware update canceled for device ${device_id}.`, structured: { canceled: true, device_id } });
    } catch (error: any) {
      const message = `❌ Error canceling firmware update: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
