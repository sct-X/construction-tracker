/**
 * Main links from the route table. Desktop: the rail, with this side's jobs
 * listed under Jobs. Phone: a bottom bar; past five links the rest go under
 * "More" so every tab stays at least 64px wide at 390px.
 */
import { useEffect, useState } from 'react';
import type { JobListRow } from '@ct/core';
import { href } from '../app/router';
import type { RouteDef } from '../app/routes';
import { isJobRoute, mainLinks, switchJobHref } from '../app/jobNav';

const BAR_MAX = 5;

export function MainNav({ current, jobs, currentJobId }: { current: RouteDef | undefined; jobs: JobListRow[]; currentJobId: string | null }) {
  const links = mainLinks();
  // Desktop-only links (Setup) never go in the phone bar or its More menu.
  const phoneLinks = links.filter((r) => !r.desktopOnly);
  const overflow = phoneLinks.length > BAR_MAX;
  const inBar = overflow ? BAR_MAX - 1 : BAR_MAX;
  const extra = overflow ? phoneLinks.slice(inBar) : [];
  const [moreOpen, setMoreOpen] = useState(false);
  const onJob = !!current && isJobRoute(current);
  const inSection = (r: RouteDef) => (r.path === '/jobs' && onJob) || (r.path === '/setup' && !!current && current !== r && current.path.startsWith('/setup/'));
  const itemClass = (r: RouteDef) => {
    if (r.desktopOnly) return 'nav-item nav-desktop';
    return overflow && phoneLinks.indexOf(r) >= inBar ? 'nav-item nav-extra' : 'nav-item';
  };

  useEffect(() => {
    const close = () => setMoreOpen(false);
    window.addEventListener('hashchange', close);
    return () => window.removeEventListener('hashchange', close);
  }, []);

  const builds = jobs.filter((j) => j.kind === 'build');
  const design = jobs.filter((j) => j.kind === 'design');

  return (
    <nav className="nav" aria-label="Main">
      <ul className="nav-list">
        {links.map((r) => (
          <li key={r.path} className={itemClass(r)}>
            <a
              href={href(r.path)}
              className={inSection(r) ? 'nav-link is-section' : 'nav-link'}
              aria-current={current === r ? 'page' : undefined}
            >
              {r.title}
            </a>
            {r.path === '/jobs' && jobs.length > 0 && (
              <ul className="rail-jobs" aria-label="Jobs on this side">
                {[...builds, ...design].map((j) => (
                  <li key={j.jobId}>
                    <a
                      href={switchJobHref(current, j)}
                      className={j.kind === 'design' ? 'rail-job rail-job-design' : 'rail-job'}
                      aria-current={j.jobId === currentJobId ? 'true' : undefined}
                    >
                      {j.name}
                      {j.kind === 'design' && <span className="rail-kind"> design</span>}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
        {overflow && (
          <li className="nav-item nav-more">
            <button
              type="button"
              className={extra.some((r) => r === current) ? 'nav-link is-section' : 'nav-link'}
              aria-expanded={moreOpen}
              aria-controls="more-menu"
              onClick={() => setMoreOpen((o) => !o)}
            >
              More
            </button>
            {moreOpen && (
              <ul className="more-menu" id="more-menu">
                {extra.map((r) => (
                  <li key={r.path}>
                    <a href={href(r.path)} className="more-link-item" aria-current={current === r ? 'page' : undefined}>
                      {r.title}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )}
      </ul>
    </nav>
  );
}
