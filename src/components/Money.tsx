/**
 * The one money component. Renders nothing at all, label included, when the
 * value is undefined: that is how the site role's screens look finished rather
 * than censored. Never hide money with CSS, never default it to 0.
 *
 *   <Money value={4500} label="Holding" suffix="/wk" />   -> "Holding $4,500/wk"
 *   <Money value={9000} />                                -> "$9,000"
 *   <Money value={undefined} label="Holding" />           -> nothing
 */
import { formatMoney } from '../domain/money';
import './money.css';

export interface MoneyProps {
  value?: number;
  /** Plain words before the figure, sentence case: "Holding", "Slip cost". */
  label?: string;
  /** Appended to the figure: "/wk". */
  suffix?: string;
  className?: string;
  testId?: string;
}

export function Money({ value, label, suffix, className, testId }: MoneyProps) {
  if (value === undefined) return null;
  return (
    <span className={['money', className].filter(Boolean).join(' ')} data-testid={testId}>
      {label ? <span className="money__label">{label} </span> : null}
      <span className="money__value num">
        {formatMoney(value)}
        {suffix ?? ''}
      </span>
    </span>
  );
}
