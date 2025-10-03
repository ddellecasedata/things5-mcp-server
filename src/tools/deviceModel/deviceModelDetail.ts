import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { THINGS5_BASE_URL } from "../../config.js";
import { success, failure } from "../utils/toolResult.js";

export const DeviceModelDetailSchema = z.object({
  machine_model_id: z.string().describe("Device model ID"),
  include_machines_firmwares: z.boolean().optional().describe("If true, includes the machine_firmwares field in the response")
});

export type DeviceModelDetailArgs = z.infer<typeof DeviceModelDetailSchema>;

export const getDeviceModelDetailTool = (auth_token: string): Tool => ({
  name: "device_model_detail",
  description: "Returns the details of a device model. Optionally includes associated firmwares.",
  inputSchema: zodToJsonSchema(DeviceModelDetailSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    detail: z.any(),
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: DeviceModelDetailArgs;
    try {
      args = DeviceModelDetailSchema.parse(rawArgs);
    } catch (e) {
      throw new Error('Invalid arguments for device_model_detail tool: ' + e);
    }
    const { machine_model_id, include_machines_firmwares } = args;
    const params: Record<string, any> = {};
    if (include_machines_firmwares !== undefined) params.include_machines_firmwares = include_machines_firmwares;
    try {
      const resp = await axios.get(
        `${THINGS5_BASE_URL}/machine_models/${encodeURIComponent(machine_model_id)}`,
        {
          params,
          headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined
        }
      );
      const detail = resp.data?.data;
      const text = detail ? `Model: ${detail.name} (ID: ${detail.id})\nIdentifier: ${detail.identifier}` : 'No detail available';
      return success({ text, structured: { detail } });
    } catch (error: any) {
      const message = `❌ Error fetching model detail: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
