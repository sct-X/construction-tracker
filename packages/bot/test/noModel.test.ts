/**
 * No language model configured (no key in .env): the bot still starts. Reminders, /undo,
 * /reminders and buttons work, a captioned photo is filed with buttons, and typed text gets
 * "I can't read messages yet: add a model key to .env." with nothing saved.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_TODAY, fixedClock } from '@ct/core';
import { dataPaths, ensureDataDirs, loadConfig, manualReminderText, memoryLog, seedDatabase, SqliteStore, startApp, type DataPaths, type RunningApp } from '@ct/server';
import { diskMediaStore, NO_MODEL_REPLY } from '../src/index.js';
import { createHarness, type Harness } from './harness.js';

const clock = fixedClock(DEFAULT_TODAY, '10:00');
const PLUMBING = new Uint8Array(readFileSync(new URL('./fixtures/plumbing.jpg', import.meta.url)));

describe('the bot with no model key', () => {
  let dir: string;
  let paths: DataPaths;
  let store: SqliteStore;
  let h: Harness;
  let seedChangeSets: number;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ct-bot-nomodel-'));
    paths = ensureDataDirs(dataPaths(dir));
    store = new SqliteStore(paths.dbFile, { clock });
    seedDatabase(store);
    seedChangeSets = store.load().changeSets.length;
    h = createHarness({
      store,
      clock,
      parser: null,
      media: diskMediaStore(paths.dataDir),
      remindersNow: async () => manualReminderText(store.load(), clock.today()),
    });
  });

  afterEach(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const newChangeSets = () => store.load().changeSets.slice(seedChangeSets);

  it('answers typed messages with "add a model key" and saves no change', async () => {
    const calls = await h.text('Park Rd windows now arriving 16 Nov');
    expect(h.sent(calls)).toEqual([NO_MODEL_REPLY]);
    expect(NO_MODEL_REPLY).toBe("I can't read messages yet: add a model key to .env.");
    expect(newChangeSets()).toHaveLength(0);
  });

  it('/reminders and /undo still work', async () => {
    expect(h.sent(await h.text('/reminders'))[0]).toMatch(/^Reminders due now · Thu 17 Sep\n/);
    expect(h.sent(await h.text('fire reminders'))[0]).toMatch(/^Reminders due now · Thu 17 Sep\n/);
    // /undo takes back the newest seeded change set that came in on Telegram.
    const undoneBefore = store.load().changeSets.filter((c) => c.status === 'undone').length;
    expect(h.sent(await h.text('/undo')).join('\n')).toMatch(/^Undone\n/);
    expect(store.load().changeSets.filter((c) => c.status === 'undone')).toHaveLength(undoneBefore + 1);
  });

  it('a captioned photo is filed with buttons (no model call) and saved on Confirm', async () => {
    await h.photo(PLUMBING, { caption: 'plumbing under slab at seaview' });
    await h.press(h.lastWithButton('Seaview St').messageId, 'Seaview St');
    await h.press(h.last().messageId, 'Slab: Plumbing under slab');
    const card = h.lastWithButton('Confirm');
    expect(card.text).toContain('Photo filed: Seaview St, Slab, Plumbing under slab.');
    await h.press(card.messageId, 'Confirm');
    expect(h.messages.get(card.messageId)!.text).toMatch(/^Saved ✓\n/);
    expect(newChangeSets().map((c) => c.status)).toEqual(['confirmed']);
  });
});

describe('startApp with a bot token but no model key', () => {
  let app: RunningApp | null = null;
  let dir: string;
  let telegram: Server;
  afterEach(async () => {
    await app?.stop();
    app = null;
    await new Promise((r) => telegram.close(r));
    rmSync(dir, { recursive: true, force: true });
  });

  it('starts the bot anyway, logs that typed messages need a key, and sends the reminders', async () => {
    const sent: { chat_id: unknown; text: string; parse_mode: unknown }[] = [];
    telegram = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const method = (req.url ?? '').split('/').pop();
        const payload = body ? (JSON.parse(body) as Record<string, unknown>) : {};
        const reply = (result: unknown) => res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true, result }));
        if (method === 'getMe') return reply({ id: 1, is_bot: true, first_name: 'Tracker', username: 'ct_fake_bot' });
        if (method === 'getUpdates') return void setTimeout(() => reply([]), 20);
        if (method === 'sendMessage') {
          sent.push({ chat_id: payload.chat_id, text: String(payload.text), parse_mode: payload.parse_mode });
          return reply({ message_id: sent.length, date: 0, chat: { id: payload.chat_id, type: 'private' }, text: payload.text });
        }
        return reply(true);
      });
    });
    await new Promise<void>((r) => telegram.listen(0, '127.0.0.1', r));
    const port = (telegram.address() as AddressInfo).port;

    dir = mkdtempSync(join(tmpdir(), 'ct-bot-nomodel-app-'));
    const config = { ...loadConfig({ DATA_DIR: dir, PORT: '0', REMINDER_TIME: '07:00' }, dir), port: 0 };
    const log = memoryLog();
    app = await startApp(config, {
      log,
      clock: fixedClock(DEFAULT_TODAY, '07:30'),
      // LLM_MODEL as shipped in .env.example, with no OPENAI_API_KEY.
      env: { TELEGRAM_BOT_TOKEN: '123:fake', DOMINIC_TELEGRAM_USER_ID: '42', LLM_MODEL: 'gpt-5-mini', TELEGRAM_API_ROOT: `http://127.0.0.1:${port}` },
    });
    expect(app.bot).not.toBeNull();
    expect(log.lines.some((l) => l.startsWith('warn No language model: ') && l.includes('add a model key to .env'))).toBe(true);
    expect(log.lines).toContain('info Telegram bot starting (long polling); allowed user 42.');
    const tick = await app.firstTick!;
    expect(tick.reminders!.sent.length).toBeGreaterThanOrEqual(2);
    expect(sent.filter((m) => m.text.startsWith('<b>Reminders · Thu 17 Sep</b>')).map((m) => [m.chat_id, m.parse_mode])).toEqual([['42', 'HTML']]);
  });
});
