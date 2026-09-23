/**
 * 26a Beatty St, Balgowlah Heights: Dom's own house, a dual occupancy with
 * basement on Lot 1 DP 217340. Demolition Oct 2025, CDC through Certex Dec
 * 2025, Constructaview (Raff) on site, roof slab poured May 2026. Now in
 * internal fit-out with the external works (driveway, fence, landscaping)
 * running alongside. Entered at stage level, $2,000/wk.
 * The done stages carry their real windows; the chain from Rough-in on is the
 * prototype's: the tiler is expected Mon 5 Oct, a week after Tiling was planned
 * to start (Mon 28 Sep), so every step after it moves 5 working days: planned
 * finish Fri 27 Nov becomes Fri 4 Dec. The 14 Sep snapshot is seeded at 29 Nov
 * so slip is exactly +5 calendar days, $1,430 (SPEC numbers).
 */
import type { ActivityEntry, DailyNote, ForecastSnapshot, Item, Job, Notification } from '../domain/types';
import { P, ProgramBuilder, SIDE_ND, item } from './helpers';

export const BEATTY = 'beatty';

export const beattyJob: Job = {
  id: BEATTY,
  sideId: SIDE_ND,
  name: '26a Beatty St',
  address: '26a Beatty St, Balgowlah Heights NSW 2093',
  kind: 'build',
  path: 'CDC',
  weeklyHoldingCost: 2000,
  lastConfirmed: '2026-09-08',
  isTemplate: false,
  startDate: '2025-10-20',
  createdAt: '2025-10-06',
};

export const beattyProgram = (() => {
  const b = new ProgramBuilder(BEATTY, SIDE_ND, true);
  b.stage('bt-st-demo', 'Demolition', 'done')
    .stage('bt-st-structure', 'Basement and slabs', 'done')
    .stage('bt-st-lockup', 'Lock-up', 'done')
    .stage('bt-st-roughin', 'Rough-in', 'in_progress')
    .stage('bt-st-tiling', 'Tiling')
    .stage('bt-st-finishes', 'Finishes')
    .stage('bt-st-external', 'External works')
    .stage('bt-st-handover', 'Handover');

  b.step({ id: 'bt-demo', stage: 'bt-st-demo', name: 'Demolition, whole stage', duration: 15, start: '2025-10-20', status: 'done', placeholder: true, trade: 'Demolition' })
    .step({ id: 'bt-structure', stage: 'bt-st-structure', name: 'Basement, slabs and roof slab, whole stage', duration: 110, start: '2026-01-12', after: 'bt-demo', status: 'done', placeholder: true, trade: 'Formwork and concrete' })
    .step({ id: 'bt-lockup', stage: 'bt-st-lockup', name: 'Lock-up, whole stage', duration: 55, start: '2026-06-15', after: 'bt-structure', status: 'done', placeholder: true })
    .step({ id: 'bt-roughin', stage: 'bt-st-roughin', name: 'Rough-in, whole stage', duration: 15, start: '2026-09-07', after: 'bt-lockup', status: 'in_progress', placeholder: true, trade: 'Plumber, Electrician' })
    .step({ id: 'bt-tiling', stage: 'bt-st-tiling', name: 'Tiling, whole stage', duration: 10, after: 'bt-roughin', placeholder: true, trade: 'Tiler' })
    .step({ id: 'bt-finishes', stage: 'bt-st-finishes', name: 'Finishes, whole stage', duration: 30, after: 'bt-tiling', placeholder: true, trade: 'Painter, Joiner' })
    // Runs alongside the fit-out: started 14 Sep with the civils meeting, done well before handover.
    .step({ id: 'bt-external', stage: 'bt-st-external', name: 'Driveway, front fence and landscaping', duration: 40, start: '2026-09-14', status: 'in_progress', placeholder: true, trade: 'Sydney Water tap-in, Landscaper' })
    .step({ id: 'bt-handover', stage: 'bt-st-handover', name: 'Handover, whole stage', duration: 5, after: ['bt-finishes', 'bt-external'], placeholder: true });

  b.req({ id: 'bt-rq-tiler', step: 'bt-tiling', kind: 'trade', name: 'Tiler', lead: 3, trade: 'Tiler' })
    .req({ id: 'bt-rq-tiles', step: 'bt-tiling', kind: 'material', name: 'Tiles', lead: 1 })
    .req({ id: 'bt-rq-painter', step: 'bt-finishes', kind: 'trade', name: 'Painter', lead: 4, trade: 'Painter' });

  b.category('bt-pc-general', null, 'General')
    .category('bt-pc-roughin', 'bt-st-roughin', 'Rough-in before plasterboard')
    .category('bt-pc-waterproofing', 'bt-st-tiling', 'Wet area waterproofing')
    .category('bt-pc-external', 'bt-st-external', 'Driveway and fence')
    .category('bt-pc-finishes', 'bt-st-handover', 'Final finishes');
  return b;
})();

const J = BEATTY;

export const beattyItems: Item[] = [
  item({ id: 'it-bt-tiler', job: J, type: 'trade', title: 'Book tiler', waitingOn: 'Competent Tiling', trade: 'tr-competent', owner: P.raff, step: 'bt-tiling', requirement: 'bt-rq-tiler', lead: 3, status: 'booked', expected: '2026-10-05', created: '2026-08-17', notes: 'Competent is finishing another job. Earliest is 5 Oct.' }),
  item({ id: 'it-bt-tiles', job: J, type: 'material', title: 'Order tiles', waitingOn: 'Tile warehouse', owner: P.raff, step: 'bt-tiling', requirement: 'bt-rq-tiles', lead: 1, status: 'to_do', created: '2026-08-17' }),
  item({ id: 'it-bt-vanity', job: J, type: 'material', title: 'Order vanity and tapware', waitingOn: 'Harvey Norman Commercial', owner: P.raff, step: 'bt-finishes', lead: 2, status: 'to_do', created: '2026-08-17' }),
  item({ id: 'it-bt-painter', job: J, type: 'trade', title: 'Book painter', waitingOn: 'Painter', owner: P.raff, step: 'bt-finishes', requirement: 'bt-rq-painter', lead: 4, status: 'confirmed', expected: '2026-10-19', confirmed: '2026-09-09', created: '2026-08-17' }),
  item({ id: 'it-bt-electrician', job: J, type: 'trade', title: 'Book electrician for rough-in', waitingOn: 'One Connection', trade: 'tr-oneconn', owner: P.raff, step: 'bt-roughin', lead: 2, status: 'done', expected: '2026-09-07', confirmed: '2026-08-25', created: '2026-08-17', doneAt: '2026-09-07' }),
  item({ id: 'it-bt-joinery', job: J, type: 'material', title: 'Order joinery', waitingOn: 'Wooden Age Joinery', trade: 'tr-woodenage', owner: P.raff, step: 'bt-finishes', lead: 6, status: 'confirmed', expected: '2026-10-19', confirmed: '2026-09-16', created: '2026-08-17', notes: 'Revision 6 signed 16 Sep.' }),
  item({ id: 'it-bt-kitchen', job: J, type: 'material', title: 'Order kitchens', waitingOn: 'Industry Kitchens', trade: 'tr-industry', owner: P.raff, step: 'bt-finishes', lead: 8, status: 'confirmed', expected: '2026-10-19', confirmed: '2026-06-22', created: '2026-06-01', notes: 'Ordered June.' }),
  item({ id: 'it-bt-workszone', job: J, type: 'council_request', title: 'Works zone permit', waitingOn: 'Northern Beaches Council', owner: P.dominic, neededBy: '2026-04-14', lead: 0, status: 'done', created: '2026-03-16', doneAt: '2026-04-14', notes: 'PERM2026/00630, runs to 14 Dec.' }),
  item({ id: 'it-bt-tapin', job: J, type: 'trade', title: 'Sydney Water tap-in', waitingOn: 'Multitask Civil', trade: 'tr-multitask', owner: P.raff, neededBy: '2026-08-14', lead: 2, status: 'done', created: '2026-06-22', doneAt: '2026-08-12' }),
  item({ id: 'it-bt-driveway', job: J, type: 'decision', title: 'Driveway civils: kerb and layback detail', waitingOn: 'Dominic', owner: P.dominic, neededBy: '2026-10-16', lead: 0, status: 'to_do', created: '2026-09-14', notes: 'Site meeting 14 Sep with the civils crew.' }),
  item({ id: 'it-bt-defect', job: J, type: 'defect', title: 'Leaking window flashing, bedroom 2', waitingOn: 'Build Solid Carpentry', trade: 'tr-buildsolid', owner: P.raff, neededBy: '2026-10-09', lead: 0, status: 'booked', expected: '2026-09-24', created: '2026-09-11' }),
];

export const beattyNotes: DailyNote[] = [
  { id: 'dn-bt-0916', sideId: SIDE_ND, jobId: J, date: '2026-09-16', authorId: P.raff, text: 'Plumber rough-in done. One Connection back Friday for the last circuits.', createdAt: '2026-09-16T17:30' },
];

export const beattySnapshots: ForecastSnapshot[] = [
  { id: 'snap-bt-0907', sideId: SIDE_ND, jobId: J, date: '2026-09-07', forecastFinish: '2026-11-27' },
  // Seeded so slip reads +5 days against today's Fri 4 Dec forecast (SPEC). A
  // calculator-saved snapshot would land on a weekday.
  { id: 'snap-bt-0914', sideId: SIDE_ND, jobId: J, date: '2026-09-14', forecastFinish: '2026-11-29' },
];

export const beattyActivity: ActivityEntry[] = [
  { id: 'act-bt-1', sideId: SIDE_ND, kind: 'job_confirmed', at: '2026-09-08T16:20', personId: P.dominic, jobId: J, text: 'Confirmed 26a Beatty St with Raff' },
  { id: 'act-bt-2', sideId: SIDE_ND, kind: 'item_expected_changed', at: '2026-09-15T10:12', personId: P.raff, jobId: J, itemId: 'it-bt-tiler', from: '2026-09-28', to: '2026-10-05', text: 'Book tiler expected date moved 28 Sep to 5 Oct' },
];

export const beattyNotifications: Notification[] = [
  { id: 'nt-bt-1', sideId: SIDE_ND, personId: P.dominic, kind: 'job_unconfirmed', at: '2026-09-15T07:00', text: '26a Beatty St has not been confirmed for 7 days', read: false, jobId: J },
];
