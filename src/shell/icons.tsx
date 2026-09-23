/**
 * SF-Symbols-like glyphs for the chrome: drawn on a 24px grid at a 1.7
 * stroke, round caps and joins, currentColor, so the tab bar and the sidebar
 * tint them by state. Hand-drawn inline SVG; no icon library.
 *
 *   <NavIcon id="overview" label="Overview" />
 */
import type { ReactNode } from 'react';

function Glyph({ children, className = 'icon' }: { children: ReactNode; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

/** square.grid.2x2: the Overview. */
export const GridIcon = ({ className }: { className?: string }) => (
  <Glyph className={className}>
    <rect className="icon__solid" x="3.5" y="3.5" width="7" height="7" rx="2" />
    <rect className="icon__solid" x="13.5" y="3.5" width="7" height="7" rx="2" />
    <rect className="icon__solid" x="3.5" y="13.5" width="7" height="7" rx="2" />
    <rect className="icon__solid" x="13.5" y="13.5" width="7" height="7" rx="2" />
  </Glyph>
);

/** clock: Waiting on. */
export const ClockIcon = ({ className }: { className?: string }) => (
  <Glyph className={className}>
    <circle cx="12" cy="12" r="8.75" />
    <path d="M12 7v5.2l3.4 2" />
  </Glyph>
);

/** checklist: the builder's My items. */
export const ChecklistIcon = ({ className }: { className?: string }) => (
  <Glyph className={className}>
    <path d="M3.5 6.5l1.6 1.6 3-3.2M3.5 13.5l1.6 1.6 3-3.2" />
    <path d="M11.5 7h9M11.5 14h9M4 20h16.5" />
  </Glyph>
);

/** house: Jobs, for the builder and the site hand. */
export const HouseIcon = ({ className }: { className?: string }) => (
  <Glyph className={className}>
    <path className="icon__solid" d="M4 10.2 12 3.8l8 6.4V19a1.5 1.5 0 0 1-1.5 1.5h-3.8v-5.8H9.3v5.8H5.5A1.5 1.5 0 0 1 4 19Z" />
  </Glyph>
);

/** calendar with a day marked: Today. */
export const TodayIcon = ({ className }: { className?: string }) => (
  <Glyph className={className}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 9.8h17M8 3v3.6M16 3v3.6" />
    <rect className="icon__solid" x="7.2" y="12.8" width="3.6" height="3.6" rx="0.8" strokeWidth="1.4" />
  </Glyph>
);

/** camera: + Photos. */
export const CameraIcon = ({ className }: { className?: string }) => (
  <Glyph className={className}>
    <path d="M3.5 9A2 2 0 0 1 5.5 7h2.2l1.5-2.2h5.6L16.3 7h2.2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />
    <circle cx="12" cy="13" r="3.6" />
  </Glyph>
);

/** shippingbox: Shipments. */
export const BoxIcon = ({ className }: { className?: string }) => (
  <Glyph className={className}>
    <path d="M12 3 20 7v10l-8 4-8-4V7Z" />
    <path d="M4 7l8 4 8-4M12 11v10M8 5l8 4" />
  </Glyph>
);

/** bell: notifications. */
export const BellGlyph = ({ className }: { className?: string }) => (
  <Glyph className={className}>
    <path d="M12 3.2a5.6 5.6 0 0 0-5.6 5.6v3.8L4.6 16.4h14.8l-1.8-3.8V8.8A5.6 5.6 0 0 0 12 3.2Z" />
    <path d="M9.6 19.2a2.5 2.5 0 0 0 4.8 0" />
  </Glyph>
);

/** doc.on.doc: Templates and new job. */
export const DocsIcon = ({ className }: { className?: string }) => (
  <Glyph className={className}>
    <rect x="7.5" y="3.5" width="12" height="14.5" rx="2.2" />
    <path d="M16.5 20.5H6.7a2.2 2.2 0 0 1-2.2-2.2V7" />
  </Glyph>
);

/** wrench: Trades. */
export const WrenchIcon = ({ className }: { className?: string }) => (
  <Glyph className={className}>
    <path d="M14.8 3.8a4.8 4.8 0 0 0-4.5 6.4l-6.1 6.1a1.9 1.9 0 0 0 2.7 2.7l6.1-6.1a4.8 4.8 0 0 0 6.4-4.5l-2.9 2.9-2.9-.7-.7-2.9Z" />
  </Glyph>
);

/** person.2: People and roles. */
export const PeopleIcon = ({ className }: { className?: string }) => (
  <Glyph className={className}>
    <circle cx="9" cy="8.2" r="3.4" />
    <path d="M3 19.5c.7-3.3 3-5.2 6-5.2s5.3 1.9 6 5.2" />
    <path d="M15.5 4.9a3.3 3.3 0 0 1 0 6.5M17.6 14.6c1.8.6 3 2.3 3.4 4.9" />
  </Glyph>
);

/** person.crop.circle: my settings. */
export const PersonGlyph = ({ className }: { className?: string }) => (
  <Glyph className={className}>
    <circle cx="12" cy="12" r="8.75" />
    <circle cx="12" cy="10" r="3" />
    <path d="M6.6 18.2c1.2-2 3-3 5.4-3s4.2 1 5.4 3" />
  </Glyph>
);

/** The glyph for a nav item, by its id (and its label, where one id wears two names). */
export function NavIcon({ id, label, className }: { id: string; label: string; className?: string }) {
  switch (id) {
    case 'overview':
      return label === 'Jobs' ? <HouseIcon className={className} /> : <GridIcon className={className} />;
    case 'waiting':
      return label === 'My items' ? <ChecklistIcon className={className} /> : <ClockIcon className={className} />;
    case 'today':
      return <TodayIcon className={className} />;
    case 'upload':
      return <CameraIcon className={className} />;
    case 'shipments':
      return <BoxIcon className={className} />;
    case 'activity':
      return <BellGlyph className={className} />;
    case 'templates':
      return <DocsIcon className={className} />;
    case 'trades':
      return <WrenchIcon className={className} />;
    case 'people':
      return <PeopleIcon className={className} />;
    default:
      return null;
  }
}
