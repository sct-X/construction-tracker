/**
 * Stage 6c: the program screens in v1's words (Gantt, three-week look-ahead,
 * stages list, step detail). Timing only: no finish, slip or money. Dom's red
 * cue: a step or stage is overdue once its own planned date has passed and it
 * still isn't done; forecast later than planned with both dates ahead is
 * plain words ("7 days late"), never red. Pure; reads the calculator output.
 */
import type { StageForecast, StepForecast } from './calculator.js';
import { addCalendarDays, calendarDaysBetween, formatShort, lastMonday, relativeDays, weekday } from './dates.js';
import type { ISODate, StageStatus, StepStatus } from './types.js';

type StepTiming = Pick<StepForecast, 'status' | 'plannedStart' | 'plannedEnd' | 'lateDays'>;

/** Past its own planned date and not done: not started after its planned start, or still open after its planned end. */
export function isStepOverdue(s: StepTiming, today: ISODate): boolean {
  if (s.status === 'done' || s.lateDays <= 0) return false;
  if (s.status === 'not_started' && s.plannedStart && s.plannedStart < today) return true;
  return !!s.plannedEnd && s.plannedEnd < today;
}

/** A stage past its planned end and not done (see isStepOverdue). */
export function isStageOverdue(s: Pick<StageForecast, 'status' | 'plannedEnd' | 'lateDays'>, today: ISODate): boolean {
  return s.status !== 'done' && s.lateDays > 0 && !!s.plannedEnd && s.plannedEnd < today;
}

/** "7 days late", "1 day late". */
export function daysLateWords(days: number): string {
  return `${days} day${days === 1 ? '' : 's'} late`;
}

/** Step and stage status as v1 says it: "Not started", "Under way", "Done". */
export function workStatusWords(status: StepStatus | StageStatus): string {
  return status === 'done' ? 'Done' : status === 'in_progress' ? 'Under way' : 'Not started';
}

/** "starts in 6 weeks", "ends tomorrow", "ended 3 weeks ago": a step's forecast read against today. */
export function stepWhenWords(s: Pick<StepForecast, 'status' | 'forecastStart' | 'forecastEnd'>, today: ISODate): string {
  if (s.status === 'not_started') return `starts ${relativeDays(s.forecastStart, today)}`;
  return `${s.forecastEnd < today ? 'ended' : 'ends'} ${relativeDays(s.forecastEnd, today)}`;
}

/** "3 days", "1 wk", "3 wks": a step's length on a phone line. */
export function lengthWords(days: number): string {
  if (days >= 10) return `${Math.round(days / 5)} wks`;
  if (days >= 5) return '1 wk';
  return `${days} day${days === 1 ? '' : 's'}`;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "14-18 Sep" or "28 Sep-2 Oct": a working week from its Monday. */
export function weekRangeWords(monday: ISODate): string {
  const fri = addCalendarDays(monday, 4);
  const [d1, m1] = [Number(monday.slice(8, 10)), MON[Number(monday.slice(5, 7)) - 1]];
  const [d2, m2] = [Number(fri.slice(8, 10)), MON[Number(fri.slice(5, 7)) - 1]];
  return m1 === m2 ? `${d1}-${d2} ${m1}` : `${d1} ${m1}-${d2} ${m2}`;
}

/** "Mon 21 Sep, in 4 days". */
export function shortWithRelative(iso: ISODate, today: ISODate): string {
  return `${formatShort(iso)}, ${relativeDays(iso, today)}`;
}

// ---------------------------------------------------------------------------
// Three-week look-ahead (v1 LookAhead)
// ---------------------------------------------------------------------------

type LookStep = Pick<
  StepForecast,
  'stepId' | 'status' | 'forecastStart' | 'forecastEnd' | 'plannedStart' | 'plannedEnd' | 'lateDays' | 'durationDays' | 'order'
> & { tradeType?: string | null };

export interface LookAheadRow<S extends LookStep = LookStep> {
  step: S;
  /** Starts this week, or started earlier and finishes this week. */
  mode: 'starts' | 'finishes';
  /** "Mon to Thu, Roof plumber, started" / "From Wed, 3 wks, Cladder" / "Finishes Fri". */
  line: string;
  /** "planned Mon 2 Nov, now Mon 9 Nov, in 7 weeks, 7 days late", or null on plan. */
  late: string | null;
  overdue: boolean;
}

export interface LookAheadWeek<S extends LookStep = LookStep> {
  n: 1 | 2 | 3;
  title: 'This week' | 'Next week' | 'Week after';
  from: ISODate;
  to: ISODate;
  /** "14-18 Sep". */
  range: string;
  rows: LookAheadRow<S>[];
}

export interface LookAheadView<S extends LookStep = LookStep> {
  weeks: LookAheadWeek<S>[];
  /** The Sunday that ends the third week. */
  horizon: ISODate;
  /** "Sun 4 Oct". */
  horizonWords: string;
  /** Starts after the horizon and runs late: "moved to Mon 23 Nov, in 9 weeks, 7 days late". */
  laterLate: { step: S; text: string; overdue: boolean }[];
  /** Starts after the horizon on plan: "Starts Mon 23 Nov, in 9 weeks, 2 wks". */
  laterRest: { step: S; text: string }[];
}

function byStart(a: LookStep, b: LookStep): number {
  return a.forecastStart.localeCompare(b.forecastStart) || a.order - b.order;
}

function stepLine(s: LookStep, w: { to: ISODate }, mode: 'starts' | 'finishes'): string {
  let when: string;
  if (mode === 'finishes') when = `Finishes ${DAY[weekday(s.forecastEnd)]}`;
  else if (s.forecastEnd <= w.to)
    when = s.forecastStart === s.forecastEnd ? DAY[weekday(s.forecastStart)]! : `${DAY[weekday(s.forecastStart)]} to ${DAY[weekday(s.forecastEnd)]}`;
  else when = `From ${DAY[weekday(s.forecastStart)]}, ${lengthWords(s.durationDays)}`;
  const status = s.status === 'done' ? 'done' : s.status === 'in_progress' ? 'started' : '';
  return [when, s.tradeType ?? '', status].filter(Boolean).join(', ');
}

/** The next three weeks from today's Monday: steps that start in each, and steps under way that finish in it. */
export function lookAhead<S extends LookStep>(steps: S[], today: ISODate): LookAheadView<S> {
  const monday = lastMonday(today);
  const all = [...steps].sort(byStart);
  const titles = ['This week', 'Next week', 'Week after'] as const;
  const weeks: LookAheadWeek<S>[] = ([0, 1, 2] as const).map((i) => {
    const from = addCalendarDays(monday, 7 * i);
    const to = addCalendarDays(from, 6);
    const w = { to };
    const starts = all.filter((s) => s.forecastStart >= from && s.forecastStart <= to);
    const finishes = all.filter((s) => s.forecastStart < from && s.forecastEnd >= from && s.forecastEnd <= to);
    const row = (s: S, mode: 'starts' | 'finishes'): LookAheadRow<S> => ({
      step: s,
      mode,
      line: stepLine(s, w, mode),
      late: s.lateDays > 0 ? `planned ${formatShort(s.plannedStart ?? s.forecastStart)}, now ${shortWithRelative(s.forecastStart, today)}, ${daysLateWords(s.lateDays)}` : null,
      overdue: isStepOverdue(s, today),
    });
    return {
      n: (i + 1) as 1 | 2 | 3,
      title: titles[i],
      from,
      to,
      range: weekRangeWords(from),
      rows: [...starts.map((s) => row(s, 'starts')), ...finishes.map((s) => row(s, 'finishes'))],
    };
  });
  const horizon = weeks[2]!.to;
  const later = all.filter((s) => s.forecastStart > horizon);
  return {
    weeks,
    horizon,
    horizonWords: formatShort(horizon),
    laterLate: later
      .filter((s) => s.lateDays > 0)
      .map((s) => ({ step: s, text: `moved to ${shortWithRelative(s.forecastStart, today)}, ${daysLateWords(s.lateDays)}`, overdue: isStepOverdue(s, today) })),
    laterRest: later.filter((s) => s.lateDays <= 0).map((s) => ({ step: s, text: `Starts ${shortWithRelative(s.forecastStart, today)}, ${lengthWords(s.durationDays)}` })),
  };
}

// ---------------------------------------------------------------------------
// Stages (v1 StagesList): status words and how far through
// ---------------------------------------------------------------------------

/** "Done", "In progress, week 3 of 12", "Starts Mon 21 Sep, in 4 days", "No dates yet". */
export function stageProgressWords(s: Pick<StageForecast, 'status' | 'forecastStart' | 'forecastEnd'>, today: ISODate): string {
  if (s.status === 'done') return 'Done';
  if (s.status === 'in_progress' && s.forecastStart && s.forecastEnd) {
    const total = Math.max(1, Math.ceil((calendarDaysBetween(s.forecastStart, s.forecastEnd) + 1) / 7));
    const week = Math.min(total, Math.max(1, Math.floor(calendarDaysBetween(s.forecastStart, today) / 7) + 1));
    return `In progress, week ${week} of ${total}`;
  }
  return s.forecastStart ? `Starts ${shortWithRelative(s.forecastStart, today)}` : 'No dates yet';
}

/** Share of the stage's calendar span gone by today, 0..1 (done = 1, not started = 0). */
export function stageTimeThrough(s: Pick<StageForecast, 'status' | 'forecastStart' | 'forecastEnd'>, today: ISODate): number {
  if (s.status === 'done') return 1;
  if (s.status === 'not_started' || !s.forecastStart || !s.forecastEnd) return 0;
  const total = Math.max(1, calendarDaysBetween(s.forecastStart, s.forecastEnd) + 1);
  return Math.min(1, Math.max(0, calendarDaysBetween(s.forecastStart, today) / total));
}

/** "Windows, order 12 wk ahead. Window installer, book 3 wk ahead" (step detail's lead times). */
export function leadTimeWords(reqs: { kind: 'trade' | 'material'; name: string; leadTimeWeeks: number }[]): string {
  return reqs.map((r) => `${r.name}, ${r.kind === 'trade' ? 'book' : 'order'} ${r.leadTimeWeeks} wk ahead`).join('. ');
}

/** "1 of 3 required photo sets uploaded" (v1 hold-point readiness). */
export function holdPointReadinessWords(h: { filledCount: number; required: unknown[] }): string {
  const n = h.required.length;
  if (n === 0) return 'No photo sets needed';
  return `${h.filledCount} of ${n} required photo set${n === 1 ? '' : 's'} uploaded`;
}
