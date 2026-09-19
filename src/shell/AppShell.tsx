/**
 * The app shell: per-role navigation around every screen.
 *
 *  - Phone (below 768px, and always for the site role): a top bar with the
 *    side switcher, the bell and the person, a bottom tab bar with 56px
 *    targets, and the offline bar under the top bar.
 *  - Desktop: one left sidebar (side switcher, main group, the jobs under
 *    Jobs, a Setup group, then the bell and the person at the foot).
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
import { usePhoneWidth } from './useNarrow';
import './shell.css';

export type Layout = 'phone' | 'desktop';
const LayoutContext = createContext<Layout>('desktop');
/** 'phone' below 768px and always for the site role; screens switch cards and tables on it. */
export function useLayout(): Layout {
  return useContext(LayoutContext);
}

function BellIcon() {
  return (
    <svg className="icon" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <path
        d="M10 2.5a4.5 4.5 0 0 0-4.5 4.5v3.2L4 13.5h12l-1.5-3.3V7A4.5 4.5 0 0 0 10 2.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8 15.5a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg className="icon" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <circle cx="10" cy="7" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 17.5c.8-3.3 3.3-5 6.5-5s5.7 1.7 6.5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function NavLinkItem({ item, pathname, className }: { item: NavItem; pathname: string; className: string }) {
  const here = isHere(item, pathname);
  return (
    <Link to={item.to} className={className} data-testid={`nav-${item.id}`} aria-current={here ? 'page' : undefined}>
      {item.label}
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
        <SideSwitcher className="topbar__side" />
        <div className="topbar__tools">
          <Link to="/notifications" className="topbar__tool" data-testid="nav-notifications" aria-label="Notifications">
            <BellIcon />
            <BellBadge className="topbar__count" />
          </Link>
          <Link to="/settings" className="topbar__tool" data-testid="nav-settings" aria-label={`${person.shortName}: my settings`}>
            <PersonIcon />
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
  const jobs = useQuery((api) => api.listJobs(), []);
  const showJobs = main.some((m) => m.id === 'overview');
  return (
    <aside className="sidebar" data-testid="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__wordmark">Tracker</span>
        <SideSwitcher className="sidebar__side" />
      </div>
      <nav className="sidebar__nav" data-testid="primary-nav" aria-label="Main">
        {main.map((item) => (
          <div key={item.id}>
            <NavLinkItem item={item} pathname={pathname} className="sidebar__link" />
            {item.id === 'overview' && showJobs && jobs.length > 0 && (
              <ul className="sidebar__jobs">
                {jobs.map((j) => {
                  const here = matchPath('/jobs/:id/*', pathname)?.params.id === j.id || matchPath('/jobs/:id', pathname)?.params.id === j.id;
                  return (
                    <li key={j.id}>
                      <Link
                        to={`/jobs/${j.id}`}
                        className="sidebar__job"
                        data-testid={`nav-job-${j.id}`}
                        aria-current={here ? 'page' : undefined}
                      >
                        <span className="sidebar__job-name">{j.name}</span>
                        {j.kind === 'design' && <span className="sidebar__job-kind">design</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
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
          <BellIcon />
          <BellBadge className="sidebar__count" />
        </Link>
        <Link to="/settings" className="sidebar__link sidebar__link--tool" data-testid="nav-settings">
          <PersonIcon />
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
