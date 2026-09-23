/**
 * Per-role navigation (Dom's brief, change 2): every role finds shipments
 * inside each job, so no phone bottom nav carries a Shipments tab. The
 * desktop sidebar keeps the side-wide list.
 */
import { describe, expect, it } from 'vitest';
import { createMockApi } from '../data/mockApi';
import { MemoryStorage } from '../data/storage';
import { DEFAULT_TODAY } from '../seed';
import { jobSectionHref, jobSwitcherFor, phoneTabs, shipmentHref, sidebarMain } from './nav';

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

  it('builder and site navs carry no Shipments tab', () => {
    expect(labels('raff')).toEqual(['My items', 'Jobs', '+ Photos']);
    expect(labels('alec')).toEqual(['Today', 'Jobs']);
  });

  it('the desktop sidebar still lists the global Shipments page', () => {
    expect(sidebarMain(apiAs('dom')).map((t) => t.to)).toContain('/shipments');
  });
});

describe('where a shipment opens', () => {
  const sh = { id: 'sh-park-windows', jobId: 'park-rd' };
  it('inside its job, for every role', () => {
    expect(shipmentHref(sh)).toBe('/jobs/park-rd/shipments/sh-park-windows');
  });

  it("the site role reads a job's shipments but not the side-wide list", () => {
    const alec = apiAs('alec');
    expect(alec.canSee('jobShipments')).toBe(true);
    expect(alec.canSee('jobShipment')).toBe(true);
    expect(alec.canSee('shipments')).toBe(false);
    for (const p of ['raff', 'dom', 'dominic']) {
      const api = apiAs(p);
      expect(api.canSee('jobShipments') && api.canSee('jobShipment') && api.canSee('shipments')).toBe(true);
    }
  });

  it('a shipment read by the site role carries no money', () => {
    const alec = apiAs('alec');
    const sh = alec.getShipment('sh-park-windows')!;
    expect(JSON.stringify(sh)).not.toMatch(/Cost/);
    expect(alec.listShipments('park-rd').length).toBeGreaterThan(0);
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
  it('is on partner, admin and builder job pages; never the site role', () => {
    expect(jobSwitcherFor('partner')).toBe(true);
    expect(jobSwitcherFor('admin')).toBe(true);
    expect(jobSwitcherFor('builder')).toBe(true);
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
