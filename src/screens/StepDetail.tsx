/**
 * Step detail (UI_PLAN 3.6): one step's dates, what sets them, what it needs,
 * and, for a hold point, the before-cover photo check.
 *
 * Read-only except status: builder and above mark it started or done. A hold
 * point runs the photo check first; a refusal is shown inline in words
 * naming the empty categories (rule 6), never a silently dead button. A step
 * whose forecast start is still ahead cannot be finished either; the API
 * says so and the sentence is shown the same way.
 * The hold-point block (src/components/HoldPointCheck.tsx) names each empty
 * set with its own "Add photos" link into the upload screen, which comes
 * back here (`?return=`).
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { StepStatusResult } from '../data/api';
import { useApi, useQuery, useSession } from '../data/context';
import type { Item, Job, Person, Requirement, Stage, Step } from '../domain/types';
import type { JobForecast, StepForecast } from '../domain/forecast';
import { formatLong, formatShort } from '../domain/dates';
import { BigNumber } from '../components/BigNumber';
import { HoldPointCheck } from '../components/HoldPointCheck';
import { useQueuedPhotos } from '../components/QueueBadge';
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
  const queuedPhotos = useQueuedPhotos(data?.job.id);

  // Photos still in the phone's queue for this step's required categories do
  // not count for the hold point yet; say so, per set. Other categories are
  // not counted. The refusal clears by itself once every set has a photo.
  const requiredIds = (data?.forecast?.holdPoints.find((h) => h.stepId === id)?.required ?? []).map((r) => r.categoryId);
  const queuedByCategory: Record<string, number> = {};
  for (const p of queuedPhotos) if (requiredIds.includes(p.categoryId)) queuedByCategory[p.categoryId] = (queuedByCategory[p.categoryId] ?? 0) + 1;
  const queued = Object.values(queuedByCategory).reduce((a, b) => a + b, 0);
  const holdOk = data?.forecast?.holdPoints.find((h) => h.stepId === id)?.ok;
  useEffect(() => {
    if (holdOk) setRefusal((r) => (r?.reason === 'hold_point' ? undefined : r));
  }, [holdOk]);

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
  const needsWords = requirements
    .map((r) => `${r.name}, ${r.kind === 'trade' ? 'book' : 'order'} ${r.leadTimeWeeks} wk ahead`)
    .join('. ');

  return (
    <main className="page step" data-testid="step-detail">
      <PageHeader title={step.name} meta={meta} back={{ to: `/jobs/${job.id}/program`, label: `${job.name} program` }} />

      <section className="step__dates" aria-label="Dates">
        <div className="step__readout">
          <BigNumber
            size="row"
            value={sf ? span(sf.forecastStart, sf.forecastEnd) : 'No dates yet'}
            label="Forecast"
            tone={sf && sf.plannedStart && sf.lateDays > 0 ? 'late' : undefined}
            testId="step-forecast"
            className="step__figure"
          />
          {sf && sf.plannedStart && (
            <StatusText tone={sf.lateDays > 0 ? 'late' : sf.lateDays < 0 ? 'ok' : 'muted'} testId="step-late">
              {lateWords(sf)}
            </StatusText>
          )}
        </div>
        <div className="step__readout">
          <BigNumber size="row" value={span(step.plannedStart, step.plannedEnd)} label="Planned" tone="muted" testId="step-planned" className="step__figure" />
        </div>
        <dl className="step__facts">
          <div className="step__fact">
            <dt>Duration</dt>
            <dd data-testid="step-duration">
              {step.durationDays} working day{step.durationDays === 1 ? '' : 's'}
            </dd>
          </div>
          <div className="step__fact">
            <dt>Status</dt>
            <dd data-testid="step-status">{STATUS_WORDS[step.status]}</dd>
          </div>
        </dl>
      </section>
      {sf && (sf.lateDays !== 0 || /after|because/.test(sf.reason)) && (
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
          {doneNeedsSignal && <span className="step__needs-signal">Needs signal</span>}
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
            queuedByCategory={queuedByCategory}
            uploadHref={`/jobs/${job.id}/upload?stage=${step.stageId}`}
            addHref={(categoryId) => `/jobs/${job.id}/upload?stage=${step.stageId}&category=${categoryId}&return=/steps/${step.id}`}
            canComplete={canTick}
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
                  <span className="step__quiet">Nothing</span>
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
                  <span className="step__quiet">Nothing</span>
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section className="step__section" aria-labelledby="step-needs">
          <h2 id="step-needs" className="step__section-title">
            Needs
          </h2>
          {requirements.length > 0 && <p className="step__requirements">{needsWords}</p>}
          {items.length === 0 ? (
            <p className="step__quiet">No items.</p>
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
