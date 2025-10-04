# 🧠 Intelligent Tool Call Composition System

**Data**: 2025-10-04  
**Versione**: 1.0 (Experimental)  
**Status**: 🚧 Design & Prototype

---

## 📋 Concetto

Un sistema **AI-enhanced** che analizza richieste incomplete e **compone automaticamente** la chiamata migliore basandosi su:
- Machine context disponibile
- Tool dependencies
- Termini estratti dal prompt dell'utente
- Fuzzy matching intelligente

---

## 🎯 Problema Risolto

### Oggi (con Auto-Resolution)

```
User: "Accendi la luce"

AI chiama: machine_command_execute({})
           ↓
❌ Validation Error: "Must provide device_name or device_id"
```

**Limitazione**: L'AI deve **sempre** fornire almeno device_name

---

### Domani (con Intelligent Composition)

```
User: "Accendi la luce"

AI chiama: machine_command_execute({})
           ↓
🧠 Intelligent Composer:
   1. Analizza: manca device e command
   2. Estrae hints dal prompt: "accendi" → turn_on, "luce" → light
   3. Cerca nel context: macchine con comando "light"
   4. Trova: Frigo Cucina, Frigo Sala
   5. Decide:
      
      CASO A (univoco):
      ✅ Solo 1 match → Auto-complete ed esegue
      
      CASO B (ambiguo):
      🤔 Ritorna: "Ho trovato 2 macchine con luce:
          1. Frigo Cucina
          2. Frigo Sala
          Quale vuoi controllare?"
```

---

## 🚀 Features

### 1. Auto-Completion Intelligente

Quando il match è **univoco**, esegue automaticamente:

```typescript
Input:  { } // Vuoto!
Prompt: "Spegni il frigo"

Composer analizza:
- Hint device: "frigo"
- Hint command: "spegni" → turn_off
- Cerca: macchine con nome "frigo" AND comando "turn_off"
- Trova: 1 solo match (Frigo Cucina)

Output: {
  device_id: "abc-123",
  machine_command_id: "cmd-456"
}

✅ Esegue automaticamente!
```

### 2. Suggerimenti Intelligenti

Quando **ambiguo**, chiede conferma con opzioni:

```typescript
Input:  { }
Prompt: "Accendi la luce"

Composer analizza:
- Hint command: "accendi luce" → turn_on_light
- Cerca: tutte le macchine con questo comando
- Trova: 3 matches

Output: {
  status: 'needs_clarification',
  message: "Ho trovato 3 macchine con luce. Quale?",
  suggestions: [
    { label: "Frigo Cucina", value: {...}, confidence: 0.9 },
    { label: "Frigo Sala", value: {...}, confidence: 0.9 },
    { label: "Abbattitore", value: {...}, confidence: 0.8 }
  ]
}

AI presenta opzioni all'utente
→ User sceglie
→ AI chiama di nuovo con scelta
→ Esegue!
```

### 3. Estrazione Termini da Prompt

Riconosce automaticamente:

```typescript
// Device hints
"frigo", "fridge", "refrigerator" → cerca macchine con questi nomi
"abbattitore", "blast chiller"
"FRIGO001" → serial number
"Frigo Cucina" → nome esatto

// Command hints
"accendi" → turn_on, start, on
"spegni" → turn_off, stop, off
"luce" → light, lamp, led
"defrost", "sbrina" → defrost
"temperatura" → temperature, temp
```

### 4. Fuzzy Matching Multi-Level

```typescript
Priority 1: Exact ID match
Priority 2: Exact serial match
Priority 3: Exact name match
Priority 4: Partial name match
Priority 5: Keyword match
Priority 6: Description match
```

---

## 💡 Casi d'Uso

### Caso 1: Comando Implicito

**User**: *"Frigo cucina"* (senza specificare azione)

```typescript
Composer:
- Device: "Frigo Cucina" → trovato
- Command: non specificato
- Opzioni:
  1. Mostra comandi disponibili
  2. Suggerisce azione più comune

Output:
"Cosa vuoi fare con Frigo Cucina?
 - Accendi luce
 - Spegni luce
 - Avvia defrost
 - Leggi temperatura"
```

### Caso 2: Device Implicito

**User**: *"Accendi la luce"* (senza specificare quale)

```typescript
Composer:
- Device: non specificato
- Command: "light" → identificato
- Cerca: macchine con comando light

SCENARIO A: 1 macchina
→ Esegue automaticamente

SCENARIO B: N macchine
→ Chiede quale ("Frigo Cucina o Frigo Sala?")

SCENARIO C: 0 macchine
→ "Nessuna macchina ha comando luce"
```

### Caso 3: Richiesta Multi-Step

**User**: *"Mostrami i dati del frigo"*

```typescript
Step 1: Composer identifica
- Device: "frigo" → Frigo Cucina
- Action: "mostrami dati" → metrics_read

Step 2: Compone chiamata
tool: metrics_read
args: { device_name: "Frigo Cucina" }

Step 3: Auto-resolution
device_name → device_id

Step 4: Esegue
GET /devices/{id}/metrics
```

### Caso 4: Natural Language Complessa

**User**: *"Voglio sapere se il frigo della cucina è connesso e qual è la temperatura"*

```typescript
Composer estrae:
1. Device: "frigo della cucina" → Frigo Cucina
2. Questions:
   a) "è connesso" → check is_connected
   b) "temperatura" → read metric "temperature"

Composer decide:
→ tool: device_firmware_detail (per status)
→ tool: metrics_read (per temperature)

Output combinato:
"Frigo Cucina:
 - Status: 🟢 Connesso
 - Temperatura: 4.5°C"
```

---

## 🔧 Architettura

### Pipeline Completa

```
User Input
    ↓
AI interpreta
    ↓
Tool Call (può essere incompleto)
    ↓
┌─────────────────────────────────┐
│ STEP 0: Input Sanitization     │
│ Fix format errors               │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ STEP 1: Machine Context Load   │
│ Pre-load available machines     │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ STEP 1.5: Intelligent Composer  │ ← NUOVO!
│ Analyze & compose best call     │
└─────────────────────────────────┘
    ↓
    ├─ Status: completed
    │  → Continue to Step 2
    │
    ├─ Status: needs_clarification
    │  → Return suggestions to AI
    │  → AI asks user
    │  → User responds
    │  → New tool call with choice
    │
    └─ Status: failed
       → Return error message
    ↓
┌─────────────────────────────────┐
│ STEP 2: Auto-Resolution         │
│ Resolve remaining params        │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ STEP 3: Tool Handler            │
│ Execute API call                │
└─────────────────────────────────┘
    ↓
Result
```

### Composition Algorithm

```typescript
function composeIntelligently(context) {
  // 1. Analyze input
  const hasDevice = checkDeviceParams(context.input);
  const hasCommand = checkCommandParams(context.input);
  
  // 2. Extract hints from prompt
  const deviceHints = extractDeviceHints(context.user_prompt);
  const commandHints = extractCommandHints(context.user_prompt);
  
  // 3. Find candidates
  const candidateDevices = findDevices(
    context.machine_context, 
    deviceHints, 
    hasDevice ? context.input : null
  );
  
  // 4. For each device, check command availability
  const validCombinations = [];
  for (const device of candidateDevices) {
    const commands = await getDeviceCommands(device.id);
    const matchingCommand = findCommand(commands, commandHints);
    
    if (matchingCommand) {
      validCombinations.push({
        device,
        command: matchingCommand,
        confidence: calculateConfidence(device, matchingCommand, hints)
      });
    }
  }
  
  // 5. Decide action
  if (validCombinations.length === 0) {
    return { status: 'failed', message: '...' };
  }
  
  if (validCombinations.length === 1) {
    // UNIVOCO! Auto-complete
    return {
      status: 'completed',
      composed_input: {
        device_id: combo.device.id,
        machine_command_id: combo.command.id
      }
    };
  }
  
  // Multiple options - need clarification
  return {
    status: 'needs_clarification',
    suggestions: validCombinations.map(toSuggestion)
  };
}
```

---

## 📊 Confidence Scoring

Il sistema calcola un **punteggio di confidenza** (0-1) per ogni composizione:

```typescript
Confidence Factors:

1.0 → Exact match (ID, serial, name)
0.9 → Partial match con prompt hint
0.8 → Fuzzy match con keyword
0.7 → Single device in org
0.5 → Multiple options available
0.3 → Guessed from context
0.0 → No match found

Decision Threshold:
- confidence >= 0.9 → Auto-execute
- confidence >= 0.7 → Suggest as primary option
- confidence < 0.7  → Ask for clarification
```

---

## 🎨 Integration con Realtime API

### Scenario Ideale con Realtime API

OpenAI Realtime API può fornire:
1. **User prompt originale** (testo vocale trascritto)
2. **Context conversazionale** (messaggi precedenti)
3. **Function call** (tool + args)

```typescript
// Realtime API webhook payload
{
  "user_message": "Accendi la luce del frigo",
  "function_call": {
    "name": "machine_command_execute",
    "arguments": {
      // Può essere vuoto o parziale!
    }
  },
  "conversation_history": [
    {"role": "user", "content": "Ho due frigo"},
    {"role": "assistant", "content": "Sì, vedo Frigo Cucina e Frigo Sala"}
  ]
}
```

**Intelligent Composer usa**:
- `user_message` → estrae hints
- `conversation_history` → context aggiuntivo
- `machine_context` → macchine disponibili
- `function_call.arguments` → parametri parziali

---

## 🧪 Testing

### Test Case 1: Auto-Complete Univoco

```bash
Input:
  tool: machine_command_execute
  args: {}
  prompt: "Accendi il frigo"
  context: [Frigo Cucina (unica macchina)]

Expected:
  status: completed
  composed_input: {
    device_id: "frigo-cucina-id",
    machine_command_id: "turn_on_light_id"
  }
  confidence: 0.9

Result: ✅ Auto-executed
```

### Test Case 2: Clarification Needed

```bash
Input:
  tool: machine_command_execute
  args: {}
  prompt: "Accendi la luce"
  context: [Frigo Cucina, Frigo Sala, Abbattitore]

Expected:
  status: needs_clarification
  suggestions: [
    {label: "Frigo Cucina", ...},
    {label: "Frigo Sala", ...},
    {label: "Abbattitore", ...}
  ]

Result: ✅ Returns suggestions
```

### Test Case 3: No Match

```bash
Input:
  tool: machine_command_execute
  args: {}
  prompt: "Accendi il forno"
  context: [Frigo Cucina, Frigo Sala] (no forno)

Expected:
  status: failed
  message: "No device named 'forno' found"

Result: ✅ Clear error
```

---

## 🚦 Abilitazione (Feature Flag)

Sistema attivabile con variabile ambiente:

```bash
# .env
ENABLE_INTELLIGENT_COMPOSITION=true

# Opzioni
INTELLIGENT_COMPOSITION_CONFIDENCE_THRESHOLD=0.9
INTELLIGENT_COMPOSITION_MAX_SUGGESTIONS=5
```

```typescript
// src/server/things5.ts
const ENABLE_INTELLIGENT_COMPOSITION = 
  process.env.ENABLE_INTELLIGENT_COMPOSITION === 'true';

if (ENABLE_INTELLIGENT_COMPOSITION && auth_token) {
  const compositionResult = await composeIntelligently({
    tool_name: tool.name,
    original_input: input,
    user_prompt: context.user_prompt, // Se disponibile
    machine_context: machineContext,
    auth_token
  });
  
  if (compositionResult.status === 'completed') {
    input = compositionResult.composed_input;
  } else if (compositionResult.status === 'needs_clarification') {
    // Return suggestions to AI
    return {
      status: 'needs_input',
      message: compositionResult.message,
      suggestions: compositionResult.suggestions
    };
  }
}
```

---

## 🎯 Benefici

### Per l'AI
- ✅ **Può fare chiamate incomplete**: non serve tutti i parametri
- ✅ **Natural language**: comprende intent dal prompt
- ✅ **Guided interaction**: riceve suggerimenti strutturati
- ✅ **Learning**: pattern recognition nel tempo

### Per il Sistema
- ✅ **Più robusto**: gestisce più casi edge
- ✅ **Meno errori**: validazione preventiva
- ✅ **Better UX**: conversazioni più naturali
- ✅ **Smart defaults**: scelte intelligenti

### Per l'Utente
- ✅ **Meno specifiche richieste**: "accendi luce" è sufficiente
- ✅ **Conversazioni naturali**: come parlare con umano
- ✅ **Opzioni chiare**: quando ambiguo, scelte guidate
- ✅ **Veloce**: auto-complete quando possibile

---

## 🔮 Evoluzioni Future

### 1. Learning System
```typescript
// Track user preferences
if (userAlwaysChooses("Frigo Cucina") when prompt includes "frigo") {
  increaseConfidence("Frigo Cucina", 0.1);
}

// Next time: auto-select Frigo Cucina
```

### 2. Multi-Tool Composition
```typescript
User: "Mostrami temperatura e umidità del frigo"

Composer:
→ Compone 2 chiamate automaticamente:
  1. metrics_read(device="frigo", metrics=["temperature"])
  2. metrics_read(device="frigo", metrics=["humidity"])
  
→ Combina risultati
→ Presenta risposta unica
```

### 3. Context from Conversation
```typescript
// Use conversation history
Conversation:
  User: "Ho un problema con il frigo cucina"
  AI: "Posso aiutarti. Cosa succede?"
  User: "Accendi la luce"  ← "frigo cucina" implicito!

Composer:
→ Estrae context da storia: "frigo cucina"
→ Auto-complete con Frigo Cucina
```

### 4. Predictive Actions
```typescript
// Predict next likely action
After user reads temperature:
→ Suggest: "Vuoi regolare la temperatura?"

After user turns on light:
→ Suggest: "Vuoi anche avviare il defrost?"
```

---

## ✅ Conclusione

L'**Intelligent Composition System** è:

- 🎯 **Fattibile**: Tecnicamente implementabile con codice esistente
- 🚀 **Potente**: Riduce drasticamente friction nelle interazioni
- 🧠 **Intelligente**: Sfrutta AI per comprendere intent
- 🔄 **Incrementale**: Può essere aggiunto gradualmente

**Status**: ✅ **Prototipo pronto** - Ready for integration!

---

## 🔗 Integrazione Step-by-Step

### Fase 1: Foundation (ora)
- ✅ Intelligent Composer implementato
- ✅ Hint extraction
- ✅ Fuzzy matching
- ✅ Confidence scoring

### Fase 2: Integration (next)
- ⏳ Integrate nel tool handler pipeline
- ⏳ Feature flag per enable/disable
- ⏳ Logging e monitoring
- ⏳ Testing su casi reali

### Fase 3: Enhancement
- ⏳ Learning da user behavior
- ⏳ Multi-tool composition
- ⏳ Conversation context
- ⏳ Predictive suggestions

**Il sistema è pronto per essere integrato!** 🎉🚀
