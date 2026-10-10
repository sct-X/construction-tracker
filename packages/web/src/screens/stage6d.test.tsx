// @vitest-environment jsdom
/**
 * Stage 6d: Photos, Daily notes and Changes in the v1 look, on the mock layer (today Thu 17 Sep 2026).
 * Timing first: nothing here shows a finish, a slip or money.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createMockDashboard, type HistoryEntry } from '@ct/core';
import type { ReactElement } from 'react';
import { DataProvider } from '../data/DataContext';
import type { DataLayer } from '../data/layer';
import { PhotosScreen, neededBeforeWords, receivedWords, stageCountWords } from './Photos';
import { NotesScreen, groupByWeek, noteSourceWords, weekRange } from './Notes';
import { HistoryScreen, byDay, dayWords, statusWord } from './History';

function show(ui: ReactElement) {
  const { api, dev } = createMockDashboard();
  const layer: DataLayer = { mode: 'mock', api, dev };
  return render(<DataProvider layer={layer}>{ui}</DataProvider>);
}

afterEach(cleanup);

describe('Photos (v1 gallery)', () => {
  it('Seaview St slab: counts in words, the hold point with its date, required sets marked, a photo opens full size', async () => {
    show(<PhotosScreen jobId="seaview" />);
    const slab = within(await screen.findByTestId('photo-stage-sv-st-slab'));
    expect(slab.getByRole('heading', { level: 3 }).textContent).toBe('Slab');
    expect(slab.getByTestId('hold-progress').textContent).toBe('4 photos, 1 of 3 required sets');
    expect(slab.getByTestId('hold-step').textContent).toBe('Slab inspection before pour, Mon 28 Sep, in 11 days');
    // The set with photos says it's needed for inspection; the empty ones say what they hold up, as a neutral "!" note.
    const steel = within(slab.getByTestId('photo-cat-sv-pc-slab-steel'));
    expect(steel.getByText('4 photos')).toBeTruthy();
    expect(steel.getByTestId('cat-needed').textContent).toBe('needed for inspection');
    const plumbing = within(slab.getByTestId('photo-cat-sv-pc-slab-plumbing'));
    expect(plumbing.getByText('No photos yet')).toBeTruthy();
    expect(plumbing.getByTestId('cat-needed').textContent).toBe('!Needed before the slab inspection before pour');
    expect(plumbing.getByTestId('cat-needed').getAttribute('data-tone')).toBe('note');
    expect(document.querySelectorAll('[data-required="true"]').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByTestId('photos-sub').textContent).toMatch(/^\d+ photos?$/);

    const thumbs = slab.getAllByRole('button', { name: /^Open photo/ });
    expect(thumbs).toHaveLength(4);
    expect(thumbs[0]!.getAttribute('aria-label')).toMatch(/, taken Wed 16 Sep$/);
    expect(thumbs[0]!.querySelector('img')!.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
    fireEvent.click(thumbs[0]!);
    const view = within(screen.getByTestId('lightbox'));
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
    expect(view.getByTestId('view-taken').textContent).toBe('Wed 16 Sep, yesterday');
    expect(view.getByTestId('view-category').textContent).toBe('Slab, Steel reinforcement in place');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('lightbox')).toBeNull();
    fireEvent.click(thumbs[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByTestId('lightbox')).toBeNull();
    expect(document.body.textContent).not.toMatch(/\$|slip|finish/i);
  });

  it('one dropdown picks a stage; the job-wide set is "General", last', async () => {
    show(<PhotosScreen jobId="park-rd" />);
    const stage = (await screen.findByTestId('photos-stage')) as HTMLSelectElement;
    const labels = [...stage.options].map((o) => o.text);
    expect(labels[0]).toBe('All stages');
    expect(labels.at(-1)).toBe('General');
    fireEvent.change(stage, { target: { value: 'pr-st-slab' } });
    expect(screen.getAllByTestId(/^photo-stage-/).map((e) => e.getAttribute('data-testid'))).toEqual(['photo-stage-pr-st-slab']);
  });

  it('words', () => {
    const cat = (n: number, req: boolean) => ({ categoryId: 'c', name: 'C', requiredForHoldPoint: req, photos: Array.from({ length: n }) as never[] });
    expect(stageCountWords({ stageId: 's', stageName: 'S', categories: [cat(0, true)] })).toBe('No photos yet, 0 of 1 required set');
    expect(stageCountWords({ stageId: 's', stageName: 'S', categories: [cat(2, false)] })).toBe('2 photos');
    expect(neededBeforeWords('Stormwater inspection')).toBe('Needed before the stormwater inspection');
    expect(receivedWords({ receivedAt: '2026-09-16T07:10:00.000Z', messageId: 'm1' }, '2026-09-17')).toBe('From the bot, Wed 16 Sep, yesterday, 5:10pm');
  });
});

describe('Daily notes (v1 diary)', () => {
  it('Park Rd notes newest first, grouped by week, each day with how long ago', async () => {
    show(<NotesScreen jobId="park-rd" />);
    await screen.findByTestId('note-dn-pr-0917');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Daily notes at Park Rd');
    expect(screen.getByTestId('notes-sub').textContent).toBe('6 notes');
    const dates = screen.getAllByTestId('note-date').map((e) => e.textContent);
    expect(dates).toHaveLength(6);
    expect(dates[0]).toBe('Thu 17 Sep');
    expect(screen.getByTestId('notes-week-2026-09-14').textContent).toContain('This week, 14-18 Sep');
    expect(screen.getByTestId('notes-week-2026-09-07').textContent).toContain('Last week, 7-11 Sep');
    expect(within(screen.getByTestId('note-dn-pr-0917')).getByText('today')).toBeTruthy();
    expect(screen.getByText(/Rain till 10/)).toBeTruthy();
    // Read-only: no entry box.
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('week words', () => {
    expect(weekRange('2026-08-31')).toBe('31 Aug-4 Sep');
    const g = groupByWeek(
      [
        { id: 'a', jobId: 'j', date: '2026-09-15', text: 'x', createdAt: '2026-09-15T02:00:00.000Z', messageId: null },
        { id: 'b', jobId: 'j', date: '2026-08-31', text: 'y', createdAt: '2026-08-31T02:00:00.000Z', messageId: 'm' },
      ],
      '2026-09-17',
    );
    expect(g.map((w) => w.label)).toEqual(['This week, 14-18 Sep', 'Week of 31 Aug-4 Sep']);
    expect(noteSourceWords({ messageId: 'm', createdAt: '2026-09-15T02:00:00.000Z' })).toBe('From the bot, 12:00pm');
  });
});

describe('Changes (v1 activity, plus source and before -> after)', () => {
  it('by day down a rail: the time, saved or not, fields before and after, the source, the steps moved (no finish or money)', async () => {
    show(<HistoryScreen />);
    const tiler = within(await screen.findByTestId('history-cs-0915-tiler'));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Changes');
    expect(screen.getByTestId('history-sub').textContent).toBe('7 changes');
    expect(tiler.getByTestId('status').textContent).toBe('Saved');
    expect(tiler.getByTestId('fields').textContent).toContain('Book tiler, expected date');
    expect(tiler.getByTestId('fields').textContent).toContain('Mon 28 Sep → Mon 5 Oct');
    expect(tiler.getByTestId('source').textContent).toContain("Harbour Tiling can't get to Beatty till the 5th of October");
    expect(tiler.getByTestId('source').textContent).toContain('Voice note on Telegram');
    expect(tiler.getByTestId('forecast').textContent).toMatch(/^Moved \d+ steps? at Beatty St$/);
    expect(tiler.getByRole('link', { name: 'Beatty St' }).getAttribute('href')).toBe('#/jobs/beatty');
    expect(screen.getByTestId('history').textContent).not.toMatch(/\$|finish|slip/i);

    const cancelled = within(screen.getByTestId('history-cs-0916-cancel'));
    expect(cancelled.getByTestId('status').textContent).toBe('Cancelled');
    expect(cancelled.getByText('Would have changed (not saved):')).toBeTruthy();
    expect(cancelled.queryByTestId('forecast')).toBeNull();
    expect(within(screen.getByTestId('history-cs-0812-eta')).getByTestId('forecast').textContent).toBe('Moved no steps.');
    expect(within(screen.getByTestId('history-cs-0915-park')).queryByTestId('forecast')).toBeNull();
    // Days, newest first.
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Yesterday',
      'Tue 15 Sep, 2 days ago',
      'Tue 8 Sep, 9 days ago',
      'Wed 12 Aug, 5 weeks ago',
    ]);
    expect(screen.getAllByTestId(/^history-cs-/)[0]!.getAttribute('data-testid')).toBe('history-cs-0916-cancel');
  });

  it('filters by job with one dropdown', async () => {
    show(<HistoryScreen jobId="beatty" />);
    await screen.findByTestId('history-cs-0915-tiler');
    expect(screen.getAllByTestId(/^history-cs-/).map((e) => e.getAttribute('data-testid'))).toEqual(['history-cs-0915-tiler', 'history-cs-0908-beatty']);
    expect(screen.getByTestId('history-sub').textContent).toBe('2 changes at Beatty St');
    expect((screen.getByTestId('job-picker') as HTMLSelectElement).value).toBe('beatty');
    // Filtered to a job, rows don't repeat its name as a link.
    expect(within(screen.getByTestId('history-cs-0915-tiler')).queryByRole('link', { name: 'Beatty St' })).toBeNull();
  });

  it('words', () => {
    expect(dayWords('2026-09-17', '2026-09-17')).toBe('Today');
    expect(dayWords('2026-09-16', '2026-09-17')).toBe('Yesterday');
    expect(dayWords('2025-12-01', '2026-09-17')).toBe('Mon 1 Dec 2025, 41 weeks ago');
    expect(statusWord({ status: 'undone' })).toBe('Undone');
    const e = (id: string, at: string) => ({ changeSetId: id, confirmedAt: at, createdAt: at }) as HistoryEntry;
    expect(byDay([e('a', '2026-09-16T08:00:00.000Z'), e('b', '2026-09-16T01:00:00.000Z'), e('c', '2026-09-15T23:00:00.000Z')]).map((g) => [g.day, g.entries.length])).toEqual([
      ['2026-09-16', 3],
    ]);
  });
});
