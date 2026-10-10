/**
 * Status words with a wash behind them (v1 StatusText). The words carry the
 * meaning; the colour only agrees with them, so "overdue" reads the same in
 * greyscale. `late` is overdue and only overdue (red, led by "!"); `note` is a
 * can't-do-yet state (label on the neutral fill, led by "!"); `ok` is done.
 *
 *   <StatusText tone="late" plain>Act by Mon 10 Aug, overdue by 5 weeks</StatusText>
 */
import type { ReactNode } from 'react';

export type Tone = 'late' | 'note' | 'ok' | 'muted' | 'plain';

export function StatusText({ tone, children, plain, className, testId }: { tone: Tone; children: ReactNode; plain?: boolean; className?: string; testId?: string }) {
  const classes = ['status', `status--${tone}`, plain ? 'status--plain' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <span className={classes} data-tone={tone} data-testid={testId}>
      {(tone === 'late' || tone === 'note') && (
        <span className="status__mark" aria-hidden="true">
          !
        </span>
      )}
      {children}
    </span>
  );
}
