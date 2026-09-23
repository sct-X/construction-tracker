/**
 * Build job overview (UI_PLAN 3.4): "how is this job going?" in one screen.
 *
 * The stage is the hero, with how fresh the picture is and the one action,
 * Confirm program. Then the next hold point with its photo sets, the stage
 * ladder, and what the job is waiting on as a short list. No forecast finish,
 * slip or money anywhere.
 *
 * Alec gets the phone layout with the Today section on top (AlecToday), then
 * the stages and the latest photos.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApi, useQuery, useSession } from '../data/context';
import type { Item, Job, Person, Photo } from '../domain/types';
import type { JobForecast, StageForecast } from '../domain/forecast';
import { topWaitingOn } from '../domain/forecast';
import { formatDayMonth, formatShort, formatShortRelative, relativeDate } from '../domain/dates';
import { BigNumber } from '../components/BigNumber';
import { HoldPointCheck, readinessWords } from '../components/HoldPointCheck';
import { ItemRow, ItemRowList } from '../components/ItemRow';
import { StatusText } from '../components/StatusText';
import AlecToday from './AlecToday';
import NotFound from './NotFound';
import { PageHeader } from '../shell/PageHeader';
import './jobOverview.css';

interface Data {
  job: Job;
  forecast?: JobForecast;
  items: Item[];
  people: Person[];
  photoCount: number;
  /** The newest few, for the strip at the foot. */
  latestPhotos: Photo[];
  stepCount: number;
}

/** The stage's forecast span in words, and its planned span when that differs. */
function stageWords(s: StageForecast, today: string): { when: string; planned?: string } {
  if (s.status === 'done') return { when: s.forecastEnd ? `Done ${formatDayMonth(s.forecastEnd)}, ${relativeDate(s.forecastEnd, today)}` : 'Done' };
  const span =
    s.forecastStart && s.forecastEnd
      ? `${formatDayMonth(s.forecastStart)} to ${formatDayMonth(s.forecastEnd)}, starts ${relativeDate(s.forecastStart, today)}`
      : undefined;
  const when =
    s.status === 'in_progress'
      ? s.forecastEnd
        ? `Under way, ends ${formatDayMonth(s.forecastEnd)}, ${relativeDate(s.forecastEnd, today)}`
        : 'Under way'
      : span ?? 'No dates yet';
  const moved = s.plannedStart && s.plannedEnd && (s.plannedStart !== s.forecastStart || s.plannedEnd !== s.forecastEnd);
  const planned = moved ? `planned ${formatDayMonth(s.plannedStart!)} to ${formatDayMonth(s.plannedEnd!)}` : undefined;
  return { when, planned };
}

export default function JobOverview() {
  const { id = '' } = useParams();
  const api = useApi();
  const { role, today, offline } = useSession();
  const data = useQuery<Data | undefined>(
    (api) => {
      const job = api.getJob(id);
      if (!job) return undefined;
      return {
        job,
        forecast: api.getForecast(id),
        items: api.listItems({ jobId: id }),
        people: api.listPeople(),
        photoCount: api.listPhotos(id).length,
        latestPhotos: api.listPhotos(id).slice(0, 6),
        stepCount: api.listSteps(id).length,
      };
    },
    [id],
  );
  const [confirmedNow, setConfirmedNow] = useState(false);

  if (!data) return <NotFound />;
  const { job, forecast, items, people, photoCount, latestPhotos, stepCount } = data;
  const site = role === 'site';
  const nameOf = (pid?: string) => people.find((p) => p.id === pid)?.shortName;

  const tabs = site
    ? [
        { label: 'Today', to: `/jobs/${id}`, here: true },
        { label: 'Program', to: `/jobs/${id}/program` },
        { label: 'Photos', to: `/jobs/${id}/photos` },
        { label: 'Deliveries', to: '/deliveries' },
      ]
    : [
        { label: 'Overview', to: `/jobs/${id}`, here: true },
        { label: 'Program', to: `/jobs/${id}/program` },
        { label: 'Waiting on', to: `/waiting?job=${id}` },
        { label: 'Photos', to: `/jobs/${id}/photos` },
        { label: 'Notes', to: `/jobs/${id}/notes` },
      ];

  const confirm = () => {
    api.confirmJob(job.id);
    setConfirmedNow(true);
  };

  const waiting = forecast ? topWaitingOn(forecast, items, 5) : [];
  const openCount = items.filter((i) => i.status !== 'done').length;
  const hp = forecast?.nextHoldPoint;
  const hpStage = hp ? forecast?.stages.find((s) => s.stageId === hp.stageId) : undefined;

  return (
    <main className={site ? 'page job job--site' : 'page job'} data-testid="job-overview">
      <PageHeader title={job.name} back={site ? undefined : { to: '/overview', label: 'Overview' }} />

      <nav className="job__tabs" aria-label="Job sections" data-testid="job-tabs">
        {tabs.map((t) => (
          <Link key={t.label} to={t.to} className="job__tab" aria-current={t.here ? 'page' : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>

      {site && <AlecToday jobId={id} />}

      {!forecast || stepCount === 0 ? (
        <p className="job__empty" data-testid="job-empty">
          No program yet.
        </p>
      ) : (
        <>
          <section className="job__hero" aria-label="Where it is">
            <div className="job__finish">
              <BigNumber value={forecast.currentStageName ?? 'Done'} label="Stage" testId="job-stage" />
            </div>

            {!site && (
              <div className="job__facts">
                <div className="job__confirm">
                  <StatusText tone={forecast.freshness.amber ? 'amber' : 'muted'} testId="job-fresh">
                    {forecast.freshness.text}
                  </StatusText>
                  <button type="button" className="btn btn--primary btn--desktop" onClick={confirm} disabled={offline} data-testid="job-confirm">
                    {confirmedNow && forecast.freshness.daysUnconfirmed === 0 ? 'Confirmed' : 'Confirm program'}
                  </button>
                  {offline && <span className="job__needs-signal">Needs signal</span>}
                </div>
              </div>
            )}
          </section>

          <div className="job__body">
            <div className="job__col">
              {!site && (
                <section className="job__section" aria-labelledby="job-hp" data-testid="job-next-holdpoint">
                  <h2 id="job-hp" className="job__section-title">
                    Next hold point
                  </h2>
                  {hp ? (
                    <>
                      <p className="job__hp-line">
                        <Link to={`/steps/${hp.stepId}`} className="job__hp-name">
                          {hp.stepName}
                        </Link>
                        <span className="job__hp-when">
                          {formatShortRelative(hp.forecastStart, today)}
                          {hpStage ? `, ${hpStage.name} stage` : ''}
                        </span>
                      </p>
                      <p className="job__hp-ready">
                        <StatusText tone={hp.ok ? 'ok' : 'amber'} testId="job-holdpoint-readiness">
                          {readinessWords(hp)}
                        </StatusText>
                      </p>
                      <HoldPointCheck check={hp} compact />
                    </>
                  ) : (
                    <p className="job__quiet">No hold points left</p>
                  )}
                </section>
              )}

              <section className="job__section" aria-labelledby="job-stages">
                <h2 id="job-stages" className="job__section-title">
                  Stages
                </h2>
                <ol className="job__stages">
                  {forecast.stages.map((s) => {
                    const current = s.stageId === forecast.currentStageId;
                    const words = stageWords(s, today);
                    return (
                      <li
                        key={s.stageId}
                        className={['job__stage', `job__stage--${s.status}`, current ? 'job__stage--current' : ''].filter(Boolean).join(' ')}
                        data-testid={`job-stage-${s.stageId}`}
                        aria-current={current ? 'step' : undefined}
                      >
                        <span className="job__stage-name">{s.name}</span>
                        <span className="job__stage-when">
                          {words.when}
                          {s.isLate && s.status !== 'done' && (
                            <>
                              {' '}
                              <StatusText tone="late" plain className="job__stage-late">
                                {s.lateDays} day{s.lateDays === 1 ? '' : 's'} late
                              </StatusText>
                            </>
                          )}
                        </span>
                        {words.planned && <span className="job__stage-planned">{words.planned}</span>}
                      </li>
                    );
                  })}
                </ol>
              </section>
            </div>

            {!site && (
              <div className="job__col">
                <section className="job__section" aria-labelledby="job-waiting">
                  <h2 id="job-waiting" className="job__section-title">
                    Waiting on
                  </h2>
                  {waiting.length === 0 ? (
                    <p className="job__quiet">Nothing open</p>
                  ) : (
                    <ItemRowList testId="job-waiting-list">
                      {waiting.map((w) => {
                        const item = items.find((i) => i.id === w.itemId)!;
                        return <ItemRow key={w.itemId} item={item} forecast={forecast.items[w.itemId]} ownerName={nameOf(w.ownerId)} href={`/items/${w.itemId}`} />;
                      })}
                    </ItemRowList>
                  )}
                  <p className="job__more">
                    <Link to={`/waiting?job=${id}`} data-testid="job-waiting-all">
                      All {openCount} open item{openCount === 1 ? '' : 's'}
                    </Link>
                  </p>
                </section>
              </div>
            )}
          </div>
        </>
      )}

      <section className="job__section job__photos" aria-labelledby="job-photos" data-testid="overview-latest-photos">
        <h2 id="job-photos" className="job__section-title">
          Latest photos
        </h2>
        {latestPhotos.length === 0 ? (
          <p className="job__quiet">No photos yet</p>
        ) : (
          <ul className="job__photo-strip">
            {latestPhotos.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/jobs/${id}/photos?photo=${p.id}`}
                  className="job__photo"
                  data-testid={`overview-photo-${p.id}`}
                  aria-label={`${p.caption ?? 'Photo'}, ${formatShort(p.takenOn)}`}
                >
                  <img src={p.dataUrl} alt="" loading="lazy" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {photoCount > 0 && (
          <p className="job__more">
            <Link to={`/jobs/${id}/photos`} data-testid="overview-all-photos">
              All {photoCount} photo{photoCount === 1 ? '' : 's'}
            </Link>
          </p>
        )}
      </section>
    </main>
  );
}
