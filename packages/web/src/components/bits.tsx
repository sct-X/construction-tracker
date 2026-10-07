import type { ReactNode } from 'react';
import { formatMoney } from '@ct/core';
import { freshnessWords } from '../ui/format';

/** Money draws nothing, label included, when the value is missing. */
export function Money({ amount, className, testId }: { amount: number | null | undefined; className?: string; testId?: string }) {
  if (amount === null || amount === undefined) return null;
  return (
    <span className={className} data-testid={testId}>
      {formatMoney(amount)}
    </span>
  );
}

/** Last confirmed. Amber always comes with the words "Not confirmed for N days". */
export function Freshness(props: { amber: boolean; daysUnconfirmed?: number | null; freshnessText: string; testId?: string }) {
  const words = freshnessWords(props);
  return (
    <span className={props.amber ? 'fresh fresh-amber' : 'fresh'} data-testid={props.testId} data-amber={props.amber ? 'true' : 'false'}>
      {words}
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
