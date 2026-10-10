/**
 * Starting the bot inside the server process (long polling, no webhook:
 * nothing is exposed to the internet). Off, with a log line, when the token
 * or Dominic's user id isn't configured. With no language model (no key) it
 * still starts: reminders, /undo, /reminders and buttons work, and typed
 * messages get "add a model key to .env".
 */
import { HttpError, type Transformer } from 'grammy';
import type { Clock, Store } from '@ct/core';
import { createParser, createProviderFromEnv, type Parser } from '@ct/llm';
import { createBot, type BotHandle, type BotLog } from './bot.js';
import { diskMediaStore, type FileDownloader, type MediaStore } from './media.js';
import { createTelegramNotifier, type TelegramNotifier } from './notifier.js';
import { transcriberFromEnv, type Transcriber } from './transcriber.js';

export interface StartBotOptions {
  store: Store;
  clock: Clock;
  log: BotLog;
  env: Record<string, string | undefined>;
  /** Default: from env (LLM_PROVIDER, LLM_MODEL, key). */
  parser?: Parser;
  /** Default: from env (TRANSCRIBER=local|cloud, see transcriberFromEnv); none = voice notes off. */
  transcriber?: Transcriber;
  /** DATA_DIR: voice notes go in audio/, photos in photos/telegram/. */
  dataDir?: string;
  /** Default diskMediaStore(dataDir) when dataDir is given. */
  media?: MediaStore;
  downloader?: FileDownloader;
  /** "/reminders" and "fire reminders" (the server supplies it). */
  remindersNow?: () => Promise<string | null>;
}

export interface RunningBot {
  handle: BotHandle;
  /** Sends reminder messages to Dominic (his private chat id = his user id). The server's scheduler uses it. */
  notifier: TelegramNotifier;
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
  let parser: Parser | null = opts.parser ?? null;
  if (!parser) {
    try {
      parser = createParser(createProviderFromEnv(opts.env));
    } catch (e) {
      const reason = (e instanceof Error ? e.message : String(e)).replace(/\.$/, '');
      log.warn(
        `No language model: ${reason}. The bot still sends reminders and handles /undo, /reminders and buttons; ` +
          'typed messages and voice notes get "add a model key to .env" until a key is set.',
      );
    }
  }
  let transcriber = opts.transcriber;
  if (!transcriber) {
    const choice = transcriberFromEnv(opts.env);
    if (choice.ok) {
      transcriber = choice.transcriber;
      log.info(`Voice notes: ${choice.description}.`);
    } else log.info(`Voice notes off: ${choice.reason}.`);
  }
  const media = opts.media ?? (opts.dataDir ? diskMediaStore(opts.dataDir) : undefined);
  if (!media) log.warn('Voice notes and photos off: no data folder given to the bot.');
  const handle = createBot({
    token: config.token,
    allowedUserId: config.allowedUserId,
    store: opts.store,
    clock: opts.clock,
    parser,
    log,
    ...(transcriber ? { transcriber } : {}),
    ...(media ? { media } : {}),
    ...(opts.downloader ? { downloader: opts.downloader } : {}),
    ...(opts.remindersNow ? { remindersNow: opts.remindersNow } : {}),
    ...(opts.env.TELEGRAM_API_ROOT?.trim() ? { apiRoot: opts.env.TELEGRAM_API_ROOT.trim() } : {}),
  });
  handle.bot.api.config.use(pollingNetworkLog(log));
  log.info(`Telegram bot starting (long polling); allowed user ${config.allowedUserId}.`);
  await handle.sweepOrphanPhotos().catch((e: unknown) => log.error('Start-up photo tidy failed', e));
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
    notifier: createTelegramNotifier(handle.bot.api, config.allowedUserId),
    async stop() {
      stopping = true;
      await handle.bot.stop().catch(() => undefined);
      await polling;
    },
  };
}

/** The system error code inside a grammY HttpError (ETIMEDOUT, ENOTFOUND, ...), else its message. */
export function networkErrorCode(err: HttpError): string {
  const inner = err.error as { code?: unknown; cause?: { code?: unknown }; errors?: { code?: unknown }[] } | undefined;
  const code = inner?.code ?? inner?.cause?.code ?? inner?.errors?.[0]?.code;
  return typeof code === 'string' && code ? code : err.message;
}

/**
 * grammY retries a failed getUpdates every few seconds without a word (only
 * its debug log). This says it once per outage ("Can't reach Telegram,
 * retrying: ETIMEDOUT"), again only if the reason changes, and once when it
 * gets through. Cancelled polls (stopping) are not logged.
 */
export function pollingNetworkLog(log: BotLog): Transformer {
  let down: string | null = null;
  return async (prev, method, payload, signal) => {
    if (method !== 'getUpdates') return prev(method, payload, signal);
    try {
      const res = await prev(method, payload, signal);
      if (down !== null) log.info('Reached Telegram again.');
      down = null;
      return res;
    } catch (e) {
      if (e instanceof HttpError && !signal?.aborted) {
        const code = networkErrorCode(e);
        if (code !== down) log.warn(`Can't reach Telegram, retrying: ${code}`);
        down = code;
      }
      throw e;
    }
  };
}
