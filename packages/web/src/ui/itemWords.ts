/**
 * Stage 4b wording for items, shipments and phone numbers. Pure, so tests can
 * check the words. Colour on these screens always sits next to one of these.
 */
import { calendarDaysBetween, formatDate, relativeDays, type ISODate, type ShipmentStatus, type WaitingRow } from '@ct/core';

function days(n: number): string {
  return `${n} day${n === 1 ? '' : 's'}`;
}

export type Urgency = 'late' | 'overdue' | 'none';

/**
 * Why a row needs attention, in words: "3 days overdue" (needed-by gone and
 * nothing expected, or the expected date gone too), "Act-by passed 38 days
 * ago" (still to do), "Expected 2 days after needed". Null when nothing is wrong.
 */
export function urgencyWords(
  r: Pick<WaitingRow, 'status' | 'neededBy' | 'actBy' | 'expected' | 'isLate' | 'lateDays' | 'overdue'>,
  today: ISODate,
): { text: string; level: Urgency } | null {
  if (r.status === 'done') return null;
  if (r.neededBy && r.neededBy < today && (!r.expected || r.expected < today)) {
    return { text: `${days(calendarDaysBetween(r.neededBy, today))} overdue`, level: 'overdue' };
  }
  if (r.isLate && r.lateDays > 0) return { text: `Expected ${days(r.lateDays)} after it's needed`, level: 'late' };
  if (r.status === 'to_do' && r.actBy && r.actBy < today) {
    return { text: `Act-by passed ${days(calendarDaysBetween(r.actBy, today))} ago`, level: 'overdue' };
  }
  return null;
}

/** "Fri 18 Sep" plus how far off it is: "tomorrow", "38 days ago". */
export function dateAndDistance(iso: ISODate | null, today: ISODate): { date: string; distance: string } | null {
  if (!iso) return null;
  return { date: formatDate(iso, today), distance: relativeDays(iso, today) };
}

/** "0491 570 158" -> "tel:0491570158"; keeps a leading +. Null when there are no digits. */
export function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const plus = phone.trim().startsWith('+') ? '+' : '';
  const digits = phone.replace(/\D/g, '');
  return digits ? `tel:${plus}${digits}` : null;
}

export const SHIPMENT_STEPS: { status: ShipmentStatus; label: string }[] = [
  { status: 'design', label: 'Design' },
  { status: 'in_production', label: 'In production' },
  { status: 'shipped', label: 'Shipped' },
  { status: 'delivered', label: 'Delivered' },
];

/** "In production, step 2 of 4". */
export function shipmentStepWords(status: ShipmentStatus): string {
  const i = SHIPMENT_STEPS.findIndex((s) => s.status === status);
  return `${SHIPMENT_STEPS[i]?.label ?? status}, step ${i + 1} of ${SHIPMENT_STEPS.length}`;
}

/** Against the earliest needed-by: "14 days late", "7 days to spare", "Arrives the day it's needed". */
export function shipmentTimingWords(r: { eta: ISODate | null; earliestNeededBy: ISODate | null; isLate: boolean; lateDays: number; status: ShipmentStatus }): string {
  if (r.status === 'delivered') return 'Delivered';
  if (!r.eta) return 'No ETA yet';
  if (!r.earliestNeededBy) return 'Nothing waiting on it yet';
  if (r.isLate) return `${days(r.lateDays)} late`;
  const spare = calendarDaysBetween(r.eta, r.earliestNeededBy);
  return spare === 0 ? "Arrives the day it's needed" : `${days(spare)} to spare`;
}

/** "1 photo", "4 photos", "No photos yet". */
export function photoCount(n: number): string {
  return n === 0 ? 'No photos yet' : `${n} photo${n === 1 ? '' : 's'}`;
}

export function plural(n: number, noun: string, many = `${noun}s`): string {
  return `${n} ${n === 1 ? noun : many}`;
}
