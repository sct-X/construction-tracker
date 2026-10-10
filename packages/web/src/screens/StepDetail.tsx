/**
 * Step detail (v1 src/screens/StepDetail.tsx, read-only: the bot marks steps
 * started or done): one step's dates, what sets them, what it needs and, for
 * a hold point, the before-cover photo sets.
 *
 * The dates are a two-figure readout, forecast (with "7 days late" or "on
 * plan" beside it) and planned, then duration and status as small facts. One
 * calculator sentence says why, only when there is a why. The hold-point
 * check comes before the order of work and the items, because it is the
 * thing that stops a tick. Red only for what is overdue (Dom's cue).
 */
import {
  daysLateWords,
  holdPointReadinessWords,
  isStepOverdue,
  leadTimeWords,
  shortWithRelative,
  stepWhenWords,
  workStatusWords,
  type DashboardApi,
  type ISODate,
  type StepDetail,
} from '@ct/core';
import { LoadError, LoadingRows } from '../components/bits';
import { ItemRow, ItemRowList } from '../components/ItemRow';
import { StatusText, type Tone } from '../components/StatusText';
import { stepHref } from '../components/gantt/Gantt';
import { tabHref } from '../app/jobNav';
import { useJobQuery } from '../data/useJobQuery';
import { useData } from '../data/DataContext';
import { plural, rangeWords, UNKNOWN_TODAY } from '../ui/format';
import { photoCount } from '../ui/itemWords';
import { whenWords } from '../ui/when';
import '../styles/step.css';

export function loadStep(api: DashboardApi, stepId: string): Promise<StepDetail> {
  return api.getStep(stepId);
}

export function StepDetailScreen({ jobId, stepId }: { jobId: string; stepId: string }) {
  const q = useJobQuery(loadStep, stepId);
  const { today } = useData();
  return (
    <div className="step" data-testid="step-detail" data-job={jobId}>
      {q.status === 'loading' && (
        <>
          <h2 className="step__title">Step</h2>
          <LoadingRows rows={4} label="Loading the step" />
        </>
      )}
      {q.status === 'error' && (
        <>
          <h2 className="step__title">Step</h2>
          <LoadError what="this step" error={q.error} retry={q.retry} />
        </>
      )}
      {q.status === 'ready' && <StepBody d={q.data} today={today ?? UNKNOWN_TODAY} />}
    </div>
  );
}

/** "7 days late", "3 days early", "on plan", and the tone: red only once the step is past its planned date. */
export function stepLate(s: StepDetail['step'], today: ISODate): { text: string; tone: Tone } {
  if (s.lateDays > 0 && s.status !== 'done') return { text: daysLateWords(s.lateDays), tone: isStepOverdue(s, today) ? 'late' : 'plain' };
  if (s.lateDays < 0) {
    const n = -s.lateDays;
    return { text: `${n} day${n === 1 ? '' : 's'} early`, tone: 'ok' };
  }
  return { text: 'on plan', tone: 'muted' };
}

export function StepBody({ d, today }: { d: StepDetail; today: ISODate }) {
  const s = d.step;
  const late = stepLate(s, today);
  const meta = [d.stageName ? `${d.stageName} stage` : '', s.isHoldPoint ? 'hold point' : '', s.tradeType ?? ''].filter(Boolean).join(', ');
  const showReason = s.lateDays !== 0 || /after|because/.test(s.reason);
  return (
    <>
      <header className="step__head">
        <h2 className="step__title">
          {s.name}
          <span className="sr-only">, {d.jobName}</span>
        </h2>
        {meta && <p className="page-header__meta">{meta}</p>}
      </header>

      <section className="step__dates" aria-label="Dates" data-testid="step-dates">
        <div className="step__readout">
          <span className={late.tone === 'late' ? 'step__figure step__figure--late' : 'step__figure'}>
            <span className="step__value" data-testid="step-forecast">
              {rangeWords(s.forecastStart, s.forecastEnd, today)}
            </span>
            <span className="step__label">Forecast, {stepWhenWords(s, today)}</span>
          </span>
          {s.plannedStart && (
            <StatusText tone={late.tone} plain={late.tone !== 'late'} testId="step-late" className="step__late">
              {late.text}
            </StatusText>
          )}
        </div>
        <div className="step__readout">
          <span className="step__figure step__figure--muted">
            <span className="step__value" data-testid="step-planned">
              {s.plannedStart ? rangeWords(s.plannedStart, s.plannedEnd, today) : 'No planned dates'}
            </span>
            <span className="step__label">Planned</span>
          </span>
        </div>
        <dl className="step__facts">
          <div className="step__fact">
            <dt>Duration</dt>
            <dd data-testid="step-duration">{plural(s.durationDays, 'working day')}</dd>
          </div>
          <div className="step__fact">
            <dt>Status</dt>
            <dd data-testid="step-status">{workStatusWords(s.status)}</dd>
          </div>
        </dl>
      </section>
      {showReason && (
        <p className="step__reason" data-testid="step-reason">
          {s.reason}
        </p>
      )}

      {d.holdPoint && <HoldPointBlock d={d} />}

      <div className="step__cols">
        <section className="step__section" aria-labelledby="step-links">
          <h3 id="step-links" className="step__section-title">
            Order of work
          </h3>
          <dl className="step__links">
            <div className="step__link-group">
              <dt>Waits for</dt>
              <dd>
                {d.waitsFor.length ? (
                  <ul className="step__link-list" data-testid="waits-for">
                    {d.waitsFor.map((w) => (
                      <li key={w.stepId}>
                        <a href={stepHref(d.jobId, w.stepId)} className="step__link">
                          {w.name}
                        </a>
                        <span className="step__link-when"> ends {shortWithRelative(w.forecastEnd, today)}</span>
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
                {d.holdsUp.length ? (
                  <ul className="step__link-list" data-testid="holds-up">
                    {d.holdsUp.map((w) => (
                      <li key={w.stepId}>
                        <a href={stepHref(d.jobId, w.stepId)} className="step__link">
                          {w.name}
                        </a>
                        <span className="step__link-when"> starts {shortWithRelative(w.forecastStart, today)}</span>
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
          <h3 id="step-needs" className="step__section-title">
            Needs
          </h3>
          {d.requirements.length > 0 && <p className="step__requirements">{leadTimeWords(d.requirements)}</p>}
          {d.items.length === 0 ? (
            <p className="step__quiet">No items.</p>
          ) : (
            <ItemRowList testId="needs">
              {d.items.map((r) => (
                <ItemRow key={r.itemId} row={r} when={r.status === 'done' ? { text: 'Done', tone: 'muted' } : whenWords(r, today)} testId={`need-${r.itemId}`} />
              ))}
            </ItemRowList>
          )}
        </section>
      </div>
    </>
  );
}

/** v1 HoldPointCheck, read-only: the required photo sets with their counts in words. */
function HoldPointBlock({ d }: { d: StepDetail }) {
  const h = d.holdPoint!;
  const photos = tabHref({ jobId: d.jobId, kind: 'build' }, 'Photos');
  return (
    <section className="step__section holdpoint" aria-labelledby="hold-h" data-testid="hold-point">
      <div className="holdpoint__head">
        <h3 id="hold-h" className="holdpoint__title">
          Before-cover photos
        </h3>
        <StatusText tone={h.ok ? 'ok' : 'note'} testId="hold-readiness">
          {holdPointReadinessWords(h)}
        </StatusText>
      </div>
      {h.required.length > 0 && (
        <ul className="holdpoint__list">
          {h.required.map((c) => (
            <li key={c.categoryId} className="holdpoint__row" data-testid="hold-category">
              <span className="holdpoint__name">{c.name}</span>
              <StatusText tone={c.photoCount ? 'plain' : 'note'} className="holdpoint__count">
                {c.photoCount ? photoCount(c.photoCount) : 'none yet'}
              </StatusText>
            </li>
          ))}
        </ul>
      )}
      {h.required.length > 0 && h.ok && <p className="holdpoint__ready">Every required set has a photo.</p>}
      {photos && (
        <a className="holdpoint__photos" href={photos} data-testid="hold-photos">
          See photos
        </a>
      )}
    </section>
  );
}
