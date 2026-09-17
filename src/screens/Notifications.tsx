/**
 * Notifications and the activity feed (UI_PLAN 3.18).
 *
 *  - Notifications are mine: every reminder that would have buzzed the
 *    phone, newest first, with the words, a link to the thing, and New until
 *    it is read. Tapping one opens the thing and marks it read; "Mark all
 *    read" clears the bell.
 *  - Activity is the side's record: who did what, when, on which job, with
 *    the jobs as filter buttons.
 *
 * Phone: two tabs (`?tab=activity`). Desktop: two columns, because the
 * sidebar's "Activity" opens this route and Dominic reads both at once. The
 * site role gets notifications only (`canSee('activity')` is false, and the
 * API returns an empty feed for him anyway).
 */
import { Link, useSearchParams } from 'react-router-dom';
import { useApi, useQuery, useSession } from '../data/context';
import type { ActivityEntry, Job, Notification, Person } from '../domain/types';
import { addCalendarDays, formatLong, formatShort, formatTime } from '../domain/dates';
import { notificationHref } from '../components/Buzz';
import { useLayout } from '../shell/AppShell';
import { PageHeader } from '../shell/PageHeader';
import './notifications.css';

interface Data {
  notifications: Notification[];
  activity: ActivityEntry[];
  jobs: Job[];
  people: Person[];
  showActivity: boolean;
}

const ACTIVITY_LIMIT = 200;

/** Rows grouped by calendar day, newest day first (the rows are already newest first). */
function byDay<T extends { at: string }>(rows: T[]): { day: string; rows: T[] }[] {
  const groups: { day: string; rows: T[] }[] = [];
  for (const row of rows) {
    const day = row.at.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.rows.push(row);
    else groups.push({ day, rows: [row] });
  }
  return groups;
}

export default function Notifications() {
  const api = useApi();
  const { today, side } = useSession();
  const layout = useLayout();
  const [params, setParams] = useSearchParams();
  const jobFilter = params.get('job') ?? '';
  const personFilter = params.get('person') ?? '';
  const data = useQuery<Data>(
    (api) => {
      const showActivity = api.canSee('activity');
      return {
        notifications: api.listNotifications(),
        activity: showActivity ? api.listActivity({ jobId: jobFilter || undefined, personId: personFilter || undefined, limit: ACTIVITY_LIMIT }) : [],
        jobs: api.listJobs(),
        people: api.listPeople(),
        showActivity,
      };
    },
    [jobFilter, personFilter],
  );
  const { notifications, activity, jobs, people, showActivity } = data;
  const tab = showActivity && params.get('tab') === 'activity' ? 'activity' : 'notifications';
  const unread = notifications.filter((n) => !n.read).length;
  const nameOf = (id: string) => people.find((p) => p.id === id)?.shortName ?? 'Someone';
  const jobName = (id?: string) => jobs.find((j) => j.id === id)?.name;

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  /** "Today", "Yesterday", else "Tue 15 Sep". */
  const dayWords = (day: string) => {
    if (day === today) return 'Today';
    if (addCalendarDays(day, 1) === today) return 'Yesterday';
    return day.slice(0, 4) === today.slice(0, 4) ? formatShort(day) : formatLong(day);
  };

  const notificationsPane = (
    <section className="notifications__pane" aria-labelledby="notifications-heading" data-testid="notifications-list">
      <div className="notifications__pane-head">
        <h2 id="notifications-heading" className="notifications__heading">
          For you
          <span className="notifications__count" data-testid="notifications-unread">
            {unread ? `${unread} new` : 'Nothing new'}
          </span>
        </h2>
        <button
          type="button"
          className="btn btn--desktop notifications__mark-all"
          data-testid="notifications-mark-all"
          disabled={unread === 0}
          onClick={() => api.markAllNotificationsRead()}
        >
          Mark all read
        </button>
      </div>
      {notifications.length === 0 ? (
        <p className="notifications__empty" data-testid="notifications-empty">
          Nothing new.
        </p>
      ) : (
        <ol className="notifications__days">
          {byDay(notifications).map((g) => (
            <li key={g.day} className="notifications__day">
              <h3 className="notifications__day-title">{dayWords(g.day)}</h3>
              <ol className="notifications__rows">
                {g.rows.map((n) => (
                  <li key={n.id}>
                    <a
                      className={n.read ? 'notifications__row' : 'notifications__row notifications__row--unread'}
                      href={`#${notificationHref(n, api)}`}
                      data-testid={`notification-${n.id}`}
                      data-read={n.read ? 'true' : 'false'}
                      onClick={() => !n.read && api.markNotificationRead(n.id)}
                    >
                      <span className="notifications__time">{formatTime(n.at)}</span>
                      <span className="notifications__text">{n.text}</span>
                      {!n.read && <span className="notifications__new">New</span>}
                    </a>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      )}
    </section>
  );

  const activityPane = showActivity ? (
    <section className="notifications__pane" aria-labelledby="activity-heading" data-testid="activity">
      <h2 id="activity-heading" className="notifications__heading">
        Activity on {side.name}
      </h2>
      <div className="notifications__filters" role="group" aria-label="Filter by job">
        <button type="button" className="notifications__chip" aria-pressed={!jobFilter} data-testid="activity-filter-all" onClick={() => setParam('job', null)}>
          All jobs
        </button>
        {jobs.map((j) => (
          <button
            key={j.id}
            type="button"
            className="notifications__chip"
            aria-pressed={jobFilter === j.id}
            data-testid={`activity-filter-${j.id}`}
            onClick={() => setParam('job', j.id)}
          >
            {j.name}
          </button>
        ))}
      </div>
      <div className="notifications__filters" role="group" aria-label="Filter by person">
        <button type="button" className="notifications__chip" aria-pressed={!personFilter} data-testid="activity-person-all" onClick={() => setParam('person', null)}>
          Anyone
        </button>
        {people.map((p) => (
          <button
            key={p.id}
            type="button"
            className="notifications__chip"
            aria-pressed={personFilter === p.id}
            data-testid={`activity-person-${p.id}`}
            onClick={() => setParam('person', p.id)}
          >
            {p.shortName}
          </button>
        ))}
      </div>
      {activity.length === 0 ? (
        <p className="notifications__empty" data-testid="activity-empty">
          {jobFilter || personFilter
            ? `Nothing ${personFilter ? `by ${nameOf(personFilter)} ` : ''}${jobFilter ? `on ${jobName(jobFilter) ?? 'this job'} ` : ''}yet.`
            : 'Nothing has happened yet.'}
        </p>
      ) : (
        <ol className="notifications__days">
          {byDay(activity).map((g) => (
            <li key={g.day} className="notifications__day">
              <h3 className="notifications__day-title">{dayWords(g.day)}</h3>
              <ol className="notifications__rows">
                {g.rows.map((a) => {
                  const job = jobName(a.jobId);
                  return (
                    <li key={a.id} className="notifications__row notifications__row--activity" data-testid={`activity-${a.id}`} data-kind={a.kind}>
                      <span className="notifications__time">{formatTime(a.at)}</span>
                      <span className="notifications__who">{nameOf(a.personId)}</span>
                      <span className="notifications__text">
                        {a.text}
                        {job && !jobFilter && !a.text.includes(job) && (
                          <>
                            {' '}
                            <Link className="notifications__job" to={`/jobs/${a.jobId}`}>
                              {job}
                            </Link>
                          </>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
        </ol>
      )}
    </section>
  ) : null;

  return (
    <main className="page notifications" data-testid="notifications">
      <PageHeader title="Notifications" meta={unread ? `${unread} new for you` : 'Nothing new for you'} />
      {layout === 'phone' && showActivity && (
        <nav className="notifications__tabs" aria-label="Notifications or activity" data-testid="notifications-tabs">
          <button type="button" className="notifications__tab" aria-current={tab === 'notifications' ? 'page' : undefined} data-testid="notifications-tab-mine" onClick={() => setParam('tab', null)}>
            For you
          </button>
          <button type="button" className="notifications__tab" aria-current={tab === 'activity' ? 'page' : undefined} data-testid="notifications-tab-activity" onClick={() => setParam('tab', 'activity')}>
            Activity
          </button>
        </nav>
      )}
      {layout === 'phone' ? (
        tab === 'activity' ? activityPane : notificationsPane
      ) : (
        <div className={showActivity ? 'notifications__columns' : 'notifications__columns notifications__columns--one'}>
          {notificationsPane}
          {activityPane}
        </div>
      )}
    </main>
  );
}
