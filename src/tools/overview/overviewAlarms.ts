import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { fetchFirstOrganizationId } from "../organizationUtils.js";
import { THINGS5_BASE_URL } from "../../config.js";
import { success, failure } from "../utils/toolResult.js";
import { fixArraySchemas } from '../utils/schemaUtils.js';

export const OverviewAlarmsSchema = z.object({
  from: z.string().describe('Start date in ISO 8601 format (e.g. 2023-10-02T10:17:51.993Z)'),
  to: z.string().describe('End date in ISO 8601 format (e.g. 2023-10-05T10:17:51.993Z)'),
  limit: z.string().optional().default('100').describe('Limit the results in the response'),
  after: z.string().optional().describe('Pagination cursor'),
  sorting: z.enum(['asc', 'desc']).optional().default('asc').describe('Sort order'),
});

export type OverviewAlarmsArgs = z.infer<typeof OverviewAlarmsSchema>;

export const getOverviewAlarmsTool = (auth_token: string): Tool => ({
  name: "overview_alarms",
  description: "Give an overview of the latest machine variables of source events, usually alarms, with severity 'alarm' for user visible devices.",
  inputSchema: fixArraySchemas(zodToJsonSchema(OverviewAlarmsSchema)) as any,
  outputSchema: zodToJsonSchema(z.object({
    alarms: z.array(z.any()),
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: OverviewAlarmsArgs;
    try {
      args = OverviewAlarmsSchema.parse(rawArgs);
    } catch (e) {
      throw new Error("Invalid arguments for overview_alarms tool: " + e);
    }
    
    const organization_id = await fetchFirstOrganizationId(auth_token);
    const url = `${THINGS5_BASE_URL}/organizations/${organization_id}/overview/alarms`;
    
    const params: Record<string, any> = {
      from: args.from,
      to: args.to,
    };
    if (args.limit) params.limit = args.limit;
    if (args.after) params.after = args.after;
    if (args.sorting) params.sorting = args.sorting;
    
    try {
      const resp = await axios.get(url, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined,
        params
      });
      const alarms = resp.data?.data ?? [];
      let summary = `# Latest Alarm Events\n`;
      if (alarms.length === 0) {
        summary += "No alarm events found.";
      } else {
        summary += alarms.map((a: any) => {
          const device = a.device_name ? ` | device: ${a.device_name}` : '';
          const severity = a.severity ? ` | severity: ${a.severity}` : '';
          const ts = a.timestamp ? ` | timestamp: ${a.timestamp}` : '';
          const desc = a.description ? ` | description: ${a.description}` : '';
          return `- **${a.event_type ?? a.id}**${device}${severity}${ts}${desc}`;
        }).join("\n");
      }
      return success({ text: summary, structured: { alarms } });
    } catch (error: any) {
      const message = `❌ Error fetching alarm events: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
