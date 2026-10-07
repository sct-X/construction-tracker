import { LlmError, type ChatMsg, type LlmToolCall } from '../types.js';

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface ProviderOptions {
  apiKey: string;
  /** Defaults per provider (gpt-5-mini, gemini-2.5-flash, claude-haiku-4-5). */
  model?: string;
  /** Injected for tests; defaults to global fetch. */
  fetch?: FetchLike;
  /** Override the API base URL (proxies, tests). */
  baseUrl?: string;
  /** Output token cap. Default 1024 (reasoning models get more, see each provider). */
  maxTokens?: number;
  /** Per-request timeout. Default 30 s. */
  timeoutMs?: number;
  /** Extra attempts on 429, 5xx or a network error. Default 1. */
  retries?: number;
  /** Delay before a retry. Default 800 ms. */
  retryDelayMs?: number;
}

/** Glue messages into the alternating user/assistant shape every provider accepts. */
export function normalizeMessages(messages: ChatMsg[]): ChatMsg[] {
  const out: ChatMsg[] = [];
  for (const m of messages) {
    const content = m.content.trim();
    if (!content) continue;
    if (out.length === 0 && m.role !== 'user') continue; // must start with the user
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content = `${last.content}\n${content}`;
    else out.push({ role: m.role, content });
  }
  return out;
}

/** Parse a model's JSON argument string. Anything but a JSON object -> malformed. */
export function parseToolArgs(name: string, raw: unknown): LlmToolCall {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return { name, args: raw as Record<string, unknown> };
  if (raw === undefined || raw === null || raw === '') return { name, args: {} };
  if (typeof raw === 'string') {
    try {
      const v: unknown = JSON.parse(raw);
      if (v && typeof v === 'object' && !Array.isArray(v)) return { name, args: v as Record<string, unknown> };
    } catch {
      // fall through
    }
    return { name, args: {}, malformed: true, rawArgs: raw };
  }
  return { name, args: {}, malformed: true, rawArgs: String(raw) };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function retryable(status: number): boolean {
  return status === 429 || status >= 500;
}

/** POST JSON with a timeout and a small retry; returns the parsed body or throws LlmError. */
export async function postJson(
  provider: string,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  opts: Pick<ProviderOptions, 'fetch' | 'timeoutMs' | 'retries' | 'retryDelayMs'>,
): Promise<unknown> {
  const doFetch: FetchLike = opts.fetch ?? ((u, i) => fetch(u, i));
  const attempts = 1 + Math.max(0, opts.retries ?? 1);
  let lastError: LlmError | null = null;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(opts.retryDelayMs ?? 800);
    let res: Response;
    try {
      res = await doFetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
      });
    } catch (e) {
      lastError = new LlmError(`${provider}: request failed: ${(e as Error).message}`, provider);
      continue;
    }
    const text = await res.text();
    if (!res.ok) {
      lastError = new LlmError(`${provider}: HTTP ${res.status}: ${text.slice(0, 500)}`, provider, res.status);
      if (retryable(res.status)) continue;
      throw lastError;
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new LlmError(`${provider}: response was not JSON: ${text.slice(0, 200)}`, provider, res.status);
    }
  }
  throw lastError ?? new LlmError(`${provider}: request failed`, provider);
}

export function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** Remove the JSON-schema `$schema` key at the top (providers reject or ignore it). */
export function withoutSchemaKey(parameters: object): Record<string, unknown> {
  const { $schema: _s, ...rest } = parameters as Record<string, unknown>;
  return rest;
}
