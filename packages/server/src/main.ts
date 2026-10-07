/**
 * Entry point for `npm start`: loads .env, opens (and migrates) the SQLite
 * file, seeds an empty database, starts the API and the scheduler. Stage 2
 * starts the bot in the same process (see the hook in app.ts).
 */
import { consoleLog, loadConfig, loadEnvFile } from './config.js';
import { startApp } from './app.js';

async function main(): Promise<void> {
  const log = consoleLog();
  const envFile = loadEnvFile();
  if (envFile) log.info(`Loaded ${envFile}`);
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
