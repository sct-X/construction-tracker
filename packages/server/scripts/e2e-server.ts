/**
 * npm run e2e:server: the local stack for Playwright's local-API mode.
 * A fresh DATA_DIR (default <os tmp>/ct-e2e-<port>, wiped on every start),
 * seeded, CT_TODAY 2026-09-17, PORT 4310, serving packages/web/dist (build it
 * in API mode first). No scheduler side effects beyond the log.
 *
 * A test can change data mid-run with the same DATA_DIR and CT_TODAY:
 *   DATA_DIR=<that dir> CT_TODAY=2026-09-17 npm run apply-op -- set_shipment_eta '{"shipment":"windows","job":"Park Rd","eta":"16 Nov"}'
 * E2E_DATA_DIR / E2E_PORT / E2E_TODAY override the defaults.
 */
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { e2eDataDir, E2E_DEFAULT_PORT, E2E_DEFAULT_TODAY } from '../src/e2e.js';
import { consoleLog, loadConfig, startApp } from '../src/index.js';

const port = Number(process.env.E2E_PORT || E2E_DEFAULT_PORT);
const dataDir = process.env.E2E_DATA_DIR || e2eDataDir(port, tmpdir());
const today = process.env.E2E_TODAY || E2E_DEFAULT_TODAY;

rmSync(dataDir, { recursive: true, force: true });
const log = consoleLog('e2e');
const config = loadConfig({ ...process.env, DATA_DIR: dataDir, CT_TODAY: today, PORT: String(port), HOST: process.env.HOST || '127.0.0.1' });
const app = await startApp(config, { log });
log.info(`e2e server ready: ${app.url}, DATA_DIR=${dataDir}, CT_TODAY=${today}`);

const stop = () => void app.stop().then(() => process.exit(0));
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
