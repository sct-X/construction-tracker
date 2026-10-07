/**
 * Reminders to Dominic on Telegram. Matches the server's Notifier
 * (`send({ text, reminders })`) structurally, so the bot needn't import the
 * server (the server depends on the bot, not the other way round).
 */
import type { Api } from 'grammy';

export interface ReminderNotification {
  text: string;
  reminders?: unknown[];
}

export interface TelegramNotifier {
  send(n: ReminderNotification): Promise<void>;
}

const MAX = 4000;

/** Sends each notification to one chat (Dominic's private chat id = his user id). Throws on failure, so the
 * scheduler releases the reminders and tries again next minute. Long texts are split on line breaks. */
export function createTelegramNotifier(api: Api, chatId: number | string): TelegramNotifier {
  return {
    async send(n) {
      for (const part of splitText(n.text, MAX)) await api.sendMessage(chatId, part);
    },
  };
}

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
    cur = line.length > max ? line.slice(0, max - 1) + '…' : line;
  }
  if (cur) out.push(cur);
  return out;
}
