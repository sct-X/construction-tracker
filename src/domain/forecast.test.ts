/**
 * The rules, on a hand-built job. No seed, no data layer: this file must stay
 * as pure as the calculator. SPEC's mock-data numbers are asserted in
 * src/seed/seed.test.ts; the data layer in src/data/mockApi.test.ts.
 */
import { describe, expect, it } from 'vitest';
import type { ForecastBundle } from './forecast';
import { forecastJob, holdPointCheck, holdPointRefusalText, previewEtaChange } from './forecast';
import type { Item, Job, Photo, PhotoCategory, Stage, Step, StepLink } from './types';
import {
  addCalendarWeeks,
  addWorkingDays,
  calendarDaysBetween,
  formatLong,
  formatShort,
  isWorkingDay,
  lastMonday,
  stepEnd,
  workingDaysBetween,
} from './dates';
import { MONEY_FIELDS, slipCostFor, stripMoney } from './money';

describe('working days (rule 5)', () => {
  it('skips weekends', () => {
    expect(addWorkingDays('2026-09-17', 1)).toBe('2026-09-18'); // Thu -> Fri
    expect(addWorkingDays('2026-09-18', 1)).toBe('2026-09-21'); // Fri -> Mon
    expect(addWorkingDays('2026-09-19', 0)).toBe('2026-09-21'); // Sat snaps to Mon
  });
  it('skips the shutdown 21 Dec 2026 to 8 Jan 2027 inclusive', () => {
    expect(isWorkingDay('2026-12-18')).toBe(true);
    expect(isWorkingDay('2026-12-21')).toBe(false);
    expect(isWorkingDay('2027-01-08')).toBe(false);
    expect(isWorkingDay('2027-01-11')).toBe(true);
    expect(addWorkingDays('2026-12-18', 1)).toBe('2027-01-11');
    expect(stepEnd('2026-12-11', 8)).toBe('2027-01-12'); // Park Rd plasterboard
    expect(workingDaysBetween('2026-12-14', '2027-01-15')).toBe(10);
  });
  it('lead times are calendar weeks', () => {
    expect(addCalendarWeeks('2026-11-02', -12)).toBe('2026-08-10');
    expect(calendarDaysBetween('2027-02-26', '2027-03-12')).toBe(14);
  });
  it('finds last Monday and formats dates', () => {
    expect(lastMonday('2026-09-17')).toBe('2026-09-14');
    expect(lastMonday('2026-09-14')).toBe('2026-09-14');
    expect(lastMonday('2026-09-20')).toBe('2026-09-14');
    expect(formatLong('2027-02-26')).toBe('Fri 26 Feb 2027');
    expect(formatShort('2026-11-02')).toBe('Mon 2 Nov');
  });
});


/** A two-stage job: Frame (done) then Lock-up with "Install windows" (10d, Mon 2 Nov) and "External doors" (5d). */
function tinyJob(opts: { eta?: string; today?: string; lastConfirmed?: string } = {}): ForecastBundle {
  const side = 's';
  const job: Job = { id: 'j', sideId: side, name: 'Tiny', kind: 'build', weeklyHoldingCost: 4500, lastConfirmed: opts.lastConfirmed ?? '2026-09-15', isTemplate: false, createdAt: '2026-06-01' };
  const stages: Stage[] = [
    { id: 'frame', sideId: side, jobId: 'j', name: 'Frame', order: 1, status: 'done' },
    { id: 'lockup', sideId: side, jobId: 'j', name: 'Lock-up', order: 2, status: 'not_started' },
  ];
  const steps: Step[] = [
    { id: 'frame-1', sideId: side, jobId: 'j', stageId: 'frame', name: 'Frame', order: 1, durationDays: 5, plannedStart: '2026-10-19', plannedEnd: '2026-10-23', status: 'done', isHoldPoint: false },
    { id: 'frame-insp', sideId: side, jobId: 'j', stageId: 'frame', name: 'Frame inspection', order: 2, durationDays: 1, plannedStart: '2026-10-26', plannedEnd: '2026-10-26', status: 'not_started', isHoldPoint: true },
    { id: 'windows', sideId: side, jobId: 'j', stageId: 'lockup', name: 'Install windows', order: 1, durationDays: 10, plannedStart: '2026-11-02', plannedEnd: '2026-11-13', status: 'not_started', isHoldPoint: false },
    { id: 'doors', sideId: side, jobId: 'j', stageId: 'lockup', name: 'External doors', order: 2, durationDays: 5, plannedStart: '2026-11-16', plannedEnd: '2026-11-20', status: 'not_started', isHoldPoint: false },
  ];
  const links: StepLink[] = [
    { id: 'l1', sideId: side, jobId: 'j', stepId: 'windows', waitsForStepId: 'frame-insp' },
    { id: 'l2', sideId: side, jobId: 'j', stepId: 'doors', waitsForStepId: 'windows' },
  ];
  const items: Item[] = [
    { id: 'win', sideId: side, jobId: 'j', type: 'material', title: 'Windows', ownerId: 'raff', stepId: 'windows', shipmentId: 'sh', leadTimeWeeks: 12, status: 'booked', createdAt: '2026-07-20' },
    { id: 'sliders', sideId: side, jobId: 'j', type: 'material', title: 'Sliding doors', ownerId: 'raff', stepId: 'windows', shipmentId: 'sh', leadTimeWeeks: 12, status: 'booked', createdAt: '2026-07-20' },
    { id: 'installer', sideId: side, jobId: 'j', type: 'trade', title: 'Book window installers', ownerId: 'raff', stepId: 'windows', leadTimeWeeks: 3, status: 'to_do', createdAt: '2026-08-10' },
  ];
  const photoCategories: PhotoCategory[] = [
    { id: 'c-brace', sideId: side, jobId: 'j', stageId: 'frame', name: 'Frame bracing', requiredForHoldPoint: true, order: 1 },
    { id: 'c-tie', sideId: side, jobId: 'j', stageId: 'frame', name: 'Tie-downs', requiredForHoldPoint: true, order: 2 },
    { id: 'c-general', sideId: side, jobId: 'j', stageId: null, name: 'General', requiredForHoldPoint: false, order: 3 },
  ];
  const photos: Photo[] = [
    { id: 'p1', sideId: side, jobId: 'j', stageId: 'frame', categoryId: 'c-brace', uploadedById: 'alec', uploadedAt: '2026-10-23T14:00', takenOn: '2026-10-23', dataUrl: 'data:image/svg+xml;utf8,<svg/>' },
  ];
  return {
    job,
    stages,
    steps,
    links,
    requirements: [],
    items,
    shipments: [{ id: 'sh', sideId: side, jobId: 'j', name: 'Tiny windows', status: 'in_production', eta: opts.eta ?? '2026-10-26' }],
    snapshots: [{ id: 'snap', sideId: side, jobId: 'j', date: '2026-09-14', forecastFinish: '2026-11-20' }],
    photoCategories,
    photos,
    today: opts.today ?? '2026-09-17',
  };
}

describe('rules 1 to 4 on a hand-built job', () => {
  it('rule 2 and 3: an early shipment moves nothing; finish is the latest step end', () => {
    const f = forecastJob(tinyJob());
    expect(f.steps.windows.forecastStart).toBe('2026-11-02');
    expect(f.steps.windows.reason).toBe('Starts 2 Nov as planned.');
    expect(f.forecastFinish).toBe('2026-11-20');
    expect(f.slipDays).toBe(0);
    expect(f.slipCost).toBe(0);
    expect(f.whyItMoved).toEqual([]);
  });

  it('rule 1: needed-by ignores the item and its shipment-mates, so a late item still shows late', () => {
    const f = forecastJob(tinyJob({ eta: '2026-11-16' }));
    expect(f.steps.windows.forecastStart).toBe('2026-11-16');
    expect(f.steps.doors.forecastStart).toBe('2026-11-30');
    for (const id of ['win', 'sliders']) {
      expect(f.items[id].neededBy).toBe('2026-11-02');
      expect(f.items[id].actBy).toBe('2026-08-10');
      expect(f.items[id].lateDays).toBe(14);
      expect(f.items[id].lateText).toBe('14 days late');
    }
    // the installer booking is needed when the step can actually start
    expect(f.items.installer.neededBy).toBe('2026-11-16');
    expect(f.items.installer.actBy).toBe('2026-10-26');
  });

  it('rule 4: slip is calendar days against last Monday and cost rounds to $10', () => {
    const f = forecastJob(tinyJob({ eta: '2026-11-16' }));
    expect(f.forecastFinish).toBe('2026-12-04');
    expect(f.slipDays).toBe(14);
    expect(f.slipCost).toBe(9000);
    expect(f.whyItMoved.map((w) => w.text)).toEqual([
      'Tiny windows expected 16 Nov, needed 2 Nov',
      'Install windows starts 16 Nov, not 2 Nov (+14 days)',
      'Lock-up ends 4 Dec, not 20 Nov (+14 days)',
      'Finish 4 Dec, 14 days later than planned (20 Nov)',
      "Finish 4 Dec, 14 days later than Monday's snapshot (20 Nov)",
    ]);
    expect(slipCostFor(5, 2000)).toBe(1430);
    expect(slipCostFor(0, 3800)).toBe(0);
    expect(slipCostFor(5, undefined)).toBeUndefined();
  });

  it('previewEtaChange gives the delta without mutating the bundle', () => {
    const b = tinyJob();
    const before = JSON.stringify(b);
    const p = previewEtaChange(b, 'sh', '2026-11-16');
    expect(JSON.stringify(b)).toBe(before);
    expect(p.linkedItemIds).toEqual(['win', 'sliders']);
    expect(p.finishBefore).toBe('2026-11-20');
    expect(p.finishAfter).toBe('2026-12-04');
    expect(p.deltaDays).toBe(14);
    expect(p.costDelta).toBe(9000);
    expect(p.movedSteps.map((s) => s.stepId)).toEqual(['windows', 'doors']);
  });

  it('a delay across the shutdown skips it', () => {
    const b = tinyJob({ eta: '2026-12-14' });
    const f = forecastJob(b);
    expect(f.steps.windows.forecastStart).toBe('2026-12-14');
    expect(f.steps.windows.forecastEnd).toBe('2027-01-15'); // 5 days before, 5 after the shutdown
  });
});

describe('rule 6: hold points', () => {
  it('refuses while a required category is empty and names it', () => {
    const b = tinyJob();
    const step = b.steps.find((s) => s.id === 'frame-insp')!;
    const check = holdPointCheck(step, b.photoCategories!, b.photos!);
    expect(check.ok).toBe(false);
    expect(check.required.map((r) => r.uploadedCount)).toEqual([1, 0]);
    expect(check.missingCategories).toEqual(['Tie-downs']);
    expect(holdPointRefusalText(check)).toBe("Can't tick this off yet. The certifier needs before-cover photos and 1 category is empty: Tie-downs.");
    const ok = holdPointCheck(step, b.photoCategories!, [...b.photos!, { ...b.photos![0], id: 'p2', categoryId: 'c-tie' }]);
    expect(ok.ok).toBe(true);
    expect(forecastJob(b).nextHoldPoint!.stepId).toBe('frame-insp');
  });
});

describe('rule 7: freshness', () => {
  it('goes amber after 7 days unconfirmed', () => {
    expect(forecastJob(tinyJob({ lastConfirmed: '2026-09-10' })).freshness).toMatchObject({ daysUnconfirmed: 7, amber: false, text: 'Last confirmed 7 days ago' });
    expect(forecastJob(tinyJob({ lastConfirmed: '2026-09-09' })).freshness).toMatchObject({ daysUnconfirmed: 8, amber: true });
    expect(forecastJob(tinyJob({ lastConfirmed: '2026-09-17' })).freshness.text).toBe('Last confirmed today');
  });
});

describe('rule 9: design jobs', () => {
  it('has no steps or finish, and counts outstanding items by age', () => {
    const b = tinyJob();
    const f = forecastJob({
      ...b,
      job: { ...b.job, kind: 'design', path: 'DA' },
      stages: [
        { id: 'd1', sideId: 's', jobId: 'j', name: 'Design', order: 1, status: 'done' },
        { id: 'd2', sideId: 's', jobId: 'j', name: 'Pending approval', order: 2, status: 'in_progress' },
      ],
      steps: [],
      links: [],
      items: [
        { id: 'a', sideId: 's', jobId: 'j', type: 'consultant_report', title: 'Traffic report', status: 'to_do', createdAt: '2026-08-25' },
        { id: 'b', sideId: 's', jobId: 'j', type: 'council_request', title: 'RFI', status: 'to_do', createdAt: '2026-09-03' },
        { id: 'c', sideId: 's', jobId: 'j', type: 'council_request', title: 'Lodge DA', status: 'done', createdAt: '2026-07-01' },
      ],
    });
    expect(f.kind).toBe('design');
    expect(f.forecastFinish).toBeUndefined();
    expect(f.checklist).toMatchObject({ currentStageName: 'Pending approval', outstanding: 2, oldestDays: 23 });
    expect(f.checklist!.outstandingItems[0].title).toBe('Traffic report');
  });
});

describe('money (rule 4 and the site role)', () => {
  it('rounds slip cost to the nearest $10', () => {
    expect(slipCostFor(14, 4500)).toBe(9000);
    expect(slipCostFor(5, 2000)).toBe(1430);
    expect(slipCostFor(0, 3800)).toBe(0);
    expect(slipCostFor(5, undefined)).toBeUndefined();
  });

  it('stripMoney deletes every money field recursively', () => {
    const stripped = stripMoney({ a: { weeklyHoldingCost: 1, list: [{ slipCost: 2, keep: 3 }] }, costDelta: 4 });
    expect(stripped).toEqual({ a: { list: [{ keep: 3 }] } });
    expect(MONEY_FIELDS).toContain('weeklyHoldingCost');
    expect(MONEY_FIELDS).toContain('slipCost');
  });

});

