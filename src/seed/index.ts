/**
 * The seed: every table the mock store holds, matching SPEC.md "Mock data".
 * `buildSeed()` returns a fresh deep copy each call so the store can mutate it.
 */
import type { ForecastSnapshot, Item, Job, SeedData, Shipment } from '../domain/types';
import type { ProgramBuilder } from './helpers';
import { people, memberships, sides } from './people';
import { trades } from './trades';
import {
  parkRdActivity,
  parkRdItems,
  parkRdJob,
  parkRdNotes,
  parkRdNotifications,
  parkRdPhotos,
  parkRdProgram,
  parkRdShipments,
  parkRdSnapshots,
} from './parkRd';
import { seaviewActivity, seaviewItems, seaviewJob, seaviewNotes, seaviewPhotos, seaviewProgram, seaviewSnapshots } from './seaview';
import { beattyActivity, beattyItems, beattyJob, beattyNotes, beattyNotifications, beattyProgram, beattySnapshots } from './beatty';
import { designItems, designJobs, designStages } from './design';
import { duplexTemplateJob, duplexTemplateProgram } from './template';
import { eastwoodActivity, eastwoodItems, eastwoodNotes, eastwoodShipments, hunts12Job, hunts12Program, hunts14Job, hunts14Program, northRdJob, northRdProgram } from './eastwood';
import { cutlerActivity, cutlerItems, cutlerJob, cutlerNotes, cutlerProgram } from './cutler';
import { forecastJob } from '../domain/forecast';

export { SIDE_ND, SIDE_NORM, P } from './helpers';
export { PARK_RD } from './parkRd';
export { SEAVIEW } from './seaview';
export { BEATTY } from './beatty';
export { TEMPLATE_DUPLEX } from './template';
export { HUNTS_12, HUNTS_14, NORTH_RD } from './eastwood';
export { CUTLER } from './cutler';

/** Bump when the seed changes shape or numbers, so stale localStorage reseeds. */
export const SEED_VERSION = 2;

/** Thu 17 Sep 2026: the default "today" for the dev bar and every test. */
export const DEFAULT_TODAY = '2026-09-17';

function assemble(): SeedData {
  const programs = [parkRdProgram, seaviewProgram, beattyProgram, hunts12Program, hunts14Program, northRdProgram, cutlerProgram, duplexTemplateProgram];
  const stepStarts: Record<string, string> = {};
  const stepEnds: Record<string, string> = {};
  for (const s of parkRdProgram.steps) {
    stepStarts[s.id] = s.plannedStart!;
    stepEnds[s.id] = s.plannedEnd!;
  }
  const stageLevelJobs = [hunts12Job, hunts14Job, northRdJob, cutlerJob];
  const stageLevelPrograms = [hunts12Program, hunts14Program, northRdProgram, cutlerProgram];
  const stageLevelItems = [...eastwoodItems, ...cutlerItems];
  return {
    sides,
    people,
    memberships,
    jobs: [parkRdJob, seaviewJob, beattyJob, ...stageLevelJobs, ...designJobs, duplexTemplateJob],
    stages: [...programs.flatMap((p) => p.stages), ...designStages],
    steps: programs.flatMap((p) => p.steps),
    stepLinks: programs.flatMap((p) => p.links),
    requirements: programs.flatMap((p) => p.requirements),
    items: [...parkRdItems, ...seaviewItems, ...beattyItems, ...stageLevelItems, ...designItems],
    trades,
    shipments: [...parkRdShipments, ...eastwoodShipments],
    photoCategories: programs.flatMap((p) => p.categories),
    photos: [...parkRdPhotos, ...seaviewPhotos],
    dailyNotes: [...parkRdNotes, ...seaviewNotes, ...beattyNotes, ...eastwoodNotes, ...cutlerNotes],
    snapshots: [
      ...parkRdSnapshots(stepStarts, stepEnds),
      ...seaviewSnapshots,
      ...beattySnapshots,
      ...stageLevelJobs.flatMap((job, i) => steadySnapshots(job, stageLevelPrograms[i], stageLevelItems, eastwoodShipments)),
    ],
    activity: [...parkRdActivity, ...seaviewActivity, ...beattyActivity, ...eastwoodActivity, ...cutlerActivity],
    notifications: [...parkRdNotifications, ...beattyNotifications],
    pushSubscriptions: [],
  };
}

/**
 * Monday snapshots equal to today's forecast, so a stage-level job reads slip 0
 * until someone moves a date. Computed through the calculator rather than typed,
 * so the seed can never disagree with it.
 */
function steadySnapshots(job: Job, program: ProgramBuilder, items: Item[], shipments: Shipment[]): ForecastSnapshot[] {
  const f = forecastJob({
    job,
    stages: program.stages,
    steps: program.steps,
    links: program.links,
    requirements: program.requirements,
    items: items.filter((i) => i.jobId === job.id),
    shipments: shipments.filter((s) => s.jobId === job.id),
    snapshots: [],
    photoCategories: program.categories,
    photos: [],
    activity: [],
    people,
    today: DEFAULT_TODAY,
  });
  const finish = f.forecastFinish!;
  return ['2026-09-07', '2026-09-14'].map((date) => ({ id: `snap-${job.id}-${date.slice(5).replace('-', '')}`, sideId: job.sideId, jobId: job.id, date, forecastFinish: finish }));
}

const FROZEN = assemble();

export function buildSeed(): SeedData {
  return JSON.parse(JSON.stringify(FROZEN)) as SeedData;
}
