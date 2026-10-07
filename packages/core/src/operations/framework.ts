/**
 * The operations framework: every allowed change is an OpDef with a zod
 * schema, validated before it runs, returning a proposal, a refusal or a
 * question. Operations never write; the Store applies a proposal's changes.
 */
import { z } from 'zod';
import type { Change } from '../changes.js';
import { jobIdsOfChanges } from '../changes.js';
import { formatDate } from '../dates.js';
import { fuzzyMatch, type MatchCandidate } from '../fuzzy.js';
import { resolveDate } from '../relativeDates.js';
import type {
  Dataset,
  ISODate,
  Item,
  Job,
  JsonValue,
  PhotoCategory,
  Shipment,
  Stage,
  Step,
  Trade,
} from '../types.js';

export interface OpContext {
  /** Sydney date from the injected clock. */
  today: ISODate;
  /** From the injected clock; used for timestamps on inserted rows. */
  now: Date;
  /** Id generator for inserted rows. Default: `${prefix}-` + random base36. */
  newId?: (prefix: string) => string;
}

export interface QuestionOption {
  label: string;
  /** The value to put in `field` when re-running the operation (usually an id). */
  value: string;
}

export interface Proposal {
  kind: 'proposal';
  op: string;
  /** The validated args as given. */
  args: Record<string, JsonValue>;
  changes: Change[];
  /** One plain sentence: "Park Rd windows ETA Mon 26 Oct to Mon 16 Nov". */
  summary: string;
  /** Jobs the changes touch (for the dry run). */
  jobIds: string[];
}

export interface Refusal {
  kind: 'refusal';
  op: string;
  reason: string;
}

export interface Question {
  kind: 'question';
  op: string;
  question: string;
  /** The arg the answer fills in. Re-run with `{ ...args, [field]: option.value }`. */
  field: string | null;
  options: QuestionOption[] | null;
  args: Record<string, JsonValue>;
}

export type OpResult = Proposal | Refusal | Question;

export type OpGroup = 'daily' | 'setup';

export interface OpDef<S extends z.ZodObject = z.ZodObject> {
  name: string;
  description: string;
  group: OpGroup;
  schema: S;
  /** The question to ask when a required arg is missing. */
  ask?: Partial<Record<keyof z.infer<S> & string, string>>;
  run(ds: Dataset, args: z.infer<S>, ctx: OpRunContext): OpResult;
}

/** What `run` gets: the context plus helpers bound to this op and its args. */
export interface OpRunContext extends OpContext {
  op: string;
  args: Record<string, JsonValue>;
  id(prefix: string): string;
  /** "Mon 16 Nov" in today's year, else "Fri 12 Mar 2027". */
  fmt(iso: ISODate | null): string;
  /** Stamp for createdAt-type instants. */
  stamp(): string;
}

export function defineOp<S extends z.ZodObject>(def: OpDef<S>): OpDef<S> {
  return def;
}

/** Thrown inside `run` to stop with a refusal or question. Caught by runOperation. */
export class OpStop extends Error {
  constructor(readonly result: Refusal | Question) {
    super(result.kind === 'refusal' ? result.reason : result.question);
  }
}

export function refuse(ctx: OpRunContext, reason: string): never {
  throw new OpStop({ kind: 'refusal', op: ctx.op, reason });
}

export function ask(ctx: OpRunContext, question: string, field: string | null = null, options: QuestionOption[] | null = null): never {
  throw new OpStop({ kind: 'question', op: ctx.op, question, field, options, args: ctx.args });
}

export function proposal(ctx: OpRunContext, ds: Dataset, changes: Change[], summary: string, extraJobIds: string[] = []): Proposal {
  if (!changes.length) refuse(ctx, 'Nothing would change.');
  const jobIds = jobIdsOfChanges(ds, changes);
  for (const j of extraJobIds) if (!jobIds.includes(j)) jobIds.push(j);
  return { kind: 'proposal', op: ctx.op, args: ctx.args, changes, summary, jobIds };
}

let idCounter = 0;
export function defaultNewId(prefix: string): string {
  idCounter = (idCounter + 1) % 1296;
  const rand = Math.floor(Math.random() * 36 ** 6).toString(36).padStart(6, '0');
  return `${prefix}-${Date.now().toString(36)}${idCounter.toString(36).padStart(2, '0')}${rand}`;
}

// ---------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------

function isMissing(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

export function runOp<S extends z.ZodObject>(def: OpDef<S>, ds: Dataset, rawArgs: unknown, ctx: OpContext): OpResult {
  const raw = (rawArgs && typeof rawArgs === 'object' ? rawArgs : {}) as Record<string, unknown>;
  // Treat empty strings and nulls from an LLM as "not given".
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) if (!isMissing(v)) cleaned[k] = v;
  const parsed = def.schema.safeParse(cleaned);
  const argsJson = cleaned as Record<string, JsonValue>;
  if (!parsed.success) {
    const missing = parsed.error.issues.find((i) => i.path.length === 1 && isMissing(cleaned[String(i.path[0])]));
    if (missing) {
      const field = String(missing.path[0]);
      const q = (def.ask as Record<string, string> | undefined)?.[field] ?? `What should ${field} be?`;
      return { kind: 'question', op: def.name, question: q, field, options: null, args: argsJson };
    }
    const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'args'}: ${i.message}`).join('; ');
    return { kind: 'refusal', op: def.name, reason: `That didn't make sense to me (${msg}).` };
  }
  const newId = ctx.newId ?? defaultNewId;
  const runCtx: OpRunContext = {
    ...ctx,
    op: def.name,
    args: parsed.data as Record<string, JsonValue>,
    id: newId,
    fmt: (iso) => (iso ? formatDate(iso, ctx.today) : 'no date'),
    stamp: () => ctx.now.toISOString(),
  };
  try {
    return def.run(ds, parsed.data, runCtx);
  } catch (e) {
    if (e instanceof OpStop) return e.result;
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Arg helpers
// ---------------------------------------------------------------------------

/** A date arg: ISO or a phrase ("next Tuesday", "16 Nov"). */
export const dateArg = (what: string) =>
  z.string().describe(`${what}. YYYY-MM-DD, or words like "16 Nov", "next Tuesday", "the 14th", "in 2 weeks".`);

export function readDate(ctx: OpRunContext, value: string, prefer: 'future' | 'past' = 'future'): ISODate {
  const d = resolveDate(value, ctx.today, { prefer });
  if (!d) refuse(ctx, `I couldn't read "${value}" as a date.`);
  return d;
}

// ---------------------------------------------------------------------------
// Resolving names to rows (fuzzy, with a question when ambiguous)
// ---------------------------------------------------------------------------

function pick<T>(
  ctx: OpRunContext,
  query: string,
  candidates: MatchCandidate<T>[],
  field: string,
  noun: string,
  where: string,
): T {
  const r = fuzzyMatch(query, candidates);
  if (r.kind === 'unique') return r.match.value as T;
  if (r.kind === 'ambiguous') {
    ask(
      ctx,
      `Which ${noun} do you mean by "${query}"?`,
      field,
      r.candidates.map((c) => ({ label: c.name + (c.aliases?.[0] ? ` (${c.aliases[0]})` : ''), value: c.id })),
    );
  }
  refuse(ctx, `I can't find ${noun === 'job' ? 'a job' : `a ${noun}`} called "${query}"${where}.`);
}

export function liveJobs(ds: Dataset): Job[] {
  return ds.jobs.filter((j) => !j.isTemplate);
}

export function jobName(ds: Dataset, jobId: string): string {
  return ds.jobs.find((j) => j.id === jobId)?.name ?? jobId;
}

export function resolveJob(
  ds: Dataset,
  ctx: OpRunContext,
  query: string,
  opts: { field?: string; templates?: boolean; kind?: 'build' | 'design' } = {},
): Job {
  const exact = ds.jobs.find((j) => j.id === query);
  if (exact) return exact;
  const pool = ds.jobs.filter((j) => (opts.templates ? j.isTemplate : !j.isTemplate) && (!opts.kind || j.kind === opts.kind));
  return pick(
    ctx,
    query,
    pool.map((j) => ({ id: j.id, name: j.name, value: j })),
    opts.field ?? 'job',
    opts.templates ? 'template' : 'job',
    '',
  );
}

function optionalJob(ds: Dataset, ctx: OpRunContext, query: string | undefined, field = 'job'): Job | null {
  return query ? resolveJob(ds, ctx, query, { field }) : null;
}

const inJob = (job: Job | null) => (job ? ` at ${job.name}` : '');

export function resolveShipment(ds: Dataset, ctx: OpRunContext, query: string, jobQuery?: string): Shipment {
  const exact = ds.shipments.find((s) => s.id === query);
  if (exact) return exact;
  const job = optionalJob(ds, ctx, jobQuery);
  const live = new Set(liveJobs(ds).map((j) => j.id));
  const pool = ds.shipments.filter((s) => (job ? s.jobId === job.id : live.has(s.jobId)));
  return pick(
    ctx,
    query,
    pool.map((s) => ({ id: s.id, name: s.name, aliases: [jobName(ds, s.jobId), s.supplier ?? ''].filter(Boolean), value: s })),
    'shipment',
    'shipment',
    inJob(job),
  );
}

export function resolveItem(ds: Dataset, ctx: OpRunContext, query: string, jobQuery?: string): Item {
  const exact = ds.items.find((i) => i.id === query);
  if (exact) return exact;
  const job = optionalJob(ds, ctx, jobQuery);
  const live = new Set(liveJobs(ds).map((j) => j.id));
  const all = ds.items.filter((i) => (job ? i.jobId === job.id : live.has(i.jobId)));
  const toCandidates = (items: Item[]) =>
    items.map((i) => ({ id: i.id, name: i.title, aliases: [jobName(ds, i.jobId), i.waitingOn ?? ''].filter(Boolean), value: i }));
  // Open items first; fall back to done ones (e.g. "reopen the tile order").
  const open = all.filter((i) => i.status !== 'done');
  const r = fuzzyMatch(query, toCandidates(open));
  if (r.kind !== 'none') return pick(ctx, query, toCandidates(open), 'item', 'item', inJob(job));
  return pick(ctx, query, toCandidates(all), 'item', 'item', inJob(job));
}

export function resolveStep(ds: Dataset, ctx: OpRunContext, query: string, jobQuery?: string, field = 'step'): Step {
  const exact = ds.steps.find((s) => s.id === query);
  if (exact) return exact;
  const job = optionalJob(ds, ctx, jobQuery);
  const live = new Set(liveJobs(ds).map((j) => j.id));
  const pool = ds.steps.filter((s) => (job ? s.jobId === job.id : live.has(s.jobId)));
  return pick(
    ctx,
    query,
    pool.map((s) => ({ id: s.id, name: s.name, aliases: [jobName(ds, s.jobId)], value: s })),
    field,
    'step',
    inJob(job),
  );
}

export function resolveStage(ds: Dataset, ctx: OpRunContext, query: string, job: Job | null, field = 'stage'): Stage {
  const exact = ds.stages.find((s) => s.id === query);
  if (exact) return exact;
  const live = new Set(ds.jobs.map((j) => j.id));
  const pool = ds.stages.filter((s) => (job ? s.jobId === job.id : live.has(s.jobId)));
  return pick(
    ctx,
    query,
    pool.map((s) => ({ id: s.id, name: s.name, aliases: [jobName(ds, s.jobId)], value: s })),
    field,
    'stage',
    inJob(job),
  );
}

export function resolveTrade(ds: Dataset, ctx: OpRunContext, query: string, field = 'trade'): Trade {
  const exact = ds.trades.find((t) => t.id === query);
  if (exact) return exact;
  return pick(
    ctx,
    query,
    ds.trades.map((t) => ({ id: t.id, name: t.name, aliases: [t.type], value: t })),
    field,
    'trade',
    '',
  );
}

export function resolveCategory(
  ds: Dataset,
  ctx: OpRunContext,
  query: string,
  job: Job,
  stage: Stage | null,
  field = 'category',
): PhotoCategory {
  const exact = ds.photoCategories.find((c) => c.id === query && c.jobId === job.id);
  if (exact) return exact;
  const pool = ds.photoCategories.filter((c) => c.jobId === job.id && (!stage || c.stageId === stage.id || c.stageId === null));
  const stageName = (c: PhotoCategory) => ds.stages.find((s) => s.id === c.stageId)?.name ?? 'Whole job';
  return pick(
    ctx,
    query,
    pool.map((c) => ({ id: c.id, name: c.name, aliases: [stageName(c)], value: c })),
    field,
    'photo category',
    ` at ${job.name}`,
  );
}

/** One update change, or none when the value is unchanged. */
export function update<R extends { id: string }>(table: Change['table'], row: R, field: keyof R & string, after: JsonValue): Change[] {
  const before = ((row as unknown as Record<string, JsonValue>)[field] ?? null) as JsonValue;
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  return [{ kind: 'update', table, rowId: row.id, field, before, after }];
}

export function insert<R extends { id: string }>(table: Change['table'], row: R): Change {
  return { kind: 'insert', table, rowId: row.id, row: { ...(row as unknown as Record<string, JsonValue>) } };
}

export function remove(table: Change['table'], row: { id: string }): Change {
  return { kind: 'delete', table, rowId: row.id, row: row as unknown as Record<string, JsonValue> };
}
