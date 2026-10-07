/**
 * Loading a Dataset (default: the core seed) into an empty SQLite database.
 */
import { rmSync } from 'node:fs';
import { buildEmptySeed, buildSeed, type Dataset } from '@ct/core';
import { LOAD_ORDER } from './schema.js';
import type { SqliteStore } from './sqliteStore.js';

export interface SeedOptions {
  /** Wipe existing rows first. Default false: seeding a non-empty database throws. */
  replace?: boolean;
}

/** Inserts every row of `dataset` in one transaction. Returns the number of rows written. */
export function seedDatabase(store: SqliteStore, dataset: Dataset = buildSeed(), opts: SeedOptions = {}): number {
  const db = store.db;
  return db.transaction(() => {
    if (!store.isEmpty()) {
      if (!opts.replace) throw new Error('Database already has data. Pass { replace: true } to wipe and reseed.');
      for (const spec of [...LOAD_ORDER].reverse()) db.prepare(`DELETE FROM "${spec.sql}"`).run();
    }
    let n = 0;
    for (const spec of LOAD_ORDER) {
      for (const row of dataset[spec.key] as unknown as Record<string, unknown>[]) {
        store.insertRow(spec, row);
        n++;
      }
    }
    return n;
  })();
}

/** The dataset for a seed kind: the demo jobs, or the empty start (template and trades, no jobs). */
export function seedDataset(kind: 'demo' | 'empty'): Dataset {
  return kind === 'empty' ? buildEmptySeed() : buildSeed();
}

/** Seeds only when the database is empty (first run). Returns true when it seeded. */
export function seedIfEmpty(store: SqliteStore, dataset: Dataset = buildSeed()): boolean {
  if (!store.isEmpty()) return false;
  seedDatabase(store, dataset);
  return true;
}

/** Deletes a database file and its WAL/SHM side files (for `npm run seed -- --reset`). Photos are left alone. */
export function removeDatabaseFile(file: string): void {
  for (const f of [file, `${file}-wal`, `${file}-shm`]) rmSync(f, { force: true });
}
