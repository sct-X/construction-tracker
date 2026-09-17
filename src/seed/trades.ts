import type { Trade } from '../domain/types';
import { SIDE_ND } from './helpers';

const t = (id: string, name: string, type: string, phone: string): Trade => ({ id, sideId: SIDE_ND, name, type, phone });

export const trades: Trade[] = [
  t('tr-excavator', 'Digby Excavations', 'Excavator', '0411 200 301'),
  t('tr-concreter', 'Hardline Concreting', 'Concreter', '0411 200 302'),
  t('tr-pump', 'Coastal Concrete Pumping', 'Concrete pump', '0411 200 303'),
  t('tr-carpenter', 'Framewright Carpentry', 'Frame carpenter', '0411 200 304'),
  t('tr-roofplumber', 'Southside Roofing', 'Roof plumber', '0411 200 305'),
  t('tr-cladder', 'Coastal Cladding', 'Cladder', '0411 200 306'),
  t('tr-windows', 'Glassline Installations', 'Window installer', '0411 200 307'),
  t('tr-plumber', 'Baxter Plumbing', 'Plumber', '0411 200 308'),
  t('tr-electrician', 'Volt Electrical', 'Electrician', '0411 200 309'),
  t('tr-plasterer', 'Gyprock Bros', 'Plasterer', '0411 200 310'),
  t('tr-waterproofer', 'Sealtight Waterproofing', 'Waterproofer', '0411 200 311'),
  t('tr-tiler', 'Marino Tiling', 'Tiler', '0411 200 312'),
  t('tr-joiner', 'Bench and Board Joinery', 'Joiner', '0411 200 313'),
  t('tr-painter', 'Fresh Coat Painting', 'Painter', '0411 200 314'),
  t('tr-certifier', 'Certify Co', 'Certifier', '0411 200 315'),
  t('tr-landscaper', 'Greenway Landscapes', 'Landscaper', '0411 200 316'),
];
