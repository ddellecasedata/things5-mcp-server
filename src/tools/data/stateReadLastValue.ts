import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { THINGS5_BASE_URL } from '../../config.js';
import { success, failure } from '../utils/toolResult.js';

export const StateReadLastValueSchema = z.object({
  device_id: z.string().describe("Device id (UUID)"),
  states_names: z.array(z.string()).optional().describe("Array of state names to filter (optional)")
});

export type StateReadLastValueArgs = z.infer<typeof StateReadLastValueSchema>;

export const getStateReadLastValueTool = (auth_token: string): Tool => ({
  name: "state_read_last_value",
  description: `
  Read the last value of a machine_variable of type state from a device.
  Note that to know that a machine_variable is a state you must first get the machine firmware and see that machine_variable type is state
  Returns a markdown summary and raw JSON.`,
  inputSchema: zodToJsonSchema(StateReadLastValueSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    last_states: z.array(z.any()),
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: StateReadLastValueArgs;
    try {
      args = StateReadLastValueSchema.parse(rawArgs);
    } catch (e) {
      throw new Error('Invalid arguments for state_read_last_value tool: ' + e);
    }
    const { device_id, states_names } = args;
    const url = `${THINGS5_BASE_URL}/devices/${encodeURIComponent(device_id)}/last_states`;
    const params: Record<string, any> = {};
    if (states_names) params.states_names = states_names;
    try {
      const resp = await axios.get(url, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined,
        params
      });
      const data = resp.data?.data;
      let summary = `# Device Last State Values\n`;
      if (Array.isArray(data)) {
        summary += data.map((state: any) =>
          `- **${state.name}**: ${state.value} (_${state.start_time}_ → _${state.end_time || '...'}_)` + (state.label ? ` (${state.label})` : '')
        ).join('\n');
      } else {
        summary += 'No last state values found.';
      }
      return success({ text: summary, structured: { last_states: data ?? [] } });
    } catch (error: any) {
      const message = `❌ Error fetching last state values: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
