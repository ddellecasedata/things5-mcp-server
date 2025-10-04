/**
 * Input Sanitizer
 * 
 * Normalizza e corregge automaticamente errori comuni negli input dei tool
 * prima della validazione Zod, rendendo il sistema più tollerante agli errori
 * dell'AI.
 */

/**
 * Sanitize input for a specific tool
 * Corrects common mistakes made by AI models
 */
export function sanitizeToolInput(toolName: string, input: any): any {
  if (!input || typeof input !== 'object') {
    return input;
  }

  const sanitized = { ...input };
  let hasChanges = false;

  // Apply tool-specific sanitization
  switch (toolName) {
    case 'metrics_read':
    case 'events_read':
    case 'states_read':
      sanitized._sanitized = sanitizeDataReadingTool(sanitized);
      hasChanges = sanitized._sanitized.hasChanges;
      delete sanitized._sanitized;
      break;
      
    case 'read_parameters':
    case 'read_single_parameter':
      sanitized._sanitized = sanitizeParametersTool(sanitized);
      hasChanges = sanitized._sanitized.hasChanges;
      delete sanitized._sanitized;
      break;
      
    case 'aggregated_metrics':
      sanitized._sanitized = sanitizeAggregatedMetricsTool(sanitized);
      hasChanges = sanitized._sanitized.hasChanges;
      delete sanitized._sanitized;
      break;
      
    case 'overview_events':
    case 'overview_alarms':
      sanitized._sanitized = sanitizeOverviewTool(sanitized);
      hasChanges = sanitized._sanitized.hasChanges;
      delete sanitized._sanitized;
      break;
  }

  if (hasChanges) {
    console.log('[InputSanitizer] ✅ Corrected input for', toolName);
    console.log('[InputSanitizer] Before:', JSON.stringify(input));
    console.log('[InputSanitizer] After:', JSON.stringify(sanitized));
  }

  return sanitized;
}

/**
 * Sanitize data reading tools (metrics_read, events_read, states_read)
 */
function sanitizeDataReadingTool(input: any): any {
  let hasChanges = false;

  // Fix: metric_names/event_names/state_names as string → convert to array
  const arrayFields = ['metric_names', 'events_names', 'states_names', 'event_names'];
  
  for (const field of arrayFields) {
    if (input[field] && typeof input[field] === 'string') {
      console.log(`[InputSanitizer] 🔧 Converting ${field} from string to array`);
      input[field] = [input[field]];
      hasChanges = true;
    }
  }

  // Fix: severity as string → convert to array
  if (input.severity && typeof input.severity === 'string') {
    console.log('[InputSanitizer] 🔧 Converting severity from string to array');
    input.severity = [input.severity];
    hasChanges = true;
  }

  return { ...input, hasChanges };
}

/**
 * Sanitize parameter reading tools
 */
function sanitizeParametersTool(input: any): any {
  let hasChanges = false;

  // Fix: parameter_name_list as string → convert to array
  if (input.parameter_name_list && typeof input.parameter_name_list === 'string') {
    console.log('[InputSanitizer] 🔧 Converting parameter_name_list from string to array');
    input.parameter_name_list = [input.parameter_name_list];
    hasChanges = true;
  }

  // Fix: configuration_filter as string → convert to array
  if (input.configuration_filter && typeof input.configuration_filter === 'string') {
    console.log('[InputSanitizer] 🔧 Converting configuration_filter from string to array');
    input.configuration_filter = [input.configuration_filter];
    hasChanges = true;
  }

  return { ...input, hasChanges };
}

/**
 * Sanitize aggregated metrics tool
 */
function sanitizeAggregatedMetricsTool(input: any): any {
  let hasChanges = false;

  // Fix: machine_ids as string → convert to array
  if (input.machine_ids && typeof input.machine_ids === 'string') {
    console.log('[InputSanitizer] 🔧 Converting machine_ids from string to array');
    input.machine_ids = [input.machine_ids];
    hasChanges = true;
  }

  return { ...input, hasChanges };
}

/**
 * Sanitize overview tools
 */
function sanitizeOverviewTool(input: any): any {
  let hasChanges = false;

  // Fix: machine_ids as string → convert to array
  if (input.machine_ids && typeof input.machine_ids === 'string') {
    console.log('[InputSanitizer] 🔧 Converting machine_ids from string to array');
    input.machine_ids = [input.machine_ids];
    hasChanges = true;
  }

  // Fix: severities as string → convert to array
  if (input.severities && typeof input.severities === 'string') {
    console.log('[InputSanitizer] 🔧 Converting severities from string to array');
    input.severities = [input.severities];
    hasChanges = true;
  }

  return { ...input, hasChanges };
}

/**
 * Common fixes that apply to all tools
 */
export function sanitizeCommonIssues(input: any): any {
  if (!input || typeof input !== 'object') {
    return input;
  }

  const sanitized = { ...input };
  let hasChanges = false;

  // Fix: Convert numeric strings to numbers where appropriate
  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === 'string' && key.includes('limit')) {
      const num = parseInt(value, 10);
      if (!isNaN(num)) {
        console.log(`[InputSanitizer] 🔧 Converting ${key} from string "${value}" to number ${num}`);
        sanitized[key] = num;
        hasChanges = true;
      }
    }
  }

  // Fix: Empty strings to undefined for optional fields
  for (const [key, value] of Object.entries(sanitized)) {
    if (value === '') {
      console.log(`[InputSanitizer] 🔧 Converting empty string ${key} to undefined`);
      sanitized[key] = undefined;
      hasChanges = true;
    }
  }

  return sanitized;
}

/**
 * Full sanitization pipeline
 * Applies both tool-specific and common fixes
 */
export function fullSanitize(toolName: string, input: any): any {
  // Step 1: Common fixes
  let sanitized = sanitizeCommonIssues(input);
  
  // Step 2: Tool-specific fixes
  sanitized = sanitizeToolInput(toolName, sanitized);
  
  return sanitized;
}

/**
 * Generate helpful error message when sanitization cannot fix the issue
 */
export function generateHelpfulErrorMessage(toolName: string, zodError: any): string {
  const errors = zodError.errors || zodError.issues || [];
  
  let message = `❌ Invalid arguments for ${toolName}:\n\n`;
  
  for (const error of errors) {
    const path = error.path?.join('.') || 'unknown';
    const received = error.received || 'undefined';
    const expected = error.expected || error.message;
    
    message += `• ${path}: ${expected}\n`;
    message += `  Received: ${received}\n`;
    
    // Add helpful hints
    if (error.code === 'invalid_type' && error.expected === 'array') {
      message += `  💡 Hint: This field expects an array. Use ["value"] instead of "value"\n`;
    }
    
    if (error.message?.includes('Required')) {
      message += `  💡 Hint: This field is required and cannot be omitted\n`;
    }
    
    message += '\n';
  }
  
  return message;
}
