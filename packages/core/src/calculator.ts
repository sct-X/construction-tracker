/**
 * The forecast calculator. Pure: dataset + today in, dates out.
 *
 * Rules (SPEC.md):
 *  1. Item needed-by = its step's forecast start computed WITHOUT that item's
 *     own expected date, and without the other items on the same shipment
 *     (they share the ETA). Act-by = needed-by minus lead time (calendar weeks).
 *  2. Step forecast start = latest of planned start, the working day after every
 *     step it waits for ends, and the expected date of every not-done item it
 *     needs (snapped forward to a working day).
 *  3. Job forecast finish = latest forecast end of any step. Late = forecast vs planned.
 *  4. Slip = forecast finish minus last Monday's snapshot, calendar days.
 *     Slip cost = slip / 7 x weekly holding cost, nearest $10.
 *  5. Working days: Mon-Fri minus the shutdown (dates.ts). Step end is inclusive.
 *  6. Hold point: every required photo category needs at least one photo.
 *  7. Amber after more than 7 days unconfirmed; never confirmed is amber.
 *  9. Design jobs: stages as a checklist, no steps, no finish.
 * Started and done steps use their actual start (and end) when recorded, else planned.
 */
import {
  addCalendarWeeks,
  calendarDaysBetween,
  formatDayMonth,
  lastMonday,
  maxDate,
  minDate,
  nextWorkingDay,
  relativeDays,
  snapToWorkingDay,
  stepEnd,
} from './dates.js';
import { slipCost as slipCostFor } from './money.js';
import type {
  Dataset,
  ForecastSnapshot,
  ISODate,
  Instant,
  Item,
  ItemStatus,
  ItemType,
  Job,
  JobKind,
  Photo,
  PhotoCategory,
  Requirement,
  Shipment,
  Stage,
  StageStatus,
  Step,
  StepLink,
  StepStatus,
} from './types.js';

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type StartDriver =
  | { kind: 'planned' }
  | { kind: 'started' }
  | { kind: 'step'; stepId: string; stepName: string; finish: ISODate }
  | { kind: 'item'; itemId: string; title: string; expected: ISODate; shipmentId: string | null; shipmentName: string | null };

export interface StepForecast {
  stepId: string;
  stageId: string;
  name: string;
  order: number;
  status: StepStatus;
  isHoldPoint: boolean;
  isPlaceholder: boolean;
  durationDays: number;
  plannedStart: ISODate | null;
  plannedEnd: ISODate | null;
  forecastStart: ISODate;
  forecastEnd: ISODate;
  /** Forecast end minus planned end, calendar days, never below 0. */
  lateDays: number;
  isLate: boolean;
  driver: StartDriver;
  /** "Starts 16 Nov, not 2 Nov, because the Park Rd windows shipment is expected 16 Nov." */
  reason: string;
  waitsFor: string[];
  holdsUp: string[];
  itemIds: string[];
}

export interface ItemForecast {
  itemId: string;
  jobId: string;
  stepId: string | null;
  status: ItemStatus;
  type: ItemType;
  neededBy: ISODate | null;
  actBy: ISODate | null;
  /** The item's expected date, or its shipment's ETA. */
  expected: ISODate | null;
  expectedFromShipmentId: string | null;
  leadTimeWeeks: number;
  /** Expected after needed-by, or needed-by passed with nothing expected. Calendar days. */
  lateDays: number;
  isLate: boolean;
  /** "14 days after needed" or "overdue by 3 days". Null when not late. */
  lateText: string | null;
  /** Act-by has passed and it is still to do. */
  actByPassed: boolean;
  /** Days since the item was created ("oldest 23 days"). */
  daysSitting: number;
}

export interface StageForecast {
  stageId: string;
  name: string;
  order: number;
  status: StageStatus;
  plannedStart: ISODate | null;
  plannedEnd: ISODate | null;
  forecastStart: ISODate | null;
  forecastEnd: ISODate | null;
  lateDays: number;
  isLate: boolean;
  stepIds: string[];
}

export interface HoldPointCategory {
  categoryId: string;
  name: string;
  photoCount: number;
}

export interface HoldPointCheck {
  stepId: string;
  stepName: string;
  stageId: string;
  forecastStart: ISODate | null;
  status: StepStatus;
  required: HoldPointCategory[];
  /** Names of required categories with no photo, in category order. */
  missingCategories: string[];
  filledCount: number;
  ok: boolean;
}

export interface Freshness {
  lastConfirmed: ISODate | null;
  daysUnconfirmed: number | null;
  amber: boolean;
  /** "Last confirmed 9 days ago", "Never confirmed". */
  text: string;
}

export interface JobForecast {
  jobId: string;
  kind: JobKind;
  today: ISODate;
  forecastFinish: ISODate | null;
  plannedFinish: ISODate | null;
  /** Forecast finish minus planned finish, calendar days (can be negative). */
  lateDays: number;
  isLate: boolean;
  snapshot: { id: string; date: ISODate; forecastFinish: ISODate | null; savedAt: Instant } | null;
  /** Null until a snapshot exists ("Slip appears after the first Monday"). */
  slipDays: number | null;
  slipCost: number | null;
  /** Against the original plan. */
  slipSincePlanDays: number | null;
  slipSincePlanCost: number | null;
  weeklyHoldingCost: number | null;
  freshness: Freshness;
  currentStageId: string | null;
  currentStageName: string | null;
  stages: StageForecast[];
  /** Keyed by step id; also in dependency order in `stepOrder`. */
  steps: Record<string, StepForecast>;
  stepOrder: string[];
  items: Record<string, ItemForecast>;
  holdPoints: HoldPointCheck[];
  nextHoldPoint: HoldPointCheck | null;
}

// ---------------------------------------------------------------------------
// Job slice
// ---------------------------------------------------------------------------

export interface JobSlice {
  job: Job;
  stages: Stage[];
  steps: Step[];
  links: StepLink[];
  requirements: Requirement[];
  items: Item[];
  shipments: Shipment[];
  snapshots: ForecastSnapshot[];
  photoCategories: PhotoCategory[];
  photos: Photo[];
}

export function jobSlice(ds: Dataset, jobId: string): JobSlice {
  const job = ds.jobs.find((j) => j.id === jobId);
  if (!job) throw new Error(`Unknown job ${jobId}`);
  const byJob = <T extends { jobId: string }>(rows: T[]) => rows.filter((r) => r.jobId === jobId);
  const items = byJob(ds.items);
  // A shipment on another job can still feed an item here.
  const shipIds = new Set(items.map((i) => i.shipmentId).filter(Boolean));
  return {
    job,
    stages: byJob(ds.stages),
    steps: byJob(ds.steps),
    links: byJob(ds.stepLinks),
    requirements: byJob(ds.requirements),
    items,
    shipments: ds.shipments.filter((s) => s.jobId === jobId || shipIds.has(s.id)),
    snapshots: byJob(ds.snapshots),
    photoCategories: byJob(ds.photoCategories),
    photos: byJob(ds.photos),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

/** Steps in dependency order (every step after the steps it waits for). Cycles are broken, never thrown. */
export function topoSortSteps(steps: Step[], links: StepLink[], stages: Stage[]): Step[] {
  const stageOrder = new Map(stages.map((s) => [s.id, s.order]));
  const natural = [...steps].sort(
    (a, b) => (stageOrder.get(a.stageId) ?? 0) - (stageOrder.get(b.stageId) ?? 0) || a.order - b.order,
  );
  const ids = new Set(steps.map((s) => s.id));
  const preds = new Map<string, Set<string>>(natural.map((s) => [s.id, new Set()]));
  for (const l of links) if (ids.has(l.stepId) && ids.has(l.waitsForStepId)) preds.get(l.stepId)!.add(l.waitsForStepId);
  const out: Step[] = [];
  const done = new Set<string>();
  let remaining = natural;
  while (remaining.length) {
    const ready = remaining.filter((s) => [...preds.get(s.id)!].every((p) => done.has(p)));
    if (!ready.length) ready.push(remaining[0]!);
    for (const s of ready) {
      out.push(s);
      done.add(s.id);
    }
    remaining = remaining.filter((s) => !done.has(s.id));
  }
  return out;
}

function effectiveExpected(item: Item, shipmentsById: Map<string, Shipment>): { date: ISODate | null; shipmentId: string | null } {
  if (item.shipmentId) {
    const sh = shipmentsById.get(item.shipmentId);
    if (sh) return { date: sh.eta, shipmentId: sh.id };
  }
  return { date: item.expectedDate, shipmentId: null };
}

export function leadTimeWeeksFor(item: Item, requirements: Requirement[]): number {
  if (item.leadTimeWeeks !== null) return item.leadTimeWeeks;
  if (item.requirementId) {
    const r = requirements.find((x) => x.id === item.requirementId);
    if (r) return r.leadTimeWeeks;
  }
  return 0;
}

/** Rule 7. */
export function freshnessFor(job: Job, today: ISODate): Freshness {
  if (!job.lastConfirmed) return { lastConfirmed: null, daysUnconfirmed: null, amber: true, text: 'Never confirmed' };
  const days = calendarDaysBetween(job.lastConfirmed, today);
  return {
    lastConfirmed: job.lastConfirmed,
    daysUnconfirmed: days,
    amber: days > 7,
    text: `Last confirmed ${relativeDays(job.lastConfirmed, today)}`,
  };
}

export function stageStatusFromSteps(steps: Step[]): StageStatus {
  if (!steps.length) return 'not_started';
  if (steps.every((s) => s.status === 'done')) return 'done';
  if (steps.some((s) => s.status !== 'not_started')) return 'in_progress';
  return 'not_started';
}

/** Rule 6 as a pure check: the step's stage's required categories and their photo counts. */
export function holdPointCheck(
  step: Step,
  photoCategories: PhotoCategory[],
  photos: Photo[],
  forecastStart: ISODate | null = step.plannedStart,
): HoldPointCheck {
  const required = photoCategories
    .filter((c) => c.jobId === step.jobId && c.stageId === step.stageId && c.requiredForHoldPoint)
    .sort(byOrder)
    .map((c) => ({ categoryId: c.id, name: c.name, photoCount: photos.filter((p) => p.categoryId === c.id).length }));
  const missingCategories = required.filter((r) => r.photoCount === 0).map((r) => r.name);
  return {
    stepId: step.id,
    stepName: step.name,
    stageId: step.stageId,
    forecastStart,
    status: step.status,
    required,
    missingCategories,
    filledCount: required.length - missingCategories.length,
    ok: missingCategories.length === 0,
  };
}

/** Last Monday's snapshot; failing that, the latest one dated on or before today. */
export function pickSnapshot(snapshots: ForecastSnapshot[], today: ISODate): ForecastSnapshot | null {
  const monday = lastMonday(today);
  const exact = snapshots.filter((s) => s.date === monday).sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1))[0];
  if (exact) return exact;
  return [...snapshots].filter((s) => s.date <= today).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0] ?? null;
}

function reasonText(step: Step, forecastStart: ISODate, driver: StartDriver): string {
  const fs = formatDayMonth(forecastStart);
  const ps = step.plannedStart ? formatDayMonth(step.plannedStart) : null;
  const notPlanned = ps && ps !== fs ? `, not ${ps},` : '';
  switch (driver.kind) {
    case 'started':
      return step.status === 'done' ? `Done. Started ${fs}.` : `Started ${fs}.`;
    case 'planned':
      return `Starts ${fs} as planned.`;
    case 'step':
      return `Starts ${fs}${notPlanned} after ${driver.stepName} finishes ${formatDayMonth(driver.finish)}.`;
    case 'item': {
      const what = driver.shipmentName ? `the ${driver.shipmentName} shipment` : driver.title;
      return `Starts ${fs}${notPlanned} because ${what} is expected ${formatDayMonth(driver.expected)}.`;
    }
  }
}

// ---------------------------------------------------------------------------
// The calculator
// ---------------------------------------------------------------------------

/** Forecast one job. Throws on an unknown job id. */
export function forecastJob(ds: Dataset, jobId: string, today: ISODate): JobForecast {
  return forecastSlice(jobSlice(ds, jobId), today);
}

/** Forecast every live (non-template) job, keyed by job id. */
export function forecastAll(ds: Dataset, today: ISODate): Record<string, JobForecast> {
  const out: Record<string, JobForecast> = {};
  for (const j of ds.jobs) if (!j.isTemplate) out[j.id] = forecastJob(ds, j.id, today);
  return out;
}

export function forecastSlice(slice: JobSlice, today: ISODate): JobForecast {
  const freshness = freshnessFor(slice.job, today);
  return slice.job.kind === 'design' ? forecastDesign(slice, today, freshness) : forecastBuild(slice, today, freshness);
}

function itemLateness(
  neededBy: ISODate | null,
  expected: ISODate | null,
  status: ItemStatus,
  today: ISODate,
): { lateDays: number; isLate: boolean; lateText: string | null } {
  if (!neededBy || status === 'done') return { lateDays: 0, isLate: false, lateText: null };
  if (expected && expected > neededBy) {
    const n = calendarDaysBetween(neededBy, expected);
    return { lateDays: n, isLate: true, lateText: `${n} day${n === 1 ? '' : 's'} after needed` };
  }
  if (!expected && neededBy < today) {
    return { lateDays: calendarDaysBetween(neededBy, today), isLate: true, lateText: relativeDays(neededBy, today, { deadline: true }) };
  }
  return { lateDays: 0, isLate: false, lateText: null };
}

function forecastDesign(slice: JobSlice, today: ISODate, freshness: Freshness): JobForecast {
  const stages = [...slice.stages].sort(byOrder);
  const current = stages.find((s) => s.status !== 'done') ?? null;
  const items: Record<string, ItemForecast> = {};
  for (const i of slice.items) {
    const lead = leadTimeWeeksFor(i, slice.requirements);
    const actBy = i.neededBy ? addCalendarWeeks(i.neededBy, -lead) : null;
    items[i.id] = {
      itemId: i.id,
      jobId: i.jobId,
      stepId: null,
      status: i.status,
      type: i.type,
      neededBy: i.neededBy,
      actBy,
      expected: i.expectedDate,
      expectedFromShipmentId: null,
      leadTimeWeeks: lead,
      ...itemLateness(i.neededBy, i.expectedDate, i.status, today),
      actByPassed: !!actBy && actBy < today && i.status === 'to_do',
      daysSitting: calendarDaysBetween(i.createdAt, today),
    };
  }
  return {
    jobId: slice.job.id,
    kind: 'design',
    today,
    forecastFinish: null,
    plannedFinish: slice.job.plannedFinish,
    lateDays: 0,
    isLate: false,
    snapshot: null,
    slipDays: null,
    slipCost: null,
    slipSincePlanDays: null,
    slipSincePlanCost: null,
    weeklyHoldingCost: slice.job.weeklyHoldingCost,
    freshness,
    currentStageId: current?.id ?? null,
    currentStageName: current?.name ?? null,
    stages: stages.map((s) => ({
      stageId: s.id,
      name: s.name,
      order: s.order,
      status: s.status,
      plannedStart: null,
      plannedEnd: null,
      forecastStart: null,
      forecastEnd: null,
      lateDays: 0,
      isLate: false,
      stepIds: [],
    })),
    steps: {},
    stepOrder: [],
    items,
    holdPoints: [],
    nextHoldPoint: null,
  };
}

interface Candidate {
  date: ISODate;
  driver: StartDriver;
}

function forecastBuild(slice: JobSlice, today: ISODate, freshness: Freshness): JobForecast {
  const { job } = slice;
  const stages = [...slice.stages].sort(byOrder);
  const shipmentsById = new Map(slice.shipments.map((s) => [s.id, s]));
  const stepsById = new Map(slice.steps.map((s) => [s.id, s]));
  const ordered = topoSortSteps(slice.steps, slice.links, stages);

  const waitsFor = new Map<string, string[]>(slice.steps.map((s) => [s.id, []]));
  const holdsUp = new Map<string, string[]>(slice.steps.map((s) => [s.id, []]));
  for (const l of slice.links) {
    if (!stepsById.has(l.stepId) || !stepsById.has(l.waitsForStepId)) continue;
    waitsFor.get(l.stepId)!.push(l.waitsForStepId);
    holdsUp.get(l.waitsForStepId)!.push(l.stepId);
  }
  const itemsByStep = new Map<string, Item[]>();
  for (const i of slice.items) {
    if (!i.stepId) continue;
    if (!itemsByStep.has(i.stepId)) itemsByStep.set(i.stepId, []);
    itemsByStep.get(i.stepId)!.push(i);
  }

  const steps: Record<string, StepForecast> = {};
  const fallbackStart = job.startDate ?? today;

  const candidatesFor = (step: Step, exclude: Set<string>): Candidate[] => {
    const out: Candidate[] = [{ date: snapToWorkingDay(step.plannedStart ?? fallbackStart), driver: { kind: 'planned' } }];
    for (const predId of waitsFor.get(step.id) ?? []) {
      const pred = steps[predId];
      if (!pred) continue;
      out.push({
        date: nextWorkingDay(pred.forecastEnd),
        driver: { kind: 'step', stepId: predId, stepName: pred.name, finish: pred.forecastEnd },
      });
    }
    for (const item of itemsByStep.get(step.id) ?? []) {
      if (item.status === 'done' || exclude.has(item.id)) continue;
      const exp = effectiveExpected(item, shipmentsById);
      if (!exp.date) continue;
      out.push({
        date: snapToWorkingDay(exp.date),
        driver: {
          kind: 'item',
          itemId: item.id,
          title: item.title,
          expected: exp.date,
          shipmentId: exp.shipmentId,
          shipmentName: exp.shipmentId ? (shipmentsById.get(exp.shipmentId)?.name ?? null) : null,
        },
      });
    }
    return out;
  };
  const latest = (cands: Candidate[]): Candidate => cands.reduce((best, c) => (c.date > best.date ? c : best), cands[0]!);

  for (const step of ordered) {
    let forecastStart: ISODate;
    let forecastEnd: ISODate;
    let driver: StartDriver;
    if (step.status === 'done') {
      forecastStart = step.actualStart ?? step.plannedStart ?? fallbackStart;
      forecastEnd = step.actualEnd ?? step.plannedEnd ?? stepEnd(forecastStart, step.durationDays);
      driver = { kind: 'started' };
    } else if (step.status === 'in_progress') {
      forecastStart = step.actualStart ?? step.plannedStart ?? fallbackStart;
      forecastEnd = stepEnd(forecastStart, step.durationDays);
      driver = { kind: 'started' };
    } else {
      const best = latest(candidatesFor(step, new Set()));
      forecastStart = best.date;
      forecastEnd = stepEnd(forecastStart, step.durationDays);
      driver = best.driver;
    }
    const plannedEnd = step.plannedEnd ?? (step.plannedStart ? stepEnd(step.plannedStart, step.durationDays) : null);
    const lateDays = plannedEnd ? Math.max(0, calendarDaysBetween(plannedEnd, forecastEnd)) : 0;
    steps[step.id] = {
      stepId: step.id,
      stageId: step.stageId,
      name: step.name,
      order: step.order,
      status: step.status,
      isHoldPoint: step.isHoldPoint,
      isPlaceholder: step.isPlaceholder,
      durationDays: step.durationDays,
      plannedStart: step.plannedStart,
      plannedEnd,
      forecastStart,
      forecastEnd,
      lateDays,
      isLate: lateDays > 0,
      driver,
      reason: reasonText(step, forecastStart, driver),
      waitsFor: waitsFor.get(step.id) ?? [],
      holdsUp: holdsUp.get(step.id) ?? [],
      itemIds: (itemsByStep.get(step.id) ?? []).map((i) => i.id),
    };
  }

  // Rule 1: needed-by without the item's own expected date (nor its shipment-mates').
  const items: Record<string, ItemForecast> = {};
  for (const item of slice.items) {
    const exp = effectiveExpected(item, shipmentsById);
    const lead = leadTimeWeeksFor(item, slice.requirements);
    const step = item.stepId ? stepsById.get(item.stepId) : undefined;
    let neededBy: ISODate | null;
    if (step && steps[step.id]) {
      if (step.status === 'not_started') {
        const exclude = new Set([item.id]);
        if (item.shipmentId) {
          for (const mate of itemsByStep.get(step.id) ?? []) if (mate.shipmentId === item.shipmentId) exclude.add(mate.id);
        }
        neededBy = latest(candidatesFor(step, exclude)).date;
      } else {
        neededBy = steps[step.id]!.forecastStart;
      }
    } else {
      neededBy = item.neededBy;
    }
    const actBy = neededBy ? addCalendarWeeks(neededBy, -lead) : null;
    items[item.id] = {
      itemId: item.id,
      jobId: item.jobId,
      stepId: item.stepId,
      status: item.status,
      type: item.type,
      neededBy,
      actBy,
      expected: exp.date,
      expectedFromShipmentId: exp.shipmentId,
      leadTimeWeeks: lead,
      ...itemLateness(neededBy, exp.date, item.status, today),
      actByPassed: !!actBy && actBy < today && item.status === 'to_do',
      daysSitting: calendarDaysBetween(item.createdAt, today),
    };
  }

  const stageForecasts: StageForecast[] = stages.map((stage) => {
    const stageSteps = slice.steps.filter((s) => s.stageId === stage.id).sort(byOrder);
    const sfs = stageSteps.map((s) => steps[s.id]!);
    const plannedEnd = maxDate(...sfs.map((s) => s.plannedEnd));
    const forecastEnd = maxDate(...sfs.map((s) => s.forecastEnd));
    const lateDays = plannedEnd && forecastEnd ? Math.max(0, calendarDaysBetween(plannedEnd, forecastEnd)) : 0;
    return {
      stageId: stage.id,
      name: stage.name,
      order: stage.order,
      status: stageSteps.length ? stageStatusFromSteps(stageSteps) : stage.status,
      plannedStart: minDate(...sfs.map((s) => s.plannedStart)),
      plannedEnd,
      forecastStart: minDate(...sfs.map((s) => s.forecastStart)),
      forecastEnd,
      lateDays,
      isLate: lateDays > 0,
      stepIds: stageSteps.map((s) => s.id),
    };
  });
  const currentStage = stageForecasts.find((s) => s.status !== 'done') ?? null;

  const stepList = Object.values(steps);
  const forecastFinish = maxDate(...stepList.map((s) => s.forecastEnd));
  const plannedFinish = job.plannedFinish ?? maxDate(...stepList.map((s) => s.plannedEnd));
  const lateDays = forecastFinish && plannedFinish ? calendarDaysBetween(plannedFinish, forecastFinish) : 0;

  const snapshot = pickSnapshot(slice.snapshots, today);
  let slipDays: number | null = null;
  let slip$: number | null = null;
  if (snapshot?.forecastFinish && forecastFinish) {
    slipDays = calendarDaysBetween(snapshot.forecastFinish, forecastFinish);
    slip$ = slipCostFor(slipDays, job.weeklyHoldingCost);
  }
  const slipSincePlanDays = forecastFinish && plannedFinish ? lateDays : null;

  const holdPoints = ordered
    .filter((s) => s.isHoldPoint)
    .map((s) => holdPointCheck(s, slice.photoCategories, slice.photos, steps[s.id]!.forecastStart));
  const nextHoldPoint = holdPoints.find((h) => h.status !== 'done') ?? null;

  return {
    jobId: job.id,
    kind: 'build',
    today,
    forecastFinish,
    plannedFinish,
    lateDays,
    isLate: lateDays > 0,
    snapshot: snapshot
      ? { id: snapshot.id, date: snapshot.date, forecastFinish: snapshot.forecastFinish, savedAt: snapshot.savedAt }
      : null,
    slipDays,
    slipCost: slip$,
    slipSincePlanDays,
    slipSincePlanCost: slipSincePlanDays === null ? null : slipCostFor(slipSincePlanDays, job.weeklyHoldingCost),
    weeklyHoldingCost: job.weeklyHoldingCost,
    freshness,
    currentStageId: currentStage?.stageId ?? null,
    currentStageName: currentStage?.name ?? null,
    stages: stageForecasts,
    steps,
    stepOrder: ordered.map((s) => s.id),
    items,
    holdPoints,
    nextHoldPoint,
  };
}

/** The snapshot the Monday scheduler saves: today's forecast with every step's start and end. */
export function makeSnapshot(ds: Dataset, jobId: string, today: ISODate, savedAt: Instant, id: string): ForecastSnapshot {
  const f = forecastJob(ds, jobId, today);
  const stepStarts: Record<string, ISODate> = {};
  const stepEnds: Record<string, ISODate> = {};
  for (const s of Object.values(f.steps)) {
    stepStarts[s.stepId] = s.forecastStart;
    stepEnds[s.stepId] = s.forecastEnd;
  }
  return { id, jobId, date: lastMonday(today), savedAt, forecastFinish: f.forecastFinish, stepStarts, stepEnds };
}
