/**
 * Screen 2: the Monday screen (UI_PLAN 3.2, wireframe in section 5).
 *
 * Every build job's forecast finish, how far it moved since last Monday's
 * snapshot (or since the original plan, on the toggle), what that costs, the
 * top three things it is waiting on, and how fresh the figures are. Design
 * jobs sit below with their stage and outstanding items in place of dates.
 *
 * Desktop: one table per group. Phone: one card per job, the same cells.
 * Numbers are the largest type on the screen; the finish date leads each row.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { MouseEvent } from 'react';
import type { MondayRow } from '../data/api';
import { useApi, useQuery, useSession } from '../data/context';
import type { Freshness, WaitingOnRow } from '../domain/forecast';
import { formatDayMonth, formatLong, formatShort, lastMonday } from '../domain/dates';
import { BigNumber } from '../components/BigNumber';
import { Money } from '../components/Money';
import { SlipText, slipTone } from '../components/SlipText';
import { StatusText } from '../components/StatusText';
import './monday.css';

export type SlipSince = 'monday' | 'plan';

const DESKTOP = '(min-width: 768px)';

/** True at the desktop breakpoint (768px and up). Tables there, cards below. */
function useDesktop(): boolean {
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia(DESKTOP).matches);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const onChange = () => setDesktop(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return desktop;
}

export default function Monday() {
  const api = useApi();
  const session = useSession();
  const rows = useQuery((api) => api.getMondayRows(), []);
  const desktop = useDesktop();
  const [params, setParams] = useSearchParams();
  const since: SlipSince = params.get('since') === 'plan' ? 'plan' : 'monday';

  if (!api.canSee('monday')) {
    return (
      <main className="monday" data-testid="monday-screen">
        <h1 className="monday__title">Monday</h1>
        <p className="monday__empty" data-testid="monday-no-access">
          You don't have access to this.
        </p>
      </main>
    );
  }

  const monday = lastMonday(session.today);
  const builds = rows.filter((r) => r.kind === 'build');
  const designs = rows.filter((r) => r.kind === 'design');
  const showMoney = builds.some((r) => r.weeklyHoldingCost !== undefined);

  const setSince = (next: SlipSince) => {
    const p = new URLSearchParams(params);
    if (next === 'plan') p.set('since', 'plan');
    else p.delete('since');
    setParams(p, { replace: true });
  };

  return (
    <main className="monday" data-testid="monday-screen">
      <header className="monday__head">
        <div className="monday__head-words">
          <h1 className="monday__title">Monday</h1>
          <p className="monday__week" data-testid="monday-week">
            Week of {formatShort(monday)}. {since === 'plan' ? 'Compared with the original plan.' : "Compared with Monday's forecast."}
          </p>
        </div>
        <div className="monday__since" role="group" aria-label="Slip since">
          <span className="monday__since-label">Slip since</span>
          <span className="seg">
            <button type="button" className="seg__btn" aria-pressed={since === 'monday'} data-testid="monday-since-monday" onClick={() => setSince('monday')}>
              Monday
            </button>
            <button type="button" className="seg__btn" aria-pressed={since === 'plan'} data-testid="monday-since-plan" onClick={() => setSince('plan')}>
              the original plan
            </button>
          </span>
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="monday__empty" data-testid="monday-empty">
          No jobs on this side yet.
        </p>
      ) : (
        <>
          {builds.length > 0 && (
            <section className="monday__group" aria-labelledby="monday-builds">
              <h2 className="monday__group-title" id="monday-builds">
                Builds
              </h2>
              {desktop ? (
                <BuildTable rows={builds} since={since} showMoney={showMoney} personId={session.personId} />
              ) : (
                <BuildCards rows={builds} since={since} personId={session.personId} />
              )}
            </section>
          )}
          {designs.length > 0 && (
            <section className="monday__group" aria-labelledby="monday-design">
              <h2 className="monday__group-title" id="monday-design">
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

/**
 * "Tap a row to open the job" (UI_PLAN 3.2). The row is a pointer convenience:
 * the links inside it (job name, slip figure, items) keep their own targets and
 * give keyboard users the same destinations, so a click that started on one of
 * them is left alone.
 */
function useOpenJob() {
  const navigate = useNavigate();
  return (jobId: string) => (e: MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    navigate(`/jobs/${jobId}`);
  };
}

function slipFor(row: MondayRow, since: SlipSince): { days?: number; cost?: number } {
  return since === 'plan' ? { days: row.slipSincePlanDays, cost: row.slipSincePlanCost } : { days: row.slipDays, cost: row.slipCost };
}

function JobName({ row }: { row: MondayRow }) {
  return (
    <Link to={`/jobs/${row.jobId}`} className="monday__job" data-testid={`monday-job-${row.jobId}`}>
      {row.name}
    </Link>
  );
}

function FinishCell({ row }: { row: MondayRow }) {
  return (
    <BigNumber
      size="row"
      value={row.forecastFinish ? formatLong(row.forecastFinish) : 'No dates yet'}
      label="Forecast finish"
      tone={row.forecastFinish ? undefined : 'muted'}
      testId={`monday-finish-${row.jobId}`}
    />
  );
}

function SlipCell({ row, since }: { row: MondayRow; since: SlipSince }) {
  const { days, cost } = slipFor(row, since);
  const tone = slipTone(days);
  const why = days === undefined ? 'Slip' : days === 0 ? 'Nothing moved' : 'Why it moved';
  return (
    <Link
      to={`/jobs/${row.jobId}/why${since === 'plan' ? '?since=plan' : ''}`}
      className="monday__slip-link"
      data-testid={`monday-slip-${row.jobId}`}
      title={why}
    >
      <BigNumber size="row" tone={tone} value={<SlipText days={days} cost={cost} />} label="Slip" />
      <span className="sr-only">, {why}</span>
    </Link>
  );
}

function HoldingCell({ row, label }: { row: MondayRow; label?: string }) {
  return <Money value={row.weeklyHoldingCost} label={label} suffix="/wk" testId={`monday-holding-${row.jobId}`} />;
}

function waitingDetail(w: WaitingOnRow): string {
  const parts: string[] = [];
  if (w.expected) parts.push(`expected ${formatDayMonth(w.expected)}`);
  else if (w.neededBy && w.isLate) parts.push(`needed ${formatDayMonth(w.neededBy)}`);
  else if (w.actBy) parts.push(`act by ${formatDayMonth(w.actBy)}`);
  if (w.lateText) parts.push(w.lateText);
  else if (w.actByPassed) parts.push('act-by passed');
  return parts.join(', ');
}

function WaitingOnCell({ row, personId }: { row: MondayRow; personId: string }) {
  if (row.waitingOn.length === 0) {
    return <span className="monday__quiet">Nothing open</span>;
  }
  return (
    <ul className="monday__waiting" data-testid={`monday-waiting-${row.jobId}`}>
      {row.waitingOn.map((w) => {
        const flagged = w.isLate || w.actByPassed;
        return (
          <li key={w.itemId} className={flagged ? 'monday__item monday__item--late' : 'monday__item'}>
            <Link to={`/items/${w.itemId}`} className="monday__item-link" data-testid={`monday-item-${w.itemId}`}>
              <span className="monday__flag" aria-hidden="true">
                {flagged ? '!' : ''}
              </span>
              <span className="monday__item-body">
                <span className="monday__item-title">{w.title}</span> <span className="monday__item-detail">{waitingDetail(w)}</span>
              </span>
              {w.ownerId === personId ? <span className="monday__with-you">With you</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function FreshCell({ jobId, freshness }: { jobId: string; freshness: Freshness }) {
  return (
    <StatusText tone={freshness.amber ? 'amber' : 'muted'} className="monday__fresh" testId={`monday-fresh-${jobId}`}>
      {freshness.text}
    </StatusText>
  );
}

/** "2 outstanding, oldest 23 days" on the first line; what and who on a quiet second line. */
function Outstanding({ row }: { row: MondayRow }) {
  const n = row.outstanding ?? 0;
  if (n === 0) return <>Nothing outstanding</>;
  const head = `${n} outstanding, ${n === 1 ? '' : 'oldest '}${row.oldestDays ?? 0} days`;
  const who = row.oldestItemTitle ? `${row.oldestItemTitle}${row.oldestItemWaitingOn ? `, ${row.oldestItemWaitingOn}` : ''}` : '';
  return (
    <>
      {head}
      {who ? <span className="monday__outstanding-detail">{who}</span> : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Desktop tables
// ---------------------------------------------------------------------------

function BuildTable({ rows, since, showMoney, personId }: { rows: MondayRow[]; since: SlipSince; showMoney: boolean; personId: string }) {
  const openJob = useOpenJob();
  return (
    <table className="table table--rows monday__table monday__table--builds">
      <thead>
        <tr>
          <th scope="col">Job</th>
          <th scope="col">Forecast finish</th>
          <th scope="col">Slip</th>
          <th scope="col">Waiting on</th>
          <th scope="col">Confirmed</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.jobId} className="monday__row" data-testid={`monday-row-${row.jobId}`} onClick={openJob(row.jobId)}>
            <th scope="row" className="monday__cell-job">
              <JobName row={row} />
              {row.currentStageName ? <span className="monday__stage">{row.currentStageName}</span> : null}
              {showMoney ? (
                <span className="monday__holding">
                  <HoldingCell row={row} />
                </span>
              ) : null}
            </th>
            <td className="monday__cell-finish">
              <FinishCell row={row} />
            </td>
            <td className="monday__cell-slip">
              <SlipCell row={row} since={since} />
            </td>
            <td className="monday__cell-waiting">
              <WaitingOnCell row={row} personId={personId} />
            </td>
            <td className="monday__cell-fresh">
              <FreshCell jobId={row.jobId} freshness={row.freshness} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DesignTable({ rows }: { rows: MondayRow[] }) {
  const openJob = useOpenJob();
  return (
    <table className="table table--rows monday__table monday__table--design">
      <thead>
        <tr>
          <th scope="col">Job</th>
          <th scope="col">Stage</th>
          <th scope="col">Outstanding</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.jobId} className="monday__row" data-testid={`monday-row-${row.jobId}`} onClick={openJob(row.jobId)}>
            <th scope="row" className="monday__cell-job">
              <JobName row={row} />
            </th>
            <td className="monday__cell-stage" data-testid={`monday-stage-${row.jobId}`}>
              {row.currentStageName ?? 'No stage'}
            </td>
            <td className="monday__cell-outstanding" data-testid={`monday-outstanding-${row.jobId}`}>
              <Outstanding row={row} />
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

function BuildCards({ rows, since, personId }: { rows: MondayRow[]; since: SlipSince; personId: string }) {
  const openJob = useOpenJob();
  return (
    <ul className="monday__cards">
      {rows.map((row) => (
        <li key={row.jobId} className="monday__card" data-testid={`monday-row-${row.jobId}`} onClick={openJob(row.jobId)}>
          <div className="monday__card-head">
            <JobName row={row} />
            {row.currentStageName ? <span className="monday__stage">{row.currentStageName}</span> : null}
          </div>
          <div className="monday__card-figures">
            <FinishCell row={row} />
            <SlipCell row={row} since={since} />
          </div>
          <HoldingCell row={row} label="Holding" />
          <WaitingOnCell row={row} personId={personId} />
          <FreshCell jobId={row.jobId} freshness={row.freshness} />
        </li>
      ))}
    </ul>
  );
}

function DesignCards({ rows }: { rows: MondayRow[] }) {
  const openJob = useOpenJob();
  return (
    <ul className="monday__cards">
      {rows.map((row) => (
        <li key={row.jobId} className="monday__card monday__card--design" data-testid={`monday-row-${row.jobId}`} onClick={openJob(row.jobId)}>
          <div className="monday__card-head">
            <JobName row={row} />
            <span className="monday__stage" data-testid={`monday-stage-${row.jobId}`}>
              {row.currentStageName ?? 'No stage'}
            </span>
          </div>
          <p className="monday__outstanding" data-testid={`monday-outstanding-${row.jobId}`}>
            <Outstanding row={row} />
          </p>
        </li>
      ))}
    </ul>
  );
}
