/**
 * Alec's Today (UI_PLAN 3.4, the site half): the site hand's page for one
 * build job, a stack of plates read with gloves on.
 *
 *   Thursday 17 September            <- the day is the hero
 *   Lock-up stage, week 3 of 12
 *   [        Add photos (3)        ]  <- the one hi-vis action, 64px; the queue count is its badge
 *   Next hold point   Stormwater inspection, Mon 12 Oct, in 3 weeks
 *                     0 of 1 required photo sets uploaded ... Add photos now
 *   Deliveries        Cladding, Expected Tue 15 Sep, 2 days ago, not marked delivered
 *   On site this week Roof plumbing, Mon to Thu, Roof plumber
 *   Today's note      Rain till 10. Cladding continued after.
 *
 * Never a price, never a design job: the data layer strips both before this
 * component sees anything, and nothing here defaults a money field. Every
 * target is 56px.
 */
import { Link } from 'react-router-dom';
import { useQuery, useSession } from '../data/context';
import type { StepForecast } from '../domain/forecast';
import { addCalendarDays, formatShortRelative, formatWeekRange, lastMonday, weekday, workingDaysBetween } from '../domain/dates';
import { HoldPointCheck, readinessWords } from '../components/HoldPointCheck';
import { StatusText } from '../components/StatusText';
import { DeliveryRow, collectDeliveries, groupDeliveries } from './Deliveries';
import { useQueuedPhotos } from '../components/QueueBadge';
import './alecToday.css';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Thursday 17 September": the day in full words, the way it is written at the top of a diary page. */
export function dateInWords(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${WEEKDAYS[weekday(iso)]} ${d} ${MONTHS[m - 1]}`;
}

/** "Mon to Fri", "from Wed, 3 wks", "finishes Fri", "all week". */
function stepWeekWords(s: StepForecast, monday: string, sunday: string): string {
  const startsThisWeek = s.forecastStart >= monday;
  const endsThisWeek = s.forecastEnd <= sunday;
  if (startsThisWeek && endsThisWeek) {
    return s.forecastStart === s.forecastEnd ? DAY[weekday(s.forecastStart)] : `${DAY[weekday(s.forecastStart)]} to ${DAY[weekday(s.forecastEnd)]}`;
  }
  if (startsThisWeek) {
    const wks = Math.max(1, Math.round(s.durationDays / 5));
    return `from ${DAY[weekday(s.forecastStart)]}, ${wks} wk${wks === 1 ? '' : 's'}`;
  }
  if (endsThisWeek) return `finishes ${DAY[weekday(s.forecastEnd)]}`;
  return 'all week';
}

export default function AlecToday({ jobId }: { jobId: string }) {
  const { today } = useSession();
  const data = useQuery(
    (api) => {
      const job = api.getJob(jobId);
      if (!job) return undefined;
      return {
        job,
        forecast: api.getForecast(jobId),
        steps: api.listSteps(jobId),
        notes: api.listDailyNotes(jobId),
        deliveries: collectDeliveries(api, today, jobId),
      };
    },
    [jobId, today],
  );
  const queuedPhotos = useQueuedPhotos().filter((p) => p.jobId === jobId);
  const queued = queuedPhotos.length;
  if (!data) return null;
  const { forecast, steps, notes, deliveries } = data;

  const monday = lastMonday(today);
  const sunday = addCalendarDays(monday, 6);
  const stage = forecast?.stages.find((s) => s.stageId === forecast.currentStageId);
  const stageWeek =
    stage?.forecastStart && stage.forecastEnd && stage.forecastStart <= today
      ? `week ${Math.floor(workingDaysBetween(stage.forecastStart, today) / 5) + 1} of ${Math.max(1, Math.ceil(workingDaysBetween(stage.forecastStart, stage.forecastEnd) / 5))}`
      : undefined;
  const uploadHref = `/jobs/${jobId}/upload${forecast?.currentStageId ? `?stage=${forecast.currentStageId}` : ''}`;

  const tradeOf = new Map(steps.map((s) => [s.id, s.tradeType]));
  const onSite = forecast
    ? Object.values(forecast.steps)
        .filter((s) => s.status !== 'done' && s.forecastStart <= sunday && s.forecastEnd >= monday)
        .sort((a, b) => a.forecastStart.localeCompare(b.forecastStart))
    : [];

  const todayNote = notes.find((n) => n.date === today);
  const thisWeek = groupDeliveries(deliveries, today).filter((g) => g.key === 'late' || g.key === 'this-week');
  const hp = forecast?.nextHoldPoint;
  const hpStage = hp ? forecast?.stages.find((s) => s.stageId === hp.stageId) : undefined;
  const hpCategoryIds = new Set(hp?.required.map((r) => r.categoryId) ?? []);
  const hpQueued = queuedPhotos.filter((p) => hpCategoryIds.has(p.categoryId)).length;

  return (
    <section className="today" aria-labelledby="today-date" data-testid="today">
      <header className="today__head">
        <h2 id="today-date" className="today__date display" data-testid="today-date">
          {dateInWords(today)}
        </h2>
        <p className="today__stage" data-testid="today-stage">
          {stage ? `${stage.name} stage${stageWeek ? `, ${stageWeek}` : ''}` : 'No program yet'}
        </p>
      </header>

      <a className="btn btn--primary today__add" href={`#${uploadHref}`} data-testid="today-add-photos">
        Add photos
        {queued > 0 && (
          <span className="today__add-badge" data-testid="today-add-badge">
            {queued}
            <span className="sr-only"> waiting to send</span>
          </span>
        )}
      </a>

      <section className="today__plate" aria-labelledby="today-hp-title" data-testid="today-holdpoint">
        <h3 id="today-hp-title" className="today__title">
          Next hold point
        </h3>
        {hp ? (
          <>
            <p className="today__hp-line">
              <Link to={`/steps/${hp.stepId}`} className="today__hp-name" data-testid="today-holdpoint-name">
                {hp.stepName}
              </Link>
              <span className="today__hp-when" data-testid="today-holdpoint-when">
                {formatShortRelative(hp.forecastStart, today)}
                {hpStage ? `, ${hpStage.name} stage` : ''}
              </span>
            </p>
            <p className="today__hp-ready">
              <StatusText tone={hp.ok ? 'ok' : 'amber'} testId="today-holdpoint-readiness">
                {readinessWords(hp)}
              </StatusText>
            </p>
            <HoldPointCheck check={hp} compact canComplete={false} queuedCount={hpQueued} uploadHref={`/jobs/${jobId}/upload?stage=${hp.stageId}`} />
          </>
        ) : (
          <p className="today__quiet">No hold points left</p>
        )}
      </section>

      <section className="today__plate" aria-labelledby="today-deliveries-title" data-testid="today-deliveries">
        <h3 id="today-deliveries-title" className="today__title">
          Deliveries this week
        </h3>
        {thisWeek.length === 0 ? (
          <p className="today__quiet">Nothing expected</p>
        ) : (
          thisWeek.map((g) => (
            <ul key={g.key} className="today__deliveries">
              {g.rows.map((d) => (
                <DeliveryRow key={d.id} delivery={d} today={today} />
              ))}
            </ul>
          ))
        )}
        <Link to="/deliveries" className="today__more" data-testid="today-deliveries-link">
          All deliveries
        </Link>
      </section>

      <section className="today__plate" aria-labelledby="today-week-title" data-testid="today-week">
        <h3 id="today-week-title" className="today__title">
          <span>On site this week</span>
          <span className="today__range num">{formatWeekRange(monday)}</span>
        </h3>
        {onSite.length === 0 ? (
          <p className="today__quiet">Nothing on site this week</p>
        ) : (
          <ul className="today__steps">
            {onSite.map((s) => {
              const trade = tradeOf.get(s.stepId);
              const words = stepWeekWords(s, monday, sunday);
              return (
                <li key={s.stepId}>
                  <a href={`#/steps/${s.stepId}`} className="today__step" data-testid={`today-step-${s.stepId}`}>
                    <span className="today__step-name">
                      {s.isHoldPoint && <span className="today__hold">Hold point: </span>}
                      {s.name}
                    </span>
                    <span className="today__step-when">
                      {words.charAt(0).toUpperCase() + words.slice(1)}
                      {trade ? `, ${trade}` : ''}
                      {s.status === 'in_progress' ? ', started' : ''}
                    </span>
                    {s.lateDays > 0 && (
                      <StatusText tone="late" className="today__step-late">
                        {s.lateDays} day{s.lateDays === 1 ? '' : 's'} late
                      </StatusText>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        )}
        <Link to={`/jobs/${jobId}/program`} className="today__more" data-testid="today-program-link">
          Next three weeks
        </Link>
      </section>

      <Link to={`/jobs/${jobId}/notes`} className="today__plate today__note" data-testid="today-note">
        {todayNote ? (
          <>
            <span className="today__title">Today's note</span>
            <span className="today__note-text">{todayNote.text}</span>
          </>
        ) : (
          <span className="today__note-label">Write today's note</span>
        )}
      </Link>
    </section>
  );
}
