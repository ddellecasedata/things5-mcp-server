import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { THINGS5_BASE_URL } from '../config.js';
import { success, failure } from './utils/toolResult.js';

// No input schema needed, as organization_id is fetched dynamically
export const OrganizationDetailSchema = z.object({});
export type OrganizationDetailArgs = z.infer<typeof OrganizationDetailSchema>;

import { fetchFirstOrganizationId } from './organizationUtils.js';

export const getOrganizationDetailTool = (auth_token: string): Tool => ({
  name: "organization_detail",
  description: `Get the details of an organization, including custom attributes and permissions. Uses the organization-detail endpoint from the API.`,
  inputSchema: zodToJsonSchema(OrganizationDetailSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    organization: z.any(),
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: OrganizationDetailArgs;
    try {
      args = OrganizationDetailSchema.parse(rawArgs);
    } catch (e) {
      throw new Error('Invalid arguments for organization_detail tool: ' + e);
    }
    const organization_id = await fetchFirstOrganizationId(auth_token);
    const url = `${THINGS5_BASE_URL}/organizations/${encodeURIComponent(organization_id)}`;
    try {
      const resp = await axios.get(url, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined
      });
      const data = resp.data?.data;
      // Format the custom attributes for markdown output
      let summary = `# Organization Detail\n`;
      summary += `**ID:** ${data.id}\n`;
      summary += `**Name:** ${data.name}\n`;

      if (Array.isArray(data.custom_attributes) && data.custom_attributes.length > 0) {
        summary += `\n## Custom Attributes\n`;
        summary += `| Key | Label | Type | Required |\n`;
        summary += `|-----|-------|------|----------|\n`;
        for (const attr of data.custom_attributes) {
          summary += `| ${attr.key} | ${attr.label} | ${attr.type} | ${attr.required ? 'Yes' : 'No'} |\n`;
        }
      }
      if (Array.isArray(data.custom_permissions) && data.custom_permissions.length > 0) {
        summary += `\n## Custom Permissions\n`;
        summary += JSON.stringify(data.custom_permissions, null, 2) + '\n';
      }
      return success({ text: summary, structured: { organization: data } });
    } catch (error: any) {
      const message = `❌ Error fetching organization details: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
