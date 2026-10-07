import { describe, expect, it } from 'vitest';
import { parserTools, toGeminiFunction, toGeminiSchema } from '../src/index.js';

const ALLOWED = new Set([
  'type', 'format', 'description', 'nullable', 'enum', 'properties', 'required', 'items',
  'minItems', 'maxItems', 'minimum', 'maximum', 'anyOf', 'title',
]);

/** Every schema-keyword position in a converted schema (property names are not keywords). */
function keywords(schema: unknown, out: string[] = []): string[] {
  if (!schema || typeof schema !== 'object') return out;
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    out.push(k);
    if (k === 'properties') for (const p of Object.values(v as object)) keywords(p, out);
    else if (k === 'items') keywords(v, out);
    else if (k === 'anyOf') for (const p of v as unknown[]) keywords(p, out);
  }
  return out;
}

describe('toGeminiSchema', () => {
  it('converts every parser tool to the supported subset', () => {
    for (const t of parserTools()) {
      const fn = toGeminiFunction(t);
      expect(fn.name).toBe(t.name);
      for (const k of keywords(fn.parameters)) expect(ALLOWED, `${t.name}: ${k}`).toContain(k);
    }
  });

  it('keeps types, descriptions, enums, min/max and required; strips the rest', () => {
    const add = toGeminiFunction(parserTools().find((t) => t.name === 'add_item')!).parameters!;
    const props = add.properties as Record<string, Record<string, unknown>>;
    expect(add.type).toBe('object');
    expect(add.required).toEqual(['job', 'type', 'title']);
    expect(add.additionalProperties).toBeUndefined();
    expect(add.$schema).toBeUndefined();
    expect(props.type!.enum).toContain('condition_of_consent');
    expect(props.title).toEqual({ type: 'string' }); // minLength/maxLength stripped
    expect(props.leadTimeWeeks).toEqual({ type: 'number', minimum: 0, maximum: 104 });
    expect(props.job!.description).toMatch(/Fuzzy-matched/);
  });

  it('handles nullable types, const, anyOf with null, nested items, formats and dangling required', () => {
    const out = toGeminiSchema({
      $schema: 'x',
      type: 'object',
      additionalProperties: false,
      properties: {
        a: { type: ['string', 'null'], pattern: '^x', format: 'email' },
        b: { const: 'fixed' },
        c: { anyOf: [{ type: 'number', exclusiveMinimum: 0 }, { type: 'null' }] },
        d: { type: 'array', items: { type: 'object', properties: { e: { type: 'integer', format: 'int64', default: 1 } } }, minItems: 1 },
        f: { type: 'string', format: 'date-time' },
        g: { type: 'integer', enum: [1, 2] },
      },
      required: ['a', 'missing'],
    });
    expect(out).toEqual({
      type: 'object',
      properties: {
        a: { type: 'string', nullable: true },
        b: { type: 'string', enum: ['fixed'] },
        c: { type: 'number', nullable: true },
        d: { type: 'array', items: { type: 'object', properties: { e: { type: 'integer', format: 'int64' } } }, minItems: 1 },
        f: { type: 'string', format: 'date-time' },
        g: { type: 'string', enum: ['1', '2'] },
      },
      required: ['a'],
    });
  });

  it('omits parameters for a tool with no properties (Gemini rejects empty objects)', () => {
    expect(toGeminiFunction({ name: 'ping', description: 'Ping.', parameters: { type: 'object', properties: {} } })).toEqual({
      name: 'ping',
      description: 'Ping.',
    });
  });
});
