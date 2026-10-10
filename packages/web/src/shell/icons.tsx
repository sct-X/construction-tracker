/**
 * SF-Symbols-like glyphs for the chrome (ported from v1 src/shell/icons.tsx):
 * a 24px grid at a 1.7 stroke, round caps and joins, currentColor, so the tab
 * bar and the sidebar tint them by state. Parts with `icon__solid` fill in when
 * their tab is selected. Hand-drawn inline SVG; no icon library.
 */
import type { ReactNode } from 'react';

export type IconName = 'overview' | 'waiting' | 'shipments' | 'changes' | 'newjob' | 'programs' | 'templates' | 'trades';

function Glyph({ children, className = 'icon' }: { children: ReactNode; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const PATHS: Record<IconName, ReactNode> = {
  // square.grid.2x2
  overview: (
    <>
      <rect className="icon__solid" x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect className="icon__solid" x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect className="icon__solid" x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect className="icon__solid" x="13.5" y="13.5" width="7" height="7" rx="2" />
    </>
  ),
  // clock
  waiting: (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <path d="M12 7v5.2l3.4 2" />
    </>
  ),
  // shippingbox
  shipments: (
    <>
      <path d="M12 3 20 7v10l-8 4-8-4V7Z" />
      <path d="M4 7l8 4 8-4M12 11v10M8 5l8 4" />
    </>
  ),
  // clock.arrow.circlepath
  changes: (
    <>
      <path d="M4.2 12a7.8 7.8 0 1 0 2.3-5.5" />
      <path d="M4 3.8v3.6h3.6" />
      <path d="M12 8v4.3l2.9 1.8" />
    </>
  ),
  // plus.square
  newjob: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  // list.bullet.rectangle
  programs: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
      <path d="M7.5 9h.01M7.5 12h.01M7.5 15h.01M10.5 9h6M10.5 12h6M10.5 15h6" />
    </>
  ),
  // doc.on.doc
  templates: (
    <>
      <rect x="7.5" y="3.5" width="12" height="14.5" rx="2.2" />
      <path d="M16.5 20.5H6.7a2.2 2.2 0 0 1-2.2-2.2V7" />
    </>
  ),
  // wrench
  trades: <path d="M14.8 3.8a4.8 4.8 0 0 0-4.5 6.4l-6.1 6.1a1.9 1.9 0 0 0 2.7 2.7l6.1-6.1a4.8 4.8 0 0 0 6.4-4.5l-2.9 2.9-2.9-.7-.7-2.9Z" />,
};

export function NavIcon({ name, className }: { name: IconName; className?: string }) {
  return <Glyph className={className}>{PATHS[name]}</Glyph>;
}

/** phone: the Call glyph on Waiting on rows. */
export function PhoneGlyph({ className = 'icon icon--call' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.6 3.8h2.6l1.5 4-1.9 1.3a11 11 0 0 0 6.1 6.1l1.3-1.9 4 1.5v2.6a2 2 0 0 1-2.2 2A16.3 16.3 0 0 1 4.6 6a2 2 0 0 1 2-2.2Z" />
    </svg>
  );
}

/**
 * The app's mark: v1's open arc with a dot at the gap (the dot is the one
 * --logo-accent). The v1 "Cruise" wordmark is not used: the rebuild keeps the
 * name "Tracker" in the system face (the name is Scott's call).
 */
export function LogoMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" focusable="false">
      <path d="M 386.2 365.3 A 170 170 0 1 1 386.2 146.7" fill="none" stroke="currentColor" strokeWidth="60" strokeLinecap="round" />
      <circle className="logo__dot" cx="418" cy="256" r="32" />
    </svg>
  );
}
