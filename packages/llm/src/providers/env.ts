import type { LlmProvider } from '../types.js';
import { AnthropicProvider } from './anthropic.js';
import type { FetchLike } from './common.js';
import { GeminiProvider } from './gemini.js';
import { OpenAiProvider } from './openai.js';

export const LLM_PROVIDERS = ['openai', 'gemini', 'anthropic'] as const;
export type LlmProviderId = (typeof LLM_PROVIDERS)[number];

const KEY_VARS: Record<LlmProviderId, string[]> = {
  openai: ['OPENAI_API_KEY'],
  gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY'],
};

/** Guess the provider from a model id: gpt-/o1-/o3-/o4- -> openai, gemini- -> gemini, claude- -> anthropic. */
export function providerForModel(model: string): LlmProviderId | null {
  if (/^(gpt-|o\d)/i.test(model)) return 'openai';
  if (/^gemini-/i.test(model)) return 'gemini';
  if (/^claude-/i.test(model)) return 'anthropic';
  return null;
}

function blank(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

function optionalNumber(env: Record<string, string | undefined>, name: string): number | undefined {
  const v = blank(env[name]);
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number, got "${v}"`);
  return n;
}

/**
 * Build the configured provider. Env:
 * - LLM_PROVIDER: openai | gemini | anthropic (optional when LLM_MODEL names a known family)
 * - LLM_MODEL: model id (default per provider: gpt-5-mini, gemini-2.5-flash, claude-haiku-4-5)
 * - OPENAI_API_KEY | GEMINI_API_KEY (or GOOGLE_API_KEY) | ANTHROPIC_API_KEY
 * - optional: LLM_BASE_URL, LLM_MAX_TOKENS, LLM_TIMEOUT_MS, LLM_REASONING_EFFORT (openai), LLM_THINKING_BUDGET (gemini)
 * Throws a plain-English Error when the provider is unknown or its key is missing.
 */
export function createProviderFromEnv(env: Record<string, string | undefined>, deps: { fetch?: FetchLike } = {}): LlmProvider {
  const model = blank(env.LLM_MODEL);
  const named = blank(env.LLM_PROVIDER)?.toLowerCase();
  const id = (named ?? (model ? providerForModel(model) : null) ?? undefined) as string | undefined;
  if (!id) throw new Error('LLM_PROVIDER is not set. Use openai, gemini or anthropic.');
  if (!(LLM_PROVIDERS as readonly string[]).includes(id)) {
    throw new Error(`LLM_PROVIDER "${id}" is not supported. Use openai, gemini or anthropic.`);
  }
  const pid = id as LlmProviderId;
  const keyVar = KEY_VARS[pid].find((k) => blank(env[k]));
  if (!keyVar) throw new Error(`${KEY_VARS[pid][0]} is not set (needed for LLM_PROVIDER=${pid}).`);
  const common = {
    apiKey: blank(env[keyVar])!,
    ...(model ? { model } : {}),
    ...(blank(env.LLM_BASE_URL) ? { baseUrl: blank(env.LLM_BASE_URL)! } : {}),
    ...(optionalNumber(env, 'LLM_MAX_TOKENS') !== undefined ? { maxTokens: optionalNumber(env, 'LLM_MAX_TOKENS')! } : {}),
    ...(optionalNumber(env, 'LLM_TIMEOUT_MS') !== undefined ? { timeoutMs: optionalNumber(env, 'LLM_TIMEOUT_MS')! } : {}),
    ...(deps.fetch ? { fetch: deps.fetch } : {}),
  };
  switch (pid) {
    case 'openai': {
      const effort = blank(env.LLM_REASONING_EFFORT);
      return new OpenAiProvider({ ...common, ...(effort ? { reasoningEffort: effort } : {}) });
    }
    case 'gemini': {
      const budget = optionalNumber(env, 'LLM_THINKING_BUDGET');
      return new GeminiProvider({ ...common, ...(budget !== undefined ? { thinkingBudget: budget } : {}) });
    }
    case 'anthropic':
      return new AnthropicProvider(common);
  }
}
