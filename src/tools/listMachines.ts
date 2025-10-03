import { Tool } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { THINGS5_BASE_URL } from '../config.js';
import { fetchFirstOrganizationId } from './organizationUtils.js';
import { success, failure } from './utils/toolResult.js';

// ---------------- Schema ----------------
export const ListMachinesSchema = z.object({
  serial: z.string().optional().describe("Filter by exact device serial number (e.g. 'JI1479724')"),
  search: z.string().optional().describe("Search in machine name and serial number (partial match)"),
  is_connected: z.boolean().optional().describe("Optionally filter by connection status: true for connected devices, false for disconnected"),
  machine_groups_ids: z.array(z.string()).optional().describe("Filter by machine group IDs (array of group IDs)"),
  machine_model_ids: z.array(z.string()).optional().describe("Filter by machine model IDs (array of model IDs)"),
  no_group_assigned: z.boolean().optional().describe("Set to true to show only machines without assigned groups"),
  include_machine_model: z.boolean().optional().default(false).describe("Include detailed machine model information in response"),
  include_machines_group: z.boolean().optional().default(false).describe("Include machine group information in response"),
  include_machine_plans: z.boolean().optional().default(false).describe("Include machine plans information in response"),
  limit: z.number().int().positive().default(50).describe("Page size (number of results to return). Default: 50"),
  after: z.string().optional().describe("Pagination cursor - use this to get next page of results."),
});

// ---------------- Types ----------------
export type ListMachinesArgs = z.infer<typeof ListMachinesSchema>;

interface MachineModel { id: string; name: string; }
interface MachineGroup { id: string; name: string; }
interface Machine {
  active: boolean;
  id: string;
  is_connected: boolean;
  last_seen: string | null;
  machine_firmware_id: string | null;
  machine_plans: any | null;
  machines_group: MachineGroup | null;
  machine_model?: MachineModel;
  name: string;
  serial: string;
}

interface ApiResponse {
  data: Machine[];
  pagination: { after: string; total_count: number };
}

// ---------------- Factory ----------------

// Utility to clean query params: removes undefined, null, empty strings and empty arrays.
const cleanQueryParams = (args: ListMachinesArgs): Record<string, any> => {
  const params: Record<string, any> = {};
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed === "") continue;
      params[key] = trimmed;
      continue;
    }
    if (Array.isArray(value)) {
      const filtered = value.filter((v) => {
        if (v === undefined || v === null) return false;
        const s = String(v).trim();
        return s !== "";
      });
      if (filtered.length === 0) continue;
      params[key] = filtered;
      continue;
    }
    // keep booleans (including false) and numbers (including 0)
    params[key] = value;
  }
  return params;
};

export const getListMachinesTool = (auth_token: string): Tool => {
  console.log(zodToJsonSchema(ListMachinesSchema))
  const schem = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
      "serial": {
        "type": "string",
        "description": "Filter by exact device serial number (e.g. 'JI1479724')"
      },
      "search": {
        "type": "string",
        "description": "Search in machine name and serial number (partial match)"
      },
      "is_connected": {
        "type": "boolean",
        "description": "Optionally filter by connection status: true for connected devices, false for disconnected"
      },
      "machine_groups_ids": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "description": "Filter by machine group IDs (array of group IDs)"
      },
      "machine_model_ids": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "description": "Filter by machine model IDs (array of model IDs)"
      },
      "no_group_assigned": {
        "type": "boolean",
        "description": "Set to true to show only machines without assigned groups"
      },
      "include_machine_model": {
        "type": "boolean",
        "default": false,
        "description": "Include detailed machine model information in response"
      },
      "include_machines_group": {
        "type": "boolean",
        "default": false,
        "description": "Include machine group information in response"
      },
      "include_machine_plans": {
        "type": "boolean",
        "default": false,
        "description": "Include machine plans information in response"
      },
      "limit": {
        "type": "integer",
        "exclusiveMinimum": 0,
        "default": 50,
        "description": "Page size (number of results to return). Default: 50"
      },
      "after": {
        "type": "string",
        "description": "Pagination cursor - use this to get next page of results."
      }
    },
    "required": [],
    "additionalProperties": false
  }
  return {
    name: "list_machines",
    description: "List IoT devices with extensive filtering. This is a paginated resource (default page size: 50). If the machine you are looking for is not in the current page, I can fetch more results using the `after` cursor, or you can provide a `search` filter to narrow results.",
    inputSchema: schem as any,
    // Output schema describes the shape of structuredContent
    outputSchema: zodToJsonSchema(z.object({
      filters: ListMachinesSchema,
      totals: z.object({ total: z.number(), active: z.number(), connected: z.number(), offline: z.number() }),
      pagination: z.object({ after: z.string() }).nullable(),
      items: z.array(z.object({
        id: z.string(),
        name: z.string(),
        serial: z.string(),
        active: z.boolean(),
        is_connected: z.boolean(),
        last_seen: z.string().nullable(),
        machines_group: z.object({ id: z.string(), name: z.string() }).nullable(),
        machine_model: z.object({ id: z.string(), name: z.string() }).nullable(),
      })),
    })) as any,
    handler: async (rawArgs: unknown) => {
      const validatedArgs = ListMachinesSchema.parse(rawArgs);
      try {
        const organization_id = await fetchFirstOrganizationId(auth_token);
        const params = cleanQueryParams(validatedArgs);
        const apiResponse = await axios.get<ApiResponse>(`${THINGS5_BASE_URL}/organizations/${organization_id}/devices`, {
          params,
          headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined,
        });

        const machines: Machine[] = Array.isArray(apiResponse.data)
          ? (apiResponse.data as any)
          : apiResponse.data.data || [];
        const hasMore = apiResponse.data.pagination?.after

        const pageTotal = machines.length;
        const active = machines.filter((m) => m.active).length;
        const connected = machines.filter((m) => m.is_connected).length;
        const totalCount = apiResponse.data.pagination.total_count

        const summaryLines: string[] = [];
        summaryLines.push("📊 **Things5 IoT Devices**\n");
        summaryLines.push(`➡️ Paginated results. Showing up to ${validatedArgs.limit ?? 50} items. Use the after cursor for more, or provide a search filter to narrow results.`);
        if (validatedArgs.search) summaryLines.push(`🔍 Search: \"${validatedArgs.search}\"`);
        if (validatedArgs.serial) summaryLines.push(`📟 Serial: \"${validatedArgs.serial}\"`);
        if (validatedArgs.is_connected !== undefined) summaryLines.push(`🔗 Connection: ${validatedArgs.is_connected ? 'Connected only' : 'Disconnected only'}`);
        if (validatedArgs.no_group_assigned) summaryLines.push(`📂 No group assigned`);
        if (validatedArgs.machine_groups_ids?.length) summaryLines.push(`👥 Groups: ${validatedArgs.machine_groups_ids.length} selected`);

        if (pageTotal === 0) {
          summaryLines.push("No devices found with the specified filters.");
        } else {
          // summaryLines.push(`\n🟢 Active (this page): ${active}/${totalCount}`);
          // summaryLines.push(`🔗 Connected (this page): ${connected}/${totalCount}`);
          // summaryLines.push(`📡 Offline (this page): ${totalCount - connected}/${totalCount}`);
          // summaryLines.push(`📦 Total available across all pages: ${totalCount}\n`);

          const headers: string[] = [
            "ID", "Name", "Serial", "Status", "Connected",
            ...(validatedArgs.include_machines_group ? ["Group"] : []),
            ...(validatedArgs.include_machine_model ? ["Model"] : []),
            "Last Seen",
          ];
          summaryLines.push(`| ${headers.join(" | ")} |`);
          summaryLines.push(`| ${headers.map(() => "------").join(" | ")} |`);

          machines.forEach((machine) => {
            const row: string[] = [];
            row.push(machine.id);
            row.push(machine.name);
            row.push(machine.serial);
            row.push(machine.active ? "🟢 Active" : "🔴 Inactive");
            row.push(machine.is_connected ? "🔗 Yes" : "❌ No");
            if (validatedArgs.include_machines_group) row.push(machine.machines_group?.name || "None");
            if (validatedArgs.include_machine_model) row.push(machine.machine_model?.name || "N/A");
            const lastSeen = machine.last_seen ? new Date(machine.last_seen).toLocaleString("en-US", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never";
            row.push(lastSeen);
            summaryLines.push(`| ${row.join(" | ")} |`);
          });
        }

        if (hasMore) summaryLines.push(`\n📄 **Pagination available**: Use \`after: \"${hasMore}\"\` to see more results.`);

        // Build structured payload alongside human-readable text content
        const structured = {
          filters: params,
          totals: {
            total: totalCount,
            active,
            connected,
            offline: pageTotal - connected,
          },
          pagination: hasMore ? { after: hasMore } : null,
          items: machines.map((m) => ({
            id: m.id,
            name: m.name,
            serial: m.serial,
            active: m.active,
            is_connected: m.is_connected,
            last_seen: m.last_seen,
            machines_group: m.machines_group ? { id: m.machines_group.id, name: m.machines_group.name } : null,
            machine_model: m.machine_model ? { id: m.machine_model.id, name: m.machine_model.name } : null,
          })),
        };

        return success({ text: summaryLines.join("\n"), structured });
      } catch (error: any) {
        console.error("API Error:", error);
        const message = `❌ Error retrieving devices: ${error.response?.data?.message || error.message}`;
        return failure({ message, status: error.response?.status, data: error.response?.data });
      }
    },
  }
}
  ;