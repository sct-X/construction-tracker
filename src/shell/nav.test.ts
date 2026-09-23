/**
 * Per-role navigation (Dom's brief, change 2): partners and admin find
 * shipments inside each job, so their phone bottom nav is Overview and
 * Waiting on. Builder and site navs are unchanged.
 */
import { describe, expect, it } from 'vitest';
import { createMockApi } from '../data/mockApi';
import { MemoryStorage } from '../data/storage';
import { DEFAULT_TODAY } from '../seed';
import { jobSectionHref, jobSwitcherFor, phoneTabs, shipmentHref, shipmentsInJob, sidebarMain } from './nav';

function apiAs(personId: string) {
  return createMockApi({ storage: new MemoryStorage(), session: { personId, today: DEFAULT_TODAY } });
}

const labels = (personId: string) => {
  const api = apiAs(personId);
  return phoneTabs(api.whoami().role, api).map((t) => t.label);
};

describe('phone bottom nav per role', () => {
  it('partners and admin get Overview and Waiting on only', () => {
    expect(labels('dom')).toEqual(['Overview', 'Waiting on']);
    expect(labels('norm')).toEqual(['Overview', 'Waiting on']);
    expect(labels('dominic')).toEqual(['Overview', 'Waiting on']);
  });

  it('builder and site navs are unchanged', () => {
    expect(labels('raff')).toEqual(['My items', 'Jobs', '+ Photos']);
    expect(labels('alec')).toEqual(['Today', 'Jobs']);
  });

  it('the desktop sidebar still lists the global Shipments page', () => {
    expect(sidebarMain(apiAs('dom')).map((t) => t.to)).toContain('/shipments');
  });
});

describe('where a shipment opens', () => {
  const sh = { id: 'sh-park-windows', jobId: 'park-rd' };
  it('inside its job for partners and admin, globally for builders', () => {
    expect(shipmentsInJob('partner')).toBe(true);
    expect(shipmentsInJob('admin')).toBe(true);
    expect(shipmentsInJob('builder')).toBe(false);
    expect(shipmentHref('partner', sh)).toBe('/jobs/park-rd/shipments/sh-park-windows');
    expect(shipmentHref('admin', sh)).toBe('/jobs/park-rd/shipments/sh-park-windows');
    expect(shipmentHref('builder', sh)).toBe('/shipments/sh-park-windows');
  });

  it('a job scoped list holds only that job', () => {
    const api = createMockApi({ storage: new MemoryStorage(), session: { personId: 'norm', sideId: 'side-norm', today: DEFAULT_TODAY } });
    const all = api.listShipments();
    expect(new Set(all.map((s) => s.jobId)).size).toBeGreaterThan(1);
    const hunts = api.listShipments('hunts-12');
    expect(hunts.map((s) => s.id)).toEqual(['sh-hunts12-windows']);
  });
});

describe('the job switcher (Dom\'s brief, change 1)', () => {
  it('is on partner and admin job pages only', () => {
    expect(jobSwitcherFor('partner')).toBe(true);
    expect(jobSwitcherFor('admin')).toBe(true);
    expect(jobSwitcherFor('builder')).toBe(false);
    expect(jobSwitcherFor('site')).toBe(false);
  });

  it('lands on the same page of the new job when it has one', () => {
    const seaview = { id: 'seaview', kind: 'build' as const };
    expect(jobSectionHref('program', seaview)).toBe('/jobs/seaview/program');
    expect(jobSectionHref('shipments', seaview)).toBe('/jobs/seaview/shipments');
    expect(jobSectionHref('photos', seaview)).toBe('/jobs/seaview/photos');
    expect(jobSectionHref('notes', seaview)).toBe('/jobs/seaview/notes');
    expect(jobSectionHref('overview', seaview)).toBe('/jobs/seaview');
  });

  it('lands on a design job\'s checklist from any page', () => {
    const design = { id: 'west-st', kind: 'design' as const };
    for (const s of ['overview', 'program', 'shipments', 'photos', 'notes'] as const) expect(jobSectionHref(s, design)).toBe('/jobs/west-st');
  });
});
