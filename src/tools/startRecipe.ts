// Not used for now. In case perfom Action is too generic use this to start recipe
import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { THINGS5_BASE_URL } from '../config.js';
import { fetchFirstOrganizationId } from './organizationUtils.js';
import { success, failure } from './utils/toolResult.js';

interface Action {
  id: string;
  name: string;
  parameters: { name: string; default_value?: string; }[]
}
interface ApiResponse { data: Action[]; }

// Schema basato su OpenAPI
export const StartRecipeSchema = z.object({
  device_uuid: z.string().describe("Device unique id"),
  recipe_name: z.string().describe("name of the recipe"),
});

export type StartRecipeArgs = z.infer<typeof StartRecipeSchema>;


export const getStartRecipeTool = (auth_token: string): Tool => ({
  name: "start_recipe",
  description: 'Executes the provided recipe on the device. Device uuid is needed, if only device name or serial are known list machines must be used first to retrieve the uuid',
  inputSchema: zodToJsonSchema(StartRecipeSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    success: z.boolean(),
    request_id: z.string().optional(),
    errors: z.array(z.string()).optional(),
  })) as any,
  handler: async (rawArgs: unknown) => {
    console.log('[start_recipe] rawArgs:', JSON.stringify(rawArgs));
    let args: StartRecipeArgs;

    const organization_id = await fetchFirstOrganizationId(auth_token);
    const apiResponse = await axios.get<ApiResponse>(`${THINGS5_BASE_URL}/organizations/${organization_id}/actions`, {
      headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined,
    });
    const actions: Action[] = Array.isArray(apiResponse.data)
      ? (apiResponse.data as any)
      : apiResponse.data.data || [];

    const action = actions[0]
    try {
      args = StartRecipeSchema.parse(rawArgs);
    } catch (e) {
      console.error('[start_recipe] Zod parse error:', e);
      throw e;
    }
    console.log('[start_recipe] args:', args);
    const url = `${THINGS5_BASE_URL}/actions/${action.id}/perform`;
    try {
      console.log('trying to call perform action')
      const response = await axios.post(url, { machine_id: args.device_uuid, parameters: [{ name: "recipe_name", value: args.recipe_name }] }, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined,
      });
      const raw = response.data;
      console.log(raw)
      // Normalizza assets/values
      if (raw.errors && raw.errors.length > 0) {
        return success({
          text: raw.errors.join('\n'),
          structured: { success: false, request_id: raw.request_id, errors: raw.errors },
        });
      } else {
        return success({
          text: 'success',
          structured: { success: true, request_id: raw.request_id },
        });
      }

    } catch (error: any) {
      console.log('error')
      console.log(error)
      const message = `❌ Error performing action: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
