/**
 * The forecast calculator. Pure: data in, dates out. No UI imports, no
 * data-layer imports. It moves to the server unchanged.
 *
 * Rules implemented (SPEC.md, locked):
 *  1. Item needed-by = its step's forecast start computed WITHOUT that item's
 *     own expected date (and without its shipment-mates, which share the same
 *     ETA). Act-by = needed-by minus lead time in calendar weeks.
 *  2. Step forecast start = latest of planned start, the working day after
 *     every step it waits for finishes, and the expected date of every
 *     not-done item it needs (snapped forward to a working day).
 *  3. Job forecast finish = latest forecast end of any step. Planned dates never
 *     change; late means forecast vs planned.
 *  4. Slip = forecast finish minus last Monday's snapshot, calendar days.
 *     Slip cost = slip / 7 x weekly holding cost, to the nearest $10.
 *  5. Working days: Mon-Fri minus the shutdown list (dates.ts).
 *  6. Hold point: every required photo category needs one uploaded photo.
 *  7. A job goes amber after 7 days unconfirmed.
 *  9. Design jobs: stages as a checklist, no steps, no forecast.
 */
import type {
  ActivityEntry,
  Item,
  ItemStatus,
  Job,
  JobKind,
  Person,
  Photo,
  PhotoCategory,
  ForecastSnapshot,
  Requirement,
  Shipment,
  Stage,
  StageStatus,
  Step,
  StepLink,
  StepStatus,
} from './types';
import {
  addCalendarWeeks,
  calendarDaysBetween,
  formatDayMonth,
  formatStamp,
  lastMonday,
  maxDate,
  nextWorkingDay,
  snapToWorkingDay,
  stepEnd,
} from './dates';
import { slipCostFor } from './money';

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface ForecastBundle {
  job: Job;
  stages: Stage[];
  steps: Step[];
  links: StepLink[];
  requirements: Requirement[];
  items: Item[];
  shipments: Shipment[];
  snapshots: ForecastSnapshot[];
  photoCategories?: PhotoCategory[];
  photos?: Photo[];
  /** Optional: lets "why it moved" quote who changed an ETA and when. */
  activity?: ActivityEntry[];
  people?: Person[];
  today: string;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export type StartDriver =
  | { kind: 'planned' }
  | { kind: 'started' }
  | { kind: 'step'; stepId: string; stepName: string; finish: string }
  | { kind: 'item'; itemId: string; title: string; expected: string; shipmentId?: string; shipmentName?: string };

export interface StepForecast {
  stepId: string;
  stageId: string;
  name: string;
  status: StepStatus;
  isHoldPoint: boolean;
  durationDays: number;
  plannedStart?: string;
  plannedEnd?: string;
  forecastStart: string;
  forecastEnd: string;
  /** forecast end minus planned end, calendar days. 0 when there is no planned end. */
  lateDays: number;
  isLate: boolean;
  driver: StartDriver;
  /** One plain sentence naming what sets the forecast start. */
  reason: string;
  waitsFor: string[];
  holdsUp: string[];
  itemIds: string[];
}

export interface ItemForecast {
  itemId: string;
  jobId: string;
  stepId?: string;
  status: ItemStatus;
  neededBy?: string;
  actBy?: string;
  expected?: string;
  expectedFromShipmentId?: string;
  leadTimeWeeks: number;
  /** Expected after needed-by (or needed-by passed with nothing expected). Calendar days. */
  lateDays: number;
  isLate: boolean;
  /** Act-by has passed and the item is still "to do". */
  actByPassed: boolean;
  /** Days since the item was created (design checklists, "oldest 23 days"). */
  daysSitting: number;
  /** "14 days late" or undefined. Colour never carries meaning alone. */
  lateText?: string;
}

export interface StageForecast {
  stageId: string;
  name: string;
  order: number;
  status: StageStatus;
  plannedStart?: string;
  plannedEnd?: string;
  forecastStart?: string;
  forecastEnd?: string;
  lateDays: number;
  isLate: boolean;
  stepIds: string[];
}

export interface HoldPointCategory {
  categoryId: string;
  name: string;
  uploadedCount: number;
}

export interface HoldPointCheck {
  stepId: string;
  stepName: string;
  stageId: string;
  forecastStart: string;
  required: HoldPointCategory[];
  missingCategories: string[];
  ok: boolean;
}

export interface WhyEntry {
  kind: 'cause' | 'step' | 'stage' | 'finish';
  text: string;
  deltaDays: number;
  refId?: string;
  from?: string;
  to?: string;
}

export interface Freshness {
  lastConfirmed?: string;
  daysUnconfirmed?: number;
  amber: boolean;
  /** "Last confirmed 9 days ago" */
  text: string;
}

export interface ChecklistItem {
  itemId: string;
  title: string;
  type: Item['type'];
  waitingOn?: string;
  ownerId?: string;
  daysSitting: number;
}

export interface DesignChecklist {
  stages: { stageId: string; name: string; order: number; status: StageStatus }[];
  currentStageId?: string;
  currentStageName?: string;
  outstanding: number;
  oldestDays: number | null;
  outstandingItems: ChecklistItem[];
}

export interface JobForecast {
  jobId: string;
  kind: JobKind;
  today: string;
  forecastFinish?: string;
  plannedFinish?: string;
  /** forecast finish minus planned finish, calendar days. */
  lateDays: number;
  isLate: boolean;
  snapshotDate?: string;
  snapshotFinish?: string;
  /** Undefined until the first Monday snapshot exists ("Slip appears after the first Monday"). */
  slipDays?: number;
  /** Money. */
  slipCost?: number;
  slipSincePlanDays?: number;
  /** Money. */
  slipSincePlanCost?: number;
  freshness: Freshness;
  currentStageId?: string;
  currentStageName?: string;
  stages: StageForecast[];
  steps: Record<string, StepForecast>;
  items: Record<string, ItemForecast>;
  holdPoints: HoldPointCheck[];
  nextHoldPoint?: HoldPointCheck;
  /** Chain from cause to finish, against last Monday's snapshot when it holds step dates, else against plan. */
  whyItMoved: WhyEntry[];
  whyItMovedSincePlan: WhyEntry[];
  checklist?: DesignChecklist;
}

export interface EtaPreview {
  shipmentId: string;
  shipmentName: string;
  oldEta: string;
  newEta: string;
  linkedItemIds: string[];
  movedSteps: { stepId: string; name: string; from: string; to: string; deltaDays: number }[];
  finishBefore?: string;
  finishAfter?: string;
  /** finishAfter minus finishBefore, calendar days. */
  deltaDays: number;
  slipDaysAfter?: number;
  /** Money: slip cost after the change, vs last Monday. */
  slipCostAfter?: number;
  /** Money: holding cost of the delta alone. */
  costDelta?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function byOrder<T extends { order: number }>(a: T, b: T): number {
  return a.order - b.order;
}

/** Steps in dependency order: every step after the steps it waits for. Cycles are broken by dropping the back edge. */
export function topoSortSteps(steps: Step[], links: StepLink[], stages: Stage[]): Step[] {
  const stageOrder = new Map(stages.map((s) => [s.id, s.order]));
  const natural = [...steps].sort(
    (a, b) => (stageOrder.get(a.stageId) ?? 0) - (stageOrder.get(b.stageId) ?? 0) || a.order - b.order,
  );
  const ids = new Set(steps.map((s) => s.id));
  const preds = new Map<string, Set<string>>();
  for (const s of natural) preds.set(s.id, new Set());
  for (const l of links) if (ids.has(l.stepId) && ids.has(l.waitsForStepId)) preds.get(l.stepId)!.add(l.waitsForStepId);

  const out: Step[] = [];
  const done = new Set<string>();
  let remaining = [...natural];
  while (remaining.length) {
    const ready = remaining.filter((s) => [...preds.get(s.id)!].every((p) => done.has(p)));
    if (!ready.length) {
      // cycle: release the first remaining step
      ready.push(remaining[0]);
    }
    for (const s of ready) {
      out.push(s);
      done.add(s.id);
    }
    remaining = remaining.filter((s) => !done.has(s.id));
  }
  return out;
}

function effectiveExpected(item: Item, shipmentsById: Map<string, Shipment>): { date?: string; shipmentId?: string } {
  if (item.shipmentId) {
    const sh = shipmentsById.get(item.shipmentId);
    if (sh) return { date: sh.eta, shipmentId: sh.id };
  }
  return { date: item.expectedDate };
}

function leadWeeksFor(item: Item, reqsById: Map<string, Requirement>): number {
  if (item.leadTimeWeeks !== undefined) return item.leadTimeWeeks;
  if (item.requirementId) {
    const r = reqsById.get(item.requirementId);
    if (r) return r.leadTimeWeeks;
  }
  return 0;
}

export function freshnessFor(job: Job, today: string): Freshness {
  if (!job.lastConfirmed) return { amber: true, text: 'Never confirmed' };
  const days = calendarDaysBetween(job.lastConfirmed, today);
  const amber = days > 7;
  const when = days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`;
  return { lastConfirmed: job.lastConfirmed, daysUnconfirmed: days, amber, text: `Last confirmed ${when}` };
}

/** Stage status derived from its steps (build jobs). */
export function stageStatusFromSteps(steps: Step[]): StageStatus {
  if (!steps.length) return 'not_started';
  if (steps.every((s) => s.status === 'done')) return 'done';
  if (steps.some((s) => s.status !== 'not_started')) return 'in_progress';
  return 'not_started';
}

/** Rule 6, as a pure check. Only uploaded photos count; the queue is the phone's business. */
export function holdPointCheck(
  step: Step,
  photoCategories: PhotoCategory[],
  photos: Photo[],
  forecastStart?: string,
): HoldPointCheck {
  const required = photoCategories
    .filter((c) => c.jobId === step.jobId && c.stageId === step.stageId && c.requiredForHoldPoint)
    .sort(byOrder)
    .map((c) => ({
      categoryId: c.id,
      name: c.name,
      uploadedCount: photos.filter((p) => p.categoryId === c.id).length,
    }));
  const missingCategories = required.filter((r) => r.uploadedCount === 0).map((r) => r.name);
  return {
    stepId: step.id,
    stepName: step.name,
    stageId: step.stageId,
    forecastStart: forecastStart ?? step.plannedStart ?? '',
    required,
    missingCategories,
    ok: missingCategories.length === 0,
  };
}

/** The sentence a refusal shows. Names the empty categories (rule 6). */
export function holdPointRefusalText(check: HoldPointCheck): string {
  const n = check.missingCategories.length;
  return `Can't tick this off yet. The certifier needs before-cover photos and ${n} ${
    n === 1 ? 'category is' : 'categories are'
  } empty: ${check.missingCategories.join('; ')}.`;
}

// ---------------------------------------------------------------------------
// The calculator
// ---------------------------------------------------------------------------

export function forecastJob(bundle: ForecastBundle): JobForecast {
  const { job, today } = bundle;
  const freshness = freshnessFor(job, today);
  if (job.kind === 'design') return forecastDesignJob(bundle, freshness);
  return forecastBuildJob(bundle, freshness);
}

function forecastDesignJob(bundle: ForecastBundle, freshness: Freshness): JobForecast {
  const { job, today } = bundle;
  const stages = [...bundle.stages].sort(byOrder);
  const current = stages.find((s) => s.status !== 'done');
  const outstanding = bundle.items
    .filter((i) => i.status !== 'done')
    .map<ChecklistItem>((i) => ({
      itemId: i.id,
      title: i.title,
      type: i.type,
      waitingOn: i.waitingOn,
      ownerId: i.ownerId,
      daysSitting: calendarDaysBetween(i.createdAt, today),
    }))
    .sort((a, b) => b.daysSitting - a.daysSitting);
  const items: Record<string, ItemForecast> = {};
  for (const i of bundle.items) {
    const neededBy = i.neededBy;
    const lead = i.leadTimeWeeks ?? 0;
    const actBy = neededBy ? addCalendarWeeks(neededBy, -lead) : undefined;
    const overdue = !!neededBy && neededBy < today && i.status !== 'done';
    const lateDays = overdue ? calendarDaysBetween(neededBy!, today) : 0;
    items[i.id] = {
      itemId: i.id,
      jobId: i.jobId,
      status: i.status,
      neededBy,
      actBy,
      expected: i.expectedDate,
      leadTimeWeeks: lead,
      lateDays,
      isLate: overdue,
      actByPassed: !!actBy && actBy < today && i.status === 'to_do',
      daysSitting: calendarDaysBetween(i.createdAt, today),
      lateText: overdue ? lateText(lateDays) : undefined,
    };
  }
  return {
    jobId: job.id,
    kind: 'design',
    today,
    lateDays: 0,
    isLate: false,
    freshness,
    currentStageId: current?.id,
    currentStageName: current?.name,
    stages: stages.map((s) => ({
      stageId: s.id,
      name: s.name,
      order: s.order,
      status: s.status,
      lateDays: 0,
      isLate: false,
      stepIds: [],
    })),
    steps: {},
    items,
    holdPoints: [],
    whyItMoved: [],
    whyItMovedSincePlan: [],
    checklist: {
      stages: stages.map((s) => ({ stageId: s.id, name: s.name, order: s.order, status: s.status })),
      currentStageId: current?.id,
      currentStageName: current?.name,
      outstanding: outstanding.length,
      oldestDays: outstanding.length ? outstanding[0].daysSitting : null,
      outstandingItems: outstanding,
    },
  };
}

function lateText(days: number): string {
  return `${days} day${days === 1 ? '' : 's'} late`;
}

interface StartCandidate {
  date: string;
  driver: StartDriver;
}

function forecastBuildJob(bundle: ForecastBundle, freshness: Freshness): JobForecast {
  const { job, today } = bundle;
  const stages = [...bundle.stages].sort(byOrder);
  const stagesById = new Map(stages.map((s) => [s.id, s]));
  const shipmentsById = new Map(bundle.shipments.map((s) => [s.id, s]));
  const reqsById = new Map(bundle.requirements.map((r) => [r.id, r]));
  const stepsById = new Map(bundle.steps.map((s) => [s.id, s]));
  const ordered = topoSortSteps(bundle.steps, bundle.links, stages);

  const waitsFor = new Map<string, string[]>();
  const holdsUp = new Map<string, string[]>();
  for (const s of bundle.steps) {
    waitsFor.set(s.id, []);
    holdsUp.set(s.id, []);
  }
  for (const l of bundle.links) {
    if (!stepsById.has(l.stepId) || !stepsById.has(l.waitsForStepId)) continue;
    waitsFor.get(l.stepId)!.push(l.waitsForStepId);
    holdsUp.get(l.waitsForStepId)!.push(l.stepId);
  }
  const itemsByStep = new Map<string, Item[]>();
  for (const i of bundle.items) {
    if (!i.stepId) continue;
    if (!itemsByStep.has(i.stepId)) itemsByStep.set(i.stepId, []);
    itemsByStep.get(i.stepId)!.push(i);
  }

  const steps: Record<string, StepForecast> = {};
  const fallbackStart = job.startDate ?? today;

  /** Candidates for a step's forecast start, optionally excluding some items (rule 1). */
  const candidatesFor = (step: Step, excludeItemIds: Set<string>): StartCandidate[] => {
    const out: StartCandidate[] = [];
    out.push({ date: step.plannedStart ?? fallbackStart, driver: { kind: 'planned' } });
    for (const predId of waitsFor.get(step.id) ?? []) {
      const pred = steps[predId];
      if (!pred) continue;
      out.push({
        date: nextWorkingDay(pred.forecastEnd),
        driver: { kind: 'step', stepId: predId, stepName: pred.name, finish: pred.forecastEnd },
      });
    }
    for (const item of itemsByStep.get(step.id) ?? []) {
      if (item.status === 'done' || excludeItemIds.has(item.id)) continue;
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
          shipmentName: exp.shipmentId ? shipmentsById.get(exp.shipmentId)?.name : undefined,
        },
      });
    }
    return out;
  };

  const pickLatest = (cands: StartCandidate[]): StartCandidate => {
    let best = cands[0];
    for (const c of cands) if (c.date > best.date) best = c;
    return best;
  };

  for (const step of ordered) {
    let forecastStart: string;
    let forecastEnd: string;
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
      const best = pickLatest(candidatesFor(step, new Set()));
      forecastStart = best.date;
      forecastEnd = stepEnd(forecastStart, step.durationDays);
      driver = best.driver;
    }
    const plannedEnd = step.plannedEnd ?? (step.plannedStart ? stepEnd(step.plannedStart, step.durationDays) : undefined);
    const lateDays = plannedEnd ? Math.max(0, calendarDaysBetween(plannedEnd, forecastEnd)) : 0;
    steps[step.id] = {
      stepId: step.id,
      stageId: step.stageId,
      name: step.name,
      status: step.status,
      isHoldPoint: step.isHoldPoint,
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

  // Items: needed-by without the item's own expected date (rule 1).
  const items: Record<string, ItemForecast> = {};
  for (const item of bundle.items) {
    const exp = effectiveExpected(item, shipmentsById);
    const lead = leadWeeksFor(item, reqsById);
    let neededBy: string | undefined;
    const step = item.stepId ? stepsById.get(item.stepId) : undefined;
    if (step && steps[step.id]) {
      const sf = steps[step.id];
      if (step.status === 'not_started') {
        const exclude = new Set<string>([item.id]);
        if (item.shipmentId) {
          for (const mate of itemsByStep.get(step.id) ?? []) if (mate.shipmentId === item.shipmentId) exclude.add(mate.id);
        }
        neededBy = pickLatest(candidatesFor(step, exclude)).date;
      } else {
        neededBy = sf.forecastStart;
      }
    } else {
      neededBy = item.neededBy;
    }
    const actBy = neededBy ? addCalendarWeeks(neededBy, -lead) : undefined;
    const notDone = item.status !== 'done';
    let lateDays = 0;
    let isLate = false;
    if (neededBy && notDone) {
      if (exp.date && exp.date > neededBy) {
        lateDays = calendarDaysBetween(neededBy, exp.date);
        isLate = true;
      } else if (!exp.date && neededBy < today) {
        lateDays = calendarDaysBetween(neededBy, today);
        isLate = true;
      }
    }
    items[item.id] = {
      itemId: item.id,
      jobId: item.jobId,
      stepId: item.stepId,
      status: item.status,
      neededBy,
      actBy,
      expected: exp.date,
      expectedFromShipmentId: exp.shipmentId,
      leadTimeWeeks: lead,
      lateDays,
      isLate,
      actByPassed: !!actBy && actBy < today && item.status === 'to_do',
      daysSitting: calendarDaysBetween(item.createdAt, today),
      lateText: isLate ? lateText(lateDays) : undefined,
    };
  }

  // Stages: bands derived from their steps.
  const stageForecasts: StageForecast[] = stages.map((stage) => {
    const stageSteps = bundle.steps.filter((s) => s.stageId === stage.id).sort(byOrder);
    const sfs = stageSteps.map((s) => steps[s.id]);
    const plannedStart = minDateOf(sfs.map((s) => s.plannedStart));
    const plannedEnd = maxDate(...sfs.map((s) => s.plannedEnd));
    const forecastStart = minDateOf(sfs.map((s) => s.forecastStart));
    const forecastEnd = maxDate(...sfs.map((s) => s.forecastEnd));
    const lateDays = plannedEnd && forecastEnd ? Math.max(0, calendarDaysBetween(plannedEnd, forecastEnd)) : 0;
    return {
      stageId: stage.id,
      name: stage.name,
      order: stage.order,
      status: stageStatusFromSteps(stageSteps),
      plannedStart,
      plannedEnd,
      forecastStart,
      forecastEnd,
      lateDays,
      isLate: lateDays > 0,
      stepIds: stageSteps.map((s) => s.id),
    };
  });
  const currentStage = stageForecasts.find((s) => s.status !== 'done');

  // Finish (rule 3) and slip (rule 4).
  const stepList = Object.values(steps);
  const forecastFinish = maxDate(...stepList.map((s) => s.forecastEnd));
  const plannedFinish = job.plannedFinish ?? maxDate(...stepList.map((s) => s.plannedEnd));
  const lateDays = forecastFinish && plannedFinish ? calendarDaysBetween(plannedFinish, forecastFinish) : 0;

  const snapshot = pickSnapshot(bundle.snapshots, today);
  let slipDays: number | undefined;
  let slipCost: number | undefined;
  if (snapshot && forecastFinish) {
    slipDays = calendarDaysBetween(snapshot.forecastFinish, forecastFinish);
    slipCost = slipCostFor(slipDays, job.weeklyHoldingCost);
  }
  const slipSincePlanDays = forecastFinish && plannedFinish ? lateDays : undefined;
  const slipSincePlanCost = slipSincePlanDays !== undefined ? slipCostFor(slipSincePlanDays, job.weeklyHoldingCost) : undefined;

  // Hold points (rule 6).
  const holdPoints = ordered
    .filter((s) => s.isHoldPoint)
    .map((s) => holdPointCheck(s, bundle.photoCategories ?? [], bundle.photos ?? [], steps[s.id].forecastStart));
  const nextHoldPoint = holdPoints.find((h) => stepsById.get(h.stepId)?.status !== 'done');

  // Why it moved.
  const whyItMovedSincePlan = explainMovement(bundle, ordered, steps, stagesById, stageForecasts, forecastFinish, plannedFinish, {
    starts: Object.fromEntries(stepList.map((s) => [s.stepId, s.plannedStart ?? s.forecastStart])),
    ends: Object.fromEntries(stepList.map((s) => [s.stepId, s.plannedEnd ?? s.forecastEnd])),
    stageEnds: Object.fromEntries(stageForecasts.map((s) => [s.stageId, s.plannedEnd ?? s.forecastEnd ?? ''])),
    finish: plannedFinish,
  });
  const whyItMoved =
    snapshot && snapshot.stepEnds
      ? explainMovement(bundle, ordered, steps, stagesById, stageForecasts, forecastFinish, snapshot.forecastFinish, {
          starts: snapshot.stepStarts ?? {},
          ends: snapshot.stepEnds,
          stageEnds: stageEndsFromSnapshot(snapshot.stepEnds, bundle.steps),
          finish: snapshot.forecastFinish,
        })
      : whyItMovedSincePlan;

  return {
    jobId: job.id,
    kind: 'build',
    today,
    forecastFinish,
    plannedFinish,
    lateDays,
    isLate: lateDays > 0,
    snapshotDate: snapshot?.date,
    snapshotFinish: snapshot?.forecastFinish,
    slipDays,
    slipCost,
    slipSincePlanDays,
    slipSincePlanCost,
    freshness,
    currentStageId: currentStage?.stageId,
    currentStageName: currentStage?.name,
    stages: stageForecasts,
    steps,
    items,
    holdPoints,
    nextHoldPoint,
    whyItMoved,
    whyItMovedSincePlan,
  };
}

function minDateOf(dates: (string | undefined)[]): string | undefined {
  let best: string | undefined;
  for (const d of dates) if (d && (!best || d < best)) best = d;
  return best;
}

/** Last Monday's snapshot; failing that, the latest snapshot on or before today. */
export function pickSnapshot(snapshots: ForecastSnapshot[], today: string): ForecastSnapshot | undefined {
  const monday = lastMonday(today);
  const exact = snapshots.find((s) => s.date === monday);
  if (exact) return exact;
  const before = snapshots.filter((s) => s.date <= today).sort((a, b) => (a.date < b.date ? 1 : -1));
  return before[0];
}

function stageEndsFromSnapshot(stepEnds: Record<string, string>, steps: Step[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of steps) {
    const e = stepEnds[s.id];
    if (!e) continue;
    if (!out[s.stageId] || e > out[s.stageId]) out[s.stageId] = e;
  }
  return out;
}

function reasonText(step: Step, forecastStart: string, driver: StartDriver): string {
  const fs = formatDayMonth(forecastStart);
  const ps = step.plannedStart ? formatDayMonth(step.plannedStart) : undefined;
  switch (driver.kind) {
    case 'started':
      return step.status === 'done' ? `Done. Ran from ${fs}.` : `Started ${fs}.`;
    case 'planned':
      return `Starts ${fs} as planned.`;
    case 'step':
      return ps && ps !== fs
        ? `Starts ${fs}, not ${ps}, after ${driver.stepName} finishes ${formatDayMonth(driver.finish)}.`
        : `Starts ${fs}, after ${driver.stepName} finishes ${formatDayMonth(driver.finish)}.`;
    case 'item': {
      const what = driver.shipmentName ? `the ${driver.shipmentName} shipment` : driver.title;
      return ps && ps !== fs
        ? `Starts ${fs}, not ${ps}, because ${what} is expected ${formatDayMonth(driver.expected)}.`
        : `Starts ${fs}, because ${what} is expected ${formatDayMonth(driver.expected)}.`;
    }
  }
}

interface Baseline {
  starts: Record<string, string>;
  ends: Record<string, string>;
  stageEnds: Record<string, string>;
  finish?: string;
}

/**
 * Builds the "why it moved" chain: each root cause (an item or a step that
 * moved on its own), the step it pushed, every stage whose end moved, then the
 * finish. Propagated steps are folded into their stages to keep it short.
 */
function explainMovement(
  bundle: ForecastBundle,
  ordered: Step[],
  steps: Record<string, StepForecast>,
  stagesById: Map<string, Stage>,
  stageForecasts: StageForecast[],
  forecastFinish: string | undefined,
  baselineFinish: string | undefined,
  baseline: Baseline,
): WhyEntry[] {
  const out: WhyEntry[] = [];
  const seenCauses = new Set<string>();
  const peopleById = new Map((bundle.people ?? []).map((p) => [p.id, p]));

  for (const step of ordered) {
    const sf = steps[step.id];
    const baseEnd = baseline.ends[step.id];
    if (!baseEnd) continue;
    const delta = calendarDaysBetween(baseEnd, sf.forecastEnd);
    if (delta <= 0) continue;
    const baseStart = baseline.starts[step.id] ?? sf.plannedStart;
    const d = sf.driver;

    if (d.kind === 'item') {
      const causeKey = d.shipmentId ? `shipment:${d.shipmentId}` : `item:${d.itemId}`;
      if (!seenCauses.has(causeKey)) {
        seenCauses.add(causeKey);
        out.push(causeEntry(bundle, d, sf, steps, peopleById));
      }
      out.push({
        kind: 'step',
        refId: step.id,
        deltaDays: baseStart ? calendarDaysBetween(baseStart, sf.forecastStart) : delta,
        from: baseStart,
        to: sf.forecastStart,
        text: baseStart
          ? `${step.name} starts ${formatDayMonth(sf.forecastStart)}, not ${formatDayMonth(baseStart)} (${signed(
              calendarDaysBetween(baseStart, sf.forecastStart),
            )})`
          : `${step.name} starts ${formatDayMonth(sf.forecastStart)}`,
      });
      continue;
    }

    if (d.kind === 'step') {
      const pred = steps[d.stepId];
      const predBaseEnd = baseline.ends[d.stepId];
      const predDelta = predBaseEnd ? calendarDaysBetween(predBaseEnd, pred.forecastEnd) : 0;
      if (predDelta >= delta) continue; // pure propagation: folded into the stage line
    }
    // Moved on its own (duration or planned-date edit since the baseline, or a started step overrunning).
    const key = `step:${step.id}`;
    if (!seenCauses.has(key)) {
      seenCauses.add(key);
      out.push({
        kind: 'step',
        refId: step.id,
        deltaDays: delta,
        from: baseEnd,
        to: sf.forecastEnd,
        text: `${step.name} ends ${formatDayMonth(sf.forecastEnd)}, not ${formatDayMonth(baseEnd)} (${signed(delta)})`,
      });
    }
  }

  if (!out.length) return out;

  for (const st of stageForecasts) {
    const base = baseline.stageEnds[st.stageId];
    if (!base || !st.forecastEnd) continue;
    const delta = calendarDaysBetween(base, st.forecastEnd);
    if (delta <= 0) continue;
    out.push({
      kind: 'stage',
      refId: st.stageId,
      deltaDays: delta,
      from: base,
      to: st.forecastEnd,
      text: `${stagesById.get(st.stageId)?.name ?? st.name} ends ${formatDayMonth(st.forecastEnd)}, not ${formatDayMonth(base)} (${signed(delta)})`,
    });
  }

  if (forecastFinish && baselineFinish) {
    const delta = calendarDaysBetween(baselineFinish, forecastFinish);
    if (delta !== 0) {
      out.push({
        kind: 'finish',
        deltaDays: delta,
        from: baselineFinish,
        to: forecastFinish,
        text: `Finish ${formatDayMonth(forecastFinish)}, not ${formatDayMonth(baselineFinish)} (${signed(delta)})`,
      });
    }
  }
  return out;
}

function causeEntry(
  bundle: ForecastBundle,
  d: Extract<StartDriver, { kind: 'item' }>,
  sf: StepForecast,
  steps: Record<string, StepForecast>,
  peopleById: Map<string, Person>,
): WhyEntry {
  const needed = sf.plannedStart ?? steps[sf.stepId].plannedStart;
  const neededText = needed ? `, needed ${formatDayMonth(needed)}` : '';
  if (d.shipmentId) {
    const change = (bundle.activity ?? [])
      .filter((a) => a.kind === 'eta_changed' && a.shipmentId === d.shipmentId && a.to === d.expected)
      .sort((a, b) => (a.at < b.at ? 1 : -1))[0];
    if (change && change.from) {
      const who = peopleById.get(change.personId)?.shortName ?? peopleById.get(change.personId)?.name;
      const stamp = formatStamp(change.at);
      return {
        kind: 'cause',
        refId: d.shipmentId,
        deltaDays: calendarDaysBetween(change.from, change.to ?? d.expected),
        from: change.from,
        to: change.to,
        text: `${d.shipmentName ?? d.title} ETA changed ${formatDayMonth(change.from)} to ${formatDayMonth(d.expected)}${
          who ? ` (${who}, ${stamp})` : ''
        }`,
      };
    }
    return {
      kind: 'cause',
      refId: d.shipmentId,
      deltaDays: needed ? calendarDaysBetween(needed, d.expected) : 0,
      to: d.expected,
      text: `${d.shipmentName ?? d.title} expected ${formatDayMonth(d.expected)}${neededText}`,
    };
  }
  return {
    kind: 'cause',
    refId: d.itemId,
    deltaDays: needed ? calendarDaysBetween(needed, d.expected) : 0,
    to: d.expected,
    text: `${d.title} expected ${formatDayMonth(d.expected)}${neededText}`,
  };
}

function signed(days: number): string {
  return `${days > 0 ? '+' : ''}${days} day${Math.abs(days) === 1 ? '' : 's'}`;
}

// ---------------------------------------------------------------------------
// ETA impact preview (screen 13, flow d). Mutates nothing.
// ---------------------------------------------------------------------------

export function previewEtaChange(bundle: ForecastBundle, shipmentId: string, newEta: string): EtaPreview {
  const shipment = bundle.shipments.find((s) => s.id === shipmentId);
  if (!shipment) throw new Error(`Unknown shipment ${shipmentId}`);
  const before = forecastJob(bundle);
  const after = forecastJob({
    ...bundle,
    shipments: bundle.shipments.map((s) => (s.id === shipmentId ? { ...s, eta: newEta } : s)),
  });
  const linkedItemIds = bundle.items.filter((i) => i.shipmentId === shipmentId).map((i) => i.id);
  const movedSteps = Object.values(after.steps)
    .filter((s) => before.steps[s.stepId] && before.steps[s.stepId].forecastStart !== s.forecastStart)
    .map((s) => ({
      stepId: s.stepId,
      name: s.name,
      from: before.steps[s.stepId].forecastStart,
      to: s.forecastStart,
      deltaDays: calendarDaysBetween(before.steps[s.stepId].forecastStart, s.forecastStart),
    }));
  const deltaDays =
    before.forecastFinish && after.forecastFinish ? calendarDaysBetween(before.forecastFinish, after.forecastFinish) : 0;
  return {
    shipmentId,
    shipmentName: shipment.name,
    oldEta: shipment.eta,
    newEta,
    linkedItemIds,
    movedSteps,
    finishBefore: before.forecastFinish,
    finishAfter: after.forecastFinish,
    deltaDays,
    slipDaysAfter: after.slipDays,
    slipCostAfter: after.slipCost,
    costDelta: slipCostFor(deltaDays, bundle.job.weeklyHoldingCost),
  };
}

// ---------------------------------------------------------------------------
// Monday screen helpers
// ---------------------------------------------------------------------------

export interface WaitingOnRow {
  itemId: string;
  title: string;
  type: Item['type'];
  ownerId?: string;
  waitingOn?: string;
  actBy?: string;
  neededBy?: string;
  expected?: string;
  isLate: boolean;
  lateText?: string;
  actByPassed: boolean;
}

/**
 * Top N open items for a job: late ones first (most late first), then the
 * soonest act-by within 14 days, then anything else by act-by.
 */
export function topWaitingOn(forecast: JobForecast, items: Item[], n = 3): WaitingOnRow[] {
  const today = forecast.today;
  const horizon = addCalendarWeeks(today, 2);
  const rows = items
    .filter((i) => i.status !== 'done' && forecast.items[i.id])
    .map<WaitingOnRow & { rank: number; key: string }>((i) => {
      const f = forecast.items[i.id];
      const within = !!f.actBy && f.actBy <= horizon;
      const rank = f.isLate ? 0 : within ? 1 : 2;
      return {
        itemId: i.id,
        title: i.title,
        type: i.type,
        ownerId: i.ownerId,
        waitingOn: i.waitingOn,
        actBy: f.actBy,
        neededBy: f.neededBy,
        expected: f.expected,
        isLate: f.isLate,
        lateText: f.lateText,
        actByPassed: f.actByPassed,
        rank,
        key: rank === 0 ? String(1000 - f.lateDays).padStart(4, '0') : f.actBy ?? '9999-99-99',
      };
    })
    .sort((a, b) => a.rank - b.rank || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return rows.slice(0, n).map(({ rank: _r, key: _k, ...row }) => row);
}
