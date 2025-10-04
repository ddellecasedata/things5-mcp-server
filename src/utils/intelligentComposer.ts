/**
 * Intelligent Tool Call Composer
 * 
 * Analizza richieste incomplete e compone automaticamente la chiamata migliore
 * basandosi sui dati disponibili dal machine context e tool dependencies.
 * 
 * Features:
 * - Auto-complete quando univoco
 * - Suggerimenti intelligenti quando ambiguo
 * - Estrazione termini dal prompt originale
 * - Matching fuzzy e context-aware
 */

import { MachineInfo, findMachine, getAvailableMachines } from './machineContext.js';
import { THINGS5_BASE_URL } from '../config.js';
import { fetchFirstOrganizationId } from '../tools/organizationUtils.js';
import axios from 'axios';

export interface CompositionContext {
  tool_name: string;
  original_input: any;
  user_prompt?: string;  // Se disponibile dal Realtime API
  machine_context?: MachineInfo[];
  auth_token: string;
}

export interface CompositionResult {
  status: 'completed' | 'needs_clarification' | 'failed';
  composed_input?: any;
  suggestions?: CompositionSuggestion[];
  message?: string;
  confidence: number; // 0-1
}

export interface CompositionSuggestion {
  label: string;
  value: any;
  description: string;
  confidence: number;
}

/**
 * Main intelligent composition function
 */
export async function composeIntelligently(
  context: CompositionContext
): Promise<CompositionResult> {
  console.log('\n[IntelligentComposer] 🧠 Starting intelligent composition...');
  console.log(`[IntelligentComposer] Tool: ${context.tool_name}`);
  console.log(`[IntelligentComposer] Input:`, JSON.stringify(context.original_input, null, 2));
  
  // Route to specific composer based on tool
  switch (context.tool_name) {
    case 'machine_command_execute':
      return await composeMachineCommandExecute(context);
    
    case 'metrics_read':
    case 'events_read':
    case 'states_read':
      return await composeDataReading(context);
    
    case 'device_firmware_detail':
      return await composeDeviceQuery(context);
    
    default:
      // No intelligent composition for this tool
      return {
        status: 'completed',
        composed_input: context.original_input,
        confidence: 1.0
      };
  }
}

/**
 * Compose machine_command_execute call
 */
async function composeMachineCommandExecute(
  context: CompositionContext
): Promise<CompositionResult> {
  const input = context.original_input;
  const prompt = context.user_prompt || '';
  
  // Step 1: Identify what we have and what we need
  const hasDevice = !!(input.device_id || input.device_name || input.serial);
  const hasCommand = !!(input.machine_command_id || input.command_name);
  
  console.log(`[IntelligentComposer] Has device: ${hasDevice}, Has command: ${hasCommand}`);
  
  // Step 2: Load machine context if needed
  let machines = context.machine_context;
  if (!machines && context.auth_token) {
    machines = await getAvailableMachines(context.auth_token);
  }
  
  if (!machines || machines.length === 0) {
    return {
      status: 'failed',
      message: 'No machines available in your organization',
      confidence: 0
    };
  }
  
  // Step 3: Extract hints from prompt
  const deviceHints = extractDeviceHints(prompt);
  const commandHints = extractCommandHints(prompt);
  
  console.log(`[IntelligentComposer] Device hints:`, deviceHints);
  console.log(`[IntelligentComposer] Command hints:`, commandHints);
  
  // Step 4: Find matching devices
  let candidateDevices: MachineInfo[] = [];
  
  if (hasDevice) {
    // Use provided device info
    const searchTerm = input.device_name || input.serial || input.device_id;
    const found = findMachine(machines, searchTerm);
    if (found) {
      candidateDevices = [found];
    }
  } else if (deviceHints.length > 0) {
    // Try to match devices from hints
    for (const hint of deviceHints) {
      const found = findMachine(machines, hint);
      if (found && !candidateDevices.find(d => d.id === found.id)) {
        candidateDevices.push(found);
      }
    }
  }
  
  // If still no device, show all connected devices
  if (candidateDevices.length === 0) {
    candidateDevices = machines.filter(m => m.is_connected);
  }
  
  console.log(`[IntelligentComposer] Found ${candidateDevices.length} candidate devices`);
  
  // Step 5: For each candidate, check if command exists
  const validCombinations: Array<{
    device: MachineInfo;
    command: any;
    confidence: number;
  }> = [];
  
  for (const device of candidateDevices) {
    try {
      // Get device commands
      const commands = await getDeviceCommands(device.id, context.auth_token);
      
      if (!commands || commands.length === 0) {
        continue;
      }
      
      // Find matching command
      let matchingCommand = null;
      let commandConfidence = 0;
      
      if (hasCommand) {
        // Use provided command
        const commandSearch = input.command_name || input.machine_command_id;
        matchingCommand = commands.find((cmd: any) => 
          cmd.id === commandSearch ||
          cmd.name === commandSearch ||
          cmd.name.toLowerCase().includes(commandSearch.toLowerCase())
        );
        commandConfidence = matchingCommand ? 1.0 : 0;
      } else if (commandHints.length > 0) {
        // Try to match from hints
        for (const hint of commandHints) {
          matchingCommand = commands.find((cmd: any) =>
            cmd.name.toLowerCase().includes(hint.toLowerCase()) ||
            cmd.description?.toLowerCase().includes(hint.toLowerCase())
          );
          if (matchingCommand) {
            commandConfidence = 0.8;
            break;
          }
        }
      }
      
      if (matchingCommand) {
        validCombinations.push({
          device,
          command: matchingCommand,
          confidence: commandConfidence
        });
      }
    } catch (error) {
      console.error(`[IntelligentComposer] Error getting commands for ${device.name}:`, error);
    }
  }
  
  console.log(`[IntelligentComposer] Found ${validCombinations.length} valid combinations`);
  
  // Step 6: Decide action based on results
  if (validCombinations.length === 0) {
    // No valid combinations found
    return {
      status: 'needs_clarification',
      message: hasDevice 
        ? `The device doesn't have ${commandHints.join(' or ')} command available`
        : `I couldn't find any device with ${commandHints.join(' or ')} command. Available devices: ${machines.slice(0, 5).map(m => m.name).join(', ')}`,
      suggestions: machines.slice(0, 10).map(m => ({
        label: `${m.name} (${m.serial})`,
        value: { device_name: m.name },
        description: m.is_connected ? '🟢 Connected' : '🔴 Offline',
        confidence: 0.5
      })),
      confidence: 0
    };
  }
  
  if (validCombinations.length === 1) {
    // UNIVOCO! Auto-complete
    const combo = validCombinations[0];
    console.log(`[IntelligentComposer] ✅ Unique match found: ${combo.device.name} - ${combo.command.name}`);
    
    return {
      status: 'completed',
      composed_input: {
        ...input,
        device_id: combo.device.id,
        machine_command_id: combo.command.id
      },
      message: `Executing "${combo.command.name}" on "${combo.device.name}"`,
      confidence: combo.confidence
    };
  }
  
  // Multiple valid combinations - need clarification
  console.log(`[IntelligentComposer] 🤔 Multiple matches found, asking for clarification`);
  
  return {
    status: 'needs_clarification',
    message: `I found multiple devices that can execute this command. Which one do you want?`,
    suggestions: validCombinations.map(combo => ({
      label: `${combo.device.name} (${combo.device.serial})`,
      value: {
        device_id: combo.device.id,
        machine_command_id: combo.command.id
      },
      description: `${combo.command.name} - ${combo.device.is_connected ? '🟢 Connected' : '🔴 Offline'}`,
      confidence: combo.confidence
    })),
    confidence: 0.5
  };
}

/**
 * Compose data reading calls (metrics_read, events_read, etc.)
 */
async function composeDataReading(
  context: CompositionContext
): Promise<CompositionResult> {
  const input = context.original_input;
  const prompt = context.user_prompt || '';
  
  // Similar logic to machine_command_execute but for data reading
  const hasDevice = !!(input.device_id || input.device_name || input.serial);
  
  if (hasDevice) {
    // Device specified, good to go
    return {
      status: 'completed',
      composed_input: input,
      confidence: 1.0
    };
  }
  
  // Try to infer device from prompt
  let machines = context.machine_context;
  if (!machines && context.auth_token) {
    machines = await getAvailableMachines(context.auth_token);
  }
  
  if (!machines || machines.length === 0) {
    return {
      status: 'failed',
      message: 'No machines available',
      confidence: 0
    };
  }
  
  const deviceHints = extractDeviceHints(prompt);
  
  if (deviceHints.length > 0) {
    const found = findMachine(machines, deviceHints[0]);
    if (found) {
      return {
        status: 'completed',
        composed_input: {
          ...input,
          device_id: found.id
        },
        message: `Reading data from "${found.name}"`,
        confidence: 0.9
      };
    }
  }
  
  // Show options
  return {
    status: 'needs_clarification',
    message: 'Which device do you want to read data from?',
    suggestions: machines.filter(m => m.is_connected).slice(0, 10).map(m => ({
      label: `${m.name} (${m.serial})`,
      value: { device_name: m.name },
      description: '🟢 Connected',
      confidence: 0.5
    })),
    confidence: 0
  };
}

/**
 * Compose device query calls
 */
async function composeDeviceQuery(
  context: CompositionContext
): Promise<CompositionResult> {
  // Similar to composeDataReading
  return composeDataReading(context);
}

/**
 * Extract device hints from user prompt
 */
function extractDeviceHints(prompt: string): string[] {
  const hints: string[] = [];
  const lower = prompt.toLowerCase();
  
  // Common device keywords
  const deviceKeywords = [
    'frigo', 'fridge', 'refrigerator',
    'abbattitore', 'blast chiller',
    'forno', 'oven',
    'macchina', 'machine', 'device'
  ];
  
  for (const keyword of deviceKeywords) {
    if (lower.includes(keyword)) {
      hints.push(keyword);
    }
  }
  
  // Extract quoted names: "Frigo Cucina"
  const quotedRegex = /"([^"]+)"|'([^']+)'/g;
  let match;
  while ((match = quotedRegex.exec(prompt)) !== null) {
    hints.push(match[1] || match[2]);
  }
  
  return hints;
}

/**
 * Extract command hints from user prompt
 */
function extractCommandHints(prompt: string): string[] {
  const hints: string[] = [];
  const lower = prompt.toLowerCase();
  
  // Action keywords to command mapping
  const actionMap: Record<string, string[]> = {
    'accendi': ['turn_on', 'start', 'light', 'on'],
    'spegni': ['turn_off', 'stop', 'off'],
    'turn on': ['turn_on', 'start', 'on'],
    'turn off': ['turn_off', 'stop', 'off'],
    'start': ['start', 'begin', 'run'],
    'stop': ['stop', 'end', 'halt'],
    'light': ['light', 'lamp', 'led'],
    'luce': ['light', 'lamp', 'led'],
    'defrost': ['defrost', 'sbrina'],
    'sbrina': ['defrost'],
    'temperatura': ['temperature', 'temp'],
    'temperature': ['temperature', 'temp']
  };
  
  for (const [trigger, commands] of Object.entries(actionMap)) {
    if (lower.includes(trigger)) {
      hints.push(...commands);
    }
  }
  
  return [...new Set(hints)]; // Remove duplicates
}

/**
 * Get available commands for a device
 */
async function getDeviceCommands(
  deviceId: string,
  auth_token: string
): Promise<any[]> {
  try {
    const organizationId = await fetchFirstOrganizationId(auth_token);
    const response = await axios.get(
      `${THINGS5_BASE_URL}/organizations/${organizationId}/machines/${deviceId}/machine_firmware`,
      {
        headers: { Authorization: `Bearer ${auth_token}` },
        params: { include_machine_commands: true }
      }
    );
    
    return response.data?.data?.machine_commands || [];
  } catch (error) {
    console.error('[IntelligentComposer] Error fetching commands:', error);
    return [];
  }
}
