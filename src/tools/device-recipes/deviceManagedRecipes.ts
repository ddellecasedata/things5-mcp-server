import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { THINGS5_RECIPES_BASE_URL } from "../../config.js";
import { success, failure } from "../utils/toolResult.js";

export const DeviceManagedRecipesSchema = z.object({
  machine_id: z.string().describe("Machine unique id (UUID) of the device")
});

export type DeviceManagedRecipesArgs = z.infer<typeof DeviceManagedRecipesSchema>;

export const getDeviceManagedRecipesTool = (auth_token: string): Tool => ({
  name: "device_managed_recipes",
  description: "Primary tool to fetch a device's recipes (device-managed recipes). Use this when the context is recipes to list the recipes available on a machine.",
  inputSchema: zodToJsonSchema(DeviceManagedRecipesSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    filters: DeviceManagedRecipesSchema,
    request_id: z.string().optional(),
    recipes: z.array(z.any()),
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: DeviceManagedRecipesArgs;
    try {
      args = DeviceManagedRecipesSchema.parse(rawArgs);
    } catch (e) {
      throw new Error('Invalid arguments for device_managed_recipes tool: ' + e);
    }
    const { machine_id } = args;
    const url = `${THINGS5_RECIPES_BASE_URL}/recipes/machines/${encodeURIComponent(machine_id)}/device_managed_recipes`;
    try {
      const headers = auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined;
      const resp = await axios.get(url, { headers });
      const raw = resp.data ?? {};
      const recipes = Array.isArray(raw?.recipes)
        ? raw.recipes
        : Array.isArray(raw?.data?.recipes)
          ? raw.data.recipes
          : Array.isArray(raw?.data)
            ? raw.data
            : [];

      const request_id: string | undefined = raw?.request_id || raw?.data?.request_id;

      let summary = `# Device Managed Recipes\n`;
      summary += `**Machine ID:** ${machine_id}\n`;
      if (request_id) summary += `**Request ID:** ${request_id}\n`;
      summary += `**Total Recipes:** ${recipes.length}\n`;

      for (const r of recipes) {
        summary += `\n## ${r.name || 'Unnamed recipe'}\n`;
        if (r.id) summary += `- ID: ${r.id}\n`;
        if (typeof r.can_be_edited !== 'undefined') summary += `- Editable: ${r.can_be_edited ? 'Yes' : 'No'}\n`;
        if (typeof r.can_be_deleted !== 'undefined') summary += `- Deletable: ${r.can_be_deleted ? 'Yes' : 'No'}\n`;
        if (typeof r.index !== 'undefined') summary += `- Index: ${r.index}\n`;
        if (r.metadata && Array.isArray(r.metadata) && r.metadata.length > 0) {
          const metaPairs = r.metadata.slice(0, 5).map((m: any) => `${m.name}:${m.value}`);
          summary += `- Metadata: ${metaPairs.join(', ')}${r.metadata.length > 5 ? '…' : ''}\n`;
        }
        if (r.phases && Array.isArray(r.phases)) {
          summary += `- Phases: ${r.phases.length}\n`;
          const firstPhases = r.phases.slice(0, 3);
          firstPhases.forEach((p: any, idx: number) => {
            const valuesCount = Array.isArray(p.values) ? p.values.length : 0;
            const dosagesCount = Array.isArray(p.dosages) ? p.dosages.length : 0;
            const valuesPreview = (p.values || []).slice(0, 3).map((v: any) => `${v.name}=${v.value}`).join(', ');
            summary += `  - Phase ${idx + 1}: values=${valuesCount}${valuesPreview ? ` (${valuesPreview}${valuesCount > 3 ? '…' : ''})` : ''}, dosages=${dosagesCount}\n`;
          });
        }
      }

      return success({
        text: summary,
        structured: { filters: { machine_id }, request_id, recipes },
      });
    } catch (error: any) {
      const message = `❌ Error fetching device managed recipes: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
