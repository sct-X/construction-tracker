/**
 * The hold-point photo check (rule 6), as one block so the step detail
 * (Stage 2) and the hold-point screen (Stage 5) draw the same thing.
 *
 *   Before-cover photos          1 of 3 required photo sets uploaded
 *   Steel reinforcement in place          4 photos
 *   Plumbing under slab                   none yet
 *   Membrane and termite barrier          none yet
 *   [refusal sentence, when a "Mark done" was refused]
 *   Add photos now
 *
 * Only uploaded photos count; queued ones are named separately so the reader
 * knows why the count has not moved yet. Words carry the state ("none yet",
 * "4 photos"); the wash only agrees with them.
 */
import type { HoldPointCheck as Check } from '../domain/forecast';
import { StatusText } from './StatusText';
import './holdPointCheck.css';

export function readinessWords(check: Check): string {
  const filled = check.required.filter((r) => r.uploadedCount > 0).length;
  const n = check.required.length;
  if (n === 0) return 'No required photo sets for this hold point';
  return `${filled} of ${n} required photo set${n === 1 ? '' : 's'} uploaded`;
}

export interface HoldPointCheckProps {
  check: Check;
  /** The refusal sentence from `setStepStatus`, shown inline until the next attempt. */
  refusal?: string;
  /** Photos for this job still in the phone's queue: they do not count yet. */
  queuedCount?: number;
  /** Where "Add photos now" goes (the upload screen with the stage set). Omit to hide it. */
  uploadHref?: string;
  /** A compact list without the heading, for the overview. */
  compact?: boolean;
  testId?: string;
}

export function HoldPointCheck({ check, refusal, queuedCount = 0, uploadHref, compact, testId }: HoldPointCheckProps) {
  return (
    <div className={compact ? 'holdpoint holdpoint--compact' : 'holdpoint'} data-testid={testId}>
      {!compact && (
        <div className="holdpoint__head">
          <h2 className="holdpoint__title">Before-cover photos</h2>
          <StatusText tone={check.ok ? 'ok' : 'amber'} testId="holdpoint-readiness">
            {readinessWords(check)}
          </StatusText>
        </div>
      )}
      {check.required.length > 0 && (
        <ul className="holdpoint__list">
          {check.required.map((r) => {
            const has = r.uploadedCount > 0;
            return (
              <li key={r.categoryId} className="holdpoint__row" data-testid={`holdpoint-category-${r.categoryId}`}>
                <span className="holdpoint__name">{r.name}</span>
                <StatusText tone={has ? 'ok' : 'amber'} plain={has}>
                  {has ? `${r.uploadedCount} photo${r.uploadedCount === 1 ? '' : 's'}` : 'none yet'}
                </StatusText>
              </li>
            );
          })}
        </ul>
      )}
      {refusal && (
        <p className="holdpoint__refusal" role="alert" data-testid="holdpoint-refusal">
          {refusal}
        </p>
      )}
      {queuedCount > 0 && (
        <p className="holdpoint__queued" data-testid="holdpoint-queued">
          {queuedCount} photo{queuedCount === 1 ? ' is' : 's are'} waiting to upload. You can tick this off once they've sent.
        </p>
      )}
      {uploadHref && !check.ok && (
        <a className="btn holdpoint__upload" href={`#${uploadHref}`} data-testid="holdpoint-add-photos">
          Add photos now
        </a>
      )}
    </div>
  );
}
