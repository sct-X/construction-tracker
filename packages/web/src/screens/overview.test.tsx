// @vitest-environment jsdom
/**
 * Stage 6a: the Overview (home), the job first page, Waiting on and Shipments
 * in the v1 look, on the mock layer (today Thu 17 Sep 2026). Timing first: no
 * finish, slip or money anywhere; red only for overdue; freshness in words.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createMockDashboard } from '@ct/core';
import { DataProvider } from '../data/DataContext';
import type { DataLayer } from '../data/layer';
import { OverviewScreen } from './Overview';
import { JobOverviewScreen } from './JobOverview';
import { WaitingOnScreen } from './WaitingOn';
import { ShipmentsScreen } from './Shipments';
import { shortRelative, whenWords } from '../ui/when';

function layer(): DataLayer {
  const { api, dev } = createMockDashboard();
  return { mode: 'mock', api, dev };
}
function show(ui: React.ReactElement) {
  return render(<DataProvider layer={layer()}>{ui}</DataProvider>);
}
afterEach(cleanup);

const MONEY_OR_FINISH = /\$|Forecast finish|slip|Fri 26 Feb 2027|Why it moved/i;

describe("Overview: v1's final card (Dom's D8/D9)", () => {
  it('each card has only the name, the stage bar, the stage and the overdue cue; the card opens the job', async () => {
    show(<OverviewScreen />);
    const parkEl = await screen.findByTestId('overview-card-park-rd');
    const park = within(parkEl);
    expect(parkEl.tagName).toBe('A');
    expect(parkEl.getAttribute('href')).toBe('#/jobs/park-rd');
    expect(park.getByText('Park Rd')).toBeTruthy();
    expect(park.getByTestId('card-stage').textContent).toBe('Lock-up');
    expect(park.getByTestId('card-overdue').textContent).toBe('!4 overdue');
    expect(park.getByTestId('card-bar').getAttribute('aria-label')).toBe('Stage 5 of 8, Lock-up');
    expect(park.getByTestId('card-bar').querySelectorAll('[data-state="current"]')).toHaveLength(1);
    // No next steps, waiting-on items or freshness on the card: the job page holds the detail.
    expect(parkEl.textContent).toBe('Park Rd' + 'Lock-up' + '!4 overdue');
    expect(screen.getByTestId('overview-builds').textContent).not.toMatch(MONEY_OR_FINISH);
  });

  it('red only for overdue: Seaview "!1 overdue", Beatty "Nothing overdue" in plain words', async () => {
    show(<OverviewScreen />);
    const sea = within(await screen.findByTestId('overview-card-seaview'));
    expect(sea.getByTestId('card-overdue').textContent).toBe('!1 overdue');
    expect(sea.getByTestId('card-overdue').className).toContain('status--late');
    const beatty = within(screen.getByTestId('overview-card-beatty'));
    expect(beatty.getByTestId('card-overdue').textContent).toBe('Nothing overdue');
    expect(beatty.getByTestId('card-overdue').className).not.toContain('status--late');
    expect(beatty.getByTestId('card-stage').textContent).toBe('Rough-in');
  });

  it('builds in the side order, design jobs by oldest outstanding, With council reads Pending approval', async () => {
    show(<OverviewScreen />);
    await screen.findByTestId('overview-card-park-rd');
    const ids = (group: string) => within(screen.getByTestId(group)).getAllByTestId(/^overview-card-/).map((c) => c.getAttribute('data-testid'));
    expect(ids('overview-builds')).toEqual(['overview-card-park-rd', 'overview-card-seaview', 'overview-card-beatty']);
    expect(ids('overview-design')).toEqual(['overview-card-west-st', 'overview-card-tollbar', 'overview-card-john-st', 'overview-card-lower-beach']);
    expect(within(screen.getByTestId('overview-card-west-st')).getByTestId('card-stage').textContent).toBe('Pending approval');
  });
});

describe('job first page', () => {
  it('Park Rd: progress, the next hold point, four overdue items and the trades on this week', async () => {
    show(<JobOverviewScreen jobId="park-rd" />);
    expect((await screen.findByTestId('job-stage')).textContent).toBe('Lock-up');
    expect(screen.getByTestId('job-stage-of').textContent).toBe('Stage 5 of 8');
    expect(screen.getByTestId('job-next-hold').textContent).toContain('Stormwater inspection');
    expect(screen.getByTestId('job-next-hold').textContent).toContain('Mon 12 Oct, in 3 weeks');
    expect(screen.getByTestId('job-overdue-count').textContent).toBe('4');
    expect(screen.getByTestId('job-overdue-it-pr-tile-choice').textContent).toContain('Act by Mon 14 Sep, overdue by 3 days');
    expect(screen.getByTestId('job-trades').textContent).toContain('Stormwater drainage');
    expect(screen.getByTestId('job-trades').textContent).toContain('Mon 21 Sep, in 4 days');
    expect(screen.getByTestId('job-fresh').textContent).toBe('Last confirmed 2 days ago');
    expect(document.body.textContent).not.toMatch(MONEY_OR_FINISH);
  });

  it('Beatty St: nothing overdue, said once', async () => {
    show(<JobOverviewScreen jobId="beatty" />);
    expect((await screen.findByTestId('job-overdue-none')).textContent).toBe('Nothing overdue');
    expect(screen.getByTestId('job-fresh').textContent).toBe('Not confirmed for 9 days');
  });
});

describe('Waiting on: one list with Call buttons (To chase merged in)', () => {
  it('groups Overdue, This week and Later; Later is folded; Call names the trade', async () => {
    show(<WaitingOnScreen />);
    const overdue = await screen.findByTestId('waiting-group-overdue');
    expect(overdue.getAttribute('data-count')).toBe('5');
    expect(screen.getByTestId('waiting-group-this_week').getAttribute('data-count')).toBe('3');
    const later = screen.getByTestId('waiting-group-later');
    expect(later.getAttribute('data-count')).toBe('39');
    expect(later.tagName).toBe('DETAILS');
    expect((later as HTMLDetailsElement).open).toBe(false);
    expect(screen.getByTestId('waiting-sub').textContent).toBe('47 to act on, 5 overdue');
    const pump = within(screen.getByTestId('waiting-row-it-sv-pump'));
    const call = pump.getByTestId('call');
    expect(call.getAttribute('href')).toBe('tel:0491570157');
    expect(call.textContent).toBe('Call Northern Concrete Pumping');
    expect(call.getAttribute('aria-label')).toBe('Call Northern Concrete Pumping, 0491 570 157');
    expect(pump.getByTestId('when').textContent).toBe('Act by Fri 18 Sep, tomorrow');
    const steel = within(screen.getByTestId('waiting-row-it-sv-slab-steel'));
    expect(steel.getByTestId('when').textContent).toBe('!Needed Mon 14 Sep, overdue by 3 days');
  });

  it('Mine narrows to Dominic\'s own items', async () => {
    show(<WaitingOnScreen />);
    await screen.findByTestId('waiting-row-it-sv-pump');
    fireEvent.click(screen.getByTestId('waiting-owner-me'));
    expect(screen.queryByTestId('waiting-row-it-sv-pump')).toBeNull();
    expect(screen.getByTestId('waiting-row-it-pr-glazing-cert')).toBeTruthy();
  });

  it('inside one job there is no job menu and no job name on the rows', async () => {
    show(<WaitingOnScreen jobId="beatty" />);
    const tiler = await screen.findByTestId('waiting-row-it-bt-tiler');
    expect(screen.queryByTestId('job-picker')).toBeNull();
    expect(tiler.textContent).not.toContain('Beatty St ·');
  });
});

describe('Shipments inside the job', () => {
  it('Park Rd shows only its windows: in production, 26 Oct 2026, ETA 1 week before needed, 3 items; no Job column', async () => {
    show(<ShipmentsScreen jobId="park-rd" />);
    const row = within(await screen.findByTestId('shipment-row-sh-pr-windows'));
    expect(screen.queryByTestId('shipment-row-sh-sv-windows')).toBeNull();
    expect(row.getByTestId('ship-status').textContent).toBe('In production');
    expect(row.getByTestId('eta').textContent).toBe('26 Oct 2026');
    expect(row.getByTestId('timing').textContent).toBe('ETA 1 week before needed');
    expect(row.getByTestId('linked-items').textContent).toBe('3 items');
    expect(row.queryByTestId('ship-job')).toBeNull();
  });
});

describe('date words', () => {
  it('carry relative time; overdue only for a deadline still open', () => {
    expect(shortRelative('2026-09-21', '2026-09-17')).toBe('Mon 21 Sep, in 4 days');
    expect(shortRelative('2026-08-10', '2026-09-17', { deadline: true })).toBe('Mon 10 Aug, overdue by 5 weeks');
    const base = { status: 'ordered_or_booked' as const, actBy: '2026-09-07', neededBy: '2026-09-28', expected: '2026-10-05', isLate: true, lateText: '7 days after needed', overdue: false };
    expect(whenWords(base, '2026-09-17')).toEqual({ text: 'Expected Mon 5 Oct, in 2 weeks, 7 days after needed', tone: 'plain' });
  });
});
