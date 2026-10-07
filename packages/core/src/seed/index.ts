/**
 * The seed: one Dataset loaded into both the browser mock and SQLite.
 * Tests assert SPEC.md "Seed data" numbers against it with today = DEFAULT_TODAY.
 * buildSeed() returns a fresh deep copy each call.
 */
import { makeSnapshot } from '../calculator.js';
import { sydneyStamp } from '../dates.js';
import { cloneDataset, type Dataset, type ForecastSnapshot, type Job } from '../types.js';
import { BEATTY, BEATTY_TILER, beattyItems, beattyJob, beattyNotes, beattyProgram } from './beatty.js';
import { designItems, designJobs, designStages } from './design.js';
import { duplexProgram } from './duplexProgram.js';
import { ProgramBuilder, SIDE_ND, SIDE_NORM } from './helpers.js';
import { seedLog } from './log.js';
import { PARK_RD, parkRdItems, parkRdJob, parkRdNotes, parkRdPhotos, parkRdProgram, parkRdShipments } from './parkRd.js';
import { SEAVIEW, seaviewItems, seaviewJob, seaviewNotes, seaviewPhotos, seaviewProgram, seaviewShipments } from './seaview.js';
import { trades } from './trades.js';

export { SIDE_ND, SIDE_NORM } from './helpers.js';
export { PARK_RD, PARK_RD_WINDOWS } from './parkRd.js';
export { SEAVIEW, SEAVIEW_WINDOWS } from './seaview.js';
export { BEATTY, BEATTY_TILER } from './beatty.js';
export { SEED_SENDER } from './log.js';
export { TR as TRADE_IDS } from './trades.js';

/** Bump when the seed's shape or numbers change, so a stale browser copy reseeds. */
export const SEED_VERSION = 2;

/** Thu 17 Sep 2026: the default "today" for the demo and every test. */
export const DEFAULT_TODAY = '2026-09-17';

export const TEMPLATE_DUPLEX = 'tpl-duplex';

const templateJob: Job = {
  id: TEMPLATE_DUPLEX,
  sideId: SIDE_ND,
  name: 'Duplex',
  kind: 'build',
  path: 'CDC',
  weeklyHoldingCost: null,
  lastConfirmed: null,
  isTemplate: true,
  plannedFinish: null,
  startDate: null,
  startsFromStageId: null,
  templateId: null,
  createdAt: '2026-05-01',
};
const templateProgram = duplexProgram(new ProgramBuilder(TEMPLATE_DUPLEX, false)).prefixIds('tpl');

function assemble(): Dataset {
  const programs = [parkRdProgram, seaviewProgram, beattyProgram, templateProgram];
  const log = seedLog();
  const ds: Dataset = {
    sides: [
      { id: SIDE_ND, name: 'Norm and Dom' },
      { id: SIDE_NORM, name: 'Norm' },
    ],
    users: [{ id: 'dominic', name: 'Dominic', telegramUserId: null }],
    jobs: [parkRdJob, seaviewJob, beattyJob, ...designJobs, templateJob],
    stages: [...programs.flatMap((p) => p.stages), ...designStages],
    steps: programs.flatMap((p) => p.steps),
    stepLinks: programs.flatMap((p) => p.links),
    requirements: programs.flatMap((p) => p.requirements),
    items: [...parkRdItems, ...seaviewItems, ...beattyItems, ...designItems],
    trades,
    shipments: [...parkRdShipments, ...seaviewShipments],
    photoCategories: [...programs.flatMap((p) => p.categories), ...designJobs.map((j, i) => ({
      id: `${j.id}-pc-general`,
      jobId: j.id,
      stageId: null,
      name: 'General',
      requiredForHoldPoint: false,
      order: i + 1,
    }))],
    photos: [...parkRdPhotos, ...seaviewPhotos],
    dailyNotes: [...parkRdNotes, ...seaviewNotes, ...beattyNotes],
    snapshots: [],
    inboundMessages: log.inboundMessages,
    changeSets: log.changeSets,
    changes: log.changes,
  };

  // Monday snapshots, saved by the calculator as the scheduler would.
  const snap = (src: Dataset, jobId: string, date: string): ForecastSnapshot =>
    makeSnapshot(src, jobId, date, sydneyStamp(date, '06:00'), `snap-${jobId}-${date}`);
  // Before Tue 15 Sep the tiler was expected Mon 28 Sep.
  const beattyBefore = cloneDataset(ds);
  beattyBefore.items.find((i) => i.id === BEATTY_TILER)!.expectedDate = '2026-09-28';
  ds.snapshots = [
    snap(ds, PARK_RD, '2026-09-07'),
    snap(ds, PARK_RD, '2026-09-14'),
    snap(ds, SEAVIEW, '2026-09-07'),
    snap(ds, SEAVIEW, '2026-09-14'),
    snap(beattyBefore, BEATTY, '2026-09-07'),
    // Stored value (SPEC): Sun 29 Nov, so slip reads +5 days. A calculator
    // snapshot would say Fri 27 Nov; see PROGRESS.md.
    { ...snap(beattyBefore, BEATTY, '2026-09-14'), forecastFinish: '2026-11-29' },
  ];
  return ds;
}

const FROZEN = assemble();

export function buildSeed(): Dataset {
  return cloneDataset(FROZEN);
}
