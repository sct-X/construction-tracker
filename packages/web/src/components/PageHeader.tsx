/**
 * The heading strip every v1-style screen starts with: an iOS back link, the
 * Large Title, an optional meta line and actions on the right.
 *
 *   <PageHeader title="Waiting on" meta="47 to act on, 5 overdue" />
 */
import type { ReactNode } from 'react';

export function PageHeader({ title, meta, actions, back, titleSlot, children }: { title?: string; meta?: ReactNode; actions?: ReactNode; back?: { href: string; label: string }; titleSlot?: ReactNode; children?: ReactNode }) {
  return (
    <header className="page-header">
      {back && (
        <a className="page-header__back" href={back.href} data-testid="back">
          {back.label}
        </a>
      )}
      <div className="page-header__row">
        <div className="page-header__lead">
          {titleSlot ?? <h1 className="page-header__title">{title}</h1>}
          {meta && <p className="page-header__meta">{meta}</p>}
        </div>
        {actions && <div className="page-header__actions">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
