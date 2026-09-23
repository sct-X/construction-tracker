import { describe, expect, it } from 'vitest';
import { formatLongRelative, formatShortRelative, relativeDate } from './dates';

describe('relativeDate', () => {
  // Dom's brief: today is Wed 23 Sep 2026.
  const today = '2026-09-23';

  it("reads Dom's three examples", () => {
    expect(formatShortRelative('2026-09-21', today, { deadline: true })).toBe('Mon 21 Sep, overdue by 2 days');
    expect(formatShortRelative('2026-09-28', today)).toBe('Mon 28 Sep, in 5 days');
    expect(formatShortRelative('2026-10-02', today)).toBe('Fri 2 Oct, in 9 days');
  });

  it('says today, tomorrow and yesterday at the boundaries', () => {
    expect(relativeDate(today, today)).toBe('today');
    expect(relativeDate(today, today, { deadline: true })).toBe('today');
    expect(relativeDate('2026-09-24', today)).toBe('tomorrow');
    expect(relativeDate('2026-09-24', today, { deadline: true })).toBe('tomorrow');
    expect(relativeDate('2026-09-22', today)).toBe('yesterday');
  });

  it('only says overdue for a deadline that has passed, singular at one day', () => {
    expect(relativeDate('2026-09-22', today, { deadline: true })).toBe('overdue by 1 day');
    expect(relativeDate('2026-09-20', today, { deadline: true })).toBe('overdue by 3 days');
    expect(relativeDate('2026-09-20', today)).toBe('3 days ago');
    expect(relativeDate('2026-09-26', today, { deadline: true })).toBe('in 3 days');
  });

  it('crosses month and year ends by calendar days', () => {
    expect(relativeDate('2026-10-01', '2026-09-30')).toBe('tomorrow');
    expect(relativeDate('2026-09-30', '2026-10-02', { deadline: true })).toBe('overdue by 2 days');
    expect(relativeDate('2027-01-02', '2026-12-30')).toBe('in 3 days');
    expect(relativeDate('2026-02-27', '2026-03-02')).toBe('3 days ago');
  });

  it('speaks in days inside a fortnight and whole weeks from 14 days', () => {
    expect(relativeDate('2026-10-06', today)).toBe('in 13 days');
    expect(relativeDate('2026-10-07', today)).toBe('in 2 weeks');
    expect(relativeDate('2026-09-10', today)).toBe('13 days ago');
    expect(relativeDate('2026-09-09', today, { deadline: true })).toBe('overdue by 2 weeks');
    expect(relativeDate('2026-08-10', '2026-09-17', { deadline: true })).toBe('overdue by 5 weeks');
    expect(relativeDate('2026-10-12', '2026-09-17')).toBe('in 3 weeks');
  });

  it('pairs with the long date', () => {
    expect(formatLongRelative('2026-09-28', today)).toBe('Mon 28 Sep 2026, in 5 days');
  });
});
