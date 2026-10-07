/** Stage 5 Setup additions: step order, requirement edits, save as template, AU phones, the Setup source, program setup view. */
import { describe, expect, it } from 'vitest';
import {
  buildSeed,
  changeHistory,
  DEFAULT_TODAY,
  dryRun,
  fixedClock,
  formatAuPhone,
  InMemoryStore,
  LocalDashboardApi,
  programSetup,
  programWorkingDays,
  runOperation,
  SETUP_SENDER,
  TEMPLATE_DUPLEX,
  type Proposal,
} from '../src/index.js';

const today = DEFAULT_TODAY;
let n = 0;
const ctx = { today, now: new Date('2026-09-17T05:10:00.000Z'), newId: (p: string) => `${p}-s${++n}` };

function apply(ds: ReturnType<typeof buildSeed>, op: string, args: unknown) {
  const p = runOperation(ds, op, args, ctx);
  if (p.kind !== 'proposal') throw new Error(`${op}: ${p.kind === 'refusal' ? p.reason : p.question}`);
  return dryRun(ds, p, today).after;
}

describe('edit_step order', () => {
  it('moves a step within its stage and renumbers the rest', () => {
    const ds = buildSeed();
    const after = apply(ds, 'edit_step', { step: 'tpl-frame-insp', order: 1 });
    const frame = after.steps.filter((s) => s.stageId === 'tpl-st-frame').sort((a, b) => a.order - b.order);
    expect(frame.map((s) => s.id)).toEqual(['tpl-frame-insp', 'tpl-frame']);
  });

  it('moves a step to a given place in another stage', () => {
    const ds = buildSeed();
    const after = apply(ds, 'edit_step', { step: 'tpl-frame-insp', stage: 'tpl-st-slab', order: 1 });
    const slab = after.steps.filter((s) => s.stageId === 'tpl-st-slab').sort((a, b) => a.order - b.order);
    expect(slab[0]!.id).toBe('tpl-frame-insp');
    expect(slab.map((s) => s.order)).toEqual(slab.map((_, i) => i + 1));
  });
});

describe('requirements', () => {
  it('edit_requirement changes the lead time and says so', () => {
    const ds = buildSeed();
    const p = runOperation(ds, 'edit_requirement', { requirement: 'tpl-rq-excavator', leadTimeWeeks: 4 }, ctx) as Proposal;
    expect(p.kind).toBe('proposal');
    expect(p.summary).toBe('Edited Excavator for Site setup and fencing at Duplex, lead time 2 to 4 weeks');
    const after = dryRun(ds, p, today).after;
    expect(after.requirements.find((r) => r.id === 'tpl-rq-excavator')!.leadTimeWeeks).toBe(4);
  });

  it('a longer lead time on a live job moves the linked item act-by earlier', () => {
    const ds = buildSeed();
    const p = runOperation(ds, 'edit_requirement', { requirement: 'pr-rq-excavator', leadTimeWeeks: 6 }, ctx) as Proposal;
    const impact = dryRun(ds, p, today).impacts[0]!;
    expect(impact.jobId).toBe('park-rd');
    expect(impact.movedItems.some((m) => m.itemId === 'it-pr-excavator' && m.field === 'actBy')).toBe(true);
  });

  it('delete_requirement is refused while items are linked, allowed on a template', () => {
    const ds = buildSeed();
    const refused = runOperation(ds, 'delete_requirement', { requirement: 'pr-rq-windows' }, ctx);
    expect(refused.kind).toBe('refusal');
    expect(refused.kind === 'refusal' && refused.reason).toContain('Windows can\'t be removed');
    const after = apply(ds, 'delete_requirement', { requirement: 'tpl-rq-excavator' });
    expect(after.requirements.some((r) => r.id === 'tpl-rq-excavator')).toBe(false);
  });
});

describe('save_as_template', () => {
  it("copies a job's program with no dates, and the new template can start a job", () => {
    const ds = buildSeed();
    const after = apply(ds, 'save_as_template', { job: 'park-rd', name: 'Park Rd duplex' });
    const tpl = after.jobs.find((j) => j.name === 'Park Rd duplex')!;
    expect(tpl).toMatchObject({ isTemplate: true, plannedFinish: null, startDate: null, lastConfirmed: null, weeklyHoldingCost: null });
    const count = (rows: { jobId: string }[], id: string) => rows.filter((r) => r.jobId === id).length;
    for (const key of ['stages', 'steps', 'stepLinks', 'requirements', 'photoCategories'] as const) {
      expect(count(after[key], tpl.id), key).toBe(count(ds[key], 'park-rd'));
    }
    const steps = after.steps.filter((s) => s.jobId === tpl.id);
    expect(steps.every((s) => !s.plannedStart && !s.plannedEnd && !s.actualStart && s.status === 'not_started')).toBe(true);
    expect(after.stages.filter((s) => s.jobId === tpl.id).every((s) => s.status === 'not_started')).toBe(true);
    expect(programWorkingDays(after, tpl.id)).toBe(programWorkingDays(ds, 'park-rd'));
    const job = apply(after, 'copy_template', { template: tpl.id, name: 'Copy St', startDate: '2027-02-01' });
    expect(job.steps.filter((s) => s.jobId === job.jobs.find((j) => j.name === 'Copy St')!.id)).toHaveLength(steps.length);
  });

  it('refuses a design job and a taken template name', () => {
    const ds = buildSeed();
    expect(runOperation(ds, 'save_as_template', { job: 'west-st', name: 'X' }, ctx).kind).toBe('refusal');
    expect(runOperation(ds, 'save_as_template', { job: 'park-rd', name: 'duplex' }, ctx).kind).toBe('refusal');
  });
});

describe('Australian phone numbers', () => {
  it('writes them the usual way, or refuses', () => {
    expect(formatAuPhone('0412345678')).toBe('0412 345 678');
    expect(formatAuPhone('+61 412 345 678')).toBe('0412 345 678');
    expect(formatAuPhone('+61 (0)412 345 678')).toBe('0412 345 678');
    expect(formatAuPhone('(02) 9876-5432')).toBe('02 9876 5432');
    expect(formatAuPhone('1300123456')).toBe('1300 123 456');
    expect(formatAuPhone('13 12 34')).toBe('13 12 34');
    expect(formatAuPhone('0491 570 157')).toBe('0491 570 157');
    for (const bad of ['12345', '0412 345 67', '+1 415 555 0100', 'call Raff', '0612345678']) expect(formatAuPhone(bad), bad).toBeNull();
  });

  it('add_trade and edit_trade refuse a bad number and save a good one formatted', () => {
    const ds = buildSeed();
    const bad = runOperation(ds, 'add_trade', { name: 'Kerbside', type: 'Concreter', phone: '555 1234' }, ctx);
    expect(bad.kind === 'refusal' && bad.reason).toMatch(/Australian phone number/);
    const after = apply(ds, 'add_trade', { name: 'Kerbside', type: 'Concreter', phone: '0491579212' });
    expect(after.trades.find((t) => t.name === 'Kerbside')!.phone).toBe('0491 579 212');
    expect(runOperation(ds, 'edit_trade', { trade: 'tr-northern-pump', phone: '12' }, ctx).kind).toBe('refusal');
    expect(runOperation(ds, 'edit_trade', { trade: 'tr-northern-pump', name: 'Harbour Tiling' }, ctx).kind).toBe('refusal');
  });
});

describe('LocalDashboardApi Setup', () => {
  it('records every Setup save as coming from Setup on the web', async () => {
    const api = new LocalDashboardApi(new InMemoryStore(buildSeed()), fixedClock(today));
    const r = await api.applySetup('edit_step', { step: 'pr-tiling', durationDays: 15 });
    expect(r.ok).toBe(true);
    const entry = (await api.getChangeHistory({ jobId: 'park-rd', limit: 1 }))[0]!;
    expect(entry.summary).toBe('Edited step Tiling at Park Rd');
    expect(entry.message).toMatchObject({ channel: 'web', rawText: null, transcript: null });
    expect(entry.effects[0]).toMatchObject({ jobId: 'park-rd', finishAfter: '2027-03-05', deltaDays: 7 });
    const why = await api.getWhyItMoved('park-rd');
    expect(why.causes[0]).toMatchObject({ summary: 'Edited step Tiling at Park Rd', sourceChannel: 'web', sourceText: null, deltaDays: 7 });
  });

  it('a refused or stale Setup save records nothing', async () => {
    const store = new InMemoryStore(buildSeed());
    const api = new LocalDashboardApi(store, fixedClock(today));
    const before = store.load().inboundMessages.length;
    expect((await api.applySetup('add_trade', { name: 'X', type: 'Y', phone: 'nope' })).ok).toBe(false);
    expect(store.load().inboundMessages.length).toBe(before);
    expect(store.load().inboundMessages.filter((m) => m.sender === SETUP_SENDER)).toHaveLength(0);
  });

  it('previews a template change as working days, a job change as forecast impact', async () => {
    const api = new LocalDashboardApi(new InMemoryStore(buildSeed()), fixedClock(today));
    const tpl = await api.previewSetup('edit_step', { step: 'tpl-frame', durationDays: 20 });
    expect(tpl.impact).toEqual([]);
    expect(tpl.templates).toHaveLength(1);
    expect(tpl.templates[0]!.workingDaysAfter - tpl.templates[0]!.workingDaysBefore).toBe(5);
    const job = await api.previewSetup('edit_step', { step: 'pr-tiling', durationDays: 15 });
    expect(job.templates).toEqual([]);
    expect(job.impact![0]).toMatchObject({ finishBefore: '2027-02-26', finishAfter: '2027-03-05' });
    const created = await api.previewSetup('copy_template', { template: TEMPLATE_DUPLEX, name: 'Smith St', startDate: '2027-02-01' });
    expect(created.impact![0]).toMatchObject({ finishBefore: null });
    expect(created.impact![0]!.finishAfter).toBeTruthy();
  });
});

describe('programSetup', () => {
  it('a live job: stages in order, steps with links, requirements, items and forecast', () => {
    const ds = buildSeed();
    const v = programSetup(ds, 'park-rd', today);
    expect(v.stages.map((s) => s.order)).toEqual(v.stages.map((_, i) => i + 1));
    const windows = v.stages.flatMap((s) => s.steps).find((s) => s.id === 'pr-install-windows')!;
    expect(windows.requirements.map((r) => r.name)).toContain('Windows');
    expect(windows.waitsFor.length).toBeGreaterThan(0);
    expect(windows.itemCount).toBe(4);
    expect(windows.forecastStart).toBe('2026-11-02');
    expect(v.forecastFinish).toBe('2027-02-26');
    expect(v.tradeTypes).toContain('Plumber');
  });

  it('a template: no forecast, a length in working days', () => {
    const v = programSetup(buildSeed(), TEMPLATE_DUPLEX, today);
    expect(v.forecastFinish).toBeNull();
    expect(v.stages.flatMap((s) => s.steps).every((s) => s.forecastStart === null)).toBe(true);
    expect(v.workingDays).toBeGreaterThan(100);
  });

  it('change history entries from the seed keep their telegram source', () => {
    const ds = buildSeed();
    expect(changeHistory(ds, { limit: 3 }).every((e) => !e.message || e.message.channel !== 'web')).toBe(true);
  });
});
