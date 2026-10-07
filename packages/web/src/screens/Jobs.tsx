/** Jobs: every live job on this side with its kind, stage, forecast finish and freshness. */
import { formatLong, type DashboardApi, type JobListRow, type JobsListView, type SideFilter } from '@ct/core';
import { useSideQuery } from '../data/DataContext';
import { CellLabel, Freshness, LoadError, LoadingRows } from '../components/bits';

export function loadJobs(api: DashboardApi, filter: SideFilter): Promise<JobsListView> {
  return api.listJobs(filter);
}

export function JobsScreen() {
  const q = useSideQuery(loadJobs);
  return (
    <div className="screen jobs">
      <header className="screen-head">
        <h1>Jobs</h1>
        {q.status === 'ready' && (
          <p className="screen-sub">
            {count(q.data.builds.length, 'build')} and {count(q.data.design.length, 'design job')}.
          </p>
        )}
      </header>
      {q.status === 'loading' && <LoadingRows rows={6} label="Loading jobs" />}
      {q.status === 'error' && <LoadError what="the jobs list" error={q.error} retry={q.retry} />}
      {q.status === 'ready' && <JobsTable view={q.data} />}
    </div>
  );
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

export function JobsTable({ view }: { view: JobsListView }) {
  if (!view.builds.length && !view.design.length) {
    return <p className="empty">No jobs yet. New jobs are added from Setup on the desktop.</p>;
  }
  const groups: [string, JobListRow[]][] = [
    ['Builds', view.builds],
    ['Design', view.design],
  ];
  return (
    <table className="board jobs-table">
      <thead>
        <tr>
          <th scope="col">Job</th>
          <th scope="col">Stage</th>
          <th scope="col">Forecast finish</th>
          <th scope="col">Against last Monday</th>
          <th scope="col">Last confirmed</th>
        </tr>
      </thead>
      {groups
        .filter(([, rows]) => rows.length)
        .map(([title, rows]) => (
          <tbody key={title} className="kind-group" data-testid={`jobs-group-${title.toLowerCase()}`}>
            <tr>
              <th scope="colgroup" colSpan={5} className="stage-head">
                {title} <span className="stage-count">{rows.length === 1 ? '1 job' : `${rows.length} jobs`}</span>
              </th>
            </tr>
            {rows.map((r) => (
              <JobRow key={r.jobId} row={r} />
            ))}
          </tbody>
        ))}
    </table>
  );
}

function JobRow({ row }: { row: JobListRow }) {
  return (
    <tr className={`job-line job-${row.kind}`} data-testid={`job-row-${row.jobId}`} data-kind={row.kind}>
      <th scope="row" className="c-job">
        <span className="job-name">{row.name}</span>
      </th>
      <td className="c-stage">
        <CellLabel>Stage</CellLabel>
        <span>{row.currentStageName ?? 'Not started'}</span>
      </td>
      {row.kind === 'build' ? (
        <>
          <td className="c-finish">
            <CellLabel>Forecast finish</CellLabel>
            <span className="num-md" data-testid="finish">
              {row.forecastFinish ? formatLong(row.forecastFinish) : 'No finish date'}
            </span>
          </td>
          <td className="c-slip">
            <CellLabel>Against last Monday</CellLabel>
            <span data-testid="slip" className={row.slipDays && row.slipDays > 0 ? 'slip-words slip-words-later' : 'slip-words'}>
              {slipText(row.slipDays)}
            </span>
          </td>
        </>
      ) : (
        <td className="c-nofinish" colSpan={2}>
          <span className="sub">No program while in design</span>
        </td>
      )}
      <td className="c-fresh">
        <CellLabel>Last confirmed</CellLabel>
        <Freshness amber={row.amber} freshnessText={row.freshnessText} testId="freshness" />
      </td>
    </tr>
  );
}

/** "5 days later", "On track", "2 days earlier"; before the first Monday snapshot there is nothing to compare. */
function slipText(days: number | null): string {
  if (days === null) return 'No Monday forecast yet';
  if (days === 0) return 'On track';
  const n = Math.abs(days);
  return `${n} day${n === 1 ? '' : 's'} ${days > 0 ? 'later' : 'earlier'}`;
}
