/**
 * Writes what the bot and the scheduler send, one sample per message type, to a Markdown file, using the fake
 * Telegram harness on the seed with the clock fixed at Thu 17 Sep 2026 (no bot token, no network).
 *
 *   npx tsx --tsconfig packages/bot/tsconfig.json packages/bot/test/telegramSamples.ts docs/telegram-samples-after.md
 *
 * Each sample shows the raw text sent (HTML parse mode) and how it reads with the markup taken off.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_TODAY, fixedClock, type Store } from '@ct/core';
import { createParser, FakeLlm, toolCall, type LlmResponse, type Parser } from '@ct/llm';
import { dataPaths, ensureDataDirs, fireReminders, manualReminderText, memoryNotifier, seedDatabase, SqliteStore } from '@ct/server';
import { diskMediaStore, FakeTranscriber, htmlToPlain } from '../src/index.js';
import { createHarness, type Harness, type SentMessage } from './harness.js';

const out = process.argv[2];
if (!out) throw new Error('Usage: telegramSamples.ts <output.md>');

const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));
const clock = fixedClock(DEFAULT_TODAY, '10:00');

interface Sample {
  title: string;
  note?: string;
  html: string;
  buttons?: string[];
}
const samples: Sample[] = [];

const htmlOf = (m: SentMessage) => m.html;
const add = (title: string, html: string, buttons: string[] = [], note?: string) => samples.push({ title, html, buttons, ...(note ? { note } : {}) });
const addMsg = (title: string, m: SentMessage, note?: string) => add(title, htmlOf(m), m.buttons.map((b) => b.text), note);
const lastSent = (h: Harness, calls: { method: string; payload: Record<string, unknown> }[]) =>
  calls.filter((c) => c.method === 'sendMessage').map((c) => String(c.payload.text));

async function withBot(script: LlmResponse[] | Parser | null, run: (h: Harness, store: SqliteStore) => Promise<void>, voice: string[] = []) {
  const dir = mkdtempSync(join(tmpdir(), 'ct-samples-'));
  const paths = ensureDataDirs(dataPaths(dir));
  const store = new SqliteStore(paths.dbFile, { clock });
  seedDatabase(store);
  const parser = script === null ? null : Array.isArray(script) ? createParser(new FakeLlm(script)) : script;
  const h = createHarness({
    store: store as Store,
    clock,
    parser,
    transcriber: new FakeTranscriber(voice),
    media: diskMediaStore(paths.dataDir),
    remindersNow: async () => manualReminderText(store.load(), clock.today()),
  });
  try {
    await run(h, store);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

const eta = (d: string) => toolCall('set_shipment_eta', { shipment: 'windows', job: 'Park Rd', eta: d });

// 1, 6, 7. Flow a: the confirm card, the Saved edit, /undo.
await withBot([eta('16 Nov')], async (h) => {
  await h.text('Park Rd windows now arriving 16 Nov');
  const card = h.lastWithButton('Confirm');
  addMsg('Confirm card (flow a: "Park Rd windows now arriving 16 Nov")', card);
  await h.press(card.messageId, 'Confirm');
  addMsg('Saved (the card after Confirm)', h.messages.get(card.messageId)!);
  const undo = await h.text('/undo');
  add('Undo (/undo reply)', lastSent(h, undo).join('\n\n'));
  addMsg('Undone (the card after undo)', h.messages.get(card.messageId)!);
});

// Cancel and Edit outcomes.
await withBot([eta('16 Nov'), eta('9 Nov')], async (h) => {
  await h.text('Park Rd windows now arriving 16 Nov');
  const card = h.lastWithButton('Confirm');
  await h.press(card.messageId, 'Cancel');
  addMsg('Cancelled (the card after Cancel)', h.messages.get(card.messageId)!);
  await h.text('Park Rd windows now arriving 9 Nov');
  const second = h.lastWithButton('Confirm');
  const asked = await h.press(second.messageId, 'Edit');
  addMsg('Edit (the card after Edit)', h.messages.get(second.messageId)!);
  add('Edit (the follow-up question)', lastSent(h, asked).join('\n\n'));
});

// 2. A multi-field card: booked with an expected date (status + expected date, one card).
await withBot([toolCall('set_item_status', { item: 'pump', job: 'Seaview', status: 'ordered_or_booked', expectedDate: 'Fri 2 Oct' })], async (h) => {
  await h.text('pump booked at seaview for fri 2 oct');
  addMsg('Multi-field card ("pump booked at seaview for fri 2 oct")', h.lastWithButton('Confirm'));
});

// A card for an unconfirmed job (rule 7 in words).
await withBot([toolCall('confirm_job', { job: 'Beatty' })], async (h) => {
  await h.text('beatty all checked');
  addMsg('Confirm card, job confirmed again ("beatty all checked")', h.lastWithButton('Confirm'));
});

// 3. The photo card (hold-point progress).
await withBot([toolCall('attach_photo', { job: 'Seaview', category: 'plumbing under slab' })], async (h) => {
  const calls = await h.photo(fixture('plumbing.jpg'), { caption: 'Seaview plumbing under slab' });
  const sent = lastSent(h, calls);
  add('Photo tip (first compressed photo only)', sent[0]!);
  const card = h.lastWithButton('Confirm');
  addMsg('Photo card (caption "Seaview plumbing under slab")', card);
  await h.press(card.messageId, 'Confirm');
  addMsg('Photo saved (the card after Confirm)', h.messages.get(card.messageId)!);
});

// 4. Ambiguity question with buttons, and the question after a pick.
await withBot([toolCall('set_shipment_eta', { shipment: 'the windows' })], async (h) => {
  await h.text('the windows are late');
  const q = h.last();
  addMsg('Ambiguity question ("the windows are late")', q);
  const pressed = await h.press(q.messageId, 'Park Rd windows (Park Rd)');
  addMsg('Question after a button is pressed (edited)', h.messages.get(q.messageId)!);
  add('Next question (no buttons)', lastSent(h, pressed).join('\n\n'));
});

// 5. Hold-point refusal (flow b, a voice note) and a voice card.
await withBot([toolCall('mark_step_done', { step: 'slab inspection', job: 'Seaview' }), toolCall('confirm_job', { job: 'Beatty' })], async (h) => {
  const calls = await h.voice(fixture('voice.ogg'));
  add('Hold-point refusal (flow b, voice note "slab inspection at Seaview is done")', lastSent(h, calls).join('\n\n'));
  await h.voice(fixture('voice.ogg'));
  addMsg('Voice note card ("beatty all checked", spoken)', h.lastWithButton('Confirm'));
}, ['slab inspection at Seaview is done', 'beatty all checked']);

// 8-10. Read answers.
await withBot(
  [
    toolCall('get_job_finish', { job: 'Park Rd' }),
    toolCall('get_waiting_on', { job: 'Park Rd' }),
    toolCall('get_waiting_on', { job: 'Beatty' }),
    toolCall('get_waiting_on', {}),
    toolCall('get_shipments', {}),
    toolCall('get_why_it_moved', { job: 'Beatty St' }),
    toolCall('get_next_hold_point', { job: 'Seaview' }),
    toolCall('get_to_chase', {}),
    toolCall('get_job_finish', { job: 'West St' }),
  ],
  async (h) => {
    const ask = async (title: string, text: string) => add(title, lastSent(h, await h.text(text)).join('\n\n'));
    await ask('Finish answer ("what\'s Park Rd\'s finish?")', "what's Park Rd's finish?");
    await ask('Waiting-on answer ("what are we waiting on at Park Rd?")', 'what are we waiting on at Park Rd?');
    await ask('Waiting-on answer ("what are we waiting on at Beatty?")', 'what are we waiting on at Beatty?');
    await ask('Waiting-on answer, all jobs ("what are we waiting on?")', 'what are we waiting on?');
    await ask('Shipments answer ("where are the shipments at?")', 'where are the shipments at?');
    await ask('Why it moved ("why did Beatty slip?")', 'why did Beatty slip?');
    await ask('Next hold point ("are we right for the slab inspection at Seaview?")', 'are we right for the slab inspection at Seaview?');
    await ask('To chase ("what do I need to chase?")', 'what do I need to chase?');
    await ask('Design job finish ("what\'s West St\'s finish?")', "what's West St's finish?");
  },
);

// 11. The daily reminder digest (the scheduler's fireReminders), Thu 17 Sep and, for a longer one, Sat 10 Oct.
for (const day of [DEFAULT_TODAY, '2026-10-10']) {
  const dir = mkdtempSync(join(tmpdir(), 'ct-samples-'));
  const store = new SqliteStore(ensureDataDirs(dataPaths(dir)).dbFile, { clock: fixedClock(day, '07:30') });
  seedDatabase(store);
  const n = memoryNotifier();
  await fireReminders(store, fixedClock(day, '07:30'), n);
  add(`Daily reminder digest (scheduler, ${day === DEFAULT_TODAY ? 'Thu 17 Sep' : 'Sat 10 Oct, seed unchanged: a long one'})`, n.sent[0]?.text ?? '(nothing sent)');
  store.close();
  rmSync(dir, { recursive: true, force: true });
}

// 12. /reminders.
await withBot([], async (h) => {
  add('/reminders', lastSent(h, await h.text('/reminders')).join('\n\n'));
});

// 13. Errors and other one-liners.
await withBot(
  { async parse() { throw new Error('provider down'); } } as unknown as Parser,
  async (h) => {
    add('Error: the language model did not answer', lastSent(h, await h.text('Park Rd windows now arriving 16 Nov')).join('\n\n'));
  },
);
await withBot(
  { async parse() { return { kind: 'ops', calls: null }; } } as unknown as Parser,
  async (h) => {
    add('Error: something went wrong on our side', lastSent(h, await h.text('Park Rd windows now arriving 16 Nov')).join('\n\n'));
  },
);
await withBot(null, async (h) => {
  add('Error: no model key', lastSent(h, await h.text('Park Rd windows now arriving 16 Nov')).join('\n\n'));
});
await withBot([toolCall('get_job_finish', { job: 'Nowhere Rd' })], async (h) => {
  add('Error: no such job', lastSent(h, await h.text("what's Nowhere Rd's finish?")).join('\n\n'));
  add('/undo with no card to reply to (the seed: undoes the seeded voice-note change)', lastSent(h, await h.text('/undo')).join('\n\n'));
  add('Error: not a photo', lastSent(h, await h.document(new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c]), { mime: 'image/jpeg', fileName: 'x.jpg' })).join('\n\n'));
  add('/help', lastSent(h, await h.text('/help')).join('\n\n'));
});

const fence = (s: string) => `\`\`\`\n${s}\n\`\`\``;
const body = samples
  .map((s) => {
    const btn = s.buttons?.length ? `\nButtons: ${s.buttons.map((b) => `[${b}]`).join(' ')}\n` : '';
    return `## ${s.title}\n\nRaw (parse_mode HTML):\n\n${fence(s.html)}\n\nAs Dominic reads it (markup stripped):\n\n${fence(htmlToPlain(s.html))}\n${btn}`;
  })
  .join('\n');
const head =
  '# Telegram samples, after\n\n' +
  'What the bot and the scheduler send after the formatting change (Telegram HTML parse mode), from the fake Telegram harness on the seed, ' +
  'clock fixed at Thu 17 Sep 2026 (the long digest: Sat 10 Oct). Each sample shows the raw HTML sent, then the same text with the markup ' +
  'stripped (Telegram shows the `<b>` parts bold and the `<i>` parts in italics). Before: docs/telegram-samples-before.md.\n\n' +
  'Vocabulary: a bold first line saying what it is about; "before → **after**" on its own line; blank lines between blocks; "•" bullets; ' +
  'the transcript as "Heard: *...*"; two marks only, "⚠️ Overdue by ..." and "Saved ✓".\n\n' +
  'Regenerate: `npx tsx --tsconfig packages/bot/tsconfig.json packages/bot/test/telegramSamples.ts docs/telegram-samples-after.md`\n\n';
writeFileSync(out, head + body);
console.log(`Wrote ${samples.length} samples to ${out}`);
