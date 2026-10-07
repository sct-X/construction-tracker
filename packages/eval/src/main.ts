/**
 * npm run eval [-- --dry] [-- --only id,id] [-- --verbose]
 * Real providers: every model whose key is in the environment (or .env at the repo root).
 * --dry: a FakeLlm answers each case with its own modelCalls (no keys, no network); exits 1 unless all pass.
 */
import { fileURLToPath } from 'node:url';
import { CASES } from './cases.js';
import { providerBlock, summaryTable } from './report.js';
import { DEFAULT_CONCURRENCY, DEFAULT_TIMEOUT_MS, planProviders, runDry, runProvider, type CaseResult, type ProviderRun } from './run.js';

function loadRootEnv(): void {
  const path = fileURLToPath(new URL('../../../.env', import.meta.url));
  try {
    process.loadEnvFile(path); // variables already set in the shell win
  } catch {
    // no .env: keys come from the environment only
  }
}

function flagValue(argv: string[], name: string): string | undefined {
  const i = argv.findIndex((a) => a === name || a.startsWith(`${name}=`));
  if (i < 0) return undefined;
  const a = argv[i]!;
  return a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[i + 1];
}

function verboseLine(r: CaseResult): string {
  const o = r.outcome;
  const what =
    o.kind === 'ops'
      ? o.ops.map((x) => `${x.op} ${JSON.stringify(x.args)}`).join(' + ') || 'nothing'
      : o.kind === 'question'
        ? `question (${o.by}): ${o.text}`
        : o.kind === 'read'
          ? `read ${o.tool} ${JSON.stringify(o.args)}`
          : o.kind === 'refusal'
            ? `refused ${o.op}: ${o.reason}`
            : `${o.kind}: ${'text' in o ? o.text : o.message}`;
  return `    ${r.grade.pass ? 'ok  ' : 'FAIL'} ${r.id}: ${what}`;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const dry = argv.includes('--dry');
  const verbose = argv.includes('--verbose') || argv.includes('-v');
  const only = flagValue(argv, '--only')?.split(',').map((s) => s.trim()).filter(Boolean);
  const cases = only?.length ? CASES.filter((c) => only.includes(c.id)) : CASES;
  if (only?.length && cases.length !== only.length) {
    const known = new Set(CASES.map((c) => c.id));
    console.error(`Unknown case id(s): ${only.filter((id) => !known.has(id)).join(', ')}`);
    return 1;
  }
  const concurrency = Number(process.env.EVAL_CONCURRENCY) || DEFAULT_CONCURRENCY;
  const timeoutMs = Number(process.env.EVAL_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const onCase = verbose ? (r: CaseResult) => console.log(verboseLine(r)) : undefined;

  console.log(`Construction Tracker parser eval: ${cases.length} cases, today fixed at Thu 17 Sep 2026, seed data, nothing written.`);

  if (dry) {
    const run = await runDry(cases, { concurrency });
    if (verbose) run.results.forEach((r) => console.log(verboseLine(r)));
    console.log(`\n${providerBlock(run)}`);
    return run.passed === run.total ? 0 : 1;
  }

  loadRootEnv();
  const plans = planProviders(process.env);
  const runs = new Map<string, ProviderRun>();
  for (const p of plans) {
    if (p.status !== 'run') continue;
    console.log(`\nRunning ${p.model} (${p.providerId}), ${concurrency} at a time, ${Math.round(timeoutMs / 1000)} s per case...`);
    const provider = p.provider;
    const run = await runProvider(`${p.model} (${p.providerId})`, () => provider, cases, { concurrency, timeoutMs, ...(onCase ? { onCase } : {}) });
    runs.set(p.model, run);
    console.log(`\n${providerBlock(run)}`);
  }
  console.log(`\n${summaryTable(plans, runs)}`);
  if (!runs.size) console.log('\nNo provider keys found (OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY), so nothing ran. Try `npm run eval -- --dry`.');
  console.log('\nCosts are estimates from the price table in packages/llm/src/pricing.ts, not billed amounts.');
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (e) => {
    console.error(e);
    process.exitCode = 1;
  },
);
