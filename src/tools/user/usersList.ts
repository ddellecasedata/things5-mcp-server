import axios from "axios";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { THINGS5_BASE_URL } from '../../config.js';
import { fetchFirstOrganizationId } from '../organizationUtils.js';
import { success, failure } from '../utils/toolResult.js';
import { fixArraySchemas } from '../utils/schemaUtils.js';

export const UsersListSchema = z.object({
  search: z.string().optional().describe('Optional search string to filter users by name/email'),
  machines_groups_ids: z.array(z.string()).optional().describe('Optional array of machine group IDs to filter users associated with at least one of them'),
  after: z.string().optional().describe('Pagination cursor'),
  limit: z.number().int().optional().describe('Optional limit for the number of users to return'),
});

export type UsersListArgs = z.infer<typeof UsersListSchema>;

export const getUsersListTool = (auth_token: string): Tool => ({
  name: "users_list",
  description: "List all users for the current organization.",
  inputSchema: fixArraySchemas(zodToJsonSchema(UsersListSchema)) as any,
  outputSchema: zodToJsonSchema(z.object({
    filters: UsersListSchema,
    users: z.array(z.any()),
    pagination: z.any().nullable(),
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: UsersListArgs;
    try {
      args = UsersListSchema.parse(rawArgs);
    } catch (e) {
      console.log(e)
      throw new Error("Invalid arguments for users_list tool: " + e);
    }
    const { search, machines_groups_ids, after, limit } = args;
    const organization_id = await fetchFirstOrganizationId(auth_token);
    const url = `${THINGS5_BASE_URL}/organizations/${organization_id}/users`;
    const params: Record<string, any> = {};
    if (search) params.search = search;
    if (machines_groups_ids && machines_groups_ids.length > 0) params.machines_groups_ids = machines_groups_ids;
    if (after) params.after = after;
    if (typeof limit !== 'undefined') params.limit = limit;
    try {
      const resp = await axios.get(url, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined,
        params
      });
      const users = resp.data?.data ?? [];
      const pagination = resp.data?.pagination ?? null;
      let summary = `# Users List\n`;
      if (users.length === 0) {
        summary += "No users found.";
      } else {
        summary += users.map((u: any) => {
          const firstName = u.first_name ? ` | first_name: ${u.first_name}` : '';
          const lastName = u.last_name ? ` | last_name: ${u.last_name}` : '';
          const email = u.email ? ` | email: ${u.email}` : '';
          const role = u.role?.name ? ` | role: ${u.role.name}` : '';
          const machinesCount = typeof u.machines_count !== 'undefined' ? ` | machines_count: ${u.machines_count}` : '';
          return `- **${u.first_name ?? ''} ${u.last_name ?? ''}** (id: ${u.id}${firstName}${lastName}${email}${role}${machinesCount})`;
        }).join("\n");
      }
      return success({ text: summary, structured: { filters: args, users, pagination } });
    } catch (error: any) {
      const message = `❌ Error fetching users: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
