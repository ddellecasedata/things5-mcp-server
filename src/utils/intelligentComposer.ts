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
 * 
 * Multi-phase approach:
 * Phase 1: Device Resolution
 * Phase 2: Command Resolution (with fetching available commands)
 */
async function composeMachineCommandExecute(
  context: CompositionContext
): Promise<CompositionResult> {
  const input = context.original_input;
  const prompt = context.user_prompt || '';
  
  console.log('[IntelligentComposer] 🎯 Phase 1: Device Resolution');
  
  // Step 1: Identify what we have
  const hasDevice = !!(input.device_id || input.device_name || input.serial);
  const hasCommand = !!(input.machine_command_id || input.command_name);
  
  console.log(`[IntelligentComposer] Has device: ${hasDevice}, Has command: ${hasCommand}`);
  
  // Step 2: Load machine context
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
  
  // Step 4: PHASE 1 - Find matching devices
  let candidateDevices: MachineInfo[] = [];
  
  if (hasDevice) {
    // Use provided device info
    const searchTerm = input.device_name || input.serial || input.device_id;
    const found = findMachine(machines, searchTerm);
    if (found) {
      candidateDevices = [found];
      console.log(`[IntelligentComposer] ✅ Device from input: ${found.name}`);
    }
  } else if (deviceHints.length > 0) {
    // Try to match devices from hints
    for (const hint of deviceHints) {
      const found = findMachine(machines, hint);
      if (found && !candidateDevices.find(d => d.id === found.id)) {
        candidateDevices.push(found);
      }
    }
    console.log(`[IntelligentComposer] Found ${candidateDevices.length} devices from hints`);
  }
  
  // If still no device and no command hints, show all connected devices
  if (candidateDevices.length === 0 && commandHints.length === 0) {
    candidateDevices = machines.filter(m => m.is_connected);
    console.log(`[IntelligentComposer] No hints, showing ${candidateDevices.length} connected devices`);
  }
  
  // PHASE 1 DECISION: If multiple devices and no command hint, ask which device
  if (candidateDevices.length > 1 && commandHints.length === 0) {
    console.log('[IntelligentComposer] 🤔 Multiple devices, no command hint → Ask device first');
    return {
      status: 'needs_clarification',
      message: 'Which device do you want to control?',
      suggestions: candidateDevices.map(d => ({
        label: `${d.name} (${d.serial})`,
        value: { device_id: d.id },
        description: d.is_connected ? '🟢 Connected' : '🔴 Offline',
        confidence: 0.5
      })),
      confidence: 0.5
    };
  }
  
  // Step 5: PHASE 2 - Command Resolution with capability fetching
  console.log('\n[IntelligentComposer] 🎯 Phase 2: Command Resolution');
  
  const validCombinations: Array<{
    device: MachineInfo;
    command: any;
    deviceConfidence: number;
    commandConfidence: number;
  }> = [];
  
  for (const device of candidateDevices) {
    try {
      console.log(`[IntelligentComposer] Fetching commands for: ${device.name}`);
      
      // Fetch available commands for this device
      const commands = await getDeviceCommands(device.id, context.auth_token);
      
      if (!commands || commands.length === 0) {
        console.log(`[IntelligentComposer] ⚠️  No commands available for ${device.name}`);
        continue;
      }
      
      console.log(`[IntelligentComposer] Found ${commands.length} commands for ${device.name}`);
      
      // PHASE 2: Match command with intelligent composer
      let matchingCommands: Array<{ command: any; confidence: number }> = [];
      
      if (hasCommand) {
        // Use provided command
        const commandSearch = input.command_name || input.machine_command_id;
        const cmd = commands.find((c: any) => 
          c.id === commandSearch ||
          c.name === commandSearch ||
          c.name.toLowerCase().includes(commandSearch.toLowerCase())
        );
        if (cmd) {
          matchingCommands.push({ command: cmd, confidence: 1.0 });
        }
      } else if (commandHints.length > 0) {
        // Intelligent matching from hints
        for (const hint of commandHints) {
          for (const cmd of commands) {
            const name = cmd.name.toLowerCase();
            const desc = (cmd.description || '').toLowerCase();
            const hintLower = hint.toLowerCase();
            
            let confidence = 0;
            
            // Exact match
            if (name === hintLower) {
              confidence = 1.0;
            }
            // Name contains hint
            else if (name.includes(hintLower)) {
              confidence = 0.9;
            }
            // Hint contains name
            else if (hintLower.includes(name)) {
              confidence = 0.85;
            }
            // Description match
            else if (desc.includes(hintLower)) {
              confidence = 0.7;
            }
            
            if (confidence > 0 && !matchingCommands.find(mc => mc.command.id === cmd.id)) {
              matchingCommands.push({ command: cmd, confidence });
            }
          }
        }
        
        // Sort by confidence
        matchingCommands.sort((a, b) => b.confidence - a.confidence);
        console.log(`[IntelligentComposer] Matched ${matchingCommands.length} commands for ${device.name}`);
      } else {
        // No command specified - list all available
        matchingCommands = commands.map((cmd: any) => ({ command: cmd, confidence: 0.5 }));
      }
      
      // Add valid combinations
      const deviceConfidence = candidateDevices.length === 1 ? 1.0 : 0.8;
      
      for (const mc of matchingCommands) {
        validCombinations.push({
          device,
          command: mc.command,
          deviceConfidence,
          commandConfidence: mc.confidence
        });
      }
      
    } catch (error) {
      console.error(`[IntelligentComposer] Error getting commands for ${device.name}:`, error);
    }
  }
  
  console.log(`[IntelligentComposer] Found ${validCombinations.length} valid device+command combinations`);
  
  // Step 6: FINAL DECISION based on both phases
  if (validCombinations.length === 0) {
    // No valid combinations
    const message = candidateDevices.length > 0
      ? `No matching commands found on ${candidateDevices.map(d => d.name).join(', ')} for: ${commandHints.join(' or ')}`
      : `No devices found matching: ${deviceHints.join(' or ')}`;
    
    return {
      status: 'failed',
      message,
      confidence: 0
    };
  }
  
  if (validCombinations.length === 1 || 
      (validCombinations.length > 1 && validCombinations[0].commandConfidence === 1.0)) {
    // UNIVOCO! Either single match or perfect command match
    const combo = validCombinations[0];
    const totalConfidence = (combo.deviceConfidence + combo.commandConfidence) / 2;
    
    console.log(`[IntelligentComposer] ✅ Unique match: ${combo.device.name} - ${combo.command.name}`);
    console.log(`[IntelligentComposer] Confidence: device=${combo.deviceConfidence}, command=${combo.commandConfidence}, total=${totalConfidence}`);
    
    return {
      status: 'completed',
      composed_input: {
        ...input,
        device_id: combo.device.id,
        machine_command_id: combo.command.id
      },
      message: `Executing "${combo.command.name}" on "${combo.device.name}"`,
      confidence: totalConfidence
    };
  }
  
  // Multiple valid combinations - need clarification
  // Group by device or by command depending on what's clearer
  if (candidateDevices.length === 1) {
    // Single device, multiple commands
    console.log(`[IntelligentComposer] 🤔 Single device, multiple commands → Ask which command`);
    
    return {
      status: 'needs_clarification',
      message: `What do you want to do with "${candidateDevices[0].name}"?`,
      suggestions: validCombinations.map(combo => ({
        label: combo.command.name,
        value: {
          device_id: combo.device.id,
          machine_command_id: combo.command.id
        },
        description: combo.command.description || 'Execute this command',
        confidence: combo.commandConfidence
      })),
      confidence: 0.6
    };
  } else {
    // Multiple devices, potentially multiple commands
    console.log(`[IntelligentComposer] 🤔 Multiple devices+commands → Ask which combination`);
    
    return {
      status: 'needs_clarification',
      message: `I found multiple options. Which one do you want?`,
      suggestions: validCombinations.slice(0, 10).map(combo => ({
        label: `${combo.device.name}: ${combo.command.name}`,
        value: {
          device_id: combo.device.id,
          machine_command_id: combo.command.id
        },
        description: `${combo.device.is_connected ? '🟢' : '🔴'} ${combo.command.description || combo.command.name}`,
        confidence: (combo.deviceConfidence + combo.commandConfidence) / 2
      })),
      confidence: 0.5
    };
  }
}

/**
 * Compose data reading calls (metrics_read, events_read, etc.)
 * 
 * Multi-phase approach:
 * Phase 1: Device Resolution
 * Phase 2: Metric/Event/State Resolution (with fetching available capabilities)
 */
async function composeDataReading(
  context: CompositionContext
): Promise<CompositionResult> {
  const input = context.original_input;
  const prompt = context.user_prompt || '';
  
  console.log('[IntelligentComposer] 🎯 Phase 1: Device Resolution (Data Reading)');
  
  // Step 1: Identify what we have
  const hasDevice = !!(input.device_id || input.device_name || input.serial);
  const hasMetrics = !!(input.metric_names && input.metric_names.length > 0);
  const hasEvents = !!(input.events_names && input.events_names.length > 0);
  const hasStates = !!(input.states_names && input.states_names.length > 0);
  
  console.log(`[IntelligentComposer] Has device: ${hasDevice}, Has metrics: ${hasMetrics}, Has events: ${hasEvents}, Has states: ${hasStates}`);
  
  // Step 2: Load machine context
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
  
  // Step 3: Extract hints
  const deviceHints = extractDeviceHints(prompt);
  const metricHints = extractMetricHints(prompt);
  
  console.log(`[IntelligentComposer] Device hints:`, deviceHints);
  console.log(`[IntelligentComposer] Metric hints:`, metricHints);
  
  // Step 4: PHASE 1 - Find device
  let candidateDevices: MachineInfo[] = [];
  
  if (hasDevice) {
    const searchTerm = input.device_name || input.serial || input.device_id;
    const found = findMachine(machines, searchTerm);
    if (found) {
      candidateDevices = [found];
      console.log(`[IntelligentComposer] ✅ Device from input: ${found.name}`);
    }
  } else if (deviceHints.length > 0) {
    for (const hint of deviceHints) {
      const found = findMachine(machines, hint);
      if (found && !candidateDevices.find(d => d.id === found.id)) {
        candidateDevices.push(found);
      }
    }
    console.log(`[IntelligentComposer] Found ${candidateDevices.length} devices from hints`);
  }
  
  // If no device found, show connected devices
  if (candidateDevices.length === 0) {
    candidateDevices = machines.filter(m => m.is_connected);
    console.log(`[IntelligentComposer] No device hints, showing ${candidateDevices.length} connected devices`);
  }
  
  // PHASE 1 DECISION: If multiple devices and no metric specified, ask device first
  if (candidateDevices.length > 1 && !hasMetrics && !hasEvents && !hasStates && metricHints.length === 0) {
    console.log('[IntelligentComposer] 🤔 Multiple devices, no metric hint → Ask device first');
    return {
      status: 'needs_clarification',
      message: 'Which device do you want to read data from?',
      suggestions: candidateDevices.map(d => ({
        label: `${d.name} (${d.serial})`,
        value: { device_id: d.id },
        description: d.is_connected ? '🟢 Connected' : '🔴 Offline',
        confidence: 0.5
      })),
      confidence: 0.5
    };
  }
  
  // If device is univocal and metrics already specified, good to go!
  if (candidateDevices.length === 1 && (hasMetrics || hasEvents || hasStates)) {
    console.log('[IntelligentComposer] ✅ Single device + metrics specified → Complete');
    return {
      status: 'completed',
      composed_input: {
        ...input,
        device_id: candidateDevices[0].id
      },
      message: `Reading data from "${candidateDevices[0].name}"`,
      confidence: 0.95
    };
  }
  
  // Step 5: PHASE 2 - Metric/Capability Resolution
  if (metricHints.length > 0 || (candidateDevices.length === 1 && !hasMetrics)) {
    console.log('\n[IntelligentComposer] 🎯 Phase 2: Metric Resolution');
    
    const validCombinations: Array<{
      device: MachineInfo;
      metrics: string[];
      deviceConfidence: number;
      metricConfidence: number;
    }> = [];
    
    for (const device of candidateDevices) {
      try {
        console.log(`[IntelligentComposer] Fetching metrics for: ${device.name}`);
        
        // Fetch available metrics for this device
        const metrics = await getDeviceMetrics(device.id, context.auth_token);
        
        if (!metrics || metrics.length === 0) {
          console.log(`[IntelligentComposer] ⚠️  No metrics available for ${device.name}`);
          continue;
        }
        
        console.log(`[IntelligentComposer] Found ${metrics.length} metrics for ${device.name}`);
        
        // PHASE 2: Match metrics with intelligent composer
        let matchingMetrics: Array<{ name: string; confidence: number }> = [];
        
        if (hasMetrics) {
          // Use provided metrics
          matchingMetrics = input.metric_names.map((m: string) => ({ name: m, confidence: 1.0 }));
        } else if (metricHints.length > 0) {
          // Intelligent matching from hints
          for (const hint of metricHints) {
            for (const metric of metrics) {
              const name = metric.toLowerCase();
              const hintLower = hint.toLowerCase();
              
              let confidence = 0;
              
              // Exact match
              if (name === hintLower) {
                confidence = 1.0;
              }
              // Name contains hint
              else if (name.includes(hintLower)) {
                confidence = 0.9;
              }
              // Hint contains name
              else if (hintLower.includes(name)) {
                confidence = 0.85;
              }
              
              if (confidence > 0 && !matchingMetrics.find(mm => mm.name === metric)) {
                matchingMetrics.push({ name: metric, confidence });
              }
            }
          }
          
          matchingMetrics.sort((a, b) => b.confidence - a.confidence);
          console.log(`[IntelligentComposer] Matched ${matchingMetrics.length} metrics for ${device.name}`);
        } else {
          // No hint - show all available metrics
          matchingMetrics = metrics.slice(0, 10).map((m: string) => ({ name: m, confidence: 0.5 }));
        }
        
        if (matchingMetrics.length > 0) {
          const deviceConfidence = candidateDevices.length === 1 ? 1.0 : 0.8;
          validCombinations.push({
            device,
            metrics: matchingMetrics.map(m => m.name),
            deviceConfidence,
            metricConfidence: matchingMetrics[0].confidence
          });
        }
        
      } catch (error) {
        console.error(`[IntelligentComposer] Error getting metrics for ${device.name}:`, error);
      }
    }
    
    console.log(`[IntelligentComposer] Found ${validCombinations.length} valid device+metric combinations`);
    
    // FINAL DECISION
    if (validCombinations.length === 0) {
      return {
        status: 'failed',
        message: `No metrics found matching: ${metricHints.join(' or ')}`,
        confidence: 0
      };
    }
    
    if (validCombinations.length === 1 || 
        (validCombinations.length > 1 && validCombinations[0].metricConfidence === 1.0)) {
      // UNIVOCO!
      const combo = validCombinations[0];
      const totalConfidence = (combo.deviceConfidence + combo.metricConfidence) / 2;
      
      console.log(`[IntelligentComposer] ✅ Unique match: ${combo.device.name} - ${combo.metrics.join(', ')}`);
      
      return {
        status: 'completed',
        composed_input: {
          ...input,
          device_id: combo.device.id,
          metric_names: combo.metrics
        },
        message: `Reading ${combo.metrics.join(', ')} from "${combo.device.name}"`,
        confidence: totalConfidence
      };
    }
    
    // Multiple options - clarification needed
    if (candidateDevices.length === 1) {
      // Single device, multiple metrics
      console.log('[IntelligentComposer] 🤔 Single device, multiple metrics → Ask which metric');
      
      return {
        status: 'needs_clarification',
        message: `Which metric do you want from "${candidateDevices[0].name}"?`,
        suggestions: validCombinations[0].metrics.map(m => ({
          label: m,
          value: {
            device_id: candidateDevices[0].id,
            metric_names: [m]
          },
          description: `Read ${m}`,
          confidence: 0.7
        })),
        confidence: 0.6
      };
    } else {
      // Multiple devices+metrics
      return {
        status: 'needs_clarification',
        message: 'I found multiple options. Which one?',
        suggestions: validCombinations.map(combo => ({
          label: `${combo.device.name}: ${combo.metrics.join(', ')}`,
          value: {
            device_id: combo.device.id,
            metric_names: combo.metrics
          },
          description: combo.device.is_connected ? '🟢 Connected' : '🔴 Offline',
          confidence: (combo.deviceConfidence + combo.metricConfidence) / 2
        })),
        confidence: 0.5
      };
    }
  }
  
  // Default: single device, no metrics specified
  if (candidateDevices.length === 1) {
    return {
      status: 'completed',
      composed_input: {
        ...input,
        device_id: candidateDevices[0].id
      },
      message: `Reading data from "${candidateDevices[0].name}"`,
      confidence: 0.8
    };
  }
  
  // Fallback
  return {
    status: 'needs_clarification',
    message: 'Which device do you want to read data from?',
    suggestions: candidateDevices.slice(0, 10).map(d => ({
      label: `${d.name} (${d.serial})`,
      value: { device_id: d.id },
      description: d.is_connected ? '🟢 Connected' : '🔴 Offline',
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
 * Extract metric hints from user prompt
 */
function extractMetricHints(prompt: string): string[] {
  const hints: string[] = [];
  const lower = prompt.toLowerCase();
  
  // Metric keywords mapping
  const metricKeywords: Record<string, string[]> = {
    'temperature': ['temperature', 'temp'],
    'temperatura': ['temperature', 'temp'],
    'humidity': ['humidity', 'humid'],
    'umidità': ['humidity', 'humid'],
    'pressure': ['pressure', 'press'],
    'pressione': ['pressure', 'press'],
    'weight': ['weight', 'peso'],
    'peso': ['weight'],
    'power': ['power', 'energia'],
    'energia': ['power', 'energy'],
    'voltage': ['voltage', 'volt'],
    'current': ['current', 'ampere'],
    'speed': ['speed', 'velocità'],
    'velocità': ['speed'],
    'status': ['status', 'state', 'stato'],
    'stato': ['status', 'state']
  };
  
  for (const [trigger, metrics] of Object.entries(metricKeywords)) {
    if (lower.includes(trigger)) {
      hints.push(...metrics);
    }
  }
  
  // Extract quoted metrics: "metric_name"
  const quotedRegex = /"([^"]+)"|'([^']+)'/g;
  let match;
  while ((match = quotedRegex.exec(prompt)) !== null) {
    hints.push(match[1] || match[2]);
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

/**
 * Get available metrics for a device
 */
async function getDeviceMetrics(
  deviceId: string,
  auth_token: string
): Promise<string[]> {
  try {
    const organizationId = await fetchFirstOrganizationId(auth_token);
    const response = await axios.get(
      `${THINGS5_BASE_URL}/organizations/${organizationId}/machines/${deviceId}/machine_firmware`,
      {
        headers: { Authorization: `Bearer ${auth_token}` },
        params: { include_machine_variables: true }
      }
    );
    
    // Extract metric names from machine_variables
    const variables = response.data?.data?.machine_variables || [];
    const metrics = variables
      .filter((v: any) => v.type === 'metric')
      .map((v: any) => v.name);
    
    return metrics;
  } catch (error) {
    console.error('[IntelligentComposer] Error fetching metrics:', error);
    return [];
  }
}
