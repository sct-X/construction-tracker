/**
 * Turns what Dominic says ("next Tuesday", "the 14th", "16 Nov", "tomorrow",
 * "in 2 weeks") into an ISO date against the injected clock's today.
 *
 * Readings (locked):
 *  - "Tuesday" / "this Tuesday": the next Tuesday strictly after today.
 *  - "next Tuesday": the Tuesday of next week (weeks start Monday). From a
 *    Thursday both readings agree.
 *  - "the 14th": the next 14th on or after today (prefer: 'past' gives the last one).
 *  - "16 Nov" with no year: the next 16 Nov on or after today (prefer: 'past'
 *    gives the most recent one on or before today).
 *  - "next week": Monday of next week. "end of the week": Friday this week.
 *  - A leading weekday is ignored when a full date follows ("Mon 16 Nov").
 * Returns null when the phrase isn't a date it understands.
 */
import { addCalendarDays, addCalendarWeeks, addMonths, isISODate, isoFromParts, lastMonday, weekday } from './dates.js';
import type { ISODate } from './types.js';

export interface ResolveOptions {
  /** Which way to go when a phrase names no year or month. Default 'future'. */
  prefer?: 'future' | 'past';
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

const MONTHS: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, couple: 2, 'a couple of': 2,
};

function num(s: string): number | null {
  if (/^\d+$/.test(s)) return Number(s);
  return NUMBER_WORDS[s] ?? null;
}

function validDay(y: number, m: number, d: number): ISODate | null {
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return isISODate(iso) ? iso : null;
}

/** A month/day with no year, the next (or last) occurrence relative to today. */
function monthDay(m: number, d: number, today: ISODate, prefer: 'future' | 'past'): ISODate | null {
  const y = Number(today.slice(0, 4));
  const candidates = [y - 1, y, y + 1].map((yy) => validDay(yy, m, d)).filter((x): x is ISODate => !!x);
  if (!candidates.length) return null;
  if (prefer === 'past') return [...candidates].reverse().find((c) => c <= today) ?? null;
  return candidates.find((c) => c >= today) ?? null;
}

function fullYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}

export function resolveDate(phrase: string, today: ISODate, opts: ResolveOptions = {}): ISODate | null {
  const prefer = opts.prefer ?? 'future';
  let s = phrase
    .toLowerCase()
    .trim()
    .replace(/[,.]+$/g, '')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ');
  if (!s) return null;
  const asIs: string = s;
  if (isISODate(asIs)) return asIs;

  // Filler words around the date.
  s = s.replace(/^(on|by|for|at|from|around|about|arriving|due)\s+/, '').replace(/^(on|by)\s+/, '');

  if (s === 'today' || s === 'tonight') return today;
  if (s === 'tomorrow' || s === 'tmrw' || s === 'tomoz') return addCalendarDays(today, 1);
  if (s === 'yesterday') return addCalendarDays(today, -1);
  if (s === 'day after tomorrow' || s === 'the day after tomorrow') return addCalendarDays(today, 2);
  if (s === 'next week') return addCalendarDays(lastMonday(today), 7);
  if (s === 'end of the week' || s === 'end of week' || s === 'this friday arvo') {
    return addCalendarDays(lastMonday(today), 4);
  }
  if (s === 'end of next week') return addCalendarDays(lastMonday(today), 11);
  if (s === 'a fortnight' || s === 'in a fortnight' || s === 'fortnight') return addCalendarWeeks(today, 2);

  // "in 2 weeks", "in a week", "in three days", "2 weeks from now", "in a couple of weeks"
  let m = s.match(/^(?:in )?(\d+|a couple of|[a-z]+) (day|days|week|weeks|month|months|fortnight|fortnights)(?: from (?:now|today))?$/);
  if (m && (s.startsWith('in ') || s.includes(' from '))) {
    const n = num(m[1]!);
    if (n !== null) {
      const unit = m[2]!;
      if (unit.startsWith('day')) return addCalendarDays(today, n);
      if (unit.startsWith('week')) return addCalendarWeeks(today, n);
      if (unit.startsWith('fortnight')) return addCalendarWeeks(today, 2 * n);
      return addMonths(today, n);
    }
  }

  // Weekdays: "tuesday", "this tuesday", "next tuesday", "tuesday week"
  m = s.match(/^(this |next |coming |this coming )?([a-z]+)( week)?$/);
  if (m && WEEKDAYS[m[2]!] !== undefined) {
    const target = WEEKDAYS[m[2]!]!;
    const qualifier = (m[1] ?? '').trim();
    if (qualifier === 'next') {
      const nextMon = addCalendarDays(lastMonday(today), 7);
      return addCalendarDays(nextMon, (target + 6) % 7);
    }
    let diff = (target - weekday(today) + 7) % 7;
    if (diff === 0) diff = 7;
    let d = addCalendarDays(today, diff);
    if (m[3]) d = addCalendarDays(d, 7); // "tuesday week"
    return d;
  }

  // Strip a leading weekday before a full date: "mon 16 nov", "monday the 16th"
  const lead = s.match(/^([a-z]+) (.+)$/);
  if (lead && WEEKDAYS[lead[1]!] !== undefined) s = lead[2]!;

  // "the 14th", "14th", "the 3rd"
  m = s.match(/^(?:the )?(\d{1,2})(st|nd|rd|th)?$/);
  if (m && (m[2] || s.startsWith('the '))) {
    const d = Number(m[1]);
    if (d < 1 || d > 31) return null;
    const y = Number(today.slice(0, 4));
    const mo = Number(today.slice(5, 7));
    // Search month by month from this one.
    for (let i = 0; i < 13; i++) {
      const step = prefer === 'past' ? -i : i;
      const base = addMonths(isoFromParts(y, mo, 1), step);
      const iso = validDay(Number(base.slice(0, 4)), Number(base.slice(5, 7)), d);
      if (!iso) continue;
      if (prefer === 'past' ? iso <= today : iso >= today) return iso;
    }
    return null;
  }

  // "16 nov", "16th of november", "16 nov 2027", "16 november 27"
  m = s.match(/^(?:the )?(\d{1,2})(?:st|nd|rd|th)?(?: of)? ([a-z]+)(?: (\d{2,4}))?$/);
  if (m && MONTHS[m[2]!] !== undefined) {
    const d = Number(m[1]);
    const mo = MONTHS[m[2]!]!;
    if (m[3]) return validDay(fullYear(Number(m[3])), mo, d);
    return monthDay(mo, d, today, prefer);
  }

  // "nov 16", "november 16th", "nov 16 2027"
  m = s.match(/^([a-z]+) (\d{1,2})(?:st|nd|rd|th)?(?: (\d{2,4}))?$/);
  if (m && MONTHS[m[1]!] !== undefined) {
    const mo = MONTHS[m[1]!]!;
    const d = Number(m[2]);
    if (m[3]) return validDay(fullYear(Number(m[3])), mo, d);
    return monthDay(mo, d, today, prefer);
  }

  // "16/11", "16/11/2026", "16-11-26" (Australian day first)
  m = s.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    if (m[3]) return validDay(fullYear(Number(m[3])), mo, d);
    return monthDay(mo, d, today, prefer);
  }

  return null;
}
