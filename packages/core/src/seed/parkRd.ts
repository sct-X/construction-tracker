/**
 * Park Rd: the full-program job, $4,500/wk, run from the Duplex template.
 * Roof on, into lock-up, windows coming from overseas on one shipment.
 * Today Thu 17 Sep 2026: finish Fri 26 Feb 2027, equal to the Mon 14 Sep
 * snapshot. Install windows planned Mon 2 Nov; windows lead 12 weeks, so act
 * by Mon 10 Aug. Everything but the job name is invented.
 */
import type { DailyNote, Item, Job, Photo, Shipment } from '../types.js';
import { sydneyStamp } from '../dates.js';
import { duplexProgram } from './duplexProgram.js';
import { ProgramBuilder, SIDE_ND, item } from './helpers.js';
import { TR } from './trades.js';

export const PARK_RD = 'park-rd';
const J = PARK_RD;

export const parkRdJob: Job = {
  id: J,
  sideId: SIDE_ND,
  name: 'Park Rd',
  kind: 'build',
  path: 'CDC',
  weeklyHoldingCost: 4500,
  lastConfirmed: '2026-09-15',
  isTemplate: false,
  plannedFinish: '2027-02-26',
  startDate: '2026-06-01',
  startsFromStageId: null,
  templateId: 'tpl-duplex',
  createdAt: '2026-05-20',
};

export const parkRdProgram = duplexProgram(new ProgramBuilder(J, true)).prefixIds('pr');

export const PARK_RD_WINDOWS = 'sh-pr-windows';

export const parkRdShipments: Shipment[] = [
  {
    id: PARK_RD_WINDOWS,
    jobId: J,
    name: 'Park Rd windows',
    supplier: 'Jade Coast Windows (overseas)',
    status: 'in_production',
    eta: '2026-10-26',
    notes: 'Aluminium windows and sliding doors for both units, double glazed. One container.',
  },
];

export const parkRdItems: Item[] = [
  // Done, earlier stages
  item({ id: 'it-pr-excavator', job: J, type: 'trade', title: 'Book excavator', waitingOn: 'Ridgeline Demolition', trade: TR.demo, owner: 'Raff', step: 'pr-site-setup', requirement: 'pr-rq-excavator', status: 'done', expected: '2026-06-01', confirmed: '2026-05-22', created: '2026-05-20', doneAt: '2026-06-01' }),
  item({ id: 'it-pr-slab-steel', job: J, type: 'material', title: 'Order slab steel', waitingOn: 'Steel supplier', owner: 'Raff', step: 'pr-formwork', requirement: 'pr-rq-slab-steel', status: 'done', expected: '2026-06-26', confirmed: '2026-06-15', created: '2026-05-20', doneAt: '2026-06-26' }),
  item({ id: 'it-pr-slab-insp', job: J, type: 'inspection', title: 'Slab inspection', waitingOn: 'Northside Certifiers', trade: TR.certifier, owner: 'Raff', step: 'pr-slab-insp', lead: 1, status: 'done', expected: '2026-07-06', confirmed: '2026-06-30', created: '2026-05-20', doneAt: '2026-07-06' }),
  item({ id: 'it-pr-frame-timber', job: J, type: 'material', title: 'Order frame timber', waitingOn: 'Timber yard', owner: 'Raff', step: 'pr-frame', requirement: 'pr-rq-frame-timber', status: 'done', expected: '2026-07-07', confirmed: '2026-06-10', created: '2026-05-20', doneAt: '2026-07-07' }),
  item({ id: 'it-pr-trusses', job: J, type: 'material', title: 'Order roof trusses', waitingOn: 'Timber yard', owner: 'Raff', step: 'pr-trusses', requirement: 'pr-rq-trusses', status: 'done', expected: '2026-07-29', confirmed: '2026-06-16', created: '2026-05-20', doneAt: '2026-07-29' }),
  item({ id: 'it-pr-sediment', job: J, type: 'condition_of_consent', title: 'Sediment and erosion controls in place before works', waitingOn: 'Raff', owner: 'Raff', step: 'pr-site-setup', lead: 0, status: 'done', created: '2026-05-20', doneAt: '2026-06-01' }),

  // Lock-up, the current stage
  item({ id: 'it-pr-roofer', job: J, type: 'trade', title: 'Book roof plumber', waitingOn: 'Bayview Roofing', trade: TR.roofer, owner: 'Raff', step: 'pr-roof-plumbing', requirement: 'pr-rq-roof-plumber', status: 'done', expected: '2026-09-14', confirmed: '2026-08-28', created: '2026-08-10', doneAt: '2026-09-14' }),
  item({ id: 'it-pr-cladder', job: J, type: 'trade', title: 'Book cladders', waitingOn: 'Solid Frame Carpentry', trade: TR.carpenter, owner: 'Raff', step: 'pr-cladding', requirement: 'pr-rq-cladder', status: 'confirmed', expected: '2026-09-16', confirmed: '2026-08-21', created: '2026-08-10' }),
  item({ id: 'it-pr-cladding', job: J, type: 'material', title: 'Order cladding', waitingOn: 'Cladding supplier', owner: 'Raff', step: 'pr-cladding', requirement: 'pr-rq-cladding', status: 'confirmed', expected: '2026-09-15', confirmed: '2026-09-01', created: '2026-08-10', notes: 'One pack short on delivery, supplier chasing.' }),
  // The three shipment items: their expected date is the shipment ETA.
  item({ id: 'it-pr-windows', job: J, type: 'material', title: 'Windows', waitingOn: 'Jade Coast Windows', owner: 'Raff', step: 'pr-install-windows', requirement: 'pr-rq-windows', shipment: PARK_RD_WINDOWS, lead: 12, status: 'ordered_or_booked', created: '2026-07-20', notes: 'Ordered 6 Aug after the shop drawings were signed. Deposit paid.' }),
  item({ id: 'it-pr-sliding-doors', job: J, type: 'material', title: 'Sliding doors', waitingOn: 'Jade Coast Windows', owner: 'Raff', step: 'pr-install-windows', shipment: PARK_RD_WINDOWS, lead: 12, status: 'ordered_or_booked', created: '2026-07-20' }),
  item({ id: 'it-pr-glazing-cert', job: J, type: 'consultant_report', title: 'Glazing energy compliance certificate', waitingOn: 'Jade Coast Windows', owner: 'Dominic', step: 'pr-install-windows', shipment: PARK_RD_WINDOWS, lead: 12, status: 'to_do', created: '2026-07-20', notes: 'Comes with the shipment paperwork. The certifier needs it before final.' }),
  item({ id: 'it-pr-window-installer', job: J, type: 'trade', title: 'Book window installers', waitingOn: 'ClearView Window Installs', trade: TR.windows, owner: 'Raff', step: 'pr-install-windows', requirement: 'pr-rq-window-installer', status: 'to_do', created: '2026-08-10' }),
  item({ id: 'it-pr-external-doors', job: J, type: 'material', title: 'Order external doors', waitingOn: 'Door supplier', owner: 'Raff', step: 'pr-external-doors', requirement: 'pr-rq-external-doors', status: 'to_do', created: '2026-08-10' }),

  // External works
  item({ id: 'it-pr-sw-plumber', job: J, type: 'trade', title: 'Book plumber for stormwater', waitingOn: 'Clearflow Plumbing', trade: TR.plumber, owner: 'Raff', step: 'pr-stormwater', requirement: 'pr-rq-sw-plumber', status: 'ordered_or_booked', expected: '2026-09-21', created: '2026-08-24', notes: 'Pencilled in, not confirmed.' }),
  item({ id: 'it-pr-sw-council', job: J, type: 'council_request', title: 'Stormwater connection approval', waitingOn: 'Council', owner: 'Dominic', step: 'pr-stormwater', lead: 3, status: 'ordered_or_booked', expected: '2026-09-18', created: '2026-08-14', notes: 'Lodged 21 Aug. Council says two weeks.' }),
  item({ id: 'it-pr-sw-insp', job: J, type: 'inspection', title: 'Stormwater inspection', waitingOn: 'Northside Certifiers', trade: TR.certifier, owner: 'Raff', step: 'pr-stormwater-insp', lead: 1, status: 'to_do', created: '2026-08-24' }),
  item({ id: 'it-pr-landscaper', job: J, type: 'trade', title: 'Book landscaper', waitingOn: 'Greenline Landscapes', trade: TR.landscaper, owner: 'Raff', step: 'pr-landscaping', requirement: 'pr-rq-landscaper', status: 'to_do', created: '2026-08-24' }),

  // Fit-out
  item({ id: 'it-pr-ri-plumber', job: J, type: 'trade', title: 'Book plumber for rough-in', waitingOn: 'Clearflow Plumbing', trade: TR.plumber, owner: 'Raff', step: 'pr-rough-in', requirement: 'pr-rq-ri-plumber', status: 'to_do', created: '2026-08-24' }),
  item({ id: 'it-pr-ri-electrician', job: J, type: 'trade', title: 'Book electrician for rough-in', waitingOn: 'Brightline Electrical', trade: TR.sparky, owner: 'Raff', step: 'pr-rough-in', requirement: 'pr-rq-ri-electrician', status: 'to_do', created: '2026-08-24' }),
  item({ id: 'it-pr-insulation', job: J, type: 'material', title: 'Order insulation', waitingOn: 'Warmwall Insulation', trade: TR.insulation, owner: 'Raff', step: 'pr-insulation', requirement: 'pr-rq-insulation', status: 'to_do', created: '2026-08-24' }),
  item({ id: 'it-pr-plasterer', job: J, type: 'trade', title: 'Book plasterer', waitingOn: 'Smooth Wall Plastering', trade: TR.plasterer, owner: 'Raff', step: 'pr-plasterboard', requirement: 'pr-rq-plasterer', status: 'to_do', created: '2026-08-24' }),
  item({ id: 'it-pr-tile-choice', job: J, type: 'decision', title: 'Tile choice', waitingOn: 'Dominic', owner: 'Dominic', neededBy: '2026-09-14', lead: 0, status: 'to_do', created: '2026-08-31', notes: 'Bathroom floor and wall tiles. Samples at the office.' }),
  item({ id: 'it-pr-tiles', job: J, type: 'material', title: 'Order tiles', waitingOn: 'Tile warehouse', owner: 'Raff', step: 'pr-tiling', requirement: 'pr-rq-tiles', status: 'to_do', created: '2026-08-24' }),
  item({ id: 'it-pr-tiler', job: J, type: 'trade', title: 'Book tiler', waitingOn: 'Harbour Tiling', trade: TR.tiler, owner: 'Raff', step: 'pr-tiling', requirement: 'pr-rq-tiler', status: 'to_do', created: '2026-08-24' }),
  item({ id: 'it-pr-waterproofer', job: J, type: 'trade', title: 'Book waterproofing', waitingOn: 'Harbour Tiling', trade: TR.tiler, owner: 'Raff', step: 'pr-waterproofing', requirement: 'pr-rq-waterproofer', status: 'to_do', created: '2026-08-24' }),
  item({ id: 'it-pr-finishes', job: J, type: 'decision', title: 'Buyer picks finishes schedule A or B', waitingOn: 'Buyer of the front unit', owner: 'Dominic', step: 'pr-tiling', lead: 10, status: 'to_do', created: '2026-09-07', notes: 'The front unit is sold. Tiles, joinery and paint follow their pick.' }),
  item({ id: 'it-pr-kitchen-signoff', job: J, type: 'decision', title: 'Kitchen design sign-off', waitingOn: 'Norm', owner: 'Norm', step: 'pr-kitchen', lead: 10, status: 'to_do', created: '2026-09-01', notes: 'Joiner needs signed drawings before ordering stone.' }),
  item({ id: 'it-pr-kitchen', job: J, type: 'material', title: 'Order kitchen', waitingOn: 'Oakline Joinery', trade: TR.joiner, owner: 'Raff', step: 'pr-kitchen', requirement: 'pr-rq-kitchen', status: 'to_do', created: '2026-08-24' }),
  item({ id: 'it-pr-painter', job: J, type: 'trade', title: 'Book painter', waitingOn: 'Fresh Coat Painting', trade: TR.painter, owner: 'Raff', step: 'pr-painting', requirement: 'pr-rq-painter', status: 'to_do', created: '2026-08-24' }),

  // Handover
  item({ id: 'it-pr-final-insp', job: J, type: 'inspection', title: 'Final inspection for OC', waitingOn: 'Northside Certifiers', trade: TR.certifier, owner: 'Raff', step: 'pr-final-insp', lead: 2, status: 'to_do', created: '2026-08-24' }),
  item({ id: 'it-pr-coc-landscape', job: J, type: 'condition_of_consent', title: 'Landscaping certified against the landscape plan before OC', waitingOn: 'Landscape architect', owner: 'Dominic', step: 'pr-final-insp', lead: 4, status: 'to_do', created: '2026-08-24' }),

  // No step
  item({ id: 'it-pr-defect-tiles', job: J, type: 'defect', title: 'Cracked roof tiles above garage', waitingOn: 'Solid Frame Carpentry', trade: TR.carpenter, owner: 'Raff', neededBy: '2026-09-25', lead: 0, status: 'to_do', created: '2026-09-10', photo: 'ph-pr-defect-1', notes: 'Three tiles cracked by the cladders scaffold.' }),
  item({ id: 'it-pr-insurance', job: J, type: 'manual_reminder', title: 'Renew site insurance', waitingOn: 'Dominic', owner: 'Dominic', neededBy: '2026-10-01', lead: 0, status: 'to_do', created: '2026-09-01' }),
];

/** Stand-in photo records: no file on disk (isPlaceholder). */
export function placeholderPhotos(
  jobId: string,
  prefix: string,
  stageId: string | null,
  categoryId: string,
  n: number,
  label: string,
  takenOn: string,
): Photo[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}-${i + 1}`,
    jobId,
    stageId,
    categoryId,
    filePath: `placeholder/${prefix}-${i + 1}.jpg`,
    caption: `${label} ${i + 1}`,
    takenOn,
    receivedAt: sydneyStamp(takenOn, `${String(10 + i).padStart(2, '0')}:${String(5 + i * 7).padStart(2, '0')}`),
    isPlaceholder: true,
    messageId: null,
  }));
}

export const parkRdPhotos: Photo[] = [
  ...placeholderPhotos(J, 'ph-pr-slab-steel', 'pr-st-slab', 'pr-pc-slab-steel', 3, 'Slab steel', '2026-07-03'),
  ...placeholderPhotos(J, 'ph-pr-slab-plumb', 'pr-st-slab', 'pr-pc-slab-plumbing', 2, 'Under-slab plumbing', '2026-06-26'),
  ...placeholderPhotos(J, 'ph-pr-slab-mem', 'pr-st-slab', 'pr-pc-slab-membrane', 1, 'Membrane', '2026-07-03'),
  ...placeholderPhotos(J, 'ph-pr-frame', 'pr-st-frame', 'pr-pc-frame-bracing', 2, 'Frame bracing', '2026-07-28'),
  ...placeholderPhotos(J, 'ph-pr-roof', 'pr-st-roof', 'pr-pc-roof-complete', 4, 'Roof', '2026-08-19'),
  ...placeholderPhotos(J, 'ph-pr-brick', 'pr-st-lockup', 'pr-pc-lockup-brick', 2, 'Brickwork', '2026-09-11'),
  ...placeholderPhotos(J, 'ph-pr-clad', 'pr-st-lockup', 'pr-pc-lockup-cladding', 2, 'Cladding', '2026-09-16'),
  ...placeholderPhotos(J, 'ph-pr-defect', null, 'pr-pc-general', 1, 'Cracked roof tiles above garage', '2026-09-10'),
];

const note = (id: string, date: string, time: string, text: string): DailyNote => ({
  id,
  jobId: J,
  date,
  text,
  createdAt: sydneyStamp(date, time),
  messageId: null,
});

/** A week of site notes, Thu 10 Sep to Thu 17 Sep. */
export const parkRdNotes: DailyNote[] = [
  note('dn-pr-0910', '2026-09-10', '15:40', 'Brickies finishing the rear wall. Sand delivered 7am. Cracked roof tiles above the garage, told Raff.'),
  note('dn-pr-0911', '2026-09-11', '15:05', 'Brickwork done and cleaned down. Scaffold stays up for the cladders.'),
  note('dn-pr-0914', '2026-09-14', '16:02', 'Roof plumber on site, two blokes. Downpipes started on the north side.'),
  note('dn-pr-0915', '2026-09-15', '12:48', 'Cladding delivered and stacked under cover. One pack short, supplier chasing it.'),
  note('dn-pr-0916', '2026-09-16', '15:31', 'Cladders started on the rear wall. Roof plumber still here.'),
  note('dn-pr-0917', '2026-09-17', '15:55', 'Rain till 10. Cladding carried on after. Roof plumbing finished bar the garage.'),
];
