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

export { SIDE_ND, SIDE_NORM, P } from './helpers';
export { PARK_RD } from './parkRd';
export { SEAVIEW } from './seaview';
export { BEATTY } from './beatty';
export { TEMPLATE_DUPLEX } from './template';

/** Bump when the seed changes shape or numbers, so stale localStorage reseeds. */
export const SEED_VERSION = 1;

/** Thu 17 Sep 2026: the default "today" for the dev bar and every test. */
export const DEFAULT_TODAY = '2026-09-17';

function assemble(): SeedData {
  const programs = [parkRdProgram, seaviewProgram, beattyProgram, duplexTemplateProgram];
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
    jobs: [parkRdJob, seaviewJob, beattyJob, ...designJobs, duplexTemplateJob],
    stages: [...programs.flatMap((p) => p.stages), ...designStages],
    steps: programs.flatMap((p) => p.steps),
    stepLinks: programs.flatMap((p) => p.links),
    requirements: programs.flatMap((p) => p.requirements),
    items: [...parkRdItems, ...seaviewItems, ...beattyItems, ...designItems],
    trades,
    shipments: parkRdShipments,
    photoCategories: programs.flatMap((p) => p.categories),
    photos: [...parkRdPhotos, ...seaviewPhotos],
    dailyNotes: [...parkRdNotes, ...seaviewNotes, ...beattyNotes],
    snapshots: [...parkRdSnapshots(stepStarts, stepEnds), ...seaviewSnapshots, ...beattySnapshots],
    activity: [...parkRdActivity, ...seaviewActivity, ...beattyActivity],
    notifications: [...parkRdNotifications, ...beattyNotifications],
    pushSubscriptions: [],
  };
}

const FROZEN = assemble();

export function buildSeed(): SeedData {
  return JSON.parse(JSON.stringify(FROZEN)) as SeedData;
}
