// @vitest-environment jsdom
/** Stage 5 Setup screens on the mock layer (today Thu 17 Sep 2026): forms, plain-word checks and the dry-run preview. */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMockDashboard } from '@ct/core';
import type { ReactElement } from 'react';
import { DataProvider } from '../data/DataContext';
import type { DataLayer } from '../data/layer';
import { SetupNewJobScreen } from './SetupNewJob';
import { SetupProgramEditorScreen } from './SetupProgramEditor';
import { SetupTradesScreen } from './SetupTrades';
import { SetupTemplatesScreen } from './SetupTemplates';
import { checkDays, checkMoney, checkName, checkPhone, checkWeeks, moneyValue } from '../setup/validate';
import { setupTabFor } from '../setup/SetupFrame';

function show(ui: ReactElement) {
  const mock = createMockDashboard();
  const layer: DataLayer = { mode: 'mock', api: mock.api, dev: mock.dev };
  render(<DataProvider layer={layer}>{ui}</DataProvider>);
  return mock;
}

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

describe('Setup checks, in plain words', () => {
  it('explains bad values', () => {
    expect(checkName('  ', 'step')).toBe('Give the step a name.');
    expect(checkDays('0')).toBe('Working days must be a whole number from 1 to 1000.');
    expect(checkDays('2.5')).not.toBeNull();
    expect(checkDays('15')).toBeNull();
    expect(checkWeeks('105')).toBe('Lead time is in weeks: a number from 0 to 104.');
    expect(checkWeeks('1.5')).toBeNull();
    expect(checkMoney('')).toBeNull();
    expect(checkMoney('lots')).toMatch(/dollars a week/);
    expect(moneyValue('$4,500')).toBe(4500);
    expect(checkPhone('0491 579 212')).toBeNull();
    expect(checkPhone('555 1234')).toMatch(/Australian phone number/);
  });

  it('puts every Setup page under its tab', () => {
    expect(setupTabFor('/setup')).toBe('/setup');
    expect(setupTabFor('/setup/programs/park-rd')).toBe('/setup/programs');
    expect(setupTabFor('/setup/templates/tpl-duplex')).toBe('/setup/templates');
  });
});

describe('New job', () => {
  it('previews the planned finish and stage dates from the duplex template, then creates the job', async () => {
    const mock = show(<SetupNewJobScreen />);
    fireEvent.change(await screen.findByLabelText('Job name'), { target: { value: 'Smith St' } });
    fireEvent.change(screen.getByLabelText('Weekly holding cost'), { target: { value: '3200' } });
    // Start date defaults to next Monday, Mon 21 Sep.
    expect((screen.getByLabelText('Start date') as HTMLInputElement).value).toBe('2026-09-21');
    expect((await screen.findByTestId('nj-finish')).textContent).toBe('Fri 21 May 2027');
    const stages = within(screen.getByTestId('nj-stages')).getAllByRole('listitem');
    expect(stages).toHaveLength(8);
    expect(stages[0]!.textContent).toContain('Site establishment');
    expect(stages[0]!.textContent).toContain('Mon 21 Sep to Fri 9 Oct');

    fireEvent.click(screen.getByTestId('nj-create'));
    await waitFor(() => expect(window.location.hash).toMatch(/^#\/jobs\/job-/));
    const jobs = await mock.api.listJobs();
    const job = jobs.builds.find((j) => j.name === 'Smith St')!;
    expect(job.forecastFinish).toBe('2027-05-21');
    expect(window.location.hash).toBe(`#/jobs/${job.jobId}`);
  });

  it('starts from a later stage: earlier stages are marked done', async () => {
    show(<SetupNewJobScreen />);
    fireEvent.change(await screen.findByLabelText('Job name'), { target: { value: 'Live St' } });
    const from = screen.getByLabelText('Starts from stage') as HTMLSelectElement;
    await waitFor(() => expect(from.options.length).toBeGreaterThan(1));
    fireEvent.change(from, { target: { value: [...from.options].find((o) => o.text === 'Frame')!.value } });
    expect((await screen.findByTestId('nj-done')).textContent).toBe('Marked done: Site establishment, Slab.');
  });

  it('says what is wrong instead of creating', async () => {
    show(<SetupNewJobScreen />);
    fireEvent.click(await screen.findByTestId('nj-create'));
    expect(await screen.findByText('Give the job a name.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Job name'), { target: { value: 'Park Rd' } });
    expect((await screen.findByTestId('nj-problem')).textContent).toBe('There is already a job called Park Rd.');
  });
});

describe('Program editor', () => {
  it('a longer step: the bar shows the steps that move (no finish or money on the web), and Save records it', async () => {
    const mock = show(<SetupProgramEditorScreen jobId="park-rd" />);
    const row = within(await screen.findByTestId('ed-step-pr-tiling'));
    fireEvent.change(row.getByTestId('ed-days'), { target: { value: 'ten' } });
    expect((await screen.findByTestId('bar-problem')).textContent).toBe('Working days must be a whole number from 1 to 1000.');
    expect((screen.getByTestId('bar-save') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(row.getByTestId('ed-days'), { target: { value: '15' } });
    const bar = within(screen.getByTestId('change-bar'));
    expect((await bar.findByTestId('preview-moved')).textContent).toContain('5 steps move');
    expect(bar.queryByTestId('preview-finish')).toBeNull();
    expect(screen.getByTestId('change-bar').textContent).not.toMatch(/\$|Forecast finish/);
    expect(bar.getByTestId('bar-note').textContent).toContain("Planned dates don't change");
    // One change at a time: other inputs are locked until Save or Discard.
    expect((within(screen.getByTestId('ed-step-pr-painting')).getByTestId('ed-days') as HTMLInputElement).disabled).toBe(true);
    // Nothing saved yet.
    expect((await mock.api.getMonday()).builds.find((b) => b.jobId === 'park-rd')!.forecastFinish).toBe('2027-02-26');

    fireEvent.click(bar.getByTestId('bar-save'));
    expect((await screen.findByTestId('ed-saved')).textContent).toContain('Saved: Edited step Tiling at Park Rd');
    expect((await mock.api.getMonday()).builds.find((b) => b.jobId === 'park-rd')!.forecastFinish).toBe('2027-03-05');
    const entry = (await mock.api.getChangeHistory({ jobId: 'park-rd', limit: 1 }))[0]!;
    expect(entry.message?.channel).toBe('web');
  });

  it('Discard puts the stored value back', async () => {
    show(<SetupProgramEditorScreen jobId="park-rd" />);
    const row = within(await screen.findByTestId('ed-step-pr-tiling'));
    fireEvent.change(row.getByTestId('ed-days'), { target: { value: '12' } });
    fireEvent.click(await screen.findByTestId('bar-discard'));
    expect((row.getByTestId('ed-days') as HTMLInputElement).value).toBe('10');
    expect(screen.queryByTestId('change-bar')).toBeNull();
  });

  it('a template: no dates, the change measured in working days', async () => {
    show(<SetupProgramEditorScreen jobId="tpl-duplex" />);
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Template: Duplex');
    const row = within(await screen.findByTestId('ed-step-tpl-frame'));
    fireEvent.change(row.getByTestId('ed-days'), { target: { value: '20' } });
    expect((await screen.findByTestId('template-impact')).textContent).toContain('Longest chain 160 to 165 working days.');
    expect(document.querySelectorAll('.su-step-dates')).toHaveLength(0);
  });

  it('a step with items linked cannot be deleted here, and says why', async () => {
    show(<SetupProgramEditorScreen jobId="park-rd" />);
    const row = within(await screen.findByTestId('ed-step-pr-install-windows'));
    fireEvent.click(row.getByTestId('ed-more'));
    const detail = within(await screen.findByTestId('ed-detail-pr-install-windows'));
    expect(detail.getByText(/4 items are linked to Install windows, so it stays/)).toBeTruthy();
  });
});

describe('Templates', () => {
  it('lists the duplex template and previews a copy of a job', async () => {
    show(<SetupTemplatesScreen />);
    expect((await screen.findByTestId('template-tpl-duplex')).textContent).toContain('Duplex');
    fireEvent.change(screen.getByLabelText('Template name'), { target: { value: 'Park Rd program' } });
    expect((await screen.findByTestId('fromjob-preview')).textContent).toMatch(/^8 stages, \d+ steps, .* No dates\.$/);
  });
});

describe('Trades', () => {
  it('refuses a number that is not Australian, saves a good one written the usual way', async () => {
    const mock = show(<SetupTradesScreen />);
    const form = within(await screen.findByTestId('add-trade'));
    fireEvent.change(form.getByLabelText('Name'), { target: { value: 'Kerbside Concrete' } });
    fireEvent.change(form.getByLabelText('What they do'), { target: { value: 'Concreter' } });
    fireEvent.change(form.getByLabelText('Phone'), { target: { value: '555 1234' } });
    fireEvent.click(form.getByTestId('add-trade-save'));
    expect(await form.findByText(/doesn't look like an Australian phone number/)).toBeTruthy();
    fireEvent.change(form.getByLabelText('Phone'), { target: { value: '+61 491 579 212' } });
    expect(form.getByText('Saved as 0491 579 212')).toBeTruthy();
    fireEvent.click(form.getByTestId('add-trade-save'));
    expect((await screen.findByTestId('trade-saved')).textContent).toBe('Saved: New trade: Kerbside Concrete (Concreter).');
    const t = (await mock.api.listTrades()).find((x) => x.name === 'Kerbside Concrete')!;
    expect(t.phone).toBe('0491 579 212');
    const link = await screen.findByText('0491 579 212');
    expect(link.getAttribute('href')).toBe('tel:0491579212');
  });
});
