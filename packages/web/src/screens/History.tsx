/**
 * Change history: every change set the bot recorded, newest first. Each shows
 * whether it was saved, undone or cancelled and when, the message or voice
 * transcript it came from, every field before and after, and which forecast it
 * moved. Filter by job.
 */
import {
  formatDate,
  formatDays,
  formatStamp,
  sydneyDate,
  type DashboardApi,
  type HistoryEntry,
  type JobListRow,
  type SideFilter,
} from '@ct/core';
import { useSideQuery } from '../data/DataContext';
import { LoadError, LoadingRows, Money } from '../components/bits';
import { JobPicker } from '../components/listBits';
import { fieldWords, valueWords } from '../ui/format';
import { plural } from '../ui/itemWords';

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
  return (
    <div className="screen history">
      <header className="screen-head screen-head-tools">
        <div>
          <h1>Changes{jobName ? ` at ${jobName}` : ''}</h1>
          {q.status === 'ready' && q.data.entries.length > 0 && (
            <p className="screen-sub" data-testid="history-sub">
              {q.data.entries.length
                ? q.data.entries.some((e) => e.message?.channel === 'web')
                  ? `${plural(q.data.entries.length, 'change')} from the bot and Setup, newest first. Nothing from the bot is saved until Dominic taps Confirm.`
                  : `${plural(q.data.entries.length, 'change')} from the bot, newest first. Nothing is saved until Dominic taps Confirm.`
                : null}
            </p>
          )}
        </div>
        {q.status === 'ready' && (
          <JobPicker id="history-job" jobs={q.data.jobs} current={jobId} allPath="/history" pathFor={(id) => `/history/${encodeURIComponent(id)}`} />
        )}
      </header>
      {q.status === 'loading' && <LoadingRows rows={4} label="Loading the change history" />}
      {q.status === 'error' && <LoadError what="the change history" error={q.error} retry={q.retry} />}
      {q.status === 'ready' && <HistoryBody data={q.data} />}
    </div>
  );
}

export function HistoryBody({ data }: { data: HistoryData }) {
  if (!data.entries.length) return <p className="empty">No changes yet{data.jobId ? ' on this job' : ''}. Every change Dominic confirms in the bot lands here.</p>;
  return (
    <ol className="history-list">
      {data.entries.map((e) => (
        <Entry key={e.changeSetId} entry={e} data={data} />
      ))}
    </ol>
  );
}

function statusWords(e: HistoryEntry): { word: string; when: string | null } {
  switch (e.status) {
    case 'confirmed':
      return { word: 'Saved', when: e.confirmedAt };
    case 'undone':
      return { word: 'Undone', when: e.undoneAt };
    case 'cancelled':
      return { word: 'Cancelled, nothing saved', when: e.cancelledAt };
    default:
      return { word: 'Waiting for Confirm', when: e.createdAt };
  }
}

function Entry({ entry, data }: { entry: HistoryEntry; data: HistoryData }) {
  const { today } = data;
  const st = statusWords(entry);
  const msg = entry.message;
  const source = msg ? (msg.transcript ?? msg.rawText) : null;
  const how = msg ? `${msg.transcript ? 'Voice note' : msg.channel === 'web' ? 'Setup' : 'Message'}${msg.channel === 'telegram' ? ' on Telegram' : ''}, ${formatStamp(msg.receivedAt)}` : null;
  const when = entry.confirmedAt ?? entry.createdAt;
  return (
    <li className={`entry entry-${entry.status}`} data-testid={`history-${entry.changeSetId}`} data-status={entry.status}>
      <div className="entry-when">
        <time className="entry-date" dateTime={when}>
          {formatDate(sydneyDate(when), today)}
        </time>
        <span className="entry-status" data-testid="status">
          {st.word}
        </span>
        {st.when && <span className="entry-time">{formatStamp(st.when).split(', ')[1]}</span>}
      </div>
      <div className="entry-body">
        <h2 className="entry-summary">{entry.summary}</h2>
        {entry.jobNames.length > 0 && <p className="entry-jobs">{entry.jobNames.join(', ')}</p>}
        {entry.changes.length > 0 && entry.status !== 'confirmed' && (
          <p className="fields-note">{entry.status === 'cancelled' ? 'Would have changed (not saved):' : entry.status === 'undone' ? 'Changed, then undone:' : 'Would change:'}</p>
        )}
        {entry.changes.length > MAX_FIELDS && (
          <ul className={entry.status === 'confirmed' ? 'fields' : 'fields fields-not-saved'} data-testid="fields">
            {groupedChanges(entry.changes).map((line) => (
              <li key={line} className="field">
                <span className="field-what">{line}</span>
              </li>
            ))}
          </ul>
        )}
        {entry.changes.length > 0 && entry.changes.length <= MAX_FIELDS && (
          <ul className={entry.status === 'confirmed' ? 'fields' : 'fields fields-not-saved'} data-testid="fields">
            {entry.changes.map((c, i) => (
              <li key={i} className="field">
                {c.kind === 'update' && c.field ? (
                  <>
                    <span className="field-what">
                      {c.rowLabel}, {fieldWords(c.field)}
                    </span>
                    <span className="field-ba">
                      <span className="field-before">{valueWords(c, c.before, today)}</span>
                      {' → '}
                      <span className="field-after">{valueWords(c, c.after, today)}</span>
                    </span>
                  </>
                ) : (
                  <span className="field-what">
                    {c.kind === 'insert' ? 'Added' : 'Removed'} {tableWords(c.table)}: {c.rowLabel}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <ForecastLine entry={entry} today={today} />
        {!source && msg?.channel === 'web' && (
          <p className="entry-jobs" data-testid="source-setup">
            Changed in Setup on the computer, {formatStamp(msg.receivedAt)}
          </p>
        )}
        {source && (
          <blockquote className="source" data-testid="source">
            <p>“{source}”</p>
            {how && <footer>{how}</footer>}
          </blockquote>
        )}
      </div>
    </li>
  );
}

function tableWords(t: string): string {
  return t.replace(/_/g, ' ');
}

/** Past this many field changes (a new job from a template adds hundreds of rows), they're counted, not listed. */
const MAX_FIELDS = 12;

const TABLE_PLURALS: Record<string, string> = { step_link: 'links between steps', requirement: 'needs', photo_category: 'photo categories' };

/** "Added 8 stages", "Added 29 steps", "Changed 5 steps" for a big change set. */
function groupedChanges(changes: HistoryEntry['changes']): string[] {
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

function ForecastLine({ entry, today }: { entry: HistoryEntry; today: string }) {
  if (entry.status !== 'confirmed') return null;
  // Confirming a job, a note or a photo never touches the program; say nothing.
  if (entry.changes.every((c) => c.field === 'lastConfirmed' || (c.kind === 'insert' && (c.table === 'daily_note' || c.table === 'photo')))) return null;
  if (!entry.effects.length) {
    return (
      <p className="effect-none" data-testid="forecast">
        Moved no forecast.
      </p>
    );
  }
  return (
    <ul className="effects" data-testid="forecast">
      {entry.effects.map((e) => (
        <li key={e.jobId} className="effect">
          {e.deltaDays !== 0 && e.finishBefore && e.finishAfter ? (
            <>
              <span className="effect-days">{formatDays(e.deltaDays)}</span>
              <span>
                {e.jobName} finish {formatDate(e.finishBefore, today)} → {formatDate(e.finishAfter, today)}
                {e.cost ? (
                  <>
                    , <Money amount={Math.abs(e.cost)} /> of holding cost{e.cost < 0 ? ' saved' : ''}
                  </>
                ) : null}
              </span>
            </>
          ) : (
            <span>
              Moved {plural(e.movedSteps, 'step')} at {e.jobName}, not the finish
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
