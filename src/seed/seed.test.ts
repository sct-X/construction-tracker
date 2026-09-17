/**
 * Every number in SPEC.md "Mock data", asserted against the seed through the
 * pure calculator. Today is Thu 17 Sep 2026 unless a test says otherwise.
 */
import { describe, expect, it } from 'vitest';
import type { ForecastBundle } from '../domain/forecast';
import { forecastJob, holdPointCheck, holdPointRefusalText, previewEtaChange, topWaitingOn } from '../domain/forecast';
import { buildSeed, DEFAULT_TODAY, BEATTY, PARK_RD, SEAVIEW, SIDE_NORM } from './index';

const seed = buildSeed();

function bundleFor(jobId: string, today = DEFAULT_TODAY, overrides: Partial<ForecastBundle> = {}): ForecastBundle {
  const job = seed.jobs.find((j) => j.id === jobId)!;
  return {
    job,
    stages: seed.stages.filter((s) => s.jobId === jobId),
    steps: seed.steps.filter((s) => s.jobId === jobId),
    links: seed.stepLinks.filter((l) => l.jobId === jobId),
    requirements: seed.requirements.filter((r) => r.jobId === jobId),
    items: seed.items.filter((i) => i.jobId === jobId),
    shipments: seed.shipments.filter((s) => s.jobId === jobId),
    snapshots: seed.snapshots.filter((s) => s.jobId === jobId),
    photoCategories: seed.photoCategories.filter((c) => c.jobId === jobId),
    photos: seed.photos.filter((p) => p.jobId === jobId),
    activity: seed.activity.filter((a) => a.jobId === jobId),
    people: seed.people,
    today,
    ...overrides,
  };
}

describe('Park Rd', () => {
  const f = forecastJob(bundleFor(PARK_RD));

  it('finishes Fri 26 Feb 2027 with slip 0 against the 14 Sep snapshot', () => {
    expect(f.forecastFinish).toBe('2027-02-26');
    expect(f.snapshotDate).toBe('2026-09-14');
    expect(f.slipDays).toBe(0);
    expect(f.slipCost).toBe(0);
    expect(f.isLate).toBe(false);
    expect(f.currentStageName).toBe('Lock-up');
    expect(f.freshness.daysUnconfirmed).toBe(2);
    expect(f.freshness.amber).toBe(false);
  });

  it('Install windows is planned Mon 2 Nov and the windows act by Mon 10 Aug', () => {
    const step = f.steps['pr-install-windows'];
    expect(step.plannedStart).toBe('2026-11-02');
    expect(step.forecastStart).toBe('2026-11-02');
    const windows = f.items['it-pr-windows'];
    expect(windows.neededBy).toBe('2026-11-02');
    expect(windows.actBy).toBe('2026-08-10');
    expect(windows.expected).toBe('2026-10-26');
    expect(windows.expectedFromShipmentId).toBe('sh-park-windows');
    expect(windows.isLate).toBe(false);
  });

  it('has the windows shipment in production with 3 linked items, 2 owned by Raff', () => {
    const sh = seed.shipments.find((s) => s.id === 'sh-park-windows')!;
    expect(sh.status).toBe('in_production');
    expect(sh.eta).toBe('2026-10-26');
    const linked = seed.items.filter((i) => i.shipmentId === sh.id);
    expect(linked).toHaveLength(3);
    expect(linked.filter((i) => i.ownerId === 'raff')).toHaveLength(2);
  });

  it('ETA 16 Nov moves Install windows to 16 Nov, finish to Fri 12 Mar 2027, slip +14, $9,000', () => {
    const b = bundleFor(PARK_RD);
    const moved = forecastJob({ ...b, shipments: b.shipments.map((s) => ({ ...s, eta: '2026-11-16' })) });
    expect(moved.steps['pr-install-windows'].forecastStart).toBe('2026-11-16');
    expect(moved.forecastFinish).toBe('2027-03-12');
    expect(moved.slipDays).toBe(14);
    expect(moved.slipCost).toBe(9000);
    expect(moved.lateDays).toBe(14);
    // rule 1: the windows still look late, needed-by does not chase the step
    const windows = moved.items['it-pr-windows'];
    expect(windows.neededBy).toBe('2026-11-02');
    expect(windows.lateDays).toBe(14);
    expect(windows.lateText).toBe('14 days late');
    for (const id of ['it-pr-sliding-doors', 'it-pr-glazing-cert']) {
      expect(moved.items[id].neededBy).toBe('2026-11-02');
      expect(moved.items[id].isLate).toBe(true);
    }
    expect(moved.steps['pr-install-windows'].reason).toBe(
      'Starts 16 Nov, not 2 Nov, because the Park Rd windows shipment is expected 16 Nov.',
    );
  });

  it('previewEtaChange reports the same numbers without mutating anything', () => {
    const b = bundleFor(PARK_RD);
    const before = JSON.stringify(b);
    const p = previewEtaChange(b, 'sh-park-windows', '2026-11-16');
    expect(JSON.stringify(b)).toBe(before);
    expect(p.linkedItemIds).toHaveLength(3);
    expect(p.finishBefore).toBe('2027-02-26');
    expect(p.finishAfter).toBe('2027-03-12');
    expect(p.deltaDays).toBe(14);
    expect(p.costDelta).toBe(9000);
    expect(p.slipDaysAfter).toBe(14);
    expect(p.slipCostAfter).toBe(9000);
    const iw = p.movedSteps.find((s) => s.stepId === 'pr-install-windows')!;
    expect(iw.from).toBe('2026-11-02');
    expect(iw.to).toBe('2026-11-16');
  });

  it('explains why it moved: cause, step, stages, finish', () => {
    const b = bundleFor(PARK_RD);
    const activity = [
      ...b.activity!,
      {
        id: 'act-test',
        sideId: 'side-nd',
        kind: 'eta_changed' as const,
        at: '2026-09-15T15:10',
        personId: 'dominic',
        jobId: PARK_RD,
        shipmentId: 'sh-park-windows',
        from: '2026-10-26',
        to: '2026-11-16',
        text: 'Park Rd windows ETA changed 26 Oct to 16 Nov',
      },
    ];
    const moved = forecastJob({ ...b, activity, shipments: b.shipments.map((s) => ({ ...s, eta: '2026-11-16' })) });
    const kinds = moved.whyItMoved.map((w) => w.kind);
    expect(kinds[0]).toBe('cause');
    expect(kinds[1]).toBe('step');
    expect(kinds[kinds.length - 1]).toBe('finish');
    expect(moved.whyItMoved[0].text).toBe('Park Rd windows ETA changed 26 Oct to 16 Nov (Dominic, Tue 3:10pm)');
    expect(moved.whyItMoved[1].text).toBe('Install windows starts 16 Nov, not 2 Nov (+14 days)');
    const stageLines = moved.whyItMoved.filter((w) => w.kind === 'stage').map((w) => w.text);
    expect(stageLines).toContain('Lock-up ends 4 Dec, not 20 Nov (+14 days)');
    expect(stageLines).toContain('Handover ends 12 Mar, not 26 Feb (+14 days)');
    expect(moved.whyItMoved[moved.whyItMoved.length - 1].text).toBe("Finish 12 Mar, 14 days later than Monday's snapshot (26 Feb)");
    expect(moved.whyItMovedSincePlan[moved.whyItMovedSincePlan.length - 1].text).toBe('Finish 12 Mar, 14 days later than planned (26 Feb)');
  });

  it('Book plasterer acts by Fri 18 Sep and the tile choice is overdue for Dom', () => {
    expect(f.items['it-pr-plasterer'].neededBy).toBe('2026-12-11');
    expect(f.items['it-pr-plasterer'].actBy).toBe('2026-09-18');
    const tile = f.items['it-pr-tile-choice'];
    expect(tile.neededBy).toBe('2026-09-14');
    expect(tile.isLate).toBe(true);
    expect(tile.lateText).toBe('3 days late');
  });

  it('has about 30 items across every item type', () => {
    const items = seed.items.filter((i) => i.jobId === PARK_RD);
    expect(items.length).toBeGreaterThanOrEqual(30);
    const types = new Set(items.map((i) => i.type));
    for (const t of [
      'trade',
      'material',
      'decision',
      'consultant_report',
      'council_request',
      'inspection',
      'defect',
      'condition_of_consent',
      'manual_reminder',
    ]) {
      expect(types.has(t as never)).toBe(true);
    }
  });

  it('topWaitingOn puts late items first', () => {
    const rows = topWaitingOn(f, seed.items.filter((i) => i.jobId === PARK_RD));
    expect(rows).toHaveLength(3);
    expect(rows[0].itemId).toBe('it-pr-tile-choice');
    expect(rows[0].isLate).toBe(true);
  });
});

describe('Seaview St', () => {
  const f = forecastJob(bundleFor(SEAVIEW));

  it('finishes Fri 29 Oct 2027 with slip 0 and was confirmed 1 day ago', () => {
    // SPEC says 30 Oct 2027, which is a Saturday. Steps end on working days, so the
    // nearest the calculator can land is Fri 29 Oct 2027. Logged in PROGRESS.md.
    expect(f.forecastFinish).toBe('2027-10-29');
    expect(f.slipDays).toBe(0);
    expect(f.slipCost).toBe(0);
    expect(f.freshness.daysUnconfirmed).toBe(1);
    expect(f.freshness.amber).toBe(false);
    expect(f.currentStageName).toBe('Slab');
  });

  it('Book concrete pump acts by Fri 18 Sep', () => {
    const pump = f.items['it-sv-pump'];
    expect(pump.neededBy).toBe('2026-10-02');
    expect(pump.actBy).toBe('2026-09-18');
  });

  it('slab inspection is a hold point on Mon 28 Sep with 1 of 3 required categories filled', () => {
    const step = f.steps['sv-slab-insp'];
    expect(step.isHoldPoint).toBe(true);
    expect(step.forecastStart).toBe('2026-09-28');
    const hp = f.nextHoldPoint!;
    expect(hp.stepId).toBe('sv-slab-insp');
    expect(hp.required).toHaveLength(3);
    expect(hp.required.filter((r) => r.uploadedCount > 0)).toHaveLength(1);
    expect(hp.required.find((r) => r.name === 'Steel reinforcement in place')!.uploadedCount).toBe(4);
    expect(hp.missingCategories).toEqual(['Plumbing under slab', 'Membrane and termite barrier']);
    expect(hp.ok).toBe(false);
  });

  it('rule 6: the refusal names the empty categories, and passes once each has a photo', () => {
    const step = seed.steps.find((s) => s.id === 'sv-slab-insp')!;
    const cats = seed.photoCategories.filter((c) => c.jobId === SEAVIEW);
    const check = holdPointCheck(step, cats, seed.photos);
    expect(holdPointRefusalText(check)).toBe(
      "Can't tick this off yet. The certifier needs before-cover photos and 2 categories are empty: Plumbing under slab; Membrane and termite barrier.",
    );
    const extra = ['sv-pc-slab-plumbing', 'sv-pc-slab-membrane'].map((categoryId, i) => ({
      ...seed.photos[0],
      id: `test-${i}`,
      categoryId,
      jobId: SEAVIEW,
      stageId: 'sv-st-slab',
    }));
    const ok = holdPointCheck(step, cats, [...seed.photos, ...extra]);
    expect(ok.ok).toBe(true);
    expect(ok.missingCategories).toEqual([]);
  });
});

describe('Beatty St', () => {
  const f = forecastJob(bundleFor(BEATTY));

  it('finishes Fri 4 Dec 2026, slip +5 days, $1,430, tiler expected 5 Oct, amber after 9 days', () => {
    expect(f.forecastFinish).toBe('2026-12-04');
    expect(f.plannedFinish).toBe('2026-11-27');
    expect(f.slipDays).toBe(5);
    expect(f.slipCost).toBe(1430);
    const tiler = f.items['it-bt-tiler'];
    expect(tiler.expected).toBe('2026-10-05');
    expect(tiler.neededBy).toBe('2026-09-28');
    expect(tiler.isLate).toBe(true);
    expect(tiler.lateText).toBe('7 days late');
    expect(f.freshness.daysUnconfirmed).toBe(9);
    expect(f.freshness.amber).toBe(true);
    expect(f.freshness.text).toBe('Last confirmed 9 days ago');
  });

  it('rule 7: amber only after 7 days', () => {
    expect(forecastJob(bundleFor(BEATTY, '2026-09-15')).freshness.amber).toBe(false); // 7 days
    expect(forecastJob(bundleFor(BEATTY, '2026-09-16')).freshness.amber).toBe(true); // 8 days
  });

  it('why it moved names the tiler and labels both finish figures', () => {
    expect(f.whyItMoved[0].kind).toBe('cause');
    expect(f.whyItMoved[0].text).toBe('Book tiler expected 5 Oct, needed 28 Sep');
    expect(f.whyItMoved[1].text).toBe('Tiling, whole stage starts 5 Oct, not 28 Sep (+7 days)');
    // Two figures, each labelled: never a bare "+7 days".
    const finishLines = f.whyItMoved.filter((w) => w.kind === 'finish').map((w) => w.text);
    expect(finishLines).toEqual(['Finish 4 Dec, 7 days later than planned (27 Nov)', "Finish 4 Dec, 5 days later than Monday's snapshot (29 Nov)"]);
    expect(f.whyItMoved.every((w) => !/\(\+\d+ days\)$/.test(w.text) || w.kind !== 'finish')).toBe(true);
  });
});

describe('Design jobs (rule 9)', () => {
  const expected: Record<string, { stage: string; outstanding: number; oldest: number | null }> = {
    'west-st': { stage: 'With council', outstanding: 2, oldest: 23 },
    tollbar: { stage: 'With council', outstanding: 1, oldest: 8 },
    'lower-beach': { stage: 'Design', outstanding: 0, oldest: null },
    'john-st': { stage: 'Design', outstanding: 1, oldest: 4 },
  };
  for (const [jobId, exp] of Object.entries(expected)) {
    it(`${jobId}: ${exp.stage}, ${exp.outstanding} outstanding, oldest ${exp.oldest ?? 'none'}`, () => {
      const f = forecastJob(bundleFor(jobId));
      expect(f.kind).toBe('design');
      expect(f.forecastFinish).toBeUndefined();
      expect(Object.keys(f.steps)).toHaveLength(0);
      expect(f.checklist!.currentStageName).toBe(exp.stage);
      expect(f.checklist!.outstanding).toBe(exp.outstanding);
      expect(f.checklist!.oldestDays).toBe(exp.oldest);
    });
  }
});

describe('the rest of the mock data', () => {
  it('holding costs and the windows lead time match SPEC', () => {
    expect(seed.jobs.find((j) => j.id === PARK_RD)!.weeklyHoldingCost).toBe(4500);
    expect(seed.jobs.find((j) => j.id === SEAVIEW)!.weeklyHoldingCost).toBe(3800);
    expect(seed.jobs.find((j) => j.id === BEATTY)!.weeklyHoldingCost).toBe(2000);
    expect(seed.requirements.find((r) => r.id === 'pr-rq-windows')!.leadTimeWeeks).toBe(12);
    expect(seed.items.find((i) => i.id === 'it-pr-windows')!.leadTimeWeeks).toBe(12);
  });

  it('every trade has a phone number', () => {
    expect(seed.trades.length).toBeGreaterThan(0);
    for (const t of seed.trades) expect(t.phone).toMatch(/^\d{4} \d{3} \d{3}$/);
  });

  it('has a week of daily notes on Park Rd', () => {
    const notes = seed.dailyNotes.filter((n) => n.jobId === PARK_RD);
    expect(notes.length).toBeGreaterThanOrEqual(5);
    const dates = notes.map((n) => n.date).sort();
    expect(dates[0]).toBe('2026-09-10');
    expect(dates[dates.length - 1]).toBe('2026-09-17');
  });

  it('has placeholder photos as data URLs, none from stock', () => {
    expect(seed.photos.length).toBeGreaterThan(10);
    for (const p of seed.photos) expect(p.dataUrl.startsWith('data:image/svg+xml')).toBe(true);
  });

  it('the Norm side is empty', () => {
    expect(seed.sides.map((s) => s.id)).toContain(SIDE_NORM);
    expect(seed.jobs.filter((j) => j.sideId === SIDE_NORM)).toHaveLength(0);
    expect(seed.items.filter((i) => i.sideId === SIDE_NORM)).toHaveLength(0);
    expect(seed.trades.filter((t) => t.sideId === SIDE_NORM)).toHaveLength(0);
  });

  it('the duplex template has no dates and the same steps as Park Rd', () => {
    const tplSteps = seed.steps.filter((s) => s.jobId === 'tpl-duplex');
    expect(tplSteps.length).toBe(seed.steps.filter((s) => s.jobId === PARK_RD).length);
    expect(tplSteps.every((s) => !s.plannedStart && !s.plannedEnd && s.status === 'not_started')).toBe(true);
    expect(seed.jobs.find((j) => j.id === 'tpl-duplex')!.isTemplate).toBe(true);
  });

  it('people and memberships: Dominic admin, Dom and Norm partners, Raff builder, Alec site', () => {
    const role = (p: string) => seed.memberships.find((m) => m.personId === p && m.sideId === 'side-nd')!.role;
    expect(role('dominic')).toBe('admin');
    expect(role('dom')).toBe('partner');
    expect(role('norm')).toBe('partner');
    expect(role('raff')).toBe('builder');
    expect(role('alec')).toBe('site');
    expect(seed.memberships.filter((m) => m.sideId === SIDE_NORM).map((m) => m.personId).sort()).toEqual(['dominic', 'norm']);
  });
});
