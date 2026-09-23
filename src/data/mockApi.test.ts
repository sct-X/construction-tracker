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
    const everything = JSON.stringify([api.listJobs(), api.getOverviewRows(), api.listItems(), api.listActivity(), api.listNotifications()]);
    for (const field of MONEY_FIELDS) expect(everything).not.toContain(`"${field}"`);
    expect(everything).not.toContain('$');
    // Alec sees builds only.
    expect(api.listJobs().every((j) => j.kind === 'build')).toBe(true);
  });

  it('a partner receives money fields', () => {
    const api = createMockApi({ storage: new MemoryStorage(), session: { personId: 'dom', today: DEFAULT_TODAY } });
    expect(api.getJob(PARK_RD)!.weeklyHoldingCost).toBe(4500);
    const rows = api.getOverviewRows();
    expect(rows[0].jobId).toBe(PARK_RD); // builds in the side's order
    const beatty = rows.find((r) => r.jobId === BEATTY)!;
    expect(beatty.currentStageName).toBe('Rough-in');
    expect(beatty.nextSteps[0].name).toBe('Rough-in, whole stage');
    expect(beatty.nextSteps.map((s) => s.name)).toContain('Tiling, whole stage');
    expect(beatty.nextSteps.find((s) => s.name === 'Tiling, whole stage')!.start).toBe('2026-10-05');
  });

  it('counts overdue items per job: past their date only, so Beatty (a future clash) has none', () => {
    const api = createMockApi({ storage: new MemoryStorage(), session: { personId: 'dom', today: DEFAULT_TODAY } });
    const rows = api.getOverviewRows();
    const by = (id: string) => rows.find((r) => r.jobId === id)!;
    // Park Rd: the glazing certificate and the tile choice, both still to do past their act-by,
    // and the cladder and cladding, needed and expected by 16 Sep and still not ticked off.
    expect(by(PARK_RD).overdue).toBe(4);
    expect(by(SEAVIEW).overdue).toBe(0);
    expect(by(BEATTY).overdue).toBe(0);
    expect(by(BEATTY).waitingOn[0].isLate).toBe(true); // the tiler is "7 days after needed", a future clash, not overdue
    expect(by(BEATTY).waitingOn[0].lateText).toBe('7 days after needed');
    const total = rows.reduce((n, r) => n + r.overdue, 0);
    expect(total).toBe(4);
  });
});

describe('booked needs an expected date', () => {
  const fresh = () => createMockApi({ storage: new MemoryStorage(), session: { personId: 'dominic', today: DEFAULT_TODAY } });

  it('every booked item in the seed has an expected date, its own or its shipment\'s', () => {
    for (const side of ['side-nd', 'side-norm']) {
      const api = createMockApi({ storage: new MemoryStorage(), session: { personId: 'dominic', sideId: side, today: DEFAULT_TODAY } });
      for (const item of api.listItems({ status: 'booked' })) {
        expect(item.expectedDate ?? item.shipmentId, item.id).toBeTruthy();
      }
    }
  });

  it('refuses booked without a date, and takes it once the date is set', () => {
    const api = fresh();
    const it = api.listItems({ status: 'to_do' }).find((i) => !i.shipmentId && !i.expectedDate)!;
    expect(() => api.updateItemStatus(it.id, 'booked')).toThrow('Ordered or booked needs an expected date.');
    expect(api.getItem(it.id)!.status).toBe('to_do');
    api.setItemExpectedDate(it.id, '2026-10-01');
    expect(api.updateItemStatus(it.id, 'booked').status).toBe('booked');
  });

  it('refuses a new item added as booked without a date; a shipment ETA counts as its date', () => {
    const api = fresh();
    expect(() => api.addItem({ jobId: PARK_RD, type: 'trade', title: 'Book electrician', neededBy: '2026-10-20', status: 'booked' })).toThrow();
    expect(api.addItem({ jobId: PARK_RD, type: 'trade', title: 'Book electrician', neededBy: '2026-10-20', status: 'booked', expectedDate: '2026-10-19' }).status).toBe('booked');
    const linked = api.addItem({ jobId: PARK_RD, type: 'material', title: 'Window hardware', status: 'to_do', shipmentId: 'sh-park-windows', neededBy: '2026-11-01' });
    expect(api.updateItemStatus(linked.id, 'booked').status).toBe('booked');
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
      expect(early.message).toBe("This step hasn't started yet; it starts Mon 28 Sep, in 11 days.");
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
      expect(result.message).toBe("This step hasn't started yet; it starts Mon 2 Nov, in 6 weeks.");
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

  it('previews a template copy: planned finish from Mon 5 Oct 2026 matches what copyTemplate makes', () => {
    const api = createMockApi({ storage: new MemoryStorage(), session: { personId: 'dominic', today: DEFAULT_TODAY } });
    const jobsBefore = api.listJobs().length;
    const preview = api.previewTemplate('tpl-duplex', { startDate: '2026-10-05' });
    expect(preview.startsOn).toBe('2026-10-05');
    expect(preview.stageCount).toBe(8);
    expect(preview.stepCount).toBe(29);
    expect(preview.stagesDone).toBe(0);
    expect(preview.plannedFinish).toBeDefined();
    expect(api.listJobs().length).toBe(jobsBefore); // nothing saved
    const job = api.copyTemplate('tpl-duplex', { name: '2 Test St', startDate: '2026-10-05', weeklyHoldingCost: 1000 });
    expect(job.plannedFinish).toBe(preview.plannedFinish);
    expect(api.getForecast(job.id)!.forecastFinish).toBe(preview.plannedFinish);
    // A Saturday start snaps forward to Monday.
    expect(api.previewTemplate('tpl-duplex', { startDate: '2026-10-03' }).startsOn).toBe('2026-10-05');
  });

  it('starts from a stage: earlier stages are done and the finish comes sooner', () => {
    const api = createMockApi({ storage: new MemoryStorage(), session: { personId: 'dominic', today: DEFAULT_TODAY } });
    const stages = api.listStages('tpl-duplex');
    const lockup = stages.find((s) => s.name === 'Lock-up')!;
    const whole = api.previewTemplate('tpl-duplex', { startDate: '2026-10-05' });
    const fromLockup = api.previewTemplate('tpl-duplex', { startDate: '2026-10-05', startsFromStageId: lockup.id });
    expect(fromLockup.stagesDone).toBe(4);
    expect(fromLockup.plannedFinish! < whole.plannedFinish!).toBe(true);
    const job = api.copyTemplate('tpl-duplex', { name: '3 Test St', startDate: '2026-10-05', startsFromStageId: lockup.id });
    expect(job.startsFromStageId).toBeDefined();
    expect(api.listStages(job.id).filter((s) => s.status === 'done').length).toBe(4);
    expect(api.getForecast(job.id)!.currentStageName).toBe('Lock-up');
  });

  it('saves a job as a template with no dates and no statuses', () => {
    const api = createMockApi({ storage: new MemoryStorage(), session: { personId: 'dominic', today: DEFAULT_TODAY } });
    const tpl = api.saveJobAsTemplate(PARK_RD, 'Park Rd as built');
    expect(tpl.isTemplate).toBe(true);
    expect(tpl.startDate).toBeUndefined();
    expect(tpl.plannedFinish).toBeUndefined();
    expect(api.listTemplates().map((t) => t.id)).toContain(tpl.id);
    expect(api.listJobs().map((j) => j.id)).not.toContain(tpl.id);
    const steps = api.listSteps(tpl.id);
    expect(steps.length).toBe(api.listSteps(PARK_RD).length);
    expect(steps.every((s) => !s.plannedStart && !s.plannedEnd && !s.actualStart && s.status === 'not_started')).toBe(true);
    expect(api.listStages(tpl.id).every((s) => s.status === 'not_started')).toBe(true);
    expect(api.listStepLinks(tpl.id).length).toBe(api.listStepLinks(PARK_RD).length);
    expect(api.listRequirements(tpl.id).length).toBe(api.listRequirements(PARK_RD).length);
    expect(api.listPhotoCategories(tpl.id).length).toBe(api.listPhotoCategories(PARK_RD).length);
    expect(api.getForecast(tpl.id)).toBeUndefined();
  });

  it('a new blank template and a design template give checklist stages only', () => {
    const api = createMockApi({ storage: new MemoryStorage(), session: { personId: 'dominic', today: DEFAULT_TODAY } });
    const blank = api.addJob({ name: 'Townhouse', kind: 'build', isTemplate: true });
    expect(blank.isTemplate).toBe(true);
    expect(api.listTemplates().map((t) => t.id)).toContain(blank.id);
    expect(api.listJobs().map((j) => j.id)).not.toContain(blank.id);
    const design = api.addJob({ name: 'DA design', kind: 'design', path: 'DA', isTemplate: true });
    expect(api.listStages(design.id).length).toBe(4);
    const job = api.copyTemplate(design.id, { name: '9 Plan St', startDate: '2026-10-05' });
    expect(job.kind).toBe('design');
    expect(api.listStages(job.id).length).toBe(4);
    expect(api.listSteps(job.id).length).toBe(0);
    expect(api.getForecast(job.id)!.checklist).toBeDefined();
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

describe('program editor preview (Stage 6)', () => {
  function draftOf(api: ReturnType<typeof createMockApi>, jobId: string) {
    return {
      stages: api.listStages(jobId),
      steps: api.listSteps(jobId),
      links: api.listStepLinks(jobId),
      requirements: api.listRequirements(jobId),
      photoCategories: api.listPhotoCategories(jobId),
    };
  }

  it('an unchanged draft leaves the finish where it is and writes nothing', () => {
    const api = createMockApi({ storage: new MemoryStorage(), session: { personId: 'dominic', today: DEFAULT_TODAY } });
    const before = api.listActivity({ jobId: PARK_RD }).length;
    const p = api.previewProgramChange(PARK_RD, draftOf(api, PARK_RD))!;
    expect(p.finishBefore).toBe('2027-02-26');
    expect(p.finishAfter).toBe('2027-02-26');
    expect(p.deltaDays).toBe(0);
    expect(p.costDelta).toBe(0);
    expect(api.listActivity({ jobId: PARK_RD })).toHaveLength(before);
  });

  it('five more working days on Install windows moves the finish a calendar week, $4,500, and planned end follows the duration', () => {
    const api = createMockApi({ storage: new MemoryStorage(), session: { personId: 'dominic', today: DEFAULT_TODAY } });
    const draft = draftOf(api, PARK_RD);
    draft.steps = draft.steps.map((s) => (s.id === 'pr-install-windows' ? { ...s, durationDays: s.durationDays + 5 } : s));
    const p = api.previewProgramChange(PARK_RD, draft)!;
    expect(p.finishAfter).toBe('2027-03-05');
    expect(p.deltaDays).toBe(7);
    expect(p.costDelta).toBe(4500);
    expect(p.forecast.steps['pr-install-windows'].plannedEnd).toBe('2026-11-20');
    // Nothing saved: the real forecast still says 26 Feb.
    expect(api.getForecast(PARK_RD)!.forecastFinish).toBe('2027-02-26');
  });

  it('a draft that drops a step with items on it still forecasts, and templates give no preview', () => {
    const api = createMockApi({ storage: new MemoryStorage(), session: { personId: 'dominic', today: DEFAULT_TODAY } });
    const draft = draftOf(api, PARK_RD);
    draft.steps = draft.steps.filter((s) => s.id !== 'pr-landscaping');
    draft.links = draft.links.filter((l) => l.stepId !== 'pr-landscaping' && l.waitsForStepId !== 'pr-landscaping');
    const p = api.previewProgramChange(PARK_RD, draft)!;
    expect(p.forecast.steps['pr-landscaping']).toBeUndefined();
    expect(p.finishAfter).toBeDefined();
    expect(api.previewProgramChange('tpl-duplex', draftOf(api, 'tpl-duplex'))).toBeUndefined();
  });

  it('the site role gets no cost on the preview', () => {
    const api = createMockApi({ storage: new MemoryStorage(), session: { personId: 'alec', today: DEFAULT_TODAY } });
    const p = api.previewProgramChange(PARK_RD, draftOf(api, PARK_RD))!;
    expect(p).toBeDefined();
    expect('costDelta' in p).toBe(false);
  });
});

describe('my settings: notification preferences and push subscriptions (Stage 6, setup)', () => {
  it('preferences default to the person flag, persist per person and survive a reload', () => {
    const storage = new MemoryStorage();
    const api = createMockApi({ storage, session: { personId: 'dominic', today: DEFAULT_TODAY } });
    expect(api.getNotificationPrefs()).toEqual({ reminders: true, hold_points: true, eta_changes: true, unconfirmed_jobs: true });
    // Norm has notifications off, so every key starts off for him.
    expect(api.getNotificationPrefs('norm').reminders).toBe(false);
    api.setNotificationPref('eta_changes', false);
    expect(api.getNotificationPrefs().eta_changes).toBe(false);
    expect(api.getNotificationPrefs().reminders).toBe(true);
    expect(api.getNotificationPrefs('dom').eta_changes).toBe(true);
    const again = createMockApi({ storage, session: { personId: 'dominic', today: DEFAULT_TODAY } });
    expect(again.getNotificationPrefs().eta_changes).toBe(false);
    again.reset();
    expect(again.getNotificationPrefs().eta_changes).toBe(true);
  });

  it('a push subscription is stored once per device for the current person and logged without money', () => {
    const api = createMockApi({ storage: new MemoryStorage(), session: { personId: 'norm', today: DEFAULT_TODAY } });
    expect(api.listPushSubscriptions()).toEqual([]);
    const first = api.savePushSubscription({ device: 'iPhone, Safari', subscription: 'placeholder' });
    expect(first.personId).toBe('norm');
    expect(first.enabled).toBe(true);
    expect(api.getPerson('norm')!.notificationsEnabled).toBe(true);
    api.savePushSubscription({ device: 'iPhone, Safari', subscription: 'placeholder 2', enabled: false });
    const subs = api.listPushSubscriptions();
    expect(subs).toHaveLength(1);
    expect(subs[0].subscription).toBe('placeholder 2');
    expect(subs[0].enabled).toBe(false);
    expect(api.getPerson('norm')!.notificationsEnabled).toBe(false);
    const texts = api.listActivity({ personId: 'norm' }).map((a) => a.text);
    expect(texts).toContain('Norm allowed notifications on iPhone, Safari');
    expect(texts).toContain('Norm turned off notifications on iPhone, Safari');
    expect(api.listPushSubscriptions('dominic')).toEqual([]);
  });

  it('last sync is the stamp of the last write and survives a reload', () => {
    const storage = new MemoryStorage();
    const clock = () => new Date(2026, 8, 17, 15, 10);
    const api = createMockApi({ storage, session: { personId: 'dominic', today: DEFAULT_TODAY }, clock });
    expect(api.getLastSync()).toBeUndefined();
    api.setNotificationPref('reminders', false);
    expect(api.getLastSync()).toBe('2026-09-17T15:10');
    const again = createMockApi({ storage, session: { personId: 'dominic', today: DEFAULT_TODAY }, clock });
    expect(again.getLastSync()).toBe('2026-09-17T15:10');
  });
});
