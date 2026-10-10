// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createMockDashboard } from '@ct/core';
import type { ReactElement } from 'react';
import { DataProvider } from '../data/DataContext';
import type { DataLayer } from '../data/layer';
import { WaitingOnScreen } from './WaitingOn';
import { ShipmentsScreen } from './Shipments';
import { shipmentTimingWords, telHref, urgencyWords } from '../ui/itemWords';

function show(ui: ReactElement) {
  const { api, dev } = createMockDashboard();
  const layer: DataLayer = { mode: 'mock', api, dev };
  return render(<DataProvider layer={layer}>{ui}</DataProvider>);
}

afterEach(cleanup);

describe('Stage 4b wording', () => {
  it('writes phone numbers as tel: links', () => {
    expect(telHref('0491 570 158')).toBe('tel:0491570158');
    expect(telHref('+61 491 570 158')).toBe('tel:+61491570158');
    expect(telHref(null)).toBeNull();
    expect(telHref('none')).toBeNull();
  });

  it('says why an item needs attention in words', () => {
    const base = { status: 'to_do' as const, isLate: false, lateDays: 0, overdue: true };
    expect(urgencyWords({ ...base, neededBy: '2026-09-14', actBy: '2026-08-31', expected: '2026-09-16' }, '2026-09-17')?.text).toBe('3 days overdue');
    expect(urgencyWords({ ...base, neededBy: '2026-11-02', actBy: '2026-08-10', expected: '2026-10-26' }, '2026-09-17')?.text).toBe('Act-by passed 38 days ago');
    expect(
      urgencyWords({ ...base, overdue: false, isLate: true, lateDays: 14, neededBy: '2026-11-02', actBy: '2026-08-10', expected: '2026-11-16', status: 'confirmed' }, '2026-09-17')?.text,
    ).toBe("Expected 14 days after it's needed");
    expect(urgencyWords({ ...base, overdue: false, neededBy: '2026-11-02', actBy: '2026-10-01', expected: null }, '2026-09-17')).toBeNull();
  });

  it('compares a shipment ETA with the first needed-by', () => {
    const r = { eta: '2026-10-26', earliestNeededBy: '2026-11-02', isLate: false, lateDays: 0, status: 'in_production' as const };
    expect(shipmentTimingWords(r)).toBe('7 days to spare');
    expect(shipmentTimingWords({ ...r, eta: '2026-11-16', isLate: true, lateDays: 14 })).toBe('14 days late');
  });
});

describe('Shipments (mock layer, today Thu 17 Sep 2026)', () => {
  it('lists both windows shipments side-wide, each with its job, status, ETA and linked items', async () => {
    show(<ShipmentsScreen />);
    const park = within(await screen.findByTestId('shipment-row-sh-pr-windows'));
    expect(park.getByTestId('ship-job').textContent).toBe('Park Rd');
    expect(park.getByText('Park Rd windows')).toBeTruthy();
    expect(park.getByTestId('ship-status').textContent).toBe('In production');
    expect(park.getByTestId('eta').textContent).toBe('Mon 26 Oct');
    expect(park.getByTestId('needed-by').textContent).toBe('Mon 2 Nov, in 6 weeks');
    expect(park.getByTestId('timing').textContent).toBe('7 days to spare');
    const linked = within(park.getByTestId('linked-items'));
    expect(linked.getAllByRole('listitem')).toHaveLength(3);
    expect(linked.getByText('Windows')).toBeTruthy();
    expect(linked.getAllByText('Raff, needed Mon 2 Nov')).toHaveLength(2);

    const sea = within(screen.getByTestId('shipment-row-sh-sv-windows'));
    expect(sea.getByTestId('ship-job').textContent).toBe('Seaview St');
    expect(sea.getByTestId('ship-status').textContent).toBe('Design');
    expect(sea.getByTestId('eta').textContent).toBe('Mon 14 Dec');
    // Soonest ETA first.
    const ids = screen.getAllByTestId(/^shipment-row-/).map((e) => e.getAttribute('data-testid'));
    expect(ids).toEqual(['shipment-row-sh-pr-windows', 'shipment-row-sh-sv-windows']);
  });
});

describe('Waiting on (To chase is merged into it)', () => {
  it('every job, grouped Overdue / This week / Later, one date phrase per row, Call buttons', async () => {
    show(<WaitingOnScreen />);
    const steel = within(await screen.findByTestId('waiting-row-it-sv-slab-steel'));
    expect(steel.getByTestId('when').textContent).toBe('!Needed Mon 14 Sep, overdue by 3 days');
    expect(steel.getByText(/Seaview St · waiting on/)).toBeTruthy();
    const glazing = within(screen.getByTestId('waiting-row-it-pr-glazing-cert'));
    expect(glazing.getByTestId('when').textContent).toBe('!Act by Mon 10 Aug, overdue by 5 weeks');
    const pump = within(screen.getByTestId('waiting-row-it-sv-pump'));
    expect(pump.getByText(/with Raff/)).toBeTruthy();
    expect(pump.getByTestId('call').getAttribute('href')).toBe('tel:0491570157');
    // To chase's Call coverage: the trade is named, the number is in the accessible name.
    expect(pump.getByTestId('call').textContent).toContain('Northern Concrete Pumping');
    expect(pump.getByTestId('call').getAttribute('aria-label')).toContain('0491 570 157');
  });

  it('shows one job without the job name on rows', async () => {
    show(<WaitingOnScreen jobId="beatty" />);
    await screen.findByTestId('waiting-row-it-bt-tiler');
    const rows = screen.getAllByTestId(/^waiting-row-/);
    expect(rows.every((r) => r.getAttribute('data-testid')!.startsWith('waiting-row-it-bt-'))).toBe(true);
    expect(screen.queryByTestId('job-picker')).toBeNull();
  });

  it('Mine narrows to Dominic (was To chase\'s owner filter)', async () => {
    show(<WaitingOnScreen />);
    await screen.findByTestId('waiting-row-it-sv-pump');
    fireEvent.click(screen.getByRole('button', { name: 'Mine' }));
    expect(screen.queryByTestId('waiting-row-it-sv-pump')).toBeNull();
    expect(screen.getByTestId('waiting-row-it-pr-glazing-cert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mine' }).getAttribute('aria-pressed')).toBe('true');
  });
});

// Photos, Daily notes and Change history moved to stage6d.test.tsx (v1 look).
