/**
 * Stage 6a read models (timing first): overview(), the job first page's new
 * fields, the three-group waiting-on list, and the words helpers. Seed, today
 * Thu 17 Sep 2026.
 */
import { describe, expect, it } from 'vitest';
import {
  buildSeed,
  DEFAULT_TODAY,
  freshnessWords,
  jobOverview,
  overview,
  stageDisplayName,
  stagePositionWords,
  waitingKeyDate,
  waitingOn,
  LocalDashboardApi,
  InMemoryStore,
  fixedClock,
} from '../src/index.js';

const ds = buildSeed();
const today = DEFAULT_TODAY;

describe('overview()', () => {
  const v = overview(ds, today);
  const row = (id: string) => [...v.builds, ...v.design].find((r) => r.jobId === id)!;

  it('builds in the side order, design jobs by oldest outstanding first', () => {
    expect(v.builds.map((r) => r.name)).toEqual(['Park Rd', 'Seaview St', 'Beatty St']);
    expect(v.design.map((r) => [r.name, r.oldestDays])).toEqual([
      ['West St', 23],
      ['Tollbar Ave', 8],
      ['John St', 4],
      ['Lower Beach St', null],
    ]);
  });

  it('Park Rd: stage, the next three not-done steps with dates (under way first), top three waiting-on overdue first', () => {
    const p = row('park-rd');
    expect([p.stageLabel, p.stagePosition, p.overdue]).toEqual(['Lock-up', 'Stage 5 of 8', 4]);
    expect(p.nextSteps.map((s) => [s.name, s.start, s.underWay])).toEqual([
      ['Roof plumbing', '2026-09-14', true],
      ['External cladding', '2026-09-16', true],
      ['Stormwater drainage', '2026-09-21', false],
    ]);
    expect(p.waitingOn.map((w) => [w.title, w.overdue])).toEqual([
      ['Glazing energy compliance certificate', true],
      ['Tile choice', true],
      ['Book cladders', true],
    ]);
    expect(p.freshnessWords).toBe('Last confirmed 2 days ago');
    // Timing first: the row carries no finish, slip or money.
    expect(Object.keys(p).some((k) => /finish|slip|cost/i.test(k))).toBe(false);
  });

  it('Seaview St: the slab hold point among the next steps, 1 of 3 photo sets', () => {
    const s = row('seaview');
    expect(s.nextSteps.map((x) => x.name)).toContain('Slab inspection before pour');
    expect(s.nextHoldPoint).toMatchObject({ stepName: 'Slab inspection before pour', date: '2026-09-28', filled: 1, required: 3 });
    expect(s.waitingOn[0]!.title).toBe('Order slab steel');
    expect(s.waitingOn[1]!.title).toBe('Book concrete pump');
  });

  it('Beatty St: unconfirmed for 9 days, in words; nothing overdue', () => {
    const b = row('beatty');
    expect([b.unconfirmed, b.freshnessWords, b.overdue]).toEqual([true, 'Not confirmed for 9 days', 0]);
  });

  it('design: With council reads Pending approval, no steps, outstanding counts', () => {
    const w = row('west-st');
    expect([w.currentStageName, w.stageLabel, w.outstanding, w.nextSteps.length]).toEqual(['With council', 'Pending approval', 2, 0]);
    expect(row('lower-beach').outstanding).toBe(0);
  });

  it('a side filter keeps to that side; the Norm side has no jobs', () => {
    const norm = ds.sides.find((s) => s.name === 'Norm')!;
    expect(overview(ds, today, { sideId: norm.id })).toEqual({ today, builds: [], design: [] });
  });

  it('is on DashboardApi as getOverview', async () => {
    const api = new LocalDashboardApi(new InMemoryStore(buildSeed()), fixedClock(today));
    expect((await api.getOverview()).builds).toHaveLength(3);
  });
});

describe('job first page fields', () => {
  it('Park Rd: four overdue, longest first; trades on this week from today to a week out', () => {
    const o = jobOverview(ds, 'park-rd', today);
    expect(o.overdue.map((r) => r.title)).toEqual(['Glazing energy compliance certificate', 'Tile choice', 'Book cladders', 'Order cladding']);
    expect(o.tradesThisWeek.map((t) => [t.stepName, t.when])).toEqual([
      ['Roof plumbing', 'On site, until Thu 17 Sep'],
      ['External cladding', 'On site, until Tue 6 Oct'],
      ['Stormwater drainage', 'Mon 21 Sep, in 4 days'],
    ]);
    expect([o.stageLabel, o.stagePosition, o.freshnessWords]).toEqual(['Lock-up', 'Stage 5 of 8', 'Last confirmed 2 days ago']);
  });
});

describe('waiting on, three groups', () => {
  it('Overdue is exactly isOverdue; This week by key date before next Monday; the rest Later', () => {
    const v = waitingOn(ds, today);
    expect(v.groups.map((g) => [g.key, g.rows.length])).toEqual([
      ['overdue', 5],
      ['this_week', 3],
      ['later', 39],
    ]);
    expect(v.groups[0]!.rows.every((r) => r.overdue)).toBe(true);
    expect(v.groups[1]!.rows.map((r) => r.title)).toEqual(expect.arrayContaining(['Book concrete pump', 'Book plasterer']));
    expect(v.total).toBe(47);
  });

  it('the key date is the act-by while to do, then the expected (or needed-by) date', () => {
    expect(waitingKeyDate({ status: 'to_do', actBy: '2026-09-18', expected: null, neededBy: '2026-10-02' })).toBe('2026-09-18');
    expect(waitingKeyDate({ status: 'ordered_or_booked', actBy: '2026-09-07', expected: '2026-10-05', neededBy: '2026-09-28' })).toBe('2026-10-05');
    expect(waitingKeyDate({ status: 'confirmed', actBy: '2026-09-07', expected: null, neededBy: '2026-09-28' })).toBe('2026-09-28');
  });
});

describe('words', () => {
  it('freshness, stage names and position', () => {
    expect(freshnessWords({ daysUnconfirmed: 9, amber: true, text: 'Last confirmed 9 days ago' })).toBe('Not confirmed for 9 days');
    expect(freshnessWords({ daysUnconfirmed: null, amber: true, text: 'Never confirmed' })).toBe('Never confirmed');
    expect(freshnessWords({ daysUnconfirmed: 2, amber: false, text: 'Last confirmed 2 days ago' })).toBe('Last confirmed 2 days ago');
    expect(stageDisplayName('With certifier')).toBe('Pending approval');
    expect(stageDisplayName('Lock-up')).toBe('Lock-up');
    expect(stagePositionWords([{ stageId: 'a', status: 'done' }, { stageId: 'b', status: 'done' }], null)).toBe('All 2 stages done');
  });
});
