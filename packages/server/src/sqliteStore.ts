/**
 * SqliteStore: the Store interface over better-sqlite3. Every write runs in
 * one transaction; changes are validated against the current data with the
 * same core functions the InMemoryStore uses, then written as SQL.
 */
import {
  applyChanges,
  changesOf,
  defaultNewId,
  emptyDataset,
  invertChanges,
  systemClock,
  toChangeRecord,
  undoBlocker,
  type Change,
  type ChangeSet,
  type Clock,
  type Dataset,
  type ForecastSnapshot,
  type InboundMessage,
  type NewChangeSet,
  type NewInbound,
  type Store,
  type StoreOptions,
  type UndoResult,
} from '@ct/core';
import { openDatabase, type Db } from './db.js';
import { columnOf, LOAD_ORDER, LOG_TABLES, quote, rowFromSql, TABLES, toSql, type TableSpec } from './schema.js';

export class SqliteStore implements Store {
  readonly db: Db;
  private readonly clock: Clock;
  private readonly newId: (prefix: string) => string;

  /** Pass a file path (migrated on open) or an already-open, migrated database. */
  constructor(fileOrDb: string | Db, opts: StoreOptions = {}) {
    this.db = typeof fileOrDb === 'string' ? openDatabase(fileOrDb) : fileOrDb;
    this.clock = opts.clock ?? systemClock();
    this.newId = opts.newId ?? defaultNewId;
  }

  close(): void {
    this.db.close();
  }

  private stamp(): string {
    return this.clock.now().toISOString();
  }

  // -- reading --------------------------------------------------------------

  load(): Dataset {
    const ds = emptyDataset() as unknown as Record<string, unknown[]>;
    for (const spec of LOAD_ORDER) {
      const rows = this.db.prepare(`SELECT * FROM ${quote(spec.sql)} ORDER BY rowid`).all() as Record<string, unknown>[];
      ds[spec.key] = rows.map((r) => rowFromSql(spec, r));
    }
    return ds as unknown as Dataset;
  }

  /** True when the database has no jobs and no sides (fresh file). */
  isEmpty(): boolean {
    const n = this.db.prepare('SELECT (SELECT COUNT(*) FROM side) + (SELECT COUNT(*) FROM job) AS n').get() as { n: number };
    return n.n === 0;
  }

  // -- low-level writes -----------------------------------------------------

  insertRow(spec: TableSpec, row: Record<string, unknown>): void {
    const cols = spec.columns;
    const sql = `INSERT INTO ${quote(spec.sql)} (${cols.map((c) => quote(c.column)).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
    this.db.prepare(sql).run(...cols.map((c) => toSql(row[c.field], c.type)));
  }

  private writeChange(c: Change): void {
    const spec = TABLES[c.table];
    if (!spec) throw new Error(`Unknown table ${c.table}`);
    if (c.kind === 'update') {
      const col = columnOf(spec, c.field);
      const r = this.db.prepare(`UPDATE ${quote(spec.sql)} SET ${quote(col.column)} = ? WHERE id = ?`).run(toSql(c.after, col.type), c.rowId);
      if (r.changes !== 1) throw new Error(`${c.table} ${c.rowId} not found`);
    } else if (c.kind === 'insert') {
      this.insertRow(spec, c.row);
    } else {
      const r = this.db.prepare(`DELETE FROM ${quote(spec.sql)} WHERE id = ?`).run(c.rowId);
      if (r.changes !== 1) throw new Error(`${c.table} ${c.rowId} not found`);
    }
  }

  private recordChangeSet(input: NewChangeSet, status: 'proposed' | 'confirmed'): ChangeSet {
    const now = this.stamp();
    const cs: ChangeSet = {
      id: this.newId('cs'),
      messageId: input.messageId ?? null,
      status,
      summary: input.summary,
      opName: input.opName ?? null,
      opArgs: input.opArgs ?? null,
      createdAt: now,
      confirmedAt: status === 'confirmed' ? now : null,
      cancelledAt: null,
      undoneAt: null,
    };
    this.insertRow(LOG_TABLES.changeSet, cs as unknown as Record<string, unknown>);
    input.changes.forEach((c, i) => {
      this.insertRow(LOG_TABLES.change, toChangeRecord(c, cs.id, i + 1, this.newId('chg')) as unknown as Record<string, unknown>);
    });
    return cs;
  }

  private getChangeSet(id: string): ChangeSet {
    const raw = this.db.prepare('SELECT * FROM change_set WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!raw) throw new Error(`Unknown change set ${id}`);
    return rowFromSql(LOG_TABLES.changeSet, raw) as unknown as ChangeSet;
  }

  private setStatus(id: string, status: ChangeSet['status'], field: 'confirmed_at' | 'cancelled_at' | 'undone_at'): ChangeSet {
    this.db.prepare(`UPDATE change_set SET status = ?, ${field} = ? WHERE id = ?`).run(status, this.stamp(), id);
    return this.getChangeSet(id);
  }

  // -- Store ----------------------------------------------------------------

  recordInbound(msg: NewInbound): InboundMessage {
    const row: InboundMessage = {
      id: this.newId('msg'),
      channel: msg.channel,
      sender: msg.sender,
      rawText: msg.rawText ?? null,
      audioPath: msg.audioPath ?? null,
      transcript: msg.transcript ?? null,
      photoPath: msg.photoPath ?? null,
      receivedAt: msg.receivedAt ?? this.stamp(),
    };
    this.insertRow(LOG_TABLES.inbound, row as unknown as Record<string, unknown>);
    return row;
  }

  updateInbound(id: string, patch: Partial<Pick<InboundMessage, 'rawText' | 'transcript' | 'audioPath' | 'photoPath'>>): InboundMessage {
    return this.db.transaction(() => {
      for (const [field, value] of Object.entries(patch)) {
        const col = columnOf(LOG_TABLES.inbound, field);
        this.db.prepare(`UPDATE inbound_message SET ${quote(col.column)} = ? WHERE id = ?`).run(toSql(value, col.type), id);
      }
      const raw = this.db.prepare('SELECT * FROM inbound_message WHERE id = ?').get(id) as Record<string, unknown> | undefined;
      if (!raw) throw new Error(`Unknown inbound message ${id}`);
      return rowFromSql(LOG_TABLES.inbound, raw) as unknown as InboundMessage;
    })();
  }

  proposeChangeSet(input: NewChangeSet): ChangeSet {
    return this.db.transaction(() => this.recordChangeSet(input, 'proposed'))();
  }

  confirmChangeSet(id: string): ChangeSet {
    return this.db.transaction(() => {
      const cs = this.getChangeSet(id);
      if (cs.status !== 'proposed') throw new Error(`Change set ${id} is ${cs.status}, not proposed`);
      const ds = this.load();
      const changes = changesOf(ds, id);
      applyChanges(ds, changes); // throws ChangeConflictError when stale; the transaction rolls back
      for (const c of changes) this.writeChange(c);
      return this.setStatus(id, 'confirmed', 'confirmed_at');
    })();
  }

  cancelChangeSet(id: string): ChangeSet {
    return this.db.transaction(() => {
      const cs = this.getChangeSet(id);
      if (cs.status !== 'proposed') throw new Error(`Change set ${id} is ${cs.status}, not proposed`);
      return this.setStatus(id, 'cancelled', 'cancelled_at');
    })();
  }

  applyChangeSet(input: NewChangeSet): ChangeSet {
    return this.db.transaction(() => {
      applyChanges(this.load(), input.changes); // validate first
      for (const c of input.changes) this.writeChange(c);
      return this.recordChangeSet(input, 'confirmed');
    })();
  }

  undo(changeSetId: string): UndoResult {
    return this.db.transaction((): UndoResult => {
      const ds = this.load();
      const blocker = undoBlocker(ds, changeSetId);
      if (blocker) return { ok: false, reason: blocker };
      for (const c of invertChanges(changesOf(ds, changeSetId))) this.writeChange(c);
      return { ok: true, changeSet: this.setStatus(changeSetId, 'undone', 'undone_at') };
    })();
  }

  saveSnapshot(snapshot: ForecastSnapshot): ForecastSnapshot {
    const spec = LOG_TABLES.snapshot;
    const cols = spec.columns;
    const updates = cols.filter((c) => c.column !== 'job_id' && c.column !== 'date').map((c) => `${quote(c.column)} = excluded.${quote(c.column)}`);
    this.db
      .prepare(
        `INSERT INTO forecast_snapshot (${cols.map((c) => quote(c.column)).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})
         ON CONFLICT (job_id, date) DO UPDATE SET ${updates.join(', ')}`,
      )
      .run(...cols.map((c) => toSql((snapshot as unknown as Record<string, unknown>)[c.field], c.type)));
    return { ...snapshot };
  }
}
