// @vitest-environment jsdom
/**
 * Stage 6c: Program (desktop Gantt, phone look-ahead and stages), Step detail and the
 * Design checklist in the v1 look, on the mock layer (today Thu 17 Sep 2026 unless
 * said). Timing only (no finish, slip or $); red only for what is overdue, in words.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { buildSeed, createMockDashboard, type WaitingRow } from '@ct/core';
import { DataProvider } from '../data/DataContext';
import type { DataLayer } from '../data/layer';
import { App } from '../app/App';
import { ProgramScreen } from './Program';
import { StepDetailScreen } from './StepDetail';
import { DesignChecklistScreen } from './DesignChecklist';
import { needLines } from '../components/gantt/LookAhead';
import { makeTimeScale } from '../components/gantt/timeScale';

function layer(today?: string): DataLayer {
  const { api, dev } = today ? createMockDashboard(buildSeed(), today) : createMockDashboard();
  return { mode: 'mock', api, dev };
}
function show(ui: React.ReactElement, today?: string) {
  return render(<DataProvider layer={layer(today)}>{ui}</DataProvider>);
}

/** jsdom has no matchMedia: the phone width is stubbed per test. */
function phoneWidth(on: boolean) {
  if (!on) {
    // @ts-expect-error test stub
    delete window.matchMedia;
    return;
  }
  window.matchMedia = ((q: string) => ({
    matches: q.includes('max-width'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  window.location.hash = '';
});
afterEach(() => {
  cleanup();
  phoneWidth(false);
});

const BANNED = ['$', 'Forecast finish', 'finish moves', 'Slip', 'Why it moved'];
const noMoney = (el: HTMLElement) => BANNED.forEach((b) => expect(el.textContent).not.toContain(b));

describe('program: the desktop Gantt (v1)', () => {
  it('Park Rd: stage rows, step bars with their dates in words, hold point, legend, Edit program', async () => {
    show(<ProgramScreen jobId="park-rd" />);
    const gantt = await screen.findByTestId('gantt');
    expect(screen.getByTestId('program-sub').textContent).toBe('Lock-up. Every step on plan.');
    expect(within(gantt).getByTestId('gantt-stage-pr-st-lockup').textContent).toBe('Lock-up');
    const win = within(gantt).getByTestId('g-step-pr-install-windows');
    expect(win.textContent).toContain('Mon 2 Nov to Fri 13 Nov, starts in 6 weeks.');
    expect(win.textContent).toContain('Waits for External cladding.');
    expect(within(win).getByRole('link').getAttribute('href')).toBe('#/jobs/park-rd/steps/pr-install-windows');
    expect(within(gantt).getByTestId('g-step-pr-stormwater-insp').textContent).toContain('hold point');
    expect(screen.getByTestId('gantt-caption').textContent).toBe('ForecastPlannedHold pointToday');
    expect(screen.getByTestId('gantt-today')).toBeTruthy();
    expect(screen.getByTestId('program-edit').getAttribute('href')).toBe('#/setup/programs/park-rd');
    expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true');
    noMoney(screen.getByTestId('program'));
  });

  it('hovering a bar names the step in the caption', async () => {
    show(<ProgramScreen jobId="park-rd" />);
    await screen.findByTestId('gantt');
    fireEvent.mouseEnter(screen.getByTestId('gantt-bar-pr-install-windows'));
    expect(screen.getByTestId('gantt-caption').textContent).toBe('Install windows. Mon 2 Nov to Fri 13 Nov, starts in 6 weeks. Waits for External cladding.');
  });

  it('Beatty: late stage bars say "7 days late" in plain words while both dates are ahead; Late only and Look-ahead', async () => {
    show(<ProgramScreen jobId="beatty" />);
    const gantt = await screen.findByTestId('gantt');
    expect(screen.getByTestId('program-sub').textContent).toBe('Rough-in. 3 steps later than planned.');
    const tiling = within(gantt).getByTestId('g-step-bt-tiling');
    expect(tiling.dataset.overdue).toBe('false');
    const late = within(tiling).getByTestId('gantt-late-bt-tiling');
    expect(late.textContent).toBe('7 days late');
    expect(late.querySelector('.status')!.getAttribute('data-tone')).toBe('plain');

    fireEvent.click(screen.getByRole('button', { name: 'Late only' }));
    expect(screen.queryByTestId('g-step-bt-roughin')).toBeNull();
    expect(screen.getByTestId('g-step-bt-finishes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Look-ahead' }));
    expect(screen.getByTestId('g-step-bt-roughin')).toBeTruthy();
    expect(screen.queryByTestId('g-step-bt-handover')).toBeNull();
  });

  it("Dom's cue: on Wed 30 Sep tiling is past its planned start and not started, so its late words are red with a '!'", async () => {
    show(<ProgramScreen jobId="beatty" />, '2026-09-30');
    const tiling = await screen.findByTestId('g-step-bt-tiling');
    expect(tiling.dataset.overdue).toBe('true');
    const status = within(tiling).getByTestId('gantt-late-bt-tiling').querySelector('.status')!;
    expect(status.getAttribute('data-tone')).toBe('late');
    expect(status.textContent).toBe('!7 days late');
  });

  it('the axis starts on a Monday a week before the first date and labels the first month with its year', () => {
    const s = makeTimeScale({ dates: ['2026-09-16', '2026-11-13'], today: '2026-09-17', shutdowns: [{ from: '2026-12-21', to: '2027-01-08' }] });
    expect(s.from).toBe('2026-09-07');
    expect(s.months[0]!.label).toBe('Sep 2026');
    expect(s.months[1]!.label).toBe('Oct');
    expect(s.weeks[0]).toEqual({ date: '2026-09-07', x: 0, label: '7' });
    expect(s.shutdowns).toEqual([]);
    expect(s.span('2026-09-14', '2026-09-20')).toBe(35);
  });
});

describe('program: the phone (stages strip, look-ahead, stages list)', () => {
  it('Park Rd opens on the look-ahead with v1 lines and needs in words; Full program shows the Gantt', async () => {
    phoneWidth(true);
    show(<ProgramScreen jobId="park-rd" />);
    const la = await screen.findByTestId('lookahead');
    expect(screen.queryByTestId('gantt')).toBeNull();
    expect(screen.queryByTestId('program-edit')).toBeNull();
    expect(within(la).getByTestId('lookahead-week-1').textContent).toBe('This week14-18 Sep');
    expect(within(la).getByTestId('la-step-pr-roof-plumbing').textContent).toContain('Mon to Thu, Roof plumber, started');
    const sw = within(la).getByTestId('la-step-pr-stormwater');
    expect(sw.textContent).toContain('From Mon, 3 wks, Plumber');
    expect(sw.textContent).toContain('needs stormwater connection approval, ordered or booked, not confirmed');
    expect(within(la).getByTestId('lookahead-later').textContent).toBe('Laterafter Sun 4 Oct');
    expect(within(la).getByTestId('lookahead-more').textContent).toContain('Show 14 steps');

    const strip = screen.getByTestId('stages-strip');
    expect(within(strip).getByTestId('stage-chip-pr-st-lockup').getAttribute('aria-current')).toBe('true');
    expect(within(strip).getByTestId('stage-chip-pr-st-lockup').textContent).toBe('Lock-up3 Sep');
    expect(screen.getByTestId('stage-band-pr-st-lockup').textContent).toContain('In progress, week 3 of 12');
    expect(screen.getByTestId('stage-band-pr-st-external').textContent).toContain('Starts Mon 21 Sep, in 4 days');

    fireEvent.click(screen.getByRole('button', { name: 'Full program' }));
    expect(screen.getByTestId('gantt').className).toContain('gantt--dense');
    expect(screen.queryByTestId('lookahead')).toBeNull();
  });

  it('Beatty: the late steps further out are named under Later, and each stage band lists its late steps', async () => {
    phoneWidth(true);
    show(<ProgramScreen jobId="beatty" />);
    const later = await screen.findByTestId('la-step-bt-tiling');
    expect(later.textContent).toContain('moved to Mon 5 Oct, in 2 weeks, 7 days late');
    expect(screen.getByTestId('stage-band-bt-st-tiling').textContent).toContain('Tiling, whole stage: 7 days late, now Mon 5 Oct, in 2 weeks');
    noMoney(screen.getByTestId('program'));
  });

  it('needLines: overdue in red words, late in plain words, booked but not confirmed', () => {
    const base = { title: '', status: 'to_do', statusLabel: 'To do', actBy: null, neededBy: null, expected: null, isLate: false, lateText: null, overdue: false } as const;
    const rows = [
      { ...base, itemId: 'a', title: 'Book tiler', actBy: '2026-09-10', overdue: true },
      { ...base, itemId: 'b', title: 'Order tiles', status: 'ordered_or_booked', statusLabel: 'Ordered or booked', expected: '2026-10-05', neededBy: '2026-09-28', isLate: true, lateText: '7 days after needed' },
      { ...base, itemId: 'c', title: 'Order grout', status: 'ordered_or_booked', statusLabel: 'Ordered or booked' },
      { ...base, itemId: 'd', title: 'Waterproofer', status: 'confirmed', statusLabel: 'Confirmed' },
    ] as unknown as WaitingRow[];
    expect(needLines(rows, '2026-09-17')).toEqual([
      { itemId: 'a', text: 'needs tiler, act by Thu 10 Sep, overdue by 7 days', overdue: true },
      { itemId: 'b', text: 'needs tiles, expected Mon 5 Oct, in 2 weeks, 7 days after needed', overdue: false },
      { itemId: 'c', text: 'needs grout, ordered or booked, not confirmed', overdue: false },
    ]);
  });
});

describe('step detail (v1, read-only)', () => {
  it('Park Rd install windows: the two-figure readout, facts, order of work and needs in words', async () => {
    show(<StepDetailScreen jobId="park-rd" stepId="pr-install-windows" />);
    expect((await screen.findByTestId('step-forecast')).textContent).toBe('Mon 2 Nov to Fri 13 Nov');
    expect(screen.getByText('Forecast, starts in 6 weeks')).toBeTruthy();
    expect(screen.getByTestId('step-late').textContent).toBe('on plan');
    expect(screen.getByTestId('step-planned').textContent).toBe('Mon 2 Nov to Fri 13 Nov');
    expect(screen.getByTestId('step-duration').textContent).toBe('10 working days');
    expect(screen.getByTestId('step-status').textContent).toBe('Not started');
    expect(screen.queryByTestId('step-reason')).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: /Install windows/ })).toBeTruthy();
    expect(screen.getByText('Lock-up stage, Window installer')).toBeTruthy();
    expect(screen.getByText('Windows, order 12 wk ahead. Window installer, book 3 wk ahead')).toBeTruthy();
    expect(screen.getByTestId('waits-for').textContent).toBe('External cladding ends Tue 6 Oct, in 2 weeks');
    expect(screen.getByTestId('holds-up').textContent).toContain('External doors starts Mon 16 Nov');

    const win = screen.getByTestId('need-it-pr-windows');
    expect(win.textContent).toContain('Material');
    expect(win.textContent).toContain('waiting on Jade Coast Windows, with Raff');
    expect(win.textContent).toContain('Expected Mon 26 Oct, in 5 weeks');
    expect(win.dataset.overdue).toBe('false');
    // Overdue: red words with the "!", and Dominic's own item reads "with you".
    const cert = screen.getByTestId('need-it-pr-glazing-cert');
    expect(cert.dataset.overdue).toBe('true');
    expect(within(cert).getByTestId('when').getAttribute('data-tone')).toBe('late');
    expect(within(cert).getByTestId('when').textContent).toMatch(/^!Act by Mon 10 Aug, overdue by \d+ weeks$/);
    expect(cert.textContent).toContain('with you');
    // A trade with a phone: a Call glass button naming the trade, the number in its name.
    const call = within(screen.getByTestId('need-it-pr-window-installer')).getByRole('link');
    expect(call.textContent).toBe('Call ClearView Window Installs');
    expect(call.getAttribute('aria-label')).toBe('Call ClearView Window Installs, 0491 575 789');
    expect(call.getAttribute('href')).toBe('tel:0491575789');
    // Read-only: no buttons on the page.
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    noMoney(screen.getByTestId('step-detail'));
  });

  it('Seaview slab inspection: the hold point ledger, empty sets as "! none yet" on the neutral fill', async () => {
    show(<StepDetailScreen jobId="seaview" stepId="sv-slab-insp" />);
    const hold = await screen.findByTestId('hold-point');
    const ready = within(hold).getByTestId('hold-readiness');
    expect(ready.textContent).toBe('!1 of 3 required photo sets uploaded');
    expect(ready.getAttribute('data-tone')).toBe('note');
    expect(within(hold).getAllByTestId('hold-category').map((c) => c.textContent)).toEqual([
      'Steel reinforcement in place4 photos',
      'Plumbing under slab!none yet',
      'Membrane and termite barrier!none yet',
    ]);
    expect(within(hold).getByTestId('hold-photos').getAttribute('href')).toBe('#/jobs/seaview/photos');
    expect(screen.getByText('Slab stage, hold point, Certifier')).toBeTruthy();
    expect(screen.getByText('Forecast, starts in 11 days')).toBeTruthy();
  });

  it('a late step: "7 days late" beside the figure in plain words, and the calculator sentence says why', async () => {
    show(<StepDetailScreen jobId="beatty" stepId="bt-tiling" />);
    expect((await screen.findByTestId('step-late')).textContent).toBe('7 days late');
    expect(screen.getByTestId('step-late').getAttribute('data-tone')).toBe('plain');
    expect(screen.getByTestId('step-reason').textContent).toMatch(/\S/);
  });
});

describe('design checklist (v1, read-only)', () => {
  it('West St: the outstanding figure, freshness, the stage ladder with Pending approval and its items', async () => {
    show(<DesignChecklistScreen jobId="west-st" />);
    expect((await screen.findByTestId('ck-outstanding')).textContent).toBe('2 outstanding, oldest 23 days');
    expect(screen.getByTestId('ck-freshness').textContent).toBe('Last confirmed 3 days ago');
    expect(screen.getByTestId('ck-stage-1').textContent).toBe('DesignDone');
    const current = screen.getByTestId('ck-stage-2');
    expect(current.getAttribute('aria-current')).toBe('step');
    expect(within(current).getByTestId('ck-stage-words-2').textContent).toBe('Under way');
    expect(current.textContent).toContain('Pending approval');
    expect(current.textContent).not.toContain('With council');
    const items = within(current).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]!.textContent).toContain('Report');
    expect(items[0]!.textContent).toContain('Fire engineering report, revision B');
    expect(items[0]!.textContent).toContain('waiting on Firewise Engineering, with you');
    expect(items[0]!.textContent).toContain('outstanding 23 days');
    expect(items[1]!.textContent).toContain('outstanding 14 days');
    expect(screen.getByTestId('ck-stage-3').textContent).toBe('ApprovedNot started');
    expect(screen.getByTestId('ck-done').textContent).toContain('Done (3)');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('on Mon 28 Sep the items needed Fri 25 Sep with nothing still to come read overdue, in red words', async () => {
    show(<DesignChecklistScreen jobId="west-st" />, '2026-09-28');
    const current = await screen.findByTestId('ck-stage-2');
    const portal = within(current)
      .getAllByRole('listitem')
      .find((li) => li.textContent!.includes('planning portal'))!;
    expect(portal.dataset.overdue).toBe('true');
    expect(within(portal).getByTestId('when').textContent).toBe('!Needed Fri 25 Sep, overdue by 3 days');
  });
});

describe('in the shell: the job header is the only h1', () => {
  for (const [hash, h2] of [
    ['#/jobs/park-rd/program', /Program/],
    ['#/jobs/park-rd/steps/pr-install-windows', /Install windows/],
    ['#/jobs/west-st/checklist', /Checklist/],
  ] as const) {
    it(hash, async () => {
      window.location.hash = hash;
      show(<App />);
      await screen.findByTestId('job-bar');
      await screen.findByRole('heading', { level: 2, name: h2 });
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    });
  }
});
