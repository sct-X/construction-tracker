/**
 * The app shell (v1's admin view, minus sign-in, roles, notifications and upload).
 *
 *  - Phone (below 768px): an iOS nav bar (the mark, the side switcher, the
 *    Changes glyph) as edge-attached Regular Liquid Glass, and a floating
 *    Regular glass tab bar capsule (Overview, Waiting on) that minimises on
 *    scroll down. The content scrolls under both and shows through.
 *  - Desktop: a solid macOS source list (the mark, the side switcher, the main
 *    links with glyphs, a Setup group). No per-job list: the job switcher at
 *    the top of every job page moves between jobs.
 *  - Every job route gets the job header (shell/JobHeader): back link, the
 *    job's name as the title and a menu of every job, then the job's tabs.
 *  - Mock mode only: the dev bar ("Today is" and Reset) above everything.
 */
import { Suspense, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { DashboardApi, OverviewRow } from '@ct/core';
import { DevBar } from '../components/DevBar';
import { SideSwitcher } from '../components/SideSwitcher';
import { LoadingRows } from '../components/bits';
import { useData, useSideQuery } from '../data/DataContext';
import { JobHeader } from '../shell/JobHeader';
import { LogoMark, NavIcon } from '../shell/icons';
import { installGlassPress } from '../shell/glassPress';
import { usePhoneWidth } from '../shell/useNarrow';
import { useTabBarMinimise } from '../shell/useTabBarMinimise';
import { applyTheme, readTheme, saveTheme, type ThemeChoice } from '../shell/theme';
import { href, matchPath, useHashPath } from './router';
import { ROUTES, type RouteDef } from './routes';
import { isHere, isJobRoute, mainLinks, phoneLinks } from './jobNav';

/** Every live job on every side, with its overdue count: the job header needs a deep-linked job's side. */
async function loadAllJobs(api: DashboardApi): Promise<OverviewRow[]> {
  const v = await api.getOverview();
  return [...v.builds, ...v.design];
}

function slug(r: RouteDef): string {
  return r.title.toLowerCase().replace(/\s+/g, '-');
}

function Sidebar({ current }: { current: RouteDef | undefined }) {
  const link = (r: RouteDef) => (
    <a key={r.path} href={href(r.path)} className="sidebar__link" data-testid={`nav-${slug(r)}`} aria-current={isHere(r, current) ? 'page' : undefined}>
      {r.icon && <NavIcon name={r.icon} className="icon sidebar__link-icon" />}
      <span className="sidebar__link-label">{r.title}</span>
    </a>
  );
  return (
    <aside className="sidebar" data-testid="sidebar">
      <div className="sidebar__brand">
        <a className="sidebar__brand-row" href={href('/')}>
          <LogoMark size={28} />
          <span className="sidebar__brand-name">Tracker</span>
        </a>
        <SideSwitcher className="sidebar__side" />
      </div>
      <nav className="sidebar__nav" aria-label="Main" data-testid="primary-nav">
        {mainLinks('main').map(link)}
      </nav>
      <nav className="sidebar__setup" aria-label="Setup" data-testid="setup-nav">
        <h2 className="sidebar__group">Setup</h2>
        {mainLinks('setup').map(link)}
      </nav>
      <LookMenu />
    </aside>
  );
}

/** Light (default), Dark or Match device: the v1 "Look" choice, per viewer. */
function LookMenu() {
  const [look, setLook] = useState<ThemeChoice>(readTheme);
  useEffect(() => applyTheme(look), [look]);
  return (
    <label className="sidebar__look">
      <span className="sidebar__look-label">Look</span>
      <select
        value={look}
        data-testid="look"
        onChange={(e) => {
          const v = e.target.value as ThemeChoice;
          saveTheme(v);
          setLook(v);
        }}
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">Match device</option>
      </select>
    </label>
  );
}

function TopBar({ current }: { current: RouteDef | undefined }) {
  return (
    <header className="topbar glass glass--regular" data-testid="topbar">
      <a href={href('/')} className="topbar__mark" aria-label="Overview">
        <LogoMark size={28} />
      </a>
      <SideSwitcher className="topbar__side" />
      <div className="topbar__tools">
        {phoneLinks('tool').map((r) => (
          <a key={r.path} href={href(r.path)} className="topbar__tool" aria-label={r.title} data-testid={`nav-${slug(r)}`} aria-current={isHere(r, current) ? 'page' : undefined}>
            {r.icon && <NavIcon name={r.icon} />}
          </a>
        ))}
      </div>
    </header>
  );
}

function TabBar({ current, path }: { current: RouteDef | undefined; path: string }) {
  const bar = useRef<HTMLElement>(null);
  const { minimised, restore } = useTabBarMinimise(true, bar);
  // A new page starts with the full bar.
  useEffect(() => restore(), [path]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <nav
      ref={bar}
      className="tabbar glass glass--regular glass--float"
      aria-label="Main"
      data-testid="primary-nav"
      data-minimised={minimised || undefined}
      onPointerDown={minimised ? restore : undefined}
      onFocus={minimised ? restore : undefined}
    >
      {phoneLinks('tab').map((r) => (
        <a key={r.path} href={href(r.path)} className="tabbar__tab lg-press" data-testid={`nav-${slug(r)}`} aria-current={isHere(r, current) ? 'page' : undefined}>
          {r.icon && <NavIcon name={r.icon} className="icon tabbar__tab-icon" />}
          <span className="tabbar__tab-label">{r.title}</span>
        </a>
      ))}
    </nav>
  );
}

export function App() {
  const path = useHashPath();
  const { dev, sideId } = useData();
  const phone = usePhoneWidth();
  const found = ROUTES.map((r) => ({ r, params: matchPath(r.path, path) })).find((x) => x.params);
  const jobs = useSideQuery(loadAllJobs);
  const allJobs = jobs.status === 'ready' ? jobs.data : [];
  const sideJobs = allJobs.filter((j) => !sideId || j.sideId === sideId);
  const jobId = found && isJobRoute(found.r) ? (found.params!.jobId ?? null) : null;
  const job = jobId ? (allJobs.find((j) => j.jobId === jobId) ?? null) : null;

  useEffect(() => installGlassPress(), []);

  // After a route change (not the first load), focus moves to the main content so a keyboard or screen
  // reader user starts at the new page, not back in the sidebar.
  const mainRef = useRef<HTMLElement>(null);
  const firstPath = useRef(path);
  useEffect(() => {
    if (path !== firstPath.current) {
      firstPath.current = '';
      mainRef.current?.focus({ preventScroll: true });
      window.scrollTo?.(0, 0);
    }
  }, [path]);

  useEffect(() => {
    const t = found?.r.title ?? 'Not found';
    document.title = job ? `${t}, ${job.name} | Tracker` : `${t} | Tracker`;
  }, [found?.r.title, job]);

  // The dev bar sits above the shell; the sticky sidebar is sized to what is left.
  const [above, setAbove] = useState(0);
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>('.devbar');
    if (!bar || typeof ResizeObserver === 'undefined') return;
    const measure = () => setAbove(bar.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(bar);
    return () => ro.disconnect();
  }, [dev]);

  const current = found?.r;
  return (
    <div className={dev ? 'app has-devbar' : 'app'}>
      <a
        className="skip"
        href="#main"
        onClick={(e) => {
          // Hash routing: "#main" would be read as a route, so focus the content instead of following the link.
          e.preventDefault();
          mainRef.current?.focus();
        }}
      >
        Skip to content
      </a>
      {dev && <DevBar />}
      <div className={`shell ${phone ? 'shell--phone' : 'shell--desktop'}`} data-layout={phone ? 'phone' : 'desktop'} style={{ '--above': `${above}px` } as CSSProperties}>
        {phone ? <TopBar current={current} /> : <Sidebar current={current} />}
        <main className="shell__content page" id="main" ref={mainRef} tabIndex={-1}>
          {jobId && <JobHeader jobId={jobId} job={job} sideJobs={sideJobs} current={current} loading={jobs.status === 'loading'} phone={phone} />}
          {found ? (
            <Suspense fallback={<LoadingRows rows={4} label={`Loading ${found.r.title}`} />}>{found.r.render(found.params!)}</Suspense>
          ) : (
            <div>
              <h1 className="page-header__title">Nothing here</h1>
              <p className="empty-line">
                There is no page at #{path}. <a href={href('/')}>Go to the Overview</a>.
              </p>
            </div>
          )}
        </main>
        {phone && <TabBar current={current} path={path} />}
      </div>
    </div>
  );
}
