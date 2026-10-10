// Starting the bot: off (with a log line) unless the token and Dominic's id are
// configured (no model key: it still starts, see noModel.test.ts); the server's
// startApp hook logs it either way.
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_TODAY, fixedClock, InMemoryStore, buildSeed } from '@ct/core';
import { loadConfig, memoryLog, memoryNotifier, startApp, type RunningApp } from '@ct/server';
import { HttpError } from 'grammy';
import { botConfigFromEnv, networkErrorCode, pollingNetworkLog, startBot } from '../src/index.js';
import { memoryBotLog } from './harness.js';

const clock = fixedClock(DEFAULT_TODAY, '10:00');

describe('botConfigFromEnv / startBot', () => {
  it('needs a token and a numeric allowed user id', () => {
    expect(botConfigFromEnv({})).toEqual({ ok: false, reason: 'TELEGRAM_BOT_TOKEN is not set' });
    expect(botConfigFromEnv({ TELEGRAM_BOT_TOKEN: 't' })).toMatchObject({ ok: false, reason: expect.stringContaining('DOMINIC_TELEGRAM_USER_ID is not set') });
    expect(botConfigFromEnv({ TELEGRAM_BOT_TOKEN: 't', DOMINIC_TELEGRAM_USER_ID: '@dom' })).toMatchObject({ ok: false });
    expect(botConfigFromEnv({ TELEGRAM_BOT_TOKEN: ' t ', DOMINIC_TELEGRAM_USER_ID: ' 42 ' })).toEqual({ ok: true, token: 't', allowedUserId: '42' });
  });

  it('stays off, with a log line, when something is missing (no network call)', async () => {
    const store = new InMemoryStore(buildSeed(), { clock });
    const log = memoryBotLog();
    expect(await startBot({ store, clock, log, env: {} })).toBeNull();
    expect(await startBot({ store, clock, log, env: { TELEGRAM_BOT_TOKEN: 't', LLM_PROVIDER: 'openai' } })).toBeNull();
    expect(log.lines).toEqual([
      'info Telegram bot off: TELEGRAM_BOT_TOKEN is not set.',
      'info Telegram bot off: DOMINIC_TELEGRAM_USER_ID is not set, so nobody would be allowed to use it.',
    ]);
  });
});

describe('pollingNetworkLog', () => {
  const timedOut = () => new HttpError("Network request for 'getUpdates' failed!", Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' }));

  it('says once per outage that Telegram is unreachable, and when it is back', async () => {
    const log = memoryBotLog();
    const t = pollingNetworkLog(log);
    let fail: HttpError | null = timedOut();
    const prev = (async () => {
      if (fail) throw fail;
      return { ok: true, result: [] };
    }) as unknown as Parameters<typeof t>[0];
    for (let i = 0; i < 3; i++) await expect(t(prev, 'getUpdates', { offset: 0 })).rejects.toBe(fail);
    fail = null;
    await t(prev, 'getUpdates', { offset: 0 });
    expect(log.lines).toEqual(["warn Can't reach Telegram, retrying: ETIMEDOUT", 'info Reached Telegram again.']);
  });

  it('ignores other methods and cancelled polls', async () => {
    const log = memoryBotLog();
    const t = pollingNetworkLog(log);
    const prev = (async () => {
      throw timedOut();
    }) as unknown as Parameters<typeof t>[0];
    const ac = new AbortController();
    ac.abort();
    await expect(t(prev, 'getUpdates', { offset: 0 }, ac.signal as unknown as Parameters<typeof t>[3])).rejects.toBeInstanceOf(HttpError);
    await expect(t(prev, 'sendMessage', { chat_id: 1, text: 'x' })).rejects.toBeInstanceOf(HttpError);
    expect(log.lines).toEqual([]);
    expect(networkErrorCode(new HttpError('Network request failed!', new Error('boom')))).toBe('Network request failed!');
  });
});

describe('server startApp hook', () => {
  let app: RunningApp | null = null;
  let dir: string;
  afterEach(async () => {
    await app?.stop();
    rmSync(dir, { recursive: true, force: true });
  });

  it('logs that the bot is off when TELEGRAM_BOT_TOKEN is not set', async () => {
    dir = mkdtempSync(join(tmpdir(), 'ct-bot-app-'));
    const config = { ...loadConfig({ DATA_DIR: dir, PORT: '0' }, dir), port: 0 };
    const log = memoryLog();
    app = await startApp(config, { log, notifier: memoryNotifier(), clock, scheduler: false, env: {} });
    expect(app.bot).toBeNull();
    expect(log.lines).toContain('info Telegram bot off: TELEGRAM_BOT_TOKEN is not set.');
  });
});

describe('startApp with the bot on: reminders go to Dominic on Telegram', () => {
  let app: RunningApp | null = null;
  let dir: string;
  let telegram: Server;
  afterEach(async () => {
    await app?.stop();
    app = null;
    await new Promise((r) => telegram.close(r));
    rmSync(dir, { recursive: true, force: true });
  });

  it('the scheduler\'s first pass sends the day\'s reminders through the bot to his chat (= his user id)', async () => {
    // A fake Telegram Bot API (TELEGRAM_API_ROOT): getMe, long polling that returns nothing, sendMessage.
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

    dir = mkdtempSync(join(tmpdir(), 'ct-bot-app-tg-'));
    // A photo left over from before a restart: the bot's start-up sweep removes it.
    mkdirSync(join(dir, 'photos', 'telegram'), { recursive: true });
    writeFileSync(join(dir, 'photos', 'telegram', '2026-09-16-0123456789ab.jpg'), 'x');
    const config = { ...loadConfig({ DATA_DIR: dir, PORT: '0', REMINDER_TIME: '07:00' }, dir), port: 0 };
    const log = memoryLog();
    app = await startApp(config, {
      log,
      clock: fixedClock(DEFAULT_TODAY, '07:30'),
      env: {
        TELEGRAM_BOT_TOKEN: '123:fake',
        DOMINIC_TELEGRAM_USER_ID: '42',
        LLM_PROVIDER: 'openai',
        OPENAI_API_KEY: 'not-used',
        TELEGRAM_API_ROOT: `http://127.0.0.1:${port}`,
      },
    });
    expect(app.bot).not.toBeNull();
    expect(app.notifier).toBe(app.bot!.notifier);
    const tick = await app.firstTick!;
    expect(tick.reminders!.sent.length).toBeGreaterThanOrEqual(2);
    const daily = sent.filter((m) => m.text.startsWith('<b>Reminders · Thu 17 Sep</b>'));
    expect(daily).toHaveLength(1);
    expect(daily[0]!.chat_id).toBe('42');
    expect(daily[0]!.parse_mode).toBe('HTML');
    expect(daily[0]!.text).toContain('<b>Seaview St</b>\n• Book concrete pump: act by Fri 18 Sep (tomorrow)');
    expect(daily[0]!.text).toContain('<b>Beatty St</b> · not confirmed for 9 days.');
    expect(log.lines).toContain('info Reminders go to Dominic on Telegram from 07:00 Sydney.');
    expect(log.lines.some((l) => l.startsWith('info Voice notes off:'))).toBe(true);
    expect(existsSync(join(dir, 'photos', 'telegram', '2026-09-16-0123456789ab.jpg'))).toBe(false);
    expect(log.lines).toContain('info Deleted 1 unfiled photo(s) left from before the restart: telegram/2026-09-16-0123456789ab.jpg.');
  });
});
