/**
 * Tool Dependency Resolution System
 * 
 * Automatically resolves missing parameters by calling dependent tools
 * Example: If device_id is missing, automatically calls list_machines to find it
 */

import axios from "axios";
import { THINGS5_BASE_URL } from "../config.js";
import { fetchFirstOrganizationId } from "../tools/organizationUtils.js";
import { 
  getAvailableMachines, 
  findMachine, 
  resolveDeviceIdFromContext,
  MachineInfo 
} from "./machineContext.js";

export interface ToolDependency {
  /** Parameter name that needs to be resolved */
  parameter: string;
  /** Function to resolve the parameter */
  resolver: (args: any, auth_token: string, machineContext?: MachineInfo[]) => Promise<string | string[] | null>;
  /** Description of what this resolver does */
  description: string;
}

/**
 * Resolve device_id from machine name or serial
 * Uses pre-loaded machine context for better performance
 */
export async function resolveDeviceId(
  args: any, 
  auth_token: string,
  machineContext?: MachineInfo[]
): Promise<string | null> {
  const searchTerm = args.device_name || args.machine_name || args.search || args.serial;
  
  if (!searchTerm) {
    console.log('[AutoResolve] No search term found for device_id resolution');
    return null;
  }
  
  console.log(`[AutoResolve] Searching device with term: "${searchTerm}"`);
  
  // Use pre-loaded context if available (much faster!)
  if (machineContext && machineContext.length > 0) {
    console.log('[AutoResolve] Using pre-loaded machine context');
    const deviceId = resolveDeviceIdFromContext(machineContext, args);
    
    if (deviceId) {
      const machine = machineContext.find(m => m.id === deviceId);
      console.log(`[AutoResolve] ✅ Found device_id: ${deviceId} (${machine?.name})`);
      return deviceId;
    }
  }
  
  // Fallback to API call if context not available
  console.log('[AutoResolve] ⚠️  Machine context not available, falling back to API call');
  
  try {
    const organizationId = await fetchFirstOrganizationId(auth_token);
    const response = await axios.get(
      `${THINGS5_BASE_URL}/organizations/${organizationId}/devices`,
      {
        headers: { Authorization: `Bearer ${auth_token}` },
        params: { search: searchTerm, limit: 1 }
      }
    );
    
    const devices = response.data?.data || [];
    if (devices.length === 0) {
      console.log('[AutoResolve] ❌ No devices found');
      return null;
    }
    
    const deviceId = devices[0].id;
    console.log(`[AutoResolve] ✅ Found device_id: ${deviceId} (${devices[0].name})`);
    return deviceId;
    
  } catch (error: any) {
    console.error('[AutoResolve] ❌ Error resolving device_id:', error.message);
    return null;
  }
}

/**
 * Resolve machine_command_id from command name
 * Uses device_firmware_detail with include_machine_commands=true
 */
export async function resolveMachineCommandId(
  args: any, 
  auth_token: string,
  machineContext?: MachineInfo[]
): Promise<string | null> {
  const deviceId = args.device_id || args.machine_id;
  const commandName = args.command_name || args.action;
  
  if (!deviceId || !commandName) {
    console.log('[AutoResolve] Missing device_id or command_name for machine_command_id resolution');
    return null;
  }
  
  console.log(`[AutoResolve] Searching command "${commandName}" for device ${deviceId}`);
  
  try {
    const organizationId = await fetchFirstOrganizationId(auth_token);
    const response = await axios.get(
      `${THINGS5_BASE_URL}/organizations/${organizationId}/machines/${deviceId}/machine_firmware`,
      {
        headers: { Authorization: `Bearer ${auth_token}` },
        params: { include_machine_commands: true }
      }
    );
    
    const commands = response.data?.data?.machine_commands || [];
    const command = commands.find((cmd: any) => 
      cmd.name === commandName || 
      cmd.name.toLowerCase().includes(commandName.toLowerCase())
    );
    
    if (!command) {
      console.log('[AutoResolve] Command not found');
      return null;
    }
    
    console.log(`[AutoResolve] Found machine_command_id: ${command.id} (${command.name})`);
    return command.id;
    
  } catch (error: any) {
    console.error('[AutoResolve] Error resolving machine_command_id:', error.message);
    return null;
  }
}

/**
 * Resolve metric_names from device capabilities
 * Returns all available metrics if not specified
 */
export async function resolveMetricNames(
  args: any, 
  auth_token: string,
  machineContext?: MachineInfo[]
): Promise<string[] | null> {
  const deviceId = args.device_id || args.machine_id;
  
  if (!deviceId) {
    console.log('[AutoResolve] Missing device_id for metric_names resolution');
    return null;
  }
  
  console.log(`[AutoResolve] Getting available metrics for device ${deviceId}`);
  
  try {
    const organizationId = await fetchFirstOrganizationId(auth_token);
    const response = await axios.get(
      `${THINGS5_BASE_URL}/organizations/${organizationId}/machines/${deviceId}/machine_firmware`,
      {
        headers: { Authorization: `Bearer ${auth_token}` },
        params: { include_machine_variables: true }
      }
    );
    
    const variables = response.data?.data?.machine_variables || [];
    const metricNames = variables
      .filter((v: any) => v.source === 'metrics')
      .map((v: any) => v.name);
    
    console.log(`[AutoResolve] Found ${metricNames.length} metrics`);
    return metricNames.length > 0 ? metricNames : null;
    
  } catch (error: any) {
    console.error('[AutoResolve] Error resolving metric_names:', error.message);
    return null;
  }
}

/**
 * Resolve machine_ids from group or organization
 * Uses pre-loaded machine context when available
 */
export async function resolveMachineIds(
  args: any, 
  auth_token: string,
  machineContext?: MachineInfo[]
): Promise<string[] | null> {
  console.log('[AutoResolve] Getting machine IDs from organization');
  
  // Use pre-loaded context if available
  if (machineContext && machineContext.length > 0) {
    console.log('[AutoResolve] Using pre-loaded machine context');
    
    let machines = machineContext;
    
    // Filter by group if specified
    if (args.machine_groups_ids && Array.isArray(args.machine_groups_ids)) {
      // Note: machineContext doesn't include group info, would need to be enhanced
      console.log('[AutoResolve] ⚠️  Group filtering not available in context, using all machines');
    }
    
    // Apply limit
    const limit = args.limit || machines.length;
    machines = machines.slice(0, limit);
    
    const machineIds = machines.map(m => m.id);
    console.log(`[AutoResolve] ✅ Found ${machineIds.length} machines from context`);
    return machineIds.length > 0 ? machineIds : null;
  }
  
  // Fallback to API call
  console.log('[AutoResolve] ⚠️  Machine context not available, falling back to API call');
  
  try {
    const organizationId = await fetchFirstOrganizationId(auth_token);
    const response = await axios.get(
      `${THINGS5_BASE_URL}/organizations/${organizationId}/devices`,
      {
        headers: { Authorization: `Bearer ${auth_token}` },
        params: { 
          limit: args.limit || 10,
          machine_groups_ids: args.machine_groups_ids
        }
      }
    );
    
    const devices = response.data?.data || [];
    const machineIds = devices.map((d: any) => d.id);
    
    console.log(`[AutoResolve] ✅ Found ${machineIds.length} machines`);
    return machineIds.length > 0 ? machineIds : null;
    
  } catch (error: any) {
    console.error('[AutoResolve] ❌ Error resolving machine_ids:', error.message);
    return null;
  }
}

/**
 * Tool dependency map
 * Defines which parameters can be auto-resolved and how
 */
export const TOOL_DEPENDENCIES: Record<string, ToolDependency[]> = {
  // Device operations
  'device_details': [
    { 
      parameter: 'device_id', 
      resolver: resolveDeviceId,
      description: 'Auto-resolve device_id from device_name/search/serial'
    }
  ],
  
  'device_update': [
    { 
      parameter: 'device_id', 
      resolver: resolveDeviceId,
      description: 'Auto-resolve device_id from device_name/search/serial'
    }
  ],
  
  // Firmware operations
  'device_firmware_detail': [
    { 
      parameter: 'machine_id', 
      resolver: resolveDeviceId,
      description: 'Auto-resolve machine_id from device_name/search/serial'
    }
  ],
  
  // Command operations
  'machine_command_execute': [
    { 
      parameter: 'device_id', 
      resolver: resolveDeviceId,
      description: 'Auto-resolve device_id from device_name/search/serial'
    },
    { 
      parameter: 'machine_command_id', 
      resolver: resolveMachineCommandId,
      description: 'Auto-resolve machine_command_id from command_name'
    }
  ],
  
  'machine_command_create': [
    { 
      parameter: 'device_id', 
      resolver: resolveDeviceId,
      description: 'Auto-resolve device_id from device_name/search/serial'
    }
  ],
  
  'machine_command_update': [
    { 
      parameter: 'device_id', 
      resolver: resolveDeviceId,
      description: 'Auto-resolve device_id from device_name/search/serial'
    }
  ],
  
  'machine_command_delete': [
    { 
      parameter: 'device_id', 
      resolver: resolveDeviceId,
      description: 'Auto-resolve device_id from device_name/search/serial'
    }
  ],
  
  // Data reading
  'metrics_read': [
    { 
      parameter: 'device_id', 
      resolver: resolveDeviceId,
      description: 'Auto-resolve device_id from device_name/search/serial'
    }
  ],
  
  'events_read': [
    { 
      parameter: 'device_id', 
      resolver: resolveDeviceId,
      description: 'Auto-resolve device_id from device_name/search/serial'
    }
  ],
  
  'states_read': [
    { 
      parameter: 'device_id', 
      resolver: resolveDeviceId,
      description: 'Auto-resolve device_id from device_name/search/serial'
    }
  ],
  
  'state_read_last_value': [
    { 
      parameter: 'device_id', 
      resolver: resolveDeviceId,
      description: 'Auto-resolve device_id from device_name/search/serial'
    }
  ],
  
  'read_parameters': [
    { 
      parameter: 'device_id', 
      resolver: resolveDeviceId,
      description: 'Auto-resolve device_id from device_name/search/serial'
    }
  ],
  
  'read_single_parameter': [
    { 
      parameter: 'device_id', 
      resolver: resolveDeviceId,
      description: 'Auto-resolve device_id from device_name/search/serial'
    }
  ],
  
  'perform_action': [
    { 
      parameter: 'device_id', 
      resolver: resolveDeviceId,
      description: 'Auto-resolve device_id from device_name/search/serial'
    }
  ],
  
  // Recipes
  'device_managed_recipes': [
    { 
      parameter: 'machine_id', 
      resolver: resolveDeviceId,
      description: 'Auto-resolve machine_id from device_name/search/serial'
    }
  ],
  
  // Overview operations
  'aggregated_metrics': [
    { 
      parameter: 'machine_ids', 
      resolver: resolveMachineIds,
      description: 'Auto-resolve machine_ids from organization if not provided'
    }
  ],
  
  'overview_events': [
    { 
      parameter: 'machine_ids', 
      resolver: resolveMachineIds,
      description: 'Auto-resolve machine_ids from organization if not provided'
    }
  ]
};

/**
 * Auto-resolve missing parameters for a tool
 * 
 * @param toolName - Name of the tool being called
 * @param args - Arguments provided by user
 * @param auth_token - Authentication token
 * @param machineContext - Pre-loaded machine context (optional)
 * @returns Updated args with resolved parameters
 */
export async function autoResolveParameters(
  toolName: string,
  args: any,
  auth_token: string,
  machineContext?: MachineInfo[]
): Promise<any> {
  const dependencies = TOOL_DEPENDENCIES[toolName];
  
  if (!dependencies || dependencies.length === 0) {
    return args;
  }
  
  console.log(`[AutoResolve] Checking dependencies for tool: ${toolName}`);
  
  const resolvedArgs = { ...args };
  let hasResolved = false;
  
  for (const dep of dependencies) {
    // Skip if parameter already provided
    if (resolvedArgs[dep.parameter]) {
      continue;
    }
    
    console.log(`[AutoResolve] Resolving parameter: ${dep.parameter}`);
    console.log(`[AutoResolve] ${dep.description}`);
    
    try {
      const resolvedValue = await dep.resolver(resolvedArgs, auth_token, machineContext);
      
      if (resolvedValue) {
        resolvedArgs[dep.parameter] = resolvedValue;
        hasResolved = true;
        console.log(`[AutoResolve] ✅ Resolved ${dep.parameter}:`, resolvedValue);
      } else {
        console.log(`[AutoResolve] ⚠️  Could not resolve ${dep.parameter}`);
      }
    } catch (error: any) {
      console.error(`[AutoResolve] ❌ Error resolving ${dep.parameter}:`, error.message);
    }
  }
  
  if (hasResolved) {
    console.log('[AutoResolve] Final resolved args:', JSON.stringify(resolvedArgs, null, 2));
  }
  
  return resolvedArgs;
}

/**
 * Check if auto-resolution is possible for a tool
 */
export function canAutoResolve(toolName: string): boolean {
  return !!TOOL_DEPENDENCIES[toolName];
}

/**
 * Get list of parameters that can be auto-resolved for a tool
 */
export function getResolvableParameters(toolName: string): string[] {
  const dependencies = TOOL_DEPENDENCIES[toolName];
  return dependencies ? dependencies.map(d => d.parameter) : [];
}
