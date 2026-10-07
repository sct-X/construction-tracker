/**
 * From a ParseResult to what the bot would do (resolved through core operations on a copy of the
 * seed, exactly like packages/bot runCalls / processPhoto), then graded against a case.
 * Nothing is ever written: operations only propose changes, and the dry run applies them to a copy.
 */
import {
  applyChanges,
  dryRun,
  getOperation,
  runOperation,
  type Change,
  type Dataset,
  type JsonValue,
  type OpContext,
  type Proposal,
} from '@ct/core';
import { BOT_SET_ARGS, type ParseResult } from '@ct/llm';
import type { EvalCase, Expectation, ExpectedOp, Matcher } from './cases.js';

/** The stored-photo path the bot would set for a photo case (relative to the photos folder). */
export const EVAL_PHOTO_PATH = 'telegram/2026-09-17-eval0photo.jpg';

export interface ResolvedOp {
  op: string;
  /** Op arg names with resolved values: ids for names, ISO dates. */
  args: Record<string, JsonValue>;
  summary: string;
}

export type Outcome =
  | { kind: 'ops'; ops: ResolvedOp[] }
  | { kind: 'question'; by: 'parser' | 'core'; text: string }
  | { kind: 'refusal'; op: string; reason: string }
  | { kind: 'read'; tool: string; args: Record<string, unknown> }
  | { kind: 'reply'; text: string }
  | { kind: 'error'; message: string };

type Call = { op: string; args: Record<string, unknown> };

function rowOf(ds: Dataset, table: Change['table'], id: string): Record<string, JsonValue> | undefined {
  const key = (
    {
      shipment: 'shipments',
      step: 'steps',
      item: 'items',
      job: 'jobs',
      stage: 'stages',
    } as Record<string, keyof Dataset>
  )[table];
  if (!key) return undefined;
  return (ds[key] as unknown as Record<string, JsonValue>[]).find((r) => r.id === id);
}

/** A proposal's changes, as the op's args with resolved values (what cases compare against). */
export function resolvedArgs(p: Proposal, ds: Dataset): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {};
  const set = (k: string, v: JsonValue | undefined) => {
    if (v !== undefined) out[k] = v;
  };
  for (const c of p.changes) {
    if (c.kind === 'insert') {
      const r = c.row;
      if (c.table === 'item') {
        for (const k of ['type', 'title', 'waitingOn', 'owner', 'neededBy', 'expectedDate', 'leadTimeWeeks', 'notes'] as const) set(k, r[k]);
        set('job', r.jobId);
        set('trade', r.tradeId);
        set('step', r.stepId);
      } else if (c.table === 'daily_note') {
        set('job', r.jobId);
        set('date', r.date);
        set('text', r.text);
      } else if (c.table === 'photo') {
        set('job', r.jobId);
        set('stage', r.stageId);
        set('category', r.categoryId);
        set('caption', r.caption);
        set('takenOn', r.takenOn);
      }
      continue;
    }
    if (c.kind !== 'update') continue;
    // The row the op changed, under the op's own arg name.
    set(c.table, c.rowId);
    const row = rowOf(ds, c.table, c.rowId);
    if (row && typeof row.jobId === 'string') set('job', row.jobId);
    const field = c.field;
    const after = c.after;
    switch (p.op) {
      case 'mark_step_done':
        if (field === 'actualEnd') set('date', after);
        break;
      case 'mark_step_started':
        if (field === 'actualStart') set('date', after);
        break;
      case 'set_item_status':
        if (field === 'status') set('status', after);
        if ((field === 'confirmedDate' || field === 'doneAt') && after !== null) set('date', after);
        break;
      case 'set_item_expected_date':
        if (field === 'expectedDate') set('date', after);
        break;
      case 'override_lead_time':
        if (field === 'leadTimeWeeks') set('weeks', after);
        break;
      case 'confirm_job':
        if (field === 'lastConfirmed') set('date', after);
        break;
      default:
        set(field, after); // set_shipment_eta (eta), set_shipment_status / set_stage_status (status)
    }
  }
  return out;
}

/** The bot's per-call path: bot-owned args stripped and set by the bot, daily ops only. */
function runCalls(calls: Call[], c: EvalCase, ds: Dataset, ctx: OpContext): Outcome {
  let working = ds;
  const proposals: Proposal[] = [];
  for (const call of calls) {
    const def = getOperation(call.op);
    if (!def) return { kind: 'refusal', op: call.op, reason: `unknown op ${call.op}` };
    if (def.group !== 'daily') return { kind: 'refusal', op: call.op, reason: 'a Setup op' };
    const shape = (def.schema as unknown as { shape: Record<string, unknown> }).shape;
    if ('filePath' in shape && !c.photo) {
      return { kind: 'refusal', op: call.op, reason: 'attach_photo without a photo ("Send the photo itself")' };
    }
    const args: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(call.args)) if (!BOT_SET_ARGS.includes(k)) args[k] = v;
    if (c.photo && 'filePath' in shape) args.filePath = EVAL_PHOTO_PATH;
    const r = runOperation(working, call.op, args, ctx);
    if (r.kind === 'refusal') return { kind: 'refusal', op: r.op, reason: r.reason };
    if (r.kind === 'question') {
      if (r.field && BOT_SET_ARGS.includes(r.field)) return { kind: 'refusal', op: r.op, reason: `asked for bot-owned ${r.field}` };
      return { kind: 'question', by: 'core', text: r.question };
    }
    working = applyChanges(working, r.changes);
    proposals.push(r);
  }
  if (proposals.length) {
    // The confirm card's forecast dry run: proves the changes apply cleanly to the seed.
    dryRun(ds, { changes: proposals.flatMap((p) => p.changes), jobIds: [...new Set(proposals.flatMap((p) => p.jobIds))] }, ctx.today);
  }
  return { kind: 'ops', ops: proposals.map((p) => ({ op: p.op, args: resolvedArgs(p, ds), summary: p.summary })) };
}

/** What the bot would do with this parse result (no store, no writes). */
export function resolveOutcome(result: ParseResult, c: EvalCase, ds: Dataset, ctx: OpContext): Outcome {
  try {
    if (c.photo) {
      // packages/bot processPhoto: attach_photo first (args from the caption's first attach_photo call,
      // else the job of another call), then the other calls; a non-op parse still files with the caption.
      let attach: Record<string, unknown> = {};
      let others: Call[] = [];
      if (result.kind === 'ops') {
        const first = result.calls.find((x) => x.op === 'attach_photo');
        others = result.calls.filter((x) => x.op !== 'attach_photo');
        if (first) attach = { ...first.args };
        else {
          const job = others.find((x) => typeof x.args.job === 'string')?.args.job;
          if (job) attach.job = job;
        }
      }
      attach.caption = c.text;
      return runCalls([{ op: 'attach_photo', args: attach }, ...others], c, ds, ctx);
    }
    switch (result.kind) {
      case 'question':
        return { kind: 'question', by: 'parser', text: result.text };
      case 'read':
        return { kind: 'read', tool: result.tool, args: result.args };
      case 'reply':
        return { kind: 'reply', text: result.text };
      case 'ops':
        return runCalls(result.calls, c, ds, ctx);
    }
  } catch (e) {
    return { kind: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

export function matches(m: Matcher, v: JsonValue | undefined): boolean {
  if (m !== null && typeof m === 'object') {
    if ('includes' in m) return typeof v === 'string' && v.toLowerCase().includes(m.includes.toLowerCase());
    return m.oneOf.some((x) => x === (v ?? null));
  }
  return m === (v ?? null);
}

function show(v: unknown): string {
  if (v === undefined) return '(none)';
  return typeof v === 'string' ? v : JSON.stringify(v);
}

function showMatcher(m: Matcher): string {
  if (m !== null && typeof m === 'object') return 'includes' in m ? `~"${m.includes}"` : m.oneOf.map(show).join('|');
  return show(m);
}

function argMismatches(exp: ExpectedOp, got: ResolvedOp): string[] {
  return Object.entries(exp.args)
    .filter(([k, m]) => !matches(m, got.args[k]))
    .map(([k, m]) => `${k} ${show(got.args[k])} (want ${showMatcher(m)})`);
}

/** Pairs every expected op with a distinct actual op (any order). Null when impossible. */
function pairUp(expected: ExpectedOp[], actual: ResolvedOp[]): boolean {
  const used = new Array<boolean>(actual.length).fill(false);
  const go = (i: number): boolean => {
    if (i === expected.length) return true;
    for (let j = 0; j < actual.length; j++) {
      if (used[j] || actual[j]!.op !== expected[i]!.op || argMismatches(expected[i]!, actual[j]!).length) continue;
      used[j] = true;
      if (go(i + 1)) return true;
      used[j] = false;
    }
    return false;
  };
  return go(0);
}

function describe(o: Outcome): string {
  switch (o.kind) {
    case 'ops':
      return o.ops.length ? `proposed ${o.ops.map((x) => x.op).join(', ')}` : 'proposed nothing ("Nothing to change")';
    case 'question':
      return `asked (${o.by}): "${o.text}"`;
    case 'refusal':
      return `${o.op} refused: ${o.reason}`;
    case 'read':
      return `read ${o.tool}`;
    case 'reply':
      return `replied: "${o.text}"`;
    case 'error':
      return `error: ${o.message}`;
  }
}

export interface Grade {
  pass: boolean;
  /** Short reason when it failed. */
  reason: string;
}

/** Pass when the outcome meets any of the case's acceptable expectations. */
export function grade(c: EvalCase, o: Outcome): Grade {
  const list = Array.isArray(c.expect) ? c.expect : [c.expect];
  const grades = list.map((e) => gradeOne(e, o));
  return grades.find((g) => g.pass) ?? { pass: false, reason: grades.map((g) => g.reason).join(' | or ') };
}

function gradeOne(e: Expectation, o: Outcome): Grade {
  const ok: Grade = { pass: true, reason: '' };
  const fail = (reason: string): Grade => ({ pass: false, reason });
  switch (e.kind) {
    case 'question':
      return o.kind === 'question' ? ok : fail(`want a question; ${describe(o)}`);
    case 'read':
      if (o.kind !== 'read') return fail(`want a read; ${describe(o)}`);
      return !e.tools || e.tools.includes(o.tool) ? ok : fail(`read ${o.tool} (want ${e.tools.join(' or ')})`);
    case 'refusal':
      if (o.kind !== 'refusal') return fail(`want ${e.op} refused; ${describe(o)}`);
      if (o.op !== e.op) return fail(`${o.op} refused (want ${e.op}): ${o.reason}`);
      if (e.reasonIncludes && !o.reason.includes(e.reasonIncludes)) return fail(`refused for another reason: ${o.reason}`);
      return ok;
    case 'ops': {
      if (o.kind !== 'ops' || !o.ops.length) return fail(`want ${e.ops.map((x) => x.op).join(', ')}; ${describe(o)}`);
      const want = e.ops.map((x) => x.op).sort().join(', ');
      const got = o.ops.map((x) => x.op).sort().join(', ');
      if (want !== got) return fail(`ops ${got} (want ${want})`);
      if (pairUp(e.ops, o.ops)) return ok;
      // Name the first expected op that found no match, with its closest same-name candidate.
      for (const x of e.ops) {
        const cands = o.ops.filter((y) => y.op === x.op);
        if (cands.some((y) => !argMismatches(x, y).length)) continue;
        const best = cands.map((y) => argMismatches(x, y)).sort((a, b) => a.length - b.length)[0] ?? [];
        return fail(`${x.op}: ${best.join('; ')}`);
      }
      return fail('ops matched individually but not as a set');
    }
  }
}
