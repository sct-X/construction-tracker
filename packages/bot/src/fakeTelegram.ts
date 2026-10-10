/**
 * Fake Telegram for bot tests and the Playwright bot step (e2e: packages/server/scripts/bot-change.ts).
 * Not used by the running app. A real grammY Bot is
 * built with a preset botInfo and an API transformer that captures every
 * outgoing call (sendMessage, editMessageText, answerCallbackQuery, ...) and
 * returns fake results; updates are fed with bot.handleUpdate. Sent messages
 * are kept by id (with edits applied) so a test can reply to one or press
 * one of its buttons.
 *
 * Like Telegram, it insists on well-formed HTML: a sendMessage or editMessageText without parse_mode HTML,
 * or with markup Telegram would refuse (an unknown or unclosed tag, a bare "<" or "&"), gets a 400 "can't
 * parse entities" error. `text` is what Dominic reads (markup stripped); `html` is what was sent.
 */
import type { Transformer } from 'grammy';
import type { InlineKeyboardMarkup, Message, Update, UserFromGetMe } from 'grammy/types';
import { fixedClock, htmlToPlain, type Clock, type Store } from '@ct/core';
import type { Parser } from '@ct/llm';
import { createBot, type BotHandle, type BotLog } from './bot.js';
import type { FileDownloader, MediaStore } from './media.js';
import type { Transcriber } from './transcriber.js';

export const DOMINIC_ID = 424242;
export const STRANGER_ID = 999001;
export const CHAT_ID = DOMINIC_ID; // private chat id = user id

export const BOT_INFO: UserFromGetMe = {
  id: 1000001,
  is_bot: true,
  first_name: 'Tracker',
  username: 'ct_test_bot',
  can_join_groups: false,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
} as UserFromGetMe;

export interface ApiCall {
  method: string;
  payload: Record<string, unknown>;
}

export interface SentMessage {
  messageId: number;
  chatId: number;
  /** As Telegram shows it: markup stripped, entities decoded. */
  text: string;
  /** As sent (Telegram HTML). */
  html: string;
  /** Button callback data, flattened in order. */
  buttons: { text: string; data: string }[];
  markup: InlineKeyboardMarkup | undefined;
  /** Every text this message had, oldest first (edits append), as shown (markup stripped). */
  history: string[];
}

const TELEGRAM_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del', 'code', 'pre', 'a', 'tg-spoiler', 'span', 'blockquote', 'tg-emoji']);

/**
 * Why Telegram would refuse this HTML (parse_mode HTML), or null when it's fine: tags must be ones Telegram
 * knows, properly nested and closed, and every "<", ">" and "&" not part of a tag or entity must be escaped.
 */
export function telegramHtmlError(html: string): string | null {
  const stack: string[] = [];
  const token = /<\/?([a-z-]+)(\s[^<>]*)?>|&(#\d+|#x[0-9a-f]+|lt|gt|amp|quot);|[<>&]/gi;
  for (const m of html.matchAll(token)) {
    const t = m[0];
    if (t.startsWith('&') && t.length > 1) continue;
    if (t === '<' || t === '>' || t === '&') return `unescaped "${t}" at ${m.index}`;
    const name = m[1]!.toLowerCase();
    if (!TELEGRAM_TAGS.has(name)) return `unsupported tag <${name}>`;
    if (t.startsWith('</')) {
      if (stack.pop() !== name) return `unexpected end tag </${name}>`;
    } else stack.push(name);
  }
  return stack.length ? `unclosed <${stack.at(-1)}>` : null;
}

function refuseHtml(payload: Record<string, unknown>): { ok: false; error_code: 400; description: string } | null {
  if (payload.parse_mode !== 'HTML') return { ok: false, error_code: 400, description: 'Bad Request: fake Telegram expects parse_mode HTML on every message' };
  const err = telegramHtmlError(String(payload.text));
  return err ? { ok: false, error_code: 400, description: `Bad Request: can't parse entities: ${err}` } : null;
}

export function memoryBotLog(): BotLog & { lines: string[] } {
  const lines: string[] = [];
  return {
    lines,
    info: (m) => void lines.push(`info ${m}`),
    warn: (m) => void lines.push(`warn ${m}`),
    error: (m, e) => void lines.push(`error ${m}${e instanceof Error ? `: ${e.message}` : ''}`),
  };
}

function buttonsOf(markup: InlineKeyboardMarkup | undefined): { text: string; data: string }[] {
  return (markup?.inline_keyboard ?? []).flat().map((b) => ({ text: b.text, data: 'callback_data' in b ? (b.callback_data ?? '') : '' }));
}

export interface HarnessOptions {
  store: Store;
  clock: Clock;
  /** null = no language model configured (the bot then says so to typed messages). */
  parser: Parser | null;
  allowedUserId?: number;
  pendingTtlMs?: number;
  transcriber?: Transcriber;
  /** Where voice notes and photos go (diskMediaStore(tempDir) in tests). */
  media?: MediaStore;
  /** "/reminders" / "fire reminders" source (the server's manualReminderText in tests). */
  remindersNow?: () => Promise<string | null>;
}

/** A file "on Telegram's servers" for the fake getFile + downloader. */
export interface FakeTelegramFile {
  fileId: string;
  data: Uint8Array;
  /** Telegram's file_path (extension matters), e.g. "voice/file_1.oga". */
  path: string;
  /** getFile answers Telegram's "file is too big" (over 20 MB). */
  tooBig?: boolean;
}

export interface Harness {
  handle: BotHandle;
  log: BotLog & { lines: string[] };
  /** Every outgoing API call, in order. */
  calls: ApiCall[];
  /** Messages the bot sent, by id, with edits applied. */
  messages: Map<number, SentMessage>;
  /** Send a text as a user (default Dominic). Returns the API calls the bot made in response. */
  text(text: string, o?: { from?: number; replyTo?: number; chat?: { id: number; type: 'group' | 'supergroup' | 'channel' | 'private' } }): Promise<ApiCall[]>;
  /** Press an inline button on a bot message. Data can be the button's text or its callback data. */
  press(messageId: number, button: string, o?: { from?: number }): Promise<ApiCall[]>;
  /** Feed a raw update (Stage 3: voice notes, photos). */
  update(u: Omit<Update, 'update_id'>): Promise<ApiCall[]>;
  /** Files the fake Telegram serves, by file_id. */
  files: Map<string, FakeTelegramFile>;
  /** Send a voice note (bytes served through getFile + the fake downloader). */
  voice(data: Uint8Array, o?: { from?: number; duration?: number; caption?: string }): Promise<ApiCall[]>;
  /**
   * Send a compressed photo: Telegram sends several sizes; `data` is the largest. Smaller sizes get
   * other bytes so a test can tell which one was kept.
   */
  photo(data: Uint8Array, o?: { caption?: string; from?: number; mediaGroupId?: string; width?: number; height?: number }): Promise<ApiCall[]>;
  /** Send an image as a file (document with an image mime type): full resolution. */
  /** `fileSize` overrides the size Telegram reports (null = none reported); `tooBig` makes getFile refuse it. */
  document(data: Uint8Array, o?: { caption?: string; mime?: string; fileName?: string; from?: number; fileSize?: number | null; tooBig?: boolean }): Promise<ApiCall[]>;
  /** The id of the user message most recently fed (photos: what questions and cards reply to). */
  lastUserMessageId(): number;
  /** Texts the bot sent (sendMessage) in a slice of calls, or overall, as shown (markup stripped). */
  sent(calls?: ApiCall[]): string[];
  /** The same, as sent (Telegram HTML). */
  sentHtml(calls?: ApiCall[]): string[];
  /** The newest bot message carrying a button with this text. */
  lastWithButton(buttonText: string): SentMessage;
  /** The newest message the bot sent. */
  last(): SentMessage;
}

export function createHarness(o: HarnessOptions): Harness {
  const calls: ApiCall[] = [];
  const messages = new Map<number, SentMessage>();
  let nextBotMsg = 5000;
  let nextUserMsg = 100;
  let nextUpdate = 1;
  const date = Math.floor(o.clock.now().getTime() / 1000);

  const transport = (async (_prev: unknown, method: string, payload: Record<string, unknown>) => {
    calls.push({ method, payload });
    if (method === 'sendMessage' || method === 'editMessageText') {
      const refused = refuseHtml(payload);
      if (refused) return refused;
    }
    if (method === 'sendMessage') {
      const id = ++nextBotMsg;
      const markup = payload.reply_markup as InlineKeyboardMarkup | undefined;
      const html = String(payload.text);
      const text = htmlToPlain(html);
      const chatId = Number(payload.chat_id);
      messages.set(id, { messageId: id, chatId, text, html, markup, buttons: buttonsOf(markup), history: [text] });
      return {
        ok: true,
        result: { message_id: id, date, chat: { id: chatId, type: 'private', first_name: 'Dominic' }, from: BOT_INFO, text, ...(markup ? { reply_markup: markup } : {}) },
      };
    }
    if (method === 'editMessageText') {
      const m = messages.get(Number(payload.message_id));
      if (m) {
        m.html = String(payload.text);
        m.text = htmlToPlain(m.html);
        m.history.push(m.text);
        m.markup = payload.reply_markup as InlineKeyboardMarkup | undefined;
        m.buttons = buttonsOf(m.markup);
      }
      return { ok: true, result: { message_id: Number(payload.message_id), date, chat: { id: Number(payload.chat_id), type: 'private' }, text: String(payload.text) } };
    }
    if (method === 'getFile') {
      const f = files.get(String(payload.file_id));
      if (!f) return { ok: false, error_code: 400, description: 'Bad Request: invalid file_id' };
      if (f.tooBig) return { ok: false, error_code: 400, description: 'Bad Request: file is too big' };
      return { ok: true, result: { file_id: f.fileId, file_unique_id: `u-${f.fileId}`, file_size: f.data.length, file_path: f.path } };
    }
    return { ok: true, result: true };
  }) as unknown as Transformer;

  const files = new Map<string, FakeTelegramFile>();
  let nextFile = 1;
  const addFile = (data: Uint8Array, path: (id: string) => string): FakeTelegramFile => {
    const fileId = `file-${nextFile++}`;
    const f = { fileId, data, path: path(fileId) };
    files.set(fileId, f);
    return f;
  };
  const downloader: FileDownloader = {
    async download({ fileId, filePath }) {
      const f = files.get(fileId);
      if (!f || f.path !== filePath) throw new Error(`Fake Telegram has no file ${fileId} at ${filePath}`);
      return f.data;
    },
  };

  const log = memoryBotLog();
  const handle = createBot({
    token: 'test-token',
    allowedUserId: o.allowedUserId ?? DOMINIC_ID,
    store: o.store,
    clock: o.clock,
    parser: o.parser,
    log,
    transport,
    botInfo: BOT_INFO,
    downloader,
    ...(o.transcriber ? { transcriber: o.transcriber } : {}),
    ...(o.media ? { media: o.media } : {}),
    ...(o.remindersNow ? { remindersNow: o.remindersNow } : {}),
    ...(o.pendingTtlMs !== undefined ? { pendingTtlMs: o.pendingTtlMs } : {}),
  });

  const user = (id: number) => ({ id, is_bot: false, first_name: id === DOMINIC_ID ? 'Dominic' : 'Stranger' });

  async function feed(u: Omit<Update, 'update_id'>): Promise<ApiCall[]> {
    const start = calls.length;
    await handle.handleUpdate({ update_id: nextUpdate++, ...u } as Update);
    return calls.slice(start);
  }

  function asMessage(m: SentMessage): Message {
    return {
      message_id: m.messageId,
      date,
      chat: { id: m.chatId, type: 'private', first_name: 'Dominic' },
      from: BOT_INFO,
      text: m.text,
      ...(m.markup ? { reply_markup: m.markup } : {}),
    } as Message;
  }

  const userMessage = (from: number, extra: Record<string, unknown>) =>
    feed({
      message: { message_id: ++nextUserMsg, date, chat: { id: from, type: 'private', first_name: user(from).first_name }, from: user(from), ...extra } as unknown as Message,
    } as Omit<Update, 'update_id'>);

  return {
    handle,
    log,
    calls,
    messages,
    files,
    voice(data, opts = {}) {
      const f = addFile(data, (id) => `voice/${id}.oga`);
      return userMessage(opts.from ?? DOMINIC_ID, {
        voice: { file_id: f.fileId, file_unique_id: `u-${f.fileId}`, duration: opts.duration ?? 3, mime_type: 'audio/ogg', file_size: data.length },
        ...(opts.caption ? { caption: opts.caption } : {}),
      });
    },
    photo(data, opts = {}) {
      const w = opts.width ?? 1280;
      const h = opts.height ?? 960;
      const small = addFile(new Uint8Array([0xff, 0xd8, 0xff, 0x01]), (id) => `photos/${id}.jpg`);
      const mid = addFile(new Uint8Array([0xff, 0xd8, 0xff, 0x02]), (id) => `photos/${id}.jpg`);
      const big = addFile(data, (id) => `photos/${id}.jpg`);
      const size = (f: FakeTelegramFile, k: number) => ({ file_id: f.fileId, file_unique_id: `u-${f.fileId}`, width: Math.round(w / k), height: Math.round(h / k), file_size: f.data.length });
      return userMessage(opts.from ?? DOMINIC_ID, {
        // Out of order on purpose: the bot must pick the largest, not the last.
        photo: [size(mid, 2), size(big, 1), size(small, 4)],
        ...(opts.caption ? { caption: opts.caption } : {}),
        ...(opts.mediaGroupId ? { media_group_id: opts.mediaGroupId } : {}),
      });
    },
    document(data, opts = {}) {
      const mime = opts.mime ?? 'image/jpeg';
      const name = opts.fileName ?? 'IMG_0001.jpg';
      const f = addFile(data, (id) => `documents/${id}${name.slice(name.lastIndexOf('.'))}`);
      if (opts.tooBig) f.tooBig = true;
      const size = opts.fileSize === undefined ? data.length : opts.fileSize;
      return userMessage(opts.from ?? DOMINIC_ID, {
        document: { file_id: f.fileId, file_unique_id: `u-${f.fileId}`, file_name: name, mime_type: mime, ...(size === null ? {} : { file_size: size }) },
        ...(opts.caption ? { caption: opts.caption } : {}),
      });
    },
    lastUserMessageId: () => nextUserMsg,
    text(text, opts = {}) {
      const from = opts.from ?? DOMINIC_ID;
      const replied = opts.replyTo !== undefined ? messages.get(opts.replyTo) : undefined;
      const command = /^\/\w+/.exec(text);
      return feed({
        message: {
          message_id: ++nextUserMsg,
          date,
          chat: opts.chat ? { id: opts.chat.id, type: opts.chat.type, title: 'Site crew' } : { id: from, type: 'private', first_name: user(from).first_name },
          from: user(from),
          text,
          ...(command ? { entities: [{ type: 'bot_command', offset: 0, length: command[0].length }] } : {}),
          ...(replied ? { reply_to_message: asMessage(replied) } : {}),
        } as Message,
      } as Omit<Update, 'update_id'>);
    },
    press(messageId, button, opts = {}) {
      const m = messages.get(messageId);
      if (!m) throw new Error(`No bot message ${messageId}`);
      const b = m.buttons.find((x) => x.text === button || x.data === button);
      if (!b) throw new Error(`Message ${messageId} has no button "${button}" (has: ${m.buttons.map((x) => x.text).join(', ') || 'none'})`);
      const from = opts.from ?? DOMINIC_ID;
      return feed({
        callback_query: { id: `cb-${nextUpdate}`, from: user(from), chat_instance: 'ci', data: b.data, message: asMessage(m) },
      } as Omit<Update, 'update_id'>);
    },
    update: feed,
    sent(slice) {
      return (slice ?? calls).filter((c) => c.method === 'sendMessage').map((c) => htmlToPlain(String(c.payload.text)));
    },
    sentHtml(slice) {
      return (slice ?? calls).filter((c) => c.method === 'sendMessage').map((c) => String(c.payload.text));
    },
    lastWithButton(buttonText) {
      const found = [...messages.values()].reverse().find((m) => m.buttons.some((b) => b.text === buttonText));
      if (!found) throw new Error(`No bot message with a "${buttonText}" button`);
      return found;
    },
    last() {
      const all = [...messages.values()];
      if (!all.length) throw new Error('The bot has sent nothing');
      return all[all.length - 1]!;
    },
  };
}

/** A clock whose now() can be moved forward (pending-question expiry). today() stays fixed. */
export function steppingClock(today: string, time = '10:00'): Clock & { advance(ms: number): void } {
  const base = fixedClock(today, time);
  let offset = 0;
  return { today: () => base.today(), now: () => new Date(base.now().getTime() + offset), advance: (ms) => void (offset += ms) };
}
