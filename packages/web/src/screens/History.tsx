/**
 * Changes (v1 Activity look, plus what v1 lacked): every change set the bot
 * or Setup recorded, newest first, by day ("Yesterday", "Tue 15 Sep, 2 days
 * ago"), down a timeline rail: the time, whether it was saved, undone or
 * cancelled, then what it was, the job, every field before -> after, the
 * steps it moved (timing first: never the finish or money) and the message or
 * voice transcript it came from. One dropdown narrows it to a job.
 */
import {
  addCalendarDays,
  formatDate,
  formatStamp,
  formatTime,
  relativeDays,
  sydneyDate,
  type DashboardApi,
  type HistoryEntry,
  type JobListRow,
  type SideFilter,
} from '@ct/core';
import { useSideQuery } from '../data/DataContext';
import { href } from '../app/router';
import { LoadError, LoadingRows } from '../components/bits';
import { PageHeader } from '../components/PageHeader';
import { FilterSelect } from '../components/FilterSelect';
import { fieldWords, valueWords } from '../ui/format';
import { plural } from '../ui/itemWords';
import '../styles/history.css';

export interface HistoryData {
  today: string;
  jobs: JobListRow[];
  jobId: string | null;
  entries: HistoryEntry[];
}

export async function loadHistory(api: DashboardApi, filter: SideFilter, jobId: string | null): Promise<HistoryData> {
  const [today, list, entries] = await Promise.all([api.getToday(), api.listJobs(filter), api.getChangeHistory({ ...filter, ...(jobId ? { jobId } : {}) })]);
  return { today, jobs: [...list.builds, ...list.design], jobId, entries };
}

export function HistoryScreen({ jobId = null }: { jobId?: string | null }) {
  const q = useSideQuery((api, f) => loadHistory(api, f, jobId));
  const jobName = q.status === 'ready' && jobId ? (q.data.jobs.find((j) => j.jobId === jobId)?.name ?? jobId) : null;
  const meta =
    q.status === 'ready' ? (
      <span data-testid="history-sub">
        {q.data.entries.length ? plural(q.data.entries.length, 'change') : 'No changes'}
        {jobName ? ` at ${jobName}` : ''}
      </span>
    ) : null;
  return (
    <div className="changes" data-testid="history">
      <PageHeader title="Changes" meta={meta} />
      {q.status === 'ready' && (
        <div className="filterbar changes__filters" data-testid="history-filters">
          <FilterSelect
            label="Job"
            value={jobId ?? ''}
            testId="job-picker"
            onChange={(v) => {
              globalThis.location.hash = href(v ? `/history/${encodeURIComponent(v)}` : '/history');
            }}
            options={[
              { value: '', label: 'All jobs' },
              ...q.data.jobs.filter((j) => j.kind === 'build').map((j) => ({ value: j.jobId, label: j.name, group: 'Builds' })),
              ...q.data.jobs.filter((j) => j.kind === 'design').map((j) => ({ value: j.jobId, label: j.name, group: 'Design' })),
            ]}
          />
        </div>
      )}
      {q.status === 'loading' && <LoadingRows rows={4} label="Loading the change history" />}
      {q.status === 'error' && <LoadError what="the change history" error={q.error} retry={q.retry} />}
      {q.status === 'ready' && <HistoryBody data={q.data} />}
    </div>
  );
}

/** The instant an entry sits at: when it was confirmed, else when it was made. */
function entryAt(e: HistoryEntry): string {
  return e.confirmedAt ?? e.createdAt;
}

/** "Today", "Yesterday", else "Tue 15 Sep, 2 days ago" (v1 dayWords). */
export function dayWords(day: string, today: string): string {
  if (day === today) return 'Today';
  if (addCalendarDays(day, 1) === today) return 'Yesterday';
  return `${formatDate(day, today)}, ${relativeDays(day, today)}`;
}

/** Entries grouped by Sydney day, newest day first (the entries are already newest first). */
export function byDay(entries: HistoryEntry[]): { day: string; entries: HistoryEntry[] }[] {
  const out: { day: string; entries: HistoryEntry[] }[] = [];
  for (const e of entries) {
    const day = sydneyDate(entryAt(e));
    const last = out[out.length - 1];
    if (last && last.day === day) last.entries.push(e);
    else out.push({ day, entries: [e] });
  }
  return out;
}

export function HistoryBody({ data }: { data: HistoryData }) {
  if (!data.entries.length) {
    return (
      <p className="empty-line" data-testid="history-empty">
        No changes yet{data.jobId ? ' on this job' : ''}.
      </p>
    );
  }
  return (
    <ol className="changes__days">
      {byDay(data.entries).map((g) => (
        <li key={g.day} className="changes__day">
          <h2 className="changes__day-title">{dayWords(g.day, data.today)}</h2>
          <ol className="changes__rows">
            {g.entries.map((e) => (
              <Entry key={e.changeSetId} entry={e} data={data} />
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}

/** "Saved", "Undone", "Cancelled", "Waiting for Confirm". */
export function statusWord(e: Pick<HistoryEntry, 'status'>): string {
  switch (e.status) {
    case 'confirmed':
      return 'Saved';
    case 'undone':
      return 'Undone';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Waiting for Confirm';
  }
}

function Entry({ entry, data }: { entry: HistoryEntry; data: HistoryData }) {
  const { today } = data;
  const msg = entry.message;
  const source = msg ? (msg.transcript ?? msg.rawText) : null;
  const how = msg ? `${msg.transcript ? 'Voice note' : msg.channel === 'web' ? 'Setup' : 'Message'}${msg.channel === 'telegram' ? ' on Telegram' : ''}, ${formatStamp(msg.receivedAt)}` : null;
  const saved = entry.status === 'confirmed';
  const later = entry.status === 'undone' && entry.undoneAt ? `, undone ${formatStamp(entry.undoneAt)}` : '';
  return (
    <li className={saved ? 'changes__row' : 'changes__row changes__row--off'} data-testid={`history-${entry.changeSetId}`} data-status={entry.status}>
      <time className="changes__time" dateTime={entryAt(entry)}>
        {formatTime(entryAt(entry))}
      </time>
      <span className={saved ? 'changes__status' : 'changes__status changes__status--off'} data-testid="status">
        {statusWord(entry)}
      </span>
      <div className="changes__body">
        <p className="changes__summary">
          {entry.summary}
          {later && <span className="changes__later">{later}</span>}
        </p>
        {entry.jobNames.length > 0 && !data.jobId && (
          <p className="changes__jobs">
            {entry.jobIds.map((id, i) => (
              <a key={id} className="changes__job" href={href(`/jobs/${encodeURIComponent(id)}`)}>
                {entry.jobNames[i]}
              </a>
            ))}
          </p>
        )}
        <Fields entry={entry} today={today} />
        <ForecastLine entry={entry} />
        {!source && msg?.channel === 'web' && (
          <p className="changes__setup" data-testid="source-setup">
            Changed in Setup on the computer, {formatStamp(msg.receivedAt)}
          </p>
        )}
        {source && (
          <blockquote className="changes__source" data-testid="source">
            <p>“{source}”</p>
            {how && <footer>{how}</footer>}
          </blockquote>
        )}
      </div>
    </li>
  );
}

function Fields({ entry, today }: { entry: HistoryEntry; today: string }) {
  if (!entry.changes.length) return null;
  const off = entry.status !== 'confirmed';
  const lead = entry.status === 'cancelled' ? 'Would have changed (not saved):' : entry.status === 'undone' ? 'Changed, then undone:' : off ? 'Would change:' : null;
  return (
    <>
      {lead && <p className="changes__lead">{lead}</p>}
      <ul className={off ? 'changes__fields changes__fields--off' : 'changes__fields'} data-testid="fields">
        {entry.changes.length > MAX_FIELDS
          ? groupedChanges(entry.changes).map((line) => (
              <li key={line} className="changes__field">
                <span className="changes__what">{line}</span>
              </li>
            ))
          : entry.changes.map((c, i) => (
              <li key={i} className="changes__field">
                {c.kind === 'update' && c.field ? (
                  <>
                    <span className="changes__what">
                      {c.rowLabel}, {fieldWords(c.field)}
                    </span>
                    <span className="changes__ba">
                      <span className="changes__before">{valueWords(c, c.before, today)}</span>
                      {' → '}
                      <span className="changes__after">{valueWords(c, c.after, today)}</span>
                    </span>
                  </>
                ) : (
                  <span className="changes__what">
                    {c.kind === 'insert' ? 'Added' : 'Removed'} {tableWords(c.table)}: {c.rowLabel}
                  </span>
                )}
              </li>
            ))}
      </ul>
    </>
  );
}

function tableWords(t: string): string {
  return t.replace(/_/g, ' ');
}

/** Past this many field changes (a new job from a template adds hundreds of rows), they're counted, not listed. */
const MAX_FIELDS = 12;

const TABLE_PLURALS: Record<string, string> = { step_link: 'links between steps', requirement: 'needs', photo_category: 'photo categories' };

/** "Added 8 stages", "Added 29 steps", "Changed 5 steps" for a big change set. */
export function groupedChanges(changes: HistoryEntry['changes']): string[] {
  const counts = new Map<string, { verb: string; table: string; n: number; label: string }>();
  for (const c of changes) {
    const verb = c.kind === 'insert' ? 'Added' : c.kind === 'delete' ? 'Removed' : 'Changed';
    const key = `${verb}:${c.table}`;
    const cur = counts.get(key) ?? { verb, table: c.table, n: 0, label: c.rowLabel };
    cur.n += 1;
    counts.set(key, cur);
  }
  return [...counts.values()].map(({ verb, table, n, label }) =>
    n === 1 ? `${verb} ${tableWords(table)}: ${label}` : `${verb} ${n} ${TABLE_PLURALS[table] ?? `${tableWords(table)}s`}`,
  );
}

function ForecastLine({ entry }: { entry: HistoryEntry }) {
  if (entry.status !== 'confirmed') return null;
  // Confirming a job, a note or a photo never touches the program; say nothing.
  if (entry.changes.every((c) => c.field === 'lastConfirmed' || (c.kind === 'insert' && (c.table === 'daily_note' || c.table === 'photo')))) return null;
  if (!entry.effects.length) {
    return (
      <p className="changes__effect changes__effect--none" data-testid="forecast">
        Moved no forecast.
      </p>
    );
  }
  return (
    <ul className="changes__effects" data-testid="forecast">
      {entry.effects.map((e) => (
        // Timing first (SPEC revision): the steps it moved, never the finish or money.
        <li key={e.jobId} className="changes__effect">
          {e.movedSteps ? `Moved ${plural(e.movedSteps, 'step')} at ${e.jobName}` : `Moved no steps at ${e.jobName}`}
        </li>
      ))}
    </ul>
  );
}
