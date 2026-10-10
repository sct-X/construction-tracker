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
  it('computeReminders: Book concrete pump act-by Fri 18 Sep, and Beatty St not confirmed for 9 days', () => {
    const r = computeReminders(buildSeed(), DEFAULT_TODAY);
    const pump = r.find((x) => x.kind === 'act_by' && x.jobId === SEAVIEW && x.text.includes('Book concrete pump'))!;
    expect(pump).toMatchObject({ dueOn: '2026-09-18', text: 'Seaview St: Book concrete pump. Act by Fri 18 Sep (tomorrow).' });
    const unconfirmed = r.filter((x) => x.kind === 'unconfirmed');
    expect(unconfirmed.map((x) => x.jobName)).toContain('Beatty St');
    expect(unconfirmed.find((x) => x.jobId === BEATTY)!.text).toBe('Beatty St: not confirmed for 9 days. Check it and confirm the job.');
    expect(unconfirmed.some((x) => x.jobId === SEAVIEW)).toBe(false);
    // Rule 7 is sent in words only: never "amber" (SPEC revision 2026-10-10).
    expect(r.some((x) => /amber/i.test(x.text))).toBe(false);
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
    expect(text).toContain('Beatty St: not confirmed for 9 days.');
    expect(text).not.toMatch(/amber/i);
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

  it('a moved act-by or a job unconfirmed again is a new reminder; the next day the pump is "due"', async () => {
    const store = new SqliteStore(file);
    const notifier = memoryNotifier();
    await fireReminders(store, fixedClock(DEFAULT_TODAY), notifier);
    const fri = await fireReminders(store, fixedClock('2026-09-18'), notifier);
    expect(fri.sent.map((r) => r.text)).toContain('Seaview St: Book concrete pump. Act by Fri 18 Sep (today).');
    expect(fri.sent.some((r) => r.jobId === BEATTY && r.kind === 'unconfirmed')).toBe(false);
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
    expect(text).toContain('Seaview St:\n- Book concrete pump. Act by Fri 18 Sep (tomorrow).');
    expect(text).toContain('\nBeatty St: not confirmed for 9 days. Check it and confirm the job.');
    expect(sentReminderKeys(store).size).toBe(sentBefore);
    const quiet = buildSeed();
    quiet.items = [];
    quiet.jobs = quiet.jobs.map((j) => ({ ...j, lastConfirmed: DEFAULT_TODAY }));
    expect(manualReminderText(quiet, DEFAULT_TODAY)).toBeNull();
    store.close();
  });
});

describe('daily digest (Stage 6b): one message, grouped by job, overdue first, capped; weekly repeats', () => {
  const at = (date: string) => fixedClock(date, '07:05');
  const body = (text: string) => text.split('\n').slice(1);

  it('on Sat 10 Oct (20 reminders) the daily send is ONE message of at most 15 lines ending "+N more"', async () => {
    const store = new SqliteStore(file);
    expect(computeReminders(store.load(), '2026-10-10')).toHaveLength(20);
    const notifier = memoryNotifier();
    const r = await fireReminders(store, at('2026-10-10'), notifier);
    expect(notifier.sent).toHaveLength(1);
    const lines = body(notifier.sent[0]!.text);
    expect(notifier.sent[0]!.text.split('\n')[0]).toBe('Reminders, Sat 10 Oct:');
    expect(lines.length).toBeLessThanOrEqual(15);
    expect(lines.at(-1)).toBe(`+${20 - r.sent.length} more: /reminders for the full list`);
    // Grouped: each job's line once, its items under it; overdue items before ones coming up.
    const jobLines = lines.filter((l) => !l.startsWith('- ') && !l.startsWith('+'));
    expect(new Set(jobLines.map((l) => l.split(':')[0])).size).toBe(jobLines.length);
    expect(lines).toContain('Beatty St: not confirmed for 32 days. Check it and confirm the job.');
    const items = lines.filter((l) => l.startsWith('- '));
    expect(items.every((l) => l.includes('(overdue by'))).toBe(true); // 10 Oct: the overdue ones fill the digest
    expect(r.sent).toHaveLength(items.length + jobLines.filter((l) => l.includes('not confirmed')).length);

    // The ones left out lead the next day's digest; nothing shown yesterday comes back.
    const next = await fireReminders(store, at('2026-10-11'), notifier);
    expect(next.sent.length).toBeGreaterThan(0);
    const shownFirst = new Set(r.sent.map((x) => x.key));
    expect(next.sent.some((x) => shownFirst.has(x.key))).toBe(false);
    store.close();
  });

  it('a long-past act-by (and an unconfirmed job) goes again at most once a week after the first time', async () => {
    const store = new SqliteStore(file);
    const notifier = memoryNotifier();
    const glazing = (text: string | null) => (text ?? '').includes('Glazing energy compliance certificate');
    const beatty = (text: string | null) => (text ?? '').includes('Beatty St: not confirmed');
    const first = await fireReminders(store, at(DEFAULT_TODAY), notifier); // Thu 17 Sep: act-by Mon 10 Aug, long past
    expect(glazing(first.text) && beatty(first.text)).toBe(true);
    for (const day of ['2026-09-18', '2026-09-21', '2026-09-23']) {
      const r = await fireReminders(store, at(day), notifier);
      expect(glazing(r.text), day).toBe(false);
      expect(beatty(r.text), day).toBe(false);
    }
    const week = await fireReminders(store, at('2026-09-24'), notifier);
    expect(glazing(week.text)).toBe(true);
    expect(week.text).toContain('Beatty St: not confirmed for 16 days.');
    expect(week.sent.map((x) => x.key)).toContain('amber:beatty:2026-09-08:again-2026-09-24');
    expect(glazing((await fireReminders(store, at('2026-09-25'), notifier)).text)).toBe(false);
    store.close();
  });

  it('"/reminders" text is the full list, uncut, grouped the same way', () => {
    const text = manualReminderText(buildSeed(), '2026-10-10')!;
    expect(text).not.toContain('more: /reminders');
    expect(body(text).filter((l) => l.startsWith('- '))).toHaveLength(13);
    expect(text).toContain('Lower Beach St: not confirmed for 26 days. Check it and confirm the job.');
  });
});
