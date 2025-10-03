import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { fetchFirstOrganizationId } from "./organizationUtils.js";
import { THINGS5_BASE_URL } from "../config.js";
import { success, failure } from './utils/toolResult.js';

export const RolesListSchema = z.object({
  organization_id: z.string().optional().describe("Organization id (UUID). If not provided, the first organization will be used.")
});

export type RolesListArgs = z.infer<typeof RolesListSchema>;

export const getRolesListTool = (auth_token: string): Tool => ({
  name: "roles_list",
  description: `List all roles for a given organization. A role has a set of permissions granted on a group of devices
    These are the permissions on things5:
    "machines:view",
    "machines:manage",
    "machines:create",
    "machines:update_machines_group",
    "machines:delete",
    "machines:ingest_data",
    "machines:generate_certs",
    "machines:firmware_update",
    "machines:firmware:manage",
    "machines:config:manage",
    "machines:config:configuration_level_1_read",
    "machines:config:configuration_level_1_write",
    "machines:config:configuration_level_2_read",
    "machines:config:configuration_level_2_write",
    "machines:config:configuration_level_3_read",
    "machines:config:configuration_level_3_write",
    "machines:config:configuration_level_4_read",
    "machines:config:configuration_level_4_write",
    "machines:config:configuration_level_5_read",
    "machines:config:configuration_level_5_write",
    "machines:commands:execute",
    "machines_groups:manage",
    "machine_models:manage",
    "roles:manage",
    "widgets:manage",
    "users:view",
    "users:manage",
    "recipes:manage",
    "sharing:manage",
    "companies:view",
    "companies:manage",
    "service_ai:playground:view",
    "service_ai:knowledge:view",
    "service_ai:conversations:view",
    "plans:manage",
    "plans:machines:manage"
  `,
  inputSchema: zodToJsonSchema(RolesListSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    filters: RolesListSchema,
    roles: z.array(z.any()),
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: RolesListArgs;
    try {
      args = RolesListSchema.parse(rawArgs);
    } catch (e) {
      throw new Error('Invalid arguments for roles_list tool: ' + e);
    }
    let { organization_id } = args;
    if (!organization_id) {
      organization_id = await fetchFirstOrganizationId(auth_token);
    }
    const url = `${THINGS5_BASE_URL}/organizations/${encodeURIComponent(organization_id)}/roles`;
    try {
      const resp = await axios.get(url, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined
      });
      const roles = resp.data?.data ?? [];
      let summary = `# Organization Roles\n`;
      if (roles.length === 0) {
        summary += "No roles found.";
      } else {
        for (const role of roles) {
          summary += `\n## ${role.name}\n`;
          summary += `- **ID:** ${role.id}\n`;
          summary += `- **System Role:** ${role.system ? 'Yes' : 'No'}\n`;
          if (role.permissions && Array.isArray(role.permissions)) {
            summary += `- **Permissions:** ${role.permissions.map((p: any) => p.name).join(", ") || "None"}\n`;
          }
          if (role.users_create_child_roles && Array.isArray(role.users_create_child_roles) && role.users_create_child_roles.length > 0) {
            summary += `- **Child Roles:** ${role.users_create_child_roles.map((r: any) => r.name).join(", ")}\n`;
          }
        }
      }
      return success({ text: summary, structured: { filters: { organization_id }, roles } });
    } catch (error: any) {
      const message = `❌ Error fetching roles list: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
