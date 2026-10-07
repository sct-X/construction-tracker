import { useEffect } from 'react';
import type { DashboardApi, JobListRow } from '@ct/core';
import { DevBar } from '../components/DevBar';
import { SideSwitcher } from '../components/SideSwitcher';
import { JobBar } from '../components/JobBar';
import { MainNav } from '../components/MainNav';
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

  useEffect(() => {
    const t = found?.r.title ?? 'Not found';
    document.title = job ? `${t}, ${job.name} | Tracker` : `${t} | Tracker`;
  }, [found?.r.title, job]);

  return (
    <div className={dev ? 'app has-devbar' : 'app'}>
      {dev && <DevBar />}
      <div className="frame">
        <header className="rail">
          <a className="brand" href={href('/')}>
            Tracker
          </a>
          <SideSwitcher />
          <MainNav current={found?.r} jobs={sideJobs} currentJobId={jobId} />
        </header>
        <main className="main" id="main">
          {jobId && <JobBar jobId={jobId} job={job} sideJobs={sideJobs} current={found?.r} loading={jobs.status === 'loading'} />}
          {found ? (
            found.r.render(found.params!)
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
