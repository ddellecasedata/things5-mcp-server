import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { THINGS5_BASE_URL } from '../../config.js';
import { success, failure } from '../utils/toolResult.js';
import { fixArraySchemas } from '../utils/schemaUtils.js';

export const MetricsReadSchema = z.object({
  device_id: z.string().optional().describe("Device ID (UUID). If not provided, use device_name or serial"),
  device_name: z.string().optional().describe("Device name for auto-resolution (alternative to device_id)"),
  serial: z.string().optional().describe("Device serial number for auto-resolution (alternative to device_id)"),
  from: z.string().datetime().optional().describe("Start datetime (ISO8601, optional)"),
  to: z.string().datetime().optional().describe("End datetime (ISO8601, optional)"),
  metric_names: z.array(z.string()).optional().describe("Array of metric names to filter (optional)"),
  sorting: z.enum(['asc', 'desc']).optional().describe("Sorting order (optional)"),
  after: z.string().optional().describe("Pagination cursor (optional)"),
  last_value: z.boolean().optional().describe("Return only last value for each metric (optional)"),
  limit: z.number().int().max(1000).optional().describe("Max results (optional, default 1000)")
}).refine(
  data => data.device_id || data.device_name || data.serial,
  { message: "Must provide either device_id, device_name, or serial" }
);

export type MetricsReadArgs = z.infer<typeof MetricsReadSchema>;

export const getMetricsReadTool = (auth_token: string): Tool => ({
  name: "metrics_read",
  description: `
  Read a machine_variable of type metric from a device. If interested only in the last value of a metric provide last_value param. Otherwise from and to parameters are required.
  Note that to know that a machine_variable is a metric you must first get the machine firmware and see that machine_variable type is metric
  Returns a markdown summary and raw JSON.`,
  inputSchema: fixArraySchemas(zodToJsonSchema(MetricsReadSchema)) as any,
  outputSchema: zodToJsonSchema(z.object({
    metrics: z.array(z.any()),
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: MetricsReadArgs;
    try {
      args = MetricsReadSchema.parse(rawArgs);
    } catch (e) {
      throw new Error('Invalid arguments for metrics_read tool: ' + e);
    }
    const { device_id, from, to, metric_names, sorting, after, last_value, limit } = args;
    
    // device_id should be present after auto-resolution
    if (!device_id) {
      throw new Error('device_id is required (should be auto-resolved from device_name or serial)');
    }
    
    const url = `${THINGS5_BASE_URL}/devices/${encodeURIComponent(device_id)}/metrics`;
    const params: Record<string, any> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    if (metric_names) params['metric_names[]'] = metric_names;
    if (sorting) params.sorting = sorting;
    if (after) params.after = after;
    if (typeof last_value !== 'undefined') params.last_value = last_value;
    if (limit) params.limit = limit;
    console.log('params:', params);
    try {
      const resp = await axios.get(url, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined,
        params
      });
      console.log('resp:', JSON.stringify(resp.data));
      const data = resp.data?.data;
      let summary = `# Device Metrics\n`;
      if (Array.isArray(data)) {
        if (last_value === true) {
          summary += data.map((metric: any) =>
            `- **${metric.name}**: value=${metric.value ?? '-'} `
          ).join('\n');
        } else {
          summary += data.map((metric: any) =>
            `- **${metric.name}**: avg=${metric.avg ?? '-'}, min=${metric.min ?? '-'}, max=${metric.max ?? '-'}, last=${metric.last ?? '-'}, timestamp=${metric.timestamp ?? '-'} `
          ).join('\n');
        }
      } else {
        summary += 'No metrics found.';
      }
      return success({ text: summary, structured: { metrics: data ?? [] } });
    } catch (error: any) {
      const message = `❌ Error fetching device metrics: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
