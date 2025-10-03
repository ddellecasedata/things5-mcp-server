/**
 * Fix JSON Schema arrays without items property.
 * 
 * JSON Schema requires arrays to have an 'items' property.
 * zodToJsonSchema sometimes generates arrays without it, which causes validation errors.
 * 
 * This function recursively traverses a JSON Schema and adds { type: "string" }
 * as the items property for any array that doesn't have one.
 */
export function fixArraySchemas(schema: any): any {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  // If this is an array type without items, add default items
  if (schema.type === 'array' && !schema.items) {
    schema.items = { type: 'string' };
  }

  // Recursively process properties
  if (schema.properties) {
    for (const key in schema.properties) {
      schema.properties[key] = fixArraySchemas(schema.properties[key]);
    }
  }

  // Recursively process items
  if (schema.items) {
    schema.items = fixArraySchemas(schema.items);
  }

  // Recursively process array items (if items is an array)
  if (Array.isArray(schema.items)) {
    schema.items = schema.items.map(fixArraySchemas);
  }

  // Recursively process allOf, anyOf, oneOf
  if (schema.allOf) schema.allOf = schema.allOf.map(fixArraySchemas);
  if (schema.anyOf) schema.anyOf = schema.anyOf.map(fixArraySchemas);
  if (schema.oneOf) schema.oneOf = schema.oneOf.map(fixArraySchemas);

  return schema;
}
