/**
 * Calendar arithmetic on ISO `YYYY-MM-DD` strings, the Sydney clock, and the
 * date words used everywhere ("Mon 16 Nov", "Fri 12 Mar 2027").
 *
 * Working days are Mon to Fri minus the shutdown list (rule 5). Lead times are
 * calendar weeks. Slip is calendar days. No Node-only APIs: Intl only.
 */
import type { ISODate, Instant } from './types.js';

export const TIMEZONE = 'Australia/Sydney';

export interface DateRange {
  from: ISODate;
  to: ISODate;
}

/** Builders' Christmas shutdown, both ends inclusive. Public holidays are out of scope. */
export const SHUTDOWNS: readonly DateRange[] = [{ from: '2026-12-21', to: '2027-01-08' }];

const DAY_MS = 86_400_000;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(s: unknown): s is ISODate {
  if (typeof s !== 'string' || !ISO_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function toUTC(iso: ISODate): number {
  if (!ISO_RE.test(iso)) throw new Error(`Not an ISO date: ${iso}`);
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isoFromParts(year: number, month: number, day: number): ISODate {
  return fromUTC(Date.UTC(year, month - 1, day));
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekday(iso: ISODate): number {
  return new Date(toUTC(iso)).getUTCDay();
}

export function addCalendarDays(iso: ISODate, days: number): ISODate {
  return fromUTC(toUTC(iso) + days * DAY_MS);
}

export function addCalendarWeeks(iso: ISODate, weeks: number): ISODate {
  return addCalendarDays(iso, weeks * 7);
}

/** Same day of month, `months` later, clamped to the month's last day. */
export function addMonths(iso: ISODate, months: number): ISODate {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return isoFromParts(first.getUTCFullYear(), first.getUTCMonth() + 1, Math.min(d, last));
}

/** `to` minus `from` in calendar days. Positive when `to` is later. */
export function calendarDaysBetween(from: ISODate, to: ISODate): number {
  return Math.round((toUTC(to) - toUTC(from)) / DAY_MS);
}

export function maxDate(...dates: (ISODate | null | undefined)[]): ISODate | null {
  let best: ISODate | null = null;
  for (const d of dates) if (d && (!best || d > best)) best = d;
  return best;
}

export function minDate(...dates: (ISODate | null | undefined)[]): ISODate | null {
  let best: ISODate | null = null;
  for (const d of dates) if (d && (!best || d < best)) best = d;
  return best;
}

export function isInShutdown(iso: ISODate, shutdowns: readonly DateRange[] = SHUTDOWNS): boolean {
  return shutdowns.some((r) => iso >= r.from && iso <= r.to);
}

export function isWorkingDay(iso: ISODate, shutdowns: readonly DateRange[] = SHUTDOWNS): boolean {
  const wd = weekday(iso);
  if (wd === 0 || wd === 6) return false;
  return !isInShutdown(iso, shutdowns);
}

/** The same day if it is a working day, otherwise the next working day. */
export function snapToWorkingDay(iso: ISODate, shutdowns: readonly DateRange[] = SHUTDOWNS): ISODate {
  let d = iso;
  while (!isWorkingDay(d, shutdowns)) d = addCalendarDays(d, 1);
  return d;
}

/** The working day strictly after `iso`. */
export function nextWorkingDay(iso: ISODate, shutdowns: readonly DateRange[] = SHUTDOWNS): ISODate {
  return snapToWorkingDay(addCalendarDays(iso, 1), shutdowns);
}

/** The working day strictly before `iso`. */
export function previousWorkingDay(iso: ISODate, shutdowns: readonly DateRange[] = SHUTDOWNS): ISODate {
  let d = addCalendarDays(iso, -1);
  while (!isWorkingDay(d, shutdowns)) d = addCalendarDays(d, -1);
  return d;
}

/** Moves `n` working days from `iso` (first snapped forward to a working day). n = 0 returns that day. */
export function addWorkingDays(iso: ISODate, n: number, shutdowns: readonly DateRange[] = SHUTDOWNS): ISODate {
  let d = snapToWorkingDay(iso, shutdowns);
  if (n > 0) for (let i = 0; i < n; i++) d = nextWorkingDay(d, shutdowns);
  else if (n < 0) for (let i = 0; i < -n; i++) d = previousWorkingDay(d, shutdowns);
  return d;
}

/** Last day of a step starting `start` and running `durationDays` working days (inclusive end). */
export function stepEnd(start: ISODate, durationDays: number, shutdowns: readonly DateRange[] = SHUTDOWNS): ISODate {
  return addWorkingDays(start, Math.max(1, Math.round(durationDays)) - 1, shutdowns);
}

/** Working days in [from, to], both inclusive. 0 when `to` is before `from`. */
export function workingDaysBetween(from: ISODate, to: ISODate, shutdowns: readonly DateRange[] = SHUTDOWNS): number {
  if (to < from) return 0;
  let n = 0;
  for (let d = from; d <= to; d = addCalendarDays(d, 1)) if (isWorkingDay(d, shutdowns)) n++;
  return n;
}

/** The Monday on or before `iso`. */
export function lastMonday(iso: ISODate): ISODate {
  const wd = weekday(iso);
  return addCalendarDays(iso, -(wd === 0 ? 6 : wd - 1));
}

export function isMonday(iso: ISODate): boolean {
  return weekday(iso) === 1;
}

// ---------------------------------------------------------------------------
// Sydney time
// ---------------------------------------------------------------------------

const partsFormatter = new Intl.DateTimeFormat('en-AU', {
  timeZone: TIMEZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

interface WallClock {
  y: number;
  m: number;
  d: number;
  hh: number;
  mm: number;
  ss: number;
}

function sydneyWallClock(instant: Date): WallClock {
  const parts = partsFormatter.formatToParts(instant);
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? NaN);
  return { y: pick('year'), m: pick('month'), d: pick('day'), hh: pick('hour') % 24, mm: pick('minute'), ss: pick('second') };
}

/** Sydney's UTC offset at that instant, in minutes (600 or 660). */
export function sydneyOffsetMinutes(instant: Date): number {
  const w = sydneyWallClock(instant);
  const asUTC = Date.UTC(w.y, w.m - 1, w.d, w.hh, w.mm, w.ss);
  return Math.round((asUTC - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

/** The calendar date in Sydney at that instant. */
export function sydneyDate(instant: Date | Instant): ISODate {
  const w = sydneyWallClock(typeof instant === 'string' ? new Date(instant) : instant);
  return isoFromParts(w.y, w.m, w.d);
}

/** "15:10" in Sydney at that instant. */
export function sydneyTime(instant: Date | Instant): string {
  const w = sydneyWallClock(typeof instant === 'string' ? new Date(instant) : instant);
  return `${String(w.hh).padStart(2, '0')}:${String(w.mm).padStart(2, '0')}`;
}

/** The instant of a Sydney wall-clock time ("2026-09-15", "10:12"). */
export function sydneyInstant(date: ISODate, time = '00:00'): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let inst = guess - sydneyOffsetMinutes(new Date(guess)) * 60000;
  const off2 = sydneyOffsetMinutes(new Date(inst));
  inst = guess - off2 * 60000;
  return new Date(inst);
}

/** Same as sydneyInstant, as an Instant string. */
export function sydneyStamp(date: ISODate, time = '00:00'): Instant {
  return sydneyInstant(date, time).toISOString();
}

// ---------------------------------------------------------------------------
// Clock
// ---------------------------------------------------------------------------

/** Injected everywhere "today" matters. today() is the Sydney calendar date. */
export interface Clock {
  today(): ISODate;
  now(): Date;
}

/** The real clock, in Sydney. */
export function systemClock(): Clock {
  return {
    today: () => sydneyDate(new Date()),
    now: () => new Date(),
  };
}

/**
 * A clock stuck on one Sydney date. now() is that date at `time` (default
 * 09:00), advancing by one millisecond per call so stamps stay ordered.
 */
export function fixedClock(today: ISODate, time = '09:00'): Clock {
  if (!isISODate(today)) throw new Error(`fixedClock needs YYYY-MM-DD, got ${today}`);
  const base = sydneyInstant(today, time).getTime();
  let tick = 0;
  return {
    today: () => today,
    now: () => new Date(base + tick++),
  };
}

/**
 * Real time of day, pretend date: today() is `today`, now() is that date at
 * the current Sydney wall-clock time. For TZ_TODAY_OVERRIDE.
 */
export function overrideClock(today: ISODate): Clock {
  if (!isISODate(today)) throw new Error(`overrideClock needs YYYY-MM-DD, got ${today}`);
  return {
    today: () => today,
    now: () => {
      const real = new Date();
      const t = sydneyTime(real);
      return new Date(sydneyInstant(today, t).getTime() + (real.getTime() % 60000));
    },
  };
}

/** systemClock(), or overrideClock(value) when a YYYY-MM-DD override is set. */
export function clockFromOverride(value: string | null | undefined): Clock {
  return value && value.trim() ? overrideClock(value.trim()) : systemClock();
}

// ---------------------------------------------------------------------------
// Formatting: plain English, Australian order
// ---------------------------------------------------------------------------

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function parts(iso: ISODate): { wd: string; d: number; mon: string; y: number } {
  const dt = new Date(toUTC(iso));
  return { wd: DAYS[dt.getUTCDay()]!, d: dt.getUTCDate(), mon: MONTHS[dt.getUTCMonth()]!, y: dt.getUTCFullYear() };
}

/** "Mon 16 Nov" */
export function formatShort(iso: ISODate): string {
  const p = parts(iso);
  return `${p.wd} ${p.d} ${p.mon}`;
}

/** "Fri 12 Mar 2027" */
export function formatLong(iso: ISODate): string {
  const p = parts(iso);
  return `${p.wd} ${p.d} ${p.mon} ${p.y}`;
}

/** "16 Nov" */
export function formatDayMonth(iso: ISODate): string {
  const p = parts(iso);
  return `${p.d} ${p.mon}`;
}

/**
 * The house style: "Mon 16 Nov" when the date is in today's year, else
 * "Fri 12 Mar 2027". Without `today`, always the long form.
 */
export function formatDate(iso: ISODate, today?: ISODate): string {
  if (today && iso.slice(0, 4) === today.slice(0, 4)) return formatShort(iso);
  return formatLong(iso);
}

/** "+14 days", "0 days", "-3 days", "+1 day". */
export function formatDays(days: number): string {
  const abs = Math.abs(days);
  const sign = days > 0 ? '+' : days < 0 ? '-' : '';
  return `${sign}${abs} day${abs === 1 ? '' : 's'}`;
}

/** "3:10pm" in Sydney. */
export function formatTime(instant: Date | Instant): string {
  const [h, m] = sydneyTime(instant).split(':').map(Number) as [number, number];
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

/** "Tue 15 Sep, 3:10pm" in Sydney. */
export function formatStamp(instant: Date | Instant): string {
  return `${formatShort(sydneyDate(instant))}, ${formatTime(instant)}`;
}

/**
 * How far away or ago a date is, in words: "today", "tomorrow", "in 5 days",
 * "in 3 weeks", "yesterday", "5 days ago", "overdue by 2 days" (deadline).
 */
export function relativeDays(iso: ISODate, today: ISODate, opts: { deadline?: boolean } = {}): string {
  const n = calendarDaysBetween(today, iso);
  if (n === 0) return 'today';
  const abs = Math.abs(n);
  const span = abs >= 14 ? `${Math.floor(abs / 7)} weeks` : `${abs} day${abs === 1 ? '' : 's'}`;
  if (n > 0) return abs === 1 ? 'tomorrow' : `in ${span}`;
  if (opts.deadline) return `overdue by ${span}`;
  return abs === 1 ? 'yesterday' : `${span} ago`;
}
