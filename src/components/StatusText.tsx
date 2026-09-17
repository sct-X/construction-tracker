/**
 * Status words with a wash behind them. The words carry the meaning; the
 * colour only agrees with them, so "14 days late" reads the same in
 * greyscale. Late and amber text get a leading "!" as the wireframes show.
 *
 *   <StatusText tone="late" testId="jobs-late-park-rd">14 days late</StatusText>
 *   <StatusText tone="amber">Unconfirmed 9 days</StatusText>
 *   <StatusText tone="ok">On plan</StatusText>
 *   <StatusText tone="muted">Last confirmed 2 days ago</StatusText>
 *   <StatusText tone="plain">1 outstanding, oldest 4 days</StatusText>   (body text, no wash)
 */
import type { ReactNode } from 'react';
import './statusText.css';

export type Tone = 'late' | 'amber' | 'ok' | 'muted' | 'plain';

interface Props {
  tone: Tone;
  children: ReactNode;
  /** Words without the wash, for cells where a chip would shout. */
  plain?: boolean;
  className?: string;
  testId?: string;
}

export function StatusText({ tone, children, plain, className, testId }: Props) {
  const classes = ['status', `status--${tone}`, plain ? 'status--plain' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <span className={classes} data-tone={tone} data-testid={testId}>
      {(tone === 'late' || tone === 'amber') && (
        <span className="status__mark" aria-hidden="true">
          !
        </span>
      )}
      {children}
    </span>
  );
}
