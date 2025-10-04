/**
 * Test della conversione JSON Schema → Zod
 */

import { jsonSchemaPropertiesToZodShape, jsonSchemaToZod } from './src/utils/jsonSchemaToZod.js';
import { z } from 'zod';

console.log('='.repeat(80));
console.log('🧪 TEST CONVERSIONE JSON SCHEMA → ZOD');
console.log('='.repeat(80));

// Test 1: Array con items
console.log('\n📋 Test 1: Array con items');
const arraySchema = {
  type: 'object',
  properties: {
    metric_names: {
      type: 'array',
      items: { type: 'string' },
      description: 'Array of metric names'
    }
  },
  required: ['metric_names']
};

const zodShape1 = jsonSchemaPropertiesToZodShape(arraySchema);
console.log('✅ zodShape keys:', Object.keys(zodShape1));
console.log('✅ metric_names type:', zodShape1.metric_names?.constructor?.name);

// Test validazione
try {
  const testData1 = { metric_names: ['temp', 'pressure'] };
  z.object(zodShape1).parse(testData1);
  console.log('✅ Validazione array passata:', testData1);
} catch (e) {
  console.log('❌ Errore validazione:', e);
}

// Test 2: Integer
console.log('\n📋 Test 2: Integer con validazioni');
const integerSchema = {
  type: 'object',
  properties: {
    limit: {
      type: 'integer',
      exclusiveMinimum: 0,
      default: 100
    }
  }
};

const zodShape2 = jsonSchemaPropertiesToZodShape(integerSchema);
console.log('✅ zodShape keys:', Object.keys(zodShape2));

try {
  const testData2 = { limit: 50 };
  z.object(zodShape2).parse(testData2);
  console.log('✅ Validazione integer passata:', testData2);
} catch (e) {
  console.log('❌ Errore validazione:', e);
}

// Test 3: Enum
console.log('\n📋 Test 3: Enum');
const enumSchema = {
  type: 'object',
  properties: {
    sorting: {
      type: 'string',
      enum: ['asc', 'desc'],
      default: 'asc'
    }
  }
};

const zodShape3 = jsonSchemaPropertiesToZodShape(enumSchema);
console.log('✅ zodShape keys:', Object.keys(zodShape3));

try {
  const testData3 = { sorting: 'asc' };
  z.object(zodShape3).parse(testData3);
  console.log('✅ Validazione enum passata:', testData3);
} catch (e) {
  console.log('❌ Errore validazione:', e);
}

// Test 4: Schema complesso (metrics_read-like)
console.log('\n📋 Test 4: Schema complesso');
const complexSchema = {
  type: 'object',
  properties: {
    from: { type: 'string', description: 'Start date' },
    to: { type: 'string', description: 'End date' },
    metric_names: {
      type: 'array',
      items: { type: 'string' },
      description: 'Metric names'
    },
    sorting: {
      type: 'string',
      enum: ['asc', 'desc'],
      default: 'asc'
    },
    limit: {
      type: 'integer',
      default: 100
    },
    last_value: {
      type: 'boolean'
    }
  },
  required: ['from', 'to']
};

const zodShape4 = jsonSchemaPropertiesToZodShape(complexSchema);
console.log('✅ zodShape keys:', Object.keys(zodShape4));

try {
  const testData4 = {
    from: '2024-01-01',
    to: '2024-01-02',
    metric_names: ['temp'],
    sorting: 'asc',
    limit: 50
  };
  z.object(zodShape4).parse(testData4);
  console.log('✅ Validazione schema complesso passata');
} catch (e) {
  console.log('❌ Errore validazione:', e);
}

// Test 5: Verifica errore con valore invalido
console.log('\n📋 Test 5: Validazione errori');
try {
  const invalidData = { sorting: 'invalid' };
  z.object(zodShape3).parse(invalidData);
  console.log('❌ Doveva fallire ma è passata');
} catch (e: any) {
  console.log('✅ Errore correttamente rilevato:', e.errors?.[0]?.message || 'Validation failed');
}

console.log('\n' + '='.repeat(80));
console.log('✅ TUTTI I TEST COMPLETATI');
console.log('='.repeat(80));
