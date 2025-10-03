import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { THINGS5_BASE_URL } from "../../config.js";
import { success, failure } from '../utils/toolResult.js';

export const DeviceFirmwareUpdateSchema = z.object({
  machine_firmware_id: z.string().describe("Firmware ID to update"),
  changelog: z.string().optional().describe("Changelog for the firmware update"),
  draft: z.boolean().optional().describe("Mark firmware as draft (admins only)"),
  file: z.string().optional().describe("Firmware file (base64-encoded string or file upload, if supported)")
});

export type DeviceFirmwareUpdateArgs = z.infer<typeof DeviceFirmwareUpdateSchema>;

export const getDeviceFirmwareUpdateTool = (auth_token: string): Tool => ({
  name: "device_firmware_update",
  description: "Update a device firmware by ID. Supports updating changelog, draft status, and firmware file.",
  inputSchema: zodToJsonSchema(DeviceFirmwareUpdateSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    updated: z.boolean(),
    machine_firmware_id: z.string(),
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: DeviceFirmwareUpdateArgs;
    try {
      args = DeviceFirmwareUpdateSchema.parse(rawArgs);
    } catch (e) {
      throw new Error('Invalid arguments for device_firmware_update tool: ' + e);
    }
    const { machine_firmware_id, changelog, draft, file } = args;
    try {
      const body: any = { machine_firmware: {} };
      if (changelog !== undefined) body.machine_firmware.changelog = changelog;
      if (draft !== undefined) body.machine_firmware.draft = draft;
      if (file !== undefined) body.machine_firmware.file = file;
      await axios.patch(`${THINGS5_BASE_URL}/machine_firmwares/${encodeURIComponent(machine_firmware_id)}`, body, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined
      });
      return success({ text: `✅ Firmware ${machine_firmware_id} updated successfully.`, structured: { updated: true, machine_firmware_id } });
    } catch (error: any) {
      const message = `❌ Error updating firmware: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
