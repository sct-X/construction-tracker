/**
 * Daily notes (v1 DailyNotes look): one job's site diary, newest first, as
 * the bot saved it, grouped by week ("This week, 14-18 Sep"). Phone: a plate
 * per day, the day as its figure with how long ago beside it. Desktop: the
 * same days as a hairline table. No entry box: notes come in through the bot
 * (SPEC: the web is read-only). The job header (shell) carries the job's name.
 */
import { addCalendarDays, formatDate, formatTime, lastMonday, relativeDays, type DailyNote, type DashboardApi, type JobListRow, type SideFilter } from '@ct/core';
import { useSideQuery } from '../data/DataContext';
import { usePhoneWidth } from '../shell/useNarrow';
import { LoadError, LoadingRows } from '../components/bits';
import { plural } from '../ui/itemWords';
import '../styles/diary.css';

export interface NotesData {
  today: string;
  jobs: JobListRow[];
  jobId: string | null;
  jobName: string | null;
  notes: DailyNote[];
}

/** With no job in the route, opens the first build on this side. */
export async function loadNotes(api: DashboardApi, filter: SideFilter, routeJobId: string | null): Promise<NotesData> {
  const [today, list] = await Promise.all([api.getToday(), api.listJobs(filter)]);
  const jobs = [...list.builds, ...list.design];
  const jobId = routeJobId ?? list.builds[0]?.jobId ?? jobs[0]?.jobId ?? null;
  const notes = jobId ? await api.getDailyNotes(jobId) : [];
  return { today, jobs, jobId, jobName: jobs.find((j) => j.jobId === jobId)?.name ?? jobId, notes };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Monday to Friday of a week: "14-18 Sep", "31 Aug-4 Sep". */
export function weekRange(monday: string): string {
  const friday = addCalendarDays(monday, 4);
  const [, m1, d1] = monday.split('-').map(Number) as [number, number, number];
  const [, m2, d2] = friday.split('-').map(Number) as [number, number, number];
  return m1 === m2 ? `${d1}-${d2} ${MONTHS[m2 - 1]}` : `${d1} ${MONTHS[m1 - 1]}-${d2} ${MONTHS[m2 - 1]}`;
}

/** v1 groupByWeek: "This week, 14-18 Sep" / "Last week, 7-11 Sep" / "Week of 31 Aug-4 Sep", newest week first. */
export function groupByWeek(notes: DailyNote[], today: string): { monday: string; label: string; notes: DailyNote[] }[] {
  const thisMonday = lastMonday(today);
  const lastWeek = addCalendarDays(thisMonday, -7);
  const groups = new Map<string, { monday: string; label: string; notes: DailyNote[] }>();
  for (const n of notes) {
    const monday = lastMonday(n.date);
    let g = groups.get(monday);
    if (!g) {
      const range = weekRange(monday);
      g = { monday, label: monday === thisMonday ? `This week, ${range}` : monday === lastWeek ? `Last week, ${range}` : `Week of ${range}`, notes: [] };
      groups.set(monday, g);
    }
    g.notes.push(n);
  }
  return [...groups.values()].sort((a, b) => b.monday.localeCompare(a.monday));
}

/** "From the bot, 5:10pm" (a bot message), else "Saved 5:10pm". */
export function noteSourceWords(n: Pick<DailyNote, 'messageId' | 'createdAt'>): string {
  return n.messageId ? `From the bot, ${formatTime(n.createdAt)}` : `Saved ${formatTime(n.createdAt)}`;
}

export function NotesScreen({ jobId }: { jobId: string }) {
  const q = useSideQuery((api, f) => loadNotes(api, f, jobId));
  return (
    <section className="diary" aria-labelledby="notes-title" data-testid="notes">
      <div className="diary__head">
        <h2 id="notes-title" className="diary__title">
          Daily notes
          {q.status === 'ready' && q.data.jobName && <span className="sr-only"> at {q.data.jobName}</span>}
        </h2>
        {q.status === 'ready' && q.data.jobId && (
          <p className="page-header__meta" data-testid="notes-sub">
            {q.data.notes.length ? plural(q.data.notes.length, 'note') : 'No notes yet'}
          </p>
        )}
      </div>
      {q.status === 'loading' && <LoadingRows rows={4} label="Loading daily notes" />}
      {q.status === 'error' && <LoadError what="the daily notes" error={q.error} retry={q.retry} />}
      {q.status === 'ready' && <NotesBody data={q.data} />}
    </section>
  );
}

export function NotesBody({ data }: { data: NotesData }) {
  const phone = usePhoneWidth();
  if (!data.jobId) return <p className="empty-line">No jobs on this side yet.</p>;
  if (!data.notes.length) {
    return (
      <p className="empty-line" data-testid="notes-empty">
        No notes yet. One line a day to the bot is plenty.
      </p>
    );
  }
  const weeks = groupByWeek(data.notes, data.today);
  if (phone) {
    return (
      <div className="diary__weeks" data-testid="notes-list">
        {weeks.map((w) => (
          <section key={w.monday} className="diary__week" aria-label={w.label} data-testid={`notes-week-${w.monday}`}>
            <h3 className="diary__week-title">{w.label}</h3>
            <ul className="diary__days">
              {w.notes.map((n) => (
                <li key={n.id} className="plate diary__day" data-testid={`note-${n.id}`}>
                  <div className="diary__day-head">
                    <time className="diary__day-date" dateTime={n.date} data-testid="note-date">
                      {formatDate(n.date, data.today)}
                    </time>
                    <span className="diary__day-when">{relativeDays(n.date, data.today)}</span>
                  </div>
                  <p className="diary__day-text">{n.text}</p>
                  <p className="diary__day-source">{noteSourceWords(n)}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }
  return (
    <table className="table diary__table" data-testid="notes-list">
      <thead>
        <tr>
          <th scope="col">Day</th>
          <th scope="col">Note</th>
          <th scope="col">Came in</th>
        </tr>
      </thead>
      {weeks.map((w) => (
        <tbody key={w.monday} data-testid={`notes-week-${w.monday}`}>
          <tr className="diary__week-row">
            <th scope="rowgroup" colSpan={3}>
              {w.label}
            </th>
          </tr>
          {w.notes.map((n) => (
            <tr key={n.id} data-testid={`note-${n.id}`}>
              <td className="diary__cell-day">
                <time className="diary__day-date" dateTime={n.date} data-testid="note-date">
                  {formatDate(n.date, data.today)}
                </time>
                <span className="diary__day-when">{relativeDays(n.date, data.today)}</span>
              </td>
              <td className="diary__cell-text">{n.text}</td>
              <td className="diary__cell-source">{noteSourceWords(n)}</td>
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  );
}
