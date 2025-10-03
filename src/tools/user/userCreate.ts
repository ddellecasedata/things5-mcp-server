import axios from "axios";
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { fetchFirstOrganizationId } from "../organizationUtils.js";
import { THINGS5_BASE_URL } from "../../config.js";
import { success, failure } from "../utils/toolResult.js";

export const UserCreateSchema = z.object({
  email: z.string().describe('Email address of the new user'),
  first_name: z.string().describe('First name of the new user'),
  last_name: z.string().describe('Last name of the new user'),
  language: z.string().optional().describe('Language code for the user (e.g. "en", "it")'),
  role_id: z.string().optional().describe('Role ID to assign to the user'),
  password: z.string().optional().describe('Password for the user (if required by API)'),
  send_invite: z.boolean().optional().describe('Send invitation email to the user'),
});

export type UserCreateArgs = z.infer<typeof UserCreateSchema>;

export const getUserCreateTool = (auth_token: string): Tool => ({
  name: "user_create",
  description: "Create a new user in the current organization.",
  inputSchema: zodToJsonSchema(UserCreateSchema) as any,
  outputSchema: zodToJsonSchema(z.object({
    user: z.any(),
  })) as any,
  handler: async (rawArgs: unknown) => {
    let args: UserCreateArgs;
    try {
      args = UserCreateSchema.parse(rawArgs);
    } catch (e) {
      throw new Error("Invalid arguments for user_create tool: " + e);
    }
    const organization_id = await fetchFirstOrganizationId(auth_token);
    const url = `${THINGS5_BASE_URL}/organizations/${organization_id}/users`;
    const payload: Record<string, any> = {
      email: args.email,
      first_name: args.first_name,
      last_name: args.last_name,
    };
    if (args.language) payload.language = args.language;
    if (args.role_id) payload.role_id = args.role_id;
    if (args.password) payload.password = args.password;
    if (typeof args.send_invite !== 'undefined') payload.send_invite = args.send_invite;
    try {
      const resp = await axios.post(url, payload, {
        headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined
      });
      const user = resp.data?.data;
      const summary = `User **${user?.first_name ?? ''} ${user?.last_name ?? ''}** (${user?.email}) created.`;
      return success({ text: summary, structured: { user } });
    } catch (error: any) {
      const message = `❌ Error creating user: ${error.response?.data?.message || error.message}`;
      return failure({ message, status: error.response?.status, data: error.response?.data || null });
    }
  }
});
