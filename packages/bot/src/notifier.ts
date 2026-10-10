/**
 * Reminders to Dominic on Telegram. Matches the server's Notifier
 * (`send({ text, reminders })`) structurally, so the bot needn't import the
 * server (the server depends on the bot, not the other way round).
 */
import type { Api } from 'grammy';
import { clipLine } from './html.js';

export interface ReminderNotification {
  /** Telegram HTML (the server's reminder digest escapes job and item names). */
  text: string;
  reminders?: unknown[];
}

export interface TelegramNotifier {
  send(n: ReminderNotification): Promise<void>;
}

/** Telegram's message limit. */
const MAX = 4096;

/** Sends each notification to one chat (Dominic's private chat id = his user id). Throws when the (first) message
 * fails, so the scheduler releases the reminders and tries again later. Long texts are split on line breaks. */
export function createTelegramNotifier(api: Api, chatId: number | string): TelegramNotifier {
  return {
    async send(n) {
      const [first, ...rest] = splitText(n.text, MAX);
      // Only the first part decides success: if a later part fails, throwing would make the scheduler
      // resend the whole message (part 1 twice). A later part is tried twice, then given up.
      const html = { parse_mode: 'HTML' } as const;
      await api.sendMessage(chatId, first!, html);
      for (const part of rest) await api.sendMessage(chatId, part, html).catch(() => api.sendMessage(chatId, part, html).catch(() => undefined));
    },
  };
}

/**
 * Splits a long message on line breaks into parts of at most `max` characters. Safe for Telegram HTML: no
 * tag spans a line, and a single line too long on its own is clipped as text (its markup dropped).
 */
export function splitText(text: string, max = MAX): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let cur = '';
  for (const line of text.split('\n')) {
    const add = cur ? `${cur}\n${line}` : line;
    if (add.length <= max) {
      cur = add;
      continue;
    }
    if (cur) out.push(cur);
    cur = clipLine(line, max);
  }
  if (cur) out.push(cur);
  // A part never starts or ends on a blank line (the blank lines between blocks stay inside parts).
  return out.map((p) => p.replace(/^\n+|\n+$/g, '')).filter(Boolean);
}
