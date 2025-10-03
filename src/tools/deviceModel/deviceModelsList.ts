import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { fetchFirstOrganizationId } from "../../tools/organizationUtils.js";
import { THINGS5_BASE_URL } from "../../config.js";
import { success, failure } from "../utils/toolResult.js";

export const DeviceModelsListSchema = z.object({});
export type DeviceModelsListArgs = z.infer<typeof DeviceModelsListSchema>;

export const getDeviceModelsListTool = (auth_token: string): Tool => ({
  name: "device_models_list",
  description: `List all device models for the current organization.`,
  inputSchema: zodToJsonSchema(DeviceModelsListSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    models: z.array(z.any()),
  })) as any,
  handler: async (_rawArgs: unknown) => {
    const organization_id = await fetchFirstOrganizationId(auth_token);
    try {
      const resp = await axios.get(`${THINGS5_BASE_URL}/organizations/${organization_id}/machine_models`, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined
      });
      const models = resp.data?.data || [];
      const text = models.length
        ? `Modelli disponibili: ${models.map((m: any) => `${m.name} (ID: ${m.id})`).join(", ")}`
        : 'Nessun modello disponibile.';
      return success({ text, structured: { models } });
    } catch (error: any) {
      const message = `❌ Errore nel recupero modelli: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
