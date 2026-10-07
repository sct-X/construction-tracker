/**
 * The whole local stack in one process: SQLite store, HTTP API, scheduler,
 * and (Stage 2) the Telegram bot, all sharing one store and one clock.
 */
import type { FastifyInstance } from 'fastify';
import type { RunningBot } from '@ct/bot';
import { clockFromOverride, type Clock } from '@ct/core';
import { consoleLog, type Log, type ServerConfig } from './config.js';
import { buildServer } from './http.js';
import { ensureDataDirs } from './paths.js';
import { logNotifier, manualReminderText, type Notifier } from './reminders.js';
import { startScheduler, type Scheduler, type TickResult } from './scheduler.js';
import { seedDataset, seedIfEmpty } from './seed.js';
import { SqliteStore } from './sqliteStore.js';

export interface RunningApp {
  store: SqliteStore;
  clock: Clock;
  server: FastifyInstance;
  scheduler: Scheduler;
  /** The scheduler's first pass (snapshot catch-up, missed reminders), or null when the scheduler is off. */
  firstTick: Promise<TickResult> | null;
  notifier: Notifier;
  /** The Telegram bot (long polling), or null when it is off (no TELEGRAM_BOT_TOKEN etc.). */
  bot: RunningBot | null;
  /** "http://127.0.0.1:8787" */
  url: string;
  stop(): Promise<void>;
}

export interface StartOptions {
  log?: Log;
  /** Default: the bot's Telegram notifier when the bot runs, else the log. */
  notifier?: Notifier;
  /** Default: from config.todayOverride (CT_TODAY), else the Sydney system clock. */
  clock?: Clock;
  /** Default true. */
  scheduler?: boolean;
  /** Where the bot reads TELEGRAM_BOT_TOKEN, DOMINIC_TELEGRAM_USER_ID and the LLM settings. Default process.env. */
  env?: Record<string, string | undefined>;
  /** Default true: start the bot when TELEGRAM_BOT_TOKEN is set. */
  bot?: boolean;
}

export async function startApp(config: ServerConfig, opts: StartOptions = {}): Promise<RunningApp> {
  const log = opts.log ?? consoleLog();
  const clock = opts.clock ?? clockFromOverride(config.todayOverride);
  ensureDataDirs(config.paths);

  // Opening the store runs any migration not yet applied.
  const store = new SqliteStore(config.paths.dbFile, { clock });
  if (seedIfEmpty(store, seedDataset(config.seed))) {
    log.info(
      config.seed === 'empty'
        ? `New database (SEED=empty): sides, the duplex template and the trades, no jobs, in ${config.paths.dbFile}`
        : `New database: loaded the seed into ${config.paths.dbFile}`,
    );
  }
  log.info(`Data: ${config.paths.dataDir}; today is ${clock.today()}${config.todayOverride ? ' (CT_TODAY override)' : ' (Sydney)'}`);

  const server = await buildServer({ store, clock, paths: config.paths, webDist: config.webDist, log, allowedHosts: config.allowedHosts });
  await server.listen({ host: config.host, port: config.port });
  const addr = server.server.address();
  const port = addr && typeof addr === 'object' ? addr.port : config.port;
  const url = `http://${config.host.includes(':') ? `[${config.host}]` : config.host}:${port}`;
  log.info(`API on ${url} (web app from ${config.webDist})`);

  // The Telegram bot, in this process, over the same store and clock (long
  // polling: nothing is exposed to the internet). Off, with a log line, when
  // TELEGRAM_BOT_TOKEN / DOMINIC_TELEGRAM_USER_ID / the LLM key are not set.
  // Loaded only when a token is set, so a bot-less run never loads grammY or
  // the LLM layer. Started before the scheduler so reminders go to Telegram.
  const env = opts.env ?? process.env;
  let bot: RunningBot | null = null;
  if (opts.bot === false) log.info('Telegram bot off (disabled for this run).');
  else if (!env.TELEGRAM_BOT_TOKEN?.trim()) log.info('Telegram bot off: TELEGRAM_BOT_TOKEN is not set.');
  else {
    bot = await (await import('@ct/bot')).startBot({
      store,
      clock,
      log,
      env,
      dataDir: config.paths.dataDir,
      // "/reminders" / "fire reminders": what's due now, ignoring the daily dedup (labelled as such).
      remindersNow: async () => manualReminderText(store.load(), clock.today()),
    });
  }

  const notifier = opts.notifier ?? bot?.notifier ?? logNotifier(log);
  if (bot && !opts.notifier) log.info(`Reminders go to Dominic on Telegram from ${config.reminderTime} Sydney.`);
  const started = opts.scheduler === false ? null : startScheduler({ store, clock, notifier, log, reminderTime: config.reminderTime });
  const scheduler: Scheduler = started ?? { tick: async () => ({ snapshots: [], reminders: null }), start() {}, stop() {} };

  let stopped = false;
  return {
    store,
    clock,
    server,
    scheduler,
    firstTick: started?.firstTick ?? null,
    notifier,
    bot,
    url,
    async stop() {
      if (stopped) return;
      stopped = true;
      scheduler.stop();
      await bot?.stop();
      await server.close();
      store.close();
    },
  };
}
