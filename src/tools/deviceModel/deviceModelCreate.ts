import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { fetchFirstOrganizationId } from "../../tools/organizationUtils.js";
import { THINGS5_BASE_URL } from "../../config.js";
import { success, failure } from '../utils/toolResult.js';

export const DeviceModelCreateSchema = z.object({
  name: z.string().describe("Model name"),
  identifier: z.string().describe("Unique model identifier"),
  image: z.string().optional().describe("Model image URL (optional)")
});
export type DeviceModelCreateArgs = z.infer<typeof DeviceModelCreateSchema>;

export const getDeviceModelCreateTool = (auth_token: string): Tool => ({
  name: "device_model_create",
  description: `Create a new device model for the current organization. Requires name and identifier. Image is optional.`,

  inputSchema: zodToJsonSchema(DeviceModelCreateSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    model: z.any(),
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: DeviceModelCreateArgs;
    try {
      args = DeviceModelCreateSchema.parse(rawArgs);
    } catch (e) {
      throw new Error('Invalid arguments for device_model_create tool: ' + e);

    }
    const organization_id = await fetchFirstOrganizationId(auth_token);
    const payload: any = {
      name: args.name,
      identifier: args.identifier
    };
    if (args.image) payload.image = args.image;
    try {
      const resp = await axios.post(`${THINGS5_BASE_URL}/organizations/${organization_id}/machine_models`, payload, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined
      });
      const model = resp.data?.data;
      return success({ text: `✅ Model created: ${model.name} (ID: ${model.id})`, structured: { model } });
    } catch (error: any) {
      const message = `❌ Error creating model: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
