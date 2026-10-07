import type { LlmProvider, LlmRequest, LlmResponse, ToolDef } from '../types.js';
import { num, parseToolArgs, postJson, type ProviderOptions } from './common.js';

export const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash';
export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export interface GeminiOptions extends ProviderOptions {
  /** gemini-2.5 thinking budget in tokens (0 turns thinking off on Flash). Not sent when unset. */
  thinkingBudget?: number;
}

/**
 * Keywords Gemini's function-declaration Schema (an OpenAPI 3.0 subset) accepts. Everything else
 * ($schema, additionalProperties, minLength, maxLength, pattern, const, default, $ref, oneOf, allOf,
 * not, examples...) is stripped.
 */
const GEMINI_KEYWORDS = new Set([
  'type', 'format', 'description', 'nullable', 'enum', 'properties', 'required', 'items',
  'minItems', 'maxItems', 'minimum', 'maximum', 'anyOf', 'title',
]);
const GEMINI_FORMATS: Record<string, Set<string>> = {
  string: new Set(['enum', 'date-time']),
  number: new Set(['float', 'double']),
  integer: new Set(['int32', 'int64']),
};

/** Convert a JSON schema to the Gemini Schema subset (recursively). */
export function toGeminiSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return {};
  const src = schema as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  // type: ["string", "null"] -> type string + nullable
  let type = src.type;
  if (Array.isArray(type)) {
    const nonNull = type.filter((t) => t !== 'null');
    if (nonNull.length !== type.length) out.nullable = true;
    type = nonNull.length === 1 ? nonNull[0] : undefined;
    if (nonNull.length > 1) out.anyOf = nonNull.map((t) => ({ type: t }));
  }
  if (type === 'null') {
    out.nullable = true;
    type = undefined;
  }
  // const -> one-value enum
  let en = src.enum;
  if (src.const !== undefined && en === undefined) en = [src.const];

  for (const [key, value] of Object.entries(src)) {
    if (!GEMINI_KEYWORDS.has(key)) continue;
    switch (key) {
      case 'type':
        if (typeof type === 'string') out.type = type;
        break;
      case 'format':
        if (typeof type === 'string' && typeof value === 'string' && GEMINI_FORMATS[type]?.has(value)) out.format = value;
        break;
      case 'properties': {
        const props: Record<string, unknown> = {};
        for (const [k, v] of Object.entries((value as Record<string, unknown>) ?? {})) props[k] = toGeminiSchema(v);
        if (Object.keys(props).length) out.properties = props;
        break;
      }
      case 'items':
        out.items = toGeminiSchema(value);
        break;
      case 'anyOf':
        if (Array.isArray(value)) {
          const variants = value.filter((v) => !(v && typeof v === 'object' && (v as Record<string, unknown>).type === 'null'));
          if (variants.length !== value.length) out.nullable = true;
          if (variants.length === 1) Object.assign(out, toGeminiSchema(variants[0]));
          else if (variants.length > 1) out.anyOf = variants.map(toGeminiSchema);
        }
        break;
      case 'enum':
        break; // below
      default:
        out[key] = value;
    }
  }
  if (Array.isArray(en)) {
    const values = en.filter((v) => v !== null).map(String); // Gemini enums are strings
    if (values.length) {
      out.enum = values;
      out.type = 'string';
      delete out.format;
    }
  }
  // required may only name kept properties
  if (Array.isArray(out.required)) {
    const keys = new Set(Object.keys((out.properties as Record<string, unknown>) ?? {}));
    const req = (out.required as unknown[]).filter((k): k is string => typeof k === 'string' && keys.has(k));
    if (req.length) out.required = req;
    else delete out.required;
  }
  return out;
}

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

/** ToolDef -> functionDeclaration. A tool with no properties gets no `parameters` (Gemini rejects empty objects). */
export function toGeminiFunction(t: ToolDef): GeminiFunctionDeclaration {
  const parameters = toGeminiSchema(t.parameters);
  return parameters.properties
    ? { name: t.name, description: t.description, parameters }
    : { name: t.name, description: t.description };
}

/** The generateContent request body for an LlmRequest. Exported for tests. */
export function geminiBody(req: LlmRequest, opts: Pick<GeminiOptions, 'maxTokens' | 'thinkingBudget'> = {}): Record<string, unknown> {
  return {
    systemInstruction: { parts: [{ text: req.system }] },
    contents: req.messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    ...(req.tools.length
      ? {
          tools: [{ functionDeclarations: req.tools.map(toGeminiFunction) }],
          toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
        }
      : {}),
    generationConfig: {
      // Thinking tokens count against this on 2.5 models.
      maxOutputTokens: opts.maxTokens ?? 4096,
      ...(opts.thinkingBudget !== undefined ? { thinkingConfig: { thinkingBudget: opts.thinkingBudget } } : {}),
    },
  };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean; functionCall?: { name?: string; args?: unknown } }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
}

export function fromGeminiResponse(body: unknown): LlmResponse {
  const r = body as GeminiResponse;
  const parts = r.candidates?.[0]?.content?.parts ?? [];
  const toolCalls = parts.filter((p) => p.functionCall?.name).map((p) => parseToolArgs(p.functionCall!.name!, p.functionCall!.args));
  const text = parts
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text!)
    .join('')
    .trim();
  const u = r.usageMetadata ?? {};
  return {
    toolCalls,
    ...(text ? { text } : {}),
    // Thinking tokens bill as output.
    usage: { inputTokens: num(u.promptTokenCount), outputTokens: num(u.candidatesTokenCount) + num(u.thoughtsTokenCount) },
  };
}

/** Gemini generateContent with functionDeclarations over plain fetch. */
export class GeminiProvider implements LlmProvider {
  readonly id = 'gemini';
  readonly model: string;
  constructor(private readonly opts: GeminiOptions) {
    this.model = opts.model || GEMINI_DEFAULT_MODEL;
  }

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const base = (this.opts.baseUrl ?? GEMINI_BASE_URL).replace(/\/+$/, '');
    const url = `${base}/models/${encodeURIComponent(this.model)}:generateContent`;
    const body = await postJson(this.id, url, { 'x-goog-api-key': this.opts.apiKey }, geminiBody(req, this.opts), this.opts);
    return fromGeminiResponse(body);
  }
}
