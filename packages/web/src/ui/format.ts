/** Plain-English wording shared by the screens. Pure, so tests can check the words. */
import {
  formatDate,
  formatDays,
  isISODate,
  ITEM_STATUS_LABELS,
  SHIPMENT_STATUS_LABELS,
  STEP_STATUS_LABELS,
  type HistoryChange,
  type ISODate,
} from '@ct/core';

export interface SlipWords {
  /** The number: "+14 days", "-2 days", "On track", or a dash before the first snapshot. */
  big: string;
  /** What it is measured against, in words. */
  small: string;
  direction: 'later' | 'earlier' | 'same' | 'none';
}

export function slipWords(slipDays: number | null, snapshotDate: ISODate | null, today: ISODate): SlipWords {
  if (slipDays === null || !snapshotDate) {
    return { big: '–', small: 'Slip appears after the first Monday', direction: 'none' };
  }
  const when = formatDate(snapshotDate, today);
  if (slipDays === 0) return { big: 'On track', small: `Same as ${when}`, direction: 'same' };
  return slipDays > 0
    ? { big: formatDays(slipDays), small: `Later than ${when}`, direction: 'later' }
    : { big: formatDays(slipDays), small: `Earlier than ${when}`, direction: 'earlier' };
}

/** Amber reads as the problem ("Not confirmed for 9 days"); otherwise the calm version. */
export function freshnessWords(f: { amber: boolean; daysUnconfirmed?: number | null; freshnessText: string }): string {
  if (!f.amber) return f.freshnessText;
  if (f.daysUnconfirmed === null || f.daysUnconfirmed === undefined) {
    const m = /(\d+) days? ago/.exec(f.freshnessText);
    return m ? `Not confirmed for ${m[1]} days` : 'Never confirmed';
  }
  return `Not confirmed for ${f.daysUnconfirmed} day${f.daysUnconfirmed === 1 ? '' : 's'}`;
}

/** "expectedDate" -> "expected date". */
export function fieldWords(field: string): string {
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
