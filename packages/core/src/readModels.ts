/**
 * Read models: pure functions over the dataset that feed every screen and the
 * bot's read-only answers. The browser mock and the server API share them.
 * All lists exclude templates and are limited to one side when sideId is given.
 */
import { forecastJob, holdPointCheck, type HoldPointCheck, type JobForecast, type StageForecast, type StepForecast } from './calculator.js';
import { applyChanges, changesOf, invertChanges, jobIdsOfChanges } from './changes.js';
import { addCalendarDays, calendarDaysBetween, formatDate, lastMonday, SHUTDOWNS, type DateRange } from './dates.js';
import { slipCost } from './money.js';
import { compareForecasts, type MovedStep } from './dryRun.js';
import {
  ITEM_STATUS_LABELS,
  ITEM_TYPE_LABELS,
  SHIPMENT_STATUS_LABELS,
  type ApprovalPath,
  type ChangeKind,
  type ChangeSet,
  type ChangeSetStatus,
  type DailyNote,
  type Dataset,
  type ISODate,
  type Instant,
  type Item,
  type ItemStatus,
  type ItemType,
  type Job,
  type JsonValue,
  type Photo,
  type ShipmentStatus,
  type StageStatus,
  type TableName,
  type Trade,
} from './types.js';
import type { Change } from './changes.js';

export interface SideFilter {
  sideId?: string;
}

function liveJobs(ds: Dataset, f: SideFilter = {}): Job[] {
  return ds.jobs.filter((j) => !j.isTemplate && (!f.sideId || j.sideId === f.sideId));
}

// ---------------------------------------------------------------------------
// Waiting-on rows (the one list of dated actions)
// ---------------------------------------------------------------------------

export interface WaitingRow {
  itemId: string;
  jobId: string;
  jobName: string;
  title: string;
  type: ItemType;
  typeLabel: string;
  status: ItemStatus;
  statusLabel: string;
  owner: string | null;
  waitingOn: string | null;
  tradeId: string | null;
  tradeName: string | null;
  /** Tap-to-call. */
  tradePhone: string | null;
  stepId: string | null;
  stepName: string | null;
  shipmentId: string | null;
  shipmentName: string | null;
  neededBy: ISODate | null;
  actBy: ISODate | null;
  expected: ISODate | null;
  leadTimeWeeks: number;
  isLate: boolean;
  lateDays: number;
  lateText: string | null;
  actByPassed: boolean;
  /** Past its date today (see isOverdue). */
  overdue: boolean;
  daysSitting: number;
  notes: string | null;
}

/**
 * Past its date today: needed-by gone with nothing expected (or the expected
 * date gone too), or act-by gone while still to do. An item expected after it
 * is needed is late ("7 days after needed") but not overdue.
 */
export function isOverdue(
  f: { status: ItemStatus; actBy: ISODate | null; neededBy: ISODate | null; expected: ISODate | null },
  today: ISODate,
): boolean {
  if (f.status === 'done') return false;
  if (f.neededBy && f.neededBy < today && (!f.expected || f.expected < today)) return true;
  return f.status === 'to_do' && !!f.actBy && f.actBy < today;
}

function waitingRow(ds: Dataset, forecast: JobForecast, item: Item, today: ISODate): WaitingRow {
  const f = forecast.items[item.id]!;
  const trade: Trade | undefined = item.tradeId ? ds.trades.find((t) => t.id === item.tradeId) : undefined;
  const job = ds.jobs.find((j) => j.id === item.jobId);
  return {
    itemId: item.id,
    jobId: item.jobId,
    jobName: job?.name ?? item.jobId,
    title: item.title,
    type: item.type,
    typeLabel: ITEM_TYPE_LABELS[item.type],
    status: item.status,
    statusLabel: ITEM_STATUS_LABELS[item.status],
    owner: item.owner,
    waitingOn: item.waitingOn,
    tradeId: item.tradeId,
    tradeName: trade?.name ?? null,
    tradePhone: trade?.phone ?? null,
    stepId: item.stepId,
    stepName: item.stepId ? (ds.steps.find((s) => s.id === item.stepId)?.name ?? null) : null,
    shipmentId: item.shipmentId,
    shipmentName: item.shipmentId ? (ds.shipments.find((s) => s.id === item.shipmentId)?.name ?? null) : null,
    neededBy: f.neededBy,
    actBy: f.actBy,
    expected: f.expected,
    leadTimeWeeks: f.leadTimeWeeks,
    isLate: f.isLate,
    lateDays: f.lateDays,
    lateText: f.lateText,
    actByPassed: f.actByPassed,
    overdue: isOverdue(f, today),
    daysSitting: f.daysSitting,
    notes: item.notes,
  };
}

function rowsForJob(ds: Dataset, forecast: JobForecast, today: ISODate, includeDone = false): WaitingRow[] {
  return ds.items
    .filter((i) => i.jobId === forecast.jobId && (includeDone || i.status !== 'done'))
    .map((i) => waitingRow(ds, forecast, i, today));
}

/** Late (most late first), then overdue, then soonest act-by within 14 days, then the rest by act-by. */
export function rankWaiting(rows: WaitingRow[], today: ISODate): WaitingRow[] {
  const horizon = addCalendarDays(today, 14);
  const rank = (r: WaitingRow) => (r.isLate ? 0 : r.overdue ? 1 : r.actBy && r.actBy <= horizon ? 2 : 3);
  return [...rows].sort((a, b) => {
    const d = rank(a) - rank(b);
    if (d) return d;
    if (rank(a) === 0) return b.lateDays - a.lateDays;
    return (a.actBy ?? '9999-12-31').localeCompare(b.actBy ?? '9999-12-31') || a.title.localeCompare(b.title);
  });
}

// ---------------------------------------------------------------------------
// Monday screen
// ---------------------------------------------------------------------------

export interface HoldPointSummary {
  stepId: string;
  stepName: string;
  date: ISODate | null;
  filled: number;
  required: number;
  missing: string[];
}

function holdSummary(h: HoldPointCheck | null): HoldPointSummary | null {
  if (!h) return null;
  return { stepId: h.stepId, stepName: h.stepName, date: h.forecastStart, filled: h.filledCount, required: h.required.length, missing: h.missingCategories };
}

export interface MondayBuildRow {
  jobId: string;
  name: string;
  currentStageName: string | null;
  forecastFinish: ISODate | null;
  plannedFinish: ISODate | null;
  /** Forecast vs planned, calendar days. */
  lateDays: number;
  snapshotDate: ISODate | null;
  snapshotFinish: ISODate | null;
  /** Null before the first snapshot. */
  slipDays: number | null;
  slipCost: number | null;
  slipSincePlanDays: number | null;
  slipSincePlanCost: number | null;
  weeklyHoldingCost: number | null;
  lastConfirmed: ISODate | null;
  daysUnconfirmed: number | null;
  amber: boolean;
  freshnessText: string;
  /** Top three: late first, then overdue, then soonest act-by within 14 days. */
  waitingOn: WaitingRow[];
  /** Still to do with act-by on or before 7 days from today (includes passed). */
  actByDue: WaitingRow[];
  nextHoldPoint: HoldPointSummary | null;
}

export interface MondayDesignRow {
  jobId: string;
  name: string;
  path: ApprovalPath | null;
  stageName: string | null;
  outstanding: number;
  oldestDays: number | null;
  oldestTitle: string | null;
  oldestWaitingOn: string | null;
  amber: boolean;
  freshnessText: string;
}

export interface MondayView {
  today: ISODate;
  /** The Monday the slip is measured against. */
  weekOf: ISODate;
  builds: MondayBuildRow[];
  design: MondayDesignRow[];
}

export function mondayBuildRow(ds: Dataset, f: JobForecast, today: ISODate): MondayBuildRow {
  const job = ds.jobs.find((j) => j.id === f.jobId)!;
  const open = rowsForJob(ds, f, today);
  const dueBy = addCalendarDays(today, 7);
  return {
    jobId: job.id,
    name: job.name,
    currentStageName: f.currentStageName,
    forecastFinish: f.forecastFinish,
    plannedFinish: f.plannedFinish,
    lateDays: f.lateDays,
    snapshotDate: f.snapshot?.date ?? null,
    snapshotFinish: f.snapshot?.forecastFinish ?? null,
    slipDays: f.slipDays,
    slipCost: f.slipCost,
    slipSincePlanDays: f.slipSincePlanDays,
    slipSincePlanCost: f.slipSincePlanCost,
    weeklyHoldingCost: job.weeklyHoldingCost,
    lastConfirmed: job.lastConfirmed,
    daysUnconfirmed: f.freshness.daysUnconfirmed,
    amber: f.freshness.amber,
    freshnessText: f.freshness.text,
    waitingOn: rankWaiting(open, today).slice(0, 3),
    actByDue: open
      .filter((r) => r.status === 'to_do' && r.actBy && r.actBy <= dueBy)
      .sort((a, b) => (a.actBy ?? '').localeCompare(b.actBy ?? '')),
    nextHoldPoint: holdSummary(f.nextHoldPoint),
  };
}

export function mondayRows(ds: Dataset, today: ISODate, filter: SideFilter = {}): MondayView {
  const jobs = liveJobs(ds, filter);
  const builds = jobs
    .filter((j) => j.kind === 'build')
    .map((j) => mondayBuildRow(ds, forecastJob(ds, j.id, today), today))
    .sort((a, b) => (b.slipCost ?? -Infinity) - (a.slipCost ?? -Infinity) || a.name.localeCompare(b.name));
  const design = jobs
    .filter((j) => j.kind === 'design')
    .map((j) => {
      const c = designChecklist(ds, j.id, today);
      const oldest = c.items[0] ?? null;
      return {
        jobId: j.id,
        name: j.name,
        path: j.path,
        stageName: c.currentStageName,
        outstanding: c.outstanding,
        oldestDays: c.oldestDays,
        oldestTitle: oldest?.title ?? null,
        oldestWaitingOn: oldest?.waitingOn ?? null,
        amber: c.amber,
        freshnessText: c.freshnessText,
      } satisfies MondayDesignRow;
    })
    .sort((a, b) => (b.oldestDays ?? -1) - (a.oldestDays ?? -1) || a.name.localeCompare(b.name));
  return { today, weekOf: lastMonday(today), builds, design };
}

// ---------------------------------------------------------------------------
// Why it moved
// ---------------------------------------------------------------------------

export interface WhyCause {
  changeSetId: string;
  summary: string;
  confirmedAt: Instant | null;
  messageId: string | null;
  /** What Dominic sent: the text, or the voice note's transcript. */
  sourceText: string | null;
  sourceChannel: string | null;
  /** 'voice' when the source is a voice note's transcript, 'text' for a typed message, null with no message. */
  sourceKind: 'voice' | 'text' | null;
  /** When the source message came in. */
  sourceReceivedAt: Instant | null;
  /** Every field this change set changed, with before and after (same shape as change history). */
  changes: HistoryChange[];
  finishBefore: ISODate | null;
  finishAfter: ISODate | null;
  deltaDays: number;
  /** Holding cost of this change alone. */
  cost: number | null;
  movedSteps: MovedStep[];
}

export interface WhyItMoved {
  jobId: string;
  jobName: string;
  snapshotDate: ISODate | null;
  snapshotFinish: ISODate | null;
  forecastFinish: ISODate | null;
  slipDays: number | null;
  slipCost: number | null;
  /** Confirmed change sets since the snapshot that moved the finish or any step, oldest first. */
  causes: WhyCause[];
  /**
   * Days of slip no change set explains (finish with every change since the
   * snapshot taken back, minus the snapshot's finish). 0 when fully explained.
   */
  otherDays: number;
  /** Plain lines for a sheet or a Telegram reply. */
  lines: string[];
}

function changeSetTouchesJob(ds: Dataset, cs: ChangeSet, jobId: string): boolean {
  const changes = changesOf(ds, cs.id);
  if (jobIdsOfChanges(ds, changes).includes(jobId)) return true;
  // A shipment on another job feeding this job's items.
  return changes.some((c) => c.table === 'shipment' && ds.items.some((i) => i.jobId === jobId && i.shipmentId === c.rowId));
}

/**
 * Traces this week's slip to the change sets that caused it: take back every
 * confirmed change since the snapshot was saved, then replay them one by one,
 * rerunning the calculator after each. Each change's share is the finish it
 * moved; anything left over is reported as otherDays.
 */
export function whyItMoved(ds: Dataset, jobId: string, today: ISODate): WhyItMoved {
  const job = ds.jobs.find((j) => j.id === jobId);
  if (!job) throw new Error(`Unknown job ${jobId}`);
  const now = forecastJob(ds, jobId, today);
  const base: WhyItMoved = {
    jobId,
    jobName: job.name,
    snapshotDate: now.snapshot?.date ?? null,
    snapshotFinish: now.snapshot?.forecastFinish ?? null,
    forecastFinish: now.forecastFinish,
    slipDays: now.slipDays,
    slipCost: now.slipCost,
    causes: [],
    otherDays: 0,
    lines: [],
  };
  if (job.kind === 'design') return base;
  const since = now.snapshot?.savedAt ?? '';
  const sets = ds.changeSets
    .filter((cs) => cs.status === 'confirmed' && (cs.confirmedAt ?? '') > since && changeSetTouchesJob(ds, cs, jobId))
    .sort((a, b) => (a.confirmedAt ?? '').localeCompare(b.confirmedAt ?? ''));

  // Take them all back (lenient: later changes elsewhere must not block the explanation).
  let state = ds;
  for (const cs of [...sets].reverse()) state = applyChanges(state, invertChanges(changesOf(ds, cs.id)), { check: false });
  let prev = forecastJob(state, jobId, today);
  const startFinish = prev.forecastFinish;

  for (const cs of sets) {
    state = applyChanges(state, changesOf(ds, cs.id), { check: false });
    const next = forecastJob(state, jobId, today);
    const cmp = compareForecasts(jobId, job.name, prev, next, job.weeklyHoldingCost, today);
    if (cmp.finishDeltaDays !== 0 || cmp.movedSteps.length) {
      const msg = cs.messageId ? ds.inboundMessages.find((m) => m.id === cs.messageId) : undefined;
      base.causes.push({
        changeSetId: cs.id,
        summary: cs.summary,
        confirmedAt: cs.confirmedAt,
        messageId: cs.messageId,
        sourceText: msg ? (msg.transcript ?? msg.rawText) : null,
        sourceChannel: msg?.channel ?? null,
        sourceKind: msg ? (msg.transcript ? 'voice' : 'text') : null,
        sourceReceivedAt: msg?.receivedAt ?? null,
        changes: historyChanges(ds, changesOf(ds, cs.id)),
        finishBefore: cmp.finishBefore,
        finishAfter: cmp.finishAfter,
        deltaDays: cmp.finishDeltaDays,
        cost: cmp.costOfChange,
        movedSteps: cmp.movedSteps,
      });
    }
    prev = next;
  }
  if (base.snapshotFinish && startFinish) base.otherDays = calendarDaysBetween(base.snapshotFinish, startFinish);

  const fd = (d: ISODate | null) => (d ? formatDate(d, today) : 'no date');
  const signed = (n: number) => `${n > 0 ? '+' : ''}${n} day${Math.abs(n) === 1 ? '' : 's'}`;
  for (const c of base.causes) {
    base.lines.push(`${c.summary} (${signed(c.deltaDays)} on the finish)`);
    for (const m of c.movedSteps.slice(0, 3)) base.lines.push(`  ${m.text}`);
    if (c.movedSteps.length > 3) base.lines.push(`  and ${c.movedSteps.length - 3} more steps`);
  }
  if (base.otherDays) {
    const n = Math.abs(base.otherDays);
    base.lines.push(`${n} day${n === 1 ? '' : 's'} ${base.otherDays < 0 ? 'earlier' : 'later'} for reasons not in the change log`);
  }
  if (base.slipDays !== null && base.snapshotFinish) {
    base.lines.push(`Finish ${fd(base.forecastFinish)}, ${signed(base.slipDays)} against Monday's ${fd(base.snapshotFinish)}`);
  }
  return base;
}

// ---------------------------------------------------------------------------
// Jobs list and overview
// ---------------------------------------------------------------------------

export interface JobListRow {
  jobId: string;
  sideId: string;
  name: string;
  kind: 'build' | 'design';
  path: ApprovalPath | null;
  currentStageName: string | null;
  forecastFinish: ISODate | null;
  slipDays: number | null;
  amber: boolean;
  freshnessText: string;
}

export interface JobsListView {
  builds: JobListRow[];
  design: JobListRow[];
}

export function jobsList(ds: Dataset, today: ISODate, filter: SideFilter = {}): JobsListView {
  const rows = liveJobs(ds, filter).map((j): JobListRow => {
    const f = forecastJob(ds, j.id, today);
    return {
      jobId: j.id,
      sideId: j.sideId,
      name: j.name,
      kind: j.kind,
      path: j.path,
      currentStageName: f.currentStageName,
      forecastFinish: f.forecastFinish,
      slipDays: f.slipDays,
      amber: f.freshness.amber,
      freshnessText: f.freshness.text,
    };
  });
  return { builds: rows.filter((r) => r.kind === 'build'), design: rows.filter((r) => r.kind === 'design') };
}

export interface JobOverview {
  job: Job;
  forecast: JobForecast;
  stages: StageForecast[];
  nextHoldPoint: HoldPointCheck | null;
  waitingOn: WaitingRow[];
  notesThisWeek: DailyNote[];
  latestPhotos: Photo[];
  shipments: ShipmentRow[];
}

export function jobOverview(ds: Dataset, jobId: string, today: ISODate): JobOverview {
  const job = ds.jobs.find((j) => j.id === jobId);
  if (!job) throw new Error(`Unknown job ${jobId}`);
  const f = forecastJob(ds, jobId, today);
  const monday = lastMonday(today);
  return {
    job: { ...job },
    forecast: f,
    stages: f.stages,
    nextHoldPoint: f.nextHoldPoint,
    waitingOn: rankWaiting(rowsForJob(ds, f, today), today).slice(0, 5),
    notesThisWeek: ds.dailyNotes.filter((n) => n.jobId === jobId && n.date >= monday && n.date <= today).sort((a, b) => b.date.localeCompare(a.date)),
    latestPhotos: ds.photos.filter((p) => p.jobId === jobId).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).slice(0, 6),
    shipments: shipmentsList(ds, today).filter((s) => s.jobId === jobId),
  };
}

// ---------------------------------------------------------------------------
// Program and step detail
// ---------------------------------------------------------------------------

/** A step as the program draws it: its forecast plus the trade and stage names. */
export interface ProgramStep extends StepForecast {
  stageName: string;
  tradeType: string | null;
}

export interface ProgramView {
  job: Job;
  forecast: JobForecast;
  stages: StageForecast[];
  /** Dependency order. */
  steps: ProgramStep[];
  links: { stepId: string; waitsForStepId: string }[];
  /** Open items linked to a step (what each step needs), act-by order. */
  items: WaitingRow[];
  /** Shutdown periods (no working days), for shading. */
  shutdowns: DateRange[];
}

function programStep(ds: Dataset, f: JobForecast, id: string): ProgramStep {
  const sf = f.steps[id]!;
  return {
    ...sf,
    stageName: ds.stages.find((st) => st.id === sf.stageId)?.name ?? '',
    tradeType: ds.steps.find((s) => s.id === id)?.tradeType ?? null,
  };
}

export function programView(ds: Dataset, jobId: string, today: ISODate): ProgramView {
  const job = ds.jobs.find((j) => j.id === jobId);
  if (!job) throw new Error(`Unknown job ${jobId}`);
  const f = forecastJob(ds, jobId, today);
  return {
    job: { ...job },
    forecast: f,
    stages: f.stages,
    steps: f.stepOrder.map((id) => programStep(ds, f, id)),
    links: ds.stepLinks.filter((l) => l.jobId === jobId).map((l) => ({ stepId: l.stepId, waitsForStepId: l.waitsForStepId })),
    items: rowsForJob(ds, f, today)
      .filter((r) => r.stepId)
      .sort((a, b) => (a.actBy ?? '9999-12-31').localeCompare(b.actBy ?? '9999-12-31') || a.title.localeCompare(b.title)),
    shutdowns: SHUTDOWNS.map((r) => ({ ...r })),
  };
}

export interface StepDetail {
  jobId: string;
  jobName: string;
  stageName: string;
  step: ProgramStep;
  waitsFor: { stepId: string; name: string; forecastEnd: ISODate }[];
  holdsUp: { stepId: string; name: string; forecastStart: ISODate }[];
  requirements: { id: string; kind: 'trade' | 'material'; name: string; leadTimeWeeks: number }[];
  items: WaitingRow[];
  holdPoint: HoldPointCheck | null;
}

export function stepDetail(ds: Dataset, stepId: string, today: ISODate): StepDetail {
  const s = ds.steps.find((x) => x.id === stepId);
  if (!s) throw new Error(`Unknown step ${stepId}`);
  const f = forecastJob(ds, s.jobId, today);
  const sf = f.steps[stepId]!;
  return {
    jobId: s.jobId,
    jobName: ds.jobs.find((j) => j.id === s.jobId)?.name ?? s.jobId,
    stageName: ds.stages.find((st) => st.id === s.stageId)?.name ?? '',
    step: programStep(ds, f, stepId),
    waitsFor: sf.waitsFor.map((id) => ({ stepId: id, name: f.steps[id]!.name, forecastEnd: f.steps[id]!.forecastEnd })),
    holdsUp: sf.holdsUp.map((id) => ({ stepId: id, name: f.steps[id]!.name, forecastStart: f.steps[id]!.forecastStart })),
    requirements: ds.requirements.filter((r) => r.stepId === stepId).map((r) => ({ id: r.id, kind: r.kind, name: r.name, leadTimeWeeks: r.leadTimeWeeks })),
    items: ds.items.filter((i) => i.stepId === stepId).map((i) => waitingRow(ds, f, i, today)),
    holdPoint: s.isHoldPoint ? holdPointCheck(s, ds.photoCategories, ds.photos, sf.forecastStart) : null,
  };
}

// ---------------------------------------------------------------------------
// Waiting-on list and to-chase list
// ---------------------------------------------------------------------------

export interface WaitingFilter extends SideFilter {
  jobId?: string;
  type?: ItemType;
  /** Plain-text owner, case-insensitive. */
  owner?: string;
  status?: ItemStatus;
  includeDone?: boolean;
}

export type WaitingGroupKey = 'overdue' | 'this_week' | 'next_week' | 'later';

export interface WaitingOnView {
  total: number;
  groups: { key: WaitingGroupKey; label: string; rows: WaitingRow[] }[];
}

function allRows(ds: Dataset, today: ISODate, f: WaitingFilter): WaitingRow[] {
  const out: WaitingRow[] = [];
  for (const j of liveJobs(ds, f)) {
    if (f.jobId && j.id !== f.jobId) continue;
    out.push(...rowsForJob(ds, forecastJob(ds, j.id, today), today, f.includeDone));
  }
  return out.filter(
    (r) => (!f.type || r.type === f.type) && (!f.status || r.status === f.status) && (!f.owner || (r.owner ?? '').toLowerCase() === f.owner.toLowerCase()),
  );
}

export function waitingOn(ds: Dataset, today: ISODate, filter: WaitingFilter = {}): WaitingOnView {
  const rows = allRows(ds, today, filter).sort(
    (a, b) => (a.actBy ?? '9999-12-31').localeCompare(b.actBy ?? '9999-12-31') || a.title.localeCompare(b.title),
  );
  const endThisWeek = addCalendarDays(lastMonday(today), 6);
  const endNextWeek = addCalendarDays(endThisWeek, 7);
  const groups: WaitingOnView['groups'] = [
    { key: 'overdue', label: 'Overdue', rows: [] },
    { key: 'this_week', label: 'Act this week', rows: [] },
    { key: 'next_week', label: 'Act next week', rows: [] },
    { key: 'later', label: 'Later', rows: [] },
  ];
  for (const r of rows) {
    const g = r.overdue ? 0 : r.actBy && r.actBy <= endThisWeek ? 1 : r.actBy && r.actBy <= endNextWeek ? 2 : 3;
    groups[g]!.rows.push(r);
  }
  return { total: rows.length, groups };
}

export interface ToChaseFilter extends SideFilter {
  owner?: string;
  /** Act-by within this many days, or past. Default 14. */
  withinDays?: number;
}

export interface ToChaseView {
  owner: string | null;
  total: number;
  /** Every live job is listed, so a job with nothing to chase can still be confirmed. */
  jobs: { jobId: string; jobName: string; amber: boolean; freshnessText: string; lastConfirmed: ISODate | null; rows: WaitingRow[] }[];
}

/** Items still to do or ordered/booked whose act-by is within 14 days or past, grouped by job; to-do first, then by act-by. */
export function toChase(ds: Dataset, today: ISODate, filter: ToChaseFilter = {}): ToChaseView {
  const horizon = addCalendarDays(today, filter.withinDays ?? 14);
  const jobs = liveJobs(ds, filter).map((j) => {
    const f = forecastJob(ds, j.id, today);
    const rows = rowsForJob(ds, f, today)
      .filter((r) => (r.status === 'to_do' || r.status === 'ordered_or_booked') && r.actBy && r.actBy <= horizon)
      .filter((r) => !filter.owner || (r.owner ?? '').toLowerCase() === filter.owner.toLowerCase())
      // Things to book first, then things to confirm; each by act-by.
      .sort((a, b) => Number(a.status !== 'to_do') - Number(b.status !== 'to_do') || (a.actBy ?? '').localeCompare(b.actBy ?? '') || a.title.localeCompare(b.title));
    return { jobId: j.id, jobName: j.name, amber: f.freshness.amber, freshnessText: f.freshness.text, lastConfirmed: j.lastConfirmed, rows };
  });
  return { owner: filter.owner ?? null, total: jobs.reduce((n, j) => n + j.rows.length, 0), jobs };
}

// ---------------------------------------------------------------------------
// Shipments
// ---------------------------------------------------------------------------

export interface ShipmentRow {
  shipmentId: string;
  name: string;
  jobId: string;
  jobName: string;
  supplier: string | null;
  status: ShipmentStatus;
  statusLabel: string;
  eta: ISODate | null;
  linkedItemIds: string[];
  linkedCount: number;
  /** The linked items themselves (open and done), in title order. */
  linkedItems: { itemId: string; title: string; status: ItemStatus; statusLabel: string; owner: string | null; neededBy: ISODate | null }[];
  /** Earliest needed-by among linked open items. */
  earliestNeededBy: ISODate | null;
  /** ETA after the earliest needed-by. */
  isLate: boolean;
  lateDays: number;
  owners: string[];
}

export function shipmentsList(ds: Dataset, today: ISODate, filter: SideFilter = {}): ShipmentRow[] {
  const live = new Map(liveJobs(ds, filter).map((j) => [j.id, j]));
  const forecasts = new Map<string, JobForecast>();
  const fc = (jobId: string) => {
    if (!forecasts.has(jobId)) forecasts.set(jobId, forecastJob(ds, jobId, today));
    return forecasts.get(jobId)!;
  };
  return ds.shipments
    .filter((s) => live.has(s.jobId))
    .map((s) => {
      const linked = ds.items.filter((i) => i.shipmentId === s.id);
      const open = linked.filter((i) => i.status !== 'done');
      const needed = open.map((i) => fc(i.jobId).items[i.id]?.neededBy ?? null).filter((d): d is ISODate => !!d).sort();
      const earliest = needed[0] ?? null;
      const lateDays = earliest && s.eta && s.eta > earliest ? calendarDaysBetween(earliest, s.eta) : 0;
      return {
        shipmentId: s.id,
        name: s.name,
        jobId: s.jobId,
        jobName: live.get(s.jobId)!.name,
        supplier: s.supplier,
        status: s.status,
        statusLabel: SHIPMENT_STATUS_LABELS[s.status],
        eta: s.eta,
        linkedItemIds: linked.map((i) => i.id),
        linkedCount: linked.length,
        linkedItems: linked
          .map((i) => ({
            itemId: i.id,
            title: i.title,
            status: i.status,
            statusLabel: ITEM_STATUS_LABELS[i.status],
            owner: i.owner,
            neededBy: fc(i.jobId).items[i.id]?.neededBy ?? null,
          }))
          .sort((a, b) => a.title.localeCompare(b.title)),
        earliestNeededBy: earliest,
        isLate: lateDays > 0,
        lateDays,
        owners: [...new Set(linked.map((i) => i.owner).filter((o): o is string => !!o))],
      };
    })
    .sort((a, b) => (a.eta ?? '9999').localeCompare(b.eta ?? '9999'));
}

// ---------------------------------------------------------------------------
// Change history
// ---------------------------------------------------------------------------

export interface HistoryChange {
  kind: ChangeKind;
  table: TableName;
  rowId: string;
  /** "Park Rd windows", "Book tiler". */
  rowLabel: string;
  field: string | null;
  before: JsonValue;
  after: JsonValue;
}

export interface HistoryEntry {
  changeSetId: string;
  status: ChangeSetStatus;
  summary: string;
  opName: string | null;
  createdAt: Instant;
  confirmedAt: Instant | null;
  cancelledAt: Instant | null;
  undoneAt: Instant | null;
  message: { id: string; channel: string; rawText: string | null; transcript: string | null; receivedAt: Instant } | null;
  jobIds: string[];
  jobNames: string[];
  changes: HistoryChange[];
  /**
   * What a confirmed change set did to each build job's forecast finish, found by taking back every
   * confirmed change from this one on and replaying them in order (as whyItMoved does). Only jobs whose
   * finish or steps it moved; empty for other statuses, or when changeHistory was called without today.
   */
  effects: HistoryEffect[];
}

export interface HistoryEffect {
  jobId: string;
  jobName: string;
  finishBefore: ISODate | null;
  finishAfter: ISODate | null;
  /** Calendar days the finish moved (+ later). */
  deltaDays: number;
  /** deltaDays / 7 x the job's weekly holding cost, nearest $10. */
  cost: number | null;
  /** Steps whose forecast start moved. */
  movedSteps: number;
}

export interface HistoryFilter extends SideFilter {
  jobId?: string;
  /** Default: everything but proposed. */
  statuses?: ChangeSetStatus[];
  limit?: number;
}

function rowLabel(ds: Dataset, table: TableName, rowId: string, row: JsonValue): string {
  const r = (row && typeof row === 'object' && !Array.isArray(row) ? row : null) as Record<string, JsonValue> | null;
  const live = (() => {
    switch (table) {
      case 'item':
        return ds.items.find((x) => x.id === rowId)?.title;
      case 'shipment':
        return ds.shipments.find((x) => x.id === rowId)?.name;
      case 'step':
        return ds.steps.find((x) => x.id === rowId)?.name;
      case 'stage':
        return ds.stages.find((x) => x.id === rowId)?.name;
      case 'job':
        return ds.jobs.find((x) => x.id === rowId)?.name;
      case 'trade':
        return ds.trades.find((x) => x.id === rowId)?.name;
      case 'photo_category':
        return ds.photoCategories.find((x) => x.id === rowId)?.name;
      default:
        return undefined;
    }
  })();
  const fromRow = r ? (r.title ?? r.name ?? r.text ?? r.caption ?? null) : null;
  return String(live ?? fromRow ?? rowId);
}

/** Changes as people read them: row label, field, before and after. */
export function historyChanges(ds: Dataset, changes: Change[]): HistoryChange[] {
  return changes.map((c) => ({
    kind: c.kind,
    table: c.table,
    rowId: c.rowId,
    rowLabel: rowLabel(ds, c.table, c.rowId, c.kind === 'update' ? null : c.row),
    field: c.kind === 'update' ? c.field : null,
    before: c.kind === 'update' ? c.before : c.kind === 'delete' ? c.row : null,
    after: c.kind === 'update' ? c.after : c.kind === 'insert' ? c.row : null,
  }));
}

/** Build jobs whose forecast a change set can move: jobs it touches, and jobs fed by a shipment it changes. */
function forecastJobsOf(ds: Dataset, changes: Change[]): string[] {
  const ids = new Set(jobIdsOfChanges(ds, changes));
  for (const c of changes) if (c.table === 'shipment') for (const i of ds.items) if (i.shipmentId === c.rowId) ids.add(i.jobId);
  return [...ids].filter((id) => {
    const j = ds.jobs.find((x) => x.id === id);
    return !!j && j.kind === 'build' && !j.isTemplate;
  });
}

/** Effects of confirmed change sets on or after `since`, keyed by change set id (see HistoryEntry.effects). */
function historyEffects(ds: Dataset, since: Instant, today: ISODate): Map<string, HistoryEffect[]> {
  const sets = ds.changeSets
    .filter((cs) => cs.status === 'confirmed' && (cs.confirmedAt ?? '') >= since)
    .sort((a, b) => (a.confirmedAt ?? '').localeCompare(b.confirmedAt ?? ''));
  let state = ds;
  for (const cs of [...sets].reverse()) state = applyChanges(state, invertChanges(changesOf(ds, cs.id)), { check: false });
  const out = new Map<string, HistoryEffect[]>();
  for (const cs of sets) {
    const changes = changesOf(ds, cs.id);
    const jobs = forecastJobsOf(ds, changes);
    const next = applyChanges(state, changes, { check: false });
    const effects: HistoryEffect[] = [];
    for (const id of jobs) {
      const job = ds.jobs.find((j) => j.id === id)!;
      const safe = (d: Dataset) => (d.jobs.some((j) => j.id === id) ? forecastJob(d, id, today) : null);
      const before = safe(state);
      const after = safe(next);
      const cmp = compareForecasts(id, job.name, before, after, job.weeklyHoldingCost, today);
      if (cmp.finishDeltaDays !== 0 || cmp.movedSteps.length) {
        effects.push({
          jobId: id,
          jobName: job.name,
          finishBefore: cmp.finishBefore,
          finishAfter: cmp.finishAfter,
          deltaDays: cmp.finishDeltaDays,
          cost: slipCost(cmp.finishDeltaDays, job.weeklyHoldingCost),
          movedSteps: cmp.movedSteps.length,
        });
      }
    }
    out.set(cs.id, effects);
    state = next;
  }
  return out;
}

function sidesOfEntry(ds: Dataset, jobIds: string[], changes: Change[]): Set<string> {
  const sides = new Set<string>();
  for (const id of jobIds) {
    const j = ds.jobs.find((x) => x.id === id);
    if (j) sides.add(j.sideId);
  }
  for (const c of changes) {
    if (c.table !== 'trade') continue;
    const t = ds.trades.find((x) => x.id === c.rowId) ?? (c.kind !== 'update' ? (c.row as unknown as Trade) : undefined);
    if (t?.sideId) sides.add(t.sideId);
  }
  return sides;
}

/**
 * Change sets newest first. With `today`, each confirmed entry carries its forecast effects. With
 * `sideId`, only entries touching a job (or trade) on that side.
 */
export function changeHistory(ds: Dataset, filter: HistoryFilter = {}, today?: ISODate): HistoryEntry[] {
  const statuses = filter.statuses ?? ['confirmed', 'undone', 'cancelled'];
  const entries = ds.changeSets
    .filter((cs) => statuses.includes(cs.status))
    .map((cs): HistoryEntry => {
      const changes = changesOf(ds, cs.id);
      const jobIds = jobIdsOfChanges(ds, changes);
      const msg = cs.messageId ? ds.inboundMessages.find((m) => m.id === cs.messageId) : undefined;
      return {
        changeSetId: cs.id,
        status: cs.status,
        summary: cs.summary,
        opName: cs.opName,
        createdAt: cs.createdAt,
        confirmedAt: cs.confirmedAt,
        cancelledAt: cs.cancelledAt,
        undoneAt: cs.undoneAt,
        message: msg ? { id: msg.id, channel: msg.channel, rawText: msg.rawText, transcript: msg.transcript, receivedAt: msg.receivedAt } : null,
        jobIds,
        jobNames: jobIds.map((id) => ds.jobs.find((j) => j.id === id)?.name ?? id),
        changes: historyChanges(ds, changes),
        effects: [],
      };
    })
    .filter((e) => !filter.jobId || e.jobIds.includes(filter.jobId))
    .filter((e) => !filter.sideId || sidesOfEntry(ds, e.jobIds, changesOf(ds, e.changeSetId)).has(filter.sideId))
    .sort((a, b) => (b.confirmedAt ?? b.createdAt).localeCompare(a.confirmedAt ?? a.createdAt));
  const page = filter.limit ? entries.slice(0, filter.limit) : entries;
  const confirmed = page.filter((e) => e.status === 'confirmed' && e.confirmedAt);
  if (today && confirmed.length) {
    const since = confirmed.map((e) => e.confirmedAt!).sort()[0]!;
    const effects = historyEffects(ds, since, today);
    for (const e of confirmed) e.effects = effects.get(e.changeSetId) ?? [];
  }
  return page;
}

// ---------------------------------------------------------------------------
// Design checklist
// ---------------------------------------------------------------------------

export interface DesignChecklist {
  jobId: string;
  name: string;
  path: ApprovalPath | null;
  stages: { stageId: string; name: string; order: number; status: StageStatus; isCurrent: boolean }[];
  currentStageId: string | null;
  currentStageName: string | null;
  outstanding: number;
  /** Days the oldest outstanding item has been sitting; null when none. */
  oldestDays: number | null;
  /** Outstanding items, oldest first. */
  items: {
    itemId: string;
    title: string;
    type: ItemType;
    typeLabel: string;
    status: ItemStatus;
    statusLabel: string;
    waitingOn: string | null;
    owner: string | null;
    daysSitting: number;
    neededBy: ISODate | null;
    expected: ISODate | null;
    notes: string | null;
  }[];
  /** Items finished on this job, newest first. */
  done: { itemId: string; title: string; typeLabel: string; doneAt: ISODate | null }[];
  lastConfirmed: ISODate | null;
  daysUnconfirmed: number | null;
  amber: boolean;
  freshnessText: string;
}

export function designChecklist(ds: Dataset, jobId: string, today: ISODate): DesignChecklist {
  const job = ds.jobs.find((j) => j.id === jobId);
  if (!job) throw new Error(`Unknown job ${jobId}`);
  const stages = ds.stages.filter((s) => s.jobId === jobId).sort((a, b) => a.order - b.order);
  const current = stages.find((s) => s.status !== 'done') ?? null;
  const items = ds.items
    .filter((i) => i.jobId === jobId && i.status !== 'done')
    .map((i) => ({
      itemId: i.id,
      title: i.title,
      type: i.type,
      typeLabel: ITEM_TYPE_LABELS[i.type],
      status: i.status,
      statusLabel: ITEM_STATUS_LABELS[i.status],
      waitingOn: i.waitingOn,
      owner: i.owner,
      daysSitting: calendarDaysBetween(i.createdAt, today),
      neededBy: i.neededBy,
      expected: i.expectedDate,
      notes: i.notes,
    }))
    .sort((a, b) => b.daysSitting - a.daysSitting);
  const done = ds.items
    .filter((i) => i.jobId === jobId && i.status === 'done')
    .map((i) => ({ itemId: i.id, title: i.title, typeLabel: ITEM_TYPE_LABELS[i.type], doneAt: i.doneAt }))
    .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));
  const fresh = forecastJob(ds, jobId, today).freshness;
  return {
    jobId,
    name: job.name,
    path: job.path,
    stages: stages.map((s) => ({ stageId: s.id, name: s.name, order: s.order, status: s.status, isCurrent: s.id === current?.id })),
    currentStageId: current?.id ?? null,
    currentStageName: current?.name ?? null,
    outstanding: items.length,
    oldestDays: items[0]?.daysSitting ?? null,
    items,
    done,
    lastConfirmed: fresh.lastConfirmed,
    daysUnconfirmed: fresh.daysUnconfirmed,
    amber: fresh.amber,
    freshnessText: fresh.text,
  };
}

// ---------------------------------------------------------------------------
// Photos, notes, trades, templates
// ---------------------------------------------------------------------------

export interface PhotoGallery {
  jobId: string;
  groups: { stageId: string | null; stageName: string; categories: { categoryId: string; name: string; requiredForHoldPoint: boolean; photos: Photo[] }[] }[];
}

export function photoGallery(ds: Dataset, jobId: string): PhotoGallery {
  const stages = ds.stages.filter((s) => s.jobId === jobId).sort((a, b) => a.order - b.order);
  const cats = ds.photoCategories.filter((c) => c.jobId === jobId).sort((a, b) => a.order - b.order);
  const photosOf = (cid: string) => ds.photos.filter((p) => p.categoryId === cid).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const group = (stageId: string | null, stageName: string) => ({
    stageId,
    stageName,
    categories: cats
      .filter((c) => c.stageId === stageId)
      .map((c) => ({ categoryId: c.id, name: c.name, requiredForHoldPoint: c.requiredForHoldPoint, photos: photosOf(c.id) })),
  });
  return { jobId, groups: [group(null, 'Whole job'), ...stages.map((s) => group(s.id, s.name))].filter((g) => g.categories.length) };
}

export function dailyNotes(ds: Dataset, jobId: string, opts: { from?: ISODate; to?: ISODate } = {}): DailyNote[] {
  return ds.dailyNotes
    .filter((n) => n.jobId === jobId && (!opts.from || n.date >= opts.from) && (!opts.to || n.date <= opts.to))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function tradesList(ds: Dataset, filter: SideFilter = {}): (Trade & { openItems: number })[] {
  return ds.trades
    .filter((t) => !filter.sideId || t.sideId === filter.sideId)
    .map((t) => ({ ...t, openItems: ds.items.filter((i) => i.tradeId === t.id && i.status !== 'done').length }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface TemplateRow {
  jobId: string;
  name: string;
  kind: 'build' | 'design';
  stages: number;
  steps: number;
  workingDays: number;
}

export function templatesList(ds: Dataset, filter: SideFilter = {}): TemplateRow[] {
  return ds.jobs
    .filter((j) => j.isTemplate && (!filter.sideId || j.sideId === filter.sideId))
    .map((j) => {
      const steps = ds.steps.filter((s) => s.jobId === j.id);
      return {
        jobId: j.id,
        name: j.name,
        kind: j.kind,
        stages: ds.stages.filter((s) => s.jobId === j.id).length,
        steps: steps.length,
        workingDays: steps.reduce((n, s) => n + s.durationDays, 0),
      };
    });
}
