/**
 * Reminders for Dominic: act-by dates coming due and jobs going amber.
 *
 * computeReminders is pure (dataset + today in, reminders out). fireReminders
 * sends the ones not sent before through a Notifier and records them in
 * reminder_sent (migration 002) so each goes out once. The scheduler calls it
 * every minute after the reminder time; the bot calls it for "fire reminders".
 * With the bot running, the Notifier is the bot's Telegram notifier (Dominic's chat); otherwise the log.
 */
import { addCalendarDays, formatDate, mondayRows, relativeDays, type Clock, type Dataset, type ISODate } from '@ct/core';
import type { Log } from './config.js';
import type { SqliteStore } from './sqliteStore.js';

/** Same window as the Monday screen's actByDue: to-do items with act-by on or before today + 7. */
export const ACT_BY_WINDOW_DAYS = 7;

export type ReminderKind = 'act_by' | 'amber';

export interface Reminder {
  /** Dedup key: sent once per key. */
  key: string;
  kind: ReminderKind;
  jobId: string;
  jobName: string;
  itemId: string | null;
  /** The act-by date, or the date the job went amber. */
  dueOn: ISODate | null;
  /** One short plain-English line, dates like "Fri 18 Sep". */
  text: string;
}

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
 * moved act-by is a new reminder. Amber: live jobs more than 7 days
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
      out.push({
        key: `actby:${r.itemId}:${r.actBy}:${stage}`,
        kind: 'act_by',
        jobId: row.jobId,
        jobName: row.name,
        itemId: r.itemId,
        dueOn: r.actBy,
        text: `${row.name}: ${r.title}. Act by ${formatDate(r.actBy, today)} (${when}).`,
      });
    }
  }
  const amberRows = [
    ...view.builds.map((b) => ({ jobId: b.jobId, name: b.name, amber: b.amber, freshnessText: b.freshnessText })),
    ...view.design.map((d) => ({ jobId: d.jobId, name: d.name, amber: d.amber, freshnessText: d.freshnessText })),
  ];
  for (const row of amberRows) {
    if (!row.amber) continue;
    const job = ds.jobs.find((j) => j.id === row.jobId)!;
    const wentAmber = job.lastConfirmed ? addCalendarDays(job.lastConfirmed, 8) : null;
    out.push({
      key: `amber:${job.id}:${job.lastConfirmed ?? 'never'}`,
      kind: 'amber',
      jobId: job.id,
      jobName: job.name,
      itemId: null,
      dueOn: wentAmber,
      text: `${job.name} is amber: ${lowerFirst(row.freshnessText)}. Check it and confirm the job.`,
    });
  }
  return out;
}

function lowerFirst(s: string): string {
  return s ? s[0]!.toLowerCase() + s.slice(1) : s;
}

/** The message text: one line per reminder under a dated heading. */
export function reminderText(reminders: Reminder[], today: ISODate): string {
  const lines = [...reminders.filter((r) => r.kind === 'act_by'), ...reminders.filter((r) => r.kind === 'amber')].map((r) => `- ${r.text}`);
  return [`Reminders, ${formatDate(today, today)}:`, ...lines].join('\n');
}

/**
 * "/reminders" or "fire reminders" in the bot: every reminder that applies today, whether or not it went out
 * already, under a heading that says so. Doesn't touch reminder_sent, so the daily send is unchanged.
 * Null when nothing is due.
 */
export function manualReminderText(ds: Dataset, today: ISODate): string | null {
  const all = computeReminders(ds, today);
  if (!all.length) return null;
  const lines = reminderText(all, today).split('\n').slice(1);
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
 * Sends today's reminders that haven't gone out yet, as one message. Each is
 * claimed in reminder_sent before sending (so two callers, or two processes on
 * the same file, never both send it) and released if the send fails, so it is
 * retried on the next run. Reads the current database, so missed send times
 * go out on the next run after a restart.
 */
export async function fireReminders(store: SqliteStore, clock: Clock, notifier: Notifier): Promise<FireResult> {
  const today = clock.today();
  const all = computeReminders(store.load(), today);
  const sentAt = clock.now().toISOString();
  const insert = store.db.prepare(
    'INSERT OR IGNORE INTO reminder_sent (key, kind, job_id, item_id, due_on, text, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  const claimed = store.db.transaction(() =>
    all.filter((r) => insert.run(r.key, r.kind, r.jobId, r.itemId, r.dueOn, r.text, sentAt).changes === 1),
  )();
  if (!claimed.length) return { sent: [], alreadySent: all.length, text: null };
  const text = reminderText(claimed, today);
  try {
    await notifier.send({ text, reminders: claimed });
  } catch (e) {
    const release = store.db.prepare('DELETE FROM reminder_sent WHERE key = ?');
    store.db.transaction(() => claimed.forEach((r) => release.run(r.key)))();
    throw e;
  }
  return { sent: claimed, alreadySent: all.length - claimed.length, text };
}
