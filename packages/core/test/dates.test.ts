import { describe, expect, it } from 'vitest';
import {
  addWorkingDays,
  fixedClock,
  formatDate,
  formatDays,
  formatLong,
  formatMoney,
  formatShort,
  formatStamp,
  isWorkingDay,
  nextWorkingDay,
  resolveDate,
  slipCost,
  stepEnd,
  sydneyDate,
  sydneyInstant,
  sydneyOffsetMinutes,
  workingDaysBetween,
} from '../src/index.js';

describe('working days', () => {
  it('skips weekends', () => {
    expect(isWorkingDay('2026-09-19')).toBe(false); // Sat
    expect(nextWorkingDay('2026-09-18')).toBe('2026-09-21'); // Fri -> Mon
  });

  it('skips the shutdown 21 Dec 2026 to 8 Jan 2027', () => {
    expect(isWorkingDay('2026-12-18')).toBe(true);
    expect(isWorkingDay('2026-12-21')).toBe(false);
    expect(isWorkingDay('2027-01-08')).toBe(false);
    expect(isWorkingDay('2027-01-11')).toBe(true);
    expect(nextWorkingDay('2026-12-18')).toBe('2027-01-11');
    // A 2-day step starting Fri 18 Dec ends Mon 11 Jan.
    expect(stepEnd('2026-12-18', 2)).toBe('2027-01-11');
    // Plasterboard at Park Rd: 8 days from Fri 11 Dec.
    expect(stepEnd('2026-12-11', 8)).toBe('2027-01-12');
    expect(workingDaysBetween('2026-12-14', '2027-01-15')).toBe(10);
    expect(addWorkingDays('2026-12-19', 0)).toBe('2027-01-11');
  });

  it('step end is inclusive', () => {
    expect(stepEnd('2026-11-02', 1)).toBe('2026-11-02');
    expect(stepEnd('2026-11-02', 10)).toBe('2026-11-13');
  });
});

describe('formatting', () => {
  it('house style dates', () => {
    expect(formatShort('2026-11-16')).toBe('Mon 16 Nov');
    expect(formatLong('2027-03-12')).toBe('Fri 12 Mar 2027');
    expect(formatDate('2026-11-16', '2026-09-17')).toBe('Mon 16 Nov');
    expect(formatDate('2027-03-12', '2026-09-17')).toBe('Fri 12 Mar 2027');
    expect(formatDays(14)).toBe('+14 days');
    expect(formatDays(-1)).toBe('-1 day');
  });

  it('money', () => {
    expect(slipCost(14, 4500)).toBe(9000);
    expect(slipCost(5, 2000)).toBe(1430);
    expect(slipCost(0, 3800)).toBe(0);
    expect(slipCost(-5, 2000)).toBe(-1430);
    expect(slipCost(3, null)).toBeNull();
    expect(formatMoney(9000)).toBe('$9,000');
    expect(formatMoney(-1430)).toBe('-$1,430');
  });
});

describe('Sydney clock', () => {
  it('fixed clock', () => {
    const c = fixedClock('2026-09-17', '15:10');
    expect(c.today()).toBe('2026-09-17');
    expect(c.now().toISOString()).toBe('2026-09-17T05:10:00.000Z');
    expect(c.now() > new Date('2026-09-17T05:10:00.000Z')).toBe(true); // ticks
  });

  it('handles daylight saving (AEDT from Sun 4 Oct 2026)', () => {
    expect(sydneyOffsetMinutes(new Date('2026-09-17T00:00:00Z'))).toBe(600);
    expect(sydneyOffsetMinutes(new Date('2026-11-17T00:00:00Z'))).toBe(660);
    expect(sydneyInstant('2026-11-16', '09:00').toISOString()).toBe('2026-11-15T22:00:00.000Z');
    expect(sydneyDate(new Date('2026-11-15T22:00:00Z'))).toBe('2026-11-16');
    expect(sydneyDate('2026-09-17T14:30:00.000Z')).toBe('2026-09-18');
    expect(formatStamp('2026-09-15T05:10:00.000Z')).toBe('Tue 15 Sep, 3:10pm');
  });
});

describe('relative dates (today Thu 17 Sep 2026)', () => {
  const t = '2026-09-17';
  const cases: [string, string | null][] = [
    ['today', '2026-09-17'],
    ['tomorrow', '2026-09-18'],
    ['next Tuesday', '2026-09-22'],
    ['Tuesday', '2026-09-22'],
    ['this Friday', '2026-09-18'],
    ['next Thursday', '2026-09-24'],
    ['Thursday', '2026-09-24'],
    ['the 14th', '2026-10-14'],
    ['14th', '2026-10-14'],
    ['the 17th', '2026-09-17'],
    ['16 Nov', '2026-11-16'],
    ['16th of November', '2026-11-16'],
    ['Mon 16 Nov', '2026-11-16'],
    ['November 16', '2026-11-16'],
    ['16/11', '2026-11-16'],
    ['5/10/2026', '2026-10-05'],
    ['12 Mar 2027', '2027-03-12'],
    ['1 Sep', '2027-09-01'],
    ['in 2 weeks', '2026-10-01'],
    ['in two weeks', '2026-10-01'],
    ['in a week', '2026-09-24'],
    ['in 3 days', '2026-09-20'],
    ['in a fortnight', '2026-10-01'],
    ['next week', '2026-09-21'],
    ['the 5th of October', '2026-10-05'],
    ['2026-11-16', '2026-11-16'],
    ['by Friday', '2026-09-18'],
    ['banana', null],
    ['31 Feb', null],
  ];
  for (const [phrase, want] of cases) {
    it(`"${phrase}"`, () => expect(resolveDate(phrase, t)).toBe(want));
  }

  it('prefer past', () => {
    expect(resolveDate('the 14th', t, { prefer: 'past' })).toBe('2026-09-14');
    expect(resolveDate('1 Sep', t, { prefer: 'past' })).toBe('2026-09-01');
  });

  it('"next Tuesday" from a Monday is the Tuesday of next week', () => {
    expect(resolveDate('next Tuesday', '2026-09-14')).toBe('2026-09-22');
    expect(resolveDate('Tuesday', '2026-09-14')).toBe('2026-09-15');
  });
});
