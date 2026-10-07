/**
 * Seaview St: entered at stage level, $3,800/wk. One placeholder step per
 * stage, except Slab, which carries the hold point: "Slab inspection before
 * pour" Mon 28 Sep with 1 of 3 required photo categories filled, and "Pour
 * ground floor slab" Fri 2 Oct, so "Book concrete pump" (2 weeks) acts by Fri
 * 18 Sep. Placeholder durations land Handover on Fri 29 Oct 2027 (the brief's
 * 30 Oct is a Saturday). Also carries the second windows shipment.
 */
import { sydneyStamp } from '../dates.js';
import type { DailyNote, Item, Job, Photo, Shipment } from '../types.js';
import { ProgramBuilder, SIDE_ND, item } from './helpers.js';
import { placeholderPhotos } from './parkRd.js';
import { TR } from './trades.js';

export const SEAVIEW = 'seaview';
const J = SEAVIEW;

export const seaviewJob: Job = {
  id: J,
  sideId: SIDE_ND,
  name: 'Seaview St',
  kind: 'build',
  path: 'CDC',
  weeklyHoldingCost: 3800,
  lastConfirmed: '2026-09-16',
  isTemplate: false,
  plannedFinish: '2027-10-29',
  startDate: '2026-08-24',
  startsFromStageId: null,
  templateId: null,
  createdAt: '2026-08-10',
};

export const seaviewProgram = (() => {
  const b = new ProgramBuilder(J, true);
  b.stage('sv-st-site', 'Site establishment', 'done')
    .stage('sv-st-slab', 'Slab', 'in_progress')
    .stage('sv-st-frame', 'Frame')
    .stage('sv-st-roof', 'Roof')
    .stage('sv-st-lockup', 'Lock-up')
    .stage('sv-st-fitout', 'Fit-out')
    .stage('sv-st-external', 'External works')
    .stage('sv-st-handover', 'Handover');

  b.step({ id: 'sv-site', stage: 'sv-st-site', name: 'Site establishment, whole stage', duration: 15, start: '2026-08-24', status: 'done', placeholder: true })
    .step({ id: 'sv-slab-prep', stage: 'sv-st-slab', name: 'Under-slab plumbing, formwork and steel', duration: 10, after: 'sv-site', status: 'in_progress', actualStart: '2026-09-14', trade: 'Concreter' })
    .step({ id: 'sv-slab-insp', stage: 'sv-st-slab', name: 'Slab inspection before pour', duration: 1, after: 'sv-slab-prep', hold: true, trade: 'Certifier' })
    .step({ id: 'sv-pour', stage: 'sv-st-slab', name: 'Pour ground floor slab', duration: 1, start: '2026-10-02', waits: ['sv-slab-insp'], trade: 'Concreter' })
    .step({ id: 'sv-frame', stage: 'sv-st-frame', name: 'Frame, whole stage', duration: 40, after: 'sv-pour', placeholder: true, trade: 'Frame carpenter' })
    .step({ id: 'sv-roof', stage: 'sv-st-roof', name: 'Roof, whole stage', duration: 15, after: 'sv-frame', placeholder: true, trade: 'Roof plumber' })
    .step({ id: 'sv-lockup', stage: 'sv-st-lockup', name: 'Lock-up, whole stage', duration: 30, after: 'sv-roof', placeholder: true })
    .step({ id: 'sv-fitout', stage: 'sv-st-fitout', name: 'Fit-out, whole stage', duration: 135, after: 'sv-lockup', placeholder: true })
    .step({ id: 'sv-external', stage: 'sv-st-external', name: 'External works, whole stage', duration: 40, after: 'sv-fitout', placeholder: true })
    .step({ id: 'sv-handover', stage: 'sv-st-handover', name: 'Handover, whole stage', duration: 5, after: 'sv-external', placeholder: true });

  b.req('sv-rq-pump', 'sv-pour', 'trade', 'Concrete pump', 2, 'Concrete pump')
    .req('sv-rq-concreter', 'sv-pour', 'trade', 'Concreter', 2, 'Concreter')
    .req('sv-rq-frame-timber', 'sv-frame', 'material', 'Frame timber', 4)
    .req('sv-rq-carpenter', 'sv-frame', 'trade', 'Frame carpenter', 3, 'Frame carpenter')
    .req('sv-rq-windows', 'sv-lockup', 'material', 'Windows', 12);

  b.category('sv-pc-general', null, 'General')
    .category('sv-pc-slab-steel', 'sv-st-slab', 'Steel reinforcement in place', true)
    .category('sv-pc-slab-plumbing', 'sv-st-slab', 'Plumbing under slab', true)
    .category('sv-pc-slab-membrane', 'sv-st-slab', 'Membrane and termite barrier', true)
    .category('sv-pc-frame-bracing', 'sv-st-frame', 'Frame bracing and tie-downs', true)
    .category('sv-pc-roof', 'sv-st-roof', 'Roof complete');
  return b;
})();

export const SEAVIEW_WINDOWS = 'sh-sv-windows';

/** The second windows shipment, so "the windows" on its own is ambiguous. */
export const seaviewShipments: Shipment[] = [
  {
    id: SEAVIEW_WINDOWS,
    jobId: J,
    name: 'Seaview St windows',
    supplier: 'Jade Coast Windows (overseas)',
    status: 'design',
    eta: '2026-12-14',
    notes: 'Shop drawings with the architect. Needed for lock-up in January.',
  },
];

export const seaviewItems: Item[] = [
  item({ id: 'it-sv-excavator', job: J, type: 'trade', title: 'Book excavator', waitingOn: 'Ridgeline Demolition', trade: TR.demo, owner: 'Raff', step: 'sv-site', lead: 2, status: 'done', expected: '2026-08-24', confirmed: '2026-08-12', created: '2026-08-10', doneAt: '2026-08-24' }),
  item({ id: 'it-sv-slab-steel', job: J, type: 'material', title: 'Order slab steel', waitingOn: 'Steel supplier', owner: 'Raff', step: 'sv-slab-prep', lead: 2, status: 'confirmed', expected: '2026-09-16', confirmed: '2026-09-04', created: '2026-08-24' }),
  item({ id: 'it-sv-pump', job: J, type: 'trade', title: 'Book concrete pump', waitingOn: 'Northern Concrete Pumping', trade: TR.pump, owner: 'Raff', step: 'sv-pour', requirement: 'sv-rq-pump', status: 'to_do', created: '2026-08-24' }),
  item({ id: 'it-sv-concreter', job: J, type: 'trade', title: 'Book concreter for the pour', waitingOn: 'Harbourside Formwork', trade: TR.formwork, owner: 'Raff', step: 'sv-pour', requirement: 'sv-rq-concreter', status: 'ordered_or_booked', expected: '2026-10-02', created: '2026-08-24' }),
  item({ id: 'it-sv-slab-insp', job: J, type: 'inspection', title: 'Book slab inspection', waitingOn: 'Northside Certifiers', trade: TR.certifier, owner: 'Raff', step: 'sv-slab-insp', lead: 1, status: 'ordered_or_booked', expected: '2026-09-28', created: '2026-08-24' }),
  item({ id: 'it-sv-termite', job: J, type: 'condition_of_consent', title: 'Termite barrier certificate before pour', waitingOn: 'Pest control company', owner: 'Dominic', step: 'sv-pour', lead: 1, status: 'to_do', created: '2026-09-02' }),
  item({ id: 'it-sv-frame-timber', job: J, type: 'material', title: 'Order frame timber', waitingOn: 'Timber yard', owner: 'Raff', step: 'sv-frame', requirement: 'sv-rq-frame-timber', status: 'ordered_or_booked', expected: '2026-10-01', created: '2026-08-24' }),
  item({ id: 'it-sv-carpenter', job: J, type: 'trade', title: 'Book frame carpenter', waitingOn: 'Solid Frame Carpentry', trade: TR.carpenter, owner: 'Raff', step: 'sv-frame', requirement: 'sv-rq-carpenter', status: 'confirmed', expected: '2026-10-05', confirmed: '2026-09-11', created: '2026-08-24' }),
  item({ id: 'it-sv-windows', job: J, type: 'material', title: 'Windows', waitingOn: 'Jade Coast Windows', owner: 'Raff', step: 'sv-lockup', requirement: 'sv-rq-windows', shipment: SEAVIEW_WINDOWS, status: 'to_do', created: '2026-09-07', notes: 'Order once the shop drawings are signed.' }),
  item({ id: 'it-sv-s73', job: J, type: 'condition_of_consent', title: 'Sydney Water section 73 certificate before OC', waitingOn: 'Sydney Water', owner: 'Dominic', step: 'sv-handover', lead: 8, status: 'ordered_or_booked', expected: '2027-06-30', created: '2026-08-07' }),
  item({ id: 'it-sv-footpath', job: J, type: 'council_request', title: 'Footpath damage claim', waitingOn: 'Council', owner: 'Dominic', neededBy: '2026-07-31', lead: 0, status: 'done', created: '2026-07-01', doneAt: '2026-07-24' }),
];

export const seaviewPhotos: Photo[] = placeholderPhotos(J, 'ph-sv-steel', 'sv-st-slab', 'sv-pc-slab-steel', 4, 'Steel reinforcement', '2026-09-16');

export const seaviewNotes: DailyNote[] = [
  { id: 'dn-sv-0915', jobId: J, date: '2026-09-15', text: 'Formwork half done. Steel due tomorrow.', createdAt: sydneyStamp('2026-09-15', '16:10'), messageId: null },
  { id: 'dn-sv-0916', jobId: J, date: '2026-09-16', text: 'Steel mesh arrived. Photos of the reo taken before the plumber comes back.', createdAt: sydneyStamp('2026-09-16', '15:20'), messageId: null },
];
