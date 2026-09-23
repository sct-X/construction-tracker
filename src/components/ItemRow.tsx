/**
 * One compact waiting-on item, the same row wherever an item is listed
 * (job overview, step detail, and Stage 4's waiting-on list and call list).
 *
 *   type · title
 *   waiting on X, with Raff                 act by Mon 10 Aug   [To do]
 *
 * Dates are words from the calculator (act-by, needed-by, expected, late),
 * never a bare colour: "Expected Mon 5 Oct, in 12 days, 7 days after needed". The row is a link when
 * `href` is given (Alec has no item screen, so his rows are plain). An
 * optional `action` (a button) sits to the right, outside the link.
 */
import type { ReactNode } from 'react';
import { useSession } from '../data/context';
import type { Item, ItemStatus, ItemType } from '../domain/types';
import { ITEM_STATUS_LABELS } from '../domain/types';
import type { ItemForecast } from '../domain/forecast';
import { formatShort, formatShortRelative } from '../domain/dates';
import { StatusText, type Tone } from './StatusText';
import './itemRow.css';

export const ITEM_TYPE_WORDS: Record<ItemType, string> = {
  trade: 'Trade',
  material: 'Material',
  decision: 'Decision',
  consultant_report: 'Report',
  council_request: 'Council',
  inspection: 'Inspection',
  defect: 'Defect',
  condition_of_consent: 'Condition',
  manual_reminder: 'Reminder',
};

/** The one date phrase a row shows, and its tone. Every date carries its relative time. */
export function itemWhenWords(f: ItemForecast | undefined, status: ItemStatus, today: string): { text: string; tone: Tone } | null {
  if (!f) return null;
  const open = status !== 'done';
  // An act-by gone while still to do is overdue even with a date expected: say so first.
  if (f.actByPassed && f.actBy) return { text: `Act by ${formatShortRelative(f.actBy, today, { deadline: true })}`, tone: 'late' };
  // Expected after it is needed: two future dates that clash, plain words, never red.
  if (f.isLate && f.expected) return { text: `Expected ${formatShortRelative(f.expected, today)}, ${f.lateText}`, tone: 'plain' };
  // lateText here is the relative time itself ("overdue by 3 days").
  if (f.isLate && f.neededBy) return { text: `Needed ${formatShort(f.neededBy)}, ${f.lateText}`, tone: 'late' };
  // Needed-by and expected both gone, still not ticked off: overdue on the needed-by.
  if (open && f.expected && f.neededBy && f.neededBy < today && f.expected < today)
    return { text: `Needed ${formatShortRelative(f.neededBy, today, { deadline: true })}`, tone: 'late' };
  if (f.expected && open) return { text: `Expected ${formatShortRelative(f.expected, today)}`, tone: 'plain' };
  if (status === 'to_do' && f.actBy) return { text: `Act by ${formatShortRelative(f.actBy, today, { deadline: true })}`, tone: 'plain' };
  if (f.neededBy) return { text: `Needed ${formatShortRelative(f.neededBy, today, { deadline: open })}`, tone: 'plain' };
  return null;
}

export interface ItemRowProps {
  item: Item;
  /** From `getForecast(jobId).items[item.id]`; without it the row shows no dates. */
  forecast?: ItemForecast;
  /** The owner's short name ("Raff"); the current person reads "with you". */
  ownerName?: string;
  /** Link target, e.g. `/items/${item.id}`. Omit for a plain row. */
  href?: string;
  /** Extra words on the right of the title, e.g. the job name on a cross-job list. */
  context?: string;
  /** A control on the right, outside the link (Stage 4's status advance, Finish call). */
  action?: ReactNode;
  /**
   * Replaces the row's one date phrase (the waiting-on list says "Act by
   * Mon 10 Aug, 5 weeks ago" where the default would say "Expected 26 Oct").
   * `null` draws no date line; undefined keeps the default from the calculator.
   */
  when?: { text: string; tone: Tone } | null;
  testId?: string;
}

export function ItemRow({ item, forecast, ownerName, href, context, action, when: whenOverride, testId }: ItemRowProps) {
  const { personId, today } = useSession();
  const when = whenOverride === undefined ? itemWhenWords(forecast, item.status, today) : whenOverride;
  const flagged = when?.tone === 'late' || when?.tone === 'amber';
  const owner = item.ownerId && item.ownerId === personId ? 'you' : ownerName;
  const who = [item.waitingOn ? `waiting on ${item.waitingOn}` : '', owner ? `with ${owner}` : ''].filter(Boolean).join(', ');
  const body = (
    <>
      <span className="itemrow__type">{ITEM_TYPE_WORDS[item.type]}</span>
      <span className="itemrow__main">
        <span className="itemrow__head">
          <span className="itemrow__title">{item.title}</span>
          {context ? <span className="itemrow__context">{context}</span> : null}
        </span>
        {who ? <span className="itemrow__who">{who}</span> : null}
      </span>
      <span className="itemrow__side">
        {when ? (
          <StatusText tone={when.tone} plain={when.tone === 'plain'} className="itemrow__when">
            {when.text}
          </StatusText>
        ) : null}
        <span className="itemrow__status">{ITEM_STATUS_LABELS[item.status]}</span>
      </span>
    </>
  );
  const classes = ['itemrow', flagged ? 'itemrow--flagged' : '', href ? 'itemrow--link' : ''].filter(Boolean).join(' ');
  const id = testId ?? `item-row-${item.id}`;
  return (
    <li className={action ? 'itemrow__li itemrow__li--with-action' : 'itemrow__li'}>
      {href ? (
        <a className={classes} href={`#${href}`} data-testid={id}>
          {body}
        </a>
      ) : (
        <div className={classes} data-testid={id}>
          {body}
        </div>
      )}
      {action ? <span className="itemrow__action">{action}</span> : null}
    </li>
  );
}

/** The list the rows sit in. */
export function ItemRowList({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <ul className="itemrow__list" data-testid={testId}>
      {children}
    </ul>
  );
}
