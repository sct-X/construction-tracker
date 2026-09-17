/**
 * The mock data layer: scoping, money stripping, mutations, the photo queue.
 */
import { describe, expect, it } from 'vitest';
import { MONEY_FIELDS } from '../domain/money';
import { DEFAULT_TODAY, BEATTY, PARK_RD, SEAVIEW } from '../seed';
import { createMockApi } from './mockApi';
import { MemoryStorage } from './storage';

describe('money and the site role through the API', () => {
  it('the site role never receives a money field from the API', () => {
    const api = createMockApi({ storage: new MemoryStorage(), session: { personId: 'alec', today: DEFAULT_TODAY } });
    const job = api.getJob(PARK_RD)!;
    expect('weeklyHoldingCost' in job).toBe(false);
    const f = api.getForecast(PARK_RD)!;
    expect('slipCost' in f).toBe(false);
    expect(f.slipDays).toBe(0);
    const preview = api.previewEtaChange('sh-park-windows', '2026-11-16');
    expect('costDelta' in preview).toBe(false);
    expect(preview.deltaDays).toBe(14);
    const everything = JSON.stringify([api.listJobs(), api.getMondayRows(), api.listItems(), api.listActivity(), api.listNotifications()]);
    for (const field of MONEY_FIELDS) expect(everything).not.toContain(`"${field}"`);
    expect(everything).not.toContain('$');
    // Alec sees builds only.
    expect(api.listJobs().every((j) => j.kind === 'build')).toBe(true);
  });

  it('a partner receives money fields', () => {
    const api = createMockApi({ storage: new MemoryStorage(), session: { personId: 'dom', today: DEFAULT_TODAY } });
    expect(api.getJob(PARK_RD)!.weeklyHoldingCost).toBe(4500);
    const rows = api.getMondayRows();
    expect(rows[0].jobId).toBe(BEATTY); // sorted by slip cost, largest first
    expect(rows.find((r) => r.jobId === PARK_RD)!.slipCost).toBe(0);
  });
});


describe('mock API', () => {
  it('setting the ETA moves the finish and logs who did it', () => {
    const api = createMockApi({ storage: new MemoryStorage(), session: { personId: 'dominic', today: DEFAULT_TODAY } });
    api.setShipmentEta('sh-park-windows', '2026-11-16');
    const f = api.getForecast(PARK_RD)!;
    expect(f.forecastFinish).toBe('2027-03-12');
    expect(f.slipDays).toBe(14);
    expect(f.slipCost).toBe(9000);
    const entry = api.listActivity({ jobId: PARK_RD })[0];
    expect(entry.kind).toBe('eta_changed');
    expect(entry.from).toBe('2026-10-26');
    expect(entry.to).toBe('2026-11-16');
    // Raff owns 2 linked items, so he is told.
    const raffNotes = api.listNotifications({ personId: 'raff' }).filter((n) => n.kind === 'eta_moved');
    expect(raffNotes).toHaveLength(1);
    expect(raffNotes[0].text).toBe('Park Rd windows now expected 16 Nov. 2 of your items moved.');
  });

  it('refuses a hold point with empty categories and names them (rule 6)', () => {
    const api = createMockApi({ storage: new MemoryStorage(), session: { personId: 'raff', today: DEFAULT_TODAY } });
    const result = api.setStepStatus('sv-slab-insp', 'done');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.missingCategories).toEqual(['Plumbing under slab', 'Membrane and termite barrier']);
    for (const categoryId of ['sv-pc-slab-plumbing', 'sv-pc-slab-membrane']) {
      api.addPhoto({ jobId: SEAVIEW, stageId: 'sv-st-slab', categoryId, dataUrl: 'data:image/svg+xml;utf8,<svg/>', takenOn: DEFAULT_TODAY });
    }
    // Photos are in, but the inspection is forecast for Mon 28 Sep: not until then.
    const early = api.setStepStatus('sv-slab-insp', 'done');
    expect(early.ok).toBe(false);
    if (!early.ok) {
      expect(early.reason).toBe('not_started');
      expect(early.startsOn).toBe('2026-09-28');
      expect(early.message).toBe("This step hasn't started yet; it starts Mon 28 Sep.");
    }
    api.setSession({ today: '2026-09-28' });
    expect(api.setStepStatus('sv-slab-insp', 'done').ok).toBe(true);
    expect(api.getStep('sv-slab-insp')!.status).toBe('done');
  });

  it('refuses to finish a step before its forecast start, and allows it from that day', () => {
    const api = createMockApi({ storage: new MemoryStorage(), session: { personId: 'raff', today: DEFAULT_TODAY } });
    // Install windows is planned Mon 2 Nov 2026 with no photo check.
    const result = api.setStepStatus('pr-install-windows', 'done');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('not_started');
      expect(result.missingCategories).toEqual([]);
      expect(result.message).toBe("This step hasn't started yet; it starts Mon 2 Nov.");
    }
    expect(api.getStep('pr-install-windows')!.status).toBe('not_started');
    expect(api.listActivity({ stepId: 'pr-install-windows' })).toHaveLength(0);
    // Starting it early is still allowed; only "done" waits for the start.
    expect(api.setStepStatus('pr-install-windows', 'in_progress').ok).toBe(true);
    api.setSession({ today: '2026-11-02' });
    expect(api.setStepStatus('pr-install-windows', 'done').ok).toBe(true);
  });

  it('confirming a job resets freshness, and the Monday snapshot saves today\'s forecast', () => {
    const api = createMockApi({ storage: new MemoryStorage(), session: { personId: 'dominic', today: DEFAULT_TODAY } });
    api.confirmJob(BEATTY);
    expect(api.getForecast(BEATTY)!.freshness.daysUnconfirmed).toBe(0);
    api.setSession({ today: '2026-09-21' });
    const saved = api.saveMondaySnapshot();
    expect(saved.find((s) => s.jobId === BEATTY)!.forecastFinish).toBe('2026-12-04');
    expect(api.getForecast(BEATTY)!.slipDays).toBe(0);
  });

  it('finishing a call confirms every listed job today and logs one entry per job in the call\'s words', () => {
    const api = createMockApi({ storage: new MemoryStorage(), session: { personId: 'dominic', today: DEFAULT_TODAY } });
    expect(api.getForecast(BEATTY)!.freshness.amber).toBe(true);
    const before = api.listActivity().length;
    const result = api.finishCall({
      personId: 'raff',
      jobs: [
        { jobId: PARK_RD, itemsUpdated: 3 },
        { jobId: SEAVIEW, itemsUpdated: 1 },
        { jobId: BEATTY, itemsUpdated: 0 },
      ],
    });
    expect(result.jobs.map((j) => j.lastConfirmed)).toEqual([DEFAULT_TODAY, DEFAULT_TODAY, DEFAULT_TODAY]);
    expect(result.activity.map((a) => a.text)).toEqual([
      'Dominic rang Raff: 3 items updated on 64-66 Park Rd',
      'Dominic rang Raff: 1 item updated on 31 Seaview St',
      'Dominic rang Raff: nothing changed on 26a Beatty St',
    ]);
    expect(result.activity.every((a) => a.kind === 'job_confirmed' && a.personId === 'dominic')).toBe(true);
    expect(api.listActivity().length).toBe(before + 3);
    expect(api.listActivity({ jobId: BEATTY })[0].text).toBe('Dominic rang Raff: nothing changed on 26a Beatty St');
    for (const id of [PARK_RD, SEAVIEW, BEATTY]) {
      const f = api.getForecast(id)!.freshness;
      expect(f.daysUnconfirmed).toBe(0);
      expect(f.amber).toBe(false);
      expect(f.text).toBe('Last confirmed today');
    }
  });

  it('copies a template into a dated job', () => {
    const api = createMockApi({ storage: new MemoryStorage(), session: { personId: 'dominic', today: DEFAULT_TODAY } });
    const job = api.copyTemplate('tpl-duplex', { name: '1 Test St', startDate: '2026-10-05', weeklyHoldingCost: 1000 });
    const steps = api.listSteps(job.id);
    expect(steps.length).toBe(api.listSteps('tpl-duplex').length);
    expect(steps.every((s) => !!s.plannedStart)).toBe(true);
    expect(api.listPhotoCategories(job.id).length).toBeGreaterThan(0);
    expect(api.getForecast(job.id)!.forecastFinish).toBeDefined();
    expect(api.getForecast(job.id)!.slipDays).toBeUndefined(); // no Monday yet
  });

  it('refuses an item whose step is on another job', () => {
    const api = createMockApi({ storage: new MemoryStorage(), session: { personId: 'dominic', today: DEFAULT_TODAY } });
    expect(() => api.addItem({ jobId: SEAVIEW, type: 'trade', title: 'Book glazier', stepId: 'pr-install-windows' })).toThrow(/not on/);
    const ok = api.addItem({ jobId: PARK_RD, type: 'trade', title: 'Book glazier', stepId: 'pr-install-windows' });
    expect(api.getItem(ok.id)?.stepId).toBe('pr-install-windows');
  });

  it('reset restores the seed', () => {
    const api = createMockApi({ storage: new MemoryStorage(), session: { personId: 'dominic', today: DEFAULT_TODAY } });
    api.updateItemStatus('it-pr-tile-choice', 'done');
    expect(api.getItem('it-pr-tile-choice')!.status).toBe('done');
    api.reset();
    expect(api.getItem('it-pr-tile-choice')!.status).toBe('to_do');
  });
});


describe('photo queue', () => {
  it('holds photos while offline, sends them once when signal returns, and they then count for hold points', async () => {
    const api = createMockApi({ storage: new MemoryStorage(), session: { personId: 'alec', today: DEFAULT_TODAY, offline: true } });
    for (const categoryId of ['sv-pc-slab-plumbing', 'sv-pc-slab-membrane']) {
      await api.queuePhoto({ jobId: SEAVIEW, stageId: 'sv-st-slab', categoryId, dataUrl: 'data:image/svg+xml;utf8,<svg/>' });
    }
    expect(await api.listQueuedPhotos()).toHaveLength(2);
    expect(await api.flushPhotoQueue()).toBe(0); // no signal
    expect(api.listPhotos(SEAVIEW, { categoryId: 'sv-pc-slab-plumbing' })).toHaveLength(0);
    api.setSession({ offline: false });
    expect(await api.flushPhotoQueue()).toBe(2);
    expect(await api.listQueuedPhotos()).toHaveLength(0);
    expect(await api.flushPhotoQueue()).toBe(0); // nothing lands twice
    expect(api.listPhotos(SEAVIEW, { categoryId: 'sv-pc-slab-plumbing' })).toHaveLength(1);
    api.setSession({ personId: 'raff', today: '2026-09-28' });
    expect(api.setStepStatus('sv-slab-insp', 'done').ok).toBe(true);
  });
});
