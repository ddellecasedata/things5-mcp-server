import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { THINGS5_BASE_URL } from '../../config.js';
import { success, failure } from '../utils/toolResult.js';

// Schema basato su OpenAPI
export const ReadParametersSchema = z.object({
  device_id: z.string().describe("Device id"),
  parameter_name_list: z.array(z.string()).optional().describe("Optional. Read only the provided parameters.")
});

export type ReadParametersArgs = z.infer<typeof ReadParametersSchema>;


export const getReadParametersTool = (auth_token: string): Tool => ({
  name: "read_parameters",
  description: `Read machine_variables of type parameter from a things5 device. 
  Do not use this tool unless you are 100% sure that the machine variable is a parameter.
  Note that to know that a machine variable is a parameter you must first get the machine firmware and see that machine_variable type is parameter.
  Parameters represents the state of a device. 
  The parameters are the variables found in the device menu.


  Usage examples:
    - "read parameters from device fridge-01" → reads all parameters from device fridge-01
  `,
  inputSchema: zodToJsonSchema(ReadParametersSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    parameters: z.array(z.object({
      asset: z.string(),
      name: z.string(),
      type: z.any(),
      value: z.any(),
    })),
    request_id: z.string().optional(),
  })) as any,
  handler: async (rawArgs: unknown) => {
    console.log('[read_parameters] rawArgs:', JSON.stringify(rawArgs));
    let args: ReadParametersArgs;
    try {
      args = ReadParametersSchema.parse(rawArgs);
    } catch (e) {
      console.error('[read_parameters] Zod parse error:', e);
      throw e;
    }
    console.log('[read_parameters] args:', args);
    const url = `${THINGS5_BASE_URL}/devices/${encodeURIComponent(args.device_id)}/parameters`;
    try {
      const response = await axios.get(url, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined,
        params: args.parameter_name_list ? { "configuration_filter[]": args.parameter_name_list } : undefined
      });
      const raw = response.data;
      // Normalizza assets/values
      const parameters = (raw.assets || []).flatMap((asset: any) =>
        (asset.values || []).map((v: any) => ({
          asset: asset.name,
          name: v.name,
          type: v.type,
          value: v.value
        }))
      );
      const summaryLines = [
        parameters.length > 0
          ? `✅ Read (${parameters.length}) parameters for device ${args.device_id}`
          : `ℹ️ No parameter found for device ${args.device_id}`
      ];
      if (parameters.length > 0) {
        summaryLines.push('\n---');
        summaryLines.push('| Asset | Name | Type | Value |');
        summaryLines.push('|-------|------|------|-------|');
        for (const p of parameters) {
          summaryLines.push(`| ${p.asset} | ${p.name} | ${p.type} | ${p.value} |`);
        }
      }
      return success({ text: summaryLines.join('\n'), structured: { parameters, request_id: raw.request_id } });
    } catch (error: any) {
      const message = `❌ Error reading parameters: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
