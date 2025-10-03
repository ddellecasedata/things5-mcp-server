import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { THINGS5_BASE_URL } from '../../config.js';
import { success, failure } from '../utils/toolResult.js';

// Input schema: device_id and parameter_label
export const ReadSingleParameterSchema = z.object({
  device_id: z.string().describe("Device id"),
  parameter_label: z.string().describe("Label of the parameter to read")
});

export type ReadSingleParameterArgs = z.infer<typeof ReadSingleParameterSchema>;

export const getReadSingleParameterTool = (auth_token: string): Tool => ({
  name: "read_single_parameter",
  description: `Read a single machine_variable of type parameter from a things5 device, by parameter label.
  Do not use this tool unless you are 100% sure that the machine variable is a parameter.
  Note that to know that a machine variable is a parameter you must first get the machine firmware and see that machine_variable type is parameter
   Maps the label to the parameter name using the device firmware detail endpoint, then reads the parameter value. 
   `,
  inputSchema: zodToJsonSchema(ReadSingleParameterSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    filters: ReadSingleParameterSchema,
    parameters: z.array(z.any()),
    request_id: z.string().optional(),
  })) as any,
  handler: async (rawArgs: unknown) => {
    console.log('[read_single_parameter] rawArgs:', JSON.stringify(rawArgs));
    let args: ReadSingleParameterArgs;
    try {
      args = ReadSingleParameterSchema.parse(rawArgs);
    } catch (e) {
      console.error('[read_single_parameter] Zod parse error:', e);
      throw e;
    }
    const { device_id, parameter_label } = args;
    // 1. Get organization_id dynamically
    // 2. Get device firmware details (for machine_variables)
    // Reuse fetchFirstOrganizationId utility
    // Import at top:
    // import { fetchFirstOrganizationId } from './organizationUtils.js';
    const { fetchFirstOrganizationId } = await import('../organizationUtils.js');
    const organization_id = await fetchFirstOrganizationId(auth_token);
    const firmwareUrl = `${THINGS5_BASE_URL}/organizations/${encodeURIComponent(organization_id)}/machines/${encodeURIComponent(device_id)}/machine_firmware`;
    let machine_variables: any[] = [];
    try {
      const firmwareResp = await axios.get(firmwareUrl, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined
      });
      machine_variables = firmwareResp.data?.data?.machine_variables || [];
    } catch (err: any) {
      const message = `❌ Error fetching device firmware details: ${err.response?.data?.message || err.message}`;
      return failure({ message, status: err.response?.status, data: err.response?.data || null });
    }
    // 2. Map label to name
    const param = machine_variables.find((v: any) => v.label === parameter_label);
    if (!param) {
      return failure({ message: `❌ Parameter with label '${parameter_label}' not found for device ${device_id}` });
    }
    const parameter_name = param.name;
    // 3. Read parameter value using read_parameters logic
    const paramsUrl = `${THINGS5_BASE_URL}/devices/${encodeURIComponent(device_id)}/parameters`;
    try {
      const response = await axios.get(paramsUrl, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined,
        params: { "configuration_filter[]": [parameter_name] }
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
          ? `✅ Read parameter '${parameter_label}' (name: '${parameter_name}') for device ${device_id}`
          : `ℹ️ No parameter found for device ${device_id}`
      ];
      if (parameters.length > 0) {
        summaryLines.push('\n---');
        summaryLines.push('| Asset | Name | Type | Value |');
        summaryLines.push('|-------|------|------|-------|');
        for (const p of parameters) {
          summaryLines.push(`| ${p.asset} | ${p.name} | ${p.type} | ${p.value} |`);
        }
      }
      return success({ text: summaryLines.join('\n'), structured: { filters: args, parameters, request_id: raw.request_id } });
    } catch (error: any) {
      const message = `❌ Error reading parameter: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
