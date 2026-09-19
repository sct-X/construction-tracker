/**
 * The trade directory: the firms on the jobs (from the job folders), one
 * row per firm per side. The phone numbers are the
 * ACMA fictitious mobile range (0491 570 006 to 0491 579 858), which never
 * connect, so the tap-to-call demo rings nobody real.
 */
import type { Trade } from '../domain/types';
import { SIDE_ND, SIDE_NORM } from './helpers';

const t = (id: string, name: string, type: string, phone: string, sideId = SIDE_ND): Trade => ({ id, sideId, name, type, phone });

export const trades: Trade[] = [
  t('tr-democorp', 'Democorp Australia', 'Demolition', '0491 570 006'),
  t('tr-delt', 'Delt Civil', 'Demolition and excavation', '0491 570 156'),
  t('tr-ir', 'IR Formwork Constructions', 'Formwork and concrete', '0491 570 157'),
  t('tr-buildsolid', 'Build Solid Carpentry', 'Carpenter', '0491 570 158'),
  t('tr-firstcall', 'First Call Plumbing Solutions', 'Plumber', '0491 571 491'),
  t('tr-multitask', 'Multitask Civil', 'Sydney Water tap-in', '0491 571 804'),
  t('tr-oneconn', 'One Connection', 'Electrician', '0491 572 549'),
  t('tr-cjlinea', 'CJ Linea', 'Plasterer', '0491 573 770'),
  t('tr-competent', 'Competent Tiling', 'Tiler and waterproofer', '0491 574 118'),
  t('tr-woodenage', 'Wooden Age Joinery', 'Joiner', '0491 574 632'),
  t('tr-industry', 'Industry Kitchens', 'Kitchens', '0491 575 254'),
  t('tr-certex', 'Certex Approvals', 'Certifier', '0491 577 426'),
  t('tr-iscape', 'iScape', 'Landscape architect', '0491 577 644'),
  t('tr-vertex', 'Vertex Surveyors', 'Surveyor', '0491 578 957'),
  t('tr-ihs', 'IHS Consulting Engineers', 'Structural engineer', '0491 579 760'),
  t('tr-eze', 'EZE Drainage', 'Hydraulic engineer', '0491 579 858'),
  // The Norm side keeps its own directory: the firms on the Eastwood jobs.
  t('trn-ir', 'IR Formwork Constructions', 'Formwork and concrete', '0491 570 157', SIDE_NORM),
  t('trn-advance', 'Advance Carpentry Services', 'Roof carpenter', '0491 570 159', SIDE_NORM),
  t('trn-jad', 'JAD Scaffolding', 'Scaffolding', '0491 571 266', SIDE_NORM),
  t('trn-oneconn', 'One Connection', 'Electrician', '0491 572 549', SIDE_NORM),
  t('trn-cjlinea', 'CJ Linea', 'Plasterer', '0491 573 770', SIDE_NORM),
  t('trn-ultraair', 'Ultra Air', 'Air conditioning', '0491 575 789', SIDE_NORM),
  t('trn-premiumlift', 'Premium Lift Systems', 'Home lift', '0491 576 398', SIDE_NORM),
  t('trn-certex', 'Certex Approvals', 'Certifier', '0491 577 426', SIDE_NORM),
  t('trn-ihs', 'IHS Consulting Engineers', 'Structural engineer', '0491 579 760', SIDE_NORM),
];
