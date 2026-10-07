import type { LlmUsage } from './types.js';

export interface ModelPrice {
  /** US dollars per 1M input tokens. */
  inputPerM: number;
  /** US dollars per 1M output tokens (reasoning/thinking tokens bill as output). */
  outputPerM: number;
  source: string;
}

/**
 * Editable price table, standard (non-batch, non-cached) list prices in USD per 1M tokens.
 * ESTIMATE: taken from each vendor's public pricing page as last known (openai.com/api/pricing,
 * ai.google.dev/gemini-api/docs/pricing, docs.claude.com pricing), not fetched live. Check the
 * pages before quoting a cost; edit here when they change. Cached-input discounts are ignored.
 */
export const MODEL_PRICES: Record<string, ModelPrice> = {
  'gpt-5-mini': { inputPerM: 0.25, outputPerM: 2.0, source: 'openai.com/api/pricing (estimate)' },
  'gpt-5-nano': { inputPerM: 0.05, outputPerM: 0.4, source: 'openai.com/api/pricing (estimate)' },
  'gpt-5': { inputPerM: 1.25, outputPerM: 10.0, source: 'openai.com/api/pricing (estimate)' },
  'gemini-2.5-flash': { inputPerM: 0.3, outputPerM: 2.5, source: 'ai.google.dev/gemini-api/docs/pricing (estimate)' },
  'gemini-2.5-flash-lite': { inputPerM: 0.1, outputPerM: 0.4, source: 'ai.google.dev/gemini-api/docs/pricing (estimate)' },
  'claude-haiku-4-5': { inputPerM: 1.0, outputPerM: 5.0, source: 'docs.claude.com pricing (estimate)' },
  'claude-sonnet-4-5': { inputPerM: 3.0, outputPerM: 15.0, source: 'docs.claude.com pricing (estimate)' },
};

/** Price for a model id; dated snapshots ("claude-haiku-4-5-20251001", "gpt-5-mini-2025-08-07") match their base. */
export function priceFor(model: string): ModelPrice | null {
  if (MODEL_PRICES[model]) return MODEL_PRICES[model];
  const base = Object.keys(MODEL_PRICES)
    .filter((k) => model.startsWith(`${k}-`))
    .sort((a, b) => b.length - a.length)[0];
  return base ? MODEL_PRICES[base]! : null;
}

/** Cost of one call in USD, or null when the model isn't in the table. */
export function costUsd(usage: LlmUsage, model: string): number | null {
  const p = priceFor(model);
  if (!p) return null;
  return (usage.inputTokens * p.inputPerM + usage.outputTokens * p.outputPerM) / 1_000_000;
}
