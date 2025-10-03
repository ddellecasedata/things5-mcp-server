import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { fetchFirstOrganizationId } from "./organizationUtils.js";
import { THINGS5_BASE_URL } from "../config.js";
import { success, failure } from './utils/toolResult.js';

export const DevicesGroupsListSchema = z.object({
  parent_group_id: z.string().optional().describe("Optional parent group ID to filter device groups by parent"),
});

export type DevicesGroupsListArgs = z.infer<typeof DevicesGroupsListSchema>;

export const getDevicesGroupsListTool = (auth_token: string): Tool => ({
  name: "devices_groups_list",
  description: "List all device groups for the current organization, optionally filtered by parent_group_id.",
  inputSchema: zodToJsonSchema(DevicesGroupsListSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    filters: DevicesGroupsListSchema,
    groups: z.array(z.any()),
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: DevicesGroupsListArgs;
    try {
      args = DevicesGroupsListSchema.parse(rawArgs);
    } catch (e) {
      throw new Error("Invalid arguments for devices_groups_list tool: " + e);
    }
    const { parent_group_id } = args;
    const organization_id = await fetchFirstOrganizationId(auth_token);
    const url = `${THINGS5_BASE_URL}/organizations/${organization_id}/machines_groups`;
    const params: Record<string, any> = {};
    if (parent_group_id) params.parent_group_id = parent_group_id;
    try {
      const resp = await axios.get(url, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined,
        params
      });
      const groups = resp.data?.data ?? [];
      let summary = `# Device Groups List\n`;
      if (groups.length === 0) {
        summary += "No device groups found.";
      } else {
        summary += groups.map((g: any) => {
          const name = g.name ? ` | name: ${g.name}` : '';
          const id = g.id ? ` | id: ${g.id}` : '';
          const category = g.category_name ? ` | category: ${g.category_name}` : '';
          const parent = g.parent_id ? ` | parent_id: ${g.parent_id}` : '';
          const categoryId = g.category_id ? ` | category_id: ${g.category_id}` : '';
          return `- ${name}${id}${category}${parent}${categoryId}`;
        }).join("\n");
      }
      return success({ text: summary, structured: { filters: args, groups } });
    } catch (error: any) {
      const message = `❌ Error fetching device groups: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
