// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { createMockDashboard } from '@ct/core';
import { DataProvider } from '../data/DataContext';
import type { DataLayer } from '../data/layer';
import { MondayScreen } from './Monday';
import { JobsScreen } from './Jobs';

function layer(): DataLayer {
  const { api, dev } = createMockDashboard();
  return { mode: 'mock', api, dev };
}

afterEach(cleanup);

async function row(id: string) {
  return within(await screen.findByTestId(id));
}

describe('Monday screen (mock layer, today Thu 17 Sep 2026)', () => {
  it('shows each build finish, slip in words and slip cost', async () => {
    render(
      <DataProvider layer={layer()}>
        <MondayScreen />
      </DataProvider>,
    );
    const park = await row('build-row-park-rd');
    expect(park.getByTestId('finish').textContent).toBe('Fri 26 Feb 2027');
    expect(park.getByTestId('slip').textContent).toBe('On track');
    expect(park.getByTestId('slip-cost').textContent).toBe('Nothing this week');
    expect(park.getByTestId('slip-cost').className).not.toContain('num');

    const seaview = await row('build-row-seaview');
    expect(seaview.getByTestId('finish').textContent).toBe('Fri 29 Oct 2027');
    expect(seaview.getByTestId('slip').textContent).toBe('On track');
    expect(seaview.getByTestId('act-by').textContent).toContain('Book concrete pump');
    expect(seaview.getByTestId('act-by').textContent).toContain('Act by Fri 18 Sep, tomorrow');

    const beatty = await row('build-row-beatty');
    expect(beatty.getByTestId('finish').textContent).toBe('Fri 4 Dec 2026');
    expect(beatty.getByTestId('slip').textContent).toBe('+5 days');
    expect(beatty.getByText('Later than Mon 14 Sep')).toBeTruthy();
    expect(beatty.getByTestId('slip-cost').textContent).toBe('$1,430');
    const fresh = beatty.getByTestId('freshness');
    expect(fresh.textContent).toBe('Not confirmed for 9 days');
    expect(fresh.getAttribute('data-amber')).toBe('true');
  });

  it('puts the costliest build first and traces Beatty St\'s slip', async () => {
    render(
      <DataProvider layer={layer()}>
        <MondayScreen />
      </DataProvider>,
    );
    await screen.findByTestId('build-row-beatty');
    const ids = screen.getAllByTestId(/^build-row-/).map((e) => e.getAttribute('data-testid'));
    expect(ids[0]).toBe('build-row-beatty');

    const why = within(screen.getByTestId('why-it-moved'));
    const cause = why.getByTestId('why-cause').textContent ?? '';
    expect(cause).toContain('+7 days');
    expect(cause).toContain('Book tiler, expected date');
    expect(cause).toContain('Mon 28 Sep → Mon 5 Oct');
    expect(cause).toContain('Finish Fri 27 Nov → Fri 4 Dec');
    expect(cause).toContain('Harbour Tiling');
    expect(cause).toContain('Voice note on Telegram');
    expect(why.getByTestId('why-leftover').textContent).toContain('2 days earlier for reasons not in the change log');
    expect(why.getByRole('heading', { name: /^Why it moved\s*for Beatty St$/ })).toBeTruthy();
    // Only slipping jobs get a why-it-moved block.
    expect(screen.getAllByTestId('why-it-moved')).toHaveLength(1);
  });

  it('groups design jobs by stage with outstanding count and oldest age', async () => {
    render(
      <DataProvider layer={layer()}>
        <MondayScreen />
      </DataProvider>,
    );
    const west = await row('design-row-west-st');
    expect(west.getByTestId('outstanding').textContent).toBe('2 items');
    expect(west.getByTestId('oldest').textContent).toBe('23 days');
    expect((await row('design-row-tollbar')).getByTestId('oldest').textContent).toBe('8 days');
    expect((await row('design-row-lower-beach')).getByTestId('outstanding').textContent).toBe('Nothing');
    expect((await row('design-row-john-st')).getByTestId('oldest').textContent).toBe('4 days');
    expect(screen.getByRole('columnheader', { name: /With council/ })).toBeTruthy();
  });

  it('shows a Monday slip after the ETA change, from the same data layer', async () => {
    const mock = createMockDashboard();
    // A day-to-day change the bot would make (the web never does): Park Rd windows to 16 Nov.
    const { runOperation } = await import('@ct/core');
    const r = runOperation(mock.store.load(), 'set_shipment_eta', { shipment: 'sh-pr-windows', eta: '2026-11-16' }, { today: '2026-09-17', now: mock.clock.now() });
    if (r.kind !== 'proposal') throw new Error('expected a proposal');
    mock.store.applyChangeSet({ summary: r.summary, opName: r.op, opArgs: r.args, changes: r.changes });
    render(
      <DataProvider layer={{ mode: 'mock', api: mock.api, dev: mock.dev }}>
        <MondayScreen />
      </DataProvider>,
    );
    const park = await row('build-row-park-rd');
    expect(park.getByTestId('finish').textContent).toBe('Fri 12 Mar 2027');
    expect(park.getByTestId('slip').textContent).toBe('+14 days');
    expect(park.getByTestId('slip-cost').textContent).toBe('$9,000');
    expect(park.getByTestId('why-cause').textContent).toContain('Park Rd windows, ETA Mon 26 Oct → Mon 16 Nov');
  });
});

describe('Jobs screen', () => {
  it('lists every live job with kind, stage, finish and freshness', async () => {
    render(
      <DataProvider layer={layer()}>
        <JobsScreen />
      </DataProvider>,
    );
    const beatty = await row('job-row-beatty');
    expect(screen.getAllByTestId(/^job-row-/)).toHaveLength(7);
    expect(beatty.getByTestId('slip').textContent).toBe('5 days later');
    expect(within(screen.getByTestId('jobs-group-builds')).getByTestId('job-row-beatty')).toBeTruthy();
    expect(beatty.getByTestId('finish').textContent).toBe('Fri 4 Dec 2026');
    expect(beatty.getByTestId('freshness').textContent).toBe('Not confirmed for 9 days');
    expect(within(screen.getByTestId('jobs-group-design')).getByTestId('job-row-west-st').textContent).toContain('No program while in design');
  });
});
