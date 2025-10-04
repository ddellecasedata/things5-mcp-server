/**
 * Machine Context System
 * 
 * Automatically loads and caches the list of available machines
 * before every tool call to provide context to the AI
 */

import axios from "axios";
import { THINGS5_BASE_URL } from "../config.js";
import { fetchFirstOrganizationId } from "../tools/organizationUtils.js";

export interface MachineInfo {
  id: string;
  name: string;
  serial: string;
  is_connected: boolean;
  machine_model_id?: string;
  machine_firmware_id?: string;
  active?: boolean;
}

interface MachineContextCache {
  machines: MachineInfo[];
  timestamp: number;
  organization_id: string;
}

// Cache per 2 minuti (evita troppe chiamate API)
const CACHE_TTL_MS = 2 * 60 * 1000;
let machineCache: MachineContextCache | null = null;

/**
 * Get the list of available machines with caching
 * 
 * @param auth_token - Authentication token
 * @param force - Force refresh cache
 * @returns List of machines the user has access to
 */
export async function getAvailableMachines(
  auth_token: string,
  force: boolean = false
): Promise<MachineInfo[]> {
  // Check cache
  if (!force && machineCache && Date.now() - machineCache.timestamp < CACHE_TTL_MS) {
    console.log('[MachineContext] ✅ Using cached machines:', machineCache.machines.length);
    return machineCache.machines;
  }
  
  console.log('[MachineContext] 🔄 Loading available machines...');
  
  try {
    const organizationId = await fetchFirstOrganizationId(auth_token);
    
    const response = await axios.get(
      `${THINGS5_BASE_URL}/organizations/${organizationId}/devices`,
      {
        headers: { Authorization: `Bearer ${auth_token}` },
        params: {
          limit: 100, // Get all machines (adjust if needed)
          include_machine_model: false // Keep it lightweight
        }
      }
    );
    
    const machines: MachineInfo[] = (response.data?.data || []).map((device: any) => ({
      id: device.id,
      name: device.name,
      serial: device.serial,
      is_connected: device.is_connected || false,
      machine_model_id: device.machine_model_id,
      machine_firmware_id: device.machine_firmware_id,
      active: device.active
    }));
    
    // Update cache
    machineCache = {
      machines,
      timestamp: Date.now(),
      organization_id: organizationId
    };
    
    console.log(`[MachineContext] ✅ Loaded ${machines.length} machines`);
    console.log(`[MachineContext] Connected: ${machines.filter(m => m.is_connected).length}`);
    console.log(`[MachineContext] Disconnected: ${machines.filter(m => !m.is_connected).length}`);
    
    return machines;
    
  } catch (error: any) {
    console.error('[MachineContext] ❌ Error loading machines:', error.message);
    
    // Return cached data if available, even if expired
    if (machineCache) {
      console.log('[MachineContext] ⚠️  Using stale cache as fallback');
      return machineCache.machines;
    }
    
    return [];
  }
}

/**
 * Find a machine by name, serial, or ID with fuzzy matching
 * 
 * @param machines - List of available machines
 * @param searchTerm - Search term (name, serial, or ID)
 * @returns Matching machine or null
 */
export function findMachine(
  machines: MachineInfo[],
  searchTerm: string
): MachineInfo | null {
  if (!searchTerm || machines.length === 0) {
    return null;
  }
  
  const term = searchTerm.toLowerCase().trim();
  
  // 1. Exact ID match
  let match = machines.find(m => m.id === searchTerm);
  if (match) {
    console.log(`[MachineContext] 🎯 Exact ID match: ${match.name}`);
    return match;
  }
  
  // 2. Exact serial match
  match = machines.find(m => m.serial.toLowerCase() === term);
  if (match) {
    console.log(`[MachineContext] 🎯 Exact serial match: ${match.name} (${match.serial})`);
    return match;
  }
  
  // 3. Exact name match
  match = machines.find(m => m.name.toLowerCase() === term);
  if (match) {
    console.log(`[MachineContext] 🎯 Exact name match: ${match.name}`);
    return match;
  }
  
  // 4. Partial name match (contains)
  match = machines.find(m => m.name.toLowerCase().includes(term));
  if (match) {
    console.log(`[MachineContext] 🎯 Partial name match: ${match.name}`);
    return match;
  }
  
  // 5. Partial serial match (contains)
  match = machines.find(m => m.serial.toLowerCase().includes(term));
  if (match) {
    console.log(`[MachineContext] 🎯 Partial serial match: ${match.name} (${match.serial})`);
    return match;
  }
  
  console.log(`[MachineContext] ❌ No match found for: "${searchTerm}"`);
  return null;
}

/**
 * Get a summary of available machines for AI context
 * 
 * @param machines - List of available machines
 * @returns Human-readable summary
 */
export function getMachinesSummary(machines: MachineInfo[]): string {
  if (machines.length === 0) {
    return "No machines available.";
  }
  
  const connected = machines.filter(m => m.is_connected);
  const disconnected = machines.filter(m => !m.is_connected);
  
  let summary = `Available machines (${machines.length} total):\n`;
  
  if (connected.length > 0) {
    summary += `\n🟢 Connected (${connected.length}):\n`;
    connected.forEach(m => {
      summary += `  - ${m.name} (${m.serial})\n`;
    });
  }
  
  if (disconnected.length > 0) {
    summary += `\n🔴 Disconnected (${disconnected.length}):\n`;
    disconnected.forEach(m => {
      summary += `  - ${m.name} (${m.serial})\n`;
    });
  }
  
  return summary;
}

/**
 * Clear the machine cache (useful for testing or manual refresh)
 */
export function clearMachineCache(): void {
  machineCache = null;
  console.log('[MachineContext] 🗑️  Cache cleared');
}

/**
 * Get cache info (for debugging)
 */
export function getCacheInfo(): { 
  cached: boolean; 
  machines: number; 
  age_seconds: number;
  expires_in_seconds: number;
} | null {
  if (!machineCache) {
    return null;
  }
  
  const ageMs = Date.now() - machineCache.timestamp;
  const expiresInMs = CACHE_TTL_MS - ageMs;
  
  return {
    cached: true,
    machines: machineCache.machines.length,
    age_seconds: Math.floor(ageMs / 1000),
    expires_in_seconds: Math.floor(Math.max(0, expiresInMs) / 1000)
  };
}

/**
 * Enhanced device_id resolver that uses the pre-loaded machine context
 * This is more efficient than calling list_machines API again
 */
export function resolveDeviceIdFromContext(
  machines: MachineInfo[],
  args: any
): string | null {
  const searchTerm = args.device_name || args.machine_name || args.search || args.serial;
  
  if (!searchTerm) {
    return null;
  }
  
  const machine = findMachine(machines, searchTerm);
  return machine?.id || null;
}

/**
 * Get suggested machines based on partial input
 * Useful for autocomplete or suggestions
 */
export function getSuggestedMachines(
  machines: MachineInfo[],
  partialTerm: string,
  limit: number = 5
): MachineInfo[] {
  if (!partialTerm || machines.length === 0) {
    return machines.slice(0, limit);
  }
  
  const term = partialTerm.toLowerCase();
  
  const matches = machines.filter(m => 
    m.name.toLowerCase().includes(term) ||
    m.serial.toLowerCase().includes(term)
  );
  
  return matches.slice(0, limit);
}
