import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { fetchFirstOrganizationId } from "./organizationUtils.js";
import { THINGS5_BASE_URL } from "../config.js";
import { success, failure } from './utils/toolResult.js';

export const CreateDeviceGroupUserSchema = z.object({
  group_id: z.string().describe('ID of the device group'),
  user_id: z.string().describe('ID of the user to add to the device group'),
  role: z.string().optional().describe('Optional role to assign to the user in the group'),
});

export type CreateDeviceGroupUserArgs = z.infer<typeof CreateDeviceGroupUserSchema>;

export const getCreateDeviceGroupUserTool = (auth_token: string): Tool => ({
  name: "create_device_group_user",
  description: "Add a user to a device group, optionally assigning a role.",
  inputSchema: zodToJsonSchema(CreateDeviceGroupUserSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    filters: CreateDeviceGroupUserSchema,
    result: z.any(),
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: CreateDeviceGroupUserArgs;
    try {
      args = CreateDeviceGroupUserSchema.parse(rawArgs);
    } catch (e) {
      throw new Error("Invalid arguments for create_device_group_user tool: " + e);
    }
    const { group_id, user_id, role } = args;
    const organization_id = await fetchFirstOrganizationId(auth_token);
    const url = `${THINGS5_BASE_URL}/organizations/${organization_id}/device_groups/${encodeURIComponent(group_id)}/users`;
    const payload: Record<string, any> = { user_id };
    if (role) payload.role = role;
    try {
      const resp = await axios.post(url, payload, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined
      });
      const result = resp.data?.data;
      let summary = `User **${user_id}** added to device group **${group_id}**`;
      if (role) summary += ` with role **${role}**`;
      return success({ text: summary, structured: { filters: args, result } });
    } catch (error: any) {
      const message = `❌ Error adding user to device group: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
