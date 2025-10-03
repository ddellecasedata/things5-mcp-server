import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { fetchFirstOrganizationId } from "./organizationUtils.js";
import { THINGS5_BASE_URL } from "../config.js";
import { success, failure } from "./utils/toolResult.js";

export const ShowDeviceGroupSchema = z.object({
  group_id: z.string().describe("ID of the device group to show"),
});

export type ShowDeviceGroupArgs = z.infer<typeof ShowDeviceGroupSchema>;

export const getShowDeviceGroupTool = (auth_token: string): Tool => ({
  name: "show_device_group",
  description: "Show details of a specific device group by group_id.",
  inputSchema: zodToJsonSchema(ShowDeviceGroupSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    filters: ShowDeviceGroupSchema,
    group: z.any().nullable(),
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: ShowDeviceGroupArgs;
    try {
      args = ShowDeviceGroupSchema.parse(rawArgs);
    } catch (e) {
      throw new Error("Invalid arguments for show_device_group tool: " + e);
    }
    const { group_id } = args;
    const organization_id = await fetchFirstOrganizationId(auth_token);
    const url = `${THINGS5_BASE_URL}/organizations/${organization_id}/device_groups/${encodeURIComponent(group_id)}`;
    try {
      const resp = await axios.get(url, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined
      });
      const group = resp.data?.data;
      if (!group) {
        return success({ text: `No device group found with id: ${group_id}` , structured: { filters: args, group: null } });
      }
      let summary = `# Device Group: ${group.name ?? group.id}\n`;
      summary += `- id: ${group.id}\n`;
      if (group.category?.name) summary += `- category: ${group.category.name}\n`;
      if (group.category_id) summary += `- category_id: ${group.category_id}\n`;
      if (group.parent_id) summary += `- parent_id: ${group.parent_id}\n`;
      if (group.organization_id) summary += `- organization_id: ${group.organization_id}\n`;
      return success({ text: summary, structured: { filters: args, group } });
    } catch (error: any) {
      const message = `❌ Error fetching device group: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
