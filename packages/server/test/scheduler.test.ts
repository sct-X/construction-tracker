import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BEATTY, buildSeed, DEFAULT_TODAY, fixedClock, mondayRows, PARK_RD, SEAVIEW } from '@ct/core';
import {
  computeReminders,
  createScheduler,
  ensureMondaySnapshots,
  fireReminders,
  manualReminderText,
  memoryLog,
  memoryNotifier,
  seedDatabase,
  sentReminderKeys,
  SqliteStore,
  type Notifier,
} from '../src/index.js';

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ct-sched-'));
  file = join(dir, 'tracker.db');
  const s = new SqliteStore(file);
  seedDatabase(s);
  s.close();
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('Monday snapshot', () => {
  it('does nothing when this Monday already has one (seed, Thu 17 Sep)', () => {
    const store = new SqliteStore(file);
    expect(ensureMondaySnapshots(store, fixedClock(DEFAULT_TODAY))).toEqual([]);
    store.close();
  });

  it('catches up a missed Monday on start: one snapshot per live build job, dated the Monday, then idempotent', async () => {
    // Server was off on Mon 21 Sep; it starts on Wed 23 Sep.
    const clock = fixedClock('2026-09-23', '08:30');
    const store = new SqliteStore(file, { clock });
    const before = store.load().snapshots.length;
    const s = createScheduler({ store, clock, notifier: memoryNotifier(), log: memoryLog() });
    const first = await s.tick();
    expect(first.snapshots.map((x) => [x.jobId, x.date]).sort()).toEqual([
      [BEATTY, '2026-09-21'],
      [PARK_RD, '2026-09-21'],
      [SEAVIEW, '2026-09-21'],
    ]);
    expect(first.snapshots.find((x) => x.jobId === PARK_RD)!.forecastFinish).toBe('2027-02-26');
    expect((await s.tick()).snapshots).toEqual([]);
    const ds = store.load();
    expect(ds.snapshots.length).toBe(before + 3);
    // Templates and design jobs get none.
    expect(ds.snapshots.every((x) => ds.jobs.find((j) => j.id === x.jobId)!.kind === 'build')).toBe(true);
    // Slip is now measured from the new Monday.
    const park = mondayRows(ds, '2026-09-23').builds.find((b) => b.jobId === PARK_RD)!;
    expect(park).toMatchObject({ snapshotDate: '2026-09-21', slipDays: 0 });
    store.close();
  });
});

describe('reminders (flow f: "fire reminders", today Thu 17 Sep)', () => {
  it('computeReminders: Book concrete pump act-by Fri 18 Sep, and Beatty St amber', () => {
    const r = computeReminders(buildSeed(), DEFAULT_TODAY);
    const pump = r.find((x) => x.kind === 'act_by' && x.jobId === SEAVIEW && x.text.includes('Book concrete pump'))!;
    expect(pump).toMatchObject({ dueOn: '2026-09-18', text: 'Seaview St: Book concrete pump. Act by Fri 18 Sep (tomorrow).' });
    const amber = r.filter((x) => x.kind === 'amber');
    expect(amber.map((x) => x.jobName)).toContain('Beatty St');
    expect(amber.find((x) => x.jobId === BEATTY)!.text).toBe('Beatty St is amber: last confirmed 9 days ago. Check it and confirm the job.');
    expect(amber.some((x) => x.jobId === SEAVIEW)).toBe(false);
    expect(new Set(r.map((x) => x.key)).size).toBe(r.length);
  });

  it('fireReminders sends once, then dedups on a second run', async () => {
    const clock = fixedClock(DEFAULT_TODAY, '07:05');
    const store = new SqliteStore(file, { clock });
    const notifier = memoryNotifier();
    const first = await fireReminders(store, clock, notifier);
    expect(notifier.sent).toHaveLength(1);
    const text = notifier.sent[0]!.text;
    expect(text.split('\n')[0]).toBe('Reminders, Thu 17 Sep:');
    expect(text).toContain('Book concrete pump. Act by Fri 18 Sep');
    expect(text).toContain('Beatty St is amber');
    expect(first.sent.length).toBeGreaterThanOrEqual(2);

    const second = await fireReminders(store, clock, notifier);
    expect(second).toEqual({ sent: [], alreadySent: first.sent.length, text: null });
    expect(notifier.sent).toHaveLength(1);
    store.close();

    // Another process on the same file sees the same record.
    const other = new SqliteStore(file, { clock });
    expect((await fireReminders(other, clock, notifier)).sent).toEqual([]);
    other.close();
  });

  it('a moved act-by or a job going amber again is a new reminder; the next day the pump is "due"', async () => {
    const store = new SqliteStore(file);
    const notifier = memoryNotifier();
    await fireReminders(store, fixedClock(DEFAULT_TODAY), notifier);
    const fri = await fireReminders(store, fixedClock('2026-09-18'), notifier);
    expect(fri.sent.map((r) => r.text)).toContain('Seaview St: Book concrete pump. Act by Fri 18 Sep (today).');
    expect(fri.sent.some((r) => r.jobId === BEATTY && r.kind === 'amber')).toBe(false);
    store.close();
  });

  it('a failed send is released and retried next time', async () => {
    const clock = fixedClock(DEFAULT_TODAY);
    const store = new SqliteStore(file, { clock });
    const broken: Notifier = { send: async () => Promise.reject(new Error('Telegram down')) };
    await expect(fireReminders(store, clock, broken)).rejects.toThrow('Telegram down');
    expect(sentReminderKeys(store).size).toBe(0);
    const ok = memoryNotifier();
    expect((await fireReminders(store, clock, ok)).sent.length).toBeGreaterThan(0);
    store.close();
  });

  it('the scheduler waits for the reminder time, and a restart after it sends what was missed', async () => {
    const early = fixedClock(DEFAULT_TODAY, '06:30');
    const store = new SqliteStore(file, { clock: early });
    const notifier = memoryNotifier();
    const s1 = createScheduler({ store, clock: early, notifier, log: memoryLog() });
    expect((await s1.tick()).reminders).toBeNull();
    expect(notifier.sent).toHaveLength(0);
    store.close();

    // Down through 07:00; restarted at 11:00.
    const late = fixedClock(DEFAULT_TODAY, '11:00');
    const store2 = new SqliteStore(file, { clock: late });
    const log = memoryLog();
    const s2 = createScheduler({ store: store2, clock: late, notifier, log });
    const t = await s2.tick();
    expect(t.reminders!.sent.length).toBeGreaterThan(0);
    expect(notifier.sent).toHaveLength(1);
    expect(log.lines.some((l) => l.startsWith('info Sent'))).toBe(true);
    expect((await s2.tick()).reminders!.sent).toEqual([]);
    store2.close();
  });
});

describe('manualReminderText ("/reminders" in the bot)', () => {
  it('lists everything due today, sent or not, labelled as on request; leaves reminder_sent alone; null when nothing applies', async () => {
    const store = new SqliteStore(file);
    const clock = fixedClock(DEFAULT_TODAY, '07:30');
    await fireReminders(store, clock, memoryNotifier());
    const sentBefore = sentReminderKeys(store).size;
    const text = manualReminderText(store.load(), DEFAULT_TODAY)!;
    expect(text.split('\n')[0]).toBe('Reminders due now, Thu 17 Sep (you asked, so this includes any already sent today):');
    expect(text).toContain('- Seaview St: Book concrete pump. Act by Fri 18 Sep (tomorrow).');
    expect(text).toContain('- Beatty St is amber: last confirmed 9 days ago. Check it and confirm the job.');
    expect(sentReminderKeys(store).size).toBe(sentBefore);
    const quiet = buildSeed();
    quiet.items = [];
    quiet.jobs = quiet.jobs.map((j) => ({ ...j, lastConfirmed: DEFAULT_TODAY }));
    expect(manualReminderText(quiet, DEFAULT_TODAY)).toBeNull();
    store.close();
  });
});
