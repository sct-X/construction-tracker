/** The Duplex template: the same program as Park Rd with no dates (rule 8). */
import type { Job } from '../domain/types';
import { ProgramBuilder, SIDE_ND } from './helpers';
import { duplexProgram, prefixIds } from './duplexProgram';

export const TEMPLATE_DUPLEX = 'tpl-duplex';

export const duplexTemplateJob: Job = {
  id: TEMPLATE_DUPLEX,
  sideId: SIDE_ND,
  name: 'Duplex',
  kind: 'build',
  path: 'DA',
  isTemplate: true,
  createdAt: '2026-05-01',
};

export const duplexTemplateProgram = (() => {
  const b = duplexProgram(new ProgramBuilder(TEMPLATE_DUPLEX, SIDE_ND, false));
  prefixIds(b, 'tpl');
  return b;
})();
