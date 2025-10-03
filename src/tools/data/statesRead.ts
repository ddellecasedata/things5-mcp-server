import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { THINGS5_BASE_URL } from '../../config.js';
import { success, failure } from '../utils/toolResult.js';
import { fixArraySchemas } from '../utils/schemaUtils.js';

export const StatesReadSchema = z.object({
  device_id: z.string().describe("Device id (UUID)"),
  from: z.string().datetime().describe("Start datetime (ISO8601)"),
  to: z.string().datetime().describe("End datetime (ISO8601)"),
  states_names: z.array(z.string()).optional().describe("Array of state names to filter (optional)"),
  sorting: z.enum(['asc', 'desc']).optional().describe("Sorting order (optional)"),
  after: z.string().optional().describe("Pagination cursor (optional)"),
  include_translations: z.boolean().optional().describe("Include translations in results (optional)"),
  limit: z.number().int().max(1000).optional().describe("Max results (optional, default 1000)")
});

export type StatesReadArgs = z.infer<typeof StatesReadSchema>;

export const getStatesReadTool = (auth_token: string): Tool => ({
  name: "states_read",
  description: `
  Read a machine_variable from a device. 
  Note that to know that a machine_variable is a state you must first get the machine firmware and see that machine_variable type is state
  Returns a markdown summary and raw JSON.`,
  inputSchema: fixArraySchemas(zodToJsonSchema(StatesReadSchema)) as any,
  outputSchema: zodToJsonSchema(z.object({
    states: z.array(z.any()),
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: StatesReadArgs;
    try {
      args = StatesReadSchema.parse(rawArgs);
    } catch (e) {
      throw new Error('Invalid arguments for states_read tool: ' + e);
    }
    const { device_id, from, to, states_names, sorting, after, include_translations, limit } = args;
    const url = `${THINGS5_BASE_URL}/devices/${encodeURIComponent(device_id)}/states`;
    const params: Record<string, any> = { from, to };
    if (states_names) params.states_names = states_names;
    if (sorting) params.sorting = sorting;
    if (after) params.after = after;
    if (typeof include_translations !== 'undefined') params.include_translations = include_translations;
    if (limit) params.limit = limit;
    try {
      const resp = await axios.get(url, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined,
        params
      });
      const data = resp.data?.data;
      let summary = `# Device States\n`;
      if (Array.isArray(data)) {
        summary += data.map((state: any) =>
          `- **${state.name}**: ${state.value} (_${state.start_time}_ → _${state.end_time || '...'}_)` + (state.translation ? ` (${state.translation})` : '')
        ).join('\n');
      } else {
        summary += 'No states found.';
      }
      return success({ text: summary, structured: { states: data ?? [] } });
    } catch (error: any) {
      const message = `❌ Error fetching device states: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});

