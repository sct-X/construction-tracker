/**
 * Timing-first helpers for the web's v1 look (SPEC "Revision 2026-10-10"):
 * freshness in words (never an amber state), the stage name as Dom reads it
 * ("Pending approval"), the date a waiting-on item is grouped by, and the
 * trades on site this week. Pure; depends only on the calculator's output.
 */
import type { Freshness, JobForecast, StepForecast } from './calculator.js';
import { addCalendarDays, formatShort, relativeDays } from './dates.js';
import type { Dataset, ISODate, ItemStatus } from './types.js';

/** Rule 7 in words: over 7 days unconfirmed reads "Not confirmed for 9 days"; otherwise the calm text. */
export function freshnessWords(f: Pick<Freshness, 'daysUnconfirmed' | 'amber' | 'text'>): string {
  if (f.daysUnconfirmed === null) return 'Never confirmed';
  if (f.amber) return `Not confirmed for ${f.daysUnconfirmed} day${f.daysUnconfirmed === 1 ? '' : 's'}`;
  return f.text;
}

/** "With council" and "With certifier" both read "Pending approval" (v1, W3). Other stage names as stored. */
export function stageDisplayName(name: string | null): string | null {
  if (!name) return name;
  return /^with (council|certifier)$/i.test(name.trim()) ? 'Pending approval' : name;
}

/**
 * The date an open item is grouped and sorted by: its act-by while still to
 * do, then the date it is expected (or needed), since once it is booked the
 * acting is done and only the arrival is left.
 */
export function waitingKeyDate(r: { status: ItemStatus; actBy: ISODate | null; expected: ISODate | null; neededBy: ISODate | null }): ISODate | null {
  return r.status === 'to_do' ? (r.actBy ?? r.expected ?? r.neededBy) : (r.expected ?? r.neededBy);
}

/** "Stage 5 of 8", "All 8 stages done", "No stages yet". */
export function stagePositionWords(stages: { stageId: string; status: string }[], currentStageId: string | null): string {
  const of = stages.length;
  if (of === 0) return 'No stages yet';
  if (stages.every((s) => s.status === 'done')) return `All ${of} stages done`;
  const i = stages.findIndex((s) => s.stageId === currentStageId);
  return i >= 0 ? `Stage ${i + 1} of ${of}` : `${of} stages`;
}

export interface TradeOnRow {
  key: string;
  /** Who is coming: the trade booked against the step, else the step's trade type. */
  trade: string;
  stepId: string;
  stepName: string;
  start: ISODate;
  end: ISODate;
  underWay: boolean;
  /** "On site, until Fri 25 Sep" or "Mon 21 Sep, in 4 days". */
  when: string;
}

/**
 * Trades on this week (v1 job page): every not-done step whose forecast span
 * meets today to today + 7, named by the trades booked against it (else the
 * step's trade type), in start order. A step with no trade is left out.
 */
export function tradesThisWeek(ds: Dataset, f: JobForecast, today: ISODate): TradeOnRow[] {
  const end = addCalendarDays(today, 7);
  const tradeName = new Map(ds.trades.map((t) => [t.id, t.name]));
  const stepById = new Map(ds.steps.map((s) => [s.id, s]));
  const rows: TradeOnRow[] = [];
  const inWindow = Object.values(f.steps)
    .filter((s) => s.status !== 'done' && s.forecastStart <= end && s.forecastEnd >= today)
    .sort((a, b) => a.forecastStart.localeCompare(b.forecastStart) || a.order - b.order);
  for (const s of inWindow) {
    const names = new Set<string>();
    for (const i of ds.items)
      if (i.stepId === s.stepId && i.type === 'trade') {
        const n = (i.tradeId && tradeName.get(i.tradeId)) || i.waitingOn;
        if (n) names.add(n);
      }
    const own = stepById.get(s.stepId)?.tradeType;
    if (names.size === 0 && own) names.add(own);
    for (const trade of names) rows.push({ key: `${s.stepId}-${trade}`, trade, stepId: s.stepId, stepName: s.name, start: s.forecastStart, end: s.forecastEnd, underWay: isUnderWay(s, today), when: tradeWhen(s, today) });
  }
  return rows;
}

function isUnderWay(s: StepForecast, today: ISODate): boolean {
  return s.status === 'in_progress' || s.forecastStart <= today;
}

function tradeWhen(s: StepForecast, today: ISODate): string {
  if (isUnderWay(s, today)) return `On site, until ${formatShort(s.forecastEnd)}`;
  return `${formatShort(s.forecastStart)}, ${relativeDays(s.forecastStart, today)}`;
}
