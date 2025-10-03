import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { THINGS5_BASE_URL } from "../../config.js";
import { success, failure } from '../utils/toolResult.js';

export const DeviceFirmwareCreateSchema = z.object({
  machine_model_id: z.string().describe("Device model ID to create firmware for"),
  version: z.string().describe("Firmware version, e.g. '1.0.0'"),
  draft: z.boolean().optional().describe("Mark firmware as draft (admins only)"),
  build: z.string().optional().describe("Build identifier (optional)"),
  file: z.string().optional().describe("Firmware file (base64-encoded string or file upload, if supported)")
});

export type DeviceFirmwareCreateArgs = z.infer<typeof DeviceFirmwareCreateSchema>;

export const getDeviceFirmwareCreateTool = (auth_token: string): Tool => ({
  name: "device_firmware_create",
  description: "Create a new device firmware for a given device model.",
  inputSchema: zodToJsonSchema(DeviceFirmwareCreateSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    firmware: z.any(),
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: DeviceFirmwareCreateArgs;
    try {
      args = DeviceFirmwareCreateSchema.parse(rawArgs);
    } catch (e) {
      throw new Error('Invalid arguments for device_firmware_create tool: ' + e);
    }
    const { machine_model_id, version, draft, build, file } = args;
    try {
      const body: any = { machine_firmware: { version } };
      if (draft !== undefined) body.machine_firmware.draft = draft;
      if (build !== undefined) body.machine_firmware.build = build;
      if (file !== undefined) body.machine_firmware.file = file;
      const resp = await axios.post(
        `${THINGS5_BASE_URL}/machine_models/${encodeURIComponent(machine_model_id)}/machine_firmwares`,
        body,
        { headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined }
      );
      const fw = resp.data?.data;
      let summary = `✅ Firmware created for model ${machine_model_id}:\nID: ${fw?.id}\nVersion: ${fw?.version}`;
      return success({ text: summary, structured: { firmware: fw } });
    } catch (error: any) {
      const message = `❌ Error creating firmware: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
