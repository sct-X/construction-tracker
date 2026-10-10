/**
 * The Overview (the web's home, v1 "timing first"): one row per live job on
 * the side. No forecast finish, slip or money: where the job is (stage and a
 * stage bar), what comes next (the next three not-done steps with dates),
 * what it is waiting on (the top three open items, overdue first) and how
 * fresh that is, in words. Builds in the side's order (dataset order), design
 * jobs by oldest outstanding item first.
 */
import { forecastJob, type JobForecast } from './calculator.js';
import { designChecklist, overdueFirst, rowsForJob, type HoldPointSummary, type SideFilter, type WaitingRow } from './readModels.js';
import { freshnessWords, stageDisplayName, stagePositionWords } from './readModelsTiming.js';
import type { ApprovalPath, Dataset, ISODate, Job, StageStatus, StepStatus } from './types.js';

export interface OverviewStage {
  stageId: string;
  name: string;
  status: StageStatus;
}

export interface OverviewStep {
  stepId: string;
  name: string;
  stageName: string;
  status: StepStatus;
  start: ISODate;
  end: ISODate;
  /** In progress, or its forecast start is today or past. */
  underWay: boolean;
  isHoldPoint: boolean;
  /** Forecast end after planned end, calendar days (words only on the web, never a warning colour). */
  lateDays: number;
}

export interface OverviewRow {
  jobId: string;
  sideId: string;
  name: string;
  kind: 'build' | 'design';
  path: ApprovalPath | null;
  stages: OverviewStage[];
  currentStageId: string | null;
  /** As stored ("With council"). */
  currentStageName: string | null;
  /** As Dom reads it ("Pending approval"). */
  stageLabel: string | null;
  /** "Stage 5 of 8". */
  stagePosition: string;
  /** Builds: the next three not-done steps, under way first, then by forecast start. Design: empty. */
  nextSteps: OverviewStep[];
  nextHoldPoint: HoldPointSummary | null;
  /** Top three open items: overdue first (longest overdue first), then soonest key date. */
  waitingOn: WaitingRow[];
  /** Open items past their date (isOverdue): the card's one red cue. */
  overdue: number;
  /** Open items on the job. */
  outstanding: number;
  /** Design jobs: days the oldest outstanding item has sat; null when none. */
  oldestDays: number | null;
  lastConfirmed: ISODate | null;
  daysUnconfirmed: number | null;
  /** Rule 7 (more than 7 days, or never). Shown in words only, never as an amber state. */
  unconfirmed: boolean;
  /** "Not confirmed for 9 days", "Last confirmed 2 days ago", "Never confirmed". */
  freshnessWords: string;
}

export interface OverviewView {
  today: ISODate;
  builds: OverviewRow[];
  design: OverviewRow[];
}

/** Top three: overdue first, then the soonest key date, then title. */
export function topWaiting(rows: WaitingRow[], n = 3): WaitingRow[] {
  const overdue = overdueFirst(rows.filter((r) => r.overdue));
  const rest = rows
    .filter((r) => !r.overdue)
    .sort((a, b) => (a.keyDate ?? '9999-12-31').localeCompare(b.keyDate ?? '9999-12-31') || a.title.localeCompare(b.title));
  return [...overdue, ...rest].slice(0, n);
}

function nextSteps(f: JobForecast, ds: Dataset, today: ISODate): OverviewStep[] {
  const stageName = new Map(ds.stages.map((s) => [s.id, s.name]));
  return Object.values(f.steps)
    .filter((s) => s.status !== 'done')
    .map((s) => ({ s, underWay: s.status === 'in_progress' || s.forecastStart <= today }))
    .sort((a, b) => Number(b.underWay) - Number(a.underWay) || a.s.forecastStart.localeCompare(b.s.forecastStart) || a.s.order - b.s.order)
    .slice(0, 3)
    .map(({ s, underWay }) => ({
      stepId: s.stepId,
      name: s.name,
      stageName: stageName.get(s.stageId) ?? '',
      status: s.status,
      start: s.forecastStart,
      end: s.forecastEnd,
      underWay,
      isHoldPoint: s.isHoldPoint,
      lateDays: s.lateDays,
    }));
}

export function overviewRow(ds: Dataset, job: Job, today: ISODate): OverviewRow {
  const f = forecastJob(ds, job.id, today);
  const open = rowsForJob(ds, f, today);
  const design = job.kind === 'design' ? designChecklist(ds, job.id, today) : null;
  const h = f.nextHoldPoint;
  return {
    jobId: job.id,
    sideId: job.sideId,
    name: job.name,
    kind: job.kind,
    path: job.path,
    stages: f.stages.map((s) => ({ stageId: s.stageId, name: s.name, status: s.status })),
    currentStageId: f.currentStageId,
    currentStageName: f.currentStageName,
    stageLabel: stageDisplayName(f.currentStageName),
    stagePosition: stagePositionWords(f.stages, f.currentStageId),
    nextSteps: job.kind === 'build' ? nextSteps(f, ds, today) : [],
    nextHoldPoint: h
      ? { stepId: h.stepId, stepName: h.stepName, date: h.forecastStart, filled: h.filledCount, required: h.required.length, missing: h.missingCategories }
      : null,
    waitingOn: topWaiting(open),
    overdue: open.filter((r) => r.overdue).length,
    outstanding: open.length,
    oldestDays: design ? design.oldestDays : null,
    lastConfirmed: f.freshness.lastConfirmed,
    daysUnconfirmed: f.freshness.daysUnconfirmed,
    unconfirmed: f.freshness.amber,
    freshnessWords: freshnessWords(f.freshness),
  };
}

export function overview(ds: Dataset, today: ISODate, filter: SideFilter = {}): OverviewView {
  const jobs = ds.jobs.filter((j) => !j.isTemplate && (!filter.sideId || j.sideId === filter.sideId));
  const builds = jobs.filter((j) => j.kind === 'build').map((j) => overviewRow(ds, j, today));
  const design = jobs
    .filter((j) => j.kind === 'design')
    .map((j) => overviewRow(ds, j, today))
    .sort((a, b) => (b.oldestDays ?? -1) - (a.oldestDays ?? -1) || a.name.localeCompare(b.name));
  return { today, builds, design };
}
