/**
 * The one in-process scheduler (no cron, no OS scheduler). Ticks every
 * minute in Australia/Sydney:
 *  - Monday snapshot: every live build job gets a forecast_snapshot for this
 *    week's Monday. Runs on every tick, so a missed Monday (server off) is
 *    caught up on the next start; the upsert on (job, date) makes it idempotent.
 *  - Reminders: from the reminder time (default 07:00 Sydney) on, fires any
 *    reminder not sent yet (dedup in reminder_sent), so missed send times go
 *    out on restart.
 */
import { lastMonday, makeSnapshot, sydneyTime, type Clock, type ForecastSnapshot } from '@ct/core';
import { DEFAULT_REMINDER_TIME, type Log } from './config.js';
import { fireReminders, type FireResult, type Notifier } from './reminders.js';
import type { SqliteStore } from './sqliteStore.js';

/** Saves this week's Monday snapshot for every live build job that hasn't got one. Returns those saved. */
export function ensureMondaySnapshots(store: SqliteStore, clock: Clock): ForecastSnapshot[] {
  const today = clock.today();
  const monday = lastMonday(today);
  const ds = store.load();
  const have = new Set(ds.snapshots.filter((s) => s.date === monday).map((s) => s.jobId));
  const saved: ForecastSnapshot[] = [];
  for (const job of ds.jobs) {
    if (job.isTemplate || job.kind !== 'build' || have.has(job.id)) continue;
    const snap = makeSnapshot(ds, job.id, today, clock.now().toISOString(), `snap-${job.id}-${monday}`);
    saved.push(store.saveSnapshot(snap));
  }
  return saved;
}

/** Minutes to wait after the n-th failed reminder send in a row: 2, 4, 8, 16, 32, then 60. */
export function reminderRetryMinutes(failures: number): number {
  return Math.min(60, 2 ** Math.max(1, failures));
}

export interface SchedulerOptions {
  store: SqliteStore;
  clock: Clock;
  notifier: Notifier;
  log: Log;
  /** Sydney "HH:mm" from which reminders go out. Default 07:00. */
  reminderTime?: string;
  /** Default 60 000 (one minute). */
  intervalMs?: number;
}

export interface TickResult {
  snapshots: ForecastSnapshot[];
  reminders: FireResult | null;
}

export interface Scheduler {
  /** One pass now (also what the timer runs). Never throws; failures are logged. */
  tick(): Promise<TickResult>;
  /** Start ticking every interval. */
  start(): void;
  stop(): void;
}

export function createScheduler(opts: SchedulerOptions): Scheduler {
  const { store, clock, notifier, log } = opts;
  const reminderTime = opts.reminderTime ?? DEFAULT_REMINDER_TIME;
  let running: Promise<TickResult> | null = null;
  let timer: NodeJS.Timeout | null = null;
  // Back-off after failed sends (Telegram down, bad token, bot blocked): 2, 4, 8, 16, 32, then every 60 min,
  // instead of a retry and an error line every minute. A success resets it.
  let failures = 0;
  let retryAt = 0;

  async function pass(): Promise<TickResult> {
    const out: TickResult = { snapshots: [], reminders: null };
    try {
      out.snapshots = ensureMondaySnapshots(store, clock);
      for (const s of out.snapshots) log.info(`Saved Monday snapshot for ${s.jobId} (${s.date}): finish ${s.forecastFinish ?? 'none'}`);
    } catch (e) {
      log.error('Monday snapshot failed', e);
    }
    const now = clock.now();
    try {
      if (sydneyTime(now) >= reminderTime && now.getTime() >= retryAt) {
        out.reminders = await fireReminders(store, clock, notifier);
        if (out.reminders.sent.length) log.info(`Sent ${out.reminders.sent.length} reminder(s)`);
        failures = 0;
        retryAt = 0;
      }
    } catch (e) {
      failures += 1;
      const minutes = reminderRetryMinutes(failures);
      retryAt = now.getTime() + minutes * 60_000;
      log.error(`Sending reminders failed (attempt ${failures}; will retry in ${minutes} min)`, e);
    }
    return out;
  }

  const tick = (): Promise<TickResult> => {
    // Never overlap: a slow notifier just delays the next pass.
    if (!running) running = pass().finally(() => (running = null));
    return running;
  };

  return {
    tick,
    start() {
      if (timer) return;
      timer = setInterval(() => void tick(), opts.intervalMs ?? 60_000);
      timer.unref();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}

/** Creates the scheduler, runs a first pass now (catch-up), then ticks every minute. */
export function startScheduler(opts: SchedulerOptions): Scheduler & { firstTick: Promise<TickResult> } {
  const s = createScheduler(opts);
  const firstTick = s.tick();
  s.start();
  return Object.assign(s, { firstTick });
}
