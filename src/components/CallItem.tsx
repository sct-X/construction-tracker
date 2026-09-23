/**
 * One line of the call script (UI_PLAN 3.11). The act-by date leads in the
 * condensed face, because that is the question Dominic asks first: "you were
 * meant to book this by Friday, is it booked?". Under the title, in words:
 * what it is for, who it is waiting on (with "Ring 0411 …" as a tel:
 * button row), what is expected and how late. Then one primary action in words
 * ("Mark booked", "Mark confirmed", "Mark done"), an inline expected date, a
 * note, and Skip.
 *
 * Desktop draws these as cells of one row (act-by | words | action); the
 * phone stacks them as a card with the one action at 56px. On both, the
 * expected date, note and Skip sit behind "Date, note, skip" (the M and N
 * keys open it). The action is outlined: the screen's hi-vis goes to
 * Finish call.
 * A handled row folds into the job's "Done this call" strip in a sentence.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Item, ItemStatus, Step, Trade } from '../domain/types';
import { ITEM_STATUS_LABELS } from '../domain/types';
import type { ItemForecast } from '../domain/forecast';
import { calendarDaysBetween, formatShort, formatShortRelative, relativeDate } from '../domain/dates';
import { nextStatus } from '../domain/itemFlow';
import { ITEM_TYPE_WORDS } from './ItemRow';
import { StatusText, type Tone } from './StatusText';
import './callItem.css';

export interface Handled {
  /** "booked", "confirmed for Wed 23 Sep", "expected moved to Mon 12 Oct. Beatty St finish moves +7 days, $2,000" */
  words: ReactNode;
  skipped?: boolean;
}

export interface CallItemProps {
  item: Item;
  forecast?: ItemForecast;
  step?: Step;
  trade?: Trade;
  today: string;
  offline: boolean;
  layout: 'phone' | 'desktop';
  /** Who is on the phone ("Raff"), for the note's placeholder. */
  personName?: string;
  /** The row keyboard shortcuts act on (desktop). */
  current?: boolean;
  handled?: Handled;
  /** Primary action: move the status forward (confirm carries the date the trade is coming). */
  onAdvance: (status: ItemStatus, confirmedFor?: string) => void;
  onExpected: (date: string) => void;
  onNote: (text: string) => void;
  onSkip: () => void;
  onReopen: () => void;
  /** Set by the list to drive C / M / N from the keyboard. */
  registerFocus?: (fns: { confirm: () => void; expected: () => void; note: () => void; advance: () => void; skip: () => void }) => void;
}

export function CallItem(props: CallItemProps) {
  const { item, forecast: f, step, trade, today, offline, layout, current, handled } = props;
  const phone = layout === 'phone';
  const [confirming, setConfirming] = useState(false);
  const [confirmFor, setConfirmFor] = useState(item.expectedDate ?? f?.neededBy ?? today);
  const [note, setNote] = useState(item.notes ?? '');
  const [more, setMore] = useState(false);
  const confirmRef = useRef<HTMLInputElement>(null);
  const expectedRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLInputElement>(null);
  const next = nextStatus(item);

  useEffect(() => setNote(item.notes ?? ''), [item.notes]);

  const advance = () => {
    if (!next) return;
    if (next.status === 'confirmed') {
      setConfirming(true);
      setTimeout(() => confirmRef.current?.focus(), 0);
      return;
    }
    props.onAdvance(next.status);
  };
  const confirmNow = () => {
    props.onAdvance('confirmed', offline ? undefined : confirmFor);
    setConfirming(false);
  };
  const saveNote = () => {
    if (note !== (item.notes ?? '')) props.onNote(note);
  };

  useEffect(() => {
    props.registerFocus?.({
      advance,
      confirm: () => {
        if (item.status === 'booked') advance();
      },
      expected: () => {
        setMore(true);
        setTimeout(() => expectedRef.current?.focus(), 0);
      },
      note: () => {
        setMore(true);
        setTimeout(() => noteRef.current?.focus(), 0);
      },
      skip: props.onSkip,
    });
  });

  const id = item.id;

  if (handled) {
    return (
      <li className={handled.skipped ? 'callitem callitem--folded callitem--skipped' : 'callitem callitem--folded'} data-testid={`call-done-${id}`}>
        <span className="callitem__folded-title">{item.title}</span>
        <span className="callitem__folded-words">{handled.words}</span>
        <button type="button" className="callitem__text-btn" onClick={props.onReopen} data-testid={`call-reopen-${id}`}>
          Back on the list
        </button>
      </li>
    );
  }

  // Act-by: the lead figure and its words.
  const actBy = f?.actBy;
  let actTone: Tone = 'plain';
  let actWords = 'No act-by date';
  if (actBy) {
    const n = calendarDaysBetween(actBy, today);
    actWords = `act by, ${relativeDate(actBy, today, { deadline: item.status === 'to_do' || item.status === 'booked' })}`;
    if (n > 0 && item.status === 'to_do') actTone = 'amber';
    else if (n > 0) actTone = 'muted';
    else if (n === 0) actTone = 'amber';
  }
  if (f?.isLate) actTone = 'late';

  const forWords = step
    ? `For ${step.name}${f?.neededBy ? `, ${formatShortRelative(f.neededBy, today, { deadline: item.status !== 'done' })}` : ''}`
    : f?.neededBy
      ? `Needed ${formatShortRelative(f.neededBy, today, { deadline: item.status !== 'done' })}`
      : null;
  const expectedWords = f?.expected
    ? f.isLate && f.lateText
      ? { text: `Expected ${formatShortRelative(f.expected, today)}, ${f.lateText}`, tone: 'late' as Tone }
      : { text: `Expected ${formatShortRelative(f.expected, today)}`, tone: 'plain' as Tone }
    : f?.isLate && f.lateText
      ? { text: `Nothing expected yet, ${f.lateText}`, tone: 'late' as Tone }
      : null;
  const fromShipment = !!f?.expectedFromShipmentId;
  const dateLocked = offline || fromShipment;
  const dateNote = offline ? 'Needs signal' : fromShipment ? 'Comes from the shipment' : null;

  const secondary = (
    <div className="callitem__more" data-testid={`call-more-${id}`}>
      <label className="callitem__field">
        <span className="callitem__field-label">Expected</span>
        <input
          ref={expectedRef}
          type="date"
          className="callitem__input"
          value={item.expectedDate ?? f?.expected ?? ''}
          onChange={(e) => e.target.value && props.onExpected(e.target.value)}
          disabled={dateLocked}
          aria-label={`Expected date for ${item.title}`}
          data-testid={`call-expected-${id}`}
        />
        {dateNote && <span className="callitem__hint">{dateNote}</span>}
      </label>
      <label className="callitem__field callitem__field--note">
        <span className="callitem__field-label">Note</span>
        <input
          ref={noteRef}
          type="text"
          className="callitem__input"
          value={note}
          placeholder={`What ${props.personName ?? 'they'} said`}
          onChange={(e) => setNote(e.target.value)}
          onBlur={saveNote}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              saveNote();
              (e.target as HTMLInputElement).blur();
            }
          }}
          aria-label={`Note on ${item.title}`}
          data-testid={`call-note-${id}`}
        />
      </label>
      <button type="button" className="callitem__text-btn callitem__skip" onClick={props.onSkip} data-testid={`call-skip-${id}`}>
        Skip
      </button>
    </div>
  );

  return (
    <li className={['callitem', current ? 'callitem--current' : '', phone ? 'callitem--card' : ''].filter(Boolean).join(' ')} data-testid={`call-item-${id}`} aria-current={current ? 'true' : undefined}>
      <div className="callitem__act">
        <span className={`callitem__act-date display callitem__act-date--${actTone}`} data-testid={`call-actby-${id}`}>
          {actBy ? formatShort(actBy) : '—'}
        </span>
        <StatusText tone={actTone} plain={actTone === 'plain'} className="callitem__act-words">
          {actWords}
        </StatusText>
      </div>

      <div className="callitem__main">
        <p className="callitem__head">
          <span className="callitem__type">{ITEM_TYPE_WORDS[item.type]}</span>
          <a className="callitem__title" href={`#/items/${id}`}>
            {item.title}
          </a>
          <span className="callitem__status">{ITEM_STATUS_LABELS[item.status]}</span>
        </p>
        {forWords && <p className="callitem__line">{forWords}</p>}
        {(item.waitingOn || trade) && <p className="callitem__line">Waiting on {trade?.name ?? item.waitingOn}</p>}
        {trade?.phone && (
          <a className="btn btn--ghost btn--desktop callitem__phone num" href={`tel:${trade.phone.replace(/\s+/g, '')}`} data-testid={`call-phone-${id}`}>
            Ring {trade.phone}
          </a>
        )}
        {expectedWords && (
          <p className="callitem__line">
            <StatusText tone={expectedWords.tone} plain={expectedWords.tone === 'plain'} className="callitem__expected-words">
              {expectedWords.text}
            </StatusText>
          </p>
        )}
        {item.notes && !phone && <p className="callitem__note-was">{item.notes}</p>}
      </div>

      <div className="callitem__do">
        {next && !confirming && (
          <button type="button" className="btn btn--desktop callitem__primary" onClick={advance} data-testid={`call-action-${id}`}>
            {next.label}
          </button>
        )}
        {confirming && (
          <div className="callitem__confirm" data-testid={`call-confirming-${id}`}>
            <label className="callitem__field">
              <span className="callitem__field-label">Confirmed for</span>
              <input
                ref={confirmRef}
                type="date"
                className="callitem__input"
                value={confirmFor}
                onChange={(e) => setConfirmFor(e.target.value)}
                disabled={dateLocked}
                data-testid={`call-confirm-date-${id}`}
              />
              {dateNote && <span className="callitem__hint">{dateNote}</span>}
            </label>
            <span className="callitem__confirm-btns">
              <button type="button" className="btn btn--fill btn--desktop" onClick={confirmNow} data-testid={`call-confirm-${id}`}>
                Confirm
              </button>
              <button type="button" className="callitem__text-btn" onClick={() => setConfirming(false)}>
                Not yet
              </button>
            </span>
          </div>
        )}
        {!confirming && (
          <button type="button" className="callitem__text-btn callitem__more-toggle" onClick={() => setMore((m) => !m)} aria-expanded={more} data-testid={`call-more-toggle-${id}`}>
            {more ? 'Less' : 'Date, note, skip'}
          </button>
        )}
      </div>

      {more && secondary}
    </li>
  );
}
