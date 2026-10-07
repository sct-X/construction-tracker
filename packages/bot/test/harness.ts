/**
 * Fake Telegram for bot tests (Stage 2 and 3 reuse it). A real grammY Bot is
 * built with a preset botInfo and an API transformer that captures every
 * outgoing call (sendMessage, editMessageText, answerCallbackQuery, ...) and
 * returns fake results; updates are fed with bot.handleUpdate. Sent messages
 * are kept by id (with edits applied) so a test can reply to one or press
 * one of its buttons.
 */
import type { Transformer } from 'grammy';
import type { InlineKeyboardMarkup, Message, Update, UserFromGetMe } from 'grammy/types';
import type { Clock, Store } from '@ct/core';
import type { Parser } from '@ct/llm';
import { createBot, type BotHandle, type BotLog, type PhotoStore, type Transcriber } from '../src/index.js';

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
  text: string;
  /** Button callback data, flattened in order. */
  buttons: { text: string; data: string }[];
  markup: InlineKeyboardMarkup | undefined;
  /** Every text this message had, oldest first (edits append). */
  history: string[];
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
  parser: Parser;
  allowedUserId?: number;
  transcriber?: Transcriber;
  photoStore?: PhotoStore;
}

export interface Harness {
  handle: BotHandle;
  log: BotLog & { lines: string[] };
  /** Every outgoing API call, in order. */
  calls: ApiCall[];
  /** Messages the bot sent, by id, with edits applied. */
  messages: Map<number, SentMessage>;
  /** Send a text as a user (default Dominic). Returns the API calls the bot made in response. */
  text(text: string, o?: { from?: number; replyTo?: number }): Promise<ApiCall[]>;
  /** Press an inline button on a bot message. Data can be the button's text or its callback data. */
  press(messageId: number, button: string, o?: { from?: number }): Promise<ApiCall[]>;
  /** Feed a raw update (Stage 3: voice notes, photos). */
  update(u: Omit<Update, 'update_id'>): Promise<ApiCall[]>;
  /** Texts the bot sent (sendMessage) in a slice of calls, or overall. */
  sent(calls?: ApiCall[]): string[];
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
    if (method === 'sendMessage') {
      const id = ++nextBotMsg;
      const markup = payload.reply_markup as InlineKeyboardMarkup | undefined;
      const text = String(payload.text);
      const chatId = Number(payload.chat_id);
      messages.set(id, { messageId: id, chatId, text, markup, buttons: buttonsOf(markup), history: [text] });
      return {
        ok: true,
        result: { message_id: id, date, chat: { id: chatId, type: 'private', first_name: 'Dominic' }, from: BOT_INFO, text, ...(markup ? { reply_markup: markup } : {}) },
      };
    }
    if (method === 'editMessageText') {
      const m = messages.get(Number(payload.message_id));
      if (m) {
        m.text = String(payload.text);
        m.history.push(m.text);
        m.markup = payload.reply_markup as InlineKeyboardMarkup | undefined;
        m.buttons = buttonsOf(m.markup);
      }
      return { ok: true, result: { message_id: Number(payload.message_id), date, chat: { id: Number(payload.chat_id), type: 'private' }, text: String(payload.text) } };
    }
    return { ok: true, result: true };
  }) as unknown as Transformer;

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
    ...(o.transcriber ? { transcriber: o.transcriber } : {}),
    ...(o.photoStore ? { photoStore: o.photoStore } : {}),
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

  return {
    handle,
    log,
    calls,
    messages,
    text(text, opts = {}) {
      const from = opts.from ?? DOMINIC_ID;
      const replied = opts.replyTo !== undefined ? messages.get(opts.replyTo) : undefined;
      const command = /^\/\w+/.exec(text);
      return feed({
        message: {
          message_id: ++nextUserMsg,
          date,
          chat: { id: from, type: 'private', first_name: user(from).first_name },
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
