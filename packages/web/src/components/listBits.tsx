/** Stage 4b shared pieces: the job picker, the call link and a labelled date. */
import type { ReactNode } from 'react';
import type { JobListRow } from '@ct/core';
import { href } from '../app/router';
import { dateAndDistance, telHref } from '../ui/itemWords';
import '../styles/lists.css';

/**
 * Native select that moves to another job's page (or "All jobs"). A select
 * keeps seven jobs to one line on a phone; the label is visible.
 */
export function JobPicker({
  jobs,
  current,
  pathFor,
  allPath,
  id,
}: {
  jobs: Pick<JobListRow, 'jobId' | 'name' | 'kind'>[];
  current: string | null;
  pathFor: (jobId: string) => string;
  /** When given, the first option is "All jobs". */
  allPath?: string;
  id: string;
}) {
  const builds = jobs.filter((j) => j.kind === 'build');
  const design = jobs.filter((j) => j.kind === 'design');
  return (
    <div className="picker">
      <label htmlFor={id}>Job</label>
      <select
        id={id}
        value={current ?? ''}
        data-testid="job-picker"
        onChange={(e) => {
          const v = e.target.value;
          window.location.hash = href(v ? pathFor(v) : (allPath ?? '/'));
        }}
      >
        {allPath !== undefined && <option value="">All jobs</option>}
        {builds.length > 0 && (
          <optgroup label="Builds">
            {builds.map((j) => (
              <option key={j.jobId} value={j.jobId}>
                {j.name}
              </option>
            ))}
          </optgroup>
        )}
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
    </div>
  );
}

/** Tap-to-call: the trade's name and number are both written out, never just an icon. */
export function CallLink({ name, phone }: { name: string | null; phone: string | null }) {
  const tel = telHref(phone);
  if (!tel) return null;
  return (
    <a className="call" href={tel} data-testid="call">
      <span className="call-verb">Call</span>
      <span className="call-who">
        <span className="call-name">{name ?? 'trade'}</span>
        <span className="call-num">{phone}</span>
      </span>
    </a>
  );
}

/** A date with its distance underneath ("Fri 18 Sep" / "tomorrow"). Draws "Not set" when missing. */
export function DateCell({ label, iso, today, testId, children }: { label: string; iso: string | null; today: string; testId?: string; children?: ReactNode }) {
  const d = dateAndDistance(iso, today);
  return (
    <>
      <span className="cell-label">{label} </span>
      {d ? (
        <>
          <span className="date-md" data-testid={testId}>
            {d.date}
          </span>
          <span className="sub">{children ?? d.distance}</span>
        </>
      ) : (
        <span className="date-none" data-testid={testId}>
          Not set
        </span>
      )}
    </>
  );
}
