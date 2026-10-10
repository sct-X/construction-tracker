/**
 * Reminders for Dominic: act-by dates coming due and jobs not confirmed for over 7 days
 * (rule 7, sent in words only: "Beatty St: not confirmed for 9 days.", never "amber").
 *
 * computeReminders is pure (dataset + today in, reminders out). fireReminders
 * sends the ones not sent before through a Notifier and records them in
 * reminder_sent (migration 002) so each goes out once. The scheduler calls it
 * every minute after the reminder time; the bot calls it for "fire reminders".
 * With the bot running, the Notifier is the bot's Telegram notifier (Dominic's chat); otherwise the log.
 */
import { addCalendarDays, calendarDaysBetween, formatDate, freshnessFor, freshnessWords, mondayRows, relativeDays, sydneyDate, type Clock, type Dataset, type ISODate, type Job } from '@ct/core';
import type { Log } from './config.js';
import type { SqliteStore } from './sqliteStore.js';

/** Same window as the Monday screen's actByDue: to-do items with act-by on or before today + 7. */
export const ACT_BY_WINDOW_DAYS = 7;

/** `unconfirmed`: rule 7, a live job more than 7 days unconfirmed (or never confirmed). */
export type ReminderKind = 'act_by' | 'unconfirmed';

export interface Reminder {
  /** Dedup key: sent once per key. */
  key: string;
  kind: ReminderKind;
  jobId: string;
  jobName: string;
  itemId: string | null;
  /** The act-by date, or the first day the job counted as unconfirmed (8 days after it was confirmed). */
  dueOn: ISODate | null;
  /** One short plain-English line, dates like "Fri 18 Sep". */
  text: string;
  /** The same without the job name, for the digest under the job: "Book concrete pump. Act by Fri 18 Sep (tomorrow)." */
  line: string;
  /** An act-by already passed (shown first). */
  overdue: boolean;
  /**
   * Long past or still unconfirmed: sent again at most once a week while it applies (a dated key
   * `<key>:again-<YYYY-MM-DD>`), so it neither goes quiet after one mention nor comes back every day.
   */
  repeatWeekly: boolean;
}

/** The daily digest's longest body (job lines, item lines and the "+N more" line). */
export const DIGEST_MAX_LINES = 15;
/** Days between repeats of a long-past or unconfirmed reminder. */
export const REPEAT_EVERY_DAYS = 7;
/** Telegram's message limit. */
export const TELEGRAM_MAX_CHARS = 4096;

export interface Notification {
  /** The whole message as Dominic reads it. */
  text: string;
  reminders: Reminder[];
}

/** Where reminders go: Telegram when the bot runs (bot's createTelegramNotifier), else the log. */
export interface Notifier {
  send(n: Notification): Promise<void>;
}

export function logNotifier(log: Log): Notifier {
  return {
    async send(n) {
      log.info(`Reminder:\n${n.text}`);
    },
  };
}

/** A notifier that keeps what it was sent (tests, and the bot's fake transport). */
export function memoryNotifier(): Notifier & { sent: Notification[] } {
  const sent: Notification[] = [];
  return {
    sent,
    async send(n) {
      sent.push(n);
    },
  };
}

/**
 * Every reminder that applies today, sent or not. Act-by: to-do items on live
 * build jobs whose act-by is within 7 days ("soon") or has arrived ("due"); a
 * moved act-by is a new reminder. Unconfirmed: live jobs more than 7 days
 * unconfirmed (or never confirmed), once per lastConfirmed value.
 */
export function computeReminders(ds: Dataset, today: ISODate): Reminder[] {
  const view = mondayRows(ds, today);
  const out: Reminder[] = [];
  for (const row of view.builds) {
    for (const r of row.actByDue) {
      if (!r.actBy) continue;
      const stage = r.actBy <= today ? 'due' : 'soon';
      const when = relativeDays(r.actBy, today, { deadline: true });
      const line = `${r.title}. Act by ${formatDate(r.actBy, today)} (${when}).`;
      out.push({
        key: `actby:${r.itemId}:${r.actBy}:${stage}`,
        kind: 'act_by',
        jobId: row.jobId,
        jobName: row.name,
        itemId: r.itemId,
        dueOn: r.actBy,
        text: `${row.name}: ${line}`,
        line,
        overdue: r.actBy < today,
        repeatWeekly: stage === 'due',
      });
    }
  }
  // Builds then design jobs, in the Monday order. Rule 7 straight from the calculator's freshness.
  const jobIds = [...view.builds.map((b) => b.jobId), ...view.design.map((d) => d.jobId)];
  for (const jobId of jobIds) {
    const job = ds.jobs.find((j) => j.id === jobId);
    if (!job || !freshnessFor(job, today).amber) continue;
    out.push({
      // The key keeps its old "amber:" prefix so a reminder already sent isn't sent again.
      key: `amber:${job.id}:${job.lastConfirmed ?? 'never'}`,
      kind: 'unconfirmed',
      jobId: job.id,
      jobName: job.name,
      itemId: null,
      dueOn: job.lastConfirmed ? addCalendarDays(job.lastConfirmed, 8) : null,
      text: unconfirmedText(job, today),
      line: unconfirmedText(job, today).slice(job.name.length + 2),
      overdue: false,
      repeatWeekly: true,
    });
  }
  return out;
}

/** "Beatty St: not confirmed for 9 days. Check it and confirm the job." (or "never confirmed"). */
export function unconfirmedText(job: Job, today: ISODate): string {
  const words = freshnessWords(freshnessFor(job, today)); // the web's words: "Not confirmed for 9 days"
  return `${job.name}: ${words[0]!.toLowerCase()}${words.slice(1)}. Check it and confirm the job.`;
}

/**
 * The reminders as lines grouped by job: "<Job>:" (or "<Job>: not confirmed for 9 days. ...") then "- <item>"
 * lines. Overdue first: jobs with something overdue lead, overdue items lead within a job (earliest act-by
 * first), otherwise the input (Monday) order. With `maxLines`, what fits is picked overdue items first, then
 * unconfirmed jobs, then items coming up, and the last line is "+N more: /reminders for the full list";
 * `shown` is what made it in.
 */
export function digestLines(reminders: Reminder[], opts: { maxLines?: number; extraMore?: number } = {}): { lines: string[]; shown: Reminder[] } {
  const firstIndex = new Map<string, number>();
  reminders.forEach((r, i) => firstIndex.has(r.jobId) || firstIndex.set(r.jobId, i));
  const byDue = (a: Reminder, b: Reminder) => (a.dueOn ?? '').localeCompare(b.dueOn ?? '');
  const items = reminders.filter((r) => r.kind !== 'unconfirmed');
  const priority = [
    ...items.filter((r) => r.overdue).sort(byDue),
    ...reminders.filter((r) => r.kind === 'unconfirmed'),
    ...items.filter((r) => !r.overdue).sort(byDue),
  ];
  const groupsNeeded = new Set(reminders.map((r) => r.jobId)).size;
  const extra = opts.extraMore ?? 0;
  const max = opts.maxLines ?? Infinity;
  const budget = reminders.length + groupsNeeded - reminders.filter((r) => r.kind === 'unconfirmed').length <= max && !extra ? Infinity : max - 1;
  // Pick: an item costs its line plus its job's line when that job isn't in yet; an unconfirmed job is its job line.
  const picked = new Set<Reminder>();
  const jobsIn = new Set<string>();
  let used = 0;
  for (const r of priority) {
    const cost = (r.kind === 'unconfirmed' ? 0 : 1) + (jobsIn.has(r.jobId) ? 0 : 1);
    if (used + cost > budget) continue;
    used += cost;
    jobsIn.add(r.jobId);
    picked.add(r);
  }
  const shownList = reminders.filter((r) => picked.has(r));
  const groups = [...jobsIn]
    .map((jobId) => {
      const mine = shownList.filter((r) => r.jobId === jobId);
      const its = mine.filter((r) => r.kind !== 'unconfirmed').sort((a, b) => Number(b.overdue) - Number(a.overdue) || byDue(a, b));
      return { jobId, name: mine[0]!.jobName, unconfirmed: mine.find((r) => r.kind === 'unconfirmed') ?? null, items: its };
    })
    .sort((a, b) => Number(b.items.some((r) => r.overdue)) - Number(a.items.some((r) => r.overdue)) || firstIndex.get(a.jobId)! - firstIndex.get(b.jobId)!);
  const lines: string[] = [];
  const shown: Reminder[] = [];
  for (const g of groups) {
    lines.push(g.unconfirmed ? `${g.name}: ${g.unconfirmed.line}` : `${g.name}:`);
    if (g.unconfirmed) shown.push(g.unconfirmed);
    for (const r of g.items) {
      lines.push(`- ${r.line}`);
      shown.push(r);
    }
  }
  const more = reminders.length - shown.length + extra;
  if (more > 0) lines.push(`+${more} more: /reminders for the full list`);
  return { lines, shown };
}

/** The daily digest: a dated heading and at most DIGEST_MAX_LINES lines (see digestLines). */
export function reminderText(reminders: Reminder[], today: ISODate, opts: { maxLines?: number; extraMore?: number } = {}): string {
  const { lines } = digestLines(reminders, { maxLines: opts.maxLines ?? DIGEST_MAX_LINES, ...(opts.extraMore ? { extraMore: opts.extraMore } : {}) });
  return [`Reminders, ${formatDate(today, today)}:`, ...lines].join('\n');
}

/**
 * "/reminders" or "fire reminders" in the bot: every reminder that applies today, whether or not it went out
 * already, under a heading that says so, uncut (the bot splits it at Telegram's limit). Doesn't touch
 * reminder_sent, so the daily send is unchanged. Null when nothing is due.
 */
export function manualReminderText(ds: Dataset, today: ISODate): string | null {
  const all = computeReminders(ds, today);
  if (!all.length) return null;
  const { lines } = digestLines(all);
  return [`Reminders due now, ${formatDate(today, today)} (you asked, so this includes any already sent today):`, ...lines].join('\n');
}

export interface FireResult {
  /** Reminders sent now (empty when nothing new). */
  sent: Reminder[];
  /** Reminders that apply today but went out before. */
  alreadySent: number;
  /** The message sent, or null when nothing was sent. */
  text: string | null;
}

/** Keys already recorded in reminder_sent. */
export function sentReminderKeys(store: SqliteStore): Set<string> {
  return new Set((store.db.prepare('SELECT key FROM reminder_sent').all() as { key: string }[]).map((r) => r.key));
}

/**
 * Sends today's reminders that haven't gone out yet as ONE digest message (DIGEST_MAX_LINES lines at most;
 * the rest are left unsent, so they lead a later digest, and counted in "+N more"). A long-past act-by or an
 * unconfirmed job goes again at most once every REPEAT_EVERY_DAYS days after its first send (key
 * `<key>:again-<today>`). Each shown reminder is claimed in reminder_sent before sending (so two callers, or two
 * processes on the same file, never both send it) and released if the send fails, so it is retried on the
 * next run. Reads the current database, so missed send times go out on the next run after a restart.
 */
export async function fireReminders(store: SqliteStore, clock: Clock, notifier: Notifier): Promise<FireResult> {
  const today = clock.today();
  const all = computeReminders(store.load(), today);
  const sentAt = clock.now().toISOString();
  const insert = store.db.prepare(
    'INSERT OR IGNORE INTO reminder_sent (key, kind, job_id, item_id, due_on, text, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  const { claimed, eligible } = store.db.transaction(() => {
    const lastSent = lastSentDates(store);
    const eligible: Reminder[] = [];
    for (const r of all) {
      const last = lastSent.get(r.key);
      if (!last) eligible.push(r);
      else if (r.repeatWeekly && calendarDaysBetween(last, today) >= REPEAT_EVERY_DAYS) eligible.push({ ...r, key: `${r.key}:again-${today}` });
    }
    const { shown } = digestLines(eligible, { maxLines: DIGEST_MAX_LINES });
    const claimed = shown.filter((r) => insert.run(r.key, r.kind, r.jobId, r.itemId, r.dueOn, r.text, sentAt).changes === 1);
    return { claimed, eligible };
  })();
  if (!claimed.length) return { sent: [], alreadySent: all.length - eligible.length, text: null };
  const text = reminderText(claimed, today, { extraMore: eligible.length - claimed.length });
  try {
    await notifier.send({ text, reminders: claimed });
  } catch (e) {
    const release = store.db.prepare('DELETE FROM reminder_sent WHERE key = ?');
    store.db.transaction(() => claimed.forEach((r) => release.run(r.key)))();
    throw e;
  }
  return { sent: claimed, alreadySent: all.length - eligible.length, text };
}

/** Per base key, the Sydney date it last went out (the base key or any of its dated repeats `<key>:again-<date>`). */
function lastSentDates(store: SqliteStore): Map<string, ISODate> {
  const out = new Map<string, ISODate>();
  for (const row of store.db.prepare('SELECT key, sent_at FROM reminder_sent').all() as { key: string; sent_at: string }[]) {
    const base = row.key.replace(/:again-\d{4}-\d{2}-\d{2}$/, '');
    const date = sydneyDate(row.sent_at);
    const prev = out.get(base);
    if (!prev || date > prev) out.set(base, date);
  }
  return out;
}
