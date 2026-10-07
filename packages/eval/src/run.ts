/**
 * Runs the cases through the real parser (createParser) and a provider, resolves each answer through
 * core operations against an in-memory copy of the seed with a fixed clock, and grades it.
 */
import { buildSeed, fixedClock, InMemoryStore, type Clock, type Dataset } from '@ct/core';
import {
  costUsd,
  createParser,
  createProviderFromEnv,
  FakeLlm,
  providerForModel,
  type FetchLike,
  type LlmProvider,
  type LlmResponse,
  type LlmUsage,
  type ParseContext,
} from '@ct/llm';
import { CASES, type EvalCase } from './cases.js';
import { grade, resolveOutcome, type Grade, type Outcome } from './grade.js';

/** Thu 17 Sep 2026, the seed's today. Every relative date in the cases is relative to this. */
export const EVAL_TODAY = '2026-09-17';

export const DEFAULT_MODELS = ['gpt-5-mini', 'gemini-2.5-flash', 'claude-haiku-4-5'] as const;
export const DEFAULT_CONCURRENCY = 4;
export const DEFAULT_TIMEOUT_MS = 90_000;

const KEY_VARS: Record<string, string[]> = {
  openai: ['OPENAI_API_KEY'],
  gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY'],
};

export type ProviderPlan =
  | { model: string; providerId: string; status: 'run'; provider: LlmProvider }
  | { model: string; providerId: string | null; status: 'skipped'; reason: string };

type Env = Record<string, string | undefined>;

/**
 * Which models to run: EVAL_MODELS (comma list) or the three defaults. A model whose provider key is
 * missing is skipped ("no key"). LLM_PROVIDER and LLM_BASE_URL are ignored so one bot setting can't
 * redirect every provider; other LLM_* tuning (timeouts, reasoning effort) still applies.
 */
export function planProviders(env: Env, deps: { fetch?: FetchLike } = {}): ProviderPlan[] {
  const list = env.EVAL_MODELS?.trim()
    ? env.EVAL_MODELS.split(',').map((m) => m.trim()).filter(Boolean)
    : [...DEFAULT_MODELS];
  return list.map((model): ProviderPlan => {
    const providerId = providerForModel(model);
    if (!providerId) return { model, providerId: null, status: 'skipped', reason: 'unknown model family' };
    const hasKey = (KEY_VARS[providerId] ?? []).some((k) => env[k]?.trim());
    if (!hasKey) return { model, providerId, status: 'skipped', reason: 'no key' };
    const { LLM_PROVIDER: _p, LLM_BASE_URL: _b, ...rest } = env;
    try {
      const provider = createProviderFromEnv({ ...rest, LLM_MODEL: model }, deps);
      return { model, providerId, status: 'run', provider };
    } catch (e) {
      return { model, providerId, status: 'skipped', reason: e instanceof Error ? e.message : String(e) };
    }
  });
}

export interface CaseResult {
  id: string;
  outcome: Outcome;
  grade: Grade;
  usage: LlmUsage;
  costUsd: number | null;
  latencyMs: number;
}

export interface ProviderRun {
  label: string;
  model: string;
  results: CaseResult[];
  passed: number;
  total: number;
  inputTokens: number;
  outputTokens: number;
  /** Null when the model has no price in @ct/llm MODEL_PRICES. */
  costUsd: number | null;
  medianLatencyMs: number;
}

export function parseContextFor(ds: Dataset, today: string): ParseContext {
  const live = ds.jobs.filter((j) => !j.isTemplate);
  const liveIds = new Set(live.map((j) => j.id));
  return {
    today,
    jobs: live.map((j) => j.name),
    trades: ds.trades.map((t) => t.name),
    shipments: ds.shipments.filter((s) => liveIds.has(s.jobId)).map((s) => s.name),
  };
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const t = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} timed out after ${Math.round(ms / 1000)} s`)), ms);
  });
  return Promise.race([p, t]).finally(() => clearTimeout(timer));
}

/** One case: a fresh in-memory seed store, the real parser over `provider`, core resolution, grade. */
export async function runCase(c: EvalCase, provider: LlmProvider, opts: { timeoutMs?: number; clock?: Clock } = {}): Promise<CaseResult> {
  const clock = opts.clock ?? fixedClock(EVAL_TODAY, '10:00');
  const store = new InMemoryStore(buildSeed(), { clock }); // read only: load() returns a copy; nothing is proposed
  const ds = store.load();
  const usage: LlmUsage = { inputTokens: 0, outputTokens: 0 };
  const parser = createParser(provider, {
    onResponse: (res: LlmResponse) => {
      usage.inputTokens += res.usage.inputTokens;
      usage.outputTokens += res.usage.outputTokens;
    },
  });
  const text = c.photo ? `Photo caption: ${c.text}` : c.text; // as packages/bot processPhoto sends it
  const started = performance.now();
  let outcome: Outcome;
  try {
    const result = await withTimeout(parser.parse(text, parseContextFor(ds, clock.today())), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS, 'the model');
    outcome = resolveOutcome(result, c, ds, { today: clock.today(), now: clock.now() });
  } catch (e) {
    outcome = { kind: 'error', message: e instanceof Error ? e.message : String(e) };
  }
  const latencyMs = performance.now() - started;
  return { id: c.id, outcome, grade: grade(c, outcome), usage, costUsd: costUsd(usage, provider.model), latencyMs };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Every case through one provider (per case: its own parser, so usage is counted per case). */
export async function runProvider(
  label: string,
  providerFor: (c: EvalCase) => LlmProvider,
  cases: EvalCase[] = CASES,
  opts: { concurrency?: number; timeoutMs?: number; onCase?: (r: CaseResult) => void } = {},
): Promise<ProviderRun> {
  let model = '';
  const results = await mapLimit(cases, opts.concurrency ?? DEFAULT_CONCURRENCY, async (c) => {
    const provider = providerFor(c);
    model = provider.model;
    const r = await runCase(c, provider, opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {});
    opts.onCase?.(r);
    return r;
  });
  const costs = results.map((r) => r.costUsd);
  return {
    label,
    model,
    results,
    passed: results.filter((r) => r.grade.pass).length,
    total: results.length,
    inputTokens: results.reduce((n, r) => n + r.usage.inputTokens, 0),
    outputTokens: results.reduce((n, r) => n + r.usage.outputTokens, 0),
    costUsd: costs.some((x) => x === null) ? null : costs.reduce((n: number, x) => n + (x ?? 0), 0),
    medianLatencyMs: median(results.map((r) => r.latencyMs)),
  };
}

/** --dry: a FakeLlm per case that answers with the case's own `modelCalls`. */
export function fakeProviderFor(c: EvalCase): LlmProvider {
  return new FakeLlm([
    { toolCalls: c.modelCalls.map((m) => ({ name: m.name, args: { ...m.args } })), usage: { inputTokens: 0, outputTokens: 0 } },
  ]);
}

export function runDry(cases: EvalCase[] = CASES, opts: { concurrency?: number } = {}): Promise<ProviderRun> {
  return runProvider('dry run (FakeLlm, each case\'s own modelCalls)', fakeProviderFor, cases, opts);
}
