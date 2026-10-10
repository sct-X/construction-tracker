/**
 * v1 date wording: every date carries its relative time ("Mon 28 Sep, in 5
 * days"); "overdue by" only for a deadline still open; "N days late" only for
 * the gap between two dates; "ago" for past dates that aren't deadlines.
 * Pure, so tests can check the words.
 */
import { formatDate, relativeDays, type ISODate, type WaitingRow } from '@ct/core';

/** "Mon 28 Sep, in 5 days" / "Mon 10 Aug, overdue by 5 weeks" (deadline) / "Mon 14 Sep, 3 days ago". */
export function shortRelative(iso: ISODate, today: ISODate, opts: { deadline?: boolean } = {}): string {
  const rel = relativeDays(iso, today, opts);
  return `${formatDate(iso, today)}, ${rel}`;
}

export type WhenTone = 'late' | 'plain' | 'muted';

/**
 * A waiting-on row's one date phrase. Red (late) only when it is overdue, and
 * then the words say "overdue" too. Expected after needed, both ahead: plain words.
 */
export function whenWords(
  r: Pick<WaitingRow, 'status' | 'actBy' | 'neededBy' | 'expected' | 'isLate' | 'lateText' | 'overdue'>,
  today: ISODate,
): { text: string; tone: WhenTone } {
  if (r.overdue) {
    if (r.status === 'to_do' && r.actBy && r.actBy < today) return { text: `Act by ${shortRelative(r.actBy, today, { deadline: true })}`, tone: 'late' };
    if (r.neededBy) return { text: `Needed ${shortRelative(r.neededBy, today, { deadline: true })}`, tone: 'late' };
  }
  if (r.isLate && r.expected && r.lateText) return { text: `Expected ${shortRelative(r.expected, today)}, ${r.lateText}`, tone: 'plain' };
  if (r.status === 'to_do' && r.actBy) return { text: `Act by ${shortRelative(r.actBy, today, { deadline: true })}`, tone: 'plain' };
  if (r.expected) return { text: `Expected ${shortRelative(r.expected, today)}`, tone: 'plain' };
  if (r.neededBy) return { text: `Needed ${shortRelative(r.neededBy, today, { deadline: true })}`, tone: 'plain' };
  return { text: 'No date', tone: 'muted' };
}

/** "Mon 21 Sep, in 4 days" for a step that hasn't started; "Under way, until Fri 25 Sep" for one that has. */
export function stepWhen(s: { start: ISODate; end: ISODate; underWay: boolean }, today: ISODate): string {
  if (s.underWay) return `Under way, until ${formatDate(s.end, today)}`;
  return shortRelative(s.start, today);
}
