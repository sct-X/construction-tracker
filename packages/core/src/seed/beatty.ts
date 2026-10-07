/**
 * Beatty St: entered at stage level, $2,000/wk, last confirmed 9 days ago
 * (amber). The tiler was expected Mon 28 Sep, when Tiling was planned to
 * start; on Tue 15 Sep Dominic logged that the tiler can't come until Mon
 * 5 Oct (seeded change set), which moves every step after it 5 working days:
 * planned finish Fri 27 Nov becomes Fri 4 Dec. The 14 Sep snapshot is stored
 * at Sun 29 Nov so slip reads exactly +5 days, $1,430 (SPEC numbers).
 */
import { sydneyStamp } from '../dates.js';
import type { DailyNote, Item, Job } from '../types.js';
import { ProgramBuilder, SIDE_ND, item } from './helpers.js';
import { TR } from './trades.js';

export const BEATTY = 'beatty';
const J = BEATTY;

export const beattyJob: Job = {
  id: J,
  sideId: SIDE_ND,
  name: 'Beatty St',
  kind: 'build',
  path: 'CDC',
  weeklyHoldingCost: 2000,
  lastConfirmed: '2026-09-08',
  isTemplate: false,
  plannedFinish: '2026-11-27',
  startDate: '2025-10-20',
  startsFromStageId: null,
  templateId: null,
  createdAt: '2025-10-06',
};

export const beattyProgram = (() => {
  const b = new ProgramBuilder(J, true);
  b.stage('bt-st-demo', 'Demolition', 'done')
    .stage('bt-st-structure', 'Basement and slabs', 'done')
    .stage('bt-st-lockup', 'Lock-up', 'done')
    .stage('bt-st-roughin', 'Rough-in', 'in_progress')
    .stage('bt-st-tiling', 'Tiling')
    .stage('bt-st-finishes', 'Finishes')
    .stage('bt-st-external', 'External works')
    .stage('bt-st-handover', 'Handover');

  b.step({ id: 'bt-demo', stage: 'bt-st-demo', name: 'Demolition, whole stage', duration: 15, start: '2025-10-20', status: 'done', placeholder: true, trade: 'Demolition' })
    .step({ id: 'bt-structure', stage: 'bt-st-structure', name: 'Basement and slabs, whole stage', duration: 110, start: '2026-01-12', after: 'bt-demo', status: 'done', placeholder: true, trade: 'Formwork and concrete' })
    .step({ id: 'bt-lockup', stage: 'bt-st-lockup', name: 'Lock-up, whole stage', duration: 55, start: '2026-06-15', after: 'bt-structure', status: 'done', placeholder: true })
    .step({ id: 'bt-roughin', stage: 'bt-st-roughin', name: 'Rough-in, whole stage', duration: 15, start: '2026-09-07', after: 'bt-lockup', status: 'in_progress', placeholder: true, trade: 'Plumber, Electrician' })
    .step({ id: 'bt-tiling', stage: 'bt-st-tiling', name: 'Tiling, whole stage', duration: 10, after: 'bt-roughin', placeholder: true, trade: 'Tiler' })
    .step({ id: 'bt-finishes', stage: 'bt-st-finishes', name: 'Finishes, whole stage', duration: 30, after: 'bt-tiling', placeholder: true, trade: 'Painter, Joiner' })
    // Runs alongside the fit-out and ends well before handover.
    .step({ id: 'bt-external', stage: 'bt-st-external', name: 'Driveway, front fence and landscaping', duration: 40, start: '2026-09-14', status: 'in_progress', placeholder: true, trade: 'Civil, Landscaper' })
    .step({ id: 'bt-handover', stage: 'bt-st-handover', name: 'Handover, whole stage', duration: 5, after: ['bt-finishes', 'bt-external'], placeholder: true });

  b.req('bt-rq-tiler', 'bt-tiling', 'trade', 'Tiler', 3, 'Tiler')
    .req('bt-rq-tiles', 'bt-tiling', 'material', 'Tiles', 1)
    .req('bt-rq-painter', 'bt-finishes', 'trade', 'Painter', 4, 'Painter');

  b.category('bt-pc-general', null, 'General')
    .category('bt-pc-roughin', 'bt-st-roughin', 'Rough-in before plasterboard')
    .category('bt-pc-waterproofing', 'bt-st-tiling', 'Wet area waterproofing')
    .category('bt-pc-external', 'bt-st-external', 'Driveway and fence')
    .category('bt-pc-finishes', 'bt-st-handover', 'Final finishes');
  return b;
})();

export const BEATTY_TILER = 'it-bt-tiler';

export const beattyItems: Item[] = [
  item({ id: BEATTY_TILER, job: J, type: 'trade', title: 'Book tiler', waitingOn: 'Harbour Tiling', trade: TR.tiler, owner: 'Raff', step: 'bt-tiling', requirement: 'bt-rq-tiler', status: 'ordered_or_booked', expected: '2026-10-05', created: '2026-08-17', notes: 'Harbour Tiling is finishing another job. Earliest is 5 Oct.' }),
  item({ id: 'it-bt-tiles', job: J, type: 'material', title: 'Order tiles', waitingOn: 'Tile warehouse', owner: 'Raff', step: 'bt-tiling', requirement: 'bt-rq-tiles', status: 'to_do', created: '2026-08-17' }),
  item({ id: 'it-bt-vanity', job: J, type: 'material', title: 'Order vanity and tapware', waitingOn: 'Bathroom supplier', owner: 'Raff', step: 'bt-finishes', lead: 2, status: 'to_do', created: '2026-08-17' }),
  item({ id: 'it-bt-painter', job: J, type: 'trade', title: 'Book painter', waitingOn: 'Fresh Coat Painting', trade: TR.painter, owner: 'Raff', step: 'bt-finishes', requirement: 'bt-rq-painter', status: 'confirmed', expected: '2026-10-12', confirmed: '2026-09-09', created: '2026-08-17', notes: 'Booked to follow the tiler.' }),
  item({ id: 'it-bt-electrician', job: J, type: 'trade', title: 'Book electrician for rough-in', waitingOn: 'Brightline Electrical', trade: TR.sparky, owner: 'Raff', step: 'bt-roughin', lead: 2, status: 'done', expected: '2026-09-07', confirmed: '2026-08-25', created: '2026-08-17', doneAt: '2026-09-07' }),
  item({ id: 'it-bt-joinery', job: J, type: 'material', title: 'Order joinery', waitingOn: 'Oakline Joinery', trade: TR.joiner, owner: 'Raff', step: 'bt-finishes', lead: 6, status: 'confirmed', expected: '2026-10-09', confirmed: '2026-09-16', created: '2026-08-17' }),
  item({ id: 'it-bt-workszone', job: J, type: 'council_request', title: 'Works zone permit', waitingOn: 'Council', owner: 'Dominic', neededBy: '2026-04-14', lead: 0, status: 'done', created: '2026-03-16', doneAt: '2026-04-14' }),
  item({ id: 'it-bt-tapin', job: J, type: 'trade', title: 'Sydney Water tap-in', waitingOn: 'Gully Civil', trade: TR.civil, owner: 'Raff', neededBy: '2026-08-14', lead: 2, status: 'done', created: '2026-06-22', doneAt: '2026-08-12' }),
  item({ id: 'it-bt-driveway', job: J, type: 'decision', title: 'Driveway kerb and layback detail', waitingOn: 'Dominic', owner: 'Dominic', neededBy: '2026-10-16', lead: 0, status: 'to_do', created: '2026-09-14' }),
  item({ id: 'it-bt-defect', job: J, type: 'defect', title: 'Leaking window flashing, bedroom 2', waitingOn: 'Solid Frame Carpentry', trade: TR.carpenter, owner: 'Raff', neededBy: '2026-10-09', lead: 0, status: 'ordered_or_booked', expected: '2026-09-24', created: '2026-09-11' }),
];

export const beattyNotes: DailyNote[] = [
  { id: 'dn-bt-0916', jobId: J, date: '2026-09-16', text: 'Plumber rough-in done. Electrician back Friday for the last circuits.', createdAt: sydneyStamp('2026-09-16', '17:30'), messageId: null },
];
