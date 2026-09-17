/**
 * "Why it moved" (UI_PLAN 3.2, rule 4): the chain from cause to finish date
 * for one build job, in plain words. Which item or step pushed which step, by
 * how much, and against which baseline: last Monday's forecast or the plan.
 *
 * Route: #/jobs/:id/why, with ?since=plan to read the chain against the plan.
 * Entries come ready-worded from the forecast (`whyItMoved`,
 * `whyItMovedSincePlan`); this screen orders, numbers and links them.
 */
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useApi, useQuery } from '../data/context';
import type { WhyEntry } from '../domain/forecast';
import { formatDayMonth, formatLong } from '../domain/dates';
import { BigNumber } from '../components/BigNumber';
import { SlipText, slipTone } from '../components/SlipText';
import './whyitmoved.css';

const KIND_WORD: Record<WhyEntry['kind'], string> = {
  cause: 'Cause',
  step: 'Step',
  stage: 'Stage',
  finish: 'Finish',
};

export default function WhyItMoved() {
  const api = useApi();
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const since = params.get('since') === 'plan' ? 'plan' : 'monday';
  const job = useQuery((api) => api.getJob(id), [id]);
  const forecast = useQuery((api) => api.getForecast(id), [id]);

  if (!api.canSee('monday')) {
    return (
      <main className="why" data-testid="why-screen">
        <h1 className="why__title">Why it moved</h1>
        <p className="why__empty">You don't have access to this.</p>
      </main>
    );
  }

  if (!job || !forecast) {
    return (
      <main className="why" data-testid="why-screen">
        <BackLink />
        <h1 className="why__title">Why it moved</h1>
        <p className="why__empty" data-testid="why-missing">
          No job with that id on this side.
        </p>
      </main>
    );
  }

  if (forecast.kind === 'design') {
    return (
      <main className="why" data-testid="why-screen">
        <BackLink />
        <h1 className="why__title">Why it moved</h1>
        <p className="why__job">{job.name}</p>
        <p className="why__empty" data-testid="why-design">
          Design jobs have no forecast finish, so nothing here moves. Open the{' '}
          <Link to={`/jobs/${job.id}`}>checklist</Link> instead.
        </p>
      </main>
    );
  }

  const entries = since === 'plan' ? forecast.whyItMovedSincePlan : forecast.whyItMoved;
  const chainBaseline = entries.find((e) => e.kind !== 'finish')?.baseline;
  const slipDays = since === 'plan' ? forecast.slipSincePlanDays : forecast.slipDays;
  const slipCost = since === 'plan' ? forecast.slipSincePlanCost : forecast.slipCost;
  const baselineFinish = since === 'plan' ? forecast.plannedFinish : forecast.snapshotFinish;
  const baselineWords =
    since === 'plan'
      ? 'the original plan'
      : forecast.snapshotDate
        ? `Monday's forecast (${formatDayMonth(forecast.snapshotDate)})`
        : "Monday's forecast";

  const setSince = (next: 'monday' | 'plan') => {
    const p = new URLSearchParams(params);
    if (next === 'plan') p.set('since', 'plan');
    else p.delete('since');
    setParams(p, { replace: true });
  };

  return (
    <main className="why" data-testid="why-screen">
      <BackLink />
      <header className="why__head">
        <div>
          <h1 className="why__title">Why it moved</h1>
          <p className="why__job">
            <Link to={`/jobs/${job.id}`} data-testid="why-job-link">
              {job.name}
            </Link>
          </p>
        </div>
        <div className="why__since" role="group" aria-label="Compared with">
          <span className="why__since-label">Compared with</span>
          <button type="button" className="why__since-button" aria-pressed={since === 'monday'} data-testid="why-since-monday" onClick={() => setSince('monday')}>
            Monday's forecast
          </button>
          <button type="button" className="why__since-button" aria-pressed={since === 'plan'} data-testid="why-since-plan" onClick={() => setSince('plan')}>
            the original plan
          </button>
        </div>
      </header>

      <section className="why__figures" aria-label="Finish and slip">
        <BigNumber value={forecast.forecastFinish ? formatLong(forecast.forecastFinish) : 'No dates yet'} label="Forecast finish" testId="why-finish" />
        <BigNumber
          value={<SlipText days={slipDays} cost={slipCost} />}
          tone={slipTone(slipDays)}
          label={
            slipDays === undefined
              ? undefined
              : baselineFinish
                ? `since ${baselineWords}, which said ${formatDayMonth(baselineFinish)}`
                : `since ${baselineWords}`
          }
          testId="why-slip"
        />
      </section>

      {entries.length === 0 ? (
        <p className="why__empty" data-testid="why-nothing">
          Nothing moved since {baselineWords}.
          {forecast.forecastFinish ? ` Finish stays ${formatLong(forecast.forecastFinish)}.` : ''}
        </p>
      ) : (
        <section className="why__chain-wrap" aria-labelledby="why-chain-title">
          <h2 className="why__chain-title" id="why-chain-title">
            The chain, in order
          </h2>
          <p className="why__baseline" data-testid="why-baseline">
            {chainBaseline === 'snapshot'
              ? `Each step against Monday's forecast${forecast.snapshotDate ? ` (${formatDayMonth(forecast.snapshotDate)})` : ''}.`
              : since === 'plan'
                ? 'Each step against its planned dates.'
                : "Monday's forecast for this job saved only the finish date, so each step is read against its planned dates; the last line gives the slip since Monday."}
          </p>
          <ol className="why__chain">
            {entries.map((e, i) => (
              <li key={`${e.kind}-${e.refId ?? i}-${i}`} className={`why__entry why__entry--${e.kind}`} data-testid={`why-entry-${i + 1}`}>
                <span className="why__n num" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="why__kind">{KIND_WORD[e.kind]}</span>
                <span className="why__text">
                  <EntryText entry={e} jobId={job.id} />
                </span>
                <span className={`why__delta num ${e.deltaDays > 0 ? 'why__delta--late' : e.deltaDays < 0 ? 'why__delta--ok' : ''}`}>
                  {e.deltaDays > 0 ? `+${e.deltaDays}` : e.deltaDays}
                  {' '}
                  {Math.abs(e.deltaDays) === 1 ? 'day' : 'days'}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}

function BackLink() {
  return (
    <p className="why__back">
      <Link to="/monday" data-testid="why-back">
        Back to Monday
      </Link>
    </p>
  );
}

/** The entry's words, with the thing it names linked to its own screen. */
function EntryText({ entry, jobId }: { entry: WhyEntry; jobId: string }) {
  const api = useApi();
  const href = linkFor(entry, jobId, api.getItem(entry.refId ?? '') !== undefined);
  if (!href) return <>{entry.text}</>;
  return (
    <Link to={href} className="why__link" data-testid={`why-link-${entry.refId}`}>
      {entry.text}
    </Link>
  );
}

function linkFor(entry: WhyEntry, jobId: string, isItem: boolean): string | undefined {
  if (!entry.refId) return undefined;
  switch (entry.kind) {
    case 'cause':
      return isItem ? `/items/${entry.refId}` : `/shipments/${entry.refId}`;
    case 'step':
      return `/steps/${entry.refId}`;
    case 'stage':
      return `/jobs/${jobId}/program`;
    default:
      return undefined;
  }
}
