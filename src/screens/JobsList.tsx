/**
 * Jobs list (UI_PLAN 3.3): a calm index of every job on this side, builds
 * then design. One row per job: name, stage, the forecast finish as the
 * figure, and one status line. Desktop: a readout table like Monday's.
 * Phone: one plate per job. Money draws nothing when the field is absent,
 * so Alec's list looks finished rather than censored.
 */
import { Link, useNavigate } from 'react-router-dom';
import type { MouseEvent } from 'react';
import { useQuery, useSession } from '../data/context';
import type { Job } from '../domain/types';
import type { JobForecast } from '../domain/forecast';
import { formatLong } from '../domain/dates';
import { BigNumber } from '../components/BigNumber';
import { Money } from '../components/Money';
import { StatusText, type Tone } from '../components/StatusText';
import { useLayout } from '../shell/AppShell';
import './jobsList.css';

interface Row {
  job: Job;
  forecast?: JobForecast;
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
  const { role } = useSession();
  const layout = useLayout();
  const rows = useQuery<Row[]>((api) => api.listJobs().map((job) => ({ job, forecast: api.getForecast(job.id) })), []);
  const builds = rows.filter((r) => r.job.kind === 'build');
  const designs = rows.filter((r) => r.job.kind === 'design');
  const canAdd = role === 'admin' || role === 'partner';
  const desktop = layout === 'desktop';

  return (
    <main className="jobs" data-testid="jobs-list">
      <header className="jobs__head">
        <h1 className="jobs__title">Jobs</h1>
        {canAdd && (
          <Link to="/jobs/new" className="btn btn--primary btn--desktop" data-testid="jobs-new">
            New job
          </Link>
        )}
      </header>

      {rows.length === 0 ? (
        <p className="jobs__empty" data-testid="jobs-empty">
          No jobs on this side yet.
        </p>
      ) : (
        <>
          {builds.length > 0 && (
            <section className="jobs__group" aria-labelledby="jobs-build">
              <h2 id="jobs-build" className="jobs__group-title">
                Builds
              </h2>
              {desktop ? <BuildTable rows={builds} /> : <BuildCards rows={builds} />}
            </section>
          )}
          {designs.length > 0 && (
            <section className="jobs__group" aria-labelledby="jobs-design">
              <h2 id="jobs-design" className="jobs__group-title">
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

// ---- cells shared by the table and the plates ----

/** The row is a pointer convenience; the name link keeps its own target for the keyboard. */
function useOpenJob() {
  const navigate = useNavigate();
  return (id: string) => (e: MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    navigate(`/jobs/${id}`);
  };
}

function JobName({ job }: { job: Job }) {
  return (
    <Link to={`/jobs/${job.id}`} className="jobs__name" data-testid={`job-link-${job.id}`}>
      {job.name}
    </Link>
  );
}

function FinishCell({ forecast }: { forecast?: JobForecast }) {
  const fin = finishStatus(forecast);
  if (!forecast?.forecastFinish) return <BigNumber size="row" value="No dates yet" label="Forecast finish" tone="muted" />;
  return (
    <span className="jobs__finish">
      <BigNumber size="row" value={formatLong(forecast.forecastFinish)} label="Forecast finish" tone={fin?.tone === 'late' ? 'late' : undefined} />
      {fin && (
        <StatusText tone={fin.tone} plain={fin.tone === 'ok'}>
          {fin.text}
        </StatusText>
      )}
    </span>
  );
}

/** One line: slip this week, then how fresh the figures are. */
function BuildStatus({ forecast }: { forecast?: JobForecast }) {
  const slip = slipStatus(forecast);
  const fresh = freshnessStatus(forecast);
  return (
    <span className="jobs__status">
      <StatusText tone={slip.tone}>{slip.text}</StatusText>
      {fresh && <StatusText tone={fresh.tone}>{fresh.text}</StatusText>}
    </span>
  );
}

function DesignStatus({ forecast }: { forecast?: JobForecast }) {
  const out = outstandingStatus(forecast);
  const fresh = freshnessStatus(forecast);
  return (
    <span className="jobs__status">
      <StatusText tone={out.tone}>{out.text}</StatusText>
      {fresh && <StatusText tone={fresh.tone}>{fresh.text}</StatusText>}
    </span>
  );
}

// ---- desktop tables ----

function BuildTable({ rows }: { rows: Row[] }) {
  const open = useOpenJob();
  return (
    <table className="table table--rows jobs__table jobs__table--builds">
      <thead>
        <tr>
          <th scope="col">Job</th>
          <th scope="col">Stage</th>
          <th scope="col">Forecast finish</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ job, forecast }) => (
          <tr key={job.id} className="jobs__row" data-testid={`job-row-${job.id}`} onClick={open(job.id)}>
            <th scope="row" className="jobs__cell-job">
              <JobName job={job} />
              <Money value={job.weeklyHoldingCost} suffix="/wk" className="jobs__money" />
            </th>
            <td className="jobs__cell-stage">{forecast?.currentStageName ?? 'No program yet'}</td>
            <td className="jobs__cell-finish">
              <FinishCell forecast={forecast} />
            </td>
            <td className="jobs__cell-status">
              <BuildStatus forecast={forecast} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DesignTable({ rows }: { rows: Row[] }) {
  const open = useOpenJob();
  return (
    <table className="table table--rows jobs__table jobs__table--design">
      <thead>
        <tr>
          <th scope="col">Job</th>
          <th scope="col">Stage</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ job, forecast }) => (
          <tr key={job.id} className="jobs__row" data-testid={`job-row-${job.id}`} onClick={open(job.id)}>
            <th scope="row" className="jobs__cell-job">
              <JobName job={job} />
              {job.path && <span className="jobs__path">{job.path}</span>}
            </th>
            <td className="jobs__cell-stage">{forecast?.currentStageName ?? 'Done'}</td>
            <td className="jobs__cell-status">
              <DesignStatus forecast={forecast} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---- phone plates ----

function BuildCards({ rows }: { rows: Row[] }) {
  const open = useOpenJob();
  return (
    <ul className="jobs__cards">
      {rows.map(({ job, forecast }) => (
        <li key={job.id} className="jobs__card" data-testid={`job-row-${job.id}`} onClick={open(job.id)}>
          <div className="jobs__card-head">
            <JobName job={job} />
            <span className="jobs__stage">{forecast?.currentStageName ?? 'No program yet'}</span>
          </div>
          <FinishCell forecast={forecast} />
          <Money value={job.weeklyHoldingCost} label="Holding" suffix="/wk" className="jobs__money" />
          <BuildStatus forecast={forecast} />
        </li>
      ))}
    </ul>
  );
}

function DesignCards({ rows }: { rows: Row[] }) {
  const open = useOpenJob();
  return (
    <ul className="jobs__cards">
      {rows.map(({ job, forecast }) => (
        <li key={job.id} className="jobs__card jobs__card--design" data-testid={`job-row-${job.id}`} onClick={open(job.id)}>
          <div className="jobs__card-head">
            <JobName job={job} />
            <span className="jobs__stage">
              {forecast?.currentStageName ?? 'Done'}
              {job.path ? `, ${job.path}` : ''}
            </span>
          </div>
          <DesignStatus forecast={forecast} />
        </li>
      ))}
    </ul>
  );
}
