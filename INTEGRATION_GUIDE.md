# 🔌 Integration Guide: Intelligent Composition System

**Come integrare il sistema nel server MCP**

---

## 📋 Overview

Il sistema è **già implementato** in `src/utils/intelligentComposer.ts`.  
Questa guida mostra come **attivarlo** nel server.

---

## 🚀 Quick Start (3 Step)

### Step 1: Aggiungi Feature Flag

```bash
# .env
ENABLE_INTELLIGENT_COMPOSITION=true
INTELLIGENT_COMPOSITION_CONFIDENCE_THRESHOLD=0.9
```

### Step 2: Modifica `src/server/things5.ts`

```typescript
import { composeIntelligently } from "../utils/intelligentComposer.js";

// ... existing imports ...

// Add flag check
const ENABLE_INTELLIGENT_COMPOSITION = 
  process.env.ENABLE_INTELLIGENT_COMPOSITION === 'true';
const CONFIDENCE_THRESHOLD = 
  parseFloat(process.env.INTELLIGENT_COMPOSITION_CONFIDENCE_THRESHOLD || '0.9');
```

### Step 3: Integra nella Pipeline

```typescript
// Nel tool handler, DOPO sanitization e context loading:

async (input: any) => {
  // ... existing code ...
  
  // Step 0: Sanitize
  input = fullSanitize(tool.name, input);
  
  // Step 1: Load context
  machineContext = await getAvailableMachines(auth_token);
  
  // Step 1.5: INTELLIGENT COMPOSITION (NEW!)
  if (ENABLE_INTELLIGENT_COMPOSITION && auth_token) {
    console.log('\n[MCP] 🧠 Intelligent composition...');
    
    const compositionResult = await composeIntelligently({
      tool_name: tool.name,
      original_input: input,
      user_prompt: input._user_prompt, // Se disponibile da Realtime API
      machine_context: machineContext,
      auth_token
    });
    
    console.log(`[MCP] Composition status: ${compositionResult.status}`);
    console.log(`[MCP] Confidence: ${compositionResult.confidence}`);
    
    if (compositionResult.status === 'completed') {
      // Auto-completed!
      if (compositionResult.confidence >= CONFIDENCE_THRESHOLD) {
        input = compositionResult.composed_input;
        console.log('[MCP] ✅ Auto-completed:', JSON.stringify(input, null, 2));
      } else {
        console.log('[MCP] ⚠️  Low confidence, falling back to auto-resolution');
      }
    } else if (compositionResult.status === 'needs_clarification') {
      // Need user input
      console.log('[MCP] 🤔 Needs clarification');
      
      // Return special response for AI to handle
      return {
        content: [{
          type: 'text',
          text: compositionResult.message
        }],
        isError: false,
        _needs_clarification: true,
        _suggestions: compositionResult.suggestions
      };
    } else {
      // Failed
      console.log('[MCP] ❌ Composition failed:', compositionResult.message);
      // Continue to auto-resolution
    }
  }
  
  // Step 2: Auto-resolve (existing)
  if (canAutoResolve(tool.name) && auth_token) {
    resolvedInput = await autoResolveParameters(...);
  }
  
  // Step 3: Execute (existing)
  return await tool.handler(resolvedInput, {} as any);
}
```

---

## 🎯 Integration Point completa

Ecco il codice completo da aggiungere a `things5.ts`:

```typescript
// ... existing imports ...
import { composeIntelligently } from "../utils/intelligentComposer.js";

// Constants
const ENABLE_INTELLIGENT_COMPOSITION = 
  process.env.ENABLE_INTELLIGENT_COMPOSITION === 'true';
const CONFIDENCE_THRESHOLD = 
  parseFloat(process.env.INTELLIGENT_COMPOSITION_CONFIDENCE_THRESHOLD || '0.9');

// Nel tool registration:
server.registerTool(
  {
    title: tool.name,
    description: tool.description || '',
    inputSchema: zodShape
  },
  async (input: any) => {
    console.log('\n' + '='.repeat(80));
    console.log(`[MCP] 🔧 Tool Call: ${tool.name}`);
    console.log('='.repeat(80));
    console.log('[MCP] Original input:', JSON.stringify(input, null, 2));
    
    // STEP 0: Sanitization
    console.log('\n[MCP] 🧹 Sanitizing input...');
    input = fullSanitize(tool.name, input);
    
    // STEP 1: Machine Context Pre-loading
    let machineContext;
    if (auth_token) {
      try {
        console.log('\n[MCP] 📋 Pre-loading machine context...');
        machineContext = await getAvailableMachines(auth_token);
        
        const cacheInfo = getCacheInfo();
        if (cacheInfo) {
          console.log(`[MCP] ✅ Machine context loaded: ${cacheInfo.machines} machines`);
        }
      } catch (error: any) {
        console.error('[MCP] ⚠️  Failed to pre-load machine context:', error.message);
      }
    }
    
    // STEP 1.5: INTELLIGENT COMPOSITION (NEW!)
    if (ENABLE_INTELLIGENT_COMPOSITION && auth_token && machineContext) {
      try {
        console.log('\n[MCP] 🧠 Intelligent composition...');
        
        const compositionResult = await composeIntelligently({
          tool_name: tool.name,
          original_input: input,
          user_prompt: input._user_prompt, // If available
          machine_context: machineContext,
          auth_token
        });
        
        console.log(`[MCP] Composition status: ${compositionResult.status}`);
        console.log(`[MCP] Confidence: ${compositionResult.confidence}`);
        
        if (compositionResult.status === 'completed') {
          if (compositionResult.confidence >= CONFIDENCE_THRESHOLD) {
            input = compositionResult.composed_input;
            console.log('[MCP] ✅ Input auto-completed');
            console.log(JSON.stringify(input, null, 2));
            
            if (compositionResult.message) {
              console.log(`[MCP] 💬 "${compositionResult.message}"`);
            }
          } else {
            console.log(`[MCP] ⚠️  Confidence too low (${compositionResult.confidence} < ${CONFIDENCE_THRESHOLD})`);
            console.log('[MCP] Falling back to standard auto-resolution');
          }
        } else if (compositionResult.status === 'needs_clarification') {
          console.log('[MCP] 🤔 Needs clarification from user');
          console.log(`[MCP] Message: ${compositionResult.message}`);
          console.log(`[MCP] Suggestions: ${compositionResult.suggestions?.length || 0}`);
          
          // Format suggestions for AI
          let suggestionText = compositionResult.message + '\n\nOptions:\n';
          compositionResult.suggestions?.forEach((s, i) => {
            suggestionText += `${i + 1}. ${s.label} - ${s.description}\n`;
          });
          
          // Return to AI for user interaction
          return {
            content: [{
              type: 'text',
              text: suggestionText
            }],
            isError: false,
            _needs_clarification: true,
            _suggestions: compositionResult.suggestions
          };
        } else {
          // Failed
          console.log('[MCP] ❌ Composition failed:', compositionResult.message);
          console.log('[MCP] Proceeding with standard auto-resolution');
        }
      } catch (error: any) {
        console.error('[MCP] ⚠️  Error in intelligent composition:', error.message);
        console.log('[MCP] Falling back to standard auto-resolution');
      }
    }
    
    // STEP 2: Auto-Resolution (existing)
    let resolvedInput = input;
    if (canAutoResolve(tool.name) && auth_token) {
      console.log('\n[MCP] 🔄 Auto-resolving dependencies...');
      resolvedInput = await autoResolveParameters(
        tool.name,
        input,
        auth_token,
        machineContext
      );
      
      if (JSON.stringify(resolvedInput) !== JSON.stringify(input)) {
        console.log('[MCP] ✅ Parameters auto-resolved:');
        console.log(JSON.stringify(resolvedInput, null, 2));
      }
    }
    
    // STEP 3: Tool Execution (existing)
    console.log('\n[MCP] ⚡ Executing tool handler...');
    const result = await tool.handler(resolvedInput, {} as any);
    
    console.log('[MCP] ✅ Tool execution completed');
    console.log('='.repeat(80) + '\n');
    
    return result;
  }
);
```

---

## 🎨 Receiving User Prompt from Realtime API

Se OpenAI Realtime API fornisce il prompt utente originale:

```typescript
// In streaming transport handler
app.post('/mcp', async (req, res) => {
  const body = req.body;
  
  // Extract user prompt if available
  const userPrompt = body.params?.user_prompt || 
                    body.params?.context?.user_message ||
                    null;
  
  // Inject into tool arguments
  if (userPrompt && body.params?.arguments) {
    body.params.arguments._user_prompt = userPrompt;
  }
  
  // Continue with normal handling
  await transport.handleRequest(req, res, body);
});
```

---

## 🧪 Testing Integration

### Test 1: Enable Flag

```bash
# Set in .env
ENABLE_INTELLIGENT_COMPOSITION=true

# Restart server
npm start

# Check logs
# Should see: "[MCP] 🧠 Intelligent composition..."
```

### Test 2: Auto-Complete

```bash
# Test with curl
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "machine_command_execute",
      "arguments": {
        "_user_prompt": "Accendi la luce del frigo cucina"
      }
    }
  }'

# Expected in logs:
# [MCP] 🧠 Intelligent composition...
# [MCP] Composition status: completed
# [MCP] Confidence: 0.9
# [MCP] ✅ Input auto-completed
```

### Test 3: Clarification

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "machine_command_execute",
      "arguments": {
        "_user_prompt": "Accendi la luce"
      }
    }
  }'

# Expected response:
# {
#   "content": [{
#     "type": "text",
#     "text": "Ho trovato 2 macchine con luce. Quale?\n\nOptions:\n1. Frigo Cucina..."
#   }],
#   "_needs_clarification": true,
#   "_suggestions": [...]
# }
```

---

## 🚦 Gradual Rollout Strategy

### Phase 1: Monitoring Only (Week 1)

```typescript
if (ENABLE_INTELLIGENT_COMPOSITION) {
  const result = await composeIntelligently(...);
  console.log('[MONITORING] Composition result:', result);
  // Don't use result, just log for analysis
}
```

### Phase 2: High Confidence Only (Week 2)

```typescript
if (result.confidence >= 0.95) {
  input = result.composed_input;
}
```

### Phase 3: Full Rollout (Week 3+)

```typescript
if (result.confidence >= 0.9) {
  input = result.composed_input;
}
```

---

## 📊 Monitoring & Metrics

### Metrics to Track

```typescript
// Add to logging
const metrics = {
  composition_attempts: 0,
  composition_completed: 0,
  composition_clarification_needed: 0,
  composition_failed: 0,
  avg_confidence: 0,
  auto_complete_success_rate: 0
};

// After each composition
metrics.composition_attempts++;
if (result.status === 'completed') {
  metrics.composition_completed++;
}
// ... etc

// Log periodically
setInterval(() => {
  console.log('[METRICS] Intelligent Composition:', metrics);
}, 60000); // Every minute
```

---

## ✅ Checklist per Go-Live

- [ ] Feature flag configurata
- [ ] Confidence threshold settata (0.9 consigliato)
- [ ] Logging attivato
- [ ] Monitoring metrics implementato
- [ ] Test su tool principali
- [ ] Documentazione aggiornata
- [ ] Team training completato
- [ ] Rollback plan pronto

---

## 🎯 Conclusione

Il sistema è **production-ready** e può essere integrato in **3 semplici step**:

1. ✅ Abilita feature flag
2. ✅ Aggiungi chiamata a `composeIntelligently()`
3. ✅ Gestisci i 3 stati: completed, needs_clarification, failed

**Start small, monitor, scale gradually!** 🚀
