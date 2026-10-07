/**
 * SPEC.md "Seed data" numbers, asserted through the pure calculator and the
 * operations layer. Today is Thu 17 Sep 2026 unless a test says otherwise.
 */
import { describe, expect, it } from 'vitest';
import {
  BEATTY,
  buildSeed,
  DEFAULT_TODAY,
  designChecklist,
  dryRun,
  fixedClock,
  forecastJob,
  formatLong,
  formatShort,
  InMemoryStore,
  ITEM_TYPES,
  mondayRows,
  PARK_RD,
  PARK_RD_WINDOWS,
  runOperation,
  SEAVIEW,
  type Proposal,
} from '../src/index.js';

const today = DEFAULT_TODAY;
const ctx = { today, now: new Date('2026-09-17T05:10:00.000Z') };

describe('Park Rd', () => {
  const ds = buildSeed();
  const f = forecastJob(ds, PARK_RD, today);

  it('finishes Fri 26 Feb 2027, equal to the Mon 14 Sep snapshot', () => {
    expect(f.forecastFinish).toBe('2027-02-26');
    expect(formatLong(f.forecastFinish!)).toBe('Fri 26 Feb 2027');
    expect(f.snapshot?.date).toBe('2026-09-14');
    expect(f.snapshot?.forecastFinish).toBe('2027-02-26');
    expect(f.slipDays).toBe(0);
    expect(f.slipCost).toBe(0);
    expect(f.freshness.amber).toBe(false);
    expect(f.currentStageName).toBe('Lock-up');
  });

  it('Install windows planned Mon 2 Nov, windows act-by Mon 10 Aug', () => {
    const step = f.steps['pr-install-windows']!;
    expect(step.plannedStart).toBe('2026-11-02');
    expect(step.forecastStart).toBe('2026-11-02');
    const w = f.items['it-pr-windows']!;
    expect(w.neededBy).toBe('2026-11-02');
    expect(w.actBy).toBe('2026-08-10');
    expect(formatShort(w.actBy!)).toBe('Mon 10 Aug');
    expect(w.expected).toBe('2026-10-26');
    expect(w.expectedFromShipmentId).toBe(PARK_RD_WINDOWS);
    expect(f.items['it-pr-plasterer']!.actBy).toBe('2026-09-18');
  });

  it('windows shipment: ETA 26 Oct, in production, 3 linked items, 2 owned by Raff', () => {
    const sh = ds.shipments.find((s) => s.id === PARK_RD_WINDOWS)!;
    expect(sh.eta).toBe('2026-10-26');
    expect(sh.status).toBe('in_production');
    const linked = ds.items.filter((i) => i.shipmentId === sh.id);
    expect(linked).toHaveLength(3);
    expect(linked.filter((i) => i.owner === 'Raff')).toHaveLength(2);
  });

  it('has about 30 items across every item type', () => {
    const items = ds.items.filter((i) => i.jobId === PARK_RD);
    expect(items.length).toBeGreaterThanOrEqual(28);
    expect(items.length).toBeLessThanOrEqual(36);
    for (const t of ITEM_TYPES) expect(items.some((i) => i.type === t), t).toBe(true);
  });

  it('ETA to 16 Nov: Install windows starts 16 Nov, finish Fri 12 Mar 2027, slip +14, $9,000', () => {
    const r = runOperation(ds, 'set_shipment_eta', { shipment: 'Park Rd windows', eta: '16 Nov' }, ctx);
    expect(r.kind).toBe('proposal');
    const p = r as Proposal;
    expect(p.summary).toBe('Park Rd windows ETA Mon 26 Oct to Mon 16 Nov');
    expect(p.changes).toEqual([{ kind: 'update', table: 'shipment', rowId: PARK_RD_WINDOWS, field: 'eta', before: '2026-10-26', after: '2026-11-16' }]);
    const impact = dryRun(ds, p, today).impacts[0]!;
    expect(impact.jobId).toBe(PARK_RD);
    expect(impact.finishBefore).toBe('2027-02-26');
    expect(impact.finishAfter).toBe('2027-03-12');
    expect(formatLong(impact.finishAfter!)).toBe('Fri 12 Mar 2027');
    expect(impact.slipAfter).toBe(14);
    expect(impact.slipCostAfter).toBe(9000);
    const moved = impact.movedSteps.find((m) => m.stepId === 'pr-install-windows')!;
    expect(moved).toMatchObject({ from: '2026-11-02', to: '2026-11-16', deltaDays: 14 });
    expect(moved.text).toBe('Install windows Mon 2 Nov to Mon 16 Nov');

    const after = dryRun(ds, p, today).after;
    const fa = forecastJob(after, PARK_RD, today);
    expect(fa.steps['pr-install-windows']!.forecastStart).toBe('2026-11-16');
    // Rule 1: the windows still read late; needed-by does not chase the step.
    for (const id of ['it-pr-windows', 'it-pr-sliding-doors', 'it-pr-glazing-cert']) {
      expect(fa.items[id]!.neededBy).toBe('2026-11-02');
      expect(fa.items[id]!.lateText).toBe('14 days after needed');
    }
  });
});

describe('Seaview St', () => {
  const ds = buildSeed();
  const f = forecastJob(ds, SEAVIEW, today);

  it('finishes Fri 29 Oct 2027, slip 0, confirmed 1 day ago', () => {
    expect(f.forecastFinish).toBe('2027-10-29');
    expect(f.slipDays).toBe(0);
    expect(f.freshness.daysUnconfirmed).toBe(1);
    expect(f.freshness.amber).toBe(false);
  });

  it('"Book concrete pump" acts by Fri 18 Sep', () => {
    expect(f.items['it-sv-pump']!.actBy).toBe('2026-09-18');
    expect(formatShort(f.items['it-sv-pump']!.actBy!)).toBe('Fri 18 Sep');
  });

  it('slab inspection hold point Mon 28 Sep with 1 of 3 required categories', () => {
    const h = f.nextHoldPoint!;
    expect(h.stepName).toBe('Slab inspection before pour');
    expect(h.forecastStart).toBe('2026-09-28');
    expect(h.required).toHaveLength(3);
    expect(h.filledCount).toBe(1);
    expect(h.missingCategories).toEqual(['Plumbing under slab', 'Membrane and termite barrier']);
  });

  it('mark_step_done is refused, naming the 2 empty categories', () => {
    const r = runOperation(ds, 'mark_step_done', { step: 'slab inspection', job: 'Seaview' }, ctx);
    expect(r.kind).toBe('refusal');
    if (r.kind !== 'refusal') return;
    expect(r.reason).toBe("Can't sign off Slab inspection before pour yet. No photos for: Plumbing under slab, Membrane and termite barrier.");
    expect(r.reason).toContain('Plumbing under slab');
    expect(r.reason).toContain('Membrane and termite barrier');
  });

  it('second windows shipment does not move Seaview', () => {
    const sh = ds.shipments.find((s) => s.id === 'sh-sv-windows')!;
    expect(sh.jobId).toBe(SEAVIEW);
    expect(f.items['it-sv-windows']!.isLate).toBe(false);
  });
});

describe('Beatty St', () => {
  const ds = buildSeed();
  const f = forecastJob(ds, BEATTY, today);

  it('finishes Fri 4 Dec 2026, slip +5 days, $1,430, amber after 9 days', () => {
    expect(f.forecastFinish).toBe('2026-12-04');
    expect(f.slipDays).toBe(5);
    expect(f.slipCost).toBe(1430);
    expect(f.freshness.daysUnconfirmed).toBe(9);
    expect(f.freshness.amber).toBe(true);
    expect(f.items['it-bt-tiler']!.expected).toBe('2026-10-05');
  });
});

describe('Monday screen', () => {
  const view = mondayRows(buildSeed(), today);

  it('sorts builds by slip cost, all three with their numbers', () => {
    expect(view.weekOf).toBe('2026-09-14');
    expect(view.builds.map((b) => b.name)).toEqual(['Beatty St', 'Park Rd', 'Seaview St']);
    const beatty = view.builds.find((b) => b.jobId === BEATTY)!;
    expect(beatty).toMatchObject({ slipDays: 5, slipCost: 1430, amber: true, forecastFinish: '2026-12-04' });
    const seaview = view.builds.find((b) => b.jobId === SEAVIEW)!;
    expect(seaview.actByDue.map((r) => r.title)).toContain('Book concrete pump');
    expect(seaview.nextHoldPoint).toMatchObject({ date: '2026-09-28', filled: 1, required: 3 });
  });

  it('design rows: counts and oldest ages', () => {
    const d = Object.fromEntries(view.design.map((r) => [r.name, r]));
    expect(d['West St']).toMatchObject({ stageName: 'With council', outstanding: 2, oldestDays: 23 });
    expect(d['Tollbar Ave']).toMatchObject({ stageName: 'With council', outstanding: 1, oldestDays: 8 });
    expect(d['Lower Beach St']).toMatchObject({ stageName: 'Design', outstanding: 0, oldestDays: null });
    expect(d['John St']).toMatchObject({ stageName: 'Design', outstanding: 1, oldestDays: 4 });
    expect(view.design.map((r) => r.name)).toEqual(['West St', 'Tollbar Ave', 'John St', 'Lower Beach St']);
  });

  it('design checklist agrees', () => {
    expect(designChecklist(buildSeed(), 'west-st', today).items[0]!.daysSitting).toBe(23);
  });
});

describe('ETA change confirmed through the store', () => {
  it('Monday shows +14 / $9,000 after, and undo restores 26 Feb', () => {
    const store = new InMemoryStore(buildSeed(), { clock: fixedClock(today, '15:10') });
    const ds = store.load();
    const p = runOperation(ds, 'set_shipment_eta', { shipment: 'windows', job: 'Park Rd', eta: '2026-11-16' }, ctx) as Proposal;
    const cs = store.applyChangeSet({ summary: p.summary, opName: p.op, opArgs: p.args, changes: p.changes });
    const park = () => mondayRows(store.load(), today).builds.find((b) => b.jobId === PARK_RD)!;
    expect(park()).toMatchObject({ forecastFinish: '2027-03-12', slipDays: 14, slipCost: 9000 });
    expect(mondayRows(store.load(), today).builds[0]!.jobId).toBe(PARK_RD);
    expect(store.undo(cs.id)).toMatchObject({ ok: true });
    expect(park()).toMatchObject({ forecastFinish: '2027-02-26', slipDays: 0 });
  });
});
