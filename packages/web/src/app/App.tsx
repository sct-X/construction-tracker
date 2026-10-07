import { Suspense, useEffect, useRef } from 'react';
import type { DashboardApi, JobListRow } from '@ct/core';
import { DevBar } from '../components/DevBar';
import { SideSwitcher } from '../components/SideSwitcher';
import { JobBar } from '../components/JobBar';
import { MainNav } from '../components/MainNav';
import { LoadingRows } from '../components/bits';
import { useData, useSideQuery } from '../data/DataContext';
import { href, matchPath, useHashPath } from './router';
import { ROUTES } from './routes';
import { isJobRoute } from './jobNav';

/** Every live job on every side: the job bar needs a deep-linked job's side, the rail lists this side's jobs. */
async function loadAllJobs(api: DashboardApi): Promise<JobListRow[]> {
  const v = await api.listJobs();
  return [...v.builds, ...v.design];
}

export function App() {
  const path = useHashPath();
  const { dev, sideId } = useData();
  const found = ROUTES.map((r) => ({ r, params: matchPath(r.path, path) })).find((x) => x.params);
  const jobs = useSideQuery(loadAllJobs);
  const allJobs = jobs.status === 'ready' ? jobs.data : [];
  const sideJobs = allJobs.filter((j) => !sideId || j.sideId === sideId);
  const jobId = found && isJobRoute(found.r) ? (found.params!.jobId ?? null) : null;
  const job = jobId ? (allJobs.find((j) => j.jobId === jobId) ?? null) : null;

  // After a route change (not the first load), focus moves to the main content so a keyboard or screen
  // reader user starts at the new page, not back in the rail.
  const mainRef = useRef<HTMLElement>(null);
  const firstPath = useRef(path);
  useEffect(() => {
    if (path !== firstPath.current) {
      firstPath.current = '';
      mainRef.current?.focus({ preventScroll: false });
    }
  }, [path]);

  useEffect(() => {
    const t = found?.r.title ?? 'Not found';
    document.title = job ? `${t}, ${job.name} | Tracker` : `${t} | Tracker`;
  }, [found?.r.title, job]);

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
      <div className="frame">
        <header className="rail">
          <a className="brand" href={href('/')}>
            Tracker
          </a>
          <SideSwitcher />
          <MainNav current={found?.r} jobs={sideJobs} currentJobId={jobId} />
        </header>
        <main className="main" id="main" ref={mainRef} tabIndex={-1}>
          {jobId && <JobBar jobId={jobId} job={job} sideJobs={sideJobs} current={found?.r} loading={jobs.status === 'loading'} />}
          {found ? (
            <Suspense fallback={<LoadingRows rows={4} label={`Loading ${found.r.title}`} />}>{found.r.render(found.params!)}</Suspense>
          ) : (
            <div className="screen">
              <h1>Nothing here</h1>
              <p className="empty">
                There is no page at #{path}. <a href={href('/')}>Go to Monday</a>.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
