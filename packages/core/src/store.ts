/**
 * The Store: where the dataset lives and the only thing that writes it.
 * Every write is a change set (recorded with its change rows) so it can be
 * shown, explained and undone. InMemoryStore backs the browser mock and
 * tests; SqliteStore (packages/server) backs the real app. Both are
 * synchronous; wrap in promises at the API edge.
 */
import { applyChanges, applyChangesInPlace, ChangeConflictError, changesOf, invertChanges, toChangeRecord, type Change } from './changes.js';
import { defaultNewId } from './operations/framework.js';
import { cloneDataset } from './types.js';
import type { Clock } from './dates.js';
import { systemClock } from './dates.js';
import type { ChangeSet, Dataset, ForecastSnapshot, InboundChannel, InboundMessage, Instant, JsonValue } from './types.js';

export interface NewInbound {
  channel: InboundChannel;
  sender: string;
  rawText?: string | null;
  audioPath?: string | null;
  transcript?: string | null;
  photoPath?: string | null;
  /** Default: clock.now(). */
  receivedAt?: Instant;
}

export interface NewChangeSet {
  messageId?: string | null;
  summary: string;
  opName?: string | null;
  opArgs?: JsonValue;
  changes: Change[];
}

export type UndoResult = { ok: true; changeSet: ChangeSet } | { ok: false; reason: string };

export interface Store {
  /** A fresh copy of everything. Callers may mutate it freely. */
  load(): Dataset;
  recordInbound(msg: NewInbound): InboundMessage;
  /** Fill in a transcript (or other fields) after the fact. */
  updateInbound(id: string, patch: Partial<Pick<InboundMessage, 'rawText' | 'transcript' | 'audioPath' | 'photoPath'>>): InboundMessage;
  /** Record a change set as proposed (the confirm card). Nothing is applied. */
  proposeChangeSet(input: NewChangeSet): ChangeSet;
  /** Apply a proposed change set. Throws ChangeConflictError when the data moved since; it stays proposed. */
  confirmChangeSet(id: string): ChangeSet;
  cancelChangeSet(id: string): ChangeSet;
  /** Record and apply in one go (status confirmed). Throws ChangeConflictError and records nothing on a conflict. */
  applyChangeSet(input: NewChangeSet): ChangeSet;
  /** Reverse a confirmed change set. Refused when a later change touched the same fields. */
  undo(changeSetId: string): UndoResult;
  saveSnapshot(snapshot: ForecastSnapshot): ForecastSnapshot;
}

/** The newest confirmed change set (what /undo reverses), or null. */
export function latestUndoable(ds: Dataset): ChangeSet | null {
  return (
    [...ds.changeSets]
      .filter((c) => c.status === 'confirmed')
      .sort((a, b) => ((a.confirmedAt ?? '') < (b.confirmedAt ?? '') ? 1 : -1))[0] ?? null
  );
}

/** Why an undo can't go ahead, or null when it can. Shared by both stores. */
export function undoBlocker(ds: Dataset, changeSetId: string): string | null {
  const cs = ds.changeSets.find((c) => c.id === changeSetId);
  if (!cs) return 'There is no such change.';
  if (cs.status === 'undone') return 'That change was already undone.';
  if (cs.status !== 'confirmed') return `That change was never saved (it was ${cs.status}).`;
  // Any later confirmed change to the same field (or the same row, for inserts and deletes)
  // blocks the undo, whatever the values now are: the log must stay true.
  const mine = changesOf(ds, changeSetId);
  const overlaps = (a: Change, b: Change) =>
    a.table === b.table && a.rowId === b.rowId && (a.kind !== 'update' || b.kind !== 'update' || a.field === b.field);
  const laterHit = ds.changeSets
    .filter((x) => x.id !== cs.id && x.status === 'confirmed' && (x.confirmedAt ?? '') > (cs.confirmedAt ?? ''))
    .filter((x) => changesOf(ds, x.id).some((c) => mine.some((m) => overlaps(m, c))))
    .sort((a, b) => ((a.confirmedAt ?? '') < (b.confirmedAt ?? '') ? 1 : -1))[0];
  if (laterHit) return `Can't undo "${cs.summary}": it was changed again since ("${laterHit.summary}"). Undo that first.`;
  try {
    applyChanges(ds, invertChanges(changesOf(ds, changeSetId)));
    return null;
  } catch (e) {
    if (!(e instanceof ChangeConflictError)) throw e;
    const c = e.change;
    const later = [...ds.changeSets]
      .filter((x) => x.status === 'confirmed' && (x.confirmedAt ?? '') > (cs.confirmedAt ?? ''))
      .filter((x) => changesOf(ds, x.id).some((y) => y.table === c.table && y.rowId === c.rowId))
      .sort((a, b) => ((a.confirmedAt ?? '') < (b.confirmedAt ?? '') ? 1 : -1))[0];
    return later
      ? `Can't undo "${cs.summary}": it was changed again since ("${later.summary}"). Undo that first.`
      : `Can't undo "${cs.summary}": the data has changed since.`;
  }
}

export interface StoreOptions {
  clock?: Clock;
  newId?: (prefix: string) => string;
}

export class InMemoryStore implements Store {
  private ds: Dataset;
  private readonly clock: Clock;
  private readonly newId: (prefix: string) => string;

  constructor(dataset: Dataset, opts: StoreOptions = {}) {
    this.ds = cloneDataset(dataset);
    this.clock = opts.clock ?? systemClock();
    this.newId = opts.newId ?? defaultNewId;
  }

  load(): Dataset {
    return cloneDataset(this.ds);
  }

  /** Replace everything (the demo's reset button). */
  reset(dataset: Dataset): void {
    this.ds = cloneDataset(dataset);
  }

  private stamp(): Instant {
    return this.clock.now().toISOString();
  }

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
    this.ds.inboundMessages.push(row);
    return { ...row };
  }

  updateInbound(id: string, patch: Partial<Pick<InboundMessage, 'rawText' | 'transcript' | 'audioPath' | 'photoPath'>>): InboundMessage {
    const row = this.ds.inboundMessages.find((m) => m.id === id);
    if (!row) throw new Error(`Unknown inbound message ${id}`);
    Object.assign(row, patch);
    return { ...row };
  }

  private record(input: NewChangeSet, status: 'proposed' | 'confirmed'): ChangeSet {
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
    this.ds.changeSets.push(cs);
    input.changes.forEach((c, i) => this.ds.changes.push(toChangeRecord(c, cs.id, i + 1, this.newId('chg'))));
    return cs;
  }

  proposeChangeSet(input: NewChangeSet): ChangeSet {
    return { ...this.record(input, 'proposed') };
  }

  confirmChangeSet(id: string): ChangeSet {
    const cs = this.ds.changeSets.find((c) => c.id === id);
    if (!cs) throw new Error(`Unknown change set ${id}`);
    if (cs.status !== 'proposed') throw new Error(`Change set ${id} is ${cs.status}, not proposed`);
    const next = applyChanges(this.ds, changesOf(this.ds, id)); // throws on conflict, nothing changed
    this.ds = next;
    const row = this.ds.changeSets.find((c) => c.id === id)!;
    row.status = 'confirmed';
    row.confirmedAt = this.stamp();
    return { ...row };
  }

  cancelChangeSet(id: string): ChangeSet {
    const cs = this.ds.changeSets.find((c) => c.id === id);
    if (!cs) throw new Error(`Unknown change set ${id}`);
    if (cs.status !== 'proposed') throw new Error(`Change set ${id} is ${cs.status}, not proposed`);
    cs.status = 'cancelled';
    cs.cancelledAt = this.stamp();
    return { ...cs };
  }

  applyChangeSet(input: NewChangeSet): ChangeSet {
    const next = applyChanges(this.ds, input.changes); // validate first: a conflict records nothing
    this.ds = next;
    return { ...this.record(input, 'confirmed') };
  }

  undo(changeSetId: string): UndoResult {
    const blocker = undoBlocker(this.ds, changeSetId);
    if (blocker) return { ok: false, reason: blocker };
    const work = cloneDataset(this.ds);
    applyChangesInPlace(work, invertChanges(changesOf(work, changeSetId)));
    const cs = work.changeSets.find((c) => c.id === changeSetId)!;
    cs.status = 'undone';
    cs.undoneAt = this.stamp();
    this.ds = work;
    return { ok: true, changeSet: { ...cs } };
  }

  saveSnapshot(snapshot: ForecastSnapshot): ForecastSnapshot {
    const i = this.ds.snapshots.findIndex((s) => s.jobId === snapshot.jobId && s.date === snapshot.date);
    if (i >= 0) this.ds.snapshots[i] = { ...snapshot };
    else this.ds.snapshots.push({ ...snapshot });
    return { ...snapshot };
  }
}
