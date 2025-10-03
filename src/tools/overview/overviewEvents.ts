import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { fetchFirstOrganizationId } from "../organizationUtils.js";
import { THINGS5_BASE_URL } from "../../config.js";
import { success, failure } from "../utils/toolResult.js";

export const OverviewEventsSchema = z.object({});

export type OverviewEventsArgs = z.infer<typeof OverviewEventsSchema>;

export const getOverviewEventsTool = (auth_token: string): Tool => ({
  name: "overview_events",
  description: "Display the latest overview events for user visible devices.",
  inputSchema: zodToJsonSchema(OverviewEventsSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    events: z.array(z.any()),
  })) as any,
  handler: async (_rawArgs: unknown) => {
    const organization_id = await fetchFirstOrganizationId(auth_token);
    const url = `${THINGS5_BASE_URL}/organizations/${organization_id}/overview/events`;
    try {
      const resp = await axios.get(url, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined
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
