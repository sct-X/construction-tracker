/**
 * The duplex program. Park Rd runs it with dates and statuses; the Duplex
 * template runs the same structure through an undated builder, which drops
 * every date and status (rule 8: templates have no dates).
 *
 * Park Rd's dates are tuned so that, with today = Thu 17 Sep 2026:
 *  - Install windows is planned for Mon 2 Nov 2026 and every step after it
 *    chains with zero slack, so a 10-working-day delay to the windows moves
 *    the finish by exactly 10 working days: Fri 26 Feb 2027 -> Fri 12 Mar 2027.
 *  - Plasterboard starts Fri 11 Dec so "Book plasterer" (12 weeks) acts by Fri 18 Sep.
 */
import type { ProgramBuilder } from './helpers';

export function duplexProgram(b: ProgramBuilder): ProgramBuilder {
  b.stage('st-site', 'Site establishment', 'done')
    .stage('st-slab', 'Slab', 'done')
    .stage('st-frame', 'Frame', 'done')
    .stage('st-roof', 'Roof', 'done')
    .stage('st-lockup', 'Lock-up', 'in_progress')
    .stage('st-external', 'External works')
    .stage('st-fitout', 'Fit-out')
    .stage('st-handover', 'Handover');

  // Site establishment
  b.step({ id: 'site-setup', stage: 'st-site', name: 'Site setup and fencing', duration: 5, start: '2026-06-01', status: 'done', trade: 'Excavator' })
    .step({ id: 'excavation', stage: 'st-site', name: 'Excavation and piering', duration: 10, after: 'site-setup', status: 'done', trade: 'Excavator' });

  // Slab
  b.step({ id: 'underslab', stage: 'st-slab', name: 'Under-slab plumbing', duration: 5, after: 'excavation', status: 'done', trade: 'Plumber' })
    .step({ id: 'formwork', stage: 'st-slab', name: 'Formwork and steel', duration: 5, after: 'underslab', status: 'done', trade: 'Concreter' })
    .step({ id: 'slab-insp', stage: 'st-slab', name: 'Slab inspection before pour', duration: 1, after: 'formwork', status: 'done', hold: true, trade: 'Certifier' })
    .step({ id: 'pour-slab', stage: 'st-slab', name: 'Pour slab', duration: 1, after: 'slab-insp', status: 'done', trade: 'Concreter' });

  // Frame
  b.step({ id: 'frame', stage: 'st-frame', name: 'Frame', duration: 15, after: 'pour-slab', status: 'done', trade: 'Frame carpenter' })
    .step({ id: 'frame-insp', stage: 'st-frame', name: 'Frame inspection', duration: 1, after: 'frame', status: 'done', hold: true, trade: 'Certifier' });

  // Roof
  b.step({ id: 'trusses', stage: 'st-roof', name: 'Roof trusses', duration: 5, after: 'frame-insp', status: 'done', trade: 'Frame carpenter' })
    .step({ id: 'roof-cover', stage: 'st-roof', name: 'Roof cover', duration: 10, after: 'trusses', status: 'done', trade: 'Roof plumber' })
    .step({ id: 'fascia', stage: 'st-roof', name: 'Fascia, gutters and eaves', duration: 10, after: 'roof-cover', status: 'done', trade: 'Roof plumber' });

  // Lock-up (current stage)
  b.step({ id: 'brickwork', stage: 'st-lockup', name: 'Brickwork', duration: 7, after: 'fascia', status: 'done', trade: 'Bricklayer' })
    .step({ id: 'roof-plumbing', stage: 'st-lockup', name: 'Roof plumbing', duration: 4, after: 'brickwork', status: 'in_progress', trade: 'Roof plumber' })
    .step({ id: 'cladding', stage: 'st-lockup', name: 'External cladding', duration: 15, start: '2026-09-16', waits: ['brickwork'], trade: 'Cladder' })
    .step({ id: 'install-windows', stage: 'st-lockup', name: 'Install windows', duration: 10, start: '2026-11-02', waits: ['cladding'], trade: 'Window installer' })
    .step({ id: 'external-doors', stage: 'st-lockup', name: 'External doors', duration: 5, after: 'install-windows', trade: 'Window installer' });

  // External works (overlaps Lock-up and Fit-out: it waits on a Lock-up step)
  b.step({ id: 'stormwater', stage: 'st-external', name: 'Stormwater drainage', duration: 15, start: '2026-09-21', waits: ['roof-plumbing'], trade: 'Plumber' })
    .step({ id: 'stormwater-insp', stage: 'st-external', name: 'Stormwater inspection', duration: 1, after: 'stormwater', hold: true, trade: 'Certifier' })
    .step({ id: 'landscaping', stage: 'st-external', name: 'Driveway and landscaping', duration: 10, start: '2027-02-08', waits: ['stormwater-insp'], trade: 'Landscaper' });

  // Fit-out: a zero-slack chain from External doors to Handover
  b.step({ id: 'rough-in', stage: 'st-fitout', name: 'Rough-in plumbing and electrical', duration: 10, after: 'external-doors', trade: 'Plumber, Electrician' })
    .step({ id: 'insulation', stage: 'st-fitout', name: 'Insulation', duration: 4, after: 'rough-in', trade: 'Insulation installer' })
    .step({ id: 'plasterboard', stage: 'st-fitout', name: 'Plasterboard', duration: 8, after: 'insulation', trade: 'Plasterer' })
    .step({ id: 'waterproofing', stage: 'st-fitout', name: 'Waterproofing', duration: 3, after: 'plasterboard', trade: 'Waterproofer' })
    .step({ id: 'tiling', stage: 'st-fitout', name: 'Tiling', duration: 10, after: 'waterproofing', trade: 'Tiler' })
    .step({ id: 'kitchen', stage: 'st-fitout', name: 'Kitchen and joinery', duration: 10, after: 'tiling', trade: 'Joiner' })
    .step({ id: 'painting', stage: 'st-fitout', name: 'Painting', duration: 5, after: 'kitchen', trade: 'Painter' })
    .step({ id: 'fit-off', stage: 'st-fitout', name: 'Fit-off plumbing and electrical', duration: 3, after: 'painting', trade: 'Plumber, Electrician' });

  // Handover
  b.step({ id: 'final-insp', stage: 'st-handover', name: 'Final inspection for OC', duration: 1, after: 'fit-off', waits: ['landscaping'], hold: true, trade: 'Certifier' })
    .step({ id: 'handover', stage: 'st-handover', name: 'Handover and clean', duration: 1, after: 'final-insp' });

  // Requirements: what each step needs, with lead times in calendar weeks
  b.req({ id: 'rq-excavator', step: 'site-setup', kind: 'trade', name: 'Excavator', lead: 2, trade: 'Excavator' })
    .req({ id: 'rq-slab-steel', step: 'formwork', kind: 'material', name: 'Slab steel', lead: 2 })
    .req({ id: 'rq-concreter', step: 'pour-slab', kind: 'trade', name: 'Concreter', lead: 2, trade: 'Concreter' })
    .req({ id: 'rq-pump', step: 'pour-slab', kind: 'trade', name: 'Concrete pump', lead: 2, trade: 'Concrete pump' })
    .req({ id: 'rq-frame-timber', step: 'frame', kind: 'material', name: 'Frame timber', lead: 4 })
    .req({ id: 'rq-carpenter', step: 'frame', kind: 'trade', name: 'Frame carpenter', lead: 3, trade: 'Frame carpenter' })
    .req({ id: 'rq-trusses', step: 'trusses', kind: 'material', name: 'Roof trusses', lead: 6 })
    .req({ id: 'rq-roof-plumber', step: 'roof-plumbing', kind: 'trade', name: 'Roof plumber', lead: 3, trade: 'Roof plumber' })
    .req({ id: 'rq-cladder', step: 'cladding', kind: 'trade', name: 'Cladder', lead: 4, trade: 'Cladder' })
    .req({ id: 'rq-cladding', step: 'cladding', kind: 'material', name: 'Cladding', lead: 2 })
    .req({ id: 'rq-windows', step: 'install-windows', kind: 'material', name: 'Windows', lead: 12 })
    .req({ id: 'rq-window-installer', step: 'install-windows', kind: 'trade', name: 'Window installer', lead: 3, trade: 'Window installer' })
    .req({ id: 'rq-external-doors', step: 'external-doors', kind: 'material', name: 'External doors', lead: 6 })
    .req({ id: 'rq-sw-plumber', step: 'stormwater', kind: 'trade', name: 'Plumber', lead: 2, trade: 'Plumber' })
    .req({ id: 'rq-ri-plumber', step: 'rough-in', kind: 'trade', name: 'Plumber', lead: 4, trade: 'Plumber' })
    .req({ id: 'rq-ri-electrician', step: 'rough-in', kind: 'trade', name: 'Electrician', lead: 4, trade: 'Electrician' })
    .req({ id: 'rq-insulation', step: 'insulation', kind: 'material', name: 'Insulation', lead: 2 })
    .req({ id: 'rq-plasterer', step: 'plasterboard', kind: 'trade', name: 'Plasterer', lead: 12, trade: 'Plasterer' })
    .req({ id: 'rq-waterproofer', step: 'waterproofing', kind: 'trade', name: 'Waterproofer', lead: 4, trade: 'Waterproofer' })
    .req({ id: 'rq-tiler', step: 'tiling', kind: 'trade', name: 'Tiler', lead: 6, trade: 'Tiler' })
    .req({ id: 'rq-tiles', step: 'tiling', kind: 'material', name: 'Tiles', lead: 8 })
    .req({ id: 'rq-joiner', step: 'kitchen', kind: 'trade', name: 'Joiner', lead: 8, trade: 'Joiner' })
    .req({ id: 'rq-kitchen', step: 'kitchen', kind: 'material', name: 'Kitchen', lead: 8 })
    .req({ id: 'rq-painter', step: 'painting', kind: 'trade', name: 'Painter', lead: 4, trade: 'Painter' })
    .req({ id: 'rq-landscaper', step: 'landscaping', kind: 'trade', name: 'Landscaper', lead: 4, trade: 'Landscaper' });

  // Photo categories per stage. "required" = needed before the stage's hold point.
  b.category('pc-general', null, 'General')
    .category('pc-slab-steel', 'st-slab', 'Steel reinforcement in place', true)
    .category('pc-slab-plumbing', 'st-slab', 'Plumbing under slab', true)
    .category('pc-slab-membrane', 'st-slab', 'Membrane and termite barrier', true)
    .category('pc-frame-bracing', 'st-frame', 'Frame bracing and tie-downs', true)
    .category('pc-roof-complete', 'st-roof', 'Roof complete')
    .category('pc-lockup-windows', 'st-lockup', 'Windows installed')
    .category('pc-lockup-cladding', 'st-lockup', 'External cladding')
    .category('pc-lockup-brick', 'st-lockup', 'Brickwork')
    .category('pc-sw-before-backfill', 'st-external', 'Stormwater before backfill', true)
    .category('pc-fitout-roughin', 'st-fitout', 'Rough-in before plasterboard')
    .category('pc-fitout-waterproofing', 'st-fitout', 'Wet area waterproofing')
    .category('pc-handover-finishes', 'st-handover', 'Final finishes', true);

  return b;
}

/** Prefix every id in a built program so two jobs can share the structure. */
export function prefixIds(b: ProgramBuilder, prefix: string): void {
  const map = (id: string) => `${prefix}-${id}`;
  for (const s of b.stages) s.id = map(s.id);
  for (const s of b.steps) {
    s.id = map(s.id);
    s.stageId = map(s.stageId);
  }
  for (const l of b.links) {
    l.id = map(l.id);
    l.stepId = map(l.stepId);
    l.waitsForStepId = map(l.waitsForStepId);
  }
  for (const r of b.requirements) {
    r.id = map(r.id);
    r.stepId = map(r.stepId);
  }
  for (const c of b.categories) {
    c.id = map(c.id);
    if (c.stageId) c.stageId = map(c.stageId);
  }
}
