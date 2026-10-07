import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BEATTY,
  buildSeed,
  ChangeConflictError,
  DEFAULT_TODAY,
  fixedClock,
  forecastJob,
  InMemoryStore,
  makeSnapshot,
  mondayRows,
  PARK_RD,
  PARK_RD_WINDOWS,
  runOperation,
  whyItMoved,
  type Proposal,
} from '@ct/core';
import {
  dataPaths,
  ensureDataDirs,
  LOAD_ORDER,
  listMigrations,
  newPhotoPath,
  openDatabase,
  photoFile,
  resolveDataDir,
  seedDatabase,
  seedIfEmpty,
  SqliteStore,
  storedPhotoPath,
} from '../src/index.js';

const today = DEFAULT_TODAY;
const ctx = { today, now: new Date('2026-09-17T05:10:00.000Z') };

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ct-store-'));
  file = join(dir, 'tracker.db');
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function seeded(): SqliteStore {
  const store = new SqliteStore(file, { clock: fixedClock(today, '15:10') });
  seedDatabase(store);
  return store;
}

describe('migrations', () => {
  it('are numbered, run once, and use WAL', () => {
    const ms = listMigrations();
    expect(ms[0]!.name).toBe('001_init.sql');
    const db = openDatabase(file);
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    const applied = db.prepare('SELECT version FROM schema_migrations').all();
    expect(applied).toHaveLength(ms.length);
    db.close();
    const again = openDatabase(file); // no-op the second time
    expect(again.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get()).toEqual({ n: ms.length });
    again.close();
  });

  it('every mapped column exists in the schema', () => {
    const db = openDatabase(':memory:');
    for (const spec of LOAD_ORDER) {
      const cols = (db.prepare(`PRAGMA table_info("${spec.sql}")`).all() as { name: string }[]).map((c) => c.name);
      for (const c of spec.columns) expect(cols, `${spec.sql}.${c.column}`).toContain(c.column);
      expect(cols.length, spec.sql).toBe(spec.columns.length);
    }
    db.close();
  });
});

describe('SqliteStore', () => {
  it('round-trips the seed exactly', () => {
    const store = seeded();
    expect(store.load()).toEqual(buildSeed());
    expect(seedIfEmpty(store)).toBe(false);
    expect(() => seedDatabase(store)).toThrow(/already has data/);
    store.close();
    const reopened = new SqliteStore(file);
    expect(reopened.load()).toEqual(buildSeed());
    reopened.close();
  });

  it('gives the same seed numbers as the in-memory store', () => {
    const store = seeded();
    expect(mondayRows(store.load(), today)).toEqual(mondayRows(new InMemoryStore(buildSeed()).load(), today));
    store.close();
  });

  it('undo round trip: ETA 16 Nov -> Fri 12 Mar 2027 -> undo -> Fri 26 Feb 2027', () => {
    const store = seeded();
    const msg = store.recordInbound({ channel: 'telegram', sender: '42', rawText: 'Park Rd windows now arriving 16 Nov' });
    const p = runOperation(store.load(), 'set_shipment_eta', { shipment: 'windows', job: 'Park Rd', eta: '16 Nov' }, ctx) as Proposal;
    const cs = store.proposeChangeSet({ messageId: msg.id, summary: p.summary, opName: p.op, opArgs: p.args, changes: p.changes });
    expect(forecastJob(store.load(), PARK_RD, today).forecastFinish).toBe('2027-02-26');
    store.confirmChangeSet(cs.id);
    const after = store.load();
    expect(forecastJob(after, PARK_RD, today)).toMatchObject({ forecastFinish: '2027-03-12', slipDays: 14, slipCost: 9000 });
    expect(after.changeSets.find((c) => c.id === cs.id)).toMatchObject({ status: 'confirmed', opName: 'set_shipment_eta', opArgs: p.args });
    expect(after.changes.filter((c) => c.changeSetId === cs.id)).toEqual([
      expect.objectContaining({ kind: 'update', table: 'shipment', rowId: PARK_RD_WINDOWS, field: 'eta', before: '2026-10-26', after: '2026-11-16' }),
    ]);
    const why = whyItMoved(after, PARK_RD, today);
    expect(why.causes[0]).toMatchObject({ changeSetId: cs.id, sourceText: 'Park Rd windows now arriving 16 Nov', deltaDays: 14 });

    expect(store.undo(cs.id)).toMatchObject({ ok: true, changeSet: { status: 'undone' } });
    const back = store.load();
    expect(forecastJob(back, PARK_RD, today).forecastFinish).toBe('2027-02-26');
    // Everything but the log is back to the seed.
    const seed = buildSeed();
    expect(back.shipments).toEqual(seed.shipments);
    expect(back.items).toEqual(seed.items);
    store.close();
  });

  it('inserts and deletes undo too (copy a template, then undo it)', () => {
    const store = seeded();
    const p = runOperation(store.load(), 'copy_template', { template: 'Duplex', name: 'Smith St', startDate: '2027-02-01' }, ctx) as Proposal;
    const cs = store.applyChangeSet({ summary: p.summary, opName: p.op, opArgs: p.args, changes: p.changes });
    expect(store.load().steps.length).toBe(buildSeed().steps.length + 29);
    expect(store.undo(cs.id).ok).toBe(true);
    const back = store.load();
    const seed = buildSeed();
    for (const key of ['jobs', 'stages', 'steps', 'stepLinks', 'requirements', 'photoCategories'] as const) expect(back[key]).toEqual(seed[key]);
    store.close();
  });

  it('stale proposals conflict and roll back; cancel records only', () => {
    const store = seeded();
    const ds = store.load();
    const a = runOperation(ds, 'set_shipment_eta', { shipment: PARK_RD_WINDOWS, eta: '16 Nov' }, ctx) as Proposal;
    const b = runOperation(ds, 'set_shipment_eta', { shipment: PARK_RD_WINDOWS, eta: '23 Nov' }, ctx) as Proposal;
    const csA = store.proposeChangeSet({ summary: a.summary, changes: a.changes });
    const csB = store.proposeChangeSet({ summary: b.summary, changes: b.changes });
    store.confirmChangeSet(csA.id);
    expect(() => store.confirmChangeSet(csB.id)).toThrow(ChangeConflictError);
    expect(store.load().changeSets.find((c) => c.id === csB.id)!.status).toBe('proposed');
    expect(store.cancelChangeSet(csB.id).status).toBe('cancelled');
    expect(store.load().shipments.find((s) => s.id === PARK_RD_WINDOWS)!.eta).toBe('2026-11-16');
    store.close();
  });

  it('undoes the seeded Beatty change; saves snapshots idempotently; updates inbound', () => {
    const store = seeded();
    expect(store.undo('cs-0915-tiler').ok).toBe(true);
    expect(forecastJob(store.load(), BEATTY, today).forecastFinish).toBe('2026-11-27');
    const snap = makeSnapshot(store.load(), PARK_RD, '2026-09-21', '2026-09-20T20:00:00.000Z', 'snap-a');
    store.saveSnapshot(snap);
    store.saveSnapshot({ ...snap, id: 'snap-b' });
    const snaps = store.load().snapshots.filter((s) => s.jobId === PARK_RD && s.date === '2026-09-21');
    expect(snaps).toHaveLength(1);
    expect(snaps[0]!.id).toBe('snap-b');
    expect(snaps[0]!.stepEnds['pr-handover']).toBe('2027-02-26');
    const m = store.recordInbound({ channel: 'telegram', sender: '42', audioPath: 'audio/x.ogg' });
    expect(store.updateInbound(m.id, { transcript: 'slab inspection at Seaview is done' }).transcript).toBe('slab inspection at Seaview is done');
    store.close();
  });
});

describe('paths', () => {
  it('DATA_DIR resolves relative to cwd, photos stay inside their folder', () => {
    const base = resolveDataDir({ DATA_DIR: 'my-data' }, dir);
    expect(base).toBe(join(dir, 'my-data'));
    expect(resolveDataDir({}, dir)).toBe(join(dir, 'data'));
    const paths = ensureDataDirs(dataPaths(base));
    expect(paths.dbFile).toBe(join(base, 'tracker.db'));
    const stored = newPhotoPath('park-rd', '2026-09-17', 'photo-1');
    expect(stored).toBe('park-rd/2026-09-17-photo-1.jpg');
    const abs = photoFile(paths, stored);
    expect(abs).toBe(join(paths.photosDir, 'park-rd', '2026-09-17-photo-1.jpg'));
    expect(storedPhotoPath(paths, abs)).toBe(stored);
    expect(() => photoFile(paths, '../tracker.db')).toThrow();
  });
});
