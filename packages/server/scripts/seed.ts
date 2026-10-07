/**
 * npm run seed            -> seeds DATA_DIR's database if it is empty
 * npm run seed -- --reset -> deletes the database file and recreates it from the seed (photos are kept)
 */
import { consoleLog, dataPaths, ensureDataDirs, loadEnvFile, removeDatabaseFile, resolveDataDir, seedDatabase, SqliteStore } from '../src/index.js';

const log = consoleLog('seed');
loadEnvFile();
const reset = process.argv.slice(2).includes('--reset');
const paths = ensureDataDirs(dataPaths(resolveDataDir()));

if (reset) removeDatabaseFile(paths.dbFile);
const store = new SqliteStore(paths.dbFile);
try {
  if (!store.isEmpty()) {
    log.info(`${paths.dbFile} already has data. Run "npm run seed -- --reset" to wipe it and start again from the seed.`);
  } else {
    const rows = seedDatabase(store);
    log.info(`${reset ? 'Recreated' : 'Seeded'} ${paths.dbFile} (${rows} rows).`);
  }
} finally {
  store.close();
}
