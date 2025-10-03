import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { THINGS5_BASE_URL } from '../../config.js';
import { success, failure } from '../utils/toolResult.js';

export const EventsReadSchema = z.object({
  device_id: z.string().describe("Device id (UUID)"),
  from: z.string().datetime().describe("Start datetime (ISO8601)"),
  to: z.string().datetime().describe("End datetime (ISO8601)"),
  events_names: z.array(z.string()).optional().describe("Array of event names to filter (optional)"),
  sorting: z.enum(['asc', 'desc']).optional().describe("Sorting order (optional)"),
  after: z.string().optional().describe("Pagination cursor (optional)"),
  severity: z.array(z.string()).optional().describe("Array of severities to filter (optional)"),
  limit: z.number().int().max(1000).optional().describe("Max results (optional, default 1000)")
});

export type EventsReadArgs = z.infer<typeof EventsReadSchema>;

export const getEventsReadTool = (auth_token: string): Tool => ({
  name: "events_read",
  description: `
  Read  a machine_variable of type event, usually it's an alarm. 
  Note that to know that a machine variable is an event you must first get the machine firmware and see that machine_variable type is event
  Returns a markdown summary and raw JSON.`,
  inputSchema: zodToJsonSchema(EventsReadSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    events: z.array(z.any()),
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: EventsReadArgs;
    try {
      args = EventsReadSchema.parse(rawArgs);
    } catch (e) {
      throw new Error('Invalid arguments for events_read tool: ' + e);
    }
    const { device_id, from, to, events_names, sorting, after, severity, limit } = args;
    const url = `${THINGS5_BASE_URL}/devices/${encodeURIComponent(device_id)}/events`;
    const params: Record<string, any> = { from, to };
    if (events_names) params.events_names = events_names;
    if (sorting) params.sorting = sorting;
    if (after) params.after = after;
    if (severity) params['severity[]'] = severity;
    if (limit) params.limit = limit;
    try {
      const resp = await axios.get(url, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined,
        params
      });
      const data = resp.data?.data;
      let summary = `# Device Events\n`;
      if (Array.isArray(data)) {
        summary += data.map((event: any) =>
          `- **${event.name}**: ${event.timestamp}`
        ).join('\n');
      } else {
        summary += 'No events found.';
      }
      return success({ text: summary, structured: { events: data ?? [] } });
    } catch (error: any) {
      const message = `❌ Error fetching device events: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
