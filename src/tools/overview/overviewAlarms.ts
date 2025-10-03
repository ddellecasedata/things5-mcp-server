import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { fetchFirstOrganizationId } from "../organizationUtils.js";
import { THINGS5_BASE_URL } from "../../config.js";
import { success, failure } from "../utils/toolResult.js";

export const OverviewAlarmsSchema = z.object({});

export type OverviewAlarmsArgs = z.infer<typeof OverviewAlarmsSchema>;

export const getOverviewAlarmsTool = (auth_token: string): Tool => ({
  name: "overview_alarms",
  description: "Give an overview of the latest machine variables of source events, usually alarms, with severity 'alarm' for user visible devices.",
  inputSchema: zodToJsonSchema(OverviewAlarmsSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    alarms: z.array(z.any()),
  })) as any,
  handler: async (_rawArgs: unknown) => {
    const organization_id = await fetchFirstOrganizationId(auth_token);
    const url = `${THINGS5_BASE_URL}/organizations/${organization_id}/overview/alarms`;
    try {
      const resp = await axios.get(url, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined
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
