/** Plain-English wording shared by the screens. Pure, so tests can check the words. */
import {
  formatDate,
  isISODate,
  ITEM_STATUS_LABELS,
  SHIPMENT_STATUS_LABELS,
  STEP_STATUS_LABELS,
  type HistoryChange,
  type ISODate,
} from '@ct/core';

/** Over 7 days unconfirmed reads as the problem ("Not confirmed for 9 days"); otherwise the calm version. Words only, never a colour. */
export function freshnessWords(f: { amber: boolean; daysUnconfirmed?: number | null; freshnessText: string }): string {
  if (!f.amber) return f.freshnessText;
  if (f.daysUnconfirmed === null || f.daysUnconfirmed === undefined) {
    const m = /(\d+) days? ago/.exec(f.freshnessText);
    return m ? `Not confirmed for ${m[1]} days` : 'Never confirmed';
  }
  return `Not confirmed for ${f.daysUnconfirmed} day${f.daysUnconfirmed === 1 ? '' : 's'}`;
}

/** "expectedDate" -> "expected date". */
/** Setup fields whose names don't read well split up. */
const FIELD_WORDS: Record<string, string> = {
  durationDays: 'working days',
  leadTimeWeeks: 'lead time in weeks',
  isHoldPoint: 'hold point',
  tradeType: 'trade',
  weeklyHoldingCost: 'weekly holding cost',
};

export function fieldWords(field: string): string {
  if (FIELD_WORDS[field]) return FIELD_WORDS[field];
  return field
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/\beta\b/, 'ETA');
}

const STATUS_LABELS: Record<string, Record<string, string>> = {
  shipment: SHIPMENT_STATUS_LABELS,
  item: ITEM_STATUS_LABELS,
  step: STEP_STATUS_LABELS,
};

/** A before or after value, in words. */
export function valueWords(change: Pick<HistoryChange, 'table' | 'field'>, value: unknown, today: ISODate): string {
  if (value === null || value === undefined || value === '') return 'nothing';
  if (typeof value === 'string' && isISODate(value)) return formatDate(value, today);
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (change.field === 'status' && typeof value === 'string') {
    return STATUS_LABELS[change.table]?.[value] ?? value.replace(/_/g, ' ');
  }
  if (typeof value === 'object') return 'a record';
  return String(value);
}

/** "Mon 14 Sep to Thu 17 Sep", or one date when start and end are the same day. */
export function rangeWords(start: ISODate | null, end: ISODate | null, today: ISODate): string {
  if (!start && !end) return 'No dates';
  if (!start || !end) return formatDate((start ?? end)!, today);
  if (start === end) return formatDate(start, today);
  return `${formatDate(start, today)} to ${formatDate(end, today)}`;
}

export function plural(n: number, noun: string, many = `${noun}s`): string {
  return `${n} ${n === 1 ? noun : many}`;
}

/** Stand-in "today" before the data layer has said what today is: every date then prints with its year. */
export const UNKNOWN_TODAY = '0000-01-01';
