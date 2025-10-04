/**
 * Utility to convert JSON Schema to Zod schema
 * Preserves array items, integer types, enums, and all validations
 */

import { z } from 'zod';

export function jsonSchemaToZod(jsonSchema: any): z.ZodTypeAny {
  if (!jsonSchema || typeof jsonSchema !== 'object') {
    return z.any();
  }

  const type = jsonSchema.type;
  const description = jsonSchema.description;
  
  let zodSchema: any;

  switch (type) {
    case 'string':
      zodSchema = z.string();
      if (jsonSchema.enum) {
        // Handle enum
        zodSchema = z.enum(jsonSchema.enum as [string, ...string[]]);
      }
      if (jsonSchema.pattern) {
        zodSchema = zodSchema.regex(new RegExp(jsonSchema.pattern));
      }
      if (jsonSchema.minLength !== undefined) {
        zodSchema = zodSchema.min(jsonSchema.minLength);
      }
      if (jsonSchema.maxLength !== undefined) {
        zodSchema = zodSchema.max(jsonSchema.maxLength);
      }
      break;

    case 'number':
      zodSchema = z.number();
      if (jsonSchema.minimum !== undefined) {
        zodSchema = zodSchema.min(jsonSchema.minimum);
      }
      if (jsonSchema.maximum !== undefined) {
        zodSchema = zodSchema.max(jsonSchema.maximum);
      }
      break;

    case 'integer':
      zodSchema = z.number().int();
      if (jsonSchema.minimum !== undefined) {
        zodSchema = zodSchema.min(jsonSchema.minimum);
      }
      if (jsonSchema.maximum !== undefined) {
        zodSchema = zodSchema.max(jsonSchema.maximum);
      }
      if (jsonSchema.exclusiveMinimum !== undefined) {
        zodSchema = zodSchema.gt(jsonSchema.exclusiveMinimum);
      }
      if (jsonSchema.exclusiveMaximum !== undefined) {
        zodSchema = zodSchema.lt(jsonSchema.exclusiveMaximum);
      }
      break;

    case 'boolean':
      zodSchema = z.boolean();
      break;

    case 'array':
      // Handle array with items
      if (jsonSchema.items) {
        const itemSchema = jsonSchemaToZod(jsonSchema.items);
        zodSchema = z.array(itemSchema);
      } else {
        zodSchema = z.array(z.any());
      }
      if (jsonSchema.minItems !== undefined) {
        zodSchema = zodSchema.min(jsonSchema.minItems);
      }
      if (jsonSchema.maxItems !== undefined) {
        zodSchema = zodSchema.max(jsonSchema.maxItems);
      }
      break;

    case 'object':
      // Handle object with properties
      if (jsonSchema.properties) {
        const shape: Record<string, z.ZodTypeAny> = {};
        const required = jsonSchema.required || [];

        for (const [key, propSchema] of Object.entries(jsonSchema.properties)) {
          let propZod = jsonSchemaToZod(propSchema);
          
          // Make optional if not in required array
          if (!required.includes(key)) {
            propZod = propZod.optional();
          }
          
          shape[key] = propZod;
        }

        zodSchema = z.object(shape);
        
        if (jsonSchema.additionalProperties === false) {
          zodSchema = zodSchema.strict();
        }
      } else {
        zodSchema = z.record(z.any());
      }
      break;

    default:
      zodSchema = z.any();
  }

  // Add description if present
  if (description && zodSchema && typeof zodSchema.describe === 'function') {
    zodSchema = zodSchema.describe(description);
  }

  // Handle default values
  if (jsonSchema.default !== undefined && zodSchema && typeof zodSchema.default === 'function') {
    zodSchema = zodSchema.default(jsonSchema.default);
  }

  return zodSchema;
}

/**
 * Convert JSON Schema properties to Zod RawShape
 * Used for tool input schemas (returns the shape object, not ZodObject)
 */
export function jsonSchemaPropertiesToZodShape(jsonSchema: any): z.ZodRawShape {
  if (!jsonSchema || jsonSchema.type !== 'object') {
    return {};
  }
  
  const shape: Record<string, z.ZodTypeAny> = {};
  const properties = jsonSchema.properties || {};
  const required = jsonSchema.required || [];

  for (const [key, propSchema] of Object.entries(properties)) {
    let propZod = jsonSchemaToZod(propSchema);
    
    // Make optional if not in required array
    if (!required.includes(key)) {
      propZod = propZod.optional();
    }
    
    shape[key] = propZod;
  }

  return shape;
}
