/**
 * Date arithmetic on ISO `YYYY-MM-DD` strings. No UI imports.
 *
 * Working days are Mon to Fri minus the shutdown list (rule 5).
 * Lead times are calendar weeks. Slip is calendar days.
 */

export interface DateRange {
  from: string;
  to: string;
}

/** Builders' shutdown, inclusive of both ends. */
export const SHUTDOWNS: readonly DateRange[] = [{ from: '2026-12-21', to: '2027-01-08' }];

const DAY_MS = 86_400_000;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(s: unknown): s is string {
  return typeof s === 'string' && ISO_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

function toUTC(iso: string): number {
  if (!ISO_RE.test(iso)) throw new Error(`Not an ISO date: ${iso}`);
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekday(iso: string): number {
  return new Date(toUTC(iso)).getUTCDay();
}

export function addCalendarDays(iso: string, days: number): string {
  return fromUTC(toUTC(iso) + days * DAY_MS);
}

export function addCalendarWeeks(iso: string, weeks: number): string {
  return addCalendarDays(iso, weeks * 7);
}

/** `to` minus `from` in calendar days. Positive when `to` is later. */
export function calendarDaysBetween(from: string, to: string): number {
  return Math.round((toUTC(to) - toUTC(from)) / DAY_MS);
}

export function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function maxDate(...dates: (string | undefined | null)[]): string | undefined {
  let best: string | undefined;
  for (const d of dates) if (d && (!best || d > best)) best = d;
  return best;
}

export function minDate(...dates: (string | undefined | null)[]): string | undefined {
  let best: string | undefined;
  for (const d of dates) if (d && (!best || d < best)) best = d;
  return best;
}

export function isInShutdown(iso: string, shutdowns: readonly DateRange[] = SHUTDOWNS): boolean {
  return shutdowns.some((r) => iso >= r.from && iso <= r.to);
}

export function isWorkingDay(iso: string, shutdowns: readonly DateRange[] = SHUTDOWNS): boolean {
  const wd = weekday(iso);
  if (wd === 0 || wd === 6) return false;
  return !isInShutdown(iso, shutdowns);
}

/** The same day if it is a working day, otherwise the next working day. */
export function snapToWorkingDay(iso: string, shutdowns: readonly DateRange[] = SHUTDOWNS): string {
  let d = iso;
  while (!isWorkingDay(d, shutdowns)) d = addCalendarDays(d, 1);
  return d;
}

/** The working day after `iso` (strictly later). */
export function nextWorkingDay(iso: string, shutdowns: readonly DateRange[] = SHUTDOWNS): string {
  return snapToWorkingDay(addCalendarDays(iso, 1), shutdowns);
}

/** The working day before `iso` (strictly earlier). */
export function previousWorkingDay(iso: string, shutdowns: readonly DateRange[] = SHUTDOWNS): string {
  let d = addCalendarDays(iso, -1);
  while (!isWorkingDay(d, shutdowns)) d = addCalendarDays(d, -1);
  return d;
}

/**
 * Moves `n` working days from `iso`. `iso` is first snapped to a working day
 * (forward). n = 0 returns that day. Negative n moves backwards.
 */
export function addWorkingDays(iso: string, n: number, shutdowns: readonly DateRange[] = SHUTDOWNS): string {
  let d = snapToWorkingDay(iso, shutdowns);
  if (n > 0) for (let i = 0; i < n; i++) d = nextWorkingDay(d, shutdowns);
  else if (n < 0) for (let i = 0; i < -n; i++) d = previousWorkingDay(d, shutdowns);
  return d;
}

/**
 * Last day of a step that starts on `start` and runs `durationDays` working
 * days, the start day counting as the first. Duration below 1 is treated as 1.
 */
export function stepEnd(start: string, durationDays: number, shutdowns: readonly DateRange[] = SHUTDOWNS): string {
  return addWorkingDays(start, Math.max(1, Math.round(durationDays)) - 1, shutdowns);
}

/** Working days in [from, to], both inclusive. 0 when `to` is before `from`. */
export function workingDaysBetween(from: string, to: string, shutdowns: readonly DateRange[] = SHUTDOWNS): number {
  if (to < from) return 0;
  let n = 0;
  for (let d = from; d <= to; d = addCalendarDays(d, 1)) if (isWorkingDay(d, shutdowns)) n++;
  return n;
}

/** The Monday on or before `today`. */
export function lastMonday(today: string): string {
  const wd = weekday(today); // Sun 0 .. Sat 6
  const back = wd === 0 ? 6 : wd - 1;
  return addCalendarDays(today, -back);
}

/** The Monday strictly after `today`. */
export function nextMonday(today: string): string {
  return addCalendarDays(lastMonday(today), 7);
}

export function isMonday(iso: string): boolean {
  return weekday(iso) === 1;
}

export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** `YYYY-MM-DDTHH:mm` in local time. */
export function nowStamp(now: Date = new Date()): string {
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${todayISO(now)}T${hh}:${mm}`;
}

// ---------- formatting ----------

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(iso: string): { wd: string; d: number; mon: string; y: number } {
  const dt = new Date(toUTC(iso));
  return { wd: DAYS[dt.getUTCDay()], d: dt.getUTCDate(), mon: MONTHS[dt.getUTCMonth()], y: dt.getUTCFullYear() };
}

/** "Fri 26 Feb 2027" */
export function formatLong(iso: string): string {
  const p = parts(iso);
  return `${p.wd} ${p.d} ${p.mon} ${p.y}`;
}

/** "Mon 2 Nov" */
export function formatShort(iso: string): string {
  const p = parts(iso);
  return `${p.wd} ${p.d} ${p.mon}`;
}

/** "2 Nov" */
export function formatDayMonth(iso: string): string {
  const p = parts(iso);
  return `${p.d} ${p.mon}`;
}

/** "12 Mar 27": for the Monday table, where the year matters but space is short. */
export function formatDayMonthYear2(iso: string): string {
  const p = parts(iso);
  return `${p.d} ${p.mon} ${String(p.y).slice(2)}`;
}

/** "26 Feb 2027" */
export function formatDayMonthYear(iso: string): string {
  const p = parts(iso);
  return `${p.d} ${p.mon} ${p.y}`;
}

/** "Sep", "Mon 14 Sep" style pieces for week headers: "14-18 Sep" or "28 Sep-2 Oct". */
export function formatWeekRange(mondayISO: string): string {
  const a = parts(mondayISO);
  const b = parts(addCalendarDays(mondayISO, 4));
  return a.mon === b.mon ? `${a.d}-${b.d} ${a.mon}` : `${a.d} ${a.mon}-${b.d} ${b.mon}`;
}

/**
 * How far away or how late a date is, from `today`, in words. The one voice
 * for relative time everywhere a date is shown ("Mon 28 Sep, in 5 days").
 *
 *   today · tomorrow · in 5 days · in 3 weeks
 *   yesterday · 5 days ago · 5 weeks ago          (a past date that is not a deadline)
 *   overdue by 1 day · overdue by 5 weeks         (a deadline that has passed)
 *
 * `deadline` is for act-by and needed-by dates on work still outstanding:
 * only those can be overdue. A photo taken, a note written or a delivery
 * expected in the past is "ago". Past a fortnight it speaks in whole weeks,
 * because that is how a builder says it.
 */
export function relativeDate(iso: string, todayISOStr: string, opts: { deadline?: boolean } = {}): string {
  const n = calendarDaysBetween(todayISOStr, iso); // positive when iso is in the future
  if (n === 0) return 'today';
  const abs = Math.abs(n);
  const span = abs >= 14 ? `${Math.floor(abs / 7)} weeks` : `${abs} day${abs === 1 ? '' : 's'}`;
  if (n > 0) return abs === 1 ? 'tomorrow' : `in ${span}`;
  if (opts.deadline) return `overdue by ${span}`;
  return abs === 1 ? 'yesterday' : `${span} ago`;
}

/** "Mon 21 Sep, overdue by 2 days", "Mon 28 Sep, in 5 days": a short date with its relative time. */
export function formatShortRelative(iso: string, todayISOStr: string, opts: { deadline?: boolean } = {}): string {
  return `${formatShort(iso)}, ${relativeDate(iso, todayISOStr, opts)}`;
}

/** "Fri 26 Feb 2027, in 22 weeks": a long date with its relative time. */
export function formatLongRelative(iso: string, todayISOStr: string, opts: { deadline?: boolean } = {}): string {
  return `${formatLong(iso)}, ${relativeDate(iso, todayISOStr, opts)}`;
}

/** "+14 days", "0", "-3 days" */
export function formatDelta(days: number): string {
  if (days === 0) return '0';
  const abs = Math.abs(days);
  return `${days > 0 ? '+' : '-'}${abs} day${abs === 1 ? '' : 's'}`;
}

/** "3:10pm" from a `YYYY-MM-DDTHH:mm` stamp. */
export function formatTime(stamp: string): string {
  const [, time] = stamp.split('T');
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

/** "Tue 3:10pm" */
export function formatStamp(stamp: string): string {
  const iso = stamp.slice(0, 10);
  return `${DAYS[weekday(iso)]} ${formatTime(stamp)}`;
}
