/**
 * Build job overview: is this job on time? One screen, top to bottom.
 *
 *   1. Progress: a large bar across every stage, "Stage 5 of 8" and the
 *      stage's name, then the next hold point with its date and, compactly,
 *      whether its before-cover photos are in.
 *   2. Overdue: every item of this job past its date (forecast isOverdue, the
 *      same test as the Overview's count, so the two always agree). Each row
 *      opens the item sheet.
 *   3. Trades on this week: the trades on site or booked in from today to a
 *      week out, from the steps planned or forecast in that window.
 *   4. The partner's weekly Confirm program, quietly at the foot.
 *
 * Next steps and the open items that are not overdue live in the Program and
 * Waiting on tabs. No forecast finish, slip or money anywhere.
 *
 * Alec keeps his own page: Today on top (AlecToday), then the stage, the
 * stage ladder and the latest photos.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApi, useQuery, useSession } from '../data/context';
import type { Item, Job, Person, Photo, Step, Trade } from '../domain/types';
import type { JobForecast, StageForecast, StepForecast } from '../domain/forecast';
import { isOverdue, isStageOverdue } from '../domain/forecast';
import { addCalendarDays, formatDayMonth, formatShort, formatShortRelative, relativeDate } from '../domain/dates';
import { BigNumber } from '../components/BigNumber';
import { readinessWords } from '../components/HoldPointCheck';
import { itemWhenWords } from '../components/ItemRow';
import { StageBar, positionWords } from '../components/StageBar';
import { StatusText } from '../components/StatusText';
import AlecToday from './AlecToday';
import NotFound from './NotFound';
import { JobHeader } from '../shell/JobHeader';
import './jobOverview.css';

interface Data {
  job: Job;
  forecast?: JobForecast;
  items: Item[];
  people: Person[];
  steps: Step[];
  trades: Trade[];
  photoCount: number;
  /** The newest few, for Alec's strip at the foot. */
  latestPhotos: Photo[];
}

/** How far ahead "this week" looks: today and the next seven days. */
const WEEK_DAYS = 7;

export interface TradeOnRow {
  key: string;
  trade: string;
  stepId: string;
  stepName: string;
  /** "On site, until Fri 25 Sep" or "Mon 21 Sep, in 4 days". */
  when: string;
  start: string;
}

/**
 * The trades on this week: every step not yet done whose forecast span meets
 * today..today+7, named by the trades booked against it (else the step's own
 * trade type), in start order. A step with no trade to its name is
 * left out: there is no one to expect on site.
 */
export function tradesOnThisWeek(forecast: JobForecast, steps: Step[], items: Item[], trades: Trade[], today: string): TradeOnRow[] {
  const end = addCalendarDays(today, WEEK_DAYS);
  const stepById = new Map(steps.map((s) => [s.id, s]));
  const tradeName = new Map(trades.map((t) => [t.id, t.name]));
  const rows: TradeOnRow[] = [];
  const inWindow = Object.values(forecast.steps)
    .filter((s) => s.status !== 'done' && s.forecastStart <= end && s.forecastEnd >= today)
    .sort((a, b) => a.forecastStart.localeCompare(b.forecastStart) || a.name.localeCompare(b.name));
  for (const s of inWindow) {
    // Who is coming: the trades booked against the step by name, else the step's trade.
    const names = new Set<string>();
    for (const i of items)
      if (i.stepId === s.stepId && i.type === 'trade') {
        const n = (i.tradeId && tradeName.get(i.tradeId)) || i.waitingOn;
        if (n) names.add(n);
      }
    const own = stepById.get(s.stepId)?.tradeType;
    if (names.size === 0 && own) names.add(own);
    for (const trade of names)
      rows.push({
        key: `${s.stepId}-${trade}`,
        trade,
        stepId: s.stepId,
        stepName: s.name,
        when: tradeWhen(s, today),
        start: s.forecastStart,
      });
  }
  return rows;
}

function tradeWhen(s: StepForecast, today: string): string {
  if (s.status === 'in_progress' || s.forecastStart <= today) return `On site, until ${formatShort(s.forecastEnd)}`;
  return formatShortRelative(s.forecastStart, today);
}

export default function JobOverview() {
  const { id = '' } = useParams();
  const { role } = useSession();
  const data = useQuery<Data | undefined>(
    (api) => {
      const job = api.getJob(id);
      if (!job) return undefined;
      return {
        job,
        forecast: api.getForecast(id),
        items: api.listItems({ jobId: id }),
        people: api.listPeople(),
        steps: api.listSteps(id),
        trades: api.listTrades(),
        photoCount: api.listPhotos(id).length,
        latestPhotos: api.listPhotos(id).slice(0, 6),
      };
    },
    [id],
  );

  if (!data) return <NotFound />;
  const { job } = data;
  const site = role === 'site';

  const tabs = site
    ? [
        { label: 'Today', to: `/jobs/${id}`, here: true },
        { label: 'Program', to: `/jobs/${id}/program` },
        // Shipments live inside the job for every role (Dom's brief, change 2); Alec keeps Deliveries too.
        { label: 'Shipments', to: `/jobs/${id}/shipments` },
        { label: 'Photos', to: `/jobs/${id}/photos` },
        { label: 'Deliveries', to: '/deliveries' },
      ]
    : [
        { label: 'Overview', to: `/jobs/${id}`, here: true },
        { label: 'Program', to: `/jobs/${id}/program` },
        { label: 'Waiting on', to: `/waiting?job=${id}` },
        { label: 'Shipments', to: `/jobs/${id}/shipments` },
        { label: 'Photos', to: `/jobs/${id}/photos` },
        { label: 'Notes', to: `/jobs/${id}/notes` },
      ];

  const empty = !data.forecast || data.steps.length === 0;

  return (
    <main className={site ? 'page job job--site' : 'page job'} data-testid="job-overview">
      <JobHeader job={job} section="overview" back={site ? undefined : { to: '/overview', label: 'Overview' }} />

      <nav className="job__tabs" aria-label="Job sections" data-testid="job-tabs">
        {tabs.map((t) => (
          <Link key={t.label} to={t.to} className="job__tab" data-testid={`job-tab-${t.label.toLowerCase().replace(/\s+/g, '-')}`} aria-current={t.here ? 'page' : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>

      {site ? (
        <SiteBody jobId={id} data={data} empty={empty} />
      ) : empty ? (
        <p className="job__empty" data-testid="job-empty">
          No program yet.
        </p>
      ) : (
        <TimingBody data={data} forecast={data.forecast!} />
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Partners, admin and the builder: timing first
// ---------------------------------------------------------------------------

function TimingBody({ data, forecast }: { data: Data; forecast: JobForecast }) {
  const api = useApi();
  const { today, offline } = useSession();
  const [confirmedNow, setConfirmedNow] = useState(false);
  const { job, items, people, steps, trades } = data;
  const nameOf = (pid?: string) => people.find((p) => p.id === pid)?.shortName;

  const hp = forecast.nextHoldPoint;
  const overdue = items
    .filter((i) => forecast.items[i.id] && isOverdue(forecast.items[i.id], today))
    .map((i) => ({
      item: i,
      when: itemWhenWords(forecast.items[i.id], i.status, today),
    }))
    .sort((a, b) => overdueSince(forecast, a.item).localeCompare(overdueSince(forecast, b.item)) || a.item.title.localeCompare(b.item.title));
  const onThisWeek = tradesOnThisWeek(forecast, steps, items, trades, today);

  const confirm = () => {
    api.confirmJob(job.id);
    setConfirmedNow(true);
  };

  return (
    <div className="job__timing">
      <section className="job__progress" aria-labelledby="job-progress-title" data-testid="job-progress">
        <div className="job__progress-head">
          <h2 id="job-progress-title" className="job__stage-title" data-testid="job-stage">
            {forecast.currentStageName ?? 'All stages done'}
          </h2>
          <span className="job__stage-of" data-testid="job-stage-of">
            {positionWords(forecast.stages, forecast.currentStageId)}
          </span>
        </div>
        <StageBar stages={forecast.stages} currentStageId={forecast.currentStageId} size="large" testId="job-stage-bar" />
        <div className="job__hp" data-testid="job-next-holdpoint">
          {hp ? (
            <Link to={`/steps/${hp.stepId}`} className="cell cell--link job__hp-cell">
              <span className="job__hp-body">
                <span className="job__hp-label">Next hold point</span>
                <span className="job__hp-name">{hp.stepName}</span>
                <span className="job__hp-when">{formatShortRelative(hp.forecastStart, today)}</span>
                {!hp.ok && (
                  <StatusText tone="amber" className="job__hp-photos" testId="job-holdpoint-readiness">
                    {readinessWords(hp)}
                  </StatusText>
                )}
              </span>
            </Link>
          ) : (
            <p className="job__hp-none">No hold points left</p>
          )}
        </div>
      </section>

      <section className="group job__group" aria-labelledby="job-overdue-title" data-testid="job-overdue">
        <h2 id="job-overdue-title" className="group__header group__header--large">
          Overdue
          {overdue.length > 0 && (
            <span className="job__group-count" data-testid="job-overdue-count">
              {overdue.length}
            </span>
          )}
        </h2>
        <ul className="group__list">
          {overdue.length === 0 ? (
            <li className="cell job__none" data-testid="job-overdue-none">
              Nothing overdue
            </li>
          ) : (
            overdue.map(({ item, when }) => {
              const who = item.waitingOn ?? nameOf(item.ownerId);
              return (
                <li key={item.id} className="job__li">
                  <Link to={`/items/${item.id}`} className="cell cell--link job__row" data-testid={`job-overdue-${item.id}`}>
                    <span className="job__row-body">
                      <span className="job__row-title">{item.title}</span>
                      {who && <span className="job__row-detail">{who}</span>}
                      {when && (
                        <StatusText tone="late" plain className="job__row-late">
                          {when.text}
                        </StatusText>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <section className="group job__group" aria-labelledby="job-trades-title" data-testid="job-trades">
        <h2 id="job-trades-title" className="group__header group__header--large">
          Trades on this week
        </h2>
        <ul className="group__list">
          {onThisWeek.length === 0 ? (
            <li className="cell job__none" data-testid="job-trades-none">
              No trades on this week
            </li>
          ) : (
            onThisWeek.map((t) => (
              <li key={t.key} className="job__li">
                <Link to={`/steps/${t.stepId}`} className="cell cell--link job__row" data-testid={`job-trade-${t.stepId}`}>
                  <span className="job__row-body">
                    <span className="job__row-title">{t.trade}</span>
                    <span className="job__row-detail">{t.stepName}</span>
                    <span className="job__row-when">{t.when}</span>
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="job__confirm" aria-label="Confirm program">
        <StatusText tone="muted" testId="job-fresh">
          {forecast.freshness.text}
        </StatusText>
        <button type="button" className="btn btn--tinted btn--desktop job__confirm-btn" onClick={confirm} disabled={offline} data-testid="job-confirm">
          {confirmedNow && forecast.freshness.daysUnconfirmed === 0 ? 'Confirmed' : 'Confirm program'}
        </button>
        {offline && <span className="job__needs-signal">Needs signal</span>}
      </section>
    </div>
  );
}

/** The date an overdue item went overdue on, for the most-overdue-first order. */
function overdueSince(forecast: JobForecast, item: Item): string {
  const f = forecast.items[item.id];
  const dates = [f.neededBy, f.status === 'to_do' ? f.actBy : undefined].filter((d): d is string => !!d && d < forecast.today);
  return dates.sort()[0] ?? '9999-99-99';
}

// ---------------------------------------------------------------------------
// Alec: Today, then the stage, the ladder and the latest photos (unchanged)
// ---------------------------------------------------------------------------

/** The stage's forecast span in words, and its planned span when that differs. */
function stageWords(s: StageForecast, today: string): { when: string; planned?: string } {
  if (s.status === 'done')
    return {
      when: s.forecastEnd ? `Done ${formatDayMonth(s.forecastEnd)}, ${relativeDate(s.forecastEnd, today)}` : 'Done',
    };
  const span = s.forecastStart && s.forecastEnd ? `${formatDayMonth(s.forecastStart)} to ${formatDayMonth(s.forecastEnd)}, starts ${relativeDate(s.forecastStart, today)}` : undefined;
  const when = s.status === 'in_progress' ? (s.forecastEnd ? `Under way, ends ${formatDayMonth(s.forecastEnd)}, ${relativeDate(s.forecastEnd, today)}` : 'Under way') : (span ?? 'No dates yet');
  const moved = s.plannedStart && s.plannedEnd && (s.plannedStart !== s.forecastStart || s.plannedEnd !== s.forecastEnd);
  const planned = moved ? `planned ${formatDayMonth(s.plannedStart!)} to ${formatDayMonth(s.plannedEnd!)}` : undefined;
  return { when, planned };
}

function SiteBody({ jobId, data, empty }: { jobId: string; data: Data; empty: boolean }) {
  const { today } = useSession();
  const { forecast, latestPhotos, photoCount } = data;
  return (
    <>
      <AlecToday jobId={jobId} />

      {empty || !forecast ? (
        <p className="job__empty" data-testid="job-empty">
          No program yet.
        </p>
      ) : (
        <>
          <section className="job__hero" aria-label="Where it is">
            <div className="job__finish">
              <BigNumber value={forecast.currentStageName ?? 'Done'} label="Stage" testId="job-stage" />
            </div>
          </section>

          <div className="job__body">
            <div className="job__col">
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
                              <StatusText tone={isStageOverdue(s, today) ? 'late' : 'plain'} plain className="job__stage-late">
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
                <Link to={`/jobs/${jobId}/photos?photo=${p.id}`} className="job__photo" data-testid={`overview-photo-${p.id}`} aria-label={`${p.caption ?? 'Photo'}, ${formatShort(p.takenOn)}`}>
                  <img src={p.dataUrl} alt="" loading="lazy" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {photoCount > 0 && (
          <p className="job__more">
            <Link to={`/jobs/${jobId}/photos`} data-testid="overview-all-photos">
              All {photoCount} photo{photoCount === 1 ? '' : 's'}
            </Link>
          </p>
        )}
      </section>
    </>
  );
}
