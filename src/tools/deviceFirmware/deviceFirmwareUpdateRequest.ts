import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { THINGS5_BASE_URL } from "../../config.js";
import { success, failure } from "../utils/toolResult.js";

export const DeviceFirmwareUpdateRequestSchema = z.object({
  device_id: z.string().describe("Device ID to update firmware on"),
  firmware_id: z.string().describe("Firmware ID to update to")
});

export type DeviceFirmwareUpdateRequestArgs = z.infer<typeof DeviceFirmwareUpdateRequestSchema>;

export const getDeviceFirmwareUpdateRequestTool = (auth_token: string): Tool => ({
  name: "device_firmware_update_request",
  description: "Request a firmware update on a device.",
  inputSchema: zodToJsonSchema(DeviceFirmwareUpdateRequestSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    requested: z.boolean(),
    filters: DeviceFirmwareUpdateRequestSchema,
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: DeviceFirmwareUpdateRequestArgs;
    try {
      args = DeviceFirmwareUpdateRequestSchema.parse(rawArgs);
    } catch (e) {
      throw new Error('Invalid arguments for device_firmware_update_request tool: ' + e);
    }
    const { device_id, firmware_id } = args;
    try {
      await axios.post(`${THINGS5_BASE_URL}/devices/${encodeURIComponent(device_id)}/firmware_update`, { firmware_id }, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined
      });
      return success({ text: `✅ Firmware update requested for device ${device_id} to firmware ${firmware_id}.`, structured: { requested: true, filters: args } });
    } catch (error: any) {
      console.log(error)
      const message = `❌ Error requesting firmware update: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
