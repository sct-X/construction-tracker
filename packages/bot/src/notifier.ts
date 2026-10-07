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

/** Sends each notification to one chat (Dominic's private chat id = his user id). Throws when the (first) message
 * fails, so the scheduler releases the reminders and tries again later. Long texts are split on line breaks. */
export function createTelegramNotifier(api: Api, chatId: number | string): TelegramNotifier {
  return {
    async send(n) {
      const [first, ...rest] = splitText(n.text, MAX);
      // Only the first part decides success: if a later part fails, throwing would make the scheduler
      // resend the whole message (part 1 twice). A later part is tried twice, then given up.
      await api.sendMessage(chatId, first!);
      for (const part of rest) await api.sendMessage(chatId, part).catch(() => api.sendMessage(chatId, part).catch(() => undefined));
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
