/**
 * Above every job screen: the job's name, a job switcher (phone; the desktop
 * rail lists the jobs) and the job's tabs from the route table. A deep link to
 * a job on the other side switches the side; switching side away from the job
 * goes back to the jobs list, so no screen mixes two sides.
 */
import { useEffect, useRef } from 'react';
import type { JobListRow } from '@ct/core';
import { useData } from '../data/DataContext';
import { href } from '../app/router';
import type { RouteDef } from '../app/routes';
import { activeTabPath, fillPath, jobTabs, switchJobHref, tabLabel } from '../app/jobNav';

export function JobBar(props: { jobId: string; job: JobListRow | null; sideJobs: JobListRow[]; current: RouteDef | undefined; loading: boolean }) {
  const { job, sideJobs, current, jobId } = props;
  const { sideId, setSideId } = useData();
  const lastSide = useRef(sideId);

  useEffect(() => {
    if (job && sideId && job.sideId !== sideId) {
      if (lastSide.current === sideId) setSideId(job.sideId);
      else globalThis.location?.replace(href('/jobs'));
    }
    lastSide.current = sideId;
  }, [job, sideId, setSideId]);

  if (!job) {
    return props.loading ? <div className="jobbar jobbar-loading" aria-hidden="true" /> : null;
  }
  const tabs = jobTabs(job.kind);
  const active = activeTabPath(current);
  const kindWords = job.kind === 'design' ? `Design${job.path ? `, ${job.path}` : ''}` : `Build${job.currentStageName ? `, ${job.currentStageName}` : ''}`;
  const builds = sideJobs.filter((j) => j.kind === 'build');
  const design = sideJobs.filter((j) => j.kind === 'design');

  return (
    <div className="jobbar" data-testid="job-bar">
      <div className="jobbar-top">
        <p className="jobbar-name">
          {job.name} <span className="jobbar-kind">{kindWords}</span>
        </p>
        {sideJobs.length > 1 && (
          <label className="jobbar-switch">
            <span className="sr-only">Switch job</span>
            <select
              value={jobId}
              data-testid="job-switcher"
              onChange={(e) => {
                const next = sideJobs.find((j) => j.jobId === e.target.value);
                if (next) globalThis.location.hash = switchJobHref(current, next);
              }}
            >
              <optgroup label="Builds">
                {builds.map((j) => (
                  <option key={j.jobId} value={j.jobId}>
                    {j.name}
                  </option>
                ))}
              </optgroup>
              {design.length > 0 && (
                <optgroup label="Design">
                  {design.map((j) => (
                    <option key={j.jobId} value={j.jobId}>
                      {j.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
        )}
      </div>
      <nav className="tabs" aria-label={`${job.name} pages`}>
        {tabs.map((t) => (
          <a key={t.path} className="tab" href={href(fillPath(t.path, { jobId }))} aria-current={t.path === active ? 'page' : undefined}>
            {tabLabel(t)}
          </a>
        ))}
      </nav>
    </div>
  );
}
