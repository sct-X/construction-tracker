/** Plain-text report: one block per provider, then a summary table. */
import type { ProviderPlan, ProviderRun } from './run.js';

const fmtInt = (n: number) => n.toLocaleString('en-AU');

export function fmtUsd(x: number | null): string {
  if (x === null) return 'n/a (no price)';
  return `$${x < 0.01 ? x.toFixed(4) : x.toFixed(3)}`;
}

function fmtSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

function clip(s: string, n = 140): string {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

export function providerBlock(run: ProviderRun): string {
  const pct = run.total ? Math.round((run.passed / run.total) * 100) : 0;
  const lines = [
    `${run.label}`,
    `  pass ${run.passed}/${run.total} (${pct}%)`,
    `  tokens ${fmtInt(run.inputTokens + run.outputTokens)} (${fmtInt(run.inputTokens)} in, ${fmtInt(run.outputTokens)} out)`,
    `  cost ${fmtUsd(run.costUsd)} (estimate from @ct/llm MODEL_PRICES)`,
    `  median latency ${fmtSeconds(run.medianLatencyMs)}`,
  ];
  const failed = run.results.filter((r) => !r.grade.pass);
  if (failed.length) {
    lines.push('  failed:');
    const w = Math.max(...failed.map((r) => r.id.length));
    for (const r of failed) lines.push(`    ${pad(r.id, w)}  ${clip(r.grade.reason)}`);
  }
  return lines.join('\n');
}

export function summaryTable(plans: ProviderPlan[], runs: Map<string, ProviderRun>): string {
  const head = ['model', 'provider', 'pass', 'tokens', 'cost (est.)', 'median latency'];
  const rows: { cells: string[]; skipped: boolean }[] = plans.map((p) => {
    const run = runs.get(p.model);
    if (p.status === 'skipped' || !run) {
      return { cells: [p.model, p.providerId ?? '?', p.status === 'skipped' ? `skipped (${p.reason})` : 'not run'], skipped: true };
    }
    return {
      cells: [p.model, p.providerId, `${run.passed}/${run.total}`, fmtInt(run.inputTokens + run.outputTokens), fmtUsd(run.costUsd), fmtSeconds(run.medianLatencyMs)],
      skipped: false,
    };
  });
  const widths = head.map((h, i) =>
    Math.max(h.length, ...rows.filter((r) => !r.skipped || i < 2).map((r) => r.cells[i]?.length ?? 0)),
  );
  const line = (cells: string[]) => cells.map((c, i) => (i === cells.length - 1 ? c : pad(c, widths[i]!))).join('  ');
  return [line(head), ...rows.map((r) => line(r.cells))].join('\n');
}
