/**
 * Norm's three Eastwood builds, self-built through Sena Investments, so the
 * trades sit with Norm rather than Raff. Entered at stage level with real
 * windows for the done stages; the chain from today on is an estimate.
 * Today is Thu 17 Sep 2026.
 *
 * 12 and 14 Hunts Ave: twin dual occupancies over three levels with a lift,
 * CDC 28 Mar 2025 plus a modified CDC. Slabs 2025, sewer and water Nov 2025,
 * HiHaus windows signed May 2026 and on the water, CJ Linea doing the gyprock
 * on both, Ultra Air and Premium Lift Systems signed.
 *
 * 232 North Rd: dual occupancy, CDC 28 Mar 2025, first floor redesigned
 * (IHS revision 9) and a modified CDC lodged 5 Aug 2026. IR Formwork on the
 * slabs, Express Steel the reinforcement, HiHaus windows in production.
 */
import type { ActivityEntry, DailyNote, Item, Job, Shipment } from '../domain/types';
import { P, ProgramBuilder, SIDE_ND, item } from './helpers';

export const HUNTS_12 = 'hunts-12';
export const HUNTS_14 = 'hunts-14';
export const NORTH_RD = 'north-rd';

const jobBase = { sideId: SIDE_ND, kind: 'build' as const, path: 'CDC' as const, isTemplate: false };

export const hunts12Job: Job = {
  ...jobBase,
  id: HUNTS_12,
  name: '12 Hunts Ave',
  address: '12 Hunts Ave, Eastwood NSW 2122',
  weeklyHoldingCost: 3200,
  lastConfirmed: '2026-09-14',
  startDate: '2025-06-02',
  createdAt: '2025-05-19',
};

export const hunts14Job: Job = {
  ...jobBase,
  id: HUNTS_14,
  name: '14 Hunts Ave',
  address: '14 Hunts Ave, Eastwood NSW 2122',
  weeklyHoldingCost: 3200,
  lastConfirmed: '2026-09-14',
  startDate: '2025-06-02',
  createdAt: '2025-05-19',
};

export const northRdJob: Job = {
  ...jobBase,
  id: NORTH_RD,
  name: '232 North Rd',
  address: '232 North Rd, Eastwood NSW 2122',
  weeklyHoldingCost: 2600,
  lastConfirmed: '2026-09-15',
  startDate: '2026-01-19',
  createdAt: '2025-12-01',
};

/** The Hunts Ave twins share a program shape; 14 runs a fortnight behind 12. */
function huntsProgram(jobId: string, p: string, lockupStart: string, brickDays: number) {
  const b = new ProgramBuilder(jobId, SIDE_ND, true);
  b.stage(`${p}-st-site`, 'Site establishment', 'done')
    .stage(`${p}-st-slab`, 'Basement and slabs', 'done')
    .stage(`${p}-st-services`, 'Sewer and water', 'done')
    .stage(`${p}-st-frame`, 'Frame', 'done')
    .stage(`${p}-st-roof`, 'Roof', 'done')
    .stage(`${p}-st-lockup`, 'Lock-up', 'in_progress')
    .stage(`${p}-st-fitout`, 'Fit-out')
    .stage(`${p}-st-external`, 'External works')
    .stage(`${p}-st-handover`, 'Handover');

  b.step({ id: `${p}-site`, stage: `${p}-st-site`, name: 'Site establishment, whole stage', duration: 10, start: '2025-06-02', status: 'done', placeholder: true })
    .step({ id: `${p}-slab`, stage: `${p}-st-slab`, name: 'Basement, ground and first floor slabs', duration: 60, start: '2025-06-16', after: `${p}-site`, status: 'done', placeholder: true, trade: 'Formwork and concrete' })
    .step({ id: `${p}-services`, stage: `${p}-st-services`, name: 'Sydney Water sewer and water tap-in', duration: 15, start: '2025-11-03', after: `${p}-slab`, status: 'done', placeholder: true, trade: 'Sydney Water tap-in' })
    .step({ id: `${p}-frame`, stage: `${p}-st-frame`, name: 'Frame, whole stage', duration: 50, start: '2025-11-24', after: `${p}-services`, status: 'done', placeholder: true, trade: 'Carpenter' })
    .step({ id: `${p}-roof`, stage: `${p}-st-roof`, name: 'Roof carpentry and roofing', duration: 25, start: '2026-02-09', after: `${p}-frame`, status: 'done', placeholder: true, trade: 'Roof carpenter' })
    .step({ id: `${p}-brick`, stage: `${p}-st-lockup`, name: 'Brickwork and cladding', duration: brickDays, start: lockupStart, after: `${p}-roof`, status: 'in_progress', trade: 'Bricklayer' })
    .step({ id: `${p}-windows`, stage: `${p}-st-lockup`, name: 'Install windows and doors', duration: 10, after: `${p}-brick`, trade: 'Carpenter' })
    .step({ id: `${p}-fitout`, stage: `${p}-st-fitout`, name: 'Gyprock, lift, air conditioning, joinery and tiling', duration: 90, after: `${p}-windows`, placeholder: true })
    .step({ id: `${p}-external`, stage: `${p}-st-external`, name: 'External works, whole stage', duration: 30, after: `${p}-fitout`, placeholder: true })
    .step({ id: `${p}-handover`, stage: `${p}-st-handover`, name: 'Handover, whole stage', duration: 5, after: `${p}-external`, placeholder: true });

  b.req({ id: `${p}-rq-windows`, step: `${p}-windows`, kind: 'material', name: 'Windows and doors', lead: 12 })
    .req({ id: `${p}-rq-plasterer`, step: `${p}-fitout`, kind: 'trade', name: 'Plasterer', lead: 4, trade: 'Plasterer' })
    .req({ id: `${p}-rq-lift`, step: `${p}-fitout`, kind: 'material', name: 'Home lift', lead: 12 })
    .req({ id: `${p}-rq-aircon`, step: `${p}-fitout`, kind: 'trade', name: 'Air conditioning', lead: 6, trade: 'Air conditioning' })
    .req({ id: `${p}-rq-joinery`, step: `${p}-fitout`, kind: 'material', name: 'Joinery', lead: 8 });

  b.category(`${p}-pc-general`, null, 'General')
    .category(`${p}-pc-lockup`, `${p}-st-lockup`, 'Windows in and flashed')
    .category(`${p}-pc-roughin`, `${p}-st-fitout`, 'Rough-in before gyprock');
  return b;
}

export const hunts12Program = huntsProgram(HUNTS_12, 'h12', '2026-06-15', 70);
export const hunts14Program = huntsProgram(HUNTS_14, 'h14', '2026-06-29', 65);

export const northRdProgram = (() => {
  const b = new ProgramBuilder(NORTH_RD, SIDE_ND, true);
  b.stage('nr-st-site', 'Site establishment', 'done')
    .stage('nr-st-gf', 'Ground floor slab', 'done')
    .stage('nr-st-ff', 'First floor', 'in_progress')
    .stage('nr-st-roof', 'Roof')
    .stage('nr-st-lockup', 'Lock-up')
    .stage('nr-st-fitout', 'Fit-out')
    .stage('nr-st-external', 'External works')
    .stage('nr-st-handover', 'Handover');

  b.step({ id: 'nr-site', stage: 'nr-st-site', name: 'Site establishment, whole stage', duration: 10, start: '2026-01-19', status: 'done', placeholder: true })
    .step({ id: 'nr-gf', stage: 'nr-st-gf', name: 'Ground floor slab, whole stage', duration: 40, start: '2026-02-09', after: 'nr-site', status: 'done', placeholder: true, trade: 'Formwork and concrete' })
    .step({ id: 'nr-ff', stage: 'nr-st-ff', name: 'First floor slab and walls', duration: 80, start: '2026-06-01', after: 'nr-gf', status: 'in_progress', placeholder: true, trade: 'Formwork and concrete' })
    .step({ id: 'nr-roof', stage: 'nr-st-roof', name: 'Roof, whole stage', duration: 25, after: 'nr-ff', placeholder: true, trade: 'Roof carpenter' })
    .step({ id: 'nr-lockup', stage: 'nr-st-lockup', name: 'Lock-up, whole stage', duration: 40, after: 'nr-roof', placeholder: true })
    .step({ id: 'nr-fitout', stage: 'nr-st-fitout', name: 'Fit-out, whole stage', duration: 90, after: 'nr-lockup', placeholder: true })
    .step({ id: 'nr-external', stage: 'nr-st-external', name: 'External works, whole stage', duration: 30, after: 'nr-fitout', placeholder: true })
    .step({ id: 'nr-handover', stage: 'nr-st-handover', name: 'Handover, whole stage', duration: 5, after: 'nr-external', placeholder: true });

  b.req({ id: 'nr-rq-roof-carpenter', step: 'nr-roof', kind: 'trade', name: 'Roof carpenter', lead: 4, trade: 'Roof carpenter' })
    .req({ id: 'nr-rq-windows', step: 'nr-lockup', kind: 'material', name: 'Windows and doors', lead: 12 });

  b.category('nr-pc-general', null, 'General')
    .category('nr-pc-ff-steel', 'nr-st-ff', 'First floor steel before pour')
    .category('nr-pc-roof', 'nr-st-roof', 'Roof complete');
  return b;
})();

export const eastwoodShipments: Shipment[] = [
  { id: 'sh-hunts12-windows', sideId: SIDE_ND, jobId: HUNTS_12, name: '12 Hunts windows', supplier: 'HiHaus (China)', status: 'shipped', eta: '2026-09-28', notes: 'Order DX-12. Drawings signed May. On the water with the 14 Hunts order.' },
  { id: 'sh-hunts14-windows', sideId: SIDE_ND, jobId: HUNTS_14, name: '14 Hunts windows', supplier: 'HiHaus (China)', status: 'shipped', eta: '2026-09-28', notes: 'Order DX-14. Signed 14 May. Same container as 12 Hunts.' },
  { id: 'sh-north-windows', sideId: SIDE_ND, jobId: NORTH_RD, name: '232 North Rd windows', supplier: 'HiHaus (China)', status: 'in_production', eta: '2026-10-26', notes: 'Shop drawings signed 27 Jul.' },
];

export const eastwoodItems: Item[] = [
  // 12 Hunts Ave
  item({ id: 'it-h12-windows', job: HUNTS_12, type: 'material', title: 'Windows and sliding doors', waitingOn: 'HiHaus (China)', owner: P.norm, step: 'h12-windows', requirement: 'h12-rq-windows', shipment: 'sh-hunts12-windows', lead: 12, status: 'booked', created: '2026-05-04', notes: 'Drawings signed May. Balance due on arrival.' }),
  item({ id: 'it-h12-plasterer', job: HUNTS_12, type: 'trade', title: 'Book plasterer', waitingOn: 'CJ Linea', trade: 'tr-cjlinea', owner: P.norm, step: 'h12-fitout', requirement: 'h12-rq-plasterer', lead: 4, status: 'confirmed', expected: '2026-10-12', confirmed: '2026-06-10', created: '2026-05-18', notes: 'Doing 12 and 14 together. Deposit paid June.' }),
  item({ id: 'it-h12-lift', job: HUNTS_12, type: 'material', title: 'Home lift', waitingOn: 'Premium Lift Systems', trade: 'tr-premiumlift', owner: P.norm, step: 'h12-fitout', requirement: 'h12-rq-lift', lead: 12, status: 'booked', created: '2026-05-11', notes: 'Ordered May, deposit paid. Shaft to be checked before it ships.' }),
  item({ id: 'it-h12-aircon', job: HUNTS_12, type: 'trade', title: 'Book air conditioning rough-in', waitingOn: 'Ultra Air', trade: 'tr-ultraair', owner: P.norm, step: 'h12-fitout', requirement: 'h12-rq-aircon', lead: 6, status: 'booked', created: '2026-06-10', notes: 'Signed 10 Jun.' }),
  item({ id: 'it-h12-joinery', job: HUNTS_12, type: 'decision', title: 'Joinery: Allure from Foshan or Wooden Age', waitingOn: 'Norm', owner: P.norm, neededBy: '2026-10-02', lead: 0, status: 'to_do', created: '2026-07-29', notes: 'Wooden Age quoted 29 Jul. Allure is cheaper with the stone but ships from China.' }),
  item({ id: 'it-h12-electrician', job: HUNTS_12, type: 'trade', title: 'Book electrician for rough-in', waitingOn: 'One Connection', trade: 'tr-oneconn', owner: P.norm, step: 'h12-fitout', lead: 3, status: 'to_do', created: '2026-01-20', notes: 'Electrical plan done in January.' }),
  item({ id: 'it-h12-sanitary', job: HUNTS_12, type: 'material', title: 'Sanitaryware and tapware', waitingOn: 'Harvey Norman Commercial', owner: P.norm, step: 'h12-fitout', lead: 6, status: 'to_do', created: '2026-08-03', notes: 'One quote covers 12 and 14.' }),
  item({ id: 'it-h12-s94', job: HUNTS_12, type: 'council_request', title: 'Credit the 2016 contributions against the CDC', waitingOn: 'City of Ryde', owner: P.dominic, neededBy: '2026-10-30', lead: 0, status: 'booked', created: '2026-02-16', notes: 'P&D Legal wrote to council in February.' }),
  item({ id: 'it-h12-sewer', job: HUNTS_12, type: 'condition_of_consent', title: 'Sydney Water section 73 certificate', waitingOn: 'Sydney Water', owner: P.dominic, neededBy: '2025-12-19', lead: 0, status: 'done', created: '2025-09-01', doneAt: '2025-11-28', notes: 'Sewer and water connected Nov 2025.' }),
  item({ id: 'it-h12-roof', job: HUNTS_12, type: 'trade', title: 'Roof carpentry', waitingOn: 'Advance Carpentry Services', trade: 'tr-advance', owner: P.norm, step: 'h12-roof', lead: 4, status: 'done', expected: '2026-02-09', confirmed: '2026-01-12', created: '2025-12-01', doneAt: '2026-03-13' }),
  // 14 Hunts Ave
  item({ id: 'it-h14-windows', job: HUNTS_14, type: 'material', title: 'Windows and sliding doors', waitingOn: 'HiHaus (China)', owner: P.norm, step: 'h14-windows', requirement: 'h14-rq-windows', shipment: 'sh-hunts14-windows', lead: 12, status: 'booked', created: '2026-05-14' }),
  item({ id: 'it-h14-plasterer', job: HUNTS_14, type: 'trade', title: 'Book plasterer', waitingOn: 'CJ Linea', trade: 'tr-cjlinea', owner: P.norm, step: 'h14-fitout', requirement: 'h14-rq-plasterer', lead: 4, status: 'confirmed', expected: '2026-10-12', confirmed: '2026-06-10', created: '2026-05-18', notes: 'Starts on 12 and follows on to 14.' }),
  item({ id: 'it-h14-aircon', job: HUNTS_14, type: 'trade', title: 'Book air conditioning rough-in', waitingOn: 'Ultra Air', trade: 'tr-ultraair', owner: P.norm, step: 'h14-fitout', requirement: 'h14-rq-aircon', lead: 6, status: 'booked', created: '2026-06-10' }),
  item({ id: 'it-h14-scaffold', job: HUNTS_14, type: 'trade', title: 'Scaffold hire, extend to end of lock-up', waitingOn: 'JAD Scaffolding', trade: 'tr-jad', owner: P.norm, neededBy: '2026-10-02', lead: 1, status: 'to_do', created: '2026-09-07', notes: 'Up since February.' }),
  item({ id: 'it-h14-roof', job: HUNTS_14, type: 'trade', title: 'Roof carpentry', waitingOn: 'Advance Carpentry Services', trade: 'tr-advance', owner: P.norm, step: 'h14-roof', lead: 4, status: 'done', expected: '2026-02-23', confirmed: '2026-01-12', created: '2025-12-01', doneAt: '2026-03-27' }),
  item({ id: 'it-h14-roof-timber', job: HUNTS_14, type: 'material', title: 'Roof timber', waitingOn: 'Macro Timber Supplies', owner: P.norm, step: 'h14-roof', lead: 2, status: 'done', expected: '2026-02-20', confirmed: '2026-02-02', created: '2026-01-19', doneAt: '2026-02-20' }),
  item({ id: 'it-h14-sewer', job: HUNTS_14, type: 'condition_of_consent', title: 'Sydney Water section 73 certificate', waitingOn: 'Sydney Water', owner: P.dominic, neededBy: '2025-12-19', lead: 0, status: 'done', created: '2025-09-01', doneAt: '2025-11-19', notes: 'Sewer and water complete 19 Nov 2025.' }),
  // 232 North Rd
  item({ id: 'it-nr-modcdc', job: NORTH_RD, type: 'council_request', title: 'Modified CDC for the first-floor redesign', waitingOn: 'Certex Approvals', trade: 'tr-certex', owner: P.dominic, step: 'nr-roof', lead: 2, status: 'booked', created: '2026-08-05', notes: 'Lodged 5 Aug with the revision J construction set.' }),
  item({ id: 'it-nr-engineer', job: NORTH_RD, type: 'consultant_report', title: 'Structural set, revision J', waitingOn: 'IHS Consulting Engineers', trade: 'tr-ihs', owner: P.dominic, neededBy: '2026-08-21', lead: 0, status: 'done', created: '2026-07-20', doneAt: '2026-08-19' }),
  item({ id: 'it-nr-formwork', job: NORTH_RD, type: 'trade', title: 'Formwork, first floor', waitingOn: 'IR Formwork Constructions', trade: 'tr-ir', owner: P.norm, step: 'nr-ff', lead: 3, status: 'confirmed', expected: '2026-06-01', confirmed: '2026-02-20', created: '2026-02-09' }),
  item({ id: 'it-nr-reo', job: NORTH_RD, type: 'material', title: 'First floor reinforcement', waitingOn: 'Express Steel Supplies', owner: P.norm, step: 'nr-ff', lead: 2, status: 'done', expected: '2026-06-05', confirmed: '2026-05-11', created: '2026-05-04', doneAt: '2026-06-05' }),
  item({ id: 'it-nr-windows', job: NORTH_RD, type: 'material', title: 'Windows and doors', waitingOn: 'HiHaus (China)', owner: P.norm, step: 'nr-lockup', requirement: 'nr-rq-windows', shipment: 'sh-north-windows', lead: 12, status: 'booked', created: '2026-07-27', notes: 'Shop drawings signed 27 Jul.' }),
  item({ id: 'it-nr-roof-carp', job: NORTH_RD, type: 'trade', title: 'Book roof carpenter', waitingOn: 'Advance Carpentry Services', trade: 'tr-advance', owner: P.norm, step: 'nr-roof', requirement: 'nr-rq-roof-carpenter', lead: 4, status: 'to_do', created: '2026-08-24' }),
  item({ id: 'it-nr-s73', job: NORTH_RD, type: 'condition_of_consent', title: 'Sydney Water section 73 certificate before OC', waitingOn: 'Sydney Water', owner: P.dominic, step: 'nr-handover', lead: 8, status: 'booked', created: '2025-11-03', notes: 'Case 229150, lodged Nov 2025.' }),
];

export const eastwoodNotes: DailyNote[] = [
  { id: 'dn-h12-0915', sideId: SIDE_ND, jobId: HUNTS_12, date: '2026-09-15', authorId: P.norm, text: 'Brickies on the front of 12. Windows on the water, due end of the month.', createdAt: '2026-09-15T17:05' },
  { id: 'dn-nr-0916', sideId: SIDE_ND, jobId: NORTH_RD, date: '2026-09-16', authorId: P.norm, text: 'First floor walls up on the north side. Waiting on Certex for the modified CDC before the roof goes on.', createdAt: '2026-09-16T17:40' },
];

export const eastwoodActivity: ActivityEntry[] = [
  { id: 'act-h12-1', sideId: SIDE_ND, kind: 'job_added', at: '2025-05-19T09:00', personId: P.dominic, jobId: HUNTS_12, text: 'Created 12 Hunts Ave at stage level' },
  { id: 'act-h12-2', sideId: SIDE_ND, kind: 'shipment_status', at: '2026-08-31T10:15', personId: P.dominic, jobId: HUNTS_12, shipmentId: 'sh-hunts12-windows', from: 'in_production', to: 'shipped', text: '12 Hunts windows moved to Shipped' },
  { id: 'act-h12-3', sideId: SIDE_ND, kind: 'job_confirmed', at: '2026-09-14T16:30', personId: P.dominic, jobId: HUNTS_12, text: 'Confirmed 12 Hunts Ave with Norm' },
  { id: 'act-h14-1', sideId: SIDE_ND, kind: 'job_added', at: '2025-05-19T09:05', personId: P.dominic, jobId: HUNTS_14, text: 'Created 14 Hunts Ave at stage level' },
  { id: 'act-h14-2', sideId: SIDE_ND, kind: 'shipment_status', at: '2026-08-31T10:16', personId: P.dominic, jobId: HUNTS_14, shipmentId: 'sh-hunts14-windows', from: 'in_production', to: 'shipped', text: '14 Hunts windows moved to Shipped' },
  { id: 'act-h14-3', sideId: SIDE_ND, kind: 'job_confirmed', at: '2026-09-14T16:35', personId: P.dominic, jobId: HUNTS_14, text: 'Confirmed 14 Hunts Ave with Norm' },
  { id: 'act-nr-1', sideId: SIDE_ND, kind: 'job_added', at: '2025-12-01T09:00', personId: P.dominic, jobId: NORTH_RD, text: 'Created 232 North Rd at stage level' },
  { id: 'act-nr-2', sideId: SIDE_ND, kind: 'item_added', at: '2026-08-05T11:20', personId: P.dominic, jobId: NORTH_RD, itemId: 'it-nr-modcdc', text: 'Added council request: Modified CDC for the first-floor redesign' },
  { id: 'act-nr-3', sideId: SIDE_ND, kind: 'job_confirmed', at: '2026-09-15T17:00', personId: P.dominic, jobId: NORTH_RD, text: 'Confirmed 232 North Rd with Norm' },
];
