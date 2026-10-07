/** Stage 4a read-model additions: the fields the job overview, program, step and checklist screens draw. */
import { describe, expect, it } from 'vitest';
import {
  BEATTY,
  buildSeed,
  changeHistory,
  InMemoryStore,
  PARK_RD_WINDOWS,
  runOperation,
  shipmentsList,
  SIDE_NORM,
  DEFAULT_TODAY,
  designChecklist,
  jobsList,
  mondayRows,
  PARK_RD,
  programView,
  SHUTDOWNS,
  SIDE_ND,
  stepDetail,
  whyItMoved,
} from '../src/index.js';

const today = DEFAULT_TODAY;

describe('whyItMoved carries each change with before and after', () => {
  it('Beatty: the tiler cause lists its expected date change and the voice note', () => {
    const c = whyItMoved(buildSeed(), BEATTY, today).causes[0]!;
    expect(c.changes).toEqual([
      expect.objectContaining({ kind: 'update', table: 'item', rowLabel: 'Book tiler', field: 'expectedDate', before: '2026-09-28', after: '2026-10-05' }),
    ]);
    expect(c.sourceKind).toBe('voice');
    expect(c.sourceReceivedAt).toMatch(/^2026-09-1[45]T/);
  });
});

describe('programView', () => {
  const p = programView(buildSeed(), PARK_RD, today);
  it('adds stage name and trade type to each step', () => {
    const s = p.steps.find((x) => x.stepId === 'pr-install-windows')!;
    expect(s.stageName).toBe('Lock-up');
    expect(s).toHaveProperty('tradeType');
    expect(s.plannedStart).toBe('2026-11-02');
  });
  it('lists the open step-linked items and the shutdown', () => {
    expect(p.items.length).toBeGreaterThan(0);
    expect(p.items.every((i) => i.stepId && i.status !== 'done')).toBe(true);
    expect(p.items.filter((i) => i.stepId === 'pr-install-windows').map((i) => i.title)).toContain('Windows');
    expect(p.shutdowns).toEqual(SHUTDOWNS.map((r) => ({ ...r })));
  });
});

describe('stepDetail', () => {
  it('Seaview slab inspection: hold point with 1 of 3 categories filled', () => {
    const d = stepDetail(buildSeed(), 'sv-slab-insp', today);
    expect(d.step.stageName).toBe('Slab');
    expect(d.holdPoint).toMatchObject({ filledCount: 1, missingCategories: ['Plumbing under slab', 'Membrane and termite barrier'] });
  });
});

describe('jobsList and designChecklist', () => {
  it('jobs carry their side and approval path', () => {
    const v = jobsList(buildSeed(), today);
    expect(v.design.find((r) => r.jobId === 'john-st')).toMatchObject({ sideId: SIDE_ND, path: 'DA' });
  });
  it('West St checklist: 2 outstanding, oldest 23 days, with freshness and done items', () => {
    const c = designChecklist(buildSeed(), 'west-st', today);
    expect(c.outstanding).toBe(2);
    expect(c.oldestDays).toBe(23);
    expect(c.items[0]).toMatchObject({ status: 'ordered_or_booked', statusLabel: expect.any(String) });
    expect(c.done.length).toBeGreaterThan(0);
    expect(typeof c.freshnessText).toBe('string');
    // Monday's design rows take freshness from the checklist.
    const m = mondayRows(buildSeed(), today).design.find((r) => r.jobId === 'west-st')!;
    expect(m.freshnessText).toBe(c.freshnessText);
  });
});

describe('seed owners', () => {
  it('Dominic is never shortened to Dom', () => {
    const ds = buildSeed();
    expect(ds.items.filter((i) => i.owner === 'Dom' || i.waitingOn === 'Dom')).toEqual([]);
  });
});

describe('changeHistory: forecast effects and side filter', () => {
  it('the seeded tiler change moved Beatty St +7 days, $2,000/wk -> $2,000', () => {
    const e = changeHistory(buildSeed(), {}, today).find((x) => x.changeSetId === 'cs-0915-tiler')!;
    expect(e.effects).toEqual([
      expect.objectContaining({ jobId: BEATTY, finishBefore: '2026-11-27', finishAfter: '2026-12-04', deltaDays: 7, cost: 2000 }),
    ]);
  });
  it('without today there are no effects; cancelled entries never have any', () => {
    expect(changeHistory(buildSeed()).every((e) => e.effects.length === 0)).toBe(true);
    expect(changeHistory(buildSeed(), {}, today).filter((e) => e.status !== 'confirmed').every((e) => e.effects.length === 0)).toBe(true);
  });
  it('the Park Rd windows ETA change: +14 days, $9,000', () => {
    const ds = buildSeed();
    const r = runOperation(ds, 'set_shipment_eta', { shipment: PARK_RD_WINDOWS, eta: '2026-11-16' }, { today, now: new Date('2026-09-17T01:00:00.000Z') });
    if (r.kind !== 'proposal') throw new Error('expected a proposal');
    const store = new InMemoryStore(ds);
    const cs = store.applyChangeSet({ summary: r.summary, changes: r.changes });
    const e = changeHistory(store.load(), { limit: 1 }, today)[0]!;
    expect(e.changeSetId).toBe(cs.id);
    expect(e.effects[0]).toMatchObject({ jobId: PARK_RD, finishBefore: '2027-02-26', finishAfter: '2027-03-12', deltaDays: 14, cost: 9000 });
  });
  it('a side filter keeps only that side', () => {
    expect(changeHistory(buildSeed(), { sideId: SIDE_ND }).length).toBeGreaterThan(0);
    expect(changeHistory(buildSeed(), { sideId: SIDE_NORM })).toEqual([]);
  });
});

describe('shipmentsList: linked items', () => {
  it('Park Rd windows: 3 linked items, 2 owned by Raff', () => {
    const s = shipmentsList(buildSeed(), today).find((x) => x.shipmentId === PARK_RD_WINDOWS)!;
    expect(s.linkedItems).toHaveLength(3);
    expect(s.linkedItems.filter((i) => i.owner === 'Raff')).toHaveLength(2);
    expect(s.linkedItems.map((i) => i.title)).toContain('Windows');
    expect(s.linkedItems[0]).toHaveProperty('statusLabel');
  });
});
