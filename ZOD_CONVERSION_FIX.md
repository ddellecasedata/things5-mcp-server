# 🔧 Fix: JSON Schema to Zod Conversion

**Data**: 2025-10-04  
**Issue**: `keyValidator._parse is not a function` error with OpenAI Realtime API

---

## 🐛 Problema

L'errore si verificava perché il server MCP passava **JSON Schema** direttamente all'API `registerTool()`, ma l'SDK si aspetta **Zod schema**.

```typescript
// ❌ PRIMA (causava l'errore)
server.registerTool(
  tool.name,
  {
    inputSchema: tool.inputSchema  // JSON Schema diretto → ERROR
  },
  handler
);
```

---

## ✅ Soluzione

Creata utility di conversione completa **JSON Schema → Zod** che preserva:
- ✅ Array items tipizzati (`array<string>`, `array<object>`)
- ✅ Integer vs Number
- ✅ Enum values
- ✅ Min/max validations
- ✅ Pattern regex
- ✅ Required vs Optional fields
- ✅ Default values
- ✅ Descrizioni

---

## 📁 File Modificati

### 1. `src/utils/jsonSchemaToZod.ts` (NUOVO)
Utility completa per conversione JSON Schema → Zod:
- `jsonSchemaToZod()` - Conversione ricorsiva di qualsiasi schema
- `jsonSchemaPropertiesToZodShape()` - Converte properties in ZodRawShape

### 2. `src/server/things5.ts` (MODIFICATO)
```typescript
import { jsonSchemaPropertiesToZodShape } from "../utils/jsonSchemaToZod.js";

// Conversione corretta
const jsonSchema = tool.inputSchema || { type: 'object', properties: {} };
const zodShape = jsonSchemaPropertiesToZodShape(jsonSchema);

server.registerTool(
  tool.name,
  {
    inputSchema: zodShape  // ✅ Zod RawShape
  },
  handler
);
```

---

## 🧪 Test

### Test Conversione (`test-zod-conversion.ts`)
```bash
npx tsx test-zod-conversion.ts
```

**Risultati**:
- ✅ Array con items: corretto
- ✅ Integer con validazioni: corretto
- ✅ Enum: corretto
- ✅ Schema complesso: corretto
- ✅ Validazione errori: corretto

---

## 🎯 Risultato

### Prima
```
❌ JSON-RPC error: keyValidator._parse is not a function
```

### Dopo
```
✅ Tool registrati correttamente con Zod schema
✅ Validazione input funzionante
✅ Compatibile con OpenAI Realtime API
```

---

## 🚀 Caratteristiche

### Conversione Completa
```typescript
// JSON Schema
{
  type: 'object',
  properties: {
    metric_names: {
      type: 'array',
      items: { type: 'string' }
    },
    limit: {
      type: 'integer',
      exclusiveMinimum: 0,
      default: 100
    },
    sorting: {
      type: 'string',
      enum: ['asc', 'desc']
    }
  },
  required: ['metric_names']
}

// Zod Schema generato ✅
{
  metric_names: z.array(z.string()),
  limit: z.number().int().gt(0).default(100).optional(),
  sorting: z.enum(['asc', 'desc']).optional()
}
```

### Tipi Supportati
- ✅ `string` (con pattern, min/maxLength)
- ✅ `number` (con min/max)
- ✅ `integer` (con min/max, exclusive)
- ✅ `boolean`
- ✅ `array` (con items tipizzati)
- ✅ `object` (con properties annidate)
- ✅ `enum`

---

## 📊 Impatto

| Aspetto | Prima | Dopo |
|---------|-------|------|
| **Errore runtime** | ❌ keyValidator._parse | ✅ Nessuno |
| **Array items** | ❌ Persi | ✅ Preservati |
| **Integer type** | ❌ Perso | ✅ Preservato |
| **Enum** | ❌ Perso | ✅ Preservato |
| **Validazioni** | ❌ Perse | ✅ Preservate |
| **OpenAI compatibility** | ❌ | ✅ |

---

## ✅ Status

**RISOLTO**: Il server ora converte correttamente JSON Schema → Zod e funziona con OpenAI Realtime API.

**Test**: Tutti i test passano ✅
**Build**: Nessun errore TypeScript ✅
**Compatibilità**: OpenAI Realtime API ready ✅
