import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { fetchFirstOrganizationId } from "./organizationUtils.js";
import { THINGS5_BASE_URL } from "../config.js";
import { success, failure } from "./utils/toolResult.js";

export const DeviceCreateSchema = z.object({
  serial: z.string().describe("Device serial"),
  machine_model_id: z.string().describe("Device model ID (from machine models list)"),
  machine_firmware_id: z.string().describe("Device firmware ID (from machine firmwares list)"),
  name: z.string().optional().describe("Device name (optional)"),
  machines_group_id: z.string().optional().describe("Machines group ID (required for standard users)"),
});

export type DeviceCreateArgs = z.infer<typeof DeviceCreateSchema>;

export const getDeviceCreateTool = (auth_token: string): Tool => ({
  name: "device_create",
  description: `Create a new device on Things5. Requires serial, machine_model_id, machine_firmware_id, and (for admins) organization_id. For standard users, machines_group_id is required. Name is optional.`,
  inputSchema: zodToJsonSchema(DeviceCreateSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    device: z.any(),
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: DeviceCreateArgs;
    try {
      args = DeviceCreateSchema.parse(rawArgs);
    } catch (e) {
      throw new Error('Invalid arguments for device_create tool: ' + e);
    }
    let { serial, machine_model_id, machine_firmware_id, name, machines_group_id } = args;
    const organization_id = await fetchFirstOrganizationId(auth_token);
    const payload: any = {
      serial,
      machine_model_id,
      machine_firmware_id,
      organization_id
    };
    if (name) payload.name = name;
    if (machines_group_id) payload.machines_group_id = machines_group_id;
    try {
      const resp = await axios.post(`${THINGS5_BASE_URL}/devices`, payload, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined
      });
      const data = resp.data?.data;
      const text = `✅ Device created with ID: ${data.id} (serial: ${data.serial})`;
      return success({ text, structured: { device: data } });
    } catch (error: any) {
      const message = `❌ Error creating device: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
