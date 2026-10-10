/**
 * Telegram HTML for the bot. Every message is sent with parse_mode HTML, so every piece of user, model or
 * database text goes through `esc` (core's escapeHtml, the one shared rule; the scheduler's reminders use it
 * too). Markup is written literally around escaped text, and a tag never spans a line break, so a message
 * can be split or clipped on lines without breaking the markup.
 *
 * Vocabulary (keep it this small): a bold first line saying what the message is about, "before → <b>after</b>",
 * "•" bullets, blank lines between blocks, the transcript as "Heard: <i>...</i>", and two marks only:
 * "⚠️ Overdue ..." and "Saved ✓".
 */
import { escapeHtml, htmlToPlain } from '@ct/core';

export { escapeHtml, htmlToPlain };

/** Escapes text for HTML parse mode. */
export const esc = (text: string): string => escapeHtml(text);
/** Bold, escaped. */
export const b = (text: string): string => `<b>${escapeHtml(text)}</b>`;
/** Italic, escaped. */
export const i = (text: string): string => `<i>${escapeHtml(text)}</i>`;
/** A list item. `html` is already escaped. */
export const bullet = (html: string): string => `• ${html}`;
/** The overdue mark, in words: "⚠️ Overdue by 3 days". `words` is plain, e.g. "overdue by 3 days". */
export const overdueMark = (words: string): string => `⚠️ ${escapeHtml(words.charAt(0).toUpperCase() + words.slice(1))}`;
export const SAVED_MARK = '✓';

/** "before → <b>after</b>" (both plain). */
export function beforeAfter(before: string, after: string): string {
  return `${escapeHtml(before)} → <b>${escapeHtml(after)}</b>`;
}

/** "Heard: <i>...</i>" for a voice note's transcript, clipped to 300 characters and on one line. */
export function heardLine(transcript: string): string {
  const t = transcript.replace(/\s+/g, ' ').trim();
  return `Heard: ${i(t.length > 300 ? `${t.slice(0, 299)}…` : t)}`;
}

/** Joins blocks (each already HTML) with a blank line, skipping empty ones. */
export function blocks(...parts: (string | null | undefined | false)[]): string {
  return parts.filter((p): p is string => !!p && p.trim() !== '').join('\n\n');
}

/**
 * Clips HTML to `max` characters without breaking a tag or an entity: whole lines are kept while they
 * fit; a single line too long on its own loses its markup and is cut as text.
 */
export function clipHtml(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.lastIndexOf('\n', max - 1);
  if (cut > 0) return `${text.slice(0, cut)}\n…`;
  return clipLine(text.split('\n')[0]!, max);
}

/** One line cut to fit `max` once escaped: the markup goes, the text is clipped with "…". */
export function clipLine(line: string, max: number): string {
  if (line.length <= max) return line;
  let plain = htmlToPlain(line);
  while (plain.length && escapeHtml(plain).length > max - 1) plain = plain.slice(0, Math.max(0, plain.length - Math.max(1, escapeHtml(plain).length - (max - 1))));
  return `${escapeHtml(plain)}…`;
}
