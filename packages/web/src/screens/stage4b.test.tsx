// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createMockDashboard } from '@ct/core';
import type { ReactElement } from 'react';
import { DataProvider } from '../data/DataContext';
import type { DataLayer } from '../data/layer';
import { WaitingOnScreen } from './WaitingOn';
import { ShipmentsScreen } from './Shipments';
import { PhotosScreen } from './Photos';
import { NotesScreen } from './Notes';
import { HistoryScreen } from './History';
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

describe('Photos', () => {
  it('shows Seaview St slab hold point at 1 of 3 with the missing categories named', async () => {
    show(<PhotosScreen jobId="seaview" />);
    const slab = within(await screen.findByTestId('photo-stage-sv-st-slab'));
    const hold = slab.getByTestId('hold-progress');
    expect(hold.textContent).toContain('1 of 3');
    expect(hold.textContent).toContain('Slab inspection before pour');
    expect(hold.textContent).toContain('Mon 28 Sep');
    expect(hold.textContent).toContain('Plumbing under slab, Membrane and termite barrier');
    expect(slab.getAllByText('Needed for the hold point')).toHaveLength(3);
    expect(slab.getByText('4 photos')).toBeTruthy();
    const thumbs = slab.getAllByRole('button', { name: /^Open photo/ });
    expect(thumbs).toHaveLength(4);
    expect(thumbs[0]!.querySelector('img')!.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
    fireEvent.click(thumbs[0]!);
    expect(screen.getByTestId('lightbox')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByTestId('lightbox')).toBeNull();
  });
});

describe('Daily notes', () => {
  it('lists Park Rd notes newest first with dates', async () => {
    show(<NotesScreen jobId="park-rd" />);
    await screen.findByTestId('note-dn-pr-0917');
    const dates = screen.getAllByTestId('note-date').map((e) => e.textContent);
    expect(dates[0]).toBe('Thu 17 Sep');
    expect(dates).toHaveLength(6);
    expect(screen.getByText(/Rain till 10/)).toBeTruthy();
  });
});

describe('Change history', () => {
  it('shows each change set with its source, fields before and after, and the steps it moved', async () => {
    show(<HistoryScreen />);
    const tiler = within(await screen.findByTestId('history-cs-0915-tiler'));
    expect(tiler.getByTestId('status').textContent).toBe('Saved');
    expect(tiler.getByTestId('fields').textContent).toContain('Book tiler, expected date');
    expect(tiler.getByTestId('fields').textContent).toContain('Mon 28 Sep → Mon 5 Oct');
    expect(tiler.getByTestId('source').textContent).toContain("Harbour Tiling can't get to Beatty till the 5th of October");
    expect(tiler.getByTestId('source').textContent).toContain('Voice note on Telegram');
    // Timing first: what it moved, never the finish or money.
    expect(tiler.getByTestId('forecast').textContent).toMatch(/^Moved \d+ steps? at Beatty St$/);
    expect(tiler.getByTestId('forecast').textContent).not.toMatch(/\$|finish/);

    const cancelled = within(screen.getByTestId('history-cs-0916-cancel'));
    expect(cancelled.getByTestId('status').textContent).toBe('Cancelled, nothing saved');
    expect(cancelled.queryByTestId('forecast')).toBeNull();

    const eta = within(screen.getByTestId('history-cs-0812-eta'));
    expect(eta.getByTestId('forecast').textContent).toBe('Moved no forecast.');
    // Confirming a job says nothing about forecasts.
    expect(within(screen.getByTestId('history-cs-0915-park')).queryByTestId('forecast')).toBeNull();
    // Newest first.
    const ids = screen.getAllByTestId(/^history-cs-/).map((e) => e.getAttribute('data-testid'));
    expect(ids[0]).toBe('history-cs-0916-cancel');
  });

  it('filters by job', async () => {
    show(<HistoryScreen jobId="beatty" />);
    await screen.findByTestId('history-cs-0915-tiler');
    const ids = screen.getAllByTestId(/^history-cs-/).map((e) => e.getAttribute('data-testid'));
    expect(ids).toEqual(['history-cs-0915-tiler', 'history-cs-0908-beatty']);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Changes at Beatty St');
  });
});
