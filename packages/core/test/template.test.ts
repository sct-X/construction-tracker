import { describe, expect, it } from 'vitest';
import {
  buildSeed,
  DEFAULT_TODAY,
  dryRun,
  forecastJob,
  runOperation,
  TEMPLATE_DUPLEX,
  type Proposal,
} from '../src/index.js';

const today = DEFAULT_TODAY;
let n = 0;
const ctx = { today, now: new Date('2026-09-17T05:10:00.000Z'), newId: (p: string) => `${p}-c${++n}` };

describe('templates (rule 8)', () => {
  const ds = buildSeed();
  const tpl = ds.jobs.find((j) => j.id === TEMPLATE_DUPLEX)!;

  it('the Duplex template has the program and no dates', () => {
    expect(tpl.isTemplate).toBe(true);
    const steps = ds.steps.filter((s) => s.jobId === TEMPLATE_DUPLEX);
    expect(steps.length).toBe(29);
    expect(steps.every((s) => s.plannedStart === null && s.plannedEnd === null && s.status === 'not_started')).toBe(true);
  });

  it('copy_template copies stages, steps, links, requirements and photo categories', () => {
    const p = runOperation(ds, 'copy_template', { template: 'Duplex', name: 'Smith St', startDate: '2027-02-01', weeklyHoldingCost: 3000 }, ctx) as Proposal;
    expect(p.kind).toBe('proposal');
    const after = dryRun(ds, p, today).after;
    const job = after.jobs.find((j) => j.name === 'Smith St')!;
    const count = (rows: { jobId: string }[], id: string) => rows.filter((r) => r.jobId === id).length;
    for (const key of ['stages', 'steps', 'stepLinks', 'requirements', 'photoCategories'] as const) {
      expect(count(after[key], job.id), key).toBe(count(ds[key], TEMPLATE_DUPLEX));
      expect(count(after[key], job.id)).toBeGreaterThan(0);
    }
    // Links point at the new steps.
    const stepIds = new Set(after.steps.filter((s) => s.jobId === job.id).map((s) => s.id));
    expect(after.stepLinks.filter((l) => l.jobId === job.id).every((l) => stepIds.has(l.stepId) && stepIds.has(l.waitsForStepId))).toBe(true);
    // Planned dates run forward from the start date; the forecast equals the plan.
    const f = forecastJob(after, job.id, today);
    const first = after.steps.find((s) => s.jobId === job.id && s.name === 'Site setup and fencing')!;
    expect(first.plannedStart).toBe('2027-02-01');
    expect(f.forecastFinish).toBe(job.plannedFinish);
    expect(f.lateDays).toBe(0);
    // The template is untouched.
    expect(after.steps.filter((s) => s.jobId === TEMPLATE_DUPLEX)).toEqual(ds.steps.filter((s) => s.jobId === TEMPLATE_DUPLEX));
  });

  it('starts-from stage marks earlier stages done', () => {
    const p = runOperation(ds, 'copy_template', { template: 'Duplex', name: 'Live St', startDate: '2026-09-21', startsFromStage: 'Lock-up' }, ctx) as Proposal;
    const after = dryRun(ds, p, today).after;
    const job = after.jobs.find((j) => j.name === 'Live St')!;
    const stages = after.stages.filter((s) => s.jobId === job.id).sort((a, b) => a.order - b.order);
    expect(stages.slice(0, 4).every((s) => s.status === 'done')).toBe(true);
    expect(stages[4]!.status).toBe('not_started');
    const f = forecastJob(after, job.id, today);
    expect(f.currentStageName).toBe('Lock-up');
    const brick = after.steps.find((s) => s.jobId === job.id && s.name === 'Brickwork')!;
    expect(brick.plannedStart).toBe('2026-09-21');
  });

  it('a template cannot be copied over an existing name, and setup ops work on templates', () => {
    expect(runOperation(ds, 'copy_template', { template: 'Duplex', name: 'Park Rd', startDate: '2027-01-11' }, ctx).kind).toBe('refusal');
    const add = runOperation(ds, 'add_step', { job: TEMPLATE_DUPLEX, stage: 'tpl-st-handover', name: 'Defects walk', durationDays: 2, after: ['tpl-handover'] }, ctx) as Proposal;
    expect(add.kind).toBe('proposal');
    const row = (add.changes[0] as unknown as { row: { plannedStart: unknown } }).row;
    expect(row.plannedStart).toBeNull();
  });
});

describe('setup operations', () => {
  const ds = buildSeed();

  it('edit_step: a longer duration moves the finish, planned end follows', () => {
    const p = runOperation(ds, 'edit_step', { step: 'pr-tiling', durationDays: 15 }, ctx) as Proposal;
    expect(p.kind).toBe('proposal');
    const after = dryRun(ds, p, today);
    expect(after.impacts[0]).toMatchObject({ jobId: 'park-rd', finishBefore: '2027-02-26', finishAfter: '2027-03-05', finishDeltaDays: 7 });
    const step = after.after.steps.find((s) => s.id === 'pr-tiling')!;
    expect(step.plannedEnd).not.toBe(ds.steps.find((s) => s.id === 'pr-tiling')!.plannedEnd);
  });

  it('add_link refuses a cycle and a duplicate; remove_link works', () => {
    expect(runOperation(ds, 'add_link', { step: 'pr-cladding', waitsFor: 'pr-handover' }, ctx).kind).toBe('refusal');
    expect(runOperation(ds, 'add_link', { step: 'pr-handover', waitsFor: 'pr-final-insp' }, ctx).kind).toBe('refusal');
    expect(runOperation(ds, 'remove_link', { step: 'pr-handover', waitsFor: 'pr-final-insp' }, ctx).kind).toBe('proposal');
  });

  it('delete_step is refused while items point at it; create_job makes design stages', () => {
    expect(runOperation(ds, 'delete_step', { step: 'pr-install-windows' }, ctx).kind).toBe('refusal');
    const p = runOperation(ds, 'create_job', { name: 'Ocean Pde', kind: 'design', path: 'CDC' }, ctx) as Proposal;
    const stages = p.changes.filter((c) => c.kind === 'insert' && c.table === 'stage').map((c) => (c.kind === 'insert' ? c.row.name : ''));
    expect(stages).toEqual(['Design', 'With certifier', 'Approved']);
  });

  it('add_stage in the middle renumbers the rest', () => {
    const p = runOperation(ds, 'add_stage', { job: 'park-rd', name: 'Scaffold', order: 5 }, ctx) as Proposal;
    const after = dryRun(ds, p, today).after;
    const names = after.stages.filter((s) => s.jobId === 'park-rd').sort((a, b) => a.order - b.order).map((s) => s.name);
    expect(names.slice(3, 6)).toEqual(['Roof', 'Scaffold', 'Lock-up']);
  });
});
