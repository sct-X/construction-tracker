import type { ReactNode } from 'react';
import { freshnessWords } from '../ui/format';

/**
 * Last confirmed, in words only (SPEC revision: no amber in the web). Rule 7's
 * "more than 7 days" reads "Not confirmed for 9 days"; data-unconfirmed says so for tests.
 */
export function Freshness(props: { amber: boolean; daysUnconfirmed?: number | null; freshnessText: string; testId?: string }) {
  return (
    <span className="fresh" data-testid={props.testId} data-unconfirmed={props.amber ? 'true' : 'false'}>
      {freshnessWords(props)}
    </span>
  );
}

/**
 * Label shown above a value on a phone card, and read by screen readers there (Safari drops table
 * semantics once cells are display:block, and the phone hides the thead). display:none on desktop,
 * where the column header says it.
 */
export function CellLabel({ children }: { children: ReactNode }) {
  return <span className="cell-label">{children} </span>;
}

export function LoadingRows({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div className="loading" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="loading-row" />
      ))}
    </div>
  );
}

export function LoadError({ what, error, retry }: { what: string; error: string; retry: () => void }) {
  return (
    <div className="load-error" role="alert">
      <p>
        Couldn't load {what}. {error}
      </p>
      <button type="button" className="btn" onClick={retry}>
        Try again
      </button>
    </div>
  );
}
