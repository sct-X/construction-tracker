/**
 * Stage 6c: the program screens' words (v1 Gantt, look-ahead, stages list, step
 * detail) and Dom's overdue rule for steps and stages. Seed, today Thu 17 Sep 2026.
 */
import { describe, expect, it } from 'vitest';
import {
  buildSeed,
  DEFAULT_TODAY,
  holdPointReadinessWords,
  isStageOverdue,
  isStepOverdue,
  leadTimeWords,
  lengthWords,
  lookAhead,
  programView,
  stageProgressWords,
  stageTimeThrough,
  stepDetail,
  stepWhenWords,
  weekRangeWords,
  workStatusWords,
} from '../src/index.js';

const ds = buildSeed();
const today = DEFAULT_TODAY;
const step = (jobId: string, id: string, t = today) => programView(ds, jobId, t).steps.find((s) => s.stepId === id)!;

describe('overdue steps and stages (red only once past their own planned date)', () => {
  it('Beatty tiling is 7 days late but both dates are ahead on 17 Sep: plain words, not overdue', () => {
    const s = step('beatty', 'bt-tiling');
    expect(s.lateDays).toBe(7);
    expect(isStepOverdue(s, today)).toBe(false);
  });

  it('on Wed 30 Sep tiling has not started and its planned start (Mon 28 Sep) has gone: overdue', () => {
    const t = '2026-09-30';
    const s = step('beatty', 'bt-tiling', t);
    expect(s.status).toBe('not_started');
    expect(isStepOverdue(s, t)).toBe(true);
  });

  it('done or on plan is never overdue; a stage is overdue once its planned end has passed', () => {
    expect(isStepOverdue({ status: 'done', plannedStart: '2026-01-01', plannedEnd: '2026-01-02', lateDays: 9 }, today)).toBe(false);
    expect(isStepOverdue({ status: 'in_progress', plannedStart: '2026-09-01', plannedEnd: '2026-09-10', lateDays: 0 }, today)).toBe(false);
    expect(isStepOverdue({ status: 'in_progress', plannedStart: '2026-09-01', plannedEnd: '2026-09-10', lateDays: 4 }, today)).toBe(true);
    const tiling = programView(ds, 'beatty', today).stages.find((s) => s.stageId === 'bt-st-tiling')!;
    expect(isStageOverdue(tiling, today)).toBe(false);
    expect(isStageOverdue({ ...tiling, plannedEnd: '2026-09-16' }, today)).toBe(true);
  });
});

describe('lookAhead()', () => {
  it('Park Rd: this week, next week, week after, then later folded (v1 words)', () => {
    const v = lookAhead(programView(ds, 'park-rd', today).steps, today);
    expect(v.weeks.map((w) => [w.title, w.range])).toEqual([
      ['This week', '14-18 Sep'],
      ['Next week', '21-25 Sep'],
      ['Week after', '28 Sep-2 Oct'],
    ]);
    expect(v.weeks[0]!.rows.map((r) => [r.step.stepId, r.line])).toEqual([
      ['pr-roof-plumbing', 'Mon to Thu, Roof plumber, started'],
      ['pr-cladding', 'From Wed, 3 wks, Cladder'],
    ]);
    expect(v.weeks[1]!.rows.map((r) => r.line)).toEqual(['From Mon, 3 wks, Plumber']);
    expect(v.weeks[2]!.rows).toEqual([]);
    expect(v.horizonWords).toBe('Sun 4 Oct');
    expect(v.laterLate).toEqual([]);
    expect(v.laterRest).toHaveLength(14);
  });

  it('Beatty: under way steps that finish next week, and the late ones further out in plain words', () => {
    const v = lookAhead(programView(ds, 'beatty', today).steps, today);
    expect(v.weeks[1]!.rows.map((r) => [r.step.stepId, r.mode, r.line])).toEqual([['bt-roughin', 'finishes', 'Finishes Fri, Plumber, Electrician, started']]);
    expect(v.laterLate.map((l) => [l.step.stepId, l.text, l.overdue])).toEqual([
      ['bt-tiling', 'moved to Mon 5 Oct, in 2 weeks, 7 days late', false],
      ['bt-finishes', 'moved to Mon 19 Oct, in 4 weeks, 7 days late', false],
      ['bt-handover', 'moved to Mon 30 Nov, in 10 weeks, 7 days late', false],
    ]);
  });

  it('a late step inside the three weeks says planned, now and how late; overdue once past its planned start', () => {
    const t = '2026-09-30';
    const v = lookAhead(programView(ds, 'beatty', t).steps, t);
    const row = v.weeks.flatMap((w) => w.rows).find((r) => r.step.stepId === 'bt-tiling')!;
    expect(row.late).toBe('planned Mon 28 Sep, now Mon 5 Oct, in 5 days, 7 days late');
    expect(row.overdue).toBe(true);
  });
});

describe('words', () => {
  it('stages: status in words and time through', () => {
    const st = programView(ds, 'park-rd', today).stages;
    const by = (id: string) => st.find((s) => s.stageId === id)!;
    expect(stageProgressWords(by('pr-st-roof'), today)).toBe('Done');
    expect(stageProgressWords(by('pr-st-lockup'), today)).toBe('In progress, week 3 of 12');
    expect(stageProgressWords(by('pr-st-external'), today)).toBe('Starts Mon 21 Sep, in 4 days');
    expect(stageTimeThrough(by('pr-st-roof'), today)).toBe(1);
    expect(stageTimeThrough(by('pr-st-external'), today)).toBe(0);
    expect(stageTimeThrough(by('pr-st-lockup'), today)).toBeGreaterThan(0.1);
  });

  it('step detail bits: when, lead times, hold point readiness, status', () => {
    const d = stepDetail(ds, 'pr-install-windows', today);
    expect(stepWhenWords(d.step, today)).toBe('starts in 6 weeks');
    expect(stepWhenWords({ status: 'in_progress', forecastStart: '2026-09-14', forecastEnd: '2026-09-17' }, today)).toBe('ends today');
    expect(leadTimeWords(d.requirements)).toBe('Windows, order 12 wk ahead. Window installer, book 3 wk ahead');
    expect(holdPointReadinessWords(stepDetail(ds, 'sv-slab-insp', today).holdPoint!)).toBe('1 of 3 required photo sets uploaded');
    expect(workStatusWords('in_progress')).toBe('Under way');
    expect([lengthWords(1), lengthWords(5), lengthWords(15)]).toEqual(['1 day', '1 wk', '3 wks']);
    expect(weekRangeWords('2026-09-28')).toBe('28 Sep-2 Oct');
  });
});
