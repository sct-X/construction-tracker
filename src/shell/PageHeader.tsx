/**
 * The heading strip every screen starts with: an h1, an optional line under
 * it (a date, a count, a sentence), and optional actions on the right.
 *
 *   <PageHeader title="Jobs" meta="7 jobs on Norm and Dom" actions={<button>New job</button>} />
 */
import type { ReactNode } from 'react';

interface Props {
  title: string;
  /** A line under the title: a date range, a count, a sentence. */
  meta?: ReactNode;
  /** Buttons or links, right-aligned on desktop, under the title on the phone. */
  actions?: ReactNode;
  /** A "back" link for detail screens: { to, label }. */
  back?: { to: string; label: string };
  children?: ReactNode;
}

export function PageHeader({ title, meta, actions, back, children }: Props) {
  return (
    <header className="page-header">
      {back && (
        <a className="page-header__back" href={`#${back.to}`}>
          {back.label}
        </a>
      )}
      <div className="page-header__row">
        <div>
          <h1 className="page-header__title">{title}</h1>
          {meta && <p className="page-header__meta">{meta}</p>}
        </div>
        {actions && <div className="page-header__actions">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
