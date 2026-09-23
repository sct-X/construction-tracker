/**
 * The app shell: per-role navigation around every screen.
 *
 *  - Phone (below 768px, and always for the site role): an iOS nav bar
 *    (the Cruise mark, the side switcher, the bell and the person) and an
 *    iOS tab bar (a glyph over a label, the tint for the current tab), both
 *    translucent material over the content, and the offline bar under the
 *    nav bar.
 *  - Desktop: a macOS source list (the logo, side switcher, main group with
 *    glyphs, a Setup group, then the bell and the person at the foot). Jobs
 *    are reached from the Overview and moved between with the job switcher
 *    on each job page.
 *
 * Every nav item carries `data-testid="nav-<name>"`; the tab bar and the
 * sidebar's main list are `data-testid="primary-nav"`.
 */
import { createContext, useContext, useEffect, useState, type CSSProperties } from 'react';
import { Link, Outlet, matchPath, useLocation } from 'react-router-dom';
import { useApi, useQuery, useSession } from '../data/context';
import { OfflineBar } from './OfflineBar';
import { BellBadge } from '../components/BellBadge';
import { Buzz } from '../components/Buzz';
import { QueueBadge } from '../components/QueueBadge';
import { SideSwitcher } from './SideSwitcher';
import { isHere, phoneTabs, sidebarMain, sidebarSetup, type NavItem } from './nav';
import { rememberJob } from './lastJob';
import { Logo, LogoMark } from './Logo';
import { usePhoneWidth } from './useNarrow';
import { BellGlyph, NavIcon, PersonGlyph } from './icons';
import './shell.css';

export type Layout = 'phone' | 'desktop';
const LayoutContext = createContext<Layout>('desktop');
/** 'phone' below 768px and always for the site role; screens switch cards and tables on it. */
export function useLayout(): Layout {
  return useContext(LayoutContext);
}

function NavLinkItem({ item, pathname, className }: { item: NavItem; pathname: string; className: string }) {
  const here = isHere(item, pathname);
  return (
    <Link to={item.to} className={className} data-testid={`nav-${item.id}`} aria-current={here ? 'page' : undefined}>
      <NavIcon id={item.id} label={item.label} className={`${className}-icon icon`} />
      <span className={`${className}-label`}>{item.label}</span>
    </Link>
  );
}

function PhoneChrome({ pathname }: { pathname: string }) {
  const api = useApi();
  const { person, role } = useSession();
  const tabs = useQuery((api) => phoneTabs(role, api), [role]);
  void api;
  return (
    <>
      <header className="topbar" data-testid="topbar">
        <LogoMark className="topbar__mark" size={28} />
        <SideSwitcher className="topbar__side" />
        <div className="topbar__tools">
          <Link to="/notifications" className="topbar__tool" data-testid="nav-notifications" aria-label="Notifications">
            <BellGlyph />
            <BellBadge className="topbar__count" />
          </Link>
          <Link to="/settings" className="topbar__tool" data-testid="nav-settings" aria-label={`${person.shortName}: my settings`}>
            <PersonGlyph />
          </Link>
        </div>
      </header>
      <nav className="tabbar" data-testid="primary-nav" aria-label="Main">
        {tabs.map((t) => (
          <NavLinkItem key={t.id} item={t} pathname={pathname} className="tabbar__tab" />
        ))}
      </nav>
    </>
  );
}

function DesktopChrome({ pathname }: { pathname: string }) {
  const { person } = useSession();
  const main = useQuery((api) => sidebarMain(api), []);
  const setup = useQuery((api) => sidebarSetup(api), []);
  return (
    <aside className="sidebar" data-testid="sidebar">
      <div className="sidebar__brand">
        <Logo className="sidebar__wordmark" height={28} />
        <SideSwitcher className="sidebar__side" />
      </div>
      <nav className="sidebar__nav" data-testid="primary-nav" aria-label="Main">
        {/* No per-job list here: the job switcher at the top of every job page moves between jobs. */}
        {main.map((item) => (
          <div key={item.id}>
            <NavLinkItem item={item} pathname={pathname} className="sidebar__link" />
          </div>
        ))}
      </nav>
      {setup.length > 0 && (
        <nav className="sidebar__setup" aria-label="Setup" data-testid="setup-nav">
          <h2 className="sidebar__group">Setup</h2>
          {setup.map((item) => (
            <NavLinkItem key={item.id} item={item} pathname={pathname} className="sidebar__link" />
          ))}
        </nav>
      )}
      <div className="sidebar__foot">
        <Link to="/notifications" className="sidebar__link sidebar__link--tool sidebar__link--bell" data-testid="nav-notifications" aria-label="Notifications" title="Notifications">
          <BellGlyph />
          <BellBadge className="sidebar__count" />
        </Link>
        <Link to="/settings" className="sidebar__link sidebar__link--tool" data-testid="nav-settings">
          <PersonGlyph />
          <span>{person.shortName}</span>
        </Link>
      </div>
    </aside>
  );
}

export function AppShell() {
  const { pathname } = useLocation();
  const { role } = useSession();
  const api = useApi();
  const phoneWidth = usePhoneWidth();
  // The site role always gets the phone layout, centred on a wide window.
  const phone = phoneWidth || role === 'site';

  // The dev bar sits above the shell in normal flow; the sticky sidebar is
  // sized to what is left so its foot (bell, me) stays on screen.
  const [above, setAbove] = useState(0);
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>('[data-testid="dev-bar"]');
    if (!bar) return;
    const measure = () => setAbove(bar.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const m = matchPath('/jobs/:id/*', pathname) ?? matchPath('/jobs/:id', pathname);
    const id = m?.params.id;
    if (id && api.getJob(id)?.kind === 'build') rememberJob(id);
  }, [pathname, api]);

  // Signed out, or on the sign-in page: no chrome, just the page.
  const bare = !api.signedIn() || pathname === '/sign-in';
  if (bare) {
    return (
      <LayoutContext.Provider value={phone ? 'phone' : 'desktop'}>
        <div className={`shell shell--bare ${phone ? 'shell--phone' : 'shell--desktop'}`} data-layout={phone ? 'phone' : 'desktop'} style={{ '--above': `${above}px` } as CSSProperties}>
          <div className="shell__content">
            <Outlet />
          </div>
        </div>
      </LayoutContext.Provider>
    );
  }

  return (
    <LayoutContext.Provider value={phone ? 'phone' : 'desktop'}>
      <div
        className={`shell ${phone ? 'shell--phone' : 'shell--desktop'}`}
        data-layout={phone ? 'phone' : 'desktop'}
        style={{ '--above': `${above}px` } as CSSProperties}
      >
        {phone ? <PhoneChrome pathname={pathname} /> : <DesktopChrome pathname={pathname} />}
        <div className="shell__content">
          <OfflineBar />
          <QueueBadge />
          <Outlet />
        </div>
        <Buzz layout={phone ? 'phone' : 'desktop'} />
      </div>
    </LayoutContext.Provider>
  );
}
