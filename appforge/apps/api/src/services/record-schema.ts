import { z } from 'zod';
import type { EntityDef, EntityFieldDef } from '@appforge/shared';

/**
 * Builds a zod validator for record data from an entity definition. This is
 * the server-side authority for dynamic record validation — the runtime form
 * mirrors these rules for UX, but nothing is persisted without passing here.
 * Unknown keys are stripped (mass-assignment protection).
 */
export function buildRecordSchema(entity: EntityDef, mode: 'create' | 'update'): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of entity.fields) {
    if (field.readOnly) continue;
    let schema = fieldSchema(field);
    if (mode === 'update' || !field.required) schema = schema.optional().nullable();
    shape[field.key] = schema;
  }
  return z.object(shape).strip();
}

function fieldSchema(field: EntityFieldDef): z.ZodTypeAny {
  switch (field.type) {
    case 'number':
    case 'decimal':
    case 'currency':
    case 'percentage': {
      let n = z.coerce.number();
      if (field.min !== undefined) n = n.min(field.min);
      if (field.max !== undefined) n = n.max(field.max);
      return n;
    }
    case 'boolean':
      return z.coerce.boolean();
    case 'email':
      return z.string().email().max(255);
    case 'url':
      return z.string().url().max(2000);
    case 'select':
    case 'status':
    case 'multi_select': {
      const values = (field.options ?? []).map((o) => o.value);
      if (values.length === 0) return z.string().max(200);
      if (field.type === 'multi_select') return z.array(z.enum(values as [string, ...string[]]));
      return z.enum(values as [string, ...string[]]);
    }
    case 'date':
    case 'datetime':
    case 'time':
      return z.string().max(64);
    case 'json':
      return z.record(z.unknown());
    case 'relation':
    case 'user':
    case 'file':
    case 'image':
      return z.string().max(128); // stored as a referenced id
    default: {
      let s = z.string();
      if (field.minLength !== undefined) s = s.min(field.minLength);
      s = s.max(field.maxLength ?? (field.type === 'long_text' || field.type === 'rich_text' ? 20_000 : 500));
      if (field.pattern) {
        try {
          s = s.regex(new RegExp(field.pattern));
        } catch {
          // invalid stored pattern — skip rather than crash validation
        }
      }
      return s;
    }
  }
}

/** Applies entity defaults to a validated create payload. */
export function applyDefaults(entity: EntityDef, data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data };
  for (const field of entity.fields) {
    if (out[field.key] === undefined && field.defaultValue !== undefined && field.defaultValue !== null) {
      out[field.key] = field.defaultValue;
    }
  }
  return out;
}
