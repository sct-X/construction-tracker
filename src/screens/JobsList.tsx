/**
 * Jobs list (UI_PLAN 3.3): every job on this side, builds then design.
 * Desktop: a table. Phone: one card per job, the whole card a 56px+ target.
 * The forecast finish is the number; late, slip and freshness are words
 * with a wash behind them (StatusText), never colour alone. Money draws
 * nothing when the field is absent, so Alec's list looks finished.
 */
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useSession } from '../data/context';
import type { Job } from '../domain/types';
import type { JobForecast } from '../domain/forecast';
import { formatDayMonthYear } from '../domain/dates';
import { Money } from '../components/Money';
import { StatusText, type Tone } from '../components/StatusText';
import { PageHeader } from '../shell/PageHeader';
import { useLayout } from '../shell/AppShell';
import './jobsList.css';

interface Row {
  job: Job;
  forecast?: JobForecast;
}

function HoldingCost({ value }: { value?: number }) {
  return <Money value={value} suffix="/wk" className="jobs__money" />;
}

function finishStatus(f?: JobForecast): { tone: Tone; text: string } | null {
  if (!f || !f.forecastFinish) return null;
  if (f.lateDays > 0) return { tone: 'late', text: `${f.lateDays} day${f.lateDays === 1 ? '' : 's'} late` };
  if (f.lateDays < 0) return { tone: 'ok', text: `${-f.lateDays} day${f.lateDays === -1 ? '' : 's'} early` };
  return { tone: 'ok', text: 'On plan' };
}

function slipStatus(f?: JobForecast): { tone: Tone; text: string } {
  if (!f || f.slipDays === undefined) return { tone: 'muted', text: 'Slip appears after the first Monday' };
  if (f.slipDays > 0) return { tone: 'late', text: `+${f.slipDays} days this week` };
  if (f.slipDays < 0) return { tone: 'ok', text: `${f.slipDays} days this week` };
  return { tone: 'muted', text: 'No change this week' };
}

/** Rule 7 comes from the calculator's `freshness`; this only words the amber case as "Unconfirmed N days". */
function freshnessStatus(f?: JobForecast): { tone: Tone; text: string } | null {
  if (!f) return null;
  const { amber, daysUnconfirmed, text } = f.freshness;
  if (!amber) return { tone: 'muted', text };
  return { tone: 'amber', text: daysUnconfirmed === undefined ? text : `Unconfirmed ${daysUnconfirmed} days` };
}

/** "2 outstanding, oldest 23 days"; amber once the oldest has sat more than two weeks. */
export function outstandingStatus(f?: JobForecast): { tone: Tone; text: string } {
  const c = f?.checklist;
  if (!c || c.outstanding === 0) return { tone: 'muted', text: 'Nothing outstanding' };
  const n = `${c.outstanding} outstanding`;
  if (c.oldestDays === null) return { tone: 'plain', text: n };
  const text = `${n}, oldest ${c.oldestDays} day${c.oldestDays === 1 ? '' : 's'}`;
  return { tone: c.oldestDays > 14 ? 'amber' : 'plain', text };
}

export default function JobsList() {
  const { role, side } = useSession();
  const layout = useLayout();
  const rows = useQuery<Row[]>((api) => api.listJobs().map((job) => ({ job, forecast: api.getForecast(job.id) })), []);
  const builds = rows.filter((r) => r.job.kind === 'build');
  const designs = rows.filter((r) => r.job.kind === 'design');
  const canAdd = role === 'admin' || role === 'partner';
  const showMoney = builds.some((r) => r.job.weeklyHoldingCost !== undefined);

  const newJob = canAdd ? (
    <Link to="/templates" className="btn btn--primary btn--desktop" data-testid="jobs-new">
      New job
    </Link>
  ) : undefined;

  const count = rows.length === 1 ? '1 job' : `${rows.length} jobs`;

  return (
    <main className="page jobs" data-testid="jobs-list">
      <PageHeader title="Jobs" meta={`${count} on ${side.name}`} actions={newJob} />

      {rows.length === 0 ? (
        <div className="jobs__empty" data-testid="jobs-empty">
          <p>No jobs on this side yet.</p>
          {canAdd && <p className="jobs__empty-hint">Start one from a template and it will show up here.</p>}
        </div>
      ) : (
        <>
          {builds.length > 0 && (
            <section className="jobs__group" aria-labelledby="jobs-build">
              <h2 id="jobs-build" className="jobs__group-title">
                Build
              </h2>
              {layout === 'desktop' ? <BuildTable rows={builds} showMoney={showMoney} /> : <BuildCards rows={builds} />}
            </section>
          )}
          {designs.length > 0 && (
            <section className="jobs__group" aria-labelledby="jobs-design">
              <h2 id="jobs-design" className="jobs__group-title">
                Design
              </h2>
              {layout === 'desktop' ? <DesignTable rows={designs} /> : <DesignCards rows={designs} />}
            </section>
          )}
        </>
      )}
    </main>
  );
}

// ---- desktop tables ----

function useRowNav() {
  const navigate = useNavigate();
  return (id: string) => navigate(`/jobs/${id}`);
}

function BuildTable({ rows, showMoney }: { rows: Row[]; showMoney: boolean }) {
  const go = useRowNav();
  return (
    <table className="jobs__table">
      <thead>
        <tr>
          <th scope="col">Job</th>
          <th scope="col">Stage</th>
          <th scope="col">Forecast finish</th>
          <th scope="col">Slip</th>
          {showMoney && <th scope="col">Holding cost</th>}
          <th scope="col">Last confirmed</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ job, forecast }) => {
          const fin = finishStatus(forecast);
          const slip = slipStatus(forecast);
          const fresh = freshnessStatus(forecast);
          return (
            <tr key={job.id} className="jobs__row" data-testid={`job-row-${job.id}`} onClick={() => go(job.id)}>
              <td className="jobs__cell-name">
                <Link to={`/jobs/${job.id}`} className="jobs__name" data-testid={`job-link-${job.id}`} onClick={(e) => e.stopPropagation()}>
                  {job.name}
                </Link>
              </td>
              <td className="jobs__cell-stage">{forecast?.currentStageName ?? 'No program yet'}</td>
              <td>
                {forecast?.forecastFinish ? (
                  <div className="jobs__finish-stack">
                    <span className="jobs__finish num">{formatDayMonthYear(forecast.forecastFinish)}</span>
                    {fin && (
                      <StatusText tone={fin.tone} plain={fin.tone === 'ok'}>
                        {fin.text}
                      </StatusText>
                    )}
                  </div>
                ) : (
                  <span className="jobs__muted">No program yet</span>
                )}
              </td>
              <td>
                <StatusText tone={slip.tone}>{slip.text}</StatusText>
              </td>
              {showMoney && (
                <td className="jobs__cell-money">
                  <HoldingCost value={job.weeklyHoldingCost} />
                </td>
              )}
              <td>{fresh && <StatusText tone={fresh.tone}>{fresh.text}</StatusText>}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function DesignTable({ rows }: { rows: Row[] }) {
  const go = useRowNav();
  return (
    <table className="jobs__table">
      <thead>
        <tr>
          <th scope="col">Job</th>
          <th scope="col">Stage</th>
          <th scope="col">Outstanding</th>
          <th scope="col">Last confirmed</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ job, forecast }) => {
          const fresh = freshnessStatus(forecast);
          const out = outstandingStatus(forecast);
          return (
            <tr key={job.id} className="jobs__row" data-testid={`job-row-${job.id}`} onClick={() => go(job.id)}>
              <td className="jobs__cell-name">
                <Link to={`/jobs/${job.id}`} className="jobs__name" data-testid={`job-link-${job.id}`} onClick={(e) => e.stopPropagation()}>
                  {job.name}
                </Link>
                <span className="jobs__path">{job.path}</span>
              </td>
              <td className="jobs__cell-stage">{forecast?.currentStageName ?? 'Done'}</td>
              <td>
                <StatusText tone={out.tone}>{out.text}</StatusText>
              </td>
              <td>{fresh && <StatusText tone={fresh.tone}>{fresh.text}</StatusText>}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ---- phone cards ----

function BuildCards({ rows }: { rows: Row[] }) {
  return (
    <ul className="jobs__cards">
      {rows.map(({ job, forecast }) => {
        const fin = finishStatus(forecast);
        const slip = slipStatus(forecast);
        const fresh = freshnessStatus(forecast);
        return (
          <li key={job.id}>
            <Link to={`/jobs/${job.id}`} className="jobs__card" data-testid={`job-row-${job.id}`}>
              <div className="jobs__card-top">
                <span className="jobs__name">{job.name}</span>
                {forecast?.forecastFinish && <span className="jobs__finish num">{formatDayMonthYear(forecast.forecastFinish)}</span>}
              </div>
              <div className="jobs__card-mid">
                <span className="jobs__stage">{forecast?.currentStageName ?? 'No program yet'}</span>
                <HoldingCost value={job.weeklyHoldingCost} />
              </div>
              <div className="jobs__card-status">
                {fin && <StatusText tone={fin.tone}>{fin.text}</StatusText>}
                <StatusText tone={slip.tone}>{slip.text}</StatusText>
              </div>
              {fresh && (
                <div className="jobs__card-fresh">
                  <StatusText tone={fresh.tone}>{fresh.text}</StatusText>
                </div>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function DesignCards({ rows }: { rows: Row[] }) {
  return (
    <ul className="jobs__cards">
      {rows.map(({ job, forecast }) => {
        const fresh = freshnessStatus(forecast);
        const out = outstandingStatus(forecast);
        return (
          <li key={job.id}>
            <Link to={`/jobs/${job.id}`} className="jobs__card" data-testid={`job-row-${job.id}`}>
              <div className="jobs__card-top">
                <span className="jobs__name">{job.name}</span>
                <span className="jobs__path">{job.path}</span>
              </div>
              <div className="jobs__card-mid">
                <span className="jobs__stage">{forecast?.currentStageName ?? 'Done'}</span>
              </div>
              <div className="jobs__card-status">
                <StatusText tone={out.tone}>{out.text}</StatusText>
              </div>
              {fresh && (
                <div className="jobs__card-fresh">
                  <StatusText tone={fresh.tone}>{fresh.text}</StatusText>
                </div>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
