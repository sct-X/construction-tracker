/**
 * Slip in words and money: "+14 days, $9,000", "0", "-3 days, -$1,290".
 * Before the first Monday snapshot: a dash and "Slip appears after the first Monday".
 * The cost goes through <Money>, so the site role sees the days alone.
 */
import { formatDelta } from '../domain/dates';
import { Money } from './Money';
import './sliptext.css';

export interface SlipTextProps {
  days?: number;
  /** Money: undefined for the site role, or before the first snapshot. */
  cost?: number;
  className?: string;
  testId?: string;
}

export function slipTone(days: number | undefined): 'late' | 'ok' | 'muted' {
  if (days === undefined || days === 0) return 'muted';
  return days > 0 ? 'late' : 'ok';
}

export function SlipText({ days, cost, className, testId }: SlipTextProps) {
  const tone = slipTone(days);
  const classes = ['sliptext', `sliptext--${tone}`, className ?? ''].filter(Boolean).join(' ');
  if (days === undefined) {
    return (
      <span className={classes} data-testid={testId}>
        <span className="sliptext__days num" aria-hidden="true">
          –
        </span>
        <span className="sliptext__note">Slip appears after the first Monday</span>
      </span>
    );
  }
  return (
    <span className={classes} data-testid={testId}>
      <span className="sliptext__days num">{formatDelta(days)}</span>
      {days !== 0 && cost !== undefined ? (
        <>
          <span className="sliptext__sep">, </span>
          <Money value={cost} className="sliptext__cost" />
        </>
      ) : null}
    </span>
  );
}
