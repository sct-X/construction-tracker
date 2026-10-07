import type { LlmProvider, LlmRequest, LlmResponse, ToolDef } from '../types.js';
import { num, parseToolArgs, postJson, withoutSchemaKey, type ProviderOptions } from './common.js';

export const OPENAI_DEFAULT_MODEL = 'gpt-5-mini';
export const OPENAI_BASE_URL = 'https://api.openai.com/v1';

export interface OpenAiOptions extends ProviderOptions {
  /** gpt-5 family only: 'minimal' | 'low' | 'medium' | 'high'. Not sent when unset (API default). */
  reasoningEffort?: string;
}

/** ToolDef -> Chat Completions function tool (not strict: optional args stay optional). */
export function toOpenAiTool(t: ToolDef): { type: 'function'; function: { name: string; description: string; parameters: object } } {
  return { type: 'function', function: { name: t.name, description: t.description, parameters: withoutSchemaKey(t.parameters) } };
}

/** The Chat Completions request body for an LlmRequest. Exported for tests. */
export function openAiBody(req: LlmRequest, model: string, opts: Pick<OpenAiOptions, 'maxTokens' | 'reasoningEffort'> = {}): Record<string, unknown> {
  return {
    model,
    messages: [{ role: 'system', content: req.system }, ...req.messages.map((m) => ({ role: m.role, content: m.content }))],
    ...(req.tools.length ? { tools: req.tools.map(toOpenAiTool), tool_choice: 'auto' } : {}),
    // Reasoning models spend part of this on hidden reasoning, so it is generous.
    max_completion_tokens: opts.maxTokens ?? 4096,
    ...(opts.reasoningEffort ? { reasoning_effort: opts.reasoningEffort } : {}),
  };
}

interface OpenAiChatResponse {
  choices?: { message?: { content?: string | null; tool_calls?: { type?: string; function?: { name?: string; arguments?: string } }[] } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export function fromOpenAiResponse(body: unknown): LlmResponse {
  const r = body as OpenAiChatResponse;
  const msg = r.choices?.[0]?.message ?? {};
  const toolCalls = (msg.tool_calls ?? [])
    .filter((c) => c.function?.name)
    .map((c) => parseToolArgs(c.function!.name!, c.function!.arguments));
  const text = typeof msg.content === 'string' && msg.content.trim() ? msg.content : undefined;
  return {
    toolCalls,
    ...(text !== undefined ? { text } : {}),
    usage: { inputTokens: num(r.usage?.prompt_tokens), outputTokens: num(r.usage?.completion_tokens) },
  };
}

/** OpenAI Chat Completions over plain fetch. */
export class OpenAiProvider implements LlmProvider {
  readonly id = 'openai';
  readonly model: string;
  constructor(private readonly opts: OpenAiOptions) {
    this.model = opts.model || OPENAI_DEFAULT_MODEL;
  }

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const base = (this.opts.baseUrl ?? OPENAI_BASE_URL).replace(/\/+$/, '');
    const body = await postJson(this.id, `${base}/chat/completions`, { authorization: `Bearer ${this.opts.apiKey}` }, openAiBody(req, this.model, this.opts), this.opts);
    return fromOpenAiResponse(body);
  }
}
