/**
 * The header every job page starts with (Dom's brief, change 1).
 *
 * For partners and admin the job's name is the page title and also a
 * dropdown of every job on the side, builds then design jobs as on the
 * Overview. Picking one opens the same page on that job when it has one
 * (Program to Program), else that job's overview. Builder and site job pages
 * keep the plain title, unchanged.
 *
 * The dropdown is a native <select> laid over the h1, so the heading still
 * reads as the job's name and the picker is the platform's own (a wheel on a
 * phone, a menu on the desktop, arrow keys everywhere).
 *
 *   <JobHeader job={job} section="program" meta="Framing stage" back={{ to: `/jobs/${job.id}`, label: job.name }} />
 */
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useSession } from '../data/context';
import type { Job } from '../domain/types';
import { PageHeader } from './PageHeader';
import { jobSectionHref, jobSwitcherFor, type JobSection } from './nav';

interface Props {
  job: Job;
  section: JobSection;
  /** Title for roles without the switcher; defaults to the job's name. */
  title?: string;
  meta?: ReactNode;
  /** Meta for roles with the switcher, where the title is the job's name; defaults to `meta`. */
  switchMeta?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
  children?: ReactNode;
}

export function JobHeader({ job, section, title, meta, switchMeta, actions, back, children }: Props) {
  const { role } = useSession();
  if (!jobSwitcherFor(role)) {
    return (
      <PageHeader title={title ?? job.name} meta={meta} actions={actions} back={back}>
        {children}
      </PageHeader>
    );
  }
  // Under the switcher the back link on a job sub-page would repeat the name
  // right above it; it names where it goes instead.
  const switchBack = back && section !== 'overview' && back.to === `/jobs/${job.id}` ? { to: back.to, label: 'Job overview' } : back;
  return (
    <PageHeader title={job.name} titleSlot={<JobSwitcher job={job} section={section} />} meta={switchMeta ?? meta} actions={actions} back={switchBack}>
      {children}
    </PageHeader>
  );
}

function ChevronIcon() {
  return (
    <svg className="job-switch__chevron" viewBox="0 0 26 26" width="26" height="26" aria-hidden="true">
      <circle className="job-switch__chevron-disc" cx="13" cy="13" r="13" />
      <path d="M8.6 11.2 13 15.6l4.4-4.4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function JobSwitcher({ job, section }: { job: Job; section: JobSection }) {
  const navigate = useNavigate();
  const jobs = useQuery((api) => api.listJobs(), []);
  // The Overview's red cue travels into the list as words: "Park Rd (2 overdue)".
  const overdue = useQuery((api) => new Map(api.getOverviewRows().map((r) => [r.jobId, r.overdue])), []);
  const builds = jobs.filter((j) => j.kind === 'build');
  const designs = jobs.filter((j) => j.kind === 'design');
  // A job reached by a deep link is always in the list, so the select shows it.
  const listed = jobs.some((j) => j.id === job.id);

  const option = (j: Job) => {
    const n = overdue.get(j.id) ?? 0;
    return (
      <option key={j.id} value={j.id} data-testid={`job-switcher-${j.id}`}>
        {n > 0 ? `${j.name} (${n} overdue)` : j.name}
      </option>
    );
  };

  const pick = (id: string) => {
    const next = jobs.find((j) => j.id === id);
    if (!next || next.id === job.id) return;
    navigate(jobSectionHref(section, next));
  };

  return (
    <div className="job-switch" data-testid="job-switch">
      <h1 className="page-header__title job-switch__name">
        <span className="job-switch__text">{job.name}</span>
        <ChevronIcon />
      </h1>
      <select
        className="job-switch__select"
        value={job.id}
        onChange={(e) => pick(e.target.value)}
        aria-label="Switch job"
        data-testid="job-switcher"
      >
        {!listed && option(job)}
        {builds.length > 0 && designs.length > 0 ? (
          <>
            <optgroup label="Builds">{builds.map(option)}</optgroup>
            <optgroup label="Design">{designs.map(option)}</optgroup>
          </>
        ) : (
          [...builds, ...designs].map(option)
        )}
      </select>
    </div>
  );
}
