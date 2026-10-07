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
  const rows = [...view.builds, ...view.design];
  if (!rows.length) return <p className="empty">No jobs yet. New jobs are added from Setup on the desktop.</p>;
  return (
    <table className="board jobs-table">
      <thead>
        <tr>
          <th scope="col">Job</th>
          <th scope="col">Kind</th>
          <th scope="col">Stage</th>
          <th scope="col">Forecast finish</th>
          <th scope="col">Last confirmed</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <JobRow key={r.jobId} row={r} />
        ))}
      </tbody>
    </table>
  );
}

function JobRow({ row }: { row: JobListRow }) {
  return (
    <tr className="job-line" data-testid={`job-row-${row.jobId}`}>
      <th scope="row" className="c-job">
        <span className="job-name">{row.name}</span>
      </th>
      <td className="c-kind">
        <CellLabel>Kind</CellLabel>
        <span data-testid="kind">{row.kind === 'build' ? 'Build' : 'Design'}</span>
      </td>
      <td className="c-stage">
        <CellLabel>Stage</CellLabel>
        <span>{row.currentStageName ?? 'Not started'}</span>
      </td>
      <td className="c-finish">
        <CellLabel>Forecast finish</CellLabel>
        {row.forecastFinish ? (
          <span className="num-md" data-testid="finish">
            {formatLong(row.forecastFinish)}
          </span>
        ) : (
          <span className="sub" data-testid="finish">
            {row.kind === 'design' ? 'No program while in design' : 'No finish date'}
          </span>
        )}
      </td>
      <td className="c-fresh">
        <CellLabel>Last confirmed</CellLabel>
        <Freshness amber={row.amber} freshnessText={row.freshnessText} testId="freshness" />
      </td>
    </tr>
  );
}
