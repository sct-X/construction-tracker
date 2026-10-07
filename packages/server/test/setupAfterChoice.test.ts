// The add_step fix in packages/core/src/operations/setup.ts: when an entry in
// `after` is ambiguous, the question's field is "afterChoice" (a known arg), so
// re-running with { ...args, afterChoice: id } works instead of being refused.
import { describe, expect, it } from 'vitest';
import { buildSeed, DEFAULT_TODAY, PARK_RD, runOperation, type Proposal, type Question } from '@ct/core';

const ctx = { today: DEFAULT_TODAY, now: new Date('2026-09-17T00:00:00.000Z') };
const base = { job: PARK_RD, stage: 'pr-st-handover', name: 'Defects walk', durationDays: 2 };
const linksOf = (p: Proposal) =>
  p.changes.filter((c) => c.kind === 'insert' && c.table === 'step_link').map((c) => (c.kind === 'insert' ? c.row.waitsForStepId : null));

describe('add_step: "which step should it come after?"', () => {
  it('asks with field afterChoice, and the re-run with the answer is a proposal', () => {
    const ds = buildSeed();
    const q = runOperation(ds, 'add_step', { ...base, after: ['Roof cover', 'inspection'] }, ctx) as Question;
    expect(q.kind).toBe('question');
    expect(q.field).toBe('afterChoice');
    expect(q.options!.map((o) => o.value)).toContain('pr-final-insp');
    const p = runOperation(ds, 'add_step', { ...q.args, [q.field!]: 'pr-final-insp' }, ctx) as Proposal;
    expect(p.kind).toBe('proposal');
    expect(linksOf(p)).toEqual(['pr-roof-cover', 'pr-final-insp']);
  });

  it('two ambiguous entries: two questions in turn, the first answer kept in the args', () => {
    const ds = buildSeed();
    const q1 = runOperation(ds, 'add_step', { ...base, after: ['inspection', 'plumbing'] }, ctx) as Question;
    expect(q1.field).toBe('afterChoice');
    const q2 = runOperation(ds, 'add_step', { ...q1.args, afterChoice: 'pr-frame-insp' }, ctx) as Question;
    expect(q2.kind).toBe('question');
    expect(q2.field).toBe('afterChoice');
    expect(q2.args.after).toEqual(['pr-frame-insp', 'plumbing']);
    expect(q2.args.afterChoice).toBeUndefined();
    const p = runOperation(ds, 'add_step', { ...q2.args, afterChoice: 'pr-fit-off' }, ctx) as Proposal;
    expect(p.kind).toBe('proposal');
    expect(linksOf(p)).toEqual(['pr-frame-insp', 'pr-fit-off']);
  });

  it('an answer that is not one of the options asks again', () => {
    const ds = buildSeed();
    const q = runOperation(ds, 'add_step', { ...base, after: ['inspection'], afterChoice: 'pr-brickwork' }, ctx) as Question;
    expect(q.kind).toBe('question');
    expect(q.field).toBe('afterChoice');
  });
});
