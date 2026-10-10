/**
 * Telegram HTML parse mode: the one escaping rule for every text the bot and the scheduler send.
 * Lives in core because both @ct/bot and @ct/server (reminders) build Telegram text, and the server
 * must not load the bot (grammY) just to escape a job name.
 */

/**
 * Escapes user and database text for Telegram's HTML parse mode: `&`, `<` and `>` (Telegram's rule:
 * every one not part of a tag or an entity must be an entity). Quotes need no escaping outside attributes.
 */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** The text as Telegram shows it: tags removed, entities decoded (logs, tests, the samples doc). */
export function htmlToPlain(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}
