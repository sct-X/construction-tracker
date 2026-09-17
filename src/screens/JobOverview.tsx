/**
 * Build job overview (UI_PLAN 3.4): "how is this job going?" in one screen.
 *
 * The forecast finish is the one big figure. Under it, in words: how far off
 * the plan it is, slip since Monday and what that costs, the holding cost,
 * and how fresh the figures are with a "Confirm program" button beside them.
 * Then the next hold point with its photo sets, the stages in order, the top
 * waiting-on items, and this week's notes. Money draws nothing when absent.
 *
 * Alec gets the phone layout with a "Today" section that Stage 3 fills in
 * (upload, note, deliveries); he sees the finish date and the hold point,
 * never slip or money (the data layer strips them; nothing here defaults).
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApi, useQuery, useSession } from '../data/context';
import type { DailyNote, Item, Job, Person } from '../domain/types';
import type { JobForecast, StageForecast } from '../domain/forecast';
import { topWaitingOn } from '../domain/forecast';
import { addCalendarDays, formatDayMonth, formatLong, formatShort, relativeDays } from '../domain/dates';
import { BigNumber } from '../components/BigNumber';
import { HoldPointCheck, readinessWords } from '../components/HoldPointCheck';
import { ItemRow, ItemRowList } from '../components/ItemRow';
import { Money } from '../components/Money';
import { SlipText, slipTone } from '../components/SlipText';
import { StatusText, type Tone } from '../components/StatusText';
import NotFound from './NotFound';
import { PageHeader } from '../shell/PageHeader';
import './jobOverview.css';

interface Data {
  job: Job;
  forecast?: JobForecast;
  items: Item[];
  people: Person[];
  notes: DailyNote[];
  photoCount: number;
  stepCount: number;
}

/** "7 days late, planned Fri 27 Nov" / "On plan" / "3 days early". */
export function lateWords(f: JobForecast): { tone: Tone; text: string } {
  if (f.lateDays > 0) {
    const planned = f.plannedFinish ? `, planned ${formatShort(f.plannedFinish)}` : '';
    return { tone: 'late', text: `${f.lateDays} day${f.lateDays === 1 ? '' : 's'} late${planned}` };
  }
  if (f.lateDays < 0) return { tone: 'ok', text: `${-f.lateDays} day${f.lateDays === -1 ? '' : 's'} early` };
  return { tone: 'ok', text: 'On plan' };
}

/** The stage's forecast span in words, and its planned span when that differs. */
function stageWords(s: StageForecast): { when: string; planned?: string } {
  if (s.status === 'done') return { when: s.forecastEnd ? `Done ${formatDayMonth(s.forecastEnd)}` : 'Done' };
  const span = s.forecastStart && s.forecastEnd ? `${formatDayMonth(s.forecastStart)} to ${formatDayMonth(s.forecastEnd)}` : undefined;
  const when = s.status === 'in_progress' ? (s.forecastEnd ? `Under way, ends ${formatDayMonth(s.forecastEnd)}` : 'Under way') : span ?? 'No dates yet';
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
        notes: api.listDailyNotes(id),
        photoCount: api.listPhotos(id).length,
        stepCount: api.listSteps(id).length,
      };
    },
    [id],
  );
  const [confirmedNow, setConfirmedNow] = useState(false);

  if (!data) return <NotFound />;
  const { job, forecast, items, people, notes, photoCount, stepCount } = data;
  const site = role === 'site';
  const canConfirm = !site;
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
  const weekAgo = addCalendarDays(today, -7);
  const recentNotes = notes.filter((n) => n.date >= weekAgo).slice(0, 3);
  const hp = forecast?.nextHoldPoint;
  const hpStage = hp ? forecast?.stages.find((s) => s.stageId === hp.stageId) : undefined;

  return (
    <main className="page job" data-testid="job-overview">
      <PageHeader
        title={job.name}
        meta={
          forecast?.currentStageName
            ? `${forecast.currentStageName} stage${job.address ? `, ${job.address}` : ''}`
            : job.address ?? undefined
        }
        back={site ? undefined : { to: '/jobs', label: 'Jobs' }}
      />

      <nav className="job__tabs" aria-label="Job sections" data-testid="job-tabs">
        {tabs.map((t) => (
          <Link key={t.label} to={t.to} className="job__tab" aria-current={t.here ? 'page' : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>

      {site && (
        <section className="job__section job__today" aria-labelledby="job-today" data-testid="job-today-placeholder">
          <h2 id="job-today" className="job__section-title">
            Today
          </h2>
          <p className="job__quiet">Upload photos, today's note and deliveries due this fortnight arrive in stage 3.</p>
        </section>
      )}

      {!forecast || stepCount === 0 ? (
        <p className="job__empty" data-testid="job-empty">
          No program yet. Dominic sets this up in the program editor.
        </p>
      ) : (
        <>
          <section className="job__hero" aria-label="Forecast">
            <div className="job__finish">
              <BigNumber
                value={forecast.forecastFinish ? formatLong(forecast.forecastFinish) : 'No dates yet'}
                label="Forecast finish"
                tone={forecast.isLate ? 'late' : undefined}
                testId="job-finish"
              />
              {forecast.forecastFinish && (
                <StatusText tone={lateWords(forecast).tone} testId="job-late">
                  {lateWords(forecast).text}
                </StatusText>
              )}
            </div>

            {!site && (
              <dl className="job__facts">
                <div className="job__fact">
                  <dt>Slip since Monday</dt>
                  <dd>
                    <Link to={`/jobs/${id}/why`} className="job__slip-link" data-testid="job-slip">
                      <SlipText days={forecast.slipDays} cost={forecast.slipCost} className={`job__slip job__slip--${slipTone(forecast.slipDays)}`} />
                      {forecast.slipDays !== undefined && (
                        <span className="job__why">{forecast.slipDays === 0 ? 'Nothing moved' : 'Why it moved'}</span>
                      )}
                    </Link>
                  </dd>
                </div>
                {job.weeklyHoldingCost !== undefined && (
                  <div className="job__fact">
                    <dt>Holding cost</dt>
                    <dd>
                      <Money value={job.weeklyHoldingCost} suffix="/wk" testId="job-holding" />
                    </dd>
                  </div>
                )}
                <div className="job__fact job__fact--confirm">
                  <dt>Program</dt>
                  <dd>
                    <StatusText tone={forecast.freshness.amber ? 'amber' : 'muted'} testId="job-fresh">
                      {forecast.freshness.text}
                    </StatusText>
                    {canConfirm && (
                      <span className="job__confirm">
                        <button
                          type="button"
                          className="btn btn--desktop"
                          onClick={confirm}
                          disabled={offline}
                          data-testid="job-confirm"
                        >
                          {confirmedNow && forecast.freshness.daysUnconfirmed === 0 ? 'Confirmed' : 'Confirm program'}
                        </button>
                        {offline && <span className="job__needs-signal">Needs signal</span>}
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            )}
          </section>

          <div className="job__body">
            <div className="job__col">
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
                        {formatShort(hp.forecastStart)}, {relativeDays(hp.forecastStart, today)}
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
                  <p className="job__quiet">No hold points left on this program.</p>
                )}
              </section>

              <section className="job__section" aria-labelledby="job-stages">
                <h2 id="job-stages" className="job__section-title">
                  Stages
                </h2>
                <ol className="job__stages">
                  {forecast.stages.map((s) => {
                    const current = s.stageId === forecast.currentStageId;
                    return (
                      <li key={s.stageId} className={current ? 'job__stage job__stage--current' : 'job__stage'} data-testid={`job-stage-${s.stageId}`}>
                        <span className="job__stage-name">{s.name}</span>
                        <span className="job__stage-when">
                          {stageWords(s).when}
                          {s.isLate && s.status !== 'done' && (
                            <>
                              {' '}
                              <StatusText tone="late" plain className="job__stage-late">
                                {s.lateDays} day{s.lateDays === 1 ? '' : 's'} late
                              </StatusText>
                            </>
                          )}
                        </span>
                        {stageWords(s).planned && <span className="job__stage-planned">{stageWords(s).planned}</span>}
                      </li>
                    );
                  })}
                </ol>
                <p className="job__more">
                  <Link to={`/jobs/${id}/program`}>Open the program</Link>
                </p>
              </section>
            </div>

            {!site && (
              <div className="job__col">
                <section className="job__section" aria-labelledby="job-waiting">
                  <h2 id="job-waiting" className="job__section-title">
                    Waiting on
                  </h2>
                  {waiting.length === 0 ? (
                    <p className="job__quiet">Nothing open on this job.</p>
                  ) : (
                    <ItemRowList testId="job-waiting-list">
                      {waiting.map((w) => {
                        const item = items.find((i) => i.id === w.itemId)!;
                        return (
                          <ItemRow
                            key={w.itemId}
                            item={item}
                            forecast={forecast.items[w.itemId]}
                            ownerName={nameOf(w.ownerId)}
                            href={`/items/${w.itemId}`}
                          />
                        );
                      })}
                    </ItemRowList>
                  )}
                  <p className="job__more">
                    <Link to={`/waiting?job=${id}`} data-testid="job-waiting-all">
                      All {openCount} open item{openCount === 1 ? '' : 's'}
                    </Link>
                  </p>
                </section>

                <section className="job__section" aria-labelledby="job-notes">
                  <h2 id="job-notes" className="job__section-title">
                    Notes this week
                  </h2>
                  {recentNotes.length === 0 ? (
                    <p className="job__quiet">No notes this week.</p>
                  ) : (
                    <ul className="job__notes">
                      {recentNotes.map((n) => (
                        <li key={n.id} className="job__note">
                          <span className="job__note-date">
                            {formatShort(n.date)}, {nameOf(n.authorId) ?? 'site'}
                          </span>
                          <span className="job__note-text">{n.text}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="job__more">
                    <Link to={`/jobs/${id}/notes`}>All notes</Link>
                    <span className="job__more-sep" aria-hidden="true">
                      {' '}
                    </span>
                    <Link to={`/jobs/${id}/photos`}>
                      {photoCount} photo{photoCount === 1 ? '' : 's'}
                    </Link>
                  </p>
                </section>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
