/**
 * Step detail (UI_PLAN 3.6): one step's dates, what sets them, what it needs,
 * and, for a hold point, the before-cover photo check.
 *
 * Read-only except status: builder and above mark it started or done. A hold
 * point runs the photo check first; a refusal is shown inline in words
 * naming the empty categories (rule 6), never a silently dead button. A step
 * whose forecast start is still ahead cannot be finished either; the API
 * says so and the sentence is shown the same way.
 * Stage 5 extends the hold-point block (src/components/HoldPointCheck.tsx).
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { StepStatusResult } from '../data/api';
import { useApi, useQuery, useSession } from '../data/context';
import type { Item, Job, Person, Requirement, Stage, Step } from '../domain/types';
import type { JobForecast, StepForecast } from '../domain/forecast';
import { formatLong, formatShort } from '../domain/dates';
import { HoldPointCheck } from '../components/HoldPointCheck';
import { ItemRow, ItemRowList } from '../components/ItemRow';
import { StatusText } from '../components/StatusText';
import NotFound from './NotFound';
import { PageHeader } from '../shell/PageHeader';
import './stepDetail.css';

interface Data {
  step: Step;
  job: Job;
  stage?: Stage;
  forecast?: JobForecast;
  steps: Step[];
  items: Item[];
  requirements: Requirement[];
  people: Person[];
}

const STATUS_WORDS: Record<Step['status'], string> = { not_started: 'Not started', in_progress: 'Under way', done: 'Done' };

/** "Mon 2 Nov 2026 to Fri 13 Nov 2026": the year stays because programs cross it. */
function span(start?: string, end?: string): string {
  if (!start) return 'No dates yet';
  if (!end || end === start) return formatLong(start);
  return `${formatLong(start)} to ${formatLong(end)}`;
}

function lateWords(sf: StepForecast): string {
  if (sf.lateDays > 0) return `${sf.lateDays} day${sf.lateDays === 1 ? '' : 's'} late`;
  if (sf.lateDays < 0) return `${-sf.lateDays} day${sf.lateDays === -1 ? '' : 's'} early`;
  return 'on plan';
}

export default function StepDetail() {
  const { id = '' } = useParams();
  const api = useApi();
  const { role, offline } = useSession();
  const data = useQuery<Data | undefined>(
    (api) => {
      const step = api.getStep(id);
      if (!step) return undefined;
      const job = api.getJob(step.jobId);
      if (!job) return undefined;
      return {
        step,
        job,
        stage: api.listStages(step.jobId).find((s) => s.id === step.stageId),
        forecast: api.getForecast(step.jobId),
        steps: api.listSteps(step.jobId),
        items: api.listItems({ stepId: step.id, includeDone: true }),
        requirements: api.listRequirements(step.jobId).filter((r) => r.stepId === step.id),
        people: api.listPeople(),
      };
    },
    [id],
  );
  const [refusal, setRefusal] = useState<Extract<StepStatusResult, { ok: false }> | undefined>();
  const [queued, setQueued] = useState(0);

  // Photos still in the phone's queue for this step's required categories do
  // not count for the hold point yet; say so. Other categories are not counted.
  const requiredIds = (data?.forecast?.holdPoints.find((h) => h.stepId === id)?.required ?? []).map((r) => r.categoryId).join(',');
  useEffect(() => {
    if (!requiredIds) return;
    const ids = new Set(requiredIds.split(','));
    let live = true;
    void api.listQueuedPhotos().then((q) => {
      if (live) setQueued(q.filter((p) => ids.has(p.categoryId)).length);
    });
    return () => {
      live = false;
    };
  }, [api, id, requiredIds, offline]);

  if (!data) return <NotFound />;
  const { step, job, stage, forecast, steps, items, requirements, people } = data;
  const sf = forecast?.steps[step.id];
  const nameOf = (pid?: string) => people.find((p) => p.id === pid)?.shortName;
  const stepName = (sid: string) => steps.find((s) => s.id === sid)?.name ?? sid;
  const canTick = role !== 'site';
  const check = forecast?.holdPoints.find((h) => h.stepId === step.id);
  const canLink = role !== 'site';

  const setStatus = (status: Step['status']) => {
    const result = api.setStepStatus(step.id, status);
    setRefusal(result.ok ? undefined : result);
  };

  // Done on a hold point needs signal: the server counts the photos.
  const doneNeedsSignal = offline && step.isHoldPoint;

  const meta = [stage?.name ? `${stage.name} stage` : '', step.isHoldPoint ? 'hold point' : '', step.tradeType ?? ''].filter(Boolean).join(', ');

  return (
    <main className="page step" data-testid="step-detail">
      <PageHeader title={step.name} meta={meta} back={{ to: `/jobs/${job.id}/program`, label: `${job.name} program` }} />

      <section className="step__dates" aria-label="Dates">
        <div className="step__date step__date--forecast">
          <span className="step__date-label">Forecast</span>
          <span className="step__date-value display" data-testid="step-forecast">
            {sf ? span(sf.forecastStart, sf.forecastEnd) : 'No dates yet'}
          </span>
          {sf && sf.plannedStart && (
            <StatusText tone={sf.lateDays > 0 ? 'late' : sf.lateDays < 0 ? 'ok' : 'muted'} testId="step-late">
              {lateWords(sf)}
            </StatusText>
          )}
        </div>
        <div className="step__date">
          <span className="step__date-label">Planned</span>
          <span className="step__date-value" data-testid="step-planned">
            {span(step.plannedStart, step.plannedEnd)}
          </span>
        </div>
        <div className="step__date">
          <span className="step__date-label">Duration</span>
          <span className="step__date-value" data-testid="step-duration">
            {step.durationDays} working day{step.durationDays === 1 ? '' : 's'}
          </span>
        </div>
        <div className="step__date">
          <span className="step__date-label">Status</span>
          <span className="step__date-value" data-testid="step-status">
            {STATUS_WORDS[step.status]}
          </span>
        </div>
      </section>
      {sf && (
        <p className="step__reason" data-testid="step-reason">
          {sf.reason}
        </p>
      )}

      {canTick && (
        <div className="step__actions">
          {step.status === 'not_started' && (
            <button type="button" className="btn btn--desktop" onClick={() => setStatus('in_progress')} data-testid="step-mark-started">
              Mark started
            </button>
          )}
          {step.status !== 'done' && (
            <button
              type="button"
              className="btn btn--primary btn--desktop"
              onClick={() => setStatus('done')}
              disabled={doneNeedsSignal}
              data-testid="step-mark-done"
            >
              Mark done
            </button>
          )}
          {step.status === 'done' && (
            <button type="button" className="btn btn--desktop" onClick={() => setStatus('in_progress')} data-testid="step-reopen">
              Reopen
            </button>
          )}
          {doneNeedsSignal && <span className="step__needs-signal">Needs signal: the photo count is checked on the server.</span>}
        </div>
      )}
      {refusal && refusal.reason === 'not_started' && (
        <p className="step__refusal" role="alert" data-testid="step-refusal">
          {refusal.message}
        </p>
      )}

      {step.isHoldPoint && check && (
        <section className="step__section" aria-label="Hold point">
          <HoldPointCheck
            check={check}
            refusal={refusal?.reason === 'hold_point' ? refusal.message : undefined}
            queuedCount={queued}
            uploadHref={`/jobs/${job.id}/upload?stage=${step.stageId}`}
            testId="step-holdpoint"
          />
        </section>
      )}

      <div className="step__cols">
        <section className="step__section" aria-labelledby="step-links">
          <h2 id="step-links" className="step__section-title">
            Order of work
          </h2>
          <dl className="step__links">
            <div className="step__link-group">
              <dt>Waits for</dt>
              <dd>
                {sf && sf.waitsFor.length > 0 ? (
                  <ul className="step__link-list">
                    {sf.waitsFor.map((sid) => (
                      <li key={sid}>
                        <Link to={`/steps/${sid}`} className="step__link" data-testid={`step-waits-${sid}`}>
                          {stepName(sid)}
                        </Link>
                        {forecast?.steps[sid] && <span className="step__link-when"> ends {formatShort(forecast.steps[sid].forecastEnd)}</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="step__quiet">Nothing, it can start on its planned date</span>
                )}
              </dd>
            </div>
            <div className="step__link-group">
              <dt>Holds up</dt>
              <dd>
                {sf && sf.holdsUp.length > 0 ? (
                  <ul className="step__link-list">
                    {sf.holdsUp.map((sid) => (
                      <li key={sid}>
                        <Link to={`/steps/${sid}`} className="step__link" data-testid={`step-holds-${sid}`}>
                          {stepName(sid)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="step__quiet">Nothing waits for this step</span>
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section className="step__section" aria-labelledby="step-needs">
          <h2 id="step-needs" className="step__section-title">
            Needs
          </h2>
          {requirements.length > 0 && (
            <p className="step__requirements">
              {requirements
                .map((r) => `${r.name} (${r.kind === 'trade' ? 'book' : 'order'} ${r.leadTimeWeeks} week${r.leadTimeWeeks === 1 ? '' : 's'} ahead)`)
                .join(', ')}
            </p>
          )}
          {items.length === 0 ? (
            <p className="step__quiet">No items on this step.</p>
          ) : (
            <ItemRowList testId="step-items">
              {items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  forecast={forecast?.items[item.id]}
                  ownerName={nameOf(item.ownerId)}
                  href={canLink ? `/items/${item.id}` : undefined}
                />
              ))}
            </ItemRowList>
          )}
        </section>
      </div>
    </main>
  );
}
