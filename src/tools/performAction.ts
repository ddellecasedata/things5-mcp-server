import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { THINGS5_BASE_URL } from '../config.js';
import { success, failure } from './utils/toolResult.js';
import { fixArraySchemas } from './utils/schemaUtils.js';

interface Action {
  id: string;
  name: string;
  parameters: { name: string; default_value?: string; }[]
}
interface ApiResponse { data: Action[]; }

// Schema basato su OpenAPI
export const PerformActionSchema = z.object({
  device_id: z.string().describe("Device id"),
  name: z.string().describe("name of the action"),
  parameters: z.array(
    z.object({
      name: z.string(),
      value: z.string()
    }))
});

export type PerformActionArgs = z.infer<typeof PerformActionSchema>;


export const getPerformActionTool = (auth_token: string): Tool => ({
  name: "perform_action",
  description: `
  Executes actions on a device. Device id is needed to perform the action, so if only device name or serial are knows it's necessary to get the device list first. Usage examples:
    - "start recipe cleaning on device fridge-01" → starts the cleaning recipe on device fridge-01. the recipe name must be included in params like this {"name": "recipe_name", "value": "cleaning"}
`,
  inputSchema: fixArraySchemas(zodToJsonSchema(PerformActionSchema)) as any,
  outputSchema: zodToJsonSchema(z.object({
    success: z.boolean(),
    request_id: z.string().optional(),
    errors: z.array(z.string()).optional(),
  })) as any,
  handler: async (rawArgs: unknown) => {
    console.log('[perform_action] rawArgs:', JSON.stringify(rawArgs));
    let args: PerformActionArgs;
    const fetchFirstOrganizationId = (auth_token?: string) => {
      return new Promise<string>((resolve, reject) => {
        const url = `${THINGS5_BASE_URL}/organizations`;
        axios.get<ApiResponse>(url, {
          headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined,
        })
          .then(response => {
            const organizations = response.data.data;
            if (organizations.length > 0) {
              resolve(organizations[0].id);
            } else {
              reject(new Error('No organizations found'));
            }
          })
          .catch(error => {
            reject(error);
          });
      });
    };

    const organization_id = await fetchFirstOrganizationId(auth_token);
    const apiResponse = await axios.get<ApiResponse>(`${THINGS5_BASE_URL}/organizations/${organization_id}/actions`, {
      headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined,
    });
    const actions: Action[] = Array.isArray(apiResponse.data)
      ? (apiResponse.data as any)
      : apiResponse.data.data || [];

    const action = actions[0]
    try {
      args = PerformActionSchema.parse(rawArgs);
    } catch (e) {
      console.error('[perform_action] Zod parse error:', e);
      throw e;
    }
    console.log('[perform_action] args:', args);
    const url = `${THINGS5_BASE_URL}/actions/${action.id}/perform`;
    try {
      console.log('trying to call perform action')
      const response = await axios.post(url, { machine_id: args.device_id, parameters: args.parameters }, {
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
