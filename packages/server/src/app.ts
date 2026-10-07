/**
 * The whole local stack in one process: SQLite store, HTTP API, scheduler,
 * and (Stage 2) the Telegram bot, all sharing one store and one clock.
 */
import type { FastifyInstance } from 'fastify';
import { clockFromOverride, type Clock } from '@ct/core';
import { consoleLog, type Log, type ServerConfig } from './config.js';
import { buildServer } from './http.js';
import { ensureDataDirs } from './paths.js';
import { logNotifier, type Notifier } from './reminders.js';
import { startScheduler, type Scheduler } from './scheduler.js';
import { seedIfEmpty } from './seed.js';
import { SqliteStore } from './sqliteStore.js';

export interface RunningApp {
  store: SqliteStore;
  clock: Clock;
  server: FastifyInstance;
  scheduler: Scheduler;
  notifier: Notifier;
  /** "http://127.0.0.1:8787" */
  url: string;
  stop(): Promise<void>;
}

export interface StartOptions {
  log?: Log;
  /** Default: log notifier. Stage 3 passes the Telegram notifier. */
  notifier?: Notifier;
  /** Default: from config.todayOverride (CT_TODAY), else the Sydney system clock. */
  clock?: Clock;
  /** Default true. */
  scheduler?: boolean;
}

export async function startApp(config: ServerConfig, opts: StartOptions = {}): Promise<RunningApp> {
  const log = opts.log ?? consoleLog();
  const clock = opts.clock ?? clockFromOverride(config.todayOverride);
  ensureDataDirs(config.paths);

  // Opening the store runs any migration not yet applied.
  const store = new SqliteStore(config.paths.dbFile, { clock });
  if (seedIfEmpty(store)) log.info(`New database: loaded the seed into ${config.paths.dbFile}`);
  log.info(`Data: ${config.paths.dataDir}; today is ${clock.today()}${config.todayOverride ? ' (CT_TODAY override)' : ' (Sydney)'}`);

  const server = await buildServer({ store, clock, paths: config.paths, webDist: config.webDist, log });
  await server.listen({ host: config.host, port: config.port });
  const addr = server.server.address();
  const port = addr && typeof addr === 'object' ? addr.port : config.port;
  const url = `http://${config.host.includes(':') ? `[${config.host}]` : config.host}:${port}`;
  log.info(`API on ${url} (web app from ${config.webDist})`);

  const notifier = opts.notifier ?? logNotifier(log);
  const scheduler =
    opts.scheduler === false
      ? { tick: async () => ({ snapshots: [], reminders: null }), start() {}, stop() {} }
      : startScheduler({ store, clock, notifier, log, reminderTime: config.reminderTime });

  // ---------------------------------------------------------------------------
  // STAGE 2 HOOK: start the Telegram bot here, in this process, over the same
  // `store` and `clock`, e.g.
  //   const bot = await startBot({ store, clock, log, env: process.env });
  // and stop it in stop() below. Stage 3 swaps `notifier` for the bot's
  // Telegram notifier so the scheduler's reminders go to Dominic.
  // ---------------------------------------------------------------------------

  let stopped = false;
  return {
    store,
    clock,
    server,
    scheduler,
    notifier,
    url,
    async stop() {
      if (stopped) return;
      stopped = true;
      scheduler.stop();
      await server.close();
      store.close();
    },
  };
}
