/**
 * 18 Cutler Pde, North Ryde: two houses with a basement and pools on a
 * 919 m² block, to be Torrens subdivided. CDC through Certex 4 Feb 2026,
 * set-out 28 Apr 2026, Elek Constructions building. The basement is being
 * poured now; the roof form was revised in September. Entered at stage level,
 * $5,000/wk. Today is Thu 17 Sep 2026.
 */
import type { ActivityEntry, DailyNote, Item, Job } from '../domain/types';
import { P, ProgramBuilder, SIDE_ND, item } from './helpers';

export const CUTLER = 'cutler';

export const cutlerJob: Job = {
  id: CUTLER,
  sideId: SIDE_ND,
  name: '18 Cutler Pde',
  address: '18 Cutler Pde, North Ryde NSW 2113',
  kind: 'build',
  path: 'CDC',
  weeklyHoldingCost: 5000,
  lastConfirmed: '2026-09-15',
  isTemplate: false,
  startDate: '2026-05-04',
  createdAt: '2026-02-09',
};

export const cutlerProgram = (() => {
  const b = new ProgramBuilder(CUTLER, SIDE_ND, true);
  b.stage('cu-st-site', 'Site establishment', 'done')
    .stage('cu-st-excavation', 'Excavation and shoring', 'done')
    .stage('cu-st-basement', 'Basement', 'in_progress')
    .stage('cu-st-gf', 'Ground floor')
    .stage('cu-st-ff', 'First floor')
    .stage('cu-st-roof', 'Roof')
    .stage('cu-st-lockup', 'Lock-up')
    .stage('cu-st-fitout', 'Fit-out')
    .stage('cu-st-external', 'External works and pools')
    .stage('cu-st-handover', 'Handover');

  b.step({ id: 'cu-site', stage: 'cu-st-site', name: 'Site establishment and set-out', duration: 10, start: '2026-05-04', status: 'done', placeholder: true, trade: 'Surveyor' })
    .step({ id: 'cu-excavation', stage: 'cu-st-excavation', name: 'Excavation and shoring, whole stage', duration: 30, start: '2026-05-18', after: 'cu-site', status: 'done', placeholder: true, trade: 'Demolition and excavation' })
    .step({ id: 'cu-basement', stage: 'cu-st-basement', name: 'Basement slab, walls and suspended slab', duration: 60, start: '2026-07-06', after: 'cu-excavation', status: 'in_progress', placeholder: true, trade: 'Formwork and concrete' })
    .step({ id: 'cu-gf', stage: 'cu-st-gf', name: 'Ground floor, whole stage', duration: 40, after: 'cu-basement', placeholder: true, trade: 'Formwork and concrete' })
    .step({ id: 'cu-ff', stage: 'cu-st-ff', name: 'First floor, whole stage', duration: 40, after: 'cu-gf', placeholder: true })
    .step({ id: 'cu-roof', stage: 'cu-st-roof', name: 'Roof, whole stage', duration: 25, after: 'cu-ff', placeholder: true, trade: 'Roof carpenter' })
    .step({ id: 'cu-lockup', stage: 'cu-st-lockup', name: 'Lock-up, whole stage', duration: 40, after: 'cu-roof', placeholder: true })
    .step({ id: 'cu-fitout', stage: 'cu-st-fitout', name: 'Fit-out, whole stage', duration: 100, after: 'cu-lockup', placeholder: true })
    .step({ id: 'cu-external', stage: 'cu-st-external', name: 'Pools, driveway and landscaping', duration: 40, after: 'cu-fitout', placeholder: true })
    .step({ id: 'cu-handover', stage: 'cu-st-handover', name: 'Handover and subdivision', duration: 5, after: 'cu-external', placeholder: true });

  b.req({ id: 'cu-rq-electrician', step: 'cu-fitout', kind: 'trade', name: 'Electrician', lead: 4, trade: 'Electrician' })
    .req({ id: 'cu-rq-windows', step: 'cu-lockup', kind: 'material', name: 'Windows and doors', lead: 12 });

  b.category('cu-pc-general', null, 'General')
    .category('cu-pc-basement-steel', 'cu-st-basement', 'Basement steel before pour')
    .category('cu-pc-basement-wp', 'cu-st-basement', 'Basement waterproofing');
  return b;
})();

const J = CUTLER;

export const cutlerItems: Item[] = [
  item({ id: 'it-cu-roof-rev', job: J, type: 'consultant_report', title: 'Revised roof drawings for the certifier', waitingOn: 'ND Group', owner: P.dominic, neededBy: '2026-09-25', lead: 0, status: 'booked', created: '2026-09-12', notes: 'Roof form changed 12 to 15 Sep. Certex needs the amended set.' }),
  item({ id: 'it-cu-electrician', job: J, type: 'trade', title: 'Book electrician', waitingOn: 'A1 Sydney Electrical', trade: 'tr-a1', owner: P.dominic, step: 'cu-fitout', requirement: 'cu-rq-electrician', lead: 4, status: 'booked', created: '2026-06-15', notes: 'Quoted per house.' }),
  item({ id: 'it-cu-windows', job: J, type: 'material', title: 'Windows and doors', waitingOn: 'Window supplier, to be chosen', owner: P.dominic, step: 'cu-lockup', requirement: 'cu-rq-windows', lead: 12, status: 'to_do', created: '2026-09-01', notes: 'HiHaus or local. Decide once the roof set is back.' }),
  item({ id: 'it-cu-water', job: J, type: 'council_request', title: 'Sydney Water servicing', waitingOn: 'RMAI', owner: P.dominic, neededBy: '2026-11-27', lead: 0, status: 'booked', created: '2026-08-10', notes: 'RMAI engaged in August as water servicing coordinator.' }),
  item({ id: 'it-cu-pool', job: J, type: 'decision', title: 'Pool shell contractor', waitingOn: 'Dominic', owner: P.dominic, neededBy: '2026-11-13', lead: 0, status: 'to_do', created: '2026-09-01' }),
  item({ id: 'it-cu-basement-insp', job: J, type: 'inspection', title: 'Basement slab inspection', waitingOn: 'Certex Approvals', trade: 'tr-certex', owner: P.dominic, step: 'cu-basement', lead: 1, status: 'done', expected: '2026-07-24', confirmed: '2026-07-20', created: '2026-07-06', doneAt: '2026-07-24' }),
  item({ id: 'it-cu-bonds', job: J, type: 'council_request', title: 'Council bonds and damage deposit', waitingOn: 'City of Ryde', owner: P.dominic, neededBy: '2026-04-30', lead: 0, status: 'done', created: '2026-04-14', doneAt: '2026-04-28' }),
  item({ id: 'it-cu-dilaps', job: J, type: 'consultant_report', title: 'Dilapidation reports for the neighbours', waitingOn: 'AusDilaps', owner: P.dominic, neededBy: '2026-05-01', lead: 0, status: 'done', created: '2026-04-10', doneAt: '2026-04-27' }),
];

export const cutlerNotes: DailyNote[] = [
  { id: 'dn-cu-0916', sideId: SIDE_ND, jobId: J, date: '2026-09-16', authorId: P.dominic, text: 'Elek pouring the basement walls, east side. Roof revision back from ND Group Friday.', createdAt: '2026-09-16T18:05' },
];

export const cutlerActivity: ActivityEntry[] = [
  { id: 'act-cu-1', sideId: SIDE_ND, kind: 'job_added', at: '2026-02-09T09:30', personId: P.dominic, jobId: J, text: 'Created 18 Cutler Pde at stage level' },
  { id: 'act-cu-2', sideId: SIDE_ND, kind: 'item_added', at: '2026-09-12T15:40', personId: P.dominic, jobId: J, itemId: 'it-cu-roof-rev', text: 'Added consultant report: Revised roof drawings for the certifier' },
  { id: 'act-cu-3', sideId: SIDE_ND, kind: 'job_confirmed', at: '2026-09-15T17:20', personId: P.dominic, jobId: J, text: 'Confirmed 18 Cutler Pde with Elek' },
];
