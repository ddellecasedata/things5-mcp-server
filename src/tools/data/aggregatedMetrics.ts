import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { THINGS5_BASE_URL } from '../../config.js';
import { success, failure } from '../utils/toolResult.js';

export const AggregatedMetricsSchema = z.object({
  device_ids: z.array(z.string()).describe("Array of device ids (UUIDs)"),
  from: z.string().datetime().optional().describe("Start datetime (ISO8601, optional)"),
  to: z.string().datetime().optional().describe("End datetime (ISO8601, optional)"),
  metric_names: z.array(z.string()).optional().describe("Array of metric names to filter (optional)"),
  sorting: z.enum(['asc', 'desc']).optional().describe("Sorting order (optional)"),
  after: z.string().optional().describe("Pagination cursor (optional)"),
  limit: z.number().int().max(1000).optional().describe("Max results (optional, default 1000)")
});

export type AggregatedMetricsArgs = z.infer<typeof AggregatedMetricsSchema>;

export const getAggregatedMetricsTool = (auth_token: string): Tool => ({
  name: "aggregated_metrics",
  description: `
  Read machine_variables of type metric for multiple devices. 
  Returns a markdown summary and raw JSON.`,
  inputSchema: zodToJsonSchema(AggregatedMetricsSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    aggregated_metrics: z.array(z.any()),
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: AggregatedMetricsArgs;
    try {
      args = AggregatedMetricsSchema.parse(rawArgs);
    } catch (e) {
      throw new Error('Invalid arguments for aggregated_metrics tool: ' + e);
    }
    const { device_ids, from, to, metric_names, sorting, after, limit } = args;
    const url = `${THINGS5_BASE_URL}/metrics/aggregated`;
    const params: Record<string, any> = {};
    if (device_ids) params['device_ids[]'] = device_ids;
    if (from) params.from = from;
    if (to) params.to = to;
    if (metric_names) params['metric_names[]'] = metric_names;
    if (sorting) params.sorting = sorting;
    if (after) params.after = after;
    if (limit) params.limit = limit;
    try {
      const resp = await axios.get(url, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined,
        params
      });
      const data = resp.data?.data;
      let summary = `# Aggregated Metrics\n`;
      if (Array.isArray(data)) {
        summary += data.map((metric: any) =>
          `- **${metric.name}**: avg=${metric.avg ?? '-'}, min=${metric.min ?? '-'}, max=${metric.max ?? '-'}, last=${metric.last ?? '-'}, device=${metric.device_id ?? '-'} `
        ).join('\n');
      } else {
        summary += 'No aggregated metrics found.';
      }
      return success({ text: summary, structured: { aggregated_metrics: data ?? [] } });
    } catch (error: any) {
      const message = `❌ Error fetching aggregated metrics: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
