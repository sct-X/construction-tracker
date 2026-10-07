/**
 * npm run seed                     -> seeds DATA_DIR's database if it is empty (SEED in .env picks demo or empty)
 * npm run seed -- --reset          -> deletes the database file and recreates it from the demo seed (photos are kept)
 * npm run seed -- --reset --empty  -> the same, but the going-live start: sides, Dominic, the duplex template and
 *                                     the trades; no jobs, items, shipments, notes, photos or change log
 */
import { consoleLog, dataPaths, ensureDataDirs, loadEnvFile, removeDatabaseFile, resolveDataDir, seedDatabase, seedDataset, seedKindFromEnv, SqliteStore } from '../src/index.js';

const log = consoleLog('seed');
loadEnvFile();
const argv = process.argv.slice(2);
const reset = argv.includes('--reset');
const kind = argv.includes('--empty') ? 'empty' : argv.includes('--demo') ? 'demo' : seedKindFromEnv();
const paths = ensureDataDirs(dataPaths(resolveDataDir()));

if (reset) removeDatabaseFile(paths.dbFile);
const store = new SqliteStore(paths.dbFile);
try {
  if (!store.isEmpty()) {
    log.info(`${paths.dbFile} already has data. Run "npm run seed -- --reset" to wipe it and start again from the seed.`);
  } else {
    const rows = seedDatabase(store, seedDataset(kind));
    const what = kind === 'empty' ? ' with no jobs (sides, the duplex template and the trades)' : ' from the demo seed';
    log.info(`${reset ? 'Recreated' : 'Seeded'} ${paths.dbFile}${what} (${rows} rows).`);
  }
} finally {
  store.close();
}
