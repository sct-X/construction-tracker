/** Stage 0 review fixes (docs/reviews/stage-0.md), one test each. */
import { describe, expect, it } from 'vitest';
import {
  apiPhotoUrl,
  BEATTY,
  buildSeed,
  createMockDashboard,
  DEFAULT_TODAY,
  dryRun,
  fixedClock,
  InMemoryStore,
  LocalDashboardApi,
  PARK_RD_WINDOWS,
  runOperation,
  TEMPLATE_DUPLEX,
  whyItMoved,
  type DashboardApi,
  type Proposal,
} from '../src/index.js';

const today = DEFAULT_TODAY;
let n = 0;
const ctx = { today, now: new Date('2026-09-17T05:10:00.000Z'), newId: (p: string) => `${p}-r${++n}` };

describe('1. rule 9: no steps, links or requirements on design jobs', () => {
  const ds = buildSeed();
  it('refuses add_step, edit_step, add_link, add_requirement on a design job', () => {
    expect(runOperation(ds, 'add_step', { job: 'West St', stage: 'Design', name: 'X', durationDays: 3 }, ctx)).toMatchObject({ kind: 'refusal' });
    // Plant a stray design step to prove the edit/link/requirement paths refuse too.
    const stray = { id: 'ws-stray', jobId: 'west-st', stageId: 'west-st-st-1', name: 'Stray', order: 1, durationDays: 1, plannedStart: null, plannedEnd: null, actualStart: null, actualEnd: null, status: 'not_started' as const, isHoldPoint: false, isPlaceholder: false, tradeType: null };
    const ds2 = { ...ds, steps: [...ds.steps, stray, { ...stray, id: 'ws-stray-2' }] };
    for (const [op, args] of [
      ['edit_step', { step: 'ws-stray', durationDays: 4 }],
      ['add_link', { step: 'ws-stray', waitsFor: 'ws-stray-2' }],
      ['add_requirement', { step: 'ws-stray', kind: 'trade', name: 'Planner', leadTimeWeeks: 1 }],
    ] as const) {
      const r = runOperation(ds2, op, args, ctx);
      expect(r.kind, op).toBe('refusal');
      if (r.kind === 'refusal') expect(r.reason).toContain('design job');
    }
  });
});

describe('2. undo refused when a later change touched the same field', () => {
  it('ETA 16 Nov -> 23 Nov -> 16 Nov, then undo the first: "Undo that first"', () => {
    const store = new InMemoryStore(buildSeed(), { clock: fixedClock(today) });
    const apply = (eta: string) => {
      const p = runOperation(store.load(), 'set_shipment_eta', { shipment: PARK_RD_WINDOWS, eta }, ctx) as Proposal;
      expect(p.kind).toBe('proposal');
      return store.applyChangeSet({ summary: p.summary, changes: p.changes });
    };
    const a = apply('2026-11-16');
    apply('2026-11-23');
    const c = apply('2026-11-16');
    const r = store.undo(a.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('Undo that first');
    expect(store.load().shipments.find((s) => s.id === PARK_RD_WINDOWS)!.eta).toBe('2026-11-16');
    // The latest one can still be undone, and then the chain unwinds in order.
    expect(store.undo(c.id).ok).toBe(true);
  });

  it('a later change to another field of the same row does not block', () => {
    const store = new InMemoryStore(buildSeed(), { clock: fixedClock(today) });
    const eta = runOperation(store.load(), 'set_shipment_eta', { shipment: PARK_RD_WINDOWS, eta: '16 Nov' }, ctx) as Proposal;
    const a = store.applyChangeSet({ summary: eta.summary, changes: eta.changes });
    const st = runOperation(store.load(), 'set_shipment_status', { shipment: PARK_RD_WINDOWS, status: 'shipped' }, ctx) as Proposal;
    store.applyChangeSet({ summary: st.summary, changes: st.changes });
    expect(store.undo(a.id).ok).toBe(true);
  });
});

describe('3. attach_photo asks instead of refusing', () => {
  const ds = buildSeed();
  const svCats = ds.photoCategories.filter((c) => c.jobId === 'seaview').map((c) => c.id).sort();

  it('unmatched category: question with every category for the job', () => {
    const r = runOperation(ds, 'attach_photo', { job: 'Seaview', category: 'formwork pics', filePath: 'seaview/x.jpg' }, ctx);
    expect(r).toMatchObject({ kind: 'question', field: 'category' });
    if (r.kind === 'question') expect(r.options!.map((o) => o.value).sort()).toEqual(svCats);
  });

  it('unmatched stage: question with the job categories', () => {
    const r = runOperation(ds, 'attach_photo', { job: 'Seaview', stage: 'basement', filePath: 'seaview/x.jpg' }, ctx);
    expect(r).toMatchObject({ kind: 'question', field: 'category' });
  });

  it('unmatched or ambiguous job: question with jobs', () => {
    const none = runOperation(ds, 'attach_photo', { job: 'Smith St', category: 'steel', filePath: 'x.jpg' }, ctx);
    expect(none).toMatchObject({ kind: 'question', field: 'job' });
    if (none.kind === 'question') expect(none.options!.map((o) => o.label)).toContain('Seaview St');
    const amb = runOperation(ds, 'attach_photo', { job: 'St', filePath: 'x.jpg' }, ctx);
    expect(amb).toMatchObject({ kind: 'question', field: 'job' });
  });

  it('ambiguous category within a stage: question with that stage’s categories', () => {
    const r = runOperation(ds, 'attach_photo', { job: 'Seaview', stage: 'slab', category: 'slab', filePath: 'x.jpg' }, ctx);
    expect(r).toMatchObject({ kind: 'question', field: 'category' });
    if (r.kind === 'question') expect(r.options!.length).toBeGreaterThanOrEqual(3);
  });
});

describe('4. why-it-moved leftover wording', () => {
  it('Beatty: "2 days earlier for reasons not in the change log"', () => {
    expect(whyItMoved(buildSeed(), BEATTY, today).lines).toContain('2 days earlier for reasons not in the change log');
  });
});

describe('5. templates never get dates', () => {
  const ds = buildSeed();
  it('create_job / edit_job / add_step / edit_step refuse dates on a template', () => {
    expect(runOperation(ds, 'create_job', { name: 'Townhouse', kind: 'build', isTemplate: true, startDate: '2027-01-11' }, ctx).kind).toBe('refusal');
    expect(runOperation(ds, 'edit_job', { job: TEMPLATE_DUPLEX, plannedFinish: '2027-06-30' }, ctx).kind).toBe('refusal');
    expect(runOperation(ds, 'add_step', { job: TEMPLATE_DUPLEX, stage: 'tpl-st-handover', name: 'Walk', durationDays: 1, plannedStart: '2027-01-11' }, ctx).kind).toBe('refusal');
    expect(runOperation(ds, 'edit_step', { step: 'tpl-tiling', plannedStart: '2027-01-11' }, ctx).kind).toBe('refusal');
  });

  it('a template step cannot be started or done', () => {
    expect(runOperation(ds, 'mark_step_done', { step: 'tpl-handover' }, ctx).kind).toBe('refusal');
    expect(runOperation(ds, 'mark_step_started', { step: 'tpl-handover' }, ctx).kind).toBe('refusal');
  });

  it('copy_template leaves the template undated and a duration edit adds none', () => {
    const p = runOperation(ds, 'copy_template', { template: 'Duplex', name: 'Smith St', startDate: '2027-02-01' }, ctx) as Proposal;
    const after = dryRun(ds, p, today).after;
    const tpl = () => after.steps.filter((s) => s.jobId === TEMPLATE_DUPLEX);
    expect(tpl().every((s) => !s.plannedStart && !s.plannedEnd && !s.actualStart && !s.actualEnd)).toBe(true);
    expect(after.jobs.find((j) => j.id === TEMPLATE_DUPLEX)!).toMatchObject({ startDate: null, plannedFinish: null });
    const e = runOperation(ds, 'edit_step', { step: 'tpl-tiling', durationDays: 12 }, ctx) as Proposal;
    expect(e.changes.map((c) => (c.kind === 'update' ? c.field : ''))).toEqual(['durationDays']);
  });
});

describe('6. unknown args are refused by name', () => {
  it('set_item_status with "expected"', () => {
    const r = runOperation(buildSeed(), 'set_item_status', { item: 'concrete pump', job: 'Seaview', status: 'confirmed', expected: '2026-10-01' }, ctx);
    expect(r.kind).toBe('refusal');
    if (r.kind === 'refusal') expect(r.reason).toContain('"expected"');
  });
});

describe('7. photo URLs and dev controls', () => {
  it('mock: placeholder data URLs, today and reset via DevControls', async () => {
    const { api, dev } = createMockDashboard();
    const gallery = await api.getPhotos('seaview');
    const photo = gallery.groups.flatMap((g) => g.categories.flatMap((c) => c.photos))[0]!;
    expect(api.photoUrl(photo)).toMatch(/^data:image\/svg\+xml/);
    expect(api.photoUrl({ id: 'p1', caption: null, isPlaceholder: false })).toBe('/api/photos/p1/file');
    expect(await api.getToday()).toBe(today);
    await dev.setToday('2026-09-21');
    expect(await api.getToday()).toBe('2026-09-21');
    expect((await api.getMonday()).weekOf).toBe('2026-09-21');
    await api.applySetup('add_trade', { name: 'Kerbside Concrete', type: 'Concreter' });
    expect((await api.listTrades()).some((t) => t.name === 'Kerbside Concrete')).toBe(true);
    await dev.reset();
    expect((await api.listTrades()).some((t) => t.name === 'Kerbside Concrete')).toBe(false);
    // DevControls is not part of DashboardApi.
    const plain: DashboardApi = new LocalDashboardApi(new InMemoryStore(buildSeed()), fixedClock(today));
    expect('setToday' in plain).toBe(false);
    expect(apiPhotoUrl('a b')).toBe('/api/photos/a%20b/file');
  });
});
