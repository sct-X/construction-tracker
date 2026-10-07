// @vitest-environment jsdom
/** Stage 4a screens on the mock layer (today Thu 17 Sep 2026): overview, program, step, checklist, shell. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { buildSeed, createMockDashboard, DEFAULT_TODAY, programView } from '@ct/core';
import { DataProvider } from '../data/DataContext';
import type { DataLayer } from '../data/layer';
import { App } from '../app/App';
import { JobOverviewScreen } from './JobOverview';
import { lookAheadGroups, ProgramScreen } from './Program';
import { StepDetailScreen } from './StepDetail';
import { DesignChecklistScreen } from './DesignChecklist';
import { MondayScreen } from './Monday';

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

describe('job overview', () => {
  it('Park Rd: finish, slip, holding cost, next hold point, top five waiting-on', async () => {
    show(<JobOverviewScreen jobId="park-rd" />);
    expect((await screen.findByTestId('ov-finish')).textContent).toBe('Fri 26 Feb 2027');
    expect(screen.getByTestId('ov-slip').textContent).toBe('On track');
    expect(screen.getByTestId('ov-slip-cost').textContent).toBe('Nothing this week');
    expect(screen.getByTestId('overview-hero').textContent).toContain('$4,500 a week to hold');
    expect(screen.getAllByTestId('ov-waiting-row')).toHaveLength(5);
    expect(screen.getByTestId('ov-hold').textContent).toContain('Stormwater inspection');
    expect(screen.getByTestId('ov-shipments').textContent).toContain('Park Rd windows');
    expect(screen.getByTestId('ov-stages').textContent).toContain('Lock-up');
  });

  it('Beatty St: +5 days, $1,430, amber in words', async () => {
    show(<JobOverviewScreen jobId="beatty" />);
    expect((await screen.findByTestId('ov-slip')).textContent).toBe('+5 days');
    expect(screen.getByTestId('ov-slip-cost').textContent).toBe('$1,430');
    expect(screen.getByTestId('ov-freshness').textContent).toBe('Not confirmed for 9 days');
  });

  it('a design job opens its checklist instead', async () => {
    window.location.hash = '#/jobs/west-st';
    show(<JobOverviewScreen jobId="west-st" />);
    await screen.findByText(() => window.location.hash === '#/jobs/west-st/checklist').catch(() => null);
    expect(window.location.hash).toBe('#/jobs/west-st/checklist');
  });
});

describe('program', () => {
  it('Beatty St Gantt: late steps carry "7 days late" in words, done stages summarised', async () => {
    show(<ProgramScreen jobId="beatty" />);
    const gantt = await screen.findByTestId('gantt');
    const tiling = within(gantt).getByTestId('g-step-bt-tiling');
    expect(tiling.textContent).toContain('7 days late');
    expect(tiling.className).toContain('is-late');
    // Row dates carry the weekday: "Mon 5 Oct to Fri 16 Oct, planned Mon 28 Sep to ...".
    const day = '(Mon|Tue|Wed|Thu|Fri) \\d{1,2} [A-Z][a-z]{2}';
    expect(tiling.querySelector('.g-dates')!.textContent).toMatch(new RegExp(`^${day} to ${day}, planned ${day} to ${day}`));
    expect(screen.getByTestId('gantt-done').textContent).toContain('Demolition');
    expect(screen.getByTestId('program-sub').textContent).toContain('Fri 4 Dec 2026');
  });

  it('Late steps only, Next 3 weeks and Stages views', async () => {
    show(<ProgramScreen jobId="beatty" />);
    await screen.findByTestId('gantt');
    fireEvent.click(screen.getByRole('button', { name: 'Late steps only' }));
    expect(screen.queryByTestId('g-step-bt-roughin')).toBeNull();
    expect(screen.getByTestId('g-step-bt-finishes')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Next 3 weeks' }));
    const la = screen.getByTestId('lookahead');
    expect(within(la).getByRole('heading', { name: /This week/ })).toBeTruthy();
    expect(screen.queryByTestId('gantt')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Stages' }));
    expect(screen.getByTestId('stages-strip').textContent).toContain('Tiling, whole stage: 7 days late');
  });

  it('look-ahead groups Park Rd by week and lists hold points', () => {
    const { groups } = lookAheadGroups(programView(buildSeed(), 'park-rd', DEFAULT_TODAY));
    expect(groups.map((g) => g.week.label)).toEqual(['This week', 'Next week', 'Week after']);
    expect(groups[0]!.steps.map((s) => s.stepId)).toEqual(expect.arrayContaining(['pr-roof-plumbing', 'pr-cladding']));
    expect(groups[1]!.steps.map((s) => s.stepId)).toContain('pr-stormwater');
  });

  it('look-ahead shows what each step needs that is not confirmed', async () => {
    show(<ProgramScreen jobId="park-rd" />);
    await screen.findByTestId('gantt');
    fireEvent.click(screen.getByRole('button', { name: 'Next 3 weeks' }));
    const sw = screen.getByTestId('la-step-pr-stormwater');
    expect(sw.textContent).toContain('Stormwater connection approval: ordered or booked');
    expect(sw.textContent).toContain('Mon 21 Sep to Fri 9 Oct, 15 working days');
  });
});

describe('step detail', () => {
  it('Seaview slab inspection: hold point, 1 of 3 categories, the empty ones named', async () => {
    show(<StepDetailScreen jobId="seaview" stepId="sv-slab-insp" />);
    const hold = await screen.findByTestId('hold-point');
    expect(hold.textContent).toContain('1 of 3 required categories have photos');
    expect(hold.textContent).toContain('Plumbing under slab; Membrane and termite barrier');
    const cats = within(hold).getAllByTestId('hold-category');
    expect(cats.map((c) => c.textContent)).toEqual([
      expect.stringContaining('4 photos'),
      expect.stringContaining('No photos yet'),
      expect.stringContaining('No photos yet'),
    ]);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Slab inspection before pour');
  });

  it('Park Rd install windows: planned vs forecast, needs with needed-by, act-by and expected', async () => {
    show(<StepDetailScreen jobId="park-rd" stepId="pr-install-windows" />);
    expect((await screen.findByTestId('step-forecast')).textContent).toBe('Mon 2 Nov to Fri 13 Nov');
    expect(screen.getByTestId('step-planned').textContent).toBe('Mon 2 Nov to Fri 13 Nov');
    const win = screen.getByTestId('need-it-pr-windows');
    expect(win.textContent).toContain('Mon 2 Nov');
    expect(win.textContent).toContain('Mon 10 Aug');
    expect(win.textContent).toContain('Mon 26 Oct');
    expect(win.textContent).toContain('from Park Rd windows');
    expect(screen.getByTestId('waits-for').textContent).toContain('External cladding');
    expect(screen.getByTestId('holds-up').textContent).toContain('External doors');
  });
});

describe('design checklist', () => {
  it('West St: stages as a checklist, 2 outstanding items with ages under the current stage', async () => {
    show(<DesignChecklistScreen jobId="west-st" />);
    expect((await screen.findByTestId('ck-outstanding')).textContent).toBe('2 items');
    expect(screen.getByTestId('ck-oldest').textContent).toBe('23 days');
    const current = screen.getByTestId('ck-stage-2');
    expect(current.textContent).toContain('With council');
    expect(current.textContent).toContain('Current stage');
    const items = within(current).getAllByTestId('ck-item');
    expect(items[0]!.textContent).toContain('23 days');
    expect(items[0]!.textContent).toContain('Fire engineering report');
    expect(screen.getByTestId('ck-stage-1').textContent).toContain('Done');
  });
});

describe('shell', () => {
  it('a build job gets the job bar with its tabs, the current one marked', async () => {
    window.location.hash = '#/jobs/park-rd/program';
    show(<App />);
    const bar = await screen.findByTestId('job-bar');
    const tabs = within(within(bar).getByRole('navigation', { name: 'Park Rd pages' })).getAllByRole('link');
    expect(tabs.map((t) => t.textContent)).toEqual(['Overview', 'Program', 'Waiting on', 'Photos', 'Notes']);
    expect(tabs[1]!.getAttribute('aria-current')).toBe('page');
    expect(document.title).toContain('Park Rd');
  });

  it('step detail sits under the Program tab; a design job has Checklist and Waiting on', async () => {
    window.location.hash = '#/jobs/park-rd/steps/pr-install-windows';
    const r = show(<App />);
    const bar = await screen.findByTestId('job-bar');
    expect(within(bar).getByRole('link', { name: 'Program' }).getAttribute('aria-current')).toBe('page');
    r.unmount();
    window.location.hash = '#/jobs/west-st/checklist';
    show(<App />);
    const bar2 = await screen.findByTestId('job-bar');
    expect(within(bar2).getAllByRole('link').map((t) => t.textContent)).toEqual(['Checklist', 'Waiting on']);
  });

  it('the job switcher keeps the tab', async () => {
    window.location.hash = '#/jobs/park-rd/program';
    show(<App />);
    const sel = (await screen.findByTestId('job-switcher')) as HTMLSelectElement;
    fireEvent.change(sel, { target: { value: 'beatty' } });
    expect(window.location.hash).toBe('#/jobs/beatty/program');
  });
});

describe('Monday leftovers', () => {
  it('the act-by heading reads with a space before the date; design rows show only DA or CDC', async () => {
    show(<MondayScreen />);
    const sv = await screen.findByTestId('build-row-seaview');
    expect(within(sv).getByRole('heading', { name: /^Act by this week for Seaview St to Thu 24 Sep$/ })).toBeTruthy();
    const john = screen.getByTestId('design-row-john-st');
    expect(john.textContent).toContain('DA');
    expect(john.textContent).not.toContain('council');
  });
});

describe('stage 4 review fixes', () => {
  it('overview: an overdue row says so in words (the same words as Waiting on)', async () => {
    show(<JobOverviewScreen jobId="park-rd" />);
    await screen.findByTestId('ov-finish');
    const rows = screen.getAllByTestId('ov-waiting-row');
    for (const r of rows.filter((x) => x.dataset.urgency !== 'none')) {
      expect(within(r).getByTestId('urgency').textContent).toMatch(/overdue|passed|after it's needed/);
    }
    const cladders = rows.find((r) => r.textContent?.includes('Book cladders'))!;
    expect(within(cladders).getByTestId('urgency').textContent).toBe('1 day overdue');
  });

  it("step detail: the call link names the trade", async () => {
    show(<StepDetailScreen jobId="park-rd" stepId="pr-install-windows" />);
    const row = await screen.findByTestId('need-it-pr-window-installer');
    expect(within(row).getByRole('link').textContent).toMatch(/^Call\s*ClearView Window Installs\s*0491 575 789$/);
  });

  it('axis month labels never overlap or run past the edge', async () => {
    const { makeScale, monthLabels } = await import('../components/Timeline');
    for (const [from, to, width] of [
      ['2025-10-20', '2026-12-04', 700],
      ['2026-09-07', '2026-12-04', 300],
      ['2026-06-01', '2027-02-26', 360],
      ['2026-08-31', '2027-02-26', 700],
    ] as const) {
      const labels = monthLabels(makeScale(from, to), width);
      labels.forEach((l, i) => {
        const w = l.label.length * 7.6 + 8;
        expect(l.left + w).toBeLessThanOrEqual(width + 0.01);
        if (i) expect(l.left).toBeGreaterThanOrEqual(labels[i - 1]!.left + labels[i - 1]!.label.length * 7.6 + 8);
      });
      expect(labels[0]!.label).toMatch(/\d{4}$/);
    }
  });
});
