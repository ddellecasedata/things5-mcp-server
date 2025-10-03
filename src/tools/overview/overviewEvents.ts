import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { fetchFirstOrganizationId } from "../organizationUtils.js";
import { THINGS5_BASE_URL } from "../../config.js";
import { success, failure } from "../utils/toolResult.js";
import { fixArraySchemas } from '../utils/schemaUtils.js';

export const OverviewEventsSchema = z.object({
  machine_ids: z.array(z.string()).describe('Array of machine IDs to filter events'),
  from: z.string().describe('Start date in ISO 8601 format (e.g. 2023-10-02T10:17:51.993Z)'),
  to: z.string().describe('End date in ISO 8601 format (e.g. 2023-10-05T10:17:51.993Z)'),
  after: z.string().optional().describe('Pagination cursor'),
  sorting: z.enum(['asc', 'desc']).optional().default('asc').describe('Sort order'),
  limit: z.string().optional().default('100').describe('Limit the results in the response'),
  severities: z.array(z.string()).optional().describe('Filter by severity'),
  include_severity: z.string().optional().describe('Include severity information'),
  notifications_only: z.boolean().optional().describe('Only include events that trigger notifications'),
});

export type OverviewEventsArgs = z.infer<typeof OverviewEventsSchema>;

export const getOverviewEventsTool = (auth_token: string): Tool => ({
  name: "overview_events",
  description: "Display the latest overview events for user visible devices.",
  inputSchema: fixArraySchemas(zodToJsonSchema(OverviewEventsSchema)) as any,
  outputSchema: zodToJsonSchema(z.object({
    events: z.array(z.any()),
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: OverviewEventsArgs;
    try {
      args = OverviewEventsSchema.parse(rawArgs);
    } catch (e) {
      throw new Error("Invalid arguments for overview_events tool: " + e);
    }
    
    const organization_id = await fetchFirstOrganizationId(auth_token);
    const url = `${THINGS5_BASE_URL}/organizations/${organization_id}/overview/events`;
    
    const params: Record<string, any> = {
      machine_ids: args.machine_ids,
      from: args.from,
      to: args.to,
    };
    if (args.after) params.after = args.after;
    if (args.sorting) params.sorting = args.sorting;
    if (args.limit) params.limit = args.limit;
    if (args.severities) params.severities = args.severities;
    if (args.include_severity !== undefined) params.include_severity = args.include_severity;
    if (args.notifications_only !== undefined) params.notifications_only = args.notifications_only;
    
    try {
      const resp = await axios.get(url, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined,
        params
      });
      const events = resp.data?.data ?? [];
      let summary = `# Latest Overview Events\n`;
      if (events.length === 0) {
        summary += "No overview events found.";
      } else {
        summary += events.map((e: any) => {
          const device = e.device_name ? ` | device: ${e.device_name}` : '';
          const severity = e.severity ? ` | severity: ${e.severity}` : '';
          const ts = e.timestamp ? ` | timestamp: ${e.timestamp}` : '';
          const desc = e.description ? ` | description: ${e.description}` : '';
          return `- **${e.event_type ?? e.id}**${device}${severity}${ts}${desc}`;
        }).join("\n");
      }
      return success({ text: summary, structured: { events } });
    } catch (error: any) {
      const message = `❌ Error fetching overview events: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
