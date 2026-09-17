/**
 * How an item moves forward: the one status flow the waiting-on list, the
 * call list and the item sheet all share, so a button says the same thing
 * wherever it is pressed.
 *
 *   trade, inspection, defect   to do -> Mark booked    -> Mark confirmed -> Mark done
 *   material                    to do -> Mark ordered   -> Mark confirmed -> Mark done
 *   consultant report, council  to do -> Mark requested -> Mark received  -> Mark done
 *   decision, reminder,
 *   condition of consent        to do -> Mark done
 *
 * "booked" is the model's "ordered or booked" status, which also stands for
 * "requested" on a report or council request; "confirmed" stands for
 * "received" there. Pure: no UI, no data layer.
 */
import type { Item, ItemStatus, ItemType } from './types';

export interface NextStep {
  /** The status the primary action moves the item to. */
  status: ItemStatus;
  /** The button's words: exactly what happens. */
  label: string;
}

const REQUESTED: ItemType[] = ['consultant_report', 'council_request'];
const STRAIGHT_TO_DONE: ItemType[] = ['decision', 'manual_reminder', 'condition_of_consent'];

/** The next status and its words, or null when the item is done. */
export function nextStatus(item: Pick<Item, 'type' | 'status'>): NextStep | null {
  const requested = REQUESTED.includes(item.type);
  switch (item.status) {
    case 'to_do':
      if (item.type === 'material') return { status: 'booked', label: 'Mark ordered' };
      if (requested) return { status: 'booked', label: 'Mark requested' };
      if (STRAIGHT_TO_DONE.includes(item.type)) return { status: 'done', label: 'Mark done' };
      return { status: 'booked', label: 'Mark booked' };
    case 'booked':
      return { status: 'confirmed', label: requested ? 'Mark received' : 'Mark confirmed' };
    case 'confirmed':
      return { status: 'done', label: 'Mark done' };
    default:
      return null;
  }
}

/** The primary button's words, or null when there is nothing left to do. */
export function advanceLabel(item: Pick<Item, 'type' | 'status'>): string | null {
  return nextStatus(item)?.label ?? null;
}
