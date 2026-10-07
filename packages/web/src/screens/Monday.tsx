/**
 * Monday: every build's forecast finish, how far it moved since last Monday's
 * saved forecast, what that costs, whether the figures are fresh, what must be
 * acted on this week, and why each slipping job moved. Design jobs below,
 * grouped by stage. Desktop is a table; on a phone each job is a card. Same DOM.
 */
import { Fragment } from 'react';
import {
  addCalendarDays,
  formatDate,
  formatDays,
  formatLong,
  formatStamp,
  relativeDays,
  type DashboardApi,
  type MondayBuildRow,
  type MondayDesignRow,
  type MondayView,
  type SideFilter,
  type WhyCause,
  type WhyItMoved,
  type WaitingRow,
} from '@ct/core';
import { useSideQuery } from '../data/DataContext';
import { href } from '../app/router';
import { CellLabel, Freshness, LoadError, LoadingRows, Money } from '../components/bits';
import { fieldWords, slipWords, valueWords } from '../ui/format';

export interface MondayData {
  view: MondayView;
  why: Record<string, WhyItMoved>;
}

/** Each why-it-moved cause carries its own field changes (before/after), so no change-history fetch. */
export async function loadMonday(api: DashboardApi, filter: SideFilter): Promise<MondayData> {
  const view = await api.getMonday(filter);
  const moving = view.builds.filter((b) => b.slipDays);
  const whys = await Promise.all(moving.map((b) => api.getWhyItMoved(b.jobId)));
  return { view, why: Object.fromEntries(whys.map((w) => [w.jobId, w])) };
}

export function MondayScreen() {
  const q = useSideQuery(loadMonday);
  return (
    <div className="screen monday">
      {q.status === 'ready' ? (
        <MondayHeader view={q.data.view} />
      ) : (
        <header className="screen-head">
          <h1>Monday</h1>
        </header>
      )}
      {q.status === 'loading' && <LoadingRows rows={4} label="Loading the Monday screen" />}
      {q.status === 'error' && <LoadError what="the Monday screen" error={q.error} retry={q.retry} />}
      {q.status === 'ready' && <MondayBody data={q.data} />}
    </div>
  );
}

function MondayHeader({ view }: { view: MondayView }) {
  return (
    <header className="screen-head">
      <h1>Monday</h1>
      <p className="screen-sub" data-testid="monday-sub">
        {formatLong(view.today)}. Each finish is compared with the forecast saved {formatDate(view.weekOf, view.today)}.
      </p>
    </header>
  );
}

export function MondayBody({ data }: { data: MondayData }) {
  const { view } = data;
  if (!view.builds.length && !view.design.length) {
    return <p className="empty">No jobs on this side yet. New jobs are added from Setup on the desktop.</p>;
  }
  return (
    <>
      {view.builds.length > 0 && (
        <section aria-labelledby="builds-h" className="block">
          <h2 id="builds-h">Builds</h2>
          <table className="board builds">
            <thead>
              <tr>
                <th scope="col">Job</th>
                <th scope="col">Forecast finish</th>
                <th scope="col">Against last Monday</th>
                <th scope="col">Slip cost</th>
                <th scope="col">Last confirmed</th>
              </tr>
            </thead>
            {view.builds.map((b) => (
              <BuildRow key={b.jobId} row={b} today={view.today} why={data.why[b.jobId] ?? null} />
            ))}
          </table>
        </section>
      )}
      {view.design.length > 0 && <DesignTable rows={view.design} />}
    </>
  );
}

function BuildRow({ row, today, why }: { row: MondayBuildRow; today: string; why: WhyItMoved | null }) {
  const slip = slipWords(row.slipDays, row.snapshotDate, today);
  return (
    <tbody className="job" data-testid={`build-row-${row.jobId}`} data-slip={slip.direction}>
      <tr className="job-main">
        <th scope="row" className="c-job">
          <a className="job-name" href={href(`/jobs/${row.jobId}`)}>
            {row.name}
          </a>
          {row.currentStageName && <span className="job-stage">{row.currentStageName}</span>}
        </th>
        <td className="c-finish">
          <CellLabel>Forecast finish</CellLabel>
          <span className="num" data-testid="finish">
            {row.forecastFinish ? formatLong(row.forecastFinish) : 'No finish date'}
          </span>
          {row.plannedFinish && <span className="sub">{planWords(row.lateDays, row.plannedFinish, today)}</span>}
        </td>
        <td className="c-slip">
          <CellLabel>Against last Monday</CellLabel>
          <span className={`num slip slip-${slip.direction}`} data-testid="slip">
            {slip.big}
          </span>
          <span className="sub">{slip.small}</span>
        </td>
        <td className="c-cost">
          <CellLabel>Slip cost</CellLabel>
          {row.slipCost ? (
            <Money amount={row.slipCost} className="num" testId="slip-cost" />
          ) : row.slipCost === 0 ? (
            <span className="cost-none" data-testid="slip-cost">
              Nothing this week
            </span>
          ) : null}
          {row.weeklyHoldingCost !== null && (
            <span className="sub">
              <Money amount={row.weeklyHoldingCost} /> a week to hold
            </span>
          )}
        </td>
        <td className="c-fresh">
          <CellLabel>Last confirmed</CellLabel>
          <Freshness amber={row.amber} daysUnconfirmed={row.daysUnconfirmed} freshnessText={row.freshnessText} testId="freshness" />
        </td>
      </tr>
      {why && row.slipDays ? (
        <tr className="job-detail">
          <td colSpan={5}>
            <WhyItMovedBlock why={why} today={today} />
          </td>
        </tr>
      ) : null}
      {row.actByDue.length > 0 && (
        <tr className="job-detail">
          <td colSpan={5}>
            <ActBy items={row.actByDue} today={today} jobName={row.name} />
          </td>
        </tr>
      )}
    </tbody>
  );
}

function planWords(lateDays: number, planned: string, today: string): string {
  const d = formatDate(planned, today);
  const n = Math.abs(lateDays);
  const days = `${n} day${n === 1 ? '' : 's'}`;
  if (lateDays > 0) return `Planned ${d}, ${days} late`;
  if (lateDays < 0) return `Planned ${d}, ${days} early`;
  return 'On the original plan';
}

function WhyItMovedBlock({ why, today }: { why: WhyItMoved; today: string }) {
  const titleId = `why-${why.jobId}`;
  return (
    <section className="why" aria-labelledby={titleId} data-testid="why-it-moved">
      <h3 id={titleId}>
        Why it moved{' '}<span className="sr-only">for {why.jobName}</span>
      </h3>
      <ol className="causes">
        {why.causes.map((c) => (
          <Cause key={c.changeSetId} cause={c} today={today} />
        ))}
        {why.otherDays !== 0 && (
          <li className="cause cause-other" data-testid="why-leftover">
            <span className="cause-days">{formatDays(why.otherDays)}</span>
            <div className="cause-body">
              <p className="cause-what">
                {Math.abs(why.otherDays)} day{Math.abs(why.otherDays) === 1 ? '' : 's'} {why.otherDays < 0 ? 'earlier' : 'later'} for reasons not in
                the change log
              </p>
            </div>
          </li>
        )}
        {why.causes.length === 0 && why.otherDays === 0 && (
          <li className="cause cause-other">
            <span className="cause-days">{why.slipDays !== null ? formatDays(why.slipDays) : ''}</span>
            <div className="cause-body">
              <p className="cause-what">No logged change explains this.</p>
            </div>
          </li>
        )}
      </ol>
    </section>
  );
}

function Cause({ cause, today }: { cause: WhyCause; today: string }) {
  const fields = cause.changes.slice(0, 3);
  const source = cause.sourceText;
  const how = cause.sourceKind === 'voice' ? 'Voice note' : cause.sourceKind === 'text' ? 'Message' : null;
  const channel = cause.sourceChannel === 'telegram' ? ' on Telegram' : '';
  const when = cause.sourceReceivedAt ?? cause.confirmedAt;
  return (
    <li className="cause" data-testid="why-cause">
      <span className="cause-days">{formatDays(cause.deltaDays)}</span>
      <div className="cause-body">
        {fields.length ? (
          <ul className="cause-fields">
            {fields.map((f, i) => (
              <li key={i}>
                {f.kind === 'update' && f.field ? (
                  <>
                    <span className="cause-what">
                      {f.rowLabel}, {fieldWords(f.field)}
                    </span>{' '}
                    <span className="before-after">
                      {valueWords(f, f.before, today)} → {valueWords(f, f.after, today)}
                    </span>
                  </>
                ) : (
                  <span className="cause-what">
                    {f.kind === 'insert' ? 'Added' : 'Removed'} {f.rowLabel}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="cause-what">{cause.summary}</p>
        )}
        <p className="cause-finish">
          {cause.finishBefore && cause.finishAfter ? (
            <>
              Finish {formatDate(cause.finishBefore, today)} → {formatDate(cause.finishAfter, today)}
            </>
          ) : (
            'Moved steps but not the finish'
          )}
          {cause.cost ? (
            <>
              , <Money amount={cause.cost} /> of holding cost
            </>
          ) : null}
        </p>
        {source && (
          <blockquote className="source">
            <p>“{source}”</p>
            {how && (
              <footer>
                {how}
                {channel}
                {when ? `, ${formatStamp(when)}` : ''}
              </footer>
            )}
          </blockquote>
        )}
      </div>
    </li>
  );
}

function ActBy({ items, today, jobName }: { items: WaitingRow[]; today: string; jobName: string }) {
  return (
    <section className="actby" data-testid="act-by">
      <h3>
        Act by this week{' '}<span className="sr-only">for {jobName}</span>{' '}
        <span className="h-note">to {formatDate(addCalendarDays(today, 7), today)}</span>
      </h3>
      <ul>
        {items.map((i) => {
          const passed = !!i.actBy && i.actBy < today;
          return (
            <li key={i.itemId} className={passed ? 'actby-item actby-passed' : 'actby-item'}>
              <span className="actby-title">{i.title}</span>
              <span className="actby-when">
                {i.actBy ? `Act by ${formatDate(i.actBy, today)}, ${relativeDays(i.actBy, today, { deadline: true })}` : 'No act-by date'}
              </span>
              <span className="actby-who">
                {[i.owner, i.waitingOn && i.waitingOn !== i.owner ? `waiting on ${i.waitingOn}` : null].filter(Boolean).join(', ')}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function groupByStage(rows: MondayDesignRow[]): [string, MondayDesignRow[]][] {
  const groups = new Map<string, MondayDesignRow[]>();
  for (const r of rows) {
    const k = r.stageName ?? 'No stage';
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return [...groups];
}

function DesignTable({ rows }: { rows: MondayDesignRow[] }) {
  return (
    <section aria-labelledby="design-h" className="block">
      <h2 id="design-h">Design</h2>
      <table className="board design">
        <thead>
          <tr>
            <th scope="col">Job</th>
            <th scope="col">Outstanding</th>
            <th scope="col">Oldest</th>
            <th scope="col">Last confirmed</th>
          </tr>
        </thead>
        {groupByStage(rows).map(([stage, list]) => (
          <Fragment key={stage}>
            <tbody className="stage-group">
              <tr>
                <th scope="colgroup" colSpan={4} className="stage-head">
                  {stage} <span className="stage-count">{list.length === 1 ? '1 job' : `${list.length} jobs`}</span>
                </th>
              </tr>
            </tbody>
            {list.map((r) => (
              <tbody key={r.jobId} className="job design-job" data-testid={`design-row-${r.jobId}`}>
                <tr className="job-main">
                  <th scope="row" className="c-job">
                    <a className="job-name" href={href(`/jobs/${r.jobId}/checklist`)}>
                      {r.name}
                    </a>
                    {r.path && <span className="job-stage">{r.path}</span>}
                  </th>
                  <td className="c-out">
                    <CellLabel>Outstanding</CellLabel>
                    <span className="num-md" data-testid="outstanding">
                      {r.outstanding === 0 ? 'Nothing' : `${r.outstanding} item${r.outstanding === 1 ? '' : 's'}`}
                    </span>
                  </td>
                  <td className="c-oldest">
                    <CellLabel>Oldest</CellLabel>
                    {r.oldestDays !== null ? (
                      <>
                        <span className="num-md" data-testid="oldest">
                          {r.oldestDays} day{r.oldestDays === 1 ? '' : 's'}
                        </span>
                        <span className="sub">
                          {r.oldestTitle}
                          {r.oldestWaitingOn ? `, waiting on ${r.oldestWaitingOn}` : ''}
                        </span>
                      </>
                    ) : (
                      <span className="sub">Nothing waiting</span>
                    )}
                  </td>
                  <td className="c-fresh">
                    <CellLabel>Last confirmed</CellLabel>
                    <Freshness amber={r.amber} freshnessText={r.freshnessText} />
                  </td>
                </tr>
              </tbody>
            ))}
          </Fragment>
        ))}
      </table>
    </section>
  );
}
