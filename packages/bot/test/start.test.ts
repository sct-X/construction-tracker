// Starting the bot: off (with a log line) unless the token, Dominic's id and
// an LLM provider are configured; the server's startApp hook logs it either way.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_TODAY, fixedClock, InMemoryStore, buildSeed } from '@ct/core';
import { loadConfig, memoryLog, memoryNotifier, startApp, type RunningApp } from '@ct/server';
import { botConfigFromEnv, startBot } from '../src/index.js';
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
    expect(await startBot({ store, clock, log, env: { TELEGRAM_BOT_TOKEN: 't', DOMINIC_TELEGRAM_USER_ID: '42', LLM_PROVIDER: 'openai' } })).toBeNull();
    expect(log.lines).toEqual([
      'info Telegram bot off: TELEGRAM_BOT_TOKEN is not set.',
      'warn Telegram bot off: OPENAI_API_KEY is not set (needed for LLM_PROVIDER=openai).',
    ]);
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
