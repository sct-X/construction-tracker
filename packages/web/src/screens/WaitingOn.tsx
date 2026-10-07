/**
 * Waiting on: everything that can hold a job up, for one job or all of them,
 * grouped Overdue / This week / Later by act-by. Desktop table, phone cards
 * (same DOM). Read-only: changes go through the bot.
 */
import { addCalendarDays, formatDate, lastMonday, type DashboardApi, type JobListRow, type SideFilter, type WaitingOnView, type WaitingRow } from '@ct/core';
import { useSideQuery } from '../data/DataContext';
import { LoadError, LoadingRows } from '../components/bits';
import { CallLink, DateCell, JobPicker } from '../components/listBits';
import { plural, urgencyWords } from '../ui/itemWords';

export interface WaitingData {
  today: string;
  view: WaitingOnView;
  jobs: JobListRow[];
  jobId: string | null;
}

export async function loadWaiting(api: DashboardApi, filter: SideFilter, jobId: string | null): Promise<WaitingData> {
  const [today, view, list] = await Promise.all([
    api.getToday(),
    api.getWaitingOn({ ...filter, ...(jobId ? { jobId } : {}) }),
    api.listJobs(filter),
  ]);
  return { today, view, jobs: [...list.builds, ...list.design], jobId };
}

export function WaitingOnScreen({ jobId = null }: { jobId?: string | null }) {
  const q = useSideQuery((api, f) => loadWaiting(api, f, jobId));
  const jobName = q.status === 'ready' && jobId ? (q.data.jobs.find((j) => j.jobId === jobId)?.name ?? null) : null;
  return (
    <div className="screen waiting">
      <header className="screen-head screen-head-tools">
        <div>
          <h1>
            Waiting on
            {jobName && (
              <>
                {' '}
                <span className="sr-only">at {jobName}</span>
              </>
            )}
          </h1>
          {q.status === 'ready' && q.data.view.total > 0 && (
            <p className="screen-sub" data-testid="waiting-sub">
              {summary(q.data)}
            </p>
          )}
        </div>
        {/* Inside a job the job bar switches jobs; across all jobs this narrows to one. */}
        {q.status === 'ready' && !jobId && (
          <JobPicker id="waiting-job" jobs={q.data.jobs} current={null} allPath="/waiting" pathFor={(id) => `/jobs/${encodeURIComponent(id)}/waiting`} />
        )}
      </header>
      {q.status === 'loading' && <LoadingRows rows={6} label="Loading the waiting-on list" />}
      {q.status === 'error' && <LoadError what="the waiting-on list" error={q.error} retry={q.retry} />}
      {q.status === 'ready' && <WaitingBody data={q.data} />}
    </div>
  );
}

function summary(d: WaitingData): string {
  const overdue = d.view.groups.find((g) => g.key === 'overdue')?.rows.length ?? 0;
  const where = d.jobId ? '' : ` across ${plural(new Set(d.view.groups.flatMap((g) => g.rows.map((r) => r.jobId))).size, 'job')}`;
  if (!d.view.total) return '';
  return `${plural(d.view.total, 'open item')}${where}, ${overdue} overdue.`;
}

/** The read model's four act-by groups, shown as three: next week folds into Later. */
export function threeGroups(view: WaitingOnView, today: string) {
  const by = (k: string) => view.groups.find((g) => g.key === k)?.rows ?? [];
  const endOfWeek = addCalendarDays(lastMonday(today), 6);
  return [
    { key: 'overdue', title: 'Overdue', note: 'Needed-by gone, or act-by gone while still to do', rows: by('overdue') },
    { key: 'this_week', title: 'This week', note: `Act by ${formatDate(endOfWeek, today)}`, rows: by('this_week') },
    { key: 'later', title: 'Later', note: `Act after ${formatDate(endOfWeek, today)}`, rows: [...by('next_week'), ...by('later')] },
  ];
}

export function WaitingBody({ data }: { data: WaitingData }) {
  const { today, view } = data;
  if (!view.total) {
    return <p className="empty">Nothing waiting{data.jobId ? ' on this job' : ''}.</p>;
  }
  const showJob = !data.jobId;
  const cols = showJob ? 7 : 6;
  return (
    <table className={`board items-table${showJob ? ' with-job' : ''}`}>
      <thead>
        <tr>
          <th scope="col">Item</th>
          {showJob && <th scope="col">Job</th>}
          <th scope="col">Needed by</th>
          <th scope="col">Act by</th>
          <th scope="col">Expected</th>
          <th scope="col">Who</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      {threeGroups(view, today).map((g) => (
        <GroupRows key={g.key} group={g} cols={cols} showJob={showJob} today={today} />
      ))}
    </table>
  );
}

function GroupRows({ group, cols, showJob, today }: { group: ReturnType<typeof threeGroups>[number]; cols: number; showJob: boolean; today: string }) {
  return (
    <>
      <tbody className="group-head-body" data-testid={`waiting-group-${group.key}`} data-count={group.rows.length}>
        <tr>
          <th scope="colgroup" colSpan={cols} className="group-head">
            <span className="group-title">{group.title}</span>
            <span className="group-count">{group.rows.length === 0 ? 'nothing' : plural(group.rows.length, 'item')}</span>
            <span className="group-note">{group.note}</span>
          </th>
        </tr>
      </tbody>
      {group.rows.map((r) => (
        <ItemRow key={r.itemId} row={r} showJob={showJob} today={today} />
      ))}
    </>
  );
}

export function ItemRow({ row, showJob, today }: { row: WaitingRow; showJob: boolean; today: string }) {
  const u = urgencyWords(row, today);
  const context = row.shipmentName ? `On ${row.shipmentName}` : row.stepName ? `For ${row.stepName}` : null;
  return (
    <tbody className="job item" data-testid={`waiting-row-${row.itemId}`} data-urgency={u?.level ?? 'none'}>
      <tr className="job-main">
        <th scope="row" className="c-item">
          <span className="item-title">{row.title}</span>
          <span className="sub">
            {row.typeLabel}
            {context ? `. ${context}` : ''}
          </span>
          {u && (
            <span className={`flag flag-${u.level}`} data-testid="urgency">
              {u.text}
            </span>
          )}
        </th>
        {showJob && (
          <td className="c-jobname">
            <span className="cell-label">Job </span>
            <span className="jobname">{row.jobName}</span>
          </td>
        )}
        <td className="c-needed">
          <DateCell label="Needed by" iso={row.neededBy} today={today} testId="needed-by" />
        </td>
        <td className="c-actby">
          <DateCell label="Act by" iso={row.actBy} today={today} testId="act-by">
            {row.actBy && row.leadTimeWeeks ? `${plural(row.leadTimeWeeks, 'week')} lead time` : undefined}
          </DateCell>
        </td>
        <td className="c-expected">
          <DateCell label="Expected" iso={row.expected} today={today} testId="expected">
            {row.shipmentName && row.expected ? 'From the shipment ETA' : undefined}
          </DateCell>
        </td>
        <td className="c-who">
          <span className="cell-label">Who </span>
          <span className="owner" data-testid="owner">
            {row.owner ?? 'No owner'}
          </span>
          {row.waitingOn && row.waitingOn !== row.owner && !(row.tradePhone && row.waitingOn === row.tradeName) && (
            <span className="sub">Waiting on {row.waitingOn}</span>
          )}
          <CallLink name={row.tradeName} phone={row.tradePhone} />
        </td>
        <td className="c-status">
          <span className="cell-label">Status </span>
          <span className="status-words" data-testid="status">
            {row.statusLabel}
          </span>
        </td>
      </tr>
    </tbody>
  );
}
