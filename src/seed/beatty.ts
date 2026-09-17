/**
 * 26a Beatty St: a renovation entered at stage level, $2,000/wk.
 * The tiler is expected Mon 5 Oct, a week after Tiling was planned to start
 * (Mon 28 Sep), so every step after it moves 5 working days: planned finish
 * Fri 27 Nov becomes Fri 4 Dec. The 14 Sep snapshot is seeded at 29 Nov so
 * slip is exactly +5 calendar days, $1,430 (SPEC numbers).
 */
import type { ActivityEntry, DailyNote, ForecastSnapshot, Item, Job, Notification } from '../domain/types';
import { P, ProgramBuilder, SIDE_ND, item } from './helpers';

export const BEATTY = 'beatty';

export const beattyJob: Job = {
  id: BEATTY,
  sideId: SIDE_ND,
  name: '26a Beatty St',
  address: '26a Beatty St, Example NSW',
  kind: 'build',
  path: 'CDC',
  weeklyHoldingCost: 2000,
  lastConfirmed: '2026-09-08',
  isTemplate: false,
  startDate: '2026-08-03',
  createdAt: '2026-07-20',
};

export const beattyProgram = (() => {
  const b = new ProgramBuilder(BEATTY, SIDE_ND, true);
  b.stage('bt-st-demo', 'Demolition', 'done')
    .stage('bt-st-lockup', 'Lock-up', 'done')
    .stage('bt-st-roughin', 'Rough-in', 'in_progress')
    .stage('bt-st-tiling', 'Tiling')
    .stage('bt-st-finishes', 'Finishes')
    .stage('bt-st-handover', 'Handover');

  b.step({ id: 'bt-demo', stage: 'bt-st-demo', name: 'Demolition, whole stage', duration: 10, start: '2026-08-03', status: 'done', placeholder: true })
    .step({ id: 'bt-lockup', stage: 'bt-st-lockup', name: 'Lock-up, whole stage', duration: 15, after: 'bt-demo', status: 'done', placeholder: true })
    .step({ id: 'bt-roughin', stage: 'bt-st-roughin', name: 'Rough-in, whole stage', duration: 15, after: 'bt-lockup', status: 'in_progress', placeholder: true, trade: 'Plumber, Electrician' })
    .step({ id: 'bt-tiling', stage: 'bt-st-tiling', name: 'Tiling, whole stage', duration: 10, after: 'bt-roughin', placeholder: true, trade: 'Tiler' })
    .step({ id: 'bt-finishes', stage: 'bt-st-finishes', name: 'Finishes, whole stage', duration: 30, after: 'bt-tiling', placeholder: true, trade: 'Painter, Joiner' })
    .step({ id: 'bt-handover', stage: 'bt-st-handover', name: 'Handover, whole stage', duration: 5, after: 'bt-finishes', placeholder: true });

  b.req({ id: 'bt-rq-tiler', step: 'bt-tiling', kind: 'trade', name: 'Tiler', lead: 3, trade: 'Tiler' })
    .req({ id: 'bt-rq-tiles', step: 'bt-tiling', kind: 'material', name: 'Tiles', lead: 1 })
    .req({ id: 'bt-rq-painter', step: 'bt-finishes', kind: 'trade', name: 'Painter', lead: 4, trade: 'Painter' });

  b.category('bt-pc-general', null, 'General')
    .category('bt-pc-roughin', 'bt-st-roughin', 'Rough-in before plasterboard')
    .category('bt-pc-waterproofing', 'bt-st-tiling', 'Wet area waterproofing')
    .category('bt-pc-finishes', 'bt-st-handover', 'Final finishes');
  return b;
})();

const J = BEATTY;

export const beattyItems: Item[] = [
  item({ id: 'it-bt-tiler', job: J, type: 'trade', title: 'Book tiler', waitingOn: 'Marino Tiling', trade: 'tr-tiler', owner: P.raff, step: 'bt-tiling', requirement: 'bt-rq-tiler', lead: 3, status: 'booked', expected: '2026-10-05', created: '2026-08-17', notes: 'Marino is finishing another job. Earliest is 5 Oct.' }),
  item({ id: 'it-bt-tiles', job: J, type: 'material', title: 'Order tiles', waitingOn: 'Tile warehouse', owner: P.raff, step: 'bt-tiling', requirement: 'bt-rq-tiles', lead: 1, status: 'to_do', created: '2026-08-17' }),
  item({ id: 'it-bt-vanity', job: J, type: 'material', title: 'Order vanity and tapware', waitingOn: 'Bathroom supplier', owner: P.raff, step: 'bt-finishes', lead: 2, status: 'to_do', created: '2026-08-17' }),
  item({ id: 'it-bt-painter', job: J, type: 'trade', title: 'Book painter', waitingOn: 'Fresh Coat Painting', trade: 'tr-painter', owner: P.raff, step: 'bt-finishes', requirement: 'bt-rq-painter', lead: 4, status: 'confirmed', expected: '2026-10-19', confirmed: '2026-09-09', created: '2026-08-17' }),
  item({ id: 'it-bt-electrician', job: J, type: 'trade', title: 'Book electrician for rough-in', waitingOn: 'Volt Electrical', trade: 'tr-electrician', owner: P.raff, step: 'bt-roughin', lead: 2, status: 'done', expected: '2026-09-07', confirmed: '2026-08-25', created: '2026-08-17', doneAt: '2026-09-07' }),
  item({ id: 'it-bt-defect', job: J, type: 'defect', title: 'Leaking window flashing, bedroom 2', waitingOn: 'Southside Roofing', trade: 'tr-roofplumber', owner: P.raff, neededBy: '2026-10-09', lead: 0, status: 'booked', created: '2026-09-11' }),
];

export const beattyNotes: DailyNote[] = [
  { id: 'dn-bt-0916', sideId: SIDE_ND, jobId: J, date: '2026-09-16', authorId: P.raff, text: 'Plumber rough-in done. Electrician back Friday for the last circuits.', createdAt: '2026-09-16T17:30' },
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
  { id: 'nt-bt-1', sideId: SIDE_ND, personId: P.dominic, kind: 'hold_point_week_away', at: '2026-09-15T07:00', text: '26a Beatty St has not been confirmed for 7 days', read: false, jobId: J },
];
