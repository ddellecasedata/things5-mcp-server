import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { THINGS5_BASE_URL } from "../../config.js";
import { success, failure } from '../utils/toolResult.js';

export const DeviceFirmwareDeleteSchema = z.object({
  machine_firmware_id: z.string().describe("Firmware ID to delete")
});

export type DeviceFirmwareDeleteArgs = z.infer<typeof DeviceFirmwareDeleteSchema>;

export const getDeviceFirmwareDeleteTool = (auth_token: string): Tool => ({
  name: "device_firmware_delete",
  description: "Delete a device firmware by ID.",
  inputSchema: zodToJsonSchema(DeviceFirmwareDeleteSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    deleted: z.boolean(),
    machine_firmware_id: z.string(),
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: DeviceFirmwareDeleteArgs;
    try {
      args = DeviceFirmwareDeleteSchema.parse(rawArgs);
    } catch (e) {
      throw new Error('Invalid arguments for device_firmware_delete tool: ' + e);
    }
    const { machine_firmware_id } = args;
    try {
      await axios.delete(`${THINGS5_BASE_URL}/machine_firmwares/${encodeURIComponent(machine_firmware_id)}`);
      return success({ text: `✅ Firmware ${machine_firmware_id} deleted successfully.`, structured: { deleted: true, machine_firmware_id } });
    } catch (error: any) {
      const message = `❌ Error deleting firmware: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
