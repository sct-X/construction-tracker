/**
 * The overview: home for Dominic, Dom and Norm, and the jobs index for
 * everyone. One row per job: where it is (stage), what comes next (the next
 * three steps with their dates, the next hold point), what it is waiting on
 * (the top three items), and how fresh that picture is. No forecast finish,
 * no slip, no money: those live nowhere in the app.
 *
 * Desktop: one table per group. Phone: one card per job, the same cells.
 * Design jobs sit below with their stage and outstanding items.
 */
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { MouseEvent } from 'react';
import type { OverviewRow } from '../data/api';
import { useApi, useQuery, useSession } from '../data/context';
import type { Freshness, WaitingOnRow } from '../domain/forecast';
import { formatDayMonth, formatShortRelative, relativeDate } from '../domain/dates';
import { StatusText, type Tone } from '../components/StatusText';
import { useLayout } from '../shell/AppShell';
import './overview.css';

/** "2 outstanding, oldest 23 days"; amber once the oldest has sat more than two weeks. */
export function outstandingWords(outstanding?: number, oldestDays?: number | null): { tone: Tone; text: string } {
  if (!outstanding) return { tone: 'muted', text: 'Nothing outstanding' };
  const n = `${outstanding} outstanding`;
  if (oldestDays === null || oldestDays === undefined) return { tone: 'plain', text: n };
  const text = `${n}, oldest ${oldestDays} day${oldestDays === 1 ? '' : 's'}`;
  return { tone: oldestDays > 14 ? 'amber' : 'plain', text };
}

export default function Overview() {
  const api = useApi();
  const { role, personId } = useSession();
  const rows = useQuery((api) => api.getOverviewRows(), []);
  const desktop = useLayout() === 'desktop';
  const builds = useMemo(() => rows.filter((r) => r.kind === 'build'), [rows]);
  const designs = useMemo(() => rows.filter((r) => r.kind === 'design'), [rows]);
  const canAdd = role === 'admin' || role === 'partner';
  void api;

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
          {builds.length > 0 && (
            <section className="overview__group" aria-labelledby="overview-builds">
              <h2 className="overview__group-title" id="overview-builds">
                Builds
              </h2>
              {desktop ? <BuildTable rows={builds} personId={personId} /> : <BuildCards rows={builds} personId={personId} />}
            </section>
          )}
          {designs.length > 0 && (
            <section className="overview__group" aria-labelledby="overview-design">
              <h2 className="overview__group-title" id="overview-design">
                Design
              </h2>
              {desktop ? <DesignTable rows={designs} /> : <DesignCards rows={designs} />}
            </section>
          )}
        </>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Cells, shared by the table and the cards so the test ids are the same
// ---------------------------------------------------------------------------

/** Tap a row to open the job; the links inside keep their own targets. */
function useOpenJob() {
  const navigate = useNavigate();
  return (jobId: string) => (e: MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    navigate(`/jobs/${jobId}`);
  };
}

function JobName({ row }: { row: OverviewRow }) {
  return (
    <Link to={`/jobs/${row.jobId}`} className="overview__job" data-testid={`job-link-${row.jobId}`}>
      {row.name}
    </Link>
  );
}

function StageCell({ row }: { row: OverviewRow }) {
  return (
    <span className="overview__stage" data-testid={`overview-stage-${row.jobId}`}>
      {row.currentStageName ?? (row.kind === 'build' ? 'No program yet' : 'Done')}
      {row.kind === 'design' && row.path ? <span className="overview__path">{row.path}</span> : null}
    </span>
  );
}

function NextStepsCell({ row }: { row: OverviewRow }) {
  const { today } = useSession();
  if (row.nextSteps.length === 0) return <span className="overview__quiet">Nothing left</span>;
  const hp = row.nextHoldPoint;
  return (
    <ul className="overview__steps" data-testid={`overview-next-${row.jobId}`}>
      {row.nextSteps.map((s) => (
        <li key={s.stepId} className={s.status === 'in_progress' ? 'overview__step overview__step--running' : 'overview__step'}>
          <Link to={`/steps/${s.stepId}`} className="overview__step-link" data-testid={`overview-step-${s.stepId}`}>
            <span className="overview__step-name">{s.name}</span>
            <span className="overview__step-when">
              {s.status === 'in_progress' ? 'under way' : s.start ? formatShortRelative(s.start, today) : 'no date'}
              {s.isHoldPoint && hp?.stepId === s.stepId ? (hp.ok ? ', photos ready' : `, ${hp.missingCategories.length} photo set${hp.missingCategories.length === 1 ? '' : 's'} empty`) : ''}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function waitingDetail(w: WaitingOnRow, today: string): string {
  const parts: string[] = [];
  if (w.expected) parts.push(`expected ${formatDayMonth(w.expected)}, ${relativeDate(w.expected, today)}`);
  // Needed-by passed with nothing expected: lateText is the relative time ("overdue by 3 days").
  else if (w.neededBy && w.isLate) parts.push(`needed ${formatDayMonth(w.neededBy)}`);
  else if (w.actBy) parts.push(`act by ${formatDayMonth(w.actBy)}, ${relativeDate(w.actBy, today, { deadline: w.status === 'to_do' || w.status === 'booked' })}`);
  if (w.lateText) parts.push(w.lateText);
  return parts.join(', ');
}

function WaitingOnCell({ row, personId }: { row: OverviewRow; personId: string }) {
  const { today } = useSession();
  if (row.waitingOn.length === 0) return <span className="overview__quiet">Nothing open</span>;
  return (
    <ul className="overview__waiting" data-testid={`overview-waiting-${row.jobId}`}>
      {row.waitingOn.map((w) => {
        const flagged = w.isLate || w.actByPassed;
        return (
          <li key={w.itemId} className={flagged ? 'overview__item overview__item--late' : 'overview__item'}>
            <Link to={`/items/${w.itemId}`} className="overview__item-link" data-testid={`overview-item-${w.itemId}`}>
              <span className="overview__flag" aria-hidden="true">
                {flagged ? '!' : ''}
              </span>
              <span className="overview__item-body">
                <span className="overview__item-title">{w.title}</span> <span className="overview__item-detail">{waitingDetail(w, today)}</span>
              </span>
              {w.ownerId === personId ? <span className="overview__with-you">With you</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function FreshCell({ jobId, freshness }: { jobId: string; freshness: Freshness }) {
  return (
    <StatusText tone={freshness.amber ? 'amber' : 'muted'} className="overview__fresh" testId={`overview-fresh-${jobId}`}>
      {freshness.text}
    </StatusText>
  );
}

/** "2 outstanding, oldest 23 days" on the first line; what and who on a quiet second line. */
function Outstanding({ row }: { row: OverviewRow }) {
  const { tone, text } = outstandingWords(row.outstanding, row.oldestDays);
  const who = row.oldestItemTitle ? `${row.oldestItemTitle}${row.oldestItemWaitingOn ? `, ${row.oldestItemWaitingOn}` : ''}` : '';
  return (
    <>
      <StatusText tone={tone}>{text}</StatusText>
      {row.outstanding && who ? <span className="overview__outstanding-detail">{who}</span> : null}
    </>
  );
}

function NextStage({ row }: { row: OverviewRow }) {
  return <span className="overview__quiet">{row.nextStageName ? `Then ${row.nextStageName.toLowerCase()}` : 'Last stage'}</span>;
}

// ---------------------------------------------------------------------------
// Desktop tables
// ---------------------------------------------------------------------------

function BuildTable({ rows, personId }: { rows: OverviewRow[]; personId: string }) {
  const openJob = useOpenJob();
  return (
    <table className="table table--rows overview__table overview__table--builds">
      <thead>
        <tr>
          <th scope="col">Job</th>
          <th scope="col">Next steps</th>
          <th scope="col">Waiting on</th>
          <th scope="col">Confirmed</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.jobId} className="overview__row" data-testid={`job-row-${row.jobId}`} onClick={openJob(row.jobId)}>
            <th scope="row" className="overview__cell-job">
              <JobName row={row} />
              <StageCell row={row} />
            </th>
            <td className="overview__cell-next">
              <NextStepsCell row={row} />
            </td>
            <td className="overview__cell-waiting">
              <WaitingOnCell row={row} personId={personId} />
            </td>
            <td className="overview__cell-fresh">
              <FreshCell jobId={row.jobId} freshness={row.freshness} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DesignTable({ rows }: { rows: OverviewRow[] }) {
  const openJob = useOpenJob();
  return (
    <table className="table table--rows overview__table overview__table--design">
      <thead>
        <tr>
          <th scope="col">Job</th>
          <th scope="col">Stage</th>
          <th scope="col">Outstanding</th>
          <th scope="col">Confirmed</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.jobId} className="overview__row" data-testid={`job-row-${row.jobId}`} onClick={openJob(row.jobId)}>
            <th scope="row" className="overview__cell-job">
              <JobName row={row} />
            </th>
            <td className="overview__cell-stage">
              <StageCell row={row} />
              <NextStage row={row} />
            </td>
            <td className="overview__cell-outstanding" data-testid={`overview-outstanding-${row.jobId}`}>
              <Outstanding row={row} />
            </td>
            <td className="overview__cell-fresh">
              <FreshCell jobId={row.jobId} freshness={row.freshness} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Phone cards
// ---------------------------------------------------------------------------

function BuildCards({ rows, personId }: { rows: OverviewRow[]; personId: string }) {
  const openJob = useOpenJob();
  return (
    <ul className="overview__cards">
      {rows.map((row) => (
        <li key={row.jobId} className="overview__card" data-testid={`job-row-${row.jobId}`} onClick={openJob(row.jobId)}>
          <div className="overview__card-head">
            <JobName row={row} />
            <StageCell row={row} />
          </div>
          <div className="overview__card-block">
            <span className="overview__card-label">Next steps</span>
            <NextStepsCell row={row} />
          </div>
          <div className="overview__card-block">
            <span className="overview__card-label">Waiting on</span>
            <WaitingOnCell row={row} personId={personId} />
          </div>
          <FreshCell jobId={row.jobId} freshness={row.freshness} />
        </li>
      ))}
    </ul>
  );
}

function DesignCards({ rows }: { rows: OverviewRow[] }) {
  const openJob = useOpenJob();
  return (
    <ul className="overview__cards">
      {rows.map((row) => (
        <li key={row.jobId} className="overview__card overview__card--design" data-testid={`job-row-${row.jobId}`} onClick={openJob(row.jobId)}>
          <div className="overview__card-head">
            <JobName row={row} />
            <StageCell row={row} />
          </div>
          <p className="overview__outstanding" data-testid={`overview-outstanding-${row.jobId}`}>
            <Outstanding row={row} />
          </p>
          <NextStage row={row} />
          <FreshCell jobId={row.jobId} freshness={row.freshness} />
        </li>
      ))}
    </ul>
  );
}
