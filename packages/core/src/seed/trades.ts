/**
 * The trade directory. Firm names are invented. Phones are from ACMA's
 * fictitious mobile numbers (0491 570 xxx to 0491 579 xxx list), which never
 * connect, so tap-to-call in the demo rings nobody.
 */
import type { Trade } from '../types.js';
import { SIDE_ND } from './helpers.js';

const t = (id: string, name: string, type: string, phone: string): Trade => ({ id, sideId: SIDE_ND, name, type, phone });

export const TR = {
  demo: 'tr-ridgeline',
  formwork: 'tr-harbourside',
  pump: 'tr-northern-pump',
  carpenter: 'tr-solid-frame',
  roofer: 'tr-bayview-roof',
  brickie: 'tr-redgum',
  plumber: 'tr-clearflow',
  sparky: 'tr-brightline',
  plasterer: 'tr-smooth-wall',
  tiler: 'tr-harbour-tiling',
  joiner: 'tr-oakline',
  painter: 'tr-fresh-coat',
  certifier: 'tr-northside-cert',
  landscaper: 'tr-greenline',
  windows: 'tr-clearview',
  surveyor: 'tr-level-line',
  civil: 'tr-gully-civil',
  insulation: 'tr-warmwall',
} as const;

export const trades: Trade[] = [
  t(TR.demo, 'Ridgeline Demolition', 'Demolition and excavation', '0491 570 006'),
  t(TR.civil, 'Gully Civil', 'Civil works and Sydney Water tap-in', '0491 570 110'),
  t(TR.formwork, 'Harbourside Formwork', 'Formwork and concrete', '0491 570 156'),
  t(TR.pump, 'Northern Concrete Pumping', 'Concrete pump', '0491 570 157'),
  t(TR.carpenter, 'Solid Frame Carpentry', 'Carpenter and cladder', '0491 570 158'),
  t(TR.roofer, 'Bayview Roofing', 'Roof plumber', '0491 570 159'),
  t(TR.brickie, 'Redgum Bricklaying', 'Bricklayer', '0491 570 313'),
  t(TR.plumber, 'Clearflow Plumbing', 'Plumber', '0491 571 491'),
  t(TR.sparky, 'Brightline Electrical', 'Electrician', '0491 572 549'),
  t(TR.insulation, 'Warmwall Insulation', 'Insulation installer', '0491 572 665'),
  t(TR.plasterer, 'Smooth Wall Plastering', 'Plasterer', '0491 573 770'),
  t(TR.tiler, 'Harbour Tiling', 'Tiler and waterproofer', '0491 574 118'),
  t(TR.joiner, 'Oakline Joinery', 'Joiner and kitchens', '0491 574 632'),
  t(TR.painter, 'Fresh Coat Painting', 'Painter', '0491 575 254'),
  t(TR.windows, 'ClearView Window Installs', 'Window installer', '0491 575 789'),
  t(TR.certifier, 'Northside Certifiers', 'Certifier', '0491 577 426'),
  t(TR.landscaper, 'Greenline Landscapes', 'Landscaper', '0491 577 644'),
  t(TR.surveyor, 'Level Line Surveys', 'Surveyor', '0491 578 957'),
];
