/**
 * 31 Seaview St: entered at stage level, $3,800/wk. One placeholder step per
 * stage, except Slab, which carries the hold point flow e needs.
 *
 * Tuned: 180 working days after Lock-up ends (Fri 19 Feb 2027) lands
 * Handover on Fri 29 Oct 2027. SPEC says 30 Oct 2027, a Saturday; see PROGRESS.md.
 */
import type { ActivityEntry, DailyNote, ForecastSnapshot, Item, Job, Photo } from '../domain/types';
import { P, PHOTO_TONES, ProgramBuilder, SIDE_ND, item, svgPhoto } from './helpers';

export const SEAVIEW = 'seaview';

export const seaviewJob: Job = {
  id: SEAVIEW,
  sideId: SIDE_ND,
  name: '31 Seaview St',
  address: '31 Seaview St, Example NSW',
  kind: 'build',
  path: 'CDC',
  weeklyHoldingCost: 3800,
  lastConfirmed: '2026-09-16',
  isTemplate: false,
  startDate: '2026-08-24',
  createdAt: '2026-08-10',
};

export const seaviewProgram = (() => {
  const b = new ProgramBuilder(SEAVIEW, SIDE_ND, true);
  b.stage('sv-st-site', 'Site establishment', 'done')
    .stage('sv-st-slab', 'Slab', 'in_progress')
    .stage('sv-st-frame', 'Frame')
    .stage('sv-st-roof', 'Roof')
    .stage('sv-st-lockup', 'Lock-up')
    .stage('sv-st-fitout', 'Fit-out')
    .stage('sv-st-external', 'External works')
    .stage('sv-st-handover', 'Handover');

  b.step({ id: 'sv-site', stage: 'sv-st-site', name: 'Site establishment, whole stage', duration: 15, start: '2026-08-24', status: 'done', placeholder: true })
    .step({ id: 'sv-slab-prep', stage: 'sv-st-slab', name: 'Under-slab plumbing, formwork and steel', duration: 10, after: 'sv-site', status: 'in_progress', trade: 'Concreter' })
    .step({ id: 'sv-slab-insp', stage: 'sv-st-slab', name: 'Slab inspection before pour', duration: 1, after: 'sv-slab-prep', hold: true, trade: 'Certifier' })
    .step({ id: 'sv-pour', stage: 'sv-st-slab', name: 'Pour ground floor slab', duration: 1, start: '2026-10-02', waits: ['sv-slab-insp'], trade: 'Concreter' })
    .step({ id: 'sv-frame', stage: 'sv-st-frame', name: 'Frame, whole stage', duration: 40, after: 'sv-pour', placeholder: true, trade: 'Frame carpenter' })
    .step({ id: 'sv-roof', stage: 'sv-st-roof', name: 'Roof, whole stage', duration: 15, after: 'sv-frame', placeholder: true, trade: 'Roof plumber' })
    .step({ id: 'sv-lockup', stage: 'sv-st-lockup', name: 'Lock-up, whole stage', duration: 30, after: 'sv-roof', placeholder: true })
    .step({ id: 'sv-fitout', stage: 'sv-st-fitout', name: 'Fit-out, whole stage', duration: 135, after: 'sv-lockup', placeholder: true })
    .step({ id: 'sv-external', stage: 'sv-st-external', name: 'External works, whole stage', duration: 40, after: 'sv-fitout', placeholder: true })
    .step({ id: 'sv-handover', stage: 'sv-st-handover', name: 'Handover, whole stage', duration: 5, after: 'sv-external', placeholder: true });

  b.req({ id: 'sv-rq-pump', step: 'sv-pour', kind: 'trade', name: 'Concrete pump', lead: 2, trade: 'Concrete pump' })
    .req({ id: 'sv-rq-concreter', step: 'sv-pour', kind: 'trade', name: 'Concreter', lead: 2, trade: 'Concreter' })
    .req({ id: 'sv-rq-frame-timber', step: 'sv-frame', kind: 'material', name: 'Frame timber', lead: 4 })
    .req({ id: 'sv-rq-carpenter', step: 'sv-frame', kind: 'trade', name: 'Frame carpenter', lead: 3, trade: 'Frame carpenter' });

  b.category('sv-pc-general', null, 'General')
    .category('sv-pc-slab-steel', 'sv-st-slab', 'Steel reinforcement in place', true)
    .category('sv-pc-slab-plumbing', 'sv-st-slab', 'Plumbing under slab', true)
    .category('sv-pc-slab-membrane', 'sv-st-slab', 'Membrane and termite barrier', true)
    .category('sv-pc-frame-bracing', 'sv-st-frame', 'Frame bracing and tie-downs', true)
    .category('sv-pc-roof', 'sv-st-roof', 'Roof complete');
  return b;
})();

const J = SEAVIEW;

export const seaviewItems: Item[] = [
  item({ id: 'it-sv-excavator', job: J, type: 'trade', title: 'Book excavator', waitingOn: 'Digby Excavations', trade: 'tr-excavator', owner: P.raff, step: 'sv-site', lead: 2, status: 'done', expected: '2026-08-24', confirmed: '2026-08-12', created: '2026-08-10', doneAt: '2026-08-24' }),
  item({ id: 'it-sv-slab-steel', job: J, type: 'material', title: 'Order slab steel', waitingOn: 'Steel supplier', owner: P.raff, step: 'sv-slab-prep', lead: 2, status: 'confirmed', expected: '2026-09-18', confirmed: '2026-09-04', created: '2026-08-24' }),
  item({ id: 'it-sv-pump', job: J, type: 'trade', title: 'Book concrete pump', waitingOn: 'Coastal Concrete Pumping', trade: 'tr-pump', owner: P.raff, step: 'sv-pour', requirement: 'sv-rq-pump', lead: 2, status: 'to_do', created: '2026-08-24' }),
  item({ id: 'it-sv-concreter', job: J, type: 'trade', title: 'Book concreter for pour', waitingOn: 'Hardline Concreting', trade: 'tr-concreter', owner: P.raff, step: 'sv-pour', requirement: 'sv-rq-concreter', lead: 2, status: 'booked', created: '2026-08-24' }),
  item({ id: 'it-sv-slab-insp', job: J, type: 'inspection', title: 'Book slab inspection', waitingOn: 'Certify Co', trade: 'tr-certifier', owner: P.raff, step: 'sv-slab-insp', lead: 1, status: 'to_do', created: '2026-08-24' }),
  item({ id: 'it-sv-frame-timber', job: J, type: 'material', title: 'Order frame timber', waitingOn: 'Timber yard', owner: P.raff, step: 'sv-frame', requirement: 'sv-rq-frame-timber', lead: 4, status: 'booked', created: '2026-08-24' }),
  item({ id: 'it-sv-carpenter', job: J, type: 'trade', title: 'Book frame carpenter', waitingOn: 'Framewright Carpentry', trade: 'tr-carpenter', owner: P.raff, step: 'sv-frame', requirement: 'sv-rq-carpenter', lead: 3, status: 'confirmed', expected: '2026-10-05', confirmed: '2026-09-11', created: '2026-08-24' }),
  item({ id: 'it-sv-termite', job: J, type: 'condition_of_consent', title: 'Termite barrier certificate before pour', waitingOn: 'Pest company', owner: P.dominic, step: 'sv-pour', lead: 1, status: 'to_do', created: '2026-09-02' }),
];

export const seaviewPhotos: Photo[] = [0, 1, 2, 3].map((i) => ({
  id: `ph-sv-steel-${i + 1}`,
  sideId: SIDE_ND,
  jobId: J,
  stageId: 'sv-st-slab',
  categoryId: 'sv-pc-slab-steel',
  uploadedById: P.alec,
  uploadedAt: `2026-09-16T${13 + i}:0${i}`,
  takenOn: '2026-09-16',
  dataUrl: svgPhoto(`Steel ${i + 1}`, PHOTO_TONES[(i + 3) % PHOTO_TONES.length]),
  caption: `Steel reinforcement ${i + 1}`,
}));

export const seaviewNotes: DailyNote[] = [
  { id: 'dn-sv-0915', sideId: SIDE_ND, jobId: J, date: '2026-09-15', authorId: P.raff, text: 'Formwork half done. Steel due Friday.', createdAt: '2026-09-15T16:10' },
  { id: 'dn-sv-0916', sideId: SIDE_ND, jobId: J, date: '2026-09-16', authorId: P.alec, text: 'Steel mesh arrived early. Photos taken of reo before the plumber comes back.', createdAt: '2026-09-16T15:20' },
];

export const seaviewSnapshots: ForecastSnapshot[] = [
  { id: 'snap-sv-0907', sideId: SIDE_ND, jobId: J, date: '2026-09-07', forecastFinish: '2027-10-29' },
  { id: 'snap-sv-0914', sideId: SIDE_ND, jobId: J, date: '2026-09-14', forecastFinish: '2027-10-29' },
];

export const seaviewActivity: ActivityEntry[] = [
  { id: 'act-sv-1', sideId: SIDE_ND, kind: 'job_added', at: '2026-08-10T09:00', personId: P.dominic, jobId: J, text: 'Created 31 Seaview St at stage level' },
  { id: 'act-sv-2', sideId: SIDE_ND, kind: 'photo_added', at: '2026-09-16T13:10', personId: P.alec, jobId: J, text: 'Added 4 photos to Slab, Steel reinforcement in place' },
  { id: 'act-sv-3', sideId: SIDE_ND, kind: 'job_confirmed', at: '2026-09-16T17:05', personId: P.dominic, jobId: J, text: 'Confirmed 31 Seaview St with Raff' },
];
