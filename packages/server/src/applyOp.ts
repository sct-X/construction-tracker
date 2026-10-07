/**
 * Run one operation against a store the way the bot will: optionally record
 * the inbound message, propose the change set (the confirm card), then
 * confirm it. Used by scripts/apply-op.ts (e2e tests apply "Park Rd windows
 * ETA 16 Nov" before the bot exists) and by server tests.
 */
import { dryRun, runOperation, type ChangeSet, type Clock, type JobImpact, type OpResult } from '@ct/core';
import type { SqliteStore } from './sqliteStore.js';

export interface ApplyOpOptions {
  /** Record this text as an inbound Telegram message and link the change set to it (why-it-moved shows it). */
  message?: string | null;
  sender?: string;
}

export type ApplyOpResult =
  | { ok: true; changeSet: ChangeSet; summary: string; impacts: JobImpact[] }
  | { ok: false; result: OpResult; reason: string };

export function applyOperation(store: SqliteStore, clock: Clock, op: string, args: unknown, opts: ApplyOpOptions = {}): ApplyOpResult {
  const ds = store.load();
  const today = clock.today();
  const result = runOperation(ds, op, args, { today, now: clock.now() });
  if (result.kind !== 'proposal') {
    return { ok: false, result, reason: result.kind === 'refusal' ? result.reason : result.question };
  }
  const impacts = dryRun(ds, result, today).impacts;
  const msg = opts.message ? store.recordInbound({ channel: 'telegram', sender: opts.sender ?? 'apply-op', rawText: opts.message }) : null;
  const proposed = store.proposeChangeSet({
    messageId: msg?.id ?? null,
    summary: result.summary,
    opName: result.op,
    opArgs: result.args,
    changes: result.changes,
  });
  const changeSet = store.confirmChangeSet(proposed.id);
  return { ok: true, changeSet, summary: result.summary, impacts };
}
