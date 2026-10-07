/**
 * The duplex program. Park Rd runs it with dates and statuses; the Duplex
 * template runs the same structure undated (rule 8). Durations are the
 * prototype's tuning (construction-tracker@2f6d8a7), so with today Thu 17 Sep 2026:
 *  - Install windows is planned Mon 2 Nov 2026 and every step after it chains
 *    with zero slack, so a 10-working-day delay moves the finish exactly 10
 *    working days: Fri 26 Feb 2027 -> Fri 12 Mar 2027.
 *  - Plasterboard starts Fri 11 Dec and crosses the shutdown (21 Dec - 8 Jan).
 */
import type { ProgramBuilder } from './helpers.js';

export function duplexProgram(b: ProgramBuilder): ProgramBuilder {
  b.stage('st-site', 'Site establishment', 'done')
    .stage('st-slab', 'Slab', 'done')
    .stage('st-frame', 'Frame', 'done')
    .stage('st-roof', 'Roof', 'done')
    .stage('st-lockup', 'Lock-up', 'in_progress')
    .stage('st-external', 'External works')
    .stage('st-fitout', 'Fit-out')
    .stage('st-handover', 'Handover');

  b.step({ id: 'site-setup', stage: 'st-site', name: 'Site setup and fencing', duration: 5, start: '2026-06-01', status: 'done', trade: 'Excavator' })
    .step({ id: 'excavation', stage: 'st-site', name: 'Excavation and piering', duration: 10, after: 'site-setup', status: 'done', trade: 'Excavator' })
    .step({ id: 'underslab', stage: 'st-slab', name: 'Under-slab plumbing', duration: 5, after: 'excavation', status: 'done', trade: 'Plumber' })
    .step({ id: 'formwork', stage: 'st-slab', name: 'Formwork and steel', duration: 5, after: 'underslab', status: 'done', trade: 'Concreter' })
    .step({ id: 'slab-insp', stage: 'st-slab', name: 'Slab inspection before pour', duration: 1, after: 'formwork', status: 'done', hold: true, trade: 'Certifier' })
    .step({ id: 'pour-slab', stage: 'st-slab', name: 'Pour slab', duration: 1, after: 'slab-insp', status: 'done', trade: 'Concreter' })
    .step({ id: 'frame', stage: 'st-frame', name: 'Frame', duration: 15, after: 'pour-slab', status: 'done', trade: 'Frame carpenter' })
    .step({ id: 'frame-insp', stage: 'st-frame', name: 'Frame inspection', duration: 1, after: 'frame', status: 'done', hold: true, trade: 'Certifier' })
    .step({ id: 'trusses', stage: 'st-roof', name: 'Roof trusses', duration: 5, after: 'frame-insp', status: 'done', trade: 'Frame carpenter' })
    .step({ id: 'roof-cover', stage: 'st-roof', name: 'Roof cover', duration: 10, after: 'trusses', status: 'done', trade: 'Roof plumber' })
    .step({ id: 'fascia', stage: 'st-roof', name: 'Fascia, gutters and eaves', duration: 10, after: 'roof-cover', status: 'done', trade: 'Roof plumber' })
    .step({ id: 'brickwork', stage: 'st-lockup', name: 'Brickwork', duration: 7, after: 'fascia', status: 'done', trade: 'Bricklayer' })
    .step({ id: 'roof-plumbing', stage: 'st-lockup', name: 'Roof plumbing', duration: 4, after: 'brickwork', status: 'in_progress', trade: 'Roof plumber' })
    .step({ id: 'cladding', stage: 'st-lockup', name: 'External cladding', duration: 15, start: '2026-09-16', waits: ['brickwork'], trade: 'Cladder' })
    .step({ id: 'install-windows', stage: 'st-lockup', name: 'Install windows', duration: 10, start: '2026-11-02', waits: ['cladding'], trade: 'Window installer' })
    .step({ id: 'external-doors', stage: 'st-lockup', name: 'External doors', duration: 5, after: 'install-windows', trade: 'Window installer' })
    .step({ id: 'stormwater', stage: 'st-external', name: 'Stormwater drainage', duration: 15, start: '2026-09-21', waits: ['roof-plumbing'], trade: 'Plumber' })
    .step({ id: 'stormwater-insp', stage: 'st-external', name: 'Stormwater inspection', duration: 1, after: 'stormwater', hold: true, trade: 'Certifier' })
    .step({ id: 'landscaping', stage: 'st-external', name: 'Driveway and landscaping', duration: 10, start: '2027-02-08', waits: ['stormwater-insp'], trade: 'Landscaper' })
    .step({ id: 'rough-in', stage: 'st-fitout', name: 'Rough-in plumbing and electrical', duration: 10, after: 'external-doors', trade: 'Plumber, Electrician' })
    .step({ id: 'insulation', stage: 'st-fitout', name: 'Insulation', duration: 4, after: 'rough-in', trade: 'Insulation installer' })
    .step({ id: 'plasterboard', stage: 'st-fitout', name: 'Plasterboard', duration: 8, after: 'insulation', trade: 'Plasterer' })
    .step({ id: 'waterproofing', stage: 'st-fitout', name: 'Waterproofing', duration: 3, after: 'plasterboard', trade: 'Waterproofer' })
    .step({ id: 'tiling', stage: 'st-fitout', name: 'Tiling', duration: 10, after: 'waterproofing', trade: 'Tiler' })
    .step({ id: 'kitchen', stage: 'st-fitout', name: 'Kitchen and joinery', duration: 10, after: 'tiling', trade: 'Joiner' })
    .step({ id: 'painting', stage: 'st-fitout', name: 'Painting', duration: 5, after: 'kitchen', trade: 'Painter' })
    .step({ id: 'fit-off', stage: 'st-fitout', name: 'Fit-off plumbing and electrical', duration: 3, after: 'painting', trade: 'Plumber, Electrician' })
    .step({ id: 'final-insp', stage: 'st-handover', name: 'Final inspection for OC', duration: 1, after: 'fit-off', waits: ['landscaping'], hold: true, trade: 'Certifier' })
    .step({ id: 'handover', stage: 'st-handover', name: 'Handover and clean', duration: 1, after: 'final-insp' });

  b.req('rq-excavator', 'site-setup', 'trade', 'Excavator', 2, 'Excavator')
    .req('rq-slab-steel', 'formwork', 'material', 'Slab steel', 2)
    .req('rq-concreter', 'pour-slab', 'trade', 'Concreter', 2, 'Concreter')
    .req('rq-pump', 'pour-slab', 'trade', 'Concrete pump', 2, 'Concrete pump')
    .req('rq-frame-timber', 'frame', 'material', 'Frame timber', 4)
    .req('rq-carpenter', 'frame', 'trade', 'Frame carpenter', 3, 'Frame carpenter')
    .req('rq-trusses', 'trusses', 'material', 'Roof trusses', 6)
    .req('rq-roof-plumber', 'roof-plumbing', 'trade', 'Roof plumber', 3, 'Roof plumber')
    .req('rq-cladder', 'cladding', 'trade', 'Cladder', 4, 'Cladder')
    .req('rq-cladding', 'cladding', 'material', 'Cladding', 2)
    .req('rq-windows', 'install-windows', 'material', 'Windows', 12)
    .req('rq-window-installer', 'install-windows', 'trade', 'Window installer', 3, 'Window installer')
    .req('rq-external-doors', 'external-doors', 'material', 'External doors', 6)
    .req('rq-sw-plumber', 'stormwater', 'trade', 'Plumber', 2, 'Plumber')
    .req('rq-ri-plumber', 'rough-in', 'trade', 'Plumber', 4, 'Plumber')
    .req('rq-ri-electrician', 'rough-in', 'trade', 'Electrician', 4, 'Electrician')
    .req('rq-insulation', 'insulation', 'material', 'Insulation', 2)
    .req('rq-plasterer', 'plasterboard', 'trade', 'Plasterer', 12, 'Plasterer')
    .req('rq-waterproofer', 'waterproofing', 'trade', 'Waterproofer', 4, 'Waterproofer')
    .req('rq-tiler', 'tiling', 'trade', 'Tiler', 6, 'Tiler')
    .req('rq-tiles', 'tiling', 'material', 'Tiles', 8)
    .req('rq-joiner', 'kitchen', 'trade', 'Joiner', 8, 'Joiner')
    .req('rq-kitchen', 'kitchen', 'material', 'Kitchen', 8)
    .req('rq-painter', 'painting', 'trade', 'Painter', 4, 'Painter')
    .req('rq-landscaper', 'landscaping', 'trade', 'Landscaper', 4, 'Landscaper');

  // "required" = needed before the stage's hold point.
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
