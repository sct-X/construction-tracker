/**
 * Stage 6 review: the weekly holding cost left the web. The bot sets it with set_holding_cost (a daily op,
 * so it is in the LLM tool catalogue); a job made from a template takes the template's cost, or none.
 */
import { describe, expect, it } from 'vitest';
import { applyChanges, buildSeed, DEFAULT_TODAY, operationCatalogue, runOperation, type Dataset } from '../src/index.js';

const ctx = { today: DEFAULT_TODAY, now: new Date('2026-09-17T00:00:00Z') };

function apply(ds: Dataset, op: string, args: unknown): Dataset {
  const r = runOperation(ds, op, args, ctx);
  if (r.kind !== 'proposal') throw new Error(r.kind === 'refusal' ? r.reason : r.question);
  return applyChanges(ds, r.changes);
}

describe('set_holding_cost', () => {
  const ds = buildSeed();

  it('is a daily op offered to the bot', () => {
    expect(operationCatalogue('daily').map((o) => o.name)).toContain('set_holding_cost');
  });

  it('says before and after in the summary, and 0 removes it', () => {
    const r = runOperation(ds, 'set_holding_cost', { job: 'Park Rd', dollars: 3800 }, ctx);
    expect(r.kind === 'proposal' && r.summary).toBe('Park Rd holding cost $3,800 a week (was $4,500)');
    const off = runOperation(ds, 'set_holding_cost', { job: 'Park Rd', dollars: 0 }, ctx);
    expect(off.kind === 'proposal' && off.summary).toBe('Park Rd holding cost removed (was $4,500)');
    expect(apply(ds, 'set_holding_cost', { job: 'Park Rd', dollars: 0 }).jobs.find((j) => j.id === 'park-rd')!.weeklyHoldingCost).toBeNull();
  });

  it('refuses a design job, a template and no change', () => {
    expect(runOperation(ds, 'set_holding_cost', { job: 'West St', dollars: 100 }, ctx)).toMatchObject({ kind: 'refusal' });
    expect(runOperation(ds, 'set_holding_cost', { job: 'Park Rd', dollars: 4500 }, ctx)).toMatchObject({ kind: 'refusal', reason: "Park Rd's holding cost is already $4,500 a week." });
  });

  it('a new job takes the template weekly holding cost, or none', () => {
    const none = apply(ds, 'copy_template', { template: 'Duplex', name: 'Smith St', startDate: '2026-09-21' });
    expect(none.jobs.find((j) => j.name === 'Smith St')!.weeklyHoldingCost).toBeNull();
    const priced = { ...ds, jobs: ds.jobs.map((j) => (j.id === 'tpl-duplex' ? { ...j, weeklyHoldingCost: 3000 } : j)) };
    const made = apply(priced, 'copy_template', { template: 'Duplex', name: 'Smith St', startDate: '2026-09-21' });
    expect(made.jobs.find((j) => j.name === 'Smith St')!.weeklyHoldingCost).toBe(3000);
  });
});
