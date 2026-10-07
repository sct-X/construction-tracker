/**
 * Field-level changes: what operations propose, what the Store applies and
 * records, and what undo inverts. One shape for the browser mock and SQLite.
 */
import { cloneDataset, TABLE_KEYS } from './types.js';
import type { ChangeRecord, Dataset, JsonValue, RowByTable, TableName } from './types.js';

export type Change =
  | { kind: 'update'; table: TableName; rowId: string; field: string; before: JsonValue; after: JsonValue }
  | { kind: 'insert'; table: TableName; rowId: string; row: Record<string, JsonValue> }
  | { kind: 'delete'; table: TableName; rowId: string; row: Record<string, JsonValue> };

export class ChangeConflictError extends Error {
  constructor(
    message: string,
    readonly change: Change,
  ) {
    super(message);
    this.name = 'ChangeConflictError';
  }
}

function rowsOf(ds: Dataset, table: TableName): Record<string, JsonValue>[] {
  const key = TABLE_KEYS[table];
  if (!key) throw new Error(`Unknown table ${table}`);
  return ds[key] as unknown as Record<string, JsonValue>[];
}

export function findRow<T extends TableName>(ds: Dataset, table: T, id: string): RowByTable[T] | undefined {
  return (rowsOf(ds, table) as unknown as RowByTable[T][]).find((r) => (r as { id: string }).id === id);
}

/** JSON-level equality (rows are JSON-shaped). */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === undefined) a = null;
  if (b === undefined) b = null;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as unknown[];
    return a.length === bb.length && a.every((v, i) => jsonEqual(v, bb[i]));
  }
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => jsonEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

export interface ApplyOptions {
  /** Check each update's `before` and each delete's row against the data. Default true. */
  check?: boolean;
}

/**
 * Applies changes in order to a copy of the dataset and returns the copy.
 * With check on, a stale `before`, a missing row or a duplicate insert throws
 * ChangeConflictError and nothing is changed.
 */
export function applyChanges(ds: Dataset, changes: Change[], opts: ApplyOptions = {}): Dataset {
  const out = cloneDataset(ds);
  applyChangesInPlace(out, changes, opts);
  return out;
}

/** Same as applyChanges but mutates `ds`. On a conflict `ds` may be half-changed: use on a copy. */
export function applyChangesInPlace(ds: Dataset, changes: Change[], opts: ApplyOptions = {}): void {
  const check = opts.check ?? true;
  for (const c of changes) {
    const rows = rowsOf(ds, c.table);
    const idx = rows.findIndex((r) => r.id === c.rowId);
    if (c.kind === 'update') {
      if (idx < 0) {
        if (check) throw new ChangeConflictError(`${c.table} ${c.rowId} no longer exists`, c);
        continue;
      }
      const row = rows[idx]!;
      if (check && !jsonEqual(row[c.field], c.before)) {
        throw new ChangeConflictError(
          `${c.table} ${c.rowId} ${c.field} is ${JSON.stringify(row[c.field] ?? null)}, expected ${JSON.stringify(c.before)}`,
          c,
        );
      }
      rows[idx] = { ...row, [c.field]: c.after };
    } else if (c.kind === 'insert') {
      if (idx >= 0) {
        if (check) throw new ChangeConflictError(`${c.table} ${c.rowId} already exists`, c);
        rows[idx] = { ...c.row };
        continue;
      }
      rows.push({ ...c.row });
    } else {
      if (idx < 0) {
        if (check) throw new ChangeConflictError(`${c.table} ${c.rowId} is already gone`, c);
        continue;
      }
      if (check && !jsonEqual(rows[idx], c.row)) {
        throw new ChangeConflictError(`${c.table} ${c.rowId} changed since it was read`, c);
      }
      rows.splice(idx, 1);
    }
  }
}

/** The changes that undo `changes`: reversed, before/after swapped, insert and delete swapped. */
export function invertChanges(changes: Change[]): Change[] {
  return [...changes].reverse().map((c): Change => {
    if (c.kind === 'update') return { ...c, before: c.after, after: c.before };
    if (c.kind === 'insert') return { kind: 'delete', table: c.table, rowId: c.rowId, row: c.row };
    return { kind: 'insert', table: c.table, rowId: c.rowId, row: c.row };
  });
}

/** Stored form of a change. */
export function toChangeRecord(c: Change, changeSetId: string, seq: number, id: string): ChangeRecord {
  if (c.kind === 'update') {
    return { id, changeSetId, seq, kind: 'update', table: c.table, rowId: c.rowId, field: c.field, before: c.before, after: c.after };
  }
  if (c.kind === 'insert') {
    return { id, changeSetId, seq, kind: 'insert', table: c.table, rowId: c.rowId, field: null, before: null, after: c.row };
  }
  return { id, changeSetId, seq, kind: 'delete', table: c.table, rowId: c.rowId, field: null, before: c.row, after: null };
}

export function fromChangeRecord(r: ChangeRecord): Change {
  if (r.kind === 'update') {
    return { kind: 'update', table: r.table, rowId: r.rowId, field: r.field ?? '', before: r.before, after: r.after };
  }
  if (r.kind === 'insert') return { kind: 'insert', table: r.table, rowId: r.rowId, row: r.after as Record<string, JsonValue> };
  return { kind: 'delete', table: r.table, rowId: r.rowId, row: r.before as Record<string, JsonValue> };
}

/** The changes of one change set, in order. */
export function changesOf(ds: Dataset, changeSetId: string): Change[] {
  return ds.changes
    .filter((r) => r.changeSetId === changeSetId)
    .sort((a, b) => a.seq - b.seq)
    .map(fromChangeRecord);
}

/** The job a change belongs to, or null (sides, users, trades). */
export function jobIdOfChange(ds: Dataset, c: Change): string | null {
  if (c.table === 'job') return c.rowId;
  const row = c.kind === 'update' ? (rowsOf(ds, c.table).find((r) => r.id === c.rowId) ?? null) : c.row;
  const jobId = row && typeof row.jobId === 'string' ? row.jobId : null;
  return jobId;
}

/** Every job the changes touch, in first-seen order. Rows looked up in `ds` (and `after` for inserts). */
export function jobIdsOfChanges(ds: Dataset, changes: Change[]): string[] {
  const out: string[] = [];
  for (const c of changes) {
    const id = jobIdOfChange(ds, c);
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}
