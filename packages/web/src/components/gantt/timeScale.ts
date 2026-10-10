/**
 * The Gantt's time axis (ported from v1 src/components/gantt/timeScale.ts):
 * calendar days across, so a week is always the same width and the shutdown
 * is a band you can see. Bars are laid over it from the calculator's forecast
 * and planned dates; the axis never touches the dates themselves. Pure.
 */
import { addCalendarDays, calendarDaysBetween, lastMonday, SHUTDOWNS, type DateRange, type ISODate } from '@ct/core';

export interface WeekTick {
  /** The Monday. */
  date: ISODate;
  x: number;
  /** "14" (day of month). */
  label: string;
}

export interface MonthSpan {
  /** "Sep 2026" on the first month and on every January, else "Oct". */
  label: string;
  x: number;
  width: number;
}

export interface Band {
  x: number;
  width: number;
  label: string;
}

export interface TimeScale {
  from: ISODate;
  to: ISODate;
  pxPerDay: number;
  width: number;
  x: (iso: ISODate) => number;
  /** Width of an inclusive [start, end] span. */
  span: (start: ISODate, end: ISODate) => number;
  weeks: WeekTick[];
  months: MonthSpan[];
  shutdowns: Band[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const monthOf = (iso: ISODate) => Number(iso.slice(5, 7)) - 1;
const yearOf = (iso: ISODate) => Number(iso.slice(0, 4));
const firstOfMonth = (iso: ISODate) => `${iso.slice(0, 8)}01`;
function firstOfNextMonth(iso: ISODate): ISODate {
  const y = yearOf(iso);
  const m = monthOf(iso);
  return m === 11 ? `${y + 1}-01-01` : `${y}-${String(m + 2).padStart(2, '0')}-01`;
}
const dayMonth = (iso: ISODate) => `${Number(iso.slice(8, 10))} ${MONTHS[monthOf(iso)]}`;

export interface ScaleOptions {
  /** Every date that must be on the axis: planned and forecast starts and ends. */
  dates: ISODate[];
  today: ISODate;
  pxPerDay?: number;
  /** Padding in weeks before the first date and after the last. */
  padWeeks?: number;
  shutdowns?: readonly DateRange[];
}

/** From the Monday a week before the earliest date to the Sunday after the latest, with today and its three-week look-ahead always inside. */
export function makeTimeScale({ dates, today, pxPerDay = 5, padWeeks = 1, shutdowns = SHUTDOWNS }: ScaleOptions): TimeScale {
  const all = dates.filter(Boolean);
  all.push(today, addCalendarDays(today, 21));
  let min = all[0]!;
  let max = all[0]!;
  for (const d of all) {
    if (d < min) min = d;
    if (d > max) max = d;
  }
  const from = addCalendarDays(lastMonday(min), -7 * padWeeks);
  const to = addCalendarDays(lastMonday(max), 7 * (padWeeks + 1) - 1);
  const x = (iso: ISODate) => calendarDaysBetween(from, iso) * pxPerDay;
  const span = (start: ISODate, end: ISODate) => (calendarDaysBetween(start, end) + 1) * pxPerDay;

  const weeks: WeekTick[] = [];
  for (let d = from; d <= to; d = addCalendarDays(d, 7)) weeks.push({ date: d, x: x(d), label: String(Number(d.slice(8, 10))) });

  const months: MonthSpan[] = [];
  for (let m = firstOfMonth(from); m <= to; m = firstOfNextMonth(m)) {
    const start = m < from ? from : m;
    const last = addCalendarDays(firstOfNextMonth(m), -1);
    const end = last > to ? to : last;
    const first = months.length === 0 || monthOf(m) === 0;
    months.push({ label: first ? `${MONTHS[monthOf(m)]} ${yearOf(m)}` : MONTHS[monthOf(m)]!, x: x(start), width: span(start, end) });
  }

  const bands: Band[] = [];
  for (const r of shutdowns) {
    if (r.to < from || r.from > to) continue;
    const s = r.from < from ? from : r.from;
    const e = r.to > to ? to : r.to;
    bands.push({ x: x(s), width: span(s, e), label: `Shutdown ${dayMonth(r.from)} to ${dayMonth(r.to)}` });
  }

  return { from, to, pxPerDay, width: span(from, to), x, span, weeks, months, shutdowns: bands };
}
