/**
 * The seed: every table the mock store holds, matching SPEC.md "Mock data".
 * `buildSeed()` returns a fresh deep copy each call so the store can mutate it.
 */
import type { SeedData } from '../domain/types';
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

export { SIDE_ND, SIDE_NORM, P } from './helpers';
export { PARK_RD } from './parkRd';
export { SEAVIEW } from './seaview';
export { BEATTY } from './beatty';
export { TEMPLATE_DUPLEX } from './template';
export { HUNTS_12, HUNTS_14, NORTH_RD } from './eastwood';

/** Bump when the seed changes shape or numbers, so stale localStorage reseeds. */
export const SEED_VERSION = 5;

/** Thu 17 Sep 2026: the default "today" for the dev bar and every test. */
export const DEFAULT_TODAY = '2026-09-17';

function assemble(): SeedData {
  const programs = [parkRdProgram, seaviewProgram, beattyProgram, hunts12Program, hunts14Program, northRdProgram, duplexTemplateProgram];
  const stepStarts: Record<string, string> = {};
  const stepEnds: Record<string, string> = {};
  for (const s of parkRdProgram.steps) {
    stepStarts[s.id] = s.plannedStart!;
    stepEnds[s.id] = s.plannedEnd!;
  }
  return {
    sides,
    people,
    memberships,
    jobs: [parkRdJob, seaviewJob, beattyJob, ...designJobs, duplexTemplateJob, hunts12Job, hunts14Job, northRdJob],
    stages: [...programs.flatMap((p) => p.stages), ...designStages],
    steps: programs.flatMap((p) => p.steps),
    stepLinks: programs.flatMap((p) => p.links),
    requirements: programs.flatMap((p) => p.requirements),
    items: [...parkRdItems, ...seaviewItems, ...beattyItems, ...designItems, ...eastwoodItems],
    trades,
    shipments: [...parkRdShipments, ...eastwoodShipments],
    photoCategories: programs.flatMap((p) => p.categories),
    photos: [...parkRdPhotos, ...seaviewPhotos],
    dailyNotes: [...parkRdNotes, ...seaviewNotes, ...beattyNotes, ...eastwoodNotes],
    snapshots: [...parkRdSnapshots(stepStarts, stepEnds), ...seaviewSnapshots, ...beattySnapshots],
    activity: [...parkRdActivity, ...seaviewActivity, ...beattyActivity, ...eastwoodActivity],
    notifications: [...parkRdNotifications, ...beattyNotifications],
    pushSubscriptions: [],
  };
}

const FROZEN = assemble();

export function buildSeed(): SeedData {
  return JSON.parse(JSON.stringify(FROZEN)) as SeedData;
}
