/**
 * Four design jobs (rule 9: stages as a checklist, no steps).
 * Ages are days since the item was created, with today = Thu 17 Sep 2026:
 * West St oldest 23 days, Tollbar 8, Lower Beach none, John St 4.
 */
import type { Item, Job, Stage } from '../domain/types';
import { P, SIDE_ND, item } from './helpers';

function job(id: string, name: string, path: 'DA' | 'CDC', createdAt: string, lastConfirmed?: string): Job {
  return { id, sideId: SIDE_ND, name, address: `${name}, Example NSW`, kind: 'design', path, isTemplate: false, lastConfirmed, createdAt };
}

const DA_STAGES = ['Design', 'With council', 'Approved', 'Construction certificate'];
const CDC_STAGES = ['Design', 'With certifier', 'Approved'];

function stages(jobId: string, path: 'DA' | 'CDC', doneCount: number): Stage[] {
  const names = path === 'DA' ? DA_STAGES : CDC_STAGES;
  return names.map((name, i) => ({
    id: `${jobId}-st-${i + 1}`,
    sideId: SIDE_ND,
    jobId,
    name,
    order: i + 1,
    status: i < doneCount ? 'done' : i === doneCount ? 'in_progress' : 'not_started',
  }));
}

export const designJobs: Job[] = [
  job('west-st', '59-61 West St', 'DA', '2026-05-04', '2026-09-14'),
  job('tollbar', '18 Tollbar Ave', 'DA', '2026-06-15', '2026-09-14'),
  job('lower-beach', '33 Lower Beach St', 'CDC', '2026-08-03', '2026-09-14'),
  job('john-st', '13 John St', 'DA', '2026-08-31', '2026-09-14'),
];

export const designStages: Stage[] = [
  ...stages('west-st', 'DA', 1),
  ...stages('tollbar', 'DA', 1),
  ...stages('lower-beach', 'CDC', 0),
  ...stages('john-st', 'DA', 0),
];

export const designItems: Item[] = [
  // West St: with council, 2 outstanding, oldest 23 days
  item({ id: 'it-ws-traffic', job: 'west-st', type: 'consultant_report', title: 'Traffic report', waitingOn: 'Traffix consultants', owner: P.dominic, neededBy: '2026-09-25', lead: 0, status: 'booked', created: '2026-08-25', notes: 'Council asked for it in the RFI.' }),
  item({ id: 'it-ws-rfi', job: 'west-st', type: 'council_request', title: 'Respond to council RFI on side setbacks', waitingOn: 'Council', owner: P.dominic, neededBy: '2026-09-25', lead: 0, status: 'to_do', created: '2026-09-03' }),
  item({ id: 'it-ws-lodge', job: 'west-st', type: 'council_request', title: 'Lodge DA', waitingOn: 'Council', owner: P.dominic, neededBy: '2026-07-31', lead: 0, status: 'done', created: '2026-07-01', doneAt: '2026-07-28' }),
  item({ id: 'it-ws-colours', job: 'west-st', type: 'decision', title: 'External colour scheme', waitingOn: 'Dom', owner: P.dom, neededBy: '2026-07-20', lead: 0, status: 'done', created: '2026-07-06', doneAt: '2026-07-17' }),
  // Tollbar Ave: with council, 1 outstanding, 8 days
  item({ id: 'it-tb-rfi', job: 'tollbar', type: 'council_request', title: 'RFI response on stormwater', waitingOn: 'Dominic', owner: P.dominic, neededBy: '2026-09-30', lead: 0, status: 'to_do', created: '2026-09-09' }),
  item({ id: 'it-tb-lodge', job: 'tollbar', type: 'council_request', title: 'Lodge DA', waitingOn: 'Council', owner: P.dominic, neededBy: '2026-08-21', lead: 0, status: 'done', created: '2026-08-03', doneAt: '2026-08-19' }),
  // Lower Beach St: design, nothing outstanding
  item({ id: 'it-lb-survey', job: 'lower-beach', type: 'consultant_report', title: 'Site survey', waitingOn: 'Surveyor', owner: P.dominic, neededBy: '2026-09-04', lead: 0, status: 'done', created: '2026-08-10', doneAt: '2026-09-02' }),
  // John St: design, 1 outstanding, 4 days
  item({ id: 'it-js-heritage', job: 'john-st', type: 'consultant_report', title: 'Heritage report', waitingOn: 'Heritage consultant', owner: P.dominic, neededBy: '2026-10-09', lead: 0, status: 'to_do', created: '2026-09-13' }),
];
