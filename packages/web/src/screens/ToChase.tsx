/**
 * To chase: items still to book or confirm whose act-by is within a fortnight
 * or already gone, grouped by job, with the trade's number as a tap-to-call
 * link. Every job is listed so a job with nothing to chase still shows.
 */
import { useState } from 'react';
import { addCalendarDays, formatDate, type DashboardApi, type SideFilter, type ToChaseView, type WaitingRow } from '@ct/core';
import { useSideQuery } from '../data/DataContext';
import { Freshness, LoadError, LoadingRows } from '../components/bits';
import { CallLink, DateCell } from '../components/listBits';
import { plural, urgencyWords } from '../ui/itemWords';

export interface ChaseData {
  today: string;
  view: ToChaseView;
}

export async function loadChase(api: DashboardApi, filter: SideFilter): Promise<ChaseData> {
  const [today, view] = await Promise.all([api.getToday(), api.getToChase(filter)]);
  return { today, view };
}

export function ToChaseScreen() {
  const q = useSideQuery(loadChase);
  return (
    <div className="screen chase">
      <header className="screen-head">
        <h1>To chase</h1>
        {q.status === 'ready' && (
          <p className="screen-sub" data-testid="chase-sub">
            Still to book or confirm, with act-by before {formatDate(addCalendarDays(q.data.today, 14), q.data.today)} or already gone.
          </p>
        )}
      </header>
      {q.status === 'loading' && <LoadingRows rows={5} label="Loading the to-chase list" />}
      {q.status === 'error' && <LoadError what="the to-chase list" error={q.error} retry={q.retry} />}
      {q.status === 'ready' && <ChaseBody data={q.data} />}
    </div>
  );
}

/** "To do" items need booking; booked ones need a date confirmed. */
function askWords(r: WaitingRow): string {
  if (r.status === 'to_do') return r.type === 'trade' ? 'Not booked yet' : r.type === 'material' ? 'Not ordered yet' : 'Not done yet';
  return r.type === 'material' ? 'Ordered, date not confirmed' : 'Booked, date not confirmed';
}

export function ChaseBody({ data }: { data: ChaseData }) {
  const { today, view } = data;
  const [owner, setOwner] = useState<string | null>(null);
  const owners = new Map<string, number>();
  for (const j of view.jobs) for (const r of j.rows) if (r.owner) owners.set(r.owner, (owners.get(r.owner) ?? 0) + 1);
  const jobs = view.jobs.map((j) => ({ ...j, rows: owner ? j.rows.filter((r) => r.owner === owner) : j.rows }));
  const withRows = jobs.filter((j) => j.rows.length);
  const without = jobs.filter((j) => !j.rows.length);
  const total = withRows.reduce((n, j) => n + j.rows.length, 0);

  if (!view.jobs.length) return <p className="empty">No jobs on this side yet.</p>;
  return (
    <>
      {owners.size > 1 && (
        <div className="chips" role="group" aria-label="Whose items">
          <button type="button" className="chip" aria-pressed={owner === null} onClick={() => setOwner(null)}>
            Everyone <span className="chip-n">{view.total}</span>
          </button>
          {[...owners].sort((a, b) => b[1] - a[1]).map(([name, n]) => (
            <button key={name} type="button" className="chip" aria-pressed={owner === name} onClick={() => setOwner(name)}>
              {name} <span className="chip-n">{n}</span>
            </button>
          ))}
        </div>
      )}
      <p className="count-line" data-testid="chase-count">
        <span className="count-big">{total}</span> {total === 1 ? 'item' : 'items'} to chase across {plural(withRows.length, 'job')}
        {owner ? `, owned by ${owner}` : ''}
      </p>
      {withRows.length > 0 && (
        <table className="board items-table chase-table">
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Act by</th>
              <th scope="col">Needed by</th>
              <th scope="col">Owner</th>
              <th scope="col">Ring</th>
            </tr>
          </thead>
          {withRows.map((j) => (
            <JobRows key={j.jobId} job={j} today={today} />
          ))}
        </table>
      )}
      {without.length > 0 && (
        <p className="quiet-jobs" data-testid="chase-nothing">
          Nothing to chase at {listWords(without.map((j) => j.jobName))}.
          {owner ? '' : ' Still worth confirming each job.'}
        </p>
      )}
    </>
  );
}

function listWords(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function JobRows({ job, today }: { job: ToChaseView['jobs'][number]; today: string }) {
  return (
    <>
      <tbody className="group-head-body" data-testid={`chase-job-${job.jobId}`} data-count={job.rows.length}>
        <tr>
          <th scope="colgroup" colSpan={5} className="group-head">
            <span className="group-title">{job.jobName}</span>
            <span className="group-count">{plural(job.rows.length, 'item')}</span>
            <span className="group-note">
              <Freshness amber={job.amber} freshnessText={job.freshnessText} />
            </span>
          </th>
        </tr>
      </tbody>
      {job.rows.map((r) => (
        <ChaseRow key={r.itemId} row={r} today={today} />
      ))}
    </>
  );
}

function ChaseRow({ row, today }: { row: WaitingRow; today: string }) {
  const u = urgencyWords(row, today);
  return (
    <tbody className="job item" data-testid={`chase-row-${row.itemId}`} data-urgency={u?.level ?? 'none'}>
      <tr className="job-main">
        <th scope="row" className="c-item">
          <span className="item-title">{row.title}</span>
          <span className="sub">
            {askWords(row)}
            {row.stepName ? `. For ${row.stepName}` : ''}
          </span>
          {u && (
            <span className={`flag flag-${u.level}`} data-testid="urgency">
              {u.text}
            </span>
          )}
        </th>
        <td className="c-actby">
          <DateCell label="Act by" iso={row.actBy} today={today} testId="act-by" />
        </td>
        <td className="c-needed">
          <DateCell label="Needed by" iso={row.neededBy} today={today} testId="needed-by" />
        </td>
        <td className="c-who">
          <span className="cell-label">Owner </span>
          <span className="owner" data-testid="owner">
            {row.owner ?? 'No owner'}
          </span>
        </td>
        <td className="c-call">
          {row.tradePhone ? (
            <CallLink name={row.tradeName} phone={row.tradePhone} />
          ) : row.waitingOn && row.waitingOn !== row.owner ? (
            <span className="no-number">
              <span className="cell-label">Ring </span>
              {row.waitingOn}, no number saved
            </span>
          ) : null}
        </td>
      </tr>
    </tbody>
  );
}
