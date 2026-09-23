/**
 * The overview: home for Dominic, Dom and Norm, and the jobs index for
 * everyone. One card per job and nothing else on it: the job's name, a slim
 * bar across its stages with the current one named, and how many of its
 * items are overdue ("! 4 overdue" in red, or "Nothing overdue" quietly).
 * The whole card opens the job, where the detail lives.
 *
 * Builds first, then design jobs with their own stages, on the phone as a
 * column of cards and on the desktop as a grid of the same cards.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { OverviewRow } from '../data/api';
import { useQuery, useSession } from '../data/context';
import { StageBar } from '../components/StageBar';
import { StatusText } from '../components/StatusText';
import './overview.css';

/** "4 overdue": the card's one red cue, only when an open item is past its date. */
export function overdueWords(overdue: number): string | null {
  return overdue > 0 ? `${overdue} overdue` : null;
}

export default function Overview() {
  const { role } = useSession();
  const rows = useQuery((api) => api.getOverviewRows(), []);
  const builds = useMemo(() => rows.filter((r) => r.kind === 'build'), [rows]);
  const designs = useMemo(() => rows.filter((r) => r.kind === 'design'), [rows]);
  const canAdd = role === 'admin' || role === 'partner';

  return (
    <main className="overview" data-testid="overview-screen">
      <header className="overview__head">
        <h1 className="overview__title">Overview</h1>
        {canAdd && (
          <Link to="/jobs/new" className="btn btn--primary btn--desktop" data-testid="jobs-new">
            New job
          </Link>
        )}
      </header>

      {rows.length === 0 ? (
        <p className="overview__empty" data-testid="jobs-empty">
          No jobs on this side yet.
        </p>
      ) : (
        <>
          {builds.length > 0 && <JobGroup id="overview-builds" title="Builds" rows={builds} />}
          {designs.length > 0 && <JobGroup id="overview-design" title="Design" rows={designs} />}
        </>
      )}
    </main>
  );
}

function JobGroup({ id, title, rows }: { id: string; title: string; rows: OverviewRow[] }) {
  return (
    <section className="overview__group" aria-labelledby={id}>
      <h2 className="overview__group-title" id={id}>
        {title}
      </h2>
      <ul className="overview__cards">
        {rows.map((row) => (
          <li key={row.jobId}>
            <JobCard row={row} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function JobCard({ row }: { row: OverviewRow }) {
  const words = overdueWords(row.overdue);
  const stage = row.currentStageName ?? (row.stages.length === 0 ? 'No program yet' : 'All stages done');
  return (
    <Link to={`/jobs/${row.jobId}`} className="overview__card" data-testid={`job-row-${row.jobId}`} data-overdue={row.overdue || undefined}>
      <span className="overview__name">{row.name}</span>
      <StageBar stages={row.stages} currentStageId={row.currentStageId} testId={`overview-bar-${row.jobId}`} />
      <span className="overview__foot">
        <span className="overview__stage" data-testid={`overview-stage-${row.jobId}`}>
          {stage}
        </span>
        {words ? (
          <StatusText tone="late" plain className="overview__overdue" testId={`overview-overdue-${row.jobId}`}>
            {words}
          </StatusText>
        ) : (
          <span className="overview__clear" data-testid={`overview-clear-${row.jobId}`}>
            Nothing overdue
          </span>
        )}
      </span>
      <span className="chevron overview__chevron" aria-hidden="true" />
    </Link>
  );
}
