/**
 * 64-66 Park Rd: the full-program duplex, $4,500/wk. Today is Thu 17 Sep 2026.
 */
import type { ActivityEntry, DailyNote, ForecastSnapshot, Item, Job, Notification, Photo, Shipment } from '../domain/types';
import { P, PHOTO_TONES, ProgramBuilder, SIDE_ND, item, svgPhoto } from './helpers';
import { duplexProgram, prefixIds } from './duplexProgram';

export const PARK_RD = 'park-rd';

export const parkRdJob: Job = {
  id: PARK_RD,
  sideId: SIDE_ND,
  name: '64-66 Park Rd',
  address: '64-66 Park Rd, Example NSW',
  kind: 'build',
  path: 'DA',
  weeklyHoldingCost: 4500,
  lastConfirmed: '2026-09-15',
  isTemplate: false,
  startDate: '2026-06-01',
  plannedFinish: '2027-02-26',
  templateId: 'tpl-duplex',
  createdAt: '2026-05-20',
};

export const parkRdProgram = (() => {
  const b = duplexProgram(new ProgramBuilder(PARK_RD, SIDE_ND, true));
  prefixIds(b, 'pr');
  return b;
})();

export const parkRdShipments: Shipment[] = [
  {
    id: 'sh-park-windows',
    sideId: SIDE_ND,
    jobId: PARK_RD,
    name: 'Park Rd windows',
    supplier: 'Hangzhou Glazing Co (China)',
    status: 'in_production',
    eta: '2026-10-26',
    notes: 'Aluminium frames, double glazed. 40ft container, ex Ningbo.',
  },
];

const J = PARK_RD;

export const parkRdItems: Item[] = [
  // ---- Done, earlier stages ----
  item({ id: 'it-pr-excavator', job: J, type: 'trade', title: 'Book excavator', waitingOn: 'Digby Excavations', trade: 'tr-excavator', owner: P.raff, step: 'pr-site-setup', requirement: 'pr-rq-excavator', lead: 2, status: 'done', expected: '2026-06-01', confirmed: '2026-05-22', created: '2026-05-20', doneAt: '2026-06-01' }),
  item({ id: 'it-pr-slab-steel', job: J, type: 'material', title: 'Order slab steel', waitingOn: 'Steel supplier', owner: P.raff, step: 'pr-formwork', requirement: 'pr-rq-slab-steel', lead: 2, status: 'done', expected: '2026-06-26', confirmed: '2026-06-15', created: '2026-05-20', doneAt: '2026-06-26' }),
  item({ id: 'it-pr-slab-insp', job: J, type: 'inspection', title: 'Slab inspection', waitingOn: 'Certify Co', trade: 'tr-certifier', owner: P.raff, step: 'pr-slab-insp', lead: 1, status: 'done', expected: '2026-07-06', confirmed: '2026-06-30', created: '2026-05-20', doneAt: '2026-07-06' }),
  item({ id: 'it-pr-concreter', job: J, type: 'trade', title: 'Book concreter', waitingOn: 'Hardline Concreting', trade: 'tr-concreter', owner: P.raff, step: 'pr-pour-slab', requirement: 'pr-rq-concreter', lead: 2, status: 'done', expected: '2026-07-07', confirmed: '2026-06-24', created: '2026-05-20', doneAt: '2026-07-07' }),
  item({ id: 'it-pr-carpenter', job: J, type: 'trade', title: 'Book frame carpenter', waitingOn: 'Framewright Carpentry', trade: 'tr-carpenter', owner: P.raff, step: 'pr-frame', requirement: 'pr-rq-carpenter', lead: 3, status: 'done', expected: '2026-07-08', confirmed: '2026-06-18', created: '2026-05-20', doneAt: '2026-07-08' }),
  item({ id: 'it-pr-frame-timber', job: J, type: 'material', title: 'Order frame timber', waitingOn: 'Timber yard', owner: P.raff, step: 'pr-frame', requirement: 'pr-rq-frame-timber', lead: 4, status: 'done', expected: '2026-07-07', confirmed: '2026-06-10', created: '2026-05-20', doneAt: '2026-07-07' }),
  item({ id: 'it-pr-frame-insp', job: J, type: 'inspection', title: 'Frame inspection', waitingOn: 'Certify Co', trade: 'tr-certifier', owner: P.raff, step: 'pr-frame-insp', lead: 1, status: 'done', expected: '2026-07-29', confirmed: '2026-07-22', created: '2026-05-20', doneAt: '2026-07-29' }),
  item({ id: 'it-pr-trusses', job: J, type: 'material', title: 'Order roof trusses', waitingOn: 'Truss plant', owner: P.raff, step: 'pr-trusses', requirement: 'pr-rq-trusses', lead: 6, status: 'done', expected: '2026-07-29', confirmed: '2026-06-16', created: '2026-05-20', doneAt: '2026-07-29' }),
  item({ id: 'it-pr-da-conditions', job: J, type: 'condition_of_consent', title: 'Sediment and erosion controls in place before works', waitingOn: 'Raff', owner: P.raff, step: 'pr-site-setup', lead: 0, status: 'done', created: '2026-05-20', doneAt: '2026-06-01' }),

  // ---- Lock-up, current stage ----
  item({ id: 'it-pr-roof-plumber', job: J, type: 'trade', title: 'Book roof plumber', waitingOn: 'Southside Roofing', trade: 'tr-roofplumber', owner: P.raff, step: 'pr-roof-plumbing', requirement: 'pr-rq-roof-plumber', lead: 3, status: 'confirmed', expected: '2026-09-14', confirmed: '2026-08-28', created: '2026-08-10' }),
  item({ id: 'it-pr-cladder', job: J, type: 'trade', title: 'Book cladder', waitingOn: 'Coastal Cladding', trade: 'tr-cladder', owner: P.raff, step: 'pr-cladding', requirement: 'pr-rq-cladder', lead: 4, status: 'confirmed', expected: '2026-09-16', confirmed: '2026-08-21', created: '2026-08-10' }),
  item({ id: 'it-pr-cladding', job: J, type: 'material', title: 'Order cladding', waitingOn: 'Weathertex', owner: P.raff, step: 'pr-cladding', requirement: 'pr-rq-cladding', lead: 2, status: 'confirmed', expected: '2026-09-15', confirmed: '2026-09-01', created: '2026-08-10', notes: 'One pack short on delivery, supplier chasing.' }),
  // The three shipment-linked items. Their expected date comes from the shipment ETA.
  item({ id: 'it-pr-windows', job: J, type: 'material', title: 'Windows', waitingOn: 'Hangzhou Glazing Co (China)', owner: P.raff, step: 'pr-install-windows', requirement: 'pr-rq-windows', shipment: 'sh-park-windows', lead: 12, status: 'booked', created: '2026-07-20', notes: 'Ordered 6 Aug. Deposit paid.' }),
  item({ id: 'it-pr-sliding-doors', job: J, type: 'material', title: 'Sliding doors', waitingOn: 'Hangzhou Glazing Co (China)', owner: P.raff, step: 'pr-install-windows', shipment: 'sh-park-windows', lead: 12, status: 'booked', created: '2026-07-20' }),
  item({ id: 'it-pr-glazing-cert', job: J, type: 'consultant_report', title: 'Glazing energy compliance certificate', waitingOn: 'Hangzhou Glazing Co (China)', owner: P.dominic, step: 'pr-install-windows', shipment: 'sh-park-windows', lead: 12, status: 'to_do', created: '2026-07-20', notes: 'Comes with the shipment paperwork. Certifier needs it before final.' }),
  item({ id: 'it-pr-window-installer', job: J, type: 'trade', title: 'Book window installers', waitingOn: 'Glassline Installations', trade: 'tr-windows', owner: P.raff, step: 'pr-install-windows', requirement: 'pr-rq-window-installer', lead: 3, status: 'to_do', created: '2026-08-10' }),
  item({ id: 'it-pr-external-doors', job: J, type: 'material', title: 'Order external doors', waitingOn: 'Door supplier', owner: P.raff, step: 'pr-external-doors', requirement: 'pr-rq-external-doors', lead: 6, status: 'to_do', created: '2026-08-10' }),

  // ---- External works ----
  item({ id: 'it-pr-sw-plumber', job: J, type: 'trade', title: 'Book plumber for stormwater', waitingOn: 'Baxter Plumbing', trade: 'tr-plumber', owner: P.raff, step: 'pr-stormwater', requirement: 'pr-rq-sw-plumber', lead: 2, status: 'booked', created: '2026-08-24', notes: 'Pencilled in, not confirmed.' }),
  item({ id: 'it-pr-sw-council', job: J, type: 'council_request', title: 'Stormwater connection approval', waitingOn: 'Council', owner: P.dominic, step: 'pr-stormwater', lead: 3, status: 'booked', created: '2026-08-14', notes: 'Lodged 21 Aug. Council says two weeks.' }),
  item({ id: 'it-pr-sw-insp', job: J, type: 'inspection', title: 'Stormwater inspection', waitingOn: 'Certify Co', trade: 'tr-certifier', owner: P.raff, step: 'pr-stormwater-insp', lead: 1, status: 'to_do', created: '2026-08-24' }),
  item({ id: 'it-pr-landscaper', job: J, type: 'trade', title: 'Book landscaper', waitingOn: 'Greenway Landscapes', trade: 'tr-landscaper', owner: P.raff, step: 'pr-landscaping', requirement: 'pr-rq-landscaper', lead: 4, status: 'to_do', created: '2026-08-24' }),

  // ---- Fit-out ----
  item({ id: 'it-pr-ri-plumber', job: J, type: 'trade', title: 'Book plumber for rough-in', waitingOn: 'Baxter Plumbing', trade: 'tr-plumber', owner: P.raff, step: 'pr-rough-in', requirement: 'pr-rq-ri-plumber', lead: 4, status: 'to_do', created: '2026-08-24' }),
  item({ id: 'it-pr-ri-electrician', job: J, type: 'trade', title: 'Book electrician for rough-in', waitingOn: 'Volt Electrical', trade: 'tr-electrician', owner: P.raff, step: 'pr-rough-in', requirement: 'pr-rq-ri-electrician', lead: 4, status: 'to_do', created: '2026-08-24' }),
  item({ id: 'it-pr-insulation', job: J, type: 'material', title: 'Order insulation', waitingOn: 'Insulation supplier', owner: P.raff, step: 'pr-insulation', requirement: 'pr-rq-insulation', lead: 2, status: 'to_do', created: '2026-08-24' }),
  item({ id: 'it-pr-plasterer', job: J, type: 'trade', title: 'Book plasterer', waitingOn: 'Gyprock Bros', trade: 'tr-plasterer', owner: P.raff, step: 'pr-plasterboard', requirement: 'pr-rq-plasterer', lead: 12, status: 'to_do', created: '2026-08-24' }),
  item({ id: 'it-pr-tile-choice', job: J, type: 'decision', title: 'Tile choice', waitingOn: 'Dom', owner: P.dom, neededBy: '2026-09-14', lead: 0, status: 'to_do', created: '2026-08-31', notes: 'Bathroom floor and wall tiles. Samples at the office.' }),
  item({ id: 'it-pr-tiles', job: J, type: 'material', title: 'Order tiles', waitingOn: 'Tile warehouse', owner: P.raff, step: 'pr-tiling', requirement: 'pr-rq-tiles', lead: 8, status: 'to_do', created: '2026-08-24' }),
  item({ id: 'it-pr-tiler', job: J, type: 'trade', title: 'Book tiler', waitingOn: 'Marino Tiling', trade: 'tr-tiler', owner: P.raff, step: 'pr-tiling', requirement: 'pr-rq-tiler', lead: 6, status: 'to_do', created: '2026-08-24' }),
  item({ id: 'it-pr-waterproofer', job: J, type: 'trade', title: 'Book waterproofer', waitingOn: 'Sealtight Waterproofing', trade: 'tr-waterproofer', owner: P.raff, step: 'pr-waterproofing', requirement: 'pr-rq-waterproofer', lead: 4, status: 'to_do', created: '2026-08-24' }),
  item({ id: 'it-pr-kitchen-signoff', job: J, type: 'decision', title: 'Kitchen design sign-off', waitingOn: 'Norm', owner: P.norm, step: 'pr-kitchen', lead: 10, status: 'to_do', created: '2026-09-01', notes: 'Joiner needs the signed drawings before ordering stone.' }),
  item({ id: 'it-pr-kitchen', job: J, type: 'material', title: 'Order kitchen', waitingOn: 'Bench and Board Joinery', trade: 'tr-joiner', owner: P.raff, step: 'pr-kitchen', requirement: 'pr-rq-kitchen', lead: 8, status: 'to_do', created: '2026-08-24' }),
  item({ id: 'it-pr-painter', job: J, type: 'trade', title: 'Book painter', waitingOn: 'Fresh Coat Painting', trade: 'tr-painter', owner: P.raff, step: 'pr-painting', requirement: 'pr-rq-painter', lead: 4, status: 'to_do', created: '2026-08-24' }),

  // ---- Handover ----
  item({ id: 'it-pr-final-insp', job: J, type: 'inspection', title: 'Final inspection for OC', waitingOn: 'Certify Co', trade: 'tr-certifier', owner: P.raff, step: 'pr-final-insp', lead: 2, status: 'to_do', created: '2026-08-24' }),
  item({ id: 'it-pr-coc-landscaping', job: J, type: 'condition_of_consent', title: 'Landscaping plan certified before OC', waitingOn: 'Landscape architect', owner: P.dominic, step: 'pr-final-insp', lead: 4, status: 'to_do', created: '2026-08-24' }),

  // ---- No step ----
  item({ id: 'it-pr-defect-tile', job: J, type: 'defect', title: 'Cracked roof tiles above garage', waitingOn: 'Southside Roofing', trade: 'tr-roofplumber', owner: P.raff, neededBy: '2026-09-25', lead: 0, status: 'to_do', created: '2026-09-10', photo: 'ph-pr-defect-1', notes: 'Three tiles cracked by the cladders scaffold.' }),
  item({ id: 'it-pr-insurance', job: J, type: 'manual_reminder', title: 'Renew builders insurance', waitingOn: 'Dominic', owner: P.dominic, neededBy: '2026-10-01', lead: 0, status: 'to_do', created: '2026-09-01' }),
];

// ---- Photos: tiny flat SVGs, no stock imagery ----
function photos(prefix: string, stageId: string | null, categoryId: string, n: number, label: string, by: string, from: string): Photo[] {
  const out: Photo[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: `${prefix}-${i + 1}`,
      sideId: SIDE_ND,
      jobId: J,
      stageId,
      categoryId,
      uploadedById: by,
      uploadedAt: `${from}T${String(8 + i).padStart(2, '0')}:${String(10 + i * 7).padStart(2, '0')}`,
      takenOn: from,
      dataUrl: svgPhoto(`${label} ${i + 1}`, PHOTO_TONES[i % PHOTO_TONES.length]),
      caption: `${label} ${i + 1}`,
    });
  }
  return out;
}

export const parkRdPhotos: Photo[] = [
  ...photos('ph-pr-slab-steel', 'pr-st-slab', 'pr-pc-slab-steel', 3, 'Slab steel', P.alec, '2026-07-03'),
  ...photos('ph-pr-slab-plumb', 'pr-st-slab', 'pr-pc-slab-plumbing', 2, 'Under-slab plumbing', P.alec, '2026-06-26'),
  ...photos('ph-pr-slab-mem', 'pr-st-slab', 'pr-pc-slab-membrane', 1, 'Membrane', P.alec, '2026-07-03'),
  ...photos('ph-pr-frame', 'pr-st-frame', 'pr-pc-frame-bracing', 2, 'Frame bracing', P.raff, '2026-07-28'),
  ...photos('ph-pr-roof', 'pr-st-roof', 'pr-pc-roof-complete', 6, 'Roof', P.alec, '2026-08-19'),
  ...photos('ph-pr-clad', 'pr-st-lockup', 'pr-pc-lockup-cladding', 2, 'Cladding', P.alec, '2026-09-16'),
  ...photos('ph-pr-brick', 'pr-st-lockup', 'pr-pc-lockup-brick', 3, 'Brickwork', P.alec, '2026-09-11'),
  {
    id: 'ph-pr-defect-1',
    sideId: SIDE_ND,
    jobId: J,
    stageId: null,
    categoryId: 'pr-pc-general',
    uploadedById: P.raff,
    uploadedAt: '2026-09-10T14:22',
    takenOn: '2026-09-10',
    dataUrl: svgPhoto('Cracked tiles', '#8a7a68'),
    caption: 'Cracked roof tiles above garage',
  },
];

export const parkRdNotes: DailyNote[] = [
  { id: 'dn-pr-0910', sideId: SIDE_ND, jobId: J, date: '2026-09-10', authorId: P.alec, text: 'Brickies finishing rear elevation. Sand delivery 7am. Noticed cracked roof tiles above garage, told Raff.', createdAt: '2026-09-10T15:40' },
  { id: 'dn-pr-0911', sideId: SIDE_ND, jobId: J, date: '2026-09-11', authorId: P.alec, text: 'Brickwork done and cleaned down. Scaffold stays up for the cladders.', createdAt: '2026-09-11T15:05' },
  { id: 'dn-pr-0914', sideId: SIDE_ND, jobId: J, date: '2026-09-14', authorId: P.alec, text: 'Roof plumber on site, two blokes. Downpipes started on the north side.', createdAt: '2026-09-14T16:02' },
  { id: 'dn-pr-0915', sideId: SIDE_ND, jobId: J, date: '2026-09-15', authorId: P.raff, text: 'Cladding delivered, stacked under cover. One pack short, Weathertex chasing it.', createdAt: '2026-09-15T12:48' },
  { id: 'dn-pr-0916', sideId: SIDE_ND, jobId: J, date: '2026-09-16', authorId: P.alec, text: 'Cladders started on the rear wall. Roof plumber still here.', createdAt: '2026-09-16T15:31' },
  { id: 'dn-pr-0917', sideId: SIDE_ND, jobId: J, date: '2026-09-17', authorId: P.alec, text: 'Rain till 10. Cladding continued after. Roof plumbing finished bar the garage.', createdAt: '2026-09-17T15:55' },
];

/** Snapshots equal the forecast at the time: nothing had moved. */
export function parkRdSnapshots(stepStarts: Record<string, string>, stepEnds: Record<string, string>): ForecastSnapshot[] {
  return [
    { id: 'snap-pr-0907', sideId: SIDE_ND, jobId: J, date: '2026-09-07', forecastFinish: '2027-02-26', stepStarts, stepEnds },
    { id: 'snap-pr-0914', sideId: SIDE_ND, jobId: J, date: '2026-09-14', forecastFinish: '2027-02-26', stepStarts, stepEnds },
  ];
}

export const parkRdActivity: ActivityEntry[] = [
  { id: 'act-pr-1', sideId: SIDE_ND, kind: 'job_added', at: '2026-05-20T09:12', personId: P.dominic, jobId: J, text: 'Created 64-66 Park Rd from the Duplex template' },
  { id: 'act-pr-2', sideId: SIDE_ND, kind: 'eta_changed', at: '2026-08-12T10:05', personId: P.dominic, jobId: J, shipmentId: 'sh-park-windows', from: '2026-10-19', to: '2026-10-26', text: 'Park Rd windows ETA changed 19 Oct to 26 Oct' },
  { id: 'act-pr-3', sideId: SIDE_ND, kind: 'shipment_status', at: '2026-08-12T10:06', personId: P.dominic, jobId: J, shipmentId: 'sh-park-windows', from: 'design', to: 'in_production', text: 'Park Rd windows moved to In production' },
  { id: 'act-pr-4', sideId: SIDE_ND, kind: 'item_status', at: '2026-09-01T11:30', personId: P.raff, jobId: J, itemId: 'it-pr-cladding', from: 'booked', to: 'confirmed', text: 'Order cladding confirmed for 15 Sep' },
  { id: 'act-pr-5', sideId: SIDE_ND, kind: 'item_added', at: '2026-09-10T14:25', personId: P.raff, jobId: J, itemId: 'it-pr-defect-tile', text: 'Added defect: Cracked roof tiles above garage' },
  { id: 'act-pr-6', sideId: SIDE_ND, kind: 'snapshot_saved', at: '2026-09-14T06:00', personId: P.dominic, jobId: J, text: 'Monday snapshot saved: finish 26 Feb' },
  { id: 'act-pr-7', sideId: SIDE_ND, kind: 'job_confirmed', at: '2026-09-15T16:40', personId: P.dominic, jobId: J, text: 'Confirmed 64-66 Park Rd with Raff' },
  { id: 'act-pr-8', sideId: SIDE_ND, kind: 'step_status', at: '2026-09-14T08:15', personId: P.raff, jobId: J, stepId: 'pr-roof-plumbing', from: 'not_started', to: 'in_progress', text: 'Roof plumbing started' },
];

export const parkRdNotifications: Notification[] = [
  { id: 'nt-pr-1', sideId: SIDE_ND, personId: P.dom, kind: 'overdue', at: '2026-09-15T07:00', text: 'Tile choice for Park Rd was needed 14 Sep', read: false, jobId: J, itemId: 'it-pr-tile-choice' },
  { id: 'nt-pr-2', sideId: SIDE_ND, personId: P.raff, kind: 'act_by_today', at: '2026-09-07T07:00', text: 'Book plumber for stormwater at Park Rd: act by today', read: true, jobId: J, itemId: 'it-pr-sw-plumber' },
];
