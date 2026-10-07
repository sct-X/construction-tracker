/**
 * Starting the bot inside the server process (long polling, no webhook:
 * nothing is exposed to the internet). Off, with a log line, when the token,
 * Dominic's user id or the LLM provider isn't configured.
 */
import type { Clock, Store } from '@ct/core';
import { createParser, createProviderFromEnv, type Parser } from '@ct/llm';
import { createBot, type BotHandle, type BotLog, type PhotoStore, type Transcriber } from './bot.js';

export interface StartBotOptions {
  store: Store;
  clock: Clock;
  log: BotLog;
  env: Record<string, string | undefined>;
  /** Default: from env (LLM_PROVIDER, LLM_MODEL, key). */
  parser?: Parser;
  transcriber?: Transcriber;
  photoStore?: PhotoStore;
}

export interface RunningBot {
  handle: BotHandle;
  stop(): Promise<void>;
}

export type BotConfig =
  | { ok: true; token: string; allowedUserId: string }
  | { ok: false; reason: string };

export function botConfigFromEnv(env: Record<string, string | undefined>): BotConfig {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return { ok: false, reason: 'TELEGRAM_BOT_TOKEN is not set' };
  const allowedUserId = (env.DOMINIC_TELEGRAM_USER_ID ?? env.TELEGRAM_ALLOWED_USER_ID)?.trim();
  if (!allowedUserId) return { ok: false, reason: 'DOMINIC_TELEGRAM_USER_ID is not set, so nobody would be allowed to use it' };
  if (!/^\d+$/.test(allowedUserId)) return { ok: false, reason: `DOMINIC_TELEGRAM_USER_ID must be a number, got "${allowedUserId}"` };
  return { ok: true, token, allowedUserId };
}

/** Starts long polling in the background. Resolves to null (and logs why) when the bot is off. */
export async function startBot(opts: StartBotOptions): Promise<RunningBot | null> {
  const { log } = opts;
  const config = botConfigFromEnv(opts.env);
  if (!config.ok) {
    log.info(`Telegram bot off: ${config.reason}.`);
    return null;
  }
  let parser = opts.parser;
  if (!parser) {
    try {
      parser = createParser(createProviderFromEnv(opts.env));
    } catch (e) {
      log.warn(`Telegram bot off: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }
  const handle = createBot({
    token: config.token,
    allowedUserId: config.allowedUserId,
    store: opts.store,
    clock: opts.clock,
    parser,
    log,
    ...(opts.transcriber ? { transcriber: opts.transcriber } : {}),
    ...(opts.photoStore ? { photoStore: opts.photoStore } : {}),
  });
  log.info(`Telegram bot starting (long polling); allowed user ${config.allowedUserId}.`);
  let stopping = false;
  const polling = handle.bot
    .start({
      allowed_updates: ['message', 'callback_query'],
      onStart: (me) => log.info(`Telegram bot @${me.username} is listening.`),
    })
    .catch((e: unknown) => {
      if (!stopping) log.error('Telegram bot stopped (check TELEGRAM_BOT_TOKEN and the network)', e);
    });
  return {
    handle,
    async stop() {
      stopping = true;
      await handle.bot.stop().catch(() => undefined);
      await polling;
    },
  };
}
