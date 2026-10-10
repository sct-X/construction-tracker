// @vitest-environment jsdom
/** Stage 4a on the mock layer (today Thu 17 Sep 2026): the design-job redirect and the shell. Program, step and checklist moved to stage6c.test.tsx. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createMockDashboard } from '@ct/core';
import { DataProvider } from '../data/DataContext';
import type { DataLayer } from '../data/layer';
import { App } from '../app/App';
import { JobOverviewScreen } from './JobOverview';

function layer(): DataLayer {
  const { api, dev } = createMockDashboard();
  return { mode: 'mock', api, dev };
}
function show(ui: React.ReactElement) {
  return render(<DataProvider layer={layer()}>{ui}</DataProvider>);
}

beforeEach(() => {
  window.location.hash = '';
});
afterEach(cleanup);

describe('job overview (the v1 first page is tested in overview.test.tsx)', () => {
  it('a design job opens its checklist instead', async () => {
    window.location.hash = '#/jobs/west-st';
    show(<JobOverviewScreen jobId="west-st" />);
    await screen.findByText(() => window.location.hash === '#/jobs/west-st/checklist').catch(() => null);
    expect(window.location.hash).toBe('#/jobs/west-st/checklist');
  });
});

describe('shell', () => {
  it('a build job gets the job bar with its tabs, the current one marked', async () => {
    window.location.hash = '#/jobs/park-rd/program';
    show(<App />);
    const bar = await screen.findByTestId('job-bar');
    const tabs = within(within(bar).getByRole('navigation', { name: 'Park Rd pages' })).getAllByRole('link');
    expect(tabs.map((t) => t.textContent)).toEqual(['Overview', 'Program', 'Waiting on', 'Shipments', 'Photos', 'Notes']);
    expect(tabs[1]!.getAttribute('aria-current')).toBe('page');
    expect(document.title).toContain('Park Rd');
  });

  it('step detail sits under the Program tab; a design job has Checklist and Waiting on', async () => {
    window.location.hash = '#/jobs/park-rd/steps/pr-install-windows';
    const r = show(<App />);
    const bar = await screen.findByTestId('job-bar');
    expect(within(within(bar).getByRole('navigation')).getByRole('link', { name: 'Program' }).getAttribute('aria-current')).toBe('page');
    expect(within(bar).getByTestId('back').textContent).toBe('Program');
    r.unmount();
    window.location.hash = '#/jobs/west-st/checklist';
    show(<App />);
    const bar2 = await screen.findByTestId('job-bar');
    expect(within(within(bar2).getByRole('navigation')).getAllByRole('link').map((t) => t.textContent)).toEqual(['Checklist', 'Waiting on']);
    // The back link names where it goes.
    expect(within(bar2).getByTestId('back').textContent).toBe('Overview');
  });

  it('the job switcher keeps the tab', async () => {
    window.location.hash = '#/jobs/park-rd/program';
    show(<App />);
    fireEvent.click(await screen.findByTestId('job-switcher'));
    const menu = await screen.findByRole('listbox', { name: 'Switch job' });
    // Builds then Design; the current job checked; overdue counts in words.
    expect(within(menu).getByTestId('job-switcher-park-rd').getAttribute('aria-selected')).toBe('true');
    expect(within(menu).getByTestId('job-switcher-park-rd').textContent).toContain('(4 overdue)');
    expect(within(menu).getAllByRole('group').map((g) => g.dataset.group)).toEqual(['Builds', 'Design']);
    fireEvent.click(within(menu).getByTestId('job-switcher-beatty'));
    expect(window.location.hash).toBe('#/jobs/beatty/program');
  });

  it('the job switcher works from the keyboard: arrows, type-ahead and Enter', async () => {
    window.location.hash = '#/jobs/park-rd';
    show(<App />);
    const btn = await screen.findByTestId('job-switcher');
    fireEvent.keyDown(btn, { key: 'ArrowDown' });
    const menu = await screen.findByRole('listbox', { name: 'Switch job' });
    fireEvent.keyDown(menu, { key: 's' });
    fireEvent.keyDown(menu, { key: 'Enter' });
    expect(window.location.hash).toBe('#/jobs/seaview');
  });
});
