/**
 * The frame every Setup page sits in (v1 look): the page header (an iOS back
 * link, the Large Title, a meta line, actions on the right) and, on a phone,
 * one plain sentence instead of the forms (Setup is desktop only). The
 * desktop sidebar's Setup group is the way between Setup pages, as in v1.
 */
import type { ReactNode } from 'react';
import { PageHeader } from '../components/PageHeader';
import { usePhoneWidth } from '../shell/useNarrow';
import '../styles/setup.css';

/** True at phone width (below 768px, the shell's breakpoint); follows the window as it resizes. */
export function usePhone(): boolean {
  return usePhoneWidth();
}

export const SETUP_PAGES: { path: string; label: string }[] = [
  { path: '/setup', label: 'New job' },
  { path: '/setup/programs', label: 'Programs' },
  { path: '/setup/templates', label: 'Templates' },
  { path: '/setup/trades', label: 'Trades' },
];

/** The Setup page a path sits under: "/setup/programs/park-rd" -> "/setup/programs". */
export function setupTabFor(path: string): string {
  const hit = [...SETUP_PAGES].reverse().find((t) => path === t.path || path.startsWith(`${t.path}/`));
  return hit?.path ?? '/setup';
}

export function SetupFrame({
  title,
  meta,
  back,
  actions,
  children,
  className,
}: {
  title: string;
  meta?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const phone = usePhone();
  if (phone) {
    return (
      <div className="su su--phone" data-testid="setup-phone">
        <PageHeader title="Setup" />
        <p className="su__phone-msg">Setup works on a computer. Open this page on a desktop.</p>
      </div>
    );
  }
  return (
    <div className={`su ${className ?? ''}`.trim()}>
      <PageHeader title={title} meta={meta} back={back} actions={actions} />
      {children}
    </div>
  );
}
