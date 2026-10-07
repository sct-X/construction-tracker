import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  AnthropicProvider,
  GeminiProvider,
  LlmError,
  OpenAiProvider,
  costUsd,
  createParser,
  createProviderFromEnv,
  parserTools,
  priceFor,
  providerForModel,
  type FetchLike,
  type LlmRequest,
} from '../src/index.js';

interface Call {
  url: string;
  headers: Record<string, string>;
  body: any;
}

function mockFetch(...responses: Array<{ status?: number; body: unknown } | Error>): FetchLike & { calls: Call[] } {
  const calls: Call[] = [];
  let i = 0;
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
    const r = responses[Math.min(i++, responses.length - 1)]!;
    if (r instanceof Error) throw r;
    return new Response(typeof r.body === 'string' ? r.body : JSON.stringify(r.body), { status: r.status ?? 200 });
  }) as FetchLike & { calls: Call[] };
  f.calls = calls;
  return f;
}

const req: LlmRequest = {
  system: 'SYSTEM',
  messages: [
    { role: 'user', content: 'windows late' },
    { role: 'assistant', content: 'Which job?' },
    { role: 'user', content: 'Park Rd, 16 Nov' },
  ],
  tools: [
    {
      name: 'set_shipment_eta',
      description: 'Change a shipment ETA.',
      parameters: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: { shipment: { type: 'string', minLength: 1 }, eta: { type: 'string' } },
        required: ['shipment', 'eta'],
        additionalProperties: false,
      },
    },
  ],
};

describe('OpenAI provider', () => {
  it('posts a Chat Completions request and maps tool calls and usage', async () => {
    const f = mockFetch({
      body: {
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                { id: 'c1', type: 'function', function: { name: 'set_shipment_eta', arguments: '{"shipment":"windows","eta":"16 Nov"}' } },
                { id: 'c2', type: 'function', function: { name: 'confirm_job', arguments: '{not json' } },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 1200, completion_tokens: 300 },
      },
    });
    const p = new OpenAiProvider({ apiKey: 'sk-test', fetch: f });
    expect(p.model).toBe('gpt-5-mini');
    const res = await p.complete(req);
    const { url, headers, body } = f.calls[0]!;
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(headers.authorization).toBe('Bearer sk-test');
    expect(headers['content-type']).toBe('application/json');
    expect(body.model).toBe('gpt-5-mini');
    expect(body.messages).toEqual([
      { role: 'system', content: 'SYSTEM' },
      { role: 'user', content: 'windows late' },
      { role: 'assistant', content: 'Which job?' },
      { role: 'user', content: 'Park Rd, 16 Nov' },
    ]);
    expect(body.tool_choice).toBe('auto');
    expect(body.tools[0].type).toBe('function');
    expect(body.tools[0].function.name).toBe('set_shipment_eta');
    expect(body.tools[0].function.parameters.$schema).toBeUndefined();
    expect(body.tools[0].function.parameters.required).toEqual(['shipment', 'eta']);
    expect(body.max_completion_tokens).toBeGreaterThan(0);
    expect(body.temperature).toBeUndefined(); // gpt-5 models reject non-default temperature
    expect(res.toolCalls[0]).toEqual({ name: 'set_shipment_eta', args: { shipment: 'windows', eta: '16 Nov' } });
    expect(res.toolCalls[1]).toMatchObject({ name: 'confirm_job', args: {}, malformed: true, rawArgs: '{not json' });
    expect(res.text).toBeUndefined();
    expect(res.usage).toEqual({ inputTokens: 1200, outputTokens: 300 });
  });

  it('maps a text answer and sends reasoning_effort only when set', async () => {
    const f = mockFetch({ body: { choices: [{ message: { content: 'No worries.' } }], usage: { prompt_tokens: 1, completion_tokens: 2 } } });
    const res = await new OpenAiProvider({ apiKey: 'k', fetch: f, model: 'gpt-5-nano', reasoningEffort: 'minimal' }).complete(req);
    expect(res).toEqual({ toolCalls: [], text: 'No worries.', usage: { inputTokens: 1, outputTokens: 2 } });
    expect(f.calls[0]!.body.reasoning_effort).toBe('minimal');
    expect(f.calls[0]!.body.model).toBe('gpt-5-nano');
  });
});

describe('Gemini provider', () => {
  it('posts generateContent with functionDeclarations and maps functionCall parts and usage', async () => {
    const f = mockFetch({
      body: {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [
                { text: 'thinking...', thought: true },
                { functionCall: { name: 'set_shipment_eta', args: { shipment: 'windows', eta: '16 Nov' } } },
              ],
            },
          },
        ],
        usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 40, thoughtsTokenCount: 100 },
      },
    });
    const p = new GeminiProvider({ apiKey: 'g-test', fetch: f, thinkingBudget: 0 });
    expect(p.model).toBe('gemini-2.5-flash');
    const res = await p.complete(req);
    const { url, headers, body } = f.calls[0]!;
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    expect(headers['x-goog-api-key']).toBe('g-test');
    expect(url).not.toContain('g-test'); // key in a header, never the URL
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'SYSTEM' }] });
    expect(body.contents).toEqual([
      { role: 'user', parts: [{ text: 'windows late' }] },
      { role: 'model', parts: [{ text: 'Which job?' }] },
      { role: 'user', parts: [{ text: 'Park Rd, 16 Nov' }] },
    ]);
    expect(body.toolConfig).toEqual({ functionCallingConfig: { mode: 'AUTO' } });
    expect(body.tools[0].functionDeclarations[0]).toEqual({
      name: 'set_shipment_eta',
      description: 'Change a shipment ETA.',
      parameters: { type: 'object', properties: { shipment: { type: 'string' }, eta: { type: 'string' } }, required: ['shipment', 'eta'] },
    });
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(res.toolCalls).toEqual([{ name: 'set_shipment_eta', args: { shipment: 'windows', eta: '16 Nov' } }]);
    expect(res.text).toBeUndefined(); // thought parts are not the answer
    expect(res.usage).toEqual({ inputTokens: 900, outputTokens: 140 });
  });

  it('maps a text answer', async () => {
    const f = mockFetch({ body: { candidates: [{ content: { parts: [{ text: 'Righto.' }] } }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 1 } } });
    const res = await new GeminiProvider({ apiKey: 'k', fetch: f }).complete(req);
    expect(res).toEqual({ toolCalls: [], text: 'Righto.', usage: { inputTokens: 5, outputTokens: 1 } });
    expect(f.calls[0]!.body.generationConfig.thinkingConfig).toBeUndefined();
  });
});

describe('Anthropic provider', () => {
  it('posts a Messages request with the version header and maps tool_use blocks and usage', async () => {
    const f = mockFetch({
      body: {
        content: [
          { type: 'text', text: 'Updating the ETA.' },
          { type: 'tool_use', id: 't1', name: 'set_shipment_eta', input: { shipment: 'windows', eta: '16 Nov' } },
        ],
        usage: { input_tokens: 1000, output_tokens: 60, cache_read_input_tokens: 200 },
      },
    });
    const p = new AnthropicProvider({ apiKey: 'a-test', fetch: f });
    expect(p.model).toBe('claude-haiku-4-5');
    const res = await p.complete(req);
    const { url, headers, body } = f.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(headers['x-api-key']).toBe('a-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(body.model).toBe('claude-haiku-4-5');
    expect(body.max_tokens).toBeGreaterThan(0);
    expect(body.system).toBe('SYSTEM');
    expect(body.messages).toEqual(req.messages);
    expect(body.tool_choice).toEqual({ type: 'auto' });
    expect(body.tools[0].name).toBe('set_shipment_eta');
    expect(body.tools[0].input_schema.type).toBe('object');
    expect(body.tools[0].input_schema.$schema).toBeUndefined();
    expect(body.tools[0].input_schema.required).toEqual(['shipment', 'eta']);
    expect(res.toolCalls).toEqual([{ name: 'set_shipment_eta', args: { shipment: 'windows', eta: '16 Nov' } }]);
    expect(res.text).toBe('Updating the ETA.');
    expect(res.usage).toEqual({ inputTokens: 1200, outputTokens: 60 });
  });
});

describe('transport', () => {
  it('retries once on 5xx/429 and network errors, then succeeds', async () => {
    const ok = { body: { content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 1, output_tokens: 1 } } };
    const f = mockFetch({ status: 529, body: { error: 'overloaded' } }, ok);
    const res = await new AnthropicProvider({ apiKey: 'k', fetch: f, retryDelayMs: 0 }).complete(req);
    expect(res.text).toBe('ok');
    expect(f.calls).toHaveLength(2);
    const g = mockFetch(new Error('ECONNRESET'), ok);
    expect((await new AnthropicProvider({ apiKey: 'k', fetch: g, retryDelayMs: 0 }).complete(req)).text).toBe('ok');
  });

  it('throws LlmError with the status on 4xx without retrying', async () => {
    const f = mockFetch({ status: 401, body: { error: { message: 'bad key' } } });
    const err = await new OpenAiProvider({ apiKey: 'k', fetch: f, retryDelayMs: 0 }).complete(req).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect((err as LlmError).status).toBe(401);
    expect((err as LlmError).provider).toBe('openai');
    expect((err as LlmError).message).toMatch(/bad key/);
    expect(f.calls).toHaveLength(1);
  });

  it('gives up after the retries', async () => {
    const f = mockFetch({ status: 500, body: 'boom' });
    await expect(new GeminiProvider({ apiKey: 'k', fetch: f, retries: 2, retryDelayMs: 0 }).complete(req)).rejects.toThrow(/HTTP 500/);
    expect(f.calls).toHaveLength(3);
  });
});

describe('createProviderFromEnv', () => {
  it('builds each provider with its key, default model and LLM_MODEL override', () => {
    const o = createProviderFromEnv({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'k' });
    expect([o.id, o.model]).toEqual(['openai', 'gpt-5-mini']);
    const g = createProviderFromEnv({ LLM_PROVIDER: 'gemini', GOOGLE_API_KEY: 'k', LLM_MODEL: 'gemini-2.5-flash-lite' });
    expect([g.id, g.model]).toEqual(['gemini', 'gemini-2.5-flash-lite']);
    const a = createProviderFromEnv({ LLM_PROVIDER: 'Anthropic', ANTHROPIC_API_KEY: 'k', LLM_MODEL: '' });
    expect([a.id, a.model]).toEqual(['anthropic', 'claude-haiku-4-5']);
  });

  it('infers the provider from LLM_MODEL when LLM_PROVIDER is blank', () => {
    expect(createProviderFromEnv({ LLM_PROVIDER: '', LLM_MODEL: 'claude-haiku-4-5', ANTHROPIC_API_KEY: 'k' }).id).toBe('anthropic');
    expect(providerForModel('gpt-5-mini')).toBe('openai');
    expect(providerForModel('gemini-2.5-flash')).toBe('gemini');
    expect(providerForModel('llama-3')).toBeNull();
  });

  it('LLM_MODEL alone decides the provider; LLM_PROVIDER only counts when LLM_MODEL is blank or unknown', () => {
    const keys = { OPENAI_API_KEY: 'k', GEMINI_API_KEY: 'k', ANTHROPIC_API_KEY: 'k' };
    for (const [model, id] of [['gpt-5-mini', 'openai'], ['o4-mini', 'openai'], ['gemini-2.5-flash', 'gemini'], ['claude-haiku-4-5', 'anthropic']] as const) {
      // A stale LLM_PROVIDER line never overrides the model.
      const p = createProviderFromEnv({ ...keys, LLM_PROVIDER: 'openai', LLM_MODEL: model });
      expect([p.id, p.model]).toEqual([id, model]);
    }
    expect(createProviderFromEnv({ ...keys, LLM_MODEL: 'ft:my-tune', LLM_PROVIDER: 'openai' }).id).toBe('openai');
  });

  it('.env.example switches the model with one line', () => {
    const text = readFileSync(fileURLToPath(new URL('../../../.env.example', import.meta.url)), 'utf8');
    const lines = text.split('\n').map((l) => l.trim());
    expect(lines).toContain('LLM_MODEL=gpt-5-mini');
    expect(lines.filter((l) => /^LLM_PROVIDER=/.test(l))).toEqual([]);
    for (const m of ['gpt-5-mini', 'gemini-2.5-flash', 'claude-haiku-4-5']) expect(text).toContain(m);
    const env = Object.fromEntries(lines.filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
    expect(createProviderFromEnv({ ...env, OPENAI_API_KEY: 'k' }).id).toBe('openai');
    expect(createProviderFromEnv({ ...env, LLM_MODEL: 'claude-haiku-4-5', ANTHROPIC_API_KEY: 'k' }).id).toBe('anthropic');
  });

  it('refuses in plain English when the provider or key is missing', () => {
    expect(() => createProviderFromEnv({})).toThrow(/LLM_MODEL is not set/);
    expect(() => createProviderFromEnv({ LLM_MODEL: 'llama-3', OPENAI_API_KEY: 'k' })).toThrow(/isn't a known family/);
    expect(() => createProviderFromEnv({ LLM_PROVIDER: 'mistral' })).toThrow(/not supported/);
    expect(() => createProviderFromEnv({ LLM_PROVIDER: 'gemini' })).toThrow(/GEMINI_API_KEY is not set/);
    expect(() => createProviderFromEnv({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'k', LLM_MAX_TOKENS: 'lots' })).toThrow(/number/);
  });

  it('passes fetch and optional settings through', async () => {
    const f = mockFetch({ body: { choices: [{ message: { content: 'hi' } }] } });
    const p = createProviderFromEnv(
      { LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'k', LLM_BASE_URL: 'http://localhost:9/v1/', LLM_MAX_TOKENS: '500', LLM_REASONING_EFFORT: 'low' },
      { fetch: f },
    );
    await p.complete(req);
    expect(f.calls[0]!.url).toBe('http://localhost:9/v1/chat/completions');
    expect(f.calls[0]!.body.max_completion_tokens).toBe(500);
    expect(f.calls[0]!.body.reasoning_effort).toBe('low');
  });
});

describe('end to end through a provider (mocked fetch)', () => {
  it('parser + Gemini: real catalogue tools convert and a functionCall becomes ops', async () => {
    const f = mockFetch({
      body: { candidates: [{ content: { parts: [{ functionCall: { name: 'mark_step_done', args: { step: 'frame', job: 'Park Rd' } } }] } }] },
    });
    const parser = createParser(new GeminiProvider({ apiKey: 'k', fetch: f }));
    const r = await parser.parse('frame done at park rd', { today: '2026-09-17', jobs: ['Park Rd'], trades: [], shipments: [] });
    expect(r).toEqual({ kind: 'ops', calls: [{ op: 'mark_step_done', args: { step: 'frame', job: 'Park Rd' } }] });
    const decls = f.calls[0]!.body.tools[0].functionDeclarations as { name: string }[];
    expect(decls.map((d) => d.name)).toEqual(parserTools().map((t) => t.name));
  });
});

describe('pricing', () => {
  it('prices the three default models and dated snapshots', () => {
    for (const m of ['gpt-5-mini', 'gemini-2.5-flash', 'claude-haiku-4-5']) expect(priceFor(m)).not.toBeNull();
    expect(priceFor('claude-haiku-4-5-20251001')).toBe(priceFor('claude-haiku-4-5'));
    expect(priceFor('gpt-5-mini-2025-08-07')).toBe(priceFor('gpt-5-mini'));
    expect(priceFor('mystery-model')).toBeNull();
  });

  it('costUsd = tokens x $/1M', () => {
    const p = priceFor('gpt-5-mini')!;
    expect(costUsd({ inputTokens: 1_000_000, outputTokens: 0 }, 'gpt-5-mini')).toBeCloseTo(p.inputPerM);
    expect(costUsd({ inputTokens: 2000, outputTokens: 500 }, 'claude-haiku-4-5')).toBeCloseTo(
      (2000 * priceFor('claude-haiku-4-5')!.inputPerM + 500 * priceFor('claude-haiku-4-5')!.outputPerM) / 1e6,
    );
    expect(costUsd({ inputTokens: 1, outputTokens: 1 }, 'mystery-model')).toBeNull();
  });
});
