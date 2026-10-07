/**
 * Opening the SQLite file (WAL mode, foreign keys on) and running numbered
 * migrations from packages/server/migrations (001_init.sql, 002_...).
 */
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

export type Db = Database.Database;

/** The migrations folder, from src (tests) or dist (built) alike. */
export const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations', import.meta.url));

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export function listMigrations(dir = MIGRATIONS_DIR): Migration[] {
  return readdirSync(dir)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .map((f) => ({ version: Number(f.split('_')[0]), name: f, sql: readFileSync(join(dir, f), 'utf8') }))
    .sort((a, b) => a.version - b.version);
}

/** Applies every migration not yet recorded in schema_migrations, each in its own transaction. Returns those applied. */
export function migrate(db: Db, dir = MIGRATIONS_DIR): Migration[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`);
  const done = new Set((db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map((r) => r.version));
  const applied: Migration[] = [];
  const seen = new Set<number>();
  for (const m of listMigrations(dir)) {
    if (seen.has(m.version)) throw new Error(`Two migrations numbered ${m.version}`);
    seen.add(m.version);
    if (done.has(m.version)) continue;
    db.transaction(() => {
      db.exec(m.sql);
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(m.version, m.name, new Date().toISOString());
    })();
    applied.push(m);
  }
  return applied;
}

/** Opens (creating the folder if needed) and migrates a database file. Use ':memory:' for a throwaway one. */
export function openDatabase(file: string): Db {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrate(db);
  return db;
}
