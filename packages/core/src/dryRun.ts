/**
 * Dry run: apply a proposal to a copy, rerun the calculator, report the
 * forecast impact for the confirm card and the Setup previews.
 */
import { forecastJob, type JobForecast } from './calculator.js';
import { applyChanges, jobIdsOfChanges, type Change } from './changes.js';
import { calendarDaysBetween, formatDate } from './dates.js';
import { slipCost } from './money.js';
import type { Dataset, ISODate } from './types.js';

export interface MovedStep {
  stepId: string;
  name: string;
  from: ISODate;
  to: ISODate;
  /** Calendar days, positive = later. */
  deltaDays: number;
  /** "Install windows 2 Nov to 16 Nov" style, via formatDate. */
  text: string;
}

export interface MovedItem {
  itemId: string;
  title: string;
  field: 'expected' | 'neededBy' | 'actBy';
  from: ISODate | null;
  to: ISODate | null;
}

export interface JobImpact {
  jobId: string;
  jobName: string;
  kind: 'build' | 'design';
  finishBefore: ISODate | null;
  finishAfter: ISODate | null;
  /** finishAfter minus finishBefore, calendar days. */
  finishDeltaDays: number;
  /** Against last Monday's snapshot. Null with no snapshot. */
  slipBefore: number | null;
  slipAfter: number | null;
  slipCostBefore: number | null;
  slipCostAfter: number | null;
  /** Holding cost of the change alone (finish delta / 7 x weekly cost). */
  costOfChange: number | null;
  movedSteps: MovedStep[];
  movedItems: MovedItem[];
  amberBefore: boolean;
  amberAfter: boolean;
}

export interface DryRunResult {
  /** One per touched live job, the job the proposal is about first. */
  impacts: JobImpact[];
  /** The dataset after the changes (for further previews). */
  after: Dataset;
}

export function compareForecasts(
  jobId: string,
  jobName: string,
  before: JobForecast | null,
  after: JobForecast | null,
  weeklyHoldingCost: number | null,
  today: ISODate,
): JobImpact {
  const movedSteps: MovedStep[] = [];
  if (before && after) {
    for (const id of after.stepOrder) {
      const a = after.steps[id]!;
      const b = before.steps[id];
      if (!b || b.forecastStart === a.forecastStart) continue;
      movedSteps.push({
        stepId: id,
        name: a.name,
        from: b.forecastStart,
        to: a.forecastStart,
        deltaDays: calendarDaysBetween(b.forecastStart, a.forecastStart),
        text: `${a.name} ${formatDate(b.forecastStart, today)} to ${formatDate(a.forecastStart, today)}`,
      });
    }
  }
  const movedItems: MovedItem[] = [];
  if (before && after) {
    for (const [id, a] of Object.entries(after.items)) {
      const b = before.items[id];
      for (const field of ['expected', 'neededBy', 'actBy'] as const) {
        const from = b ? b[field] : null;
        if (from !== a[field]) movedItems.push({ itemId: id, title: '', field, from, to: a[field] });
      }
    }
  }
  const fb = before?.forecastFinish ?? null;
  const fa = after?.forecastFinish ?? null;
  const delta = fb && fa ? calendarDaysBetween(fb, fa) : 0;
  return {
    jobId,
    jobName,
    kind: after?.kind ?? before?.kind ?? 'build',
    finishBefore: fb,
    finishAfter: fa,
    finishDeltaDays: delta,
    slipBefore: before?.slipDays ?? null,
    slipAfter: after?.slipDays ?? null,
    slipCostBefore: before?.slipCost ?? null,
    slipCostAfter: after?.slipCost ?? null,
    costOfChange: slipCost(delta, weeklyHoldingCost),
    movedSteps,
    movedItems,
    amberBefore: before?.freshness.amber ?? false,
    amberAfter: after?.freshness.amber ?? false,
  };
}

/** Impact of applying `changes` (a proposal's) to `ds`, as of `today`. */
export function dryRun(ds: Dataset, proposal: { changes: Change[]; jobIds?: string[] }, today: ISODate): DryRunResult {
  const after = applyChanges(ds, proposal.changes);
  const ids = [...(proposal.jobIds ?? [])];
  for (const id of jobIdsOfChanges(after, proposal.changes)) if (!ids.includes(id)) ids.push(id);
  const impacts: JobImpact[] = [];
  for (const id of ids) {
    const jobAfter = after.jobs.find((j) => j.id === id);
    const jobBefore = ds.jobs.find((j) => j.id === id);
    const job = jobAfter ?? jobBefore;
    if (!job || job.isTemplate) continue;
    const fb = jobBefore ? forecastJob(ds, id, today) : null;
    const fa = jobAfter ? forecastJob(after, id, today) : null;
    const impact = compareForecasts(id, job.name, fb, fa, job.weeklyHoldingCost, today);
    for (const m of impact.movedItems) m.title = (after.items.find((i) => i.id === m.itemId) ?? ds.items.find((i) => i.id === m.itemId))?.title ?? '';
    impacts.push(impact);
  }
  return { impacts, after };
}
