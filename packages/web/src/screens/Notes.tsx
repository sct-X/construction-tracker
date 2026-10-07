/**
 * Daily notes: one job's site diary, newest first, one entry per line as the
 * bot saved it. The date is the left margin of the diary, as on paper.
 */
import { formatDate, formatTime, lastMonday, type DailyNote, type DashboardApi, type JobListRow, type SideFilter } from '@ct/core';
import { useSideQuery } from '../data/DataContext';
import { LoadError, LoadingRows } from '../components/bits';
import '../styles/lists.css';
import { plural } from '../ui/itemWords';

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

export function NotesScreen({ jobId }: { jobId: string }) {
  const q = useSideQuery((api, f) => loadNotes(api, f, jobId));
  return (
    <div className="screen notes">
      <header className="screen-head">
        <div>
          <h1>
            Daily notes{q.status === 'ready' && q.data.jobName && <span className="sr-only"> at {q.data.jobName}</span>}
          </h1>
          {q.status === 'ready' && q.data.jobId && (
            <p className="screen-sub" data-testid="notes-sub">
              {q.data.notes.length ? `${plural(q.data.notes.length, 'note')}, newest first. Notes come in through the bot.` : 'Notes come in through the bot.'}
            </p>
          )}
        </div>
      </header>
      {q.status === 'loading' && <LoadingRows rows={5} label="Loading daily notes" />}
      {q.status === 'error' && <LoadError what="the daily notes" error={q.error} retry={q.retry} />}
      {q.status === 'ready' && <NotesBody data={q.data} />}
    </div>
  );
}

function weekWords(monday: string, today: string): string {
  const thisWeek = lastMonday(today);
  if (monday === thisWeek) return 'This week';
  return `Week of ${formatDate(monday, today)}`;
}

export function NotesBody({ data }: { data: NotesData }) {
  if (!data.jobId) return <p className="empty">No jobs on this side yet.</p>;
  if (!data.notes.length) return <p className="empty">No notes yet. One line a day to the bot is plenty.</p>;
  const weeks = new Map<string, DailyNote[]>();
  for (const n of data.notes) {
    const k = lastMonday(n.date);
    weeks.set(k, [...(weeks.get(k) ?? []), n]);
  }
  return (
    <div className="diary">
      {[...weeks].map(([monday, notes]) => (
        <section key={monday} className="diary-week" aria-label={weekWords(monday, data.today)}>
          <h2 className="diary-week-head">{weekWords(monday, data.today)}</h2>
          <ol className="diary-list">
            {notes.map((n) => (
              <li key={n.id} className="diary-entry" data-testid={`note-${n.id}`}>
                <time className="diary-date" dateTime={n.date} data-testid="note-date">
                  {formatDate(n.date, data.today)}
                </time>
                <div className="diary-body">
                  <p className="diary-text">{n.text}</p>
                  <span className="diary-meta">
                    {n.messageId ? 'From the bot' : 'Saved'} at {formatTime(n.createdAt)}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
