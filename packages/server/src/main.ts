/**
 * Entry point for `npm start`: loads .env, opens (and migrates) the SQLite
 * file, seeds an empty database, starts the API and the scheduler. Stage 2
 * starts the bot in the same process (see the hook in app.ts).
 */
import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net';
import { connectAttemptMsFromEnv, consoleLog, loadConfig, loadEnvFile } from './config.js';
import { startApp } from './app.js';

async function main(): Promise<void> {
  const log = consoleLog();
  const envFile = loadEnvFile();
  if (envFile) log.info(`Loaded ${envFile}`);
  // Before anything connects: give each IPv6/IPv4 attempt longer than Node's
  // 250 ms, so Telegram (long polling and sends) and the model/transcriber
  // fetches work where IPv6 is dead and IPv4 is slow. grammY's node-fetch and
  // native fetch both read this default.
  setDefaultAutoSelectFamilyAttemptTimeout(connectAttemptMsFromEnv());
  const app = await startApp(loadConfig(), { log });

  const shutdown = (signal: string) => {
    log.info(`${signal}: stopping`);
    app.stop().then(
      () => process.exit(0),
      (e) => {
        log.error('Stopping failed', e);
        process.exit(1);
      },
    );
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((e) => {
  console.error(e instanceof Error ? (e.stack ?? e.message) : e);
  process.exit(1);
});
