import type { LlmProvider, LlmRequest, LlmResponse, ToolDef } from '../types.js';
import { num, parseToolArgs, postJson, withoutSchemaKey, type ProviderOptions } from './common.js';

export const ANTHROPIC_DEFAULT_MODEL = 'claude-haiku-4-5';
export const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';
export const ANTHROPIC_VERSION = '2023-06-01';

/** ToolDef -> Messages API tool. input_schema must be an object schema. */
export function toAnthropicTool(t: ToolDef): { name: string; description: string; input_schema: Record<string, unknown> } {
  const schema = withoutSchemaKey(t.parameters);
  return { name: t.name, description: t.description, input_schema: { ...schema, type: 'object' } };
}

/** The Messages API request body for an LlmRequest. Exported for tests. */
export function anthropicBody(req: LlmRequest, model: string, opts: Pick<ProviderOptions, 'maxTokens'> = {}): Record<string, unknown> {
  return {
    model,
    max_tokens: opts.maxTokens ?? 1024,
    system: req.system,
    messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    ...(req.tools.length ? { tools: req.tools.map(toAnthropicTool), tool_choice: { type: 'auto' } } : {}),
  };
}

interface AnthropicResponse {
  content?: { type?: string; text?: string; name?: string; input?: unknown }[];
  usage?: { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number };
}

export function fromAnthropicResponse(body: unknown): LlmResponse {
  const r = body as AnthropicResponse;
  const blocks = r.content ?? [];
  const toolCalls = blocks.filter((b) => b.type === 'tool_use' && b.name).map((b) => parseToolArgs(b.name!, b.input));
  const text = blocks
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text!)
    .join('\n')
    .trim();
  const u = r.usage ?? {};
  return {
    toolCalls,
    ...(text ? { text } : {}),
    usage: {
      inputTokens: num(u.input_tokens) + num(u.cache_creation_input_tokens) + num(u.cache_read_input_tokens),
      outputTokens: num(u.output_tokens),
    },
  };
}

/** Anthropic Messages API over plain fetch. */
export class AnthropicProvider implements LlmProvider {
  readonly id = 'anthropic';
  readonly model: string;
  constructor(private readonly opts: ProviderOptions) {
    this.model = opts.model || ANTHROPIC_DEFAULT_MODEL;
  }

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const base = (this.opts.baseUrl ?? ANTHROPIC_BASE_URL).replace(/\/+$/, '');
    const headers = { 'x-api-key': this.opts.apiKey, 'anthropic-version': ANTHROPIC_VERSION };
    const body = await postJson(this.id, `${base}/messages`, headers, anthropicBody(req, this.model, this.opts), this.opts);
    return fromAnthropicResponse(body);
  }
}
