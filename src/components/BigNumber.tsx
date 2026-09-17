/**
 * The hero treatment for partner screens: the figure is the largest type on
 * the screen, set in the condensed display face; the label is small, plain
 * words in sentence case, underneath. No gradient, no all-caps.
 *
 *   <BigNumber value="Fri 26 Feb 2027" label="Forecast finish" />
 *
 * `size`: "hero" is the screen's one big figure (44px phone, 56px desktop);
 * "row" is the same face at table scale so a column of dates still leads.
 */
import type { ReactNode } from 'react';
import './bignumber.css';

export interface BigNumberProps {
  value: ReactNode;
  label?: ReactNode;
  size?: 'hero' | 'row';
  /** Semantic colour; the value's words must carry the meaning on their own. */
  tone?: 'late' | 'amber' | 'ok' | 'muted';
  className?: string;
  testId?: string;
}

export function BigNumber({ value, label, size = 'hero', tone, className, testId }: BigNumberProps) {
  const classes = ['bignumber', `bignumber--${size}`, tone ? `bignumber--${tone}` : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <span className={classes} data-testid={testId}>
      <span className="bignumber__value display">{value}</span>
      {label ? <span className="bignumber__label">{label}</span> : null}
    </span>
  );
}
