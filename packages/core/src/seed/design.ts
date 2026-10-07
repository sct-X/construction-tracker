/**
 * The four design jobs (rule 9: stages as a checklist, no steps). Ages are
 * days since the item was created, today Thu 17 Sep 2026: West St 2
 * outstanding, oldest 23 days; Tollbar Ave 1, 8 days; Lower Beach St 0;
 * John St 1, 4 days. Consultant names are invented.
 */
import type { ApprovalPath, Item, Job, Stage } from '../types.js';
import { SIDE_ND, item } from './helpers.js';
import { TR } from './trades.js';

const DA_STAGES = ['Design', 'With council', 'Approved', 'Construction certificate'];
const CDC_STAGES = ['Design', 'With certifier', 'Approved'];

function job(id: string, name: string, path: ApprovalPath, createdAt: string, lastConfirmed: string): Job {
  return {
    id,
    sideId: SIDE_ND,
    name,
    kind: 'design',
    path,
    weeklyHoldingCost: null,
    lastConfirmed,
    isTemplate: false,
    plannedFinish: null,
    startDate: null,
    startsFromStageId: null,
    templateId: null,
    createdAt,
  };
}

function stages(jobId: string, path: ApprovalPath, doneCount: number): Stage[] {
  return (path === 'DA' ? DA_STAGES : CDC_STAGES).map((name, i) => ({
    id: `${jobId}-st-${i + 1}`,
    jobId,
    name,
    order: i + 1,
    status: i < doneCount ? 'done' : i === doneCount ? 'in_progress' : 'not_started',
  }));
}

export const designJobs: Job[] = [
  job('west-st', 'West St', 'DA', '2025-10-06', '2026-09-14'),
  job('tollbar', 'Tollbar Ave', 'DA', '2026-01-19', '2026-09-14'),
  job('lower-beach', 'Lower Beach St', 'CDC', '2026-06-01', '2026-09-14'),
  job('john-st', 'John St', 'DA', '2026-04-06', '2026-09-14'),
];

export const designStages: Stage[] = [
  ...stages('west-st', 'DA', 1),
  ...stages('tollbar', 'DA', 1),
  ...stages('lower-beach', 'CDC', 0),
  ...stages('john-st', 'DA', 0),
];

export const designItems: Item[] = [
  // West St: with council, 2 outstanding, oldest 23 days
  item({ id: 'it-ws-fire', job: 'west-st', type: 'consultant_report', title: 'Fire engineering report, revision B', waitingOn: 'Firewise Engineering', owner: 'Dominic', neededBy: '2026-09-25', lead: 0, status: 'ordered_or_booked', expected: '2026-09-23', created: '2026-08-25' }),
  item({ id: 'it-ws-portal', job: 'west-st', type: 'council_request', title: 'Check the planning portal for a request for information', waitingOn: 'Council', owner: 'Dominic', neededBy: '2026-09-25', lead: 0, status: 'to_do', created: '2026-09-03' }),
  item({ id: 'it-ws-lodge', job: 'west-st', type: 'council_request', title: 'Lodge DA', waitingOn: 'Council', owner: 'Dominic', neededBy: '2026-08-14', lead: 0, status: 'done', created: '2026-07-01', doneAt: '2026-08-07' }),
  item({ id: 'it-ws-mix', job: 'west-st', type: 'decision', title: 'Affordable housing mix', waitingOn: 'Dom', owner: 'Dom', neededBy: '2026-07-20', lead: 0, status: 'done', created: '2026-07-06', doneAt: '2026-07-17' }),
  item({ id: 'it-ws-traffic', job: 'west-st', type: 'consultant_report', title: 'Traffic and parking report', waitingOn: 'Roadwise Traffic', owner: 'Dominic', neededBy: '2026-07-31', lead: 0, status: 'done', created: '2026-05-04', doneAt: '2026-07-24' }),
  // Tollbar Ave: with council, 1 outstanding, 8 days
  item({ id: 'it-tb-determination', job: 'tollbar', type: 'council_request', title: 'Chase council for the determination', waitingOn: 'Council', owner: 'Dominic', neededBy: '2026-09-30', lead: 0, status: 'to_do', created: '2026-09-09' }),
  item({ id: 'it-tb-rfi', job: 'tollbar', type: 'council_request', title: 'Respond to the request for information', waitingOn: 'Town planner', owner: 'Dominic', neededBy: '2026-08-28', lead: 0, status: 'done', created: '2026-07-20', doneAt: '2026-08-25' }),
  item({ id: 'it-tb-bushfire', job: 'tollbar', type: 'consultant_report', title: 'Bushfire assessment', waitingOn: 'Ember Bushfire Consulting', owner: 'Dominic', neededBy: '2026-08-28', lead: 0, status: 'done', created: '2026-07-06', doneAt: '2026-08-21' }),
  // Lower Beach St: design, nothing outstanding
  item({ id: 'it-lb-survey', job: 'lower-beach', type: 'consultant_report', title: 'Site survey', waitingOn: 'Level Line Surveys', trade: TR.surveyor, owner: 'Dominic', neededBy: '2026-09-04', lead: 0, status: 'done', created: '2026-08-10', doneAt: '2026-09-02' }),
  item({ id: 'it-lb-geotech', job: 'lower-beach', type: 'consultant_report', title: 'Geotechnical report', waitingOn: 'Bedrock Geotechnical', owner: 'Dominic', neededBy: '2026-08-07', lead: 0, status: 'done', created: '2026-07-06', doneAt: '2026-07-27' }),
  item({ id: 'it-lb-basix', job: 'lower-beach', type: 'consultant_report', title: 'BASIX certificate', waitingOn: 'Energy assessor', owner: 'Dominic', neededBy: '2026-09-04', lead: 0, status: 'done', created: '2026-08-10', doneAt: '2026-08-25' }),
  // John St: design, 1 outstanding, 4 days
  item({ id: 'it-js-heritage', job: 'john-st', type: 'consultant_report', title: 'Heritage impact statement', waitingOn: 'Old Town Heritage', owner: 'Dominic', neededBy: '2026-10-09', lead: 0, status: 'to_do', created: '2026-09-13' }),
  item({ id: 'it-js-preda', job: 'john-st', type: 'council_request', title: 'Pre-DA meeting', waitingOn: 'Council', owner: 'Dominic', neededBy: '2026-07-31', lead: 0, status: 'done', created: '2026-07-01', doneAt: '2026-07-30' }),
];
