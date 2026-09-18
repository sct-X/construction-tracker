/**
 * The hold-point photo check (rule 6), as one block so the step detail, the
 * overview, Today and (Stage 5) the notifications draw the same thing.
 *
 *   [refusal sentence, when a "Mark done" was refused: names the empty sets]
 *   Before-cover photos          1 of 3 required photo sets uploaded
 *   Steel reinforcement in place                        4 photos
 *   Plumbing under slab                                 none yet
 *     2 waiting to send, they don't count yet         Add photos
 *   Membrane and termite barrier                        none yet
 *                                                     Add photos
 *   Add photos now
 *
 * Only uploaded photos count; queued ones are named per set so the reader
 * knows why the count has not moved yet. Words carry the state ("none yet",
 * "4 photos"); the wash only agrees with them. Each empty set has its own
 * "Add photos" link straight into the upload screen with the stage and
 * category set (`addHref`), so the fix is one tap from the refusal; filled
 * sets get no link, since the block's job is getting the empty ones filled.
 * "Add photos now" (`uploadHref`, the stage set) is a quiet link, never a
 * second button: the screen's one hi-vis "Add photos" already sits above it
 * on Today, and the per-set links sit beside the empty rows on the step.
 */
import type { HoldPointCheck as Check } from '../domain/forecast';
import { holdPointReadinessWords } from '../domain/forecast';
import { useSession } from '../data/context';
import { StatusText } from './StatusText';
import './holdPointCheck.css';

/** "1 of 3 required photo sets uploaded" (the calculator's words, re-exported for the screens that import it here). */
export const readinessWords = holdPointReadinessWords;

export interface HoldPointCheckProps {
  check: Check;
  /** The refusal sentence from `setStepStatus`, shown inline until the next attempt. */
  refusal?: string;
  /** Photos for this step's required sets still in the phone's queue: they do not count yet. */
  queuedCount?: number;
  /** The same, per category id, for the "2 waiting to send" words on each row. */
  queuedByCategory?: Record<string, number>;
  /** Where "Add photos now" goes (the upload screen with the stage set). Omit to hide it. */
  uploadHref?: string;
  /** Per-category upload link (stage, category and the way back set). Omit to hide the row links. */
  addHref?: (categoryId: string) => string;
  /** A compact list without the heading, for the overview. */
  compact?: boolean;
  /** Whether the reader can mark the step done. Defaults to "not the site role". */
  canComplete?: boolean;
  testId?: string;
}

export function HoldPointCheck({
  check,
  refusal,
  queuedCount = 0,
  queuedByCategory = {},
  uploadHref,
  addHref,
  compact,
  canComplete,
  testId,
}: HoldPointCheckProps) {
  const { role } = useSession();
  const mayTick = canComplete ?? role !== 'site';
  const n = check.required.length;
  return (
    <div className={compact ? 'holdpoint holdpoint--compact' : 'holdpoint'} data-testid={testId}>
      {refusal && (
        <p className="holdpoint__refusal" role="alert" data-testid="holdpoint-refusal">
          {refusal}
        </p>
      )}
      {!compact && (
        <div className="holdpoint__head">
          <h2 className="holdpoint__title">Before-cover photos</h2>
          <StatusText tone={check.ok ? 'ok' : 'amber'} testId="holdpoint-readiness">
            {readinessWords(check)}
          </StatusText>
        </div>
      )}
      {n > 0 && (
        <ul className="holdpoint__list">
          {check.required.map((r) => {
            const has = r.uploadedCount > 0;
            const q = queuedByCategory[r.categoryId] ?? 0;
            const href = addHref?.(r.categoryId);
            return (
              <li key={r.categoryId} className="holdpoint__row" data-testid={`holdpoint-category-${r.categoryId}`}>
                <span className="holdpoint__name">{r.name}</span>
                <StatusText tone={has ? 'ok' : 'amber'} plain={has} className="holdpoint__count">
                  {has ? `${r.uploadedCount} photo${r.uploadedCount === 1 ? '' : 's'}` : 'none yet'}
                </StatusText>
                {q > 0 && (
                  <span className="holdpoint__row-queued" data-testid={`holdpoint-queued-${r.categoryId}`}>
                    {q} waiting to send, {q === 1 ? "it doesn't" : "they don't"} count yet
                  </span>
                )}
                {href && !compact && !has && (
                  <a className="holdpoint__add" href={`#${href}`} data-testid={`holdpoint-add-${r.categoryId}`}>
                    Add photos
                    <span className="sr-only">: {r.name}</span>
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!compact && n > 0 && check.ok && (
        <p className="holdpoint__ready" data-testid="holdpoint-ready">
          Every required set has a photo. {mayTick ? 'You can tick this off.' : 'The certifier has what they need.'}
        </p>
      )}
      {queuedCount > 0 && (
        <p className="holdpoint__queued" data-testid="holdpoint-queued">
          {queuedCount} photo{queuedCount === 1 ? ' is' : 's are'} waiting to upload. {mayTick ? "You can tick this off once they've sent." : "They count once they've sent."}
        </p>
      )}
      {uploadHref && !check.ok && (
        <a className="holdpoint__upload" href={`#${uploadHref}`} data-testid="holdpoint-add-photos">
          Add photos now
        </a>
      )}
    </div>
  );
}
