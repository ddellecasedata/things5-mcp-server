import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { THINGS5_BASE_URL } from "../config.js";
import { success, failure } from "./utils/toolResult.js";

export const DeviceUpdateSchema = z.object({
  device_id: z.string().describe("Device ID (UUID) to update"),
  name: z.string().optional().describe("Device name (optional, will update if provided)"),
  serial: z.string().optional().describe("Device serial (optional, will update if provided)")
});

export type DeviceUpdateArgs = z.infer<typeof DeviceUpdateSchema>;

export const getDeviceUpdateTool = (auth_token: string): Tool => ({
  name: "device_update",
  description: `Update a device on Things5. You must specify the device_id and at least one of: name, serial. Only provided fields will be updated.`,
  inputSchema: zodToJsonSchema(DeviceUpdateSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    device: z.any(),
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: DeviceUpdateArgs;
    try {
      args = DeviceUpdateSchema.parse(rawArgs);
    } catch (e) {
      throw new Error('Invalid arguments for device_update tool: ' + e);
    }
    const { device_id, name, serial } = args;
    const machine: Record<string, unknown> = {};
    if (name !== undefined) machine.name = name;
    if (serial !== undefined) machine.serial = serial;
    if (Object.keys(machine).length === 0) {
      return failure({ message: 'No update fields provided: pass at least one of name or serial.' });
    }
    try {
      const resp = await axios.patch(`${THINGS5_BASE_URL}/devices/${encodeURIComponent(device_id)}`, { machine }, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined
      });
      const data = resp.data?.data;
      return success({ text: `✅ Device ${device_id} updated.`, structured: { device: data } });
    } catch (error: any) {
      const message = `❌ Error updating device: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
