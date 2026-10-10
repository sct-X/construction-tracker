/**
 * One compact item row (ported from v1 src/components/ItemRow.tsx), the same
 * row on step detail and the design checklist. Read-only: no status buttons.
 *
 *   Report   Fire engineering report, revision B     outstanding 23 days   Ordered or booked
 *            waiting on Lote Consulting, with you
 *
 * The one date phrase comes from `whenWords` (ui/when.ts): red only when the
 * item is overdue, and then the words say "overdue" too. A row with a trade
 * phone gets a Call glass button beside it (v1 Waiting on).
 */
import type { ReactNode } from 'react';
import type { ItemType, WaitingRow } from '@ct/core';
import { StatusText, type Tone } from './StatusText';
import { telHref } from '../ui/itemWords';
import { PhoneGlyph } from '../shell/icons';
import '../styles/itemrow.css';

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

/** The one person the app knows (SPEC: Dominic is the only user): his items read "with you". */
const ME = 'dominic';

export function whoWords(r: Pick<WaitingRow, 'waitingOn' | 'owner'>): string {
  const owner = r.owner ? (r.owner.toLowerCase() === ME ? 'you' : r.owner) : null;
  return [r.waitingOn ? `waiting on ${r.waitingOn}` : '', owner ? `with ${owner}` : ''].filter(Boolean).join(', ');
}

export function ItemRow({
  row,
  when,
  testId,
  call = true,
}: {
  row: Pick<WaitingRow, 'itemId' | 'type' | 'title' | 'waitingOn' | 'owner' | 'statusLabel'> & Partial<Pick<WaitingRow, 'tradePhone' | 'tradeName'>>;
  /** The date phrase; null draws none. */
  when: { text: string; tone: Tone } | null;
  testId?: string;
  call?: boolean;
}) {
  const who = whoWords(row);
  const flagged = when?.tone === 'late';
  const tel = call ? telHref(row.tradePhone) : null;
  const callName = row.tradeName ?? row.waitingOn ?? 'the trade';
  return (
    <li className={tel ? 'itemrow__li itemrow__li--with-action' : 'itemrow__li'} data-testid={testId ?? `item-row-${row.itemId}`} data-overdue={flagged ? 'true' : 'false'}>
      <div className={flagged ? 'itemrow itemrow--flagged' : 'itemrow'}>
        <span className="itemrow__type">{ITEM_TYPE_WORDS[row.type]}</span>
        <span className="itemrow__main">
          <span className="itemrow__title">{row.title}</span>
          {who ? <span className="itemrow__who">{who}</span> : null}
        </span>
        <span className="itemrow__side">
          {when ? (
            <StatusText tone={when.tone} plain={when.tone !== 'late'} className="itemrow__when" testId="when">
              {when.text}
            </StatusText>
          ) : null}
          <span className="itemrow__status">{row.statusLabel}</span>
        </span>
      </div>
      {tel && (
        <span className="itemrow__action">
          <a className="btn btn--glass itemrow__call" href={tel} data-testid="call" aria-label={`Call ${callName}, ${row.tradePhone}`} title={row.tradePhone ?? undefined}>
            <PhoneGlyph />
            <span className="itemrow__call-name">Call {callName}</span>
          </a>
        </span>
      )}
    </li>
  );
}

export function ItemRowList({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <ul className="itemrow__list" data-testid={testId}>
      {children}
    </ul>
  );
}
