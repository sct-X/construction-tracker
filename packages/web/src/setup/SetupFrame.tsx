/**
 * The frame every Setup page sits in: the page heading, the Setup tabs and,
 * on a phone, one plain sentence instead of the forms (Setup is desktop only).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { href, useHashPath } from '../app/router';
import '../styles/setup.css';

const PHONE = '(max-width: 760px)';

function phoneNow(): boolean {
  try {
    return globalThis.matchMedia?.(PHONE).matches ?? false;
  } catch {
    return false;
  }
}

/** True at phone width; follows the window as it resizes. */
export function usePhone(): boolean {
  const [phone, setPhone] = useState(phoneNow);
  useEffect(() => {
    const mq = globalThis.matchMedia?.(PHONE);
    if (!mq) return;
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return phone;
}

export const SETUP_TABS: { path: string; label: string }[] = [
  { path: '/setup', label: 'New job' },
  { path: '/setup/programs', label: 'Programs' },
  { path: '/setup/templates', label: 'Templates' },
  { path: '/setup/trades', label: 'Trades' },
];

/** The tab a Setup path sits under: "/setup/programs/park-rd" -> "/setup/programs". */
export function setupTabFor(path: string): string {
  const hit = [...SETUP_TABS].reverse().find((t) => path === t.path || path.startsWith(`${t.path}/`));
  return hit?.path ?? '/setup';
}

export function SetupFrame({ title, sub, children, className }: { title: string; sub?: ReactNode; children: ReactNode; className?: string }) {
  const phone = usePhone();
  const path = useHashPath();
  if (phone) {
    return (
      <div className="screen su-phone" data-testid="setup-phone">
        <header className="screen-head">
          <h1>Setup</h1>
        </header>
        <p className="su-phone-msg">Setup works on a computer. Open this page on a desktop.</p>
      </div>
    );
  }
  const tab = setupTabFor(path);
  return (
    <div className={`screen su ${className ?? ''}`.trim()}>
      <nav className="su-tabs" aria-label="Setup pages">
        {SETUP_TABS.map((t) => (
          <a key={t.path} className="tab" href={href(t.path)} aria-current={t.path === tab ? (t.path === path ? 'page' : 'true') : undefined}>
            {t.label}
          </a>
        ))}
      </nav>
      <header className="screen-head">
        <h1>{title}</h1>
        {sub && <p className="screen-sub">{sub}</p>}
      </header>
      {children}
    </div>
  );
}
