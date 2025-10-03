import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { fetchFirstOrganizationId } from "../organizationUtils.js";
import { THINGS5_BASE_URL } from "../../config.js";
import { success, failure } from "../utils/toolResult.js";

export const UsersDetailSchema = z.object({
  user_id: z.string().describe('ID of the user to fetch details for'),
});

export type UsersDetailArgs = z.infer<typeof UsersDetailSchema>;

export const getUsersDetailTool = (auth_token: string): Tool => ({
  name: "users_detail",
  description: "Show details of a specific user by user_id.",
  inputSchema: zodToJsonSchema(UsersDetailSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    filters: UsersDetailSchema,
    user: z.any().nullable(),
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: UsersDetailArgs;
    try {
      args = UsersDetailSchema.parse(rawArgs);
    } catch (e) {
      throw new Error("Invalid arguments for users_detail tool: " + e);
    }
    const { user_id } = args;
    const organization_id = await fetchFirstOrganizationId(auth_token);
    const url = `${THINGS5_BASE_URL}/organizations/${organization_id}/users/${encodeURIComponent(user_id)}`;
    try {
      const resp = await axios.get(url, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined
      });
      const user = resp.data?.data;
      if (!user) {
        return success({ text: `No user found with id: ${user_id}`, structured: { filters: args, user: null } });
      }
      let summary = `# User: ${user.first_name ?? ''} ${user.last_name ?? ''}\n`;
      summary += `- id: ${user.id}\n`;
      summary += user.email ? `- email: ${user.email}\n` : '';
      summary += user.language ? `- language: ${user.language}\n` : '';
      summary += user.role?.name ? `- role: ${user.role.name}\n` : '';
      summary += user.machines_count !== undefined ? `- machines_count: ${user.machines_count}\n` : '';
      if (user.user_organization) {
        summary += `- organization_id: ${user.user_organization.organization_id}\n`;
        if (user.user_organization.custom_attributes) {
          summary += `- organization custom attributes: ${JSON.stringify(user.user_organization.custom_attributes)}\n`;
        }
      }
      if (user.user_machines_groups && user.user_machines_groups.length > 0) {
        summary += `- machines groups:\n`;
        for (const mg of user.user_machines_groups) {
          summary += `  - group_id: ${mg.machines_group_id}`;
          if (mg.role?.name) summary += ` | role: ${mg.role.name}`;
          if (mg.role?.permissions && mg.role.permissions.length > 0) {
            summary += ` | permissions: ${mg.role.permissions.map((p: any) => p.name).join(', ')}`;
          }
          summary += '\n';
        }
      }
      return success({ text: summary, structured: { filters: args, user } });
    } catch (error: any) {
      const message = `❌ Error fetching user: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
