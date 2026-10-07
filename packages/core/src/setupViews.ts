/**
 * Read models for the desktop Setup area: one job's or template's program as
 * the editor needs it (stored rows, not just the forecast), and the length of
 * a program in working days, which is all a template has instead of dates.
 */
import { forecastJob, topoSortSteps } from './calculator.js';
import type { Dataset, ISODate, Job, PhotoCategory, Requirement, Stage, Step } from './types.js';

export interface SetupStep extends Step {
  /** Ids of the steps this one waits for. */
  waitsFor: string[];
  requirements: Requirement[];
  /** Items linked to the step (they block deleting it). */
  itemCount: number;
  /** Live build jobs only; null on templates. */
  forecastStart: ISODate | null;
  forecastEnd: ISODate | null;
  /** Forecast end minus planned end, calendar days (0 on templates). */
  lateDays: number;
}

export interface SetupStage extends Stage {
  /** In stage order (step.order). */
  steps: SetupStep[];
  photoCategories: PhotoCategory[];
}

export interface ProgramSetupView {
  job: Job;
  stages: SetupStage[];
  /** Live build jobs only. */
  forecastFinish: ISODate | null;
  /** The longest chain of waits-for links, in working days (what a template has instead of a finish). */
  workingDays: number;
  /** Trade types already used on this side (steps, requirements, trades), for the trade picker. */
  tradeTypes: string[];
}

/** Working days along the longest chain of waits-for links (steps with no links stand alone). */
export function programWorkingDays(ds: Dataset, jobId: string): number {
  const steps = ds.steps.filter((s) => s.jobId === jobId);
  const links = ds.stepLinks.filter((l) => l.jobId === jobId);
  const stages = ds.stages.filter((s) => s.jobId === jobId);
  const finish = new Map<string, number>();
  let longest = 0;
  for (const s of topoSortSteps(steps, links, stages)) {
    const before = Math.max(0, ...links.filter((l) => l.stepId === s.id).map((l) => finish.get(l.waitsForStepId) ?? 0));
    const end = before + s.durationDays;
    finish.set(s.id, end);
    longest = Math.max(longest, end);
  }
  return longest;
}

export function programSetup(ds: Dataset, jobId: string, today: ISODate): ProgramSetupView {
  const job = ds.jobs.find((j) => j.id === jobId);
  if (!job) throw new Error(`Unknown job ${jobId}`);
  const f = job.kind === 'build' && !job.isTemplate ? forecastJob(ds, jobId, today) : null;
  const links = ds.stepLinks.filter((l) => l.jobId === jobId);
  const stages = ds.stages
    .filter((s) => s.jobId === jobId)
    .sort((a, b) => a.order - b.order)
    .map(
      (st): SetupStage => ({
        ...st,
        steps: ds.steps
          .filter((s) => s.stageId === st.id)
          .sort((a, b) => a.order - b.order)
          .map((s) => {
            const sf = f?.steps[s.id];
            return {
              ...s,
              waitsFor: links.filter((l) => l.stepId === s.id).map((l) => l.waitsForStepId),
              requirements: ds.requirements.filter((r) => r.stepId === s.id),
              itemCount: ds.items.filter((i) => i.stepId === s.id).length,
              forecastStart: sf?.forecastStart ?? null,
              forecastEnd: sf?.forecastEnd ?? null,
              lateDays: sf?.lateDays ?? 0,
            };
          }),
        photoCategories: ds.photoCategories.filter((c) => c.stageId === st.id).sort((a, b) => a.order - b.order),
      }),
    );
  const sideJobs = new Set(ds.jobs.filter((j) => j.sideId === job.sideId).map((j) => j.id));
  const types = new Set<string>();
  for (const s of ds.steps) if (sideJobs.has(s.jobId) && s.tradeType) types.add(s.tradeType);
  for (const r of ds.requirements) if (sideJobs.has(r.jobId) && r.tradeType) types.add(r.tradeType);
  for (const t of ds.trades) if (t.sideId === job.sideId && t.type) types.add(t.type);
  return {
    job: { ...job },
    stages,
    forecastFinish: f?.forecastFinish ?? null,
    workingDays: programWorkingDays(ds, jobId),
    tradeTypes: [...types].sort((a, b) => a.localeCompare(b)),
  };
}
