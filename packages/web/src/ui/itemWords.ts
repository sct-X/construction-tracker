/**
 * Wording for phone numbers, shipments and counts. Pure, so tests can check
 * the words. Colour on the screens always sits next to one of these.
 */
import { calendarDaysBetween, type ISODate, type ShipmentStatus } from '@ct/core';

/** "0491 570 158" -> "tel:0491570158"; keeps a leading +. Null when there are no digits. */
export function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const plus = phone.trim().startsWith('+') ? '+' : '';
  const digits = phone.replace(/\D/g, '');
  return digits ? `tel:${plus}${digits}` : null;
}

/** v1: "1 week", "10 days", "2 weeks": whole weeks read as weeks, the rest as days. */
export function gapWords(days: number): string {
  const n = Math.abs(days);
  if (n >= 7 && n % 7 === 0) {
    const w = n / 7;
    return `${w} ${w === 1 ? 'week' : 'weeks'}`;
  }
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}

/**
 * v1 Shipments: the ETA read against the earliest needed-by, in words ("ETA 1
 * week before needed", "ETA 2 weeks after needed"). Two future dates that clash
 * are plain words, never red (red is overdue only); before needed is the ok tone.
 */
export function shipmentTiming(r: { eta: ISODate | null; earliestNeededBy: ISODate | null; status: ShipmentStatus }): { text: string; tone: 'ok' | 'plain' | 'muted' } {
  if (r.status === 'delivered') return { text: 'Delivered', tone: 'ok' };
  if (!r.eta) return { text: 'No ETA yet', tone: 'muted' };
  if (!r.earliestNeededBy) return { text: 'Nothing waiting on it', tone: 'muted' };
  const gap = calendarDaysBetween(r.earliestNeededBy, r.eta);
  if (gap > 0) return { text: `ETA ${gapWords(gap)} after needed`, tone: 'plain' };
  if (gap === 0) return { text: 'ETA on the day it is needed', tone: 'plain' };
  return { text: `ETA ${gapWords(gap)} before needed`, tone: 'ok' };
}

/** "1 photo", "4 photos", "No photos yet". */
export function photoCount(n: number): string {
  return n === 0 ? 'No photos yet' : `${n} photo${n === 1 ? '' : 's'}`;
}

export function plural(n: number, noun: string, many = `${noun}s`): string {
  return `${n} ${n === 1 ? noun : many}`;
}
