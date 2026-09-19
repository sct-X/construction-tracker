/**
 * The four design jobs (rule 9: stages as a checklist, no steps), with what
 * each is actually waiting on from the job folders. Ages are days since the
 * item was created, with today = Thu 17 Sep 2026: West St oldest 23 days,
 * Tollbar 8, Lower Beach none, John St 4 (SPEC "Mock data").
 */
import type { Item, Job, Stage } from '../domain/types';
import { P, SIDE_ND, item } from './helpers';

function job(id: string, name: string, address: string, path: 'DA' | 'CDC', createdAt: string, lastConfirmed?: string): Job {
  return { id, sideId: SIDE_ND, name, address, kind: 'design', path, isTemplate: false, lastConfirmed, createdAt };
}

/** "Pending approval" whichever desk it sits on: council for a DA, the certifier for a CDC. */
const DA_STAGES = ['Design', 'Pending approval', 'Approved', 'Construction certificate'];
const CDC_STAGES = ['Design', 'Pending approval', 'Approved'];

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
  // DA for a low and mid-rise apartment building (10 units, two of them affordable) over a basement. DA2026/1058 lodged 7 Aug 2026.
  job('west-st', '59-61 West St', '59-61 West St, Balgowlah NSW 2093', 'DA', '2025-10-06', '2026-09-14'),
  // DA for a 105-place childcare centre with two industrial units at the rear. DA 8/2026/403/1 lodged 16 Jun 2026.
  job('tollbar', '18 Tollbar Ave', '18 Tollbar Ave, Branxton NSW 2335', 'DA', '2026-01-19', '2026-09-14'),
  // Dual occupancy with basement and pools. CDC application to Certex signed 10 Sep 2026.
  job('lower-beach', '33 Lower Beach St', '33 Lower Beach St, Balgowlah NSW 2093', 'CDC', '2026-06-01', '2026-09-14'),
  // Heritage DA: attached dual occupancy in the Hunters Hill conservation area. Pre-DA meeting 30 Jul 2026.
  job('john-st', '13 John St', '13 John St, Hunters Hill NSW 2110', 'DA', '2026-04-06', '2026-09-14'),
];

export const designStages: Stage[] = [
  ...stages('west-st', 'DA', 1),
  ...stages('tollbar', 'DA', 1),
  ...stages('lower-beach', 'CDC', 0),
  ...stages('john-st', 'DA', 0),
];

export const designItems: Item[] = [
  // West St: with council, 2 outstanding, oldest 23 days
  item({ id: 'it-ws-fire', job: 'west-st', type: 'consultant_report', title: 'Fire engineering report, revision B', waitingOn: 'Lote Consulting', owner: P.dominic, neededBy: '2026-09-25', lead: 0, status: 'booked', created: '2026-08-25', notes: 'Council wants the FECDR with the BCA report. Draft rev B came 9 Sep.' }),
  item({ id: 'it-ws-portal', job: 'west-st', type: 'council_request', title: 'Check the planning portal for a request for information', waitingOn: 'Northern Beaches Council', owner: P.dominic, neededBy: '2026-09-25', lead: 0, status: 'to_do', created: '2026-09-03', notes: 'DA2026/1058, PAN-664169. Fees paid 17 Aug.' }),
  item({ id: 'it-ws-lodge', job: 'west-st', type: 'council_request', title: 'Lodge DA', waitingOn: 'Northern Beaches Council', owner: P.dominic, neededBy: '2026-08-14', lead: 0, status: 'done', created: '2026-07-01', doneAt: '2026-08-07' }),
  item({ id: 'it-ws-affordable', job: 'west-st', type: 'decision', title: 'Affordable housing mix', waitingOn: 'Dom', owner: P.dom, neededBy: '2026-07-20', lead: 0, status: 'done', created: '2026-07-06', doneAt: '2026-07-17' }),
  item({ id: 'it-ws-traffic', job: 'west-st', type: 'consultant_report', title: 'Traffic and parking report', waitingOn: 'McLaren Traffic Engineering', owner: P.dominic, neededBy: '2026-07-31', lead: 0, status: 'done', created: '2026-05-04', doneAt: '2026-07-24' }),
  item({ id: 'it-ws-acoustic', job: 'west-st', type: 'consultant_report', title: 'Acoustic report', waitingOn: 'Rodney Stevens Acoustics', owner: P.dominic, neededBy: '2026-07-31', lead: 0, status: 'done', created: '2026-05-04', doneAt: '2026-07-22' }),
  // Tollbar Ave: with council, 1 outstanding, 8 days
  item({ id: 'it-tb-determination', job: 'tollbar', type: 'council_request', title: 'Chase council for the determination', waitingOn: 'Cessnock City Council', owner: P.dominic, neededBy: '2026-09-30', lead: 0, status: 'to_do', created: '2026-09-09', notes: 'RFI answered 25 Aug, RFS approval in. Ask the planner where it sits.' }),
  item({ id: 'it-tb-rfs', job: 'tollbar', type: 'consultant_report', title: 'Rural Fire Service bushfire approval', waitingOn: 'NSW Rural Fire Service', owner: P.dominic, neededBy: '2026-08-28', lead: 0, status: 'done', created: '2026-07-06', doneAt: '2026-08-21', notes: 'Conditional approval DCA-362.' }),
  item({ id: 'it-tb-rfi', job: 'tollbar', type: 'council_request', title: 'Respond to the request for information', waitingOn: 'Complete Planning Solutions', owner: P.dominic, neededBy: '2026-08-28', lead: 0, status: 'done', created: '2026-07-20', doneAt: '2026-08-25' }),
  item({ id: 'it-tb-lodge', job: 'tollbar', type: 'council_request', title: 'Lodge DA', waitingOn: 'Cessnock City Council', owner: P.dominic, neededBy: '2026-06-19', lead: 0, status: 'done', created: '2026-06-01', doneAt: '2026-06-16', notes: 'Accepted 3 Jul.' }),
  // Lower Beach St: design, nothing outstanding. The CDC set is together and the application went to Certex on 10 Sep.
  item({ id: 'it-lb-survey', job: 'lower-beach', type: 'consultant_report', title: 'Site survey', waitingOn: 'Vertex Surveyors', trade: 'tr-vertex', owner: P.dominic, neededBy: '2026-09-04', lead: 0, status: 'done', created: '2026-08-10', doneAt: '2026-09-02' }),
  item({ id: 'it-lb-geotech', job: 'lower-beach', type: 'consultant_report', title: 'Geotechnical report', waitingOn: 'ESWNMAN', owner: P.dominic, neededBy: '2026-08-07', lead: 0, status: 'done', created: '2026-07-06', doneAt: '2026-07-27' }),
  item({ id: 'it-lb-stormwater', job: 'lower-beach', type: 'consultant_report', title: 'Stormwater design', waitingOn: 'EZE Drainage', trade: 'tr-eze', owner: P.dominic, neededBy: '2026-08-14', lead: 0, status: 'done', created: '2026-07-06', doneAt: '2026-08-05' }),
  item({ id: 'it-lb-sydneywater', job: 'lower-beach', type: 'council_request', title: 'Sydney Water building plan approval', waitingOn: 'Sydney Water', owner: P.dominic, neededBy: '2026-08-28', lead: 0, status: 'done', created: '2026-08-03', doneAt: '2026-08-17' }),
  item({ id: 'it-lb-structural', job: 'lower-beach', type: 'consultant_report', title: 'Structural set for the CDC', waitingOn: 'TAA Structural', owner: P.dominic, neededBy: '2026-08-28', lead: 0, status: 'done', created: '2026-07-27', doneAt: '2026-08-24' }),
  item({ id: 'it-lb-basix', job: 'lower-beach', type: 'consultant_report', title: 'BASIX certificate', waitingOn: 'Noura Al Hazzouri', owner: P.dominic, neededBy: '2026-09-04', lead: 0, status: 'done', created: '2026-08-10', doneAt: '2026-08-25' }),
  item({ id: 'it-lb-landscape', job: 'lower-beach', type: 'consultant_report', title: 'Landscape plan', waitingOn: 'iScape', trade: 'tr-iscape', owner: P.dominic, neededBy: '2026-09-11', lead: 0, status: 'done', created: '2026-08-17', doneAt: '2026-09-07' }),
  item({ id: 'it-lb-cdc', job: 'lower-beach', type: 'council_request', title: 'Sign and lodge the CDC application', waitingOn: 'Certex Approvals', trade: 'tr-certex', owner: P.dominic, neededBy: '2026-09-11', lead: 0, status: 'done', created: '2026-09-01', doneAt: '2026-09-10' }),
  // John St: design, 1 outstanding, 4 days
  item({ id: 'it-js-heritage', job: 'john-st', type: 'consultant_report', title: 'Heritage impact statement', waitingOn: 'Weir Phillips Heritage', owner: P.dominic, neededBy: '2026-10-09', lead: 0, status: 'to_do', created: '2026-09-13', notes: 'Council asked for it at the pre-DA: conservation area, keep the colours light, roof the balconies.' }),
  item({ id: 'it-js-preda', job: 'john-st', type: 'council_request', title: 'Pre-DA meeting', waitingOn: 'Hunters Hill Council', owner: P.dominic, neededBy: '2026-07-31', lead: 0, status: 'done', created: '2026-07-01', doneAt: '2026-07-30', notes: 'Minutes came 10 Aug: two storeys, 45% landscaped, LMR controls apply.' }),
  item({ id: 'it-js-geotech', job: 'john-st', type: 'consultant_report', title: 'Geotechnical report', waitingOn: 'ESWNMAN', owner: P.dominic, neededBy: '2026-07-10', lead: 0, status: 'done', created: '2026-06-15', doneAt: '2026-07-03' }),
];
