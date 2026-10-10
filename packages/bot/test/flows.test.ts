/**
 * Integration tests, one per bot flow: the real bot (grammY, fake transport)
 * over the server's SqliteStore on a temporary file (migrations + seed),
 * the real parser over a scripted FakeLlm, fixed clock Thu 17 Sep 2026.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_TODAY, fixedClock, PARK_RD, PARK_RD_WINDOWS, type MondayView, type WhyItMoved } from '@ct/core';
import { createParser, FakeLlm, textReply, toolCall, type LlmResponse } from '@ct/llm';
import { buildServer, dataPaths, ensureDataDirs, seedDatabase, SqliteStore } from '@ct/server';
import { createHarness, DOMINIC_ID, STRANGER_ID, type Harness } from './harness.js';

const clock = fixedClock(DEFAULT_TODAY, '10:00');

let dir: string;
let store: SqliteStore;
let apiStore: SqliteStore;
let app: FastifyInstance;
let llm: FakeLlm;
let h: Harness;
let seedChangeSets: number;
let seedInbound: number;

async function setup(script: LlmResponse[]) {
  llm = new FakeLlm(script);
  h = createHarness({ store, clock, parser: createParser(llm) });
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'ct-bot-'));
  const paths = ensureDataDirs(dataPaths(dir));
  store = new SqliteStore(paths.dbFile, { clock });
  seedDatabase(store);
  // The HTTP API on the same database file, through its own connection.
  apiStore = new SqliteStore(paths.dbFile, { clock });
  app = await buildServer({ store: apiStore, clock, paths, webDist: join(dir, 'web') });
  const ds = store.load();
  seedChangeSets = ds.changeSets.length;
  seedInbound = ds.inboundMessages.length;
});

afterEach(async () => {
  await app.close();
  apiStore.close();
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

async function rpc<T>(method: string, ...args: unknown[]): Promise<T> {
  const res = await app.inject({ method: 'POST', url: `/api/rpc/${method}`, payload: { args } });
  expect(res.statusCode, res.body).toBe(200);
  return res.json<{ result: T }>().result;
}

async function parkRd() {
  const m = await rpc<MondayView>('getMonday');
  return m.builds.find((b) => b.jobId === PARK_RD)!;
}

const windowsEta = () => store.load().shipments.find((s) => s.id === PARK_RD_WINDOWS)!.eta;
const changeSets = () => store.load().changeSets;
const newChangeSets = () => changeSets().slice(seedChangeSets);

const etaCall = (eta: string, shipment = 'windows', job: string | undefined = 'Park Rd') =>
  toolCall('set_shipment_eta', { shipment, ...(job ? { job } : {}), eta });

describe('flow a: change, confirm card, Confirm, API, /undo', () => {
  it('"Park Rd windows now arriving 16 Nov" -> card -> Confirm -> API Fri 12 Mar 2027 -> /undo -> Fri 26 Feb 2027', async () => {
    await setup([etaCall('16 Nov')]);
    await h.text('Park Rd windows now arriving 16 Nov');

    // The message is saved as an inbound Telegram message.
    const inbound = store.load().inboundMessages.slice(seedInbound);
    expect(inbound).toHaveLength(1);
    expect(inbound[0]).toMatchObject({ channel: 'telegram', sender: String(DOMINIC_ID), rawText: 'Park Rd windows now arriving 16 Nov' });

    // The parser got the context it needs.
    expect(llm.requests).toHaveLength(1);

    const card = h.lastWithButton('Confirm');
    expect(card.buttons.map((b) => b.text)).toEqual(['Confirm', 'Edit', 'Cancel']);
    // Telegram HTML: a bold title, before → <b>after</b>, the impact as its own block.
    expect(h.calls.find((c) => c.method === 'sendMessage')!.payload.parse_mode).toBe('HTML');
    expect(card.html.split('\n')[0]).toBe('<b>Park Rd · Windows ETA</b>');
    expect(card.html).toContain('\n\nMon 26 Oct → <b>Mon 16 Nov</b>\n\n');
    expect(card.text).toContain('Install windows: Mon 2 Nov → Mon 16 Nov');
    expect(card.html).toContain('Finish Fri 26 Feb 2027 → <b>Fri 12 Mar 2027</b>');
    expect(card.text).toContain('+14 days · $9,000 holding cost since last Monday');
    expect(card.text).toMatch(/\n\nSave this\?$/);

    // Recorded as proposed, linked to the message, nothing applied yet.
    const [proposed] = newChangeSets();
    expect(proposed).toMatchObject({ status: 'proposed', messageId: inbound[0]!.id, opName: 'set_shipment_eta' });
    expect(windowsEta()).toBe('2026-10-26');
    expect((await parkRd()).forecastFinish).toBe('2027-02-26');

    await h.press(card.messageId, 'Confirm');
    expect(h.messages.get(card.messageId)!.html).toMatch(/^<b>Saved ✓<\/b>\nPark Rd windows ETA Mon 26 Oct to Mon 16 Nov\./);
    expect(h.messages.get(card.messageId)!.text).toContain('Park Rd finishes Fri 12 Mar 2027: +14 days · $9,000 holding cost since last Monday');
    expect(h.messages.get(card.messageId)!.buttons.map((b) => b.text)).toEqual(['Undo']);
    expect(h.calls.some((c) => c.method === 'answerCallbackQuery')).toBe(true);

    // The HTTP API (its own connection to the same file) sees the change.
    const after = await parkRd();
    expect(after).toMatchObject({ forecastFinish: '2027-03-12', slipDays: 14, slipCost: 9000 });
    const why = await rpc<WhyItMoved>('getWhyItMoved', PARK_RD);
    expect(why.causes.map((c) => c.sourceText)).toContain('Park Rd windows now arriving 16 Nov');

    const undoCalls = await h.text('/undo');
    expect(h.sentHtml(undoCalls).join('\n')).toContain('<b>Undone</b>\nPark Rd windows ETA Mon 26 Oct to Mon 16 Nov.');
    expect(h.sent(undoCalls).join('\n')).toContain('Park Rd finishes Fri 26 Feb 2027, on track');
    expect(h.messages.get(card.messageId)!.text).toMatch(/^Undone\nPark Rd windows ETA/);
    expect((await parkRd()).forecastFinish).toBe('2027-02-26');
    expect(newChangeSets()[0]!.status).toBe('undone');
    expect(llm.remaining).toBe(0);
  });
});

describe('flow d: ambiguity becomes a question, nothing saved', () => {
  it('"the windows are late" -> asks which job (Park Rd / Seaview St) and saves no change set', async () => {
    await setup([toolCall('set_shipment_eta', { shipment: 'the windows' })]);
    const calls = await h.text('the windows are late');
    const [question] = h.sent(calls);
    expect(question).toBe('Which shipment do you mean by "the windows"?');
    const q = h.last();
    expect(q.buttons.map((b) => b.text)).toEqual(['Park Rd windows (Park Rd)', 'Seaview St windows (Seaview St)']);
    expect(changeSets()).toHaveLength(seedChangeSets);
    expect(windowsEta()).toBe('2026-10-26');
  });

  it('the answer resumes the operation: button for the job, then the missing ETA re-parsed with the thread -> a card', async () => {
    await setup([
      toolCall('set_shipment_eta', { shipment: 'the windows' }),
      textReply('16 Nov what?'), // "16 Nov" alone is not a change: it answers the open question
      etaCall('16 Nov', 'Park Rd windows', undefined), // parsed again with the thread
    ]);
    await h.text('the windows are late');
    const q = h.last();
    const pressed = await h.press(q.messageId, 'Park Rd windows (Park Rd)');
    expect(h.messages.get(q.messageId)!.html).toContain('→ <b>Park Rd windows (Park Rd)</b>');
    expect(h.sent(pressed)).toEqual(['What is the new ETA?']);
    expect(changeSets()).toHaveLength(seedChangeSets);

    await h.text('16 Nov');
    const card = h.lastWithButton('Confirm');
    expect(card.text).toContain('Install windows: Mon 2 Nov → Mon 16 Nov');
    expect(newChangeSets()).toHaveLength(1);
    // The change set links to the first message, not the answer.
    const original = store.load().inboundMessages.find((m) => m.rawText === 'the windows are late')!;
    expect(newChangeSets()[0]!.messageId).toBe(original.id);
    expect(llm.requests.map((r) => r.messages.map((m) => m.content))).toEqual([
      ['the windows are late'],
      ['16 Nov'],
      ['the windows are late', 'Which shipment do you mean by "the windows"?', 'Park Rd windows (Park Rd)', 'What is the new ETA?', '16 Nov'],
    ]);
    // Change history quotes the message that started it.
    const [entry] = await rpc<{ message: { rawText: string } }[]>('getChangeHistory', { statuses: ['proposed'] });
    expect(entry!.message.rawText).toBe('the windows are late');
  });

  it("the parser's own question is asked, and the reply is parsed with that history", async () => {
    await setup([
      toolCall('ask_question', { question: 'Which job, Park Rd or Seaview St?' }),
      toolCall('get_job_finish', { job: 'Park Rd' }), // "Park Rd" alone: not a change
      etaCall('16 Nov'),
    ]);
    const calls = await h.text('windows moved to 16 Nov');
    expect(h.sent(calls)).toEqual(['Which job, Park Rd or Seaview St?']);
    expect(changeSets()).toHaveLength(seedChangeSets);
    await h.text('Park Rd');
    expect(llm.requests[1]!.messages.map((m) => m.content)).toEqual(['Park Rd']);
    expect(llm.requests[2]!.messages.map((m) => m.content)).toEqual(['windows moved to 16 Nov', 'Which job, Park Rd or Seaview St?', 'Park Rd']);
    const original = store.load().inboundMessages.find((m) => m.rawText === 'windows moved to 16 Nov')!;
    expect(newChangeSets()[0]!.messageId).toBe(original.id);
    expect(h.lastWithButton('Confirm').text).toContain('Finish Fri 26 Feb 2027 → Fri 12 Mar 2027');
  });
});

describe('flow e: allowlist', () => {
  it('a message from another Telegram user gets no reply, saves nothing, and is logged', async () => {
    await setup([etaCall('16 Nov')]);
    const calls = await h.text('Park Rd windows now arriving 16 Nov', { from: STRANGER_ID });
    expect(calls).toEqual([]);
    expect(store.load().inboundMessages).toHaveLength(seedInbound);
    expect(changeSets()).toHaveLength(seedChangeSets);
    expect(llm.requests).toHaveLength(0);
    expect(h.log.lines.some((l) => l.startsWith('warn Ignored a text message from Telegram user 999001'))).toBe(true);
  });

  it("a stranger pressing Dominic's Confirm button does nothing", async () => {
    await setup([etaCall('16 Nov')]);
    await h.text('Park Rd windows now arriving 16 Nov');
    const card = h.lastWithButton('Confirm');
    const calls = await h.press(card.messageId, 'Confirm', { from: STRANGER_ID });
    expect(calls).toEqual([]);
    expect(newChangeSets()[0]!.status).toBe('proposed');
    expect(h.log.lines.some((l) => l.includes('Ignored a button press from Telegram user 999001'))).toBe(true);
  });
});

describe('Edit and Cancel', () => {
  it('Edit cancels the card, asks for the correction, and the reply (parsed with history) makes a new card', async () => {
    await setup([etaCall('9 Nov'), etaCall('16 Nov')]);
    await h.text('Park Rd windows now arriving 9 Nov');
    const first = h.lastWithButton('Confirm');
    expect(first.text).toContain('Mon 26 Oct → Mon 9 Nov');

    const pressed = await h.press(first.messageId, 'Edit');
    expect(h.sent(pressed).join('\n')).toContain('Send the correction');
    expect(h.messages.get(first.messageId)!.buttons).toEqual([]);
    expect(newChangeSets()[0]!.status).toBe('cancelled');

    await h.text('no, 16 Nov');
    const history = llm.requests[1]!.messages.map((m) => m.content);
    expect(history[0]).toBe('Park Rd windows now arriving 9 Nov');
    expect(history.at(-1)).toBe('no, 16 Nov');
    expect(history.some((c) => c.includes('Park Rd windows ETA Mon 26 Oct to Mon 9 Nov'))).toBe(true);

    const second = h.lastWithButton('Confirm');
    expect(second.messageId).not.toBe(first.messageId);
    expect(second.text).toContain('Install windows: Mon 2 Nov → Mon 16 Nov');
    const [old, fresh] = newChangeSets();
    expect(old!.status).toBe('cancelled');
    expect(fresh!.status).toBe('proposed');
    const correction = store.load().inboundMessages.find((m) => m.rawText === 'no, 16 Nov')!;
    expect(fresh!.messageId).toBe(correction.id);
    await h.press(second.messageId, 'Confirm');
    expect(windowsEta()).toBe('2026-11-16');
  });

  it('Cancel marks the change set cancelled and changes nothing', async () => {
    await setup([etaCall('16 Nov')]);
    await h.text('Park Rd windows now arriving 16 Nov');
    const card = h.lastWithButton('Confirm');
    await h.press(card.messageId, 'Cancel');
    expect(h.messages.get(card.messageId)!.html).toBe('<b>Cancelled</b> · nothing saved\nPark Rd windows ETA Mon 26 Oct to Mon 16 Nov.');
    expect(newChangeSets()[0]!.status).toBe('cancelled');
    expect(windowsEta()).toBe('2026-10-26');
    // A second press on the old card is harmless.
    expect(() => h.press(card.messageId, 'Confirm')).toThrow(/no button/);
  });

  it('a stale card (data changed since) says so plainly and offers a fresh card', async () => {
    await setup([etaCall('16 Nov'), etaCall('23 Nov')]);
    await h.text('Park Rd windows now arriving 16 Nov');
    const stale = h.lastWithButton('Confirm');
    await h.text('actually Park Rd windows 23 Nov');
    const other = h.lastWithButton('Confirm');
    await h.press(other.messageId, 'Confirm');
    expect(windowsEta()).toBe('2026-11-23');

    const calls = await h.press(stale.messageId, 'Confirm');
    expect(h.sent(calls)[0]).toMatch(/^That card was out of date: something changed since I made it, so nothing was saved\. Here's a fresh one\./);
    expect(h.messages.get(stale.messageId)!.text).toMatch(/^Out of date · nothing saved\nPark Rd windows ETA/);
    const fresh = h.lastWithButton('Confirm');
    expect(fresh.text).toContain('Park Rd · Windows ETA\n\nMon 23 Nov → Mon 16 Nov');
    expect(windowsEta()).toBe('2026-11-23');
    expect(newChangeSets().map((c) => c.status)).toEqual(['cancelled', 'confirmed', 'proposed']);
  });
});

describe('read-only questions', () => {
  it("\"what's Park Rd's finish?\" answers from the read models and creates no change set", async () => {
    await setup([toolCall('get_job_finish', { job: 'Park Rd' })]);
    const calls = await h.text("what's Park Rd's finish?");
    expect(h.sentHtml(calls)).toEqual(['<b>Park Rd · Finish</b>\n<b>Fri 26 Feb 2027</b>, on track']);
    expect(changeSets()).toHaveLength(seedChangeSets);
  });

  it('"what are we waiting on at Beatty?" lists a short list, no change set', async () => {
    await setup([toolCall('get_waiting_on', { job: 'Beatty' })]);
    const calls = await h.text('what are we waiting on at Beatty?');
    const [reply] = h.sent(calls);
    expect(h.sentHtml(calls)[0]).toMatch(/^<b>Beatty St · Waiting on<\/b>\n\d+ outstanding\n\n• /);
    expect(reply).toMatch(/tiler/i);
    expect(reply!.split('\n').length).toBeLessThanOrEqual(10);
    expect(changeSets()).toHaveLength(seedChangeSets);
    expect(changeSets().some((c) => c.status === 'proposed')).toBe(false);
  });

  it('why it moved, next hold point and plain replies also save nothing', async () => {
    await setup([
      toolCall('get_why_it_moved', { job: 'Beatty St' }),
      toolCall('get_next_hold_point', { job: 'Seaview' }),
      textReply('No worries.'),
    ]);
    const why = h.sent(await h.text('why did Beatty slip?'))[0]!;
    expect(why).toMatch(/^Beatty St · Why it moved\nFinishes Fri 4 Dec: \+5 days · \$1,430 holding cost since Mon 14 Sep\n/);
    expect(why).toContain('• Book tiler at Beatty St expected Mon 28 Sep to Mon 5 Oct: +7 days');
    expect(why).toContain('• 2 days earlier for reasons not in the change log');
    const hold = h.sent(await h.text('are we right for the slab inspection at Seaview?'))[0]!;
    expect(hold).toBe(
      'Seaview St · Next hold point\nSlab inspection before pour, Mon 28 Sep\n\n1 of 3 photo categories filled. Still need:\n• Plumbing under slab\n• Membrane and termite barrier',
    );
    expect(h.sent(await h.text('thanks'))).toEqual(['No worries.']);
    expect(changeSets()).toHaveLength(seedChangeSets);
  });
});

describe('undo', () => {
  async function confirmCard(text: string) {
    await h.text(text);
    const card = h.lastWithButton('Confirm');
    await h.press(card.messageId, 'Confirm');
    return card;
  }

  it('replying "undo" to a specific confirmation undoes that one, not the latest', async () => {
    await setup([etaCall('16 Nov'), toolCall('confirm_job', { job: 'Beatty' })]);
    const windows = await confirmCard('Park Rd windows now arriving 16 Nov');
    await confirmCard('Beatty all checked');
    const [a, b] = newChangeSets();
    expect([a!.status, b!.status]).toEqual(['confirmed', 'confirmed']);

    const calls = await h.text('undo', { replyTo: windows.messageId });
    expect(h.sent(calls)[0]).toMatch(/^Undone\nPark Rd windows ETA/);
    const [a2, b2] = newChangeSets();
    expect([a2!.status, b2!.status]).toEqual(['undone', 'confirmed']);
    expect(windowsEta()).toBe('2026-10-26');
    expect(llm.requests).toHaveLength(2); // "undo" never goes to the model
  });

  it('refuses in plain English when a later change touched the same field', async () => {
    await setup([etaCall('16 Nov'), etaCall('23 Nov')]);
    const first = await confirmCard('Park Rd windows now arriving 16 Nov');
    await confirmCard('Park Rd windows 23 Nov now');
    const calls = await h.text('undo', { replyTo: first.messageId });
    expect(h.sent(calls)[0]).toBe(
      'Not undone\nCan\'t undo "Park Rd windows ETA Mon 26 Oct to Mon 16 Nov": it was changed again since ("Park Rd windows ETA Mon 16 Nov to Mon 23 Nov"). Undo that first.',
    );
    expect(windowsEta()).toBe('2026-11-23');
    // /undo takes the latest, which is allowed.
    expect(h.sent(await h.text('/undo'))[0]).toMatch(/^Undone\nPark Rd windows ETA Mon 16 Nov to Mon 23 Nov\./);
    expect(windowsEta()).toBe('2026-11-16');
  });

  it('the Undo button on a saved card works, and "undo" after a restart reads the card\'s buttons', async () => {
    await setup([etaCall('16 Nov'), etaCall('23 Nov')]);
    const card = await confirmCard('Park Rd windows now arriving 16 Nov');
    const calls = await h.press(card.messageId, 'Undo');
    expect(h.sent(calls)[0]).toMatch(/^Undone\nPark Rd windows ETA/);
    expect(h.messages.get(card.messageId)!.buttons).toEqual([]);
    expect(windowsEta()).toBe('2026-10-26');

    const again = await confirmCard('Park Rd windows 23 Nov');
    // Forget the in-memory cards, as after a restart: the saved card's Undo button still names it.
    h.handle.cards.clear();
    const replied = await h.text('undo that', { replyTo: again.messageId });
    expect(h.sent(replied)[0]).toMatch(/^Undone\nPark Rd windows ETA Mon 26 Oct to Mon 23 Nov\./);
    expect(windowsEta()).toBe('2026-10-26');
  });
});

// ---------------------------------------------------------------------------
// Stage 6b (SPEC revision 2026-10-10): v1 rules in the bot's words
// ---------------------------------------------------------------------------

const SEAVIEW_PUMP = 'it-sv-pump';
const pump = () => store.load().items.find((i) => i.id === SEAVIEW_PUMP)!;
const bookPump = (extra: Record<string, string> = {}) =>
  toolCall('set_item_status', { item: 'pump', job: 'Seaview', status: 'ordered_or_booked', ...extra });

describe('"Booked needs an expected date": the bot asks, then resumes', () => {
  it('"booked the pump for seaview" -> "When is it expected?", nothing saved -> "next Thursday" -> card -> Confirm', async () => {
    await setup([
      bookPump(),
      textReply('Next Thursday for what?'), // "next Thursday" alone is not a change: it answers the open question
      bookPump({ expectedDate: 'next Thursday' }), // parsed again with the thread
    ]);
    const asked = await h.text('booked the pump for seaview');
    expect(h.sent(asked)).toEqual(['Book concrete pump at Seaview St needs an expected date to be ordered or booked. When is it expected?']);
    expect(h.last().buttons).toEqual([]);
    expect(changeSets()).toHaveLength(seedChangeSets);
    expect(pump()).toMatchObject({ status: 'to_do', expectedDate: null });

    await h.text('next Thursday');
    const card = h.lastWithButton('Confirm');
    expect(card.text.split('\n')[0]).toBe('Seaview St · Book concrete pump');
    expect(card.html).toContain('\nStatus: To do → <b>Ordered or booked</b>\nExpected date: none → <b>Thu 24 Sep</b>\n');
    // The thread the model saw: the message, core's question, the answer.
    expect(llm.requests[2]!.messages.map((m) => m.content)).toEqual([
      'booked the pump for seaview',
      'Book concrete pump at Seaview St needs an expected date to be ordered or booked. When is it expected?',
      'next Thursday',
    ]);
    // The change set links to the message that started it.
    const original = store.load().inboundMessages.find((m) => m.rawText === 'booked the pump for seaview')!;
    expect(newChangeSets()[0]!.messageId).toBe(original.id);

    await h.press(card.messageId, 'Confirm');
    // The saved card keeps core's summary.
    expect(h.messages.get(card.messageId)!.text).toContain('Saved ✓\nBook concrete pump at Seaview St: To do to Ordered or booked, expected Thu 24 Sep.');
    expect(pump()).toMatchObject({ status: 'ordered_or_booked', expectedDate: '2026-09-24' });
  });

  it('a date in the message itself gives a card straight away', async () => {
    await setup([bookPump({ expectedDate: 'Fri 2 Oct' })]);
    await h.text('pump booked at seaview for fri 2 oct');
    const card = h.lastWithButton('Confirm');
    expect(card.text).toContain('\nExpected date: none → Fri 2 Oct\n');
    expect(llm.requests).toHaveLength(1);
  });
});

describe('wording: late but not overdue, Pending approval, no amber', () => {
  it('waiting on: late-but-not-overdue in plain words; overdue says so and comes first', async () => {
    await setup([toolCall('get_waiting_on', { job: 'Beatty' }), toolCall('get_waiting_on', { job: 'Park Rd' })]);
    const beatty = h.sent(await h.text('what are we waiting on at Beatty?'))[0]!;
    // Expected Mon 5 Oct, needed Mon 28 Sep: both still ahead, so late, not overdue.
    expect(beatty).toContain('• Book tiler (Harbour Tiling): expected Mon 5 Oct, 7 days late (needed Mon 28 Sep)');
    expect(beatty).not.toMatch(/overdue/i);
    const park = h.sent(await h.text('what are we waiting on at Park Rd?'))[0]!;
    // Tile choice: needed Mon 14 Sep, nothing expected, not done: marked overdue, in words, first.
    expect(park.split('\n')[1]).toBe('27 outstanding, 3 overdue');
    expect(park.split('\n')[3]).toBe('• ⚠️ Overdue by 3 days: Tile choice (Dominic), needed Mon 14 Sep');
  });

  it('design stages "With council" / "With certifier" read "Pending approval"', async () => {
    await setup([toolCall('get_job_finish', { job: 'West St' }), toolCall('set_stage_status', { job: 'West St', stage: 'with council', status: 'done' })]);
    const finish = h.sent(await h.text("what's West St's finish?"))[0]!;
    expect(finish).toBe("West St · Finish\nWest St is a design job, so it has no finish date. It's at the Pending approval stage.");
    await h.text('west st approved by council');
    const card = h.lastWithButton('Confirm');
    expect(card.text).toMatch(/^West St · Pending approval status\n\nIn progress → Done\n/);
    expect(card.text).not.toMatch(/with council|with certifier/i);
  });

  it('confirming an unconfirmed job says how long it had gone, never "amber"', async () => {
    await setup([toolCall('confirm_job', { job: 'Beatty' })]);
    await h.text('beatty all checked');
    const card = h.lastWithButton('Confirm');
    expect(card.text).toContain("\nConfirmed again: it hadn't been confirmed for 9 days\n");
    expect(card.text).not.toMatch(/amber/i);
  });

  it('holding cost through the bot (off the web): a card with before and after; with none, the card has no $ line', async () => {
    await setup([toolCall('set_holding_cost', { job: 'Park Rd', dollars: 0 }), etaCall('16 Nov'), toolCall('set_holding_cost', { job: 'Seaview', dollars: 4500 })]);
    await h.text('park rd has no holding cost any more');
    const off = h.lastWithButton('Confirm');
    expect(off.text).toMatch(/^Park Rd · Weekly holding cost\n\n\$4,500\/wk → none\n/);
    await h.press(off.messageId, 'Confirm');
    expect(h.messages.get(off.messageId)!.text).toMatch(/^Saved ✓\nPark Rd holding cost removed \(was \$4,500\)\./);
    expect(store.load().jobs.find((j) => j.id === PARK_RD)!.weeklyHoldingCost).toBeNull();

    await h.text('Park Rd windows now arriving 16 Nov');
    const eta = h.lastWithButton('Confirm');
    expect(eta.text).toContain('Finish Fri 26 Feb 2027 → Fri 12 Mar 2027');
    expect(eta.text).toContain('\n+14 days since last Monday');
    expect(eta.text).not.toContain('$');
    expect(eta.text).not.toContain('holding cost');
    await h.press(eta.messageId, 'Cancel');

    await h.text('seaview holding cost is 4500 a week now');
    const sea = h.lastWithButton('Confirm');
    expect(sea.html).toContain('<b>Seaview St · Weekly holding cost</b>\n\n$3,800/wk → <b>$4,500/wk</b>');
  });
});

describe('Telegram HTML: user and database text is escaped', () => {
  it('a job, shipment and item named with <, > and & come through escaped on the card, the outcome and a read answer', async () => {
    store.db.prepare('UPDATE job SET name = ? WHERE id = ?').run('Park Rd <Lot 4> & Co', PARK_RD);
    store.db.prepare('UPDATE shipment SET name = ? WHERE id = ?').run('Windows <A&B>', PARK_RD_WINDOWS);
    store.db.prepare("UPDATE item SET title = ? WHERE job_id = ? AND title = 'Tile choice'").run('Tile choice <bath> & laundry', PARK_RD);
    await setup([
      toolCall('set_shipment_eta', { shipment: 'windows', job: 'Park Rd', eta: '16 Nov' }),
      toolCall('get_waiting_on', { job: 'Park Rd' }),
      textReply('Use <b> & </b> carefully'),
    ]);
    await h.text('Park Rd windows now arriving 16 Nov');
    // The fake Telegram refuses malformed HTML (as Telegram does), so a card at all means it parsed.
    const card = h.lastWithButton('Confirm');
    expect(card.html.split('\n')[0]).toBe('<b>Park Rd &lt;Lot 4&gt; &amp; Co · Windows &lt;A&amp;B&gt; ETA</b>');
    expect(card.text.split('\n')[0]).toBe('Park Rd <Lot 4> & Co · Windows <A&B> ETA');
    expect(card.html).toContain('Mon 26 Oct → <b>Mon 16 Nov</b>');
    await h.press(card.messageId, 'Confirm');
    const saved = h.messages.get(card.messageId)!;
    expect(saved.html).toMatch(/^<b>Saved ✓<\/b>\n/);
    expect(saved.html).toContain('Windows &lt;A&amp;B&gt;');
    expect(saved.html).toContain('Park Rd &lt;Lot 4&gt; &amp; Co finishes <b>Fri 12 Mar 2027</b>');
    expect(saved.text).toContain('Park Rd <Lot 4> & Co finishes Fri 12 Mar 2027');

    const [answer] = h.sentHtml(await h.text('what are we waiting on at Park Rd?'));
    expect(answer).toMatch(/^<b>Park Rd &lt;Lot 4&gt; &amp; Co · Waiting on<\/b>\n/);
    expect(answer).toContain('• ⚠️ Overdue by 3 days: Tile choice &lt;bath&gt; &amp; laundry (Dominic), needed Mon 14 Sep');

    expect(h.sentHtml(await h.text('thanks'))).toEqual(['Use &lt;b&gt; &amp; &lt;/b&gt; carefully']);
    // Nothing the bot sent was refused for bad markup.
    expect(h.log.lines.filter((l) => /can't parse entities/.test(l))).toEqual([]);
  });

  it('the fake Telegram refuses what Telegram would: no parse mode, an unclosed tag, a bare "<" or "&"', async () => {
    const { telegramHtmlError } = await import('../src/fakeTelegram.js');
    expect(telegramHtmlError('<b>Park Rd</b> · Mon 26 Oct → <b>Mon 16 Nov</b>')).toBeNull();
    expect(telegramHtmlError('Heard: <i>Smith &amp; Sons &lt;3&gt;</i>')).toBeNull();
    expect(telegramHtmlError('<b>Park Rd')).toMatch(/unclosed/);
    expect(telegramHtmlError('Smith & Sons')).toMatch(/unescaped/);
    expect(telegramHtmlError('a < b')).toMatch(/unescaped/);
    expect(telegramHtmlError('<div>x</div>')).toMatch(/unsupported/);
  });

  it('clipping and splitting at the 4096 limit never cut a tag or an entity', async () => {
    const { telegramHtmlError } = await import('../src/fakeTelegram.js');
    const { clipHtml, splitText } = await import('../src/index.js');
    const line = (n: number) => `• <b>Job ${n} &amp; Co</b>: act by Fri 18 Sep`;
    const long = Array.from({ length: 400 }, (_, n) => line(n)).join('\n');
    const parts = splitText(long, 4096);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect([p.length <= 4096, telegramHtmlError(p)]).toEqual([true, null]);
    expect(parts.join('\n')).toBe(long);
    const clipped = clipHtml(long, 4096);
    expect([clipped.length <= 4096, telegramHtmlError(clipped), clipped.endsWith('\n…')]).toEqual([true, null, true]);
    // One line longer than the limit loses its markup but stays valid.
    const huge = `<b>${'A &amp; B '.repeat(600)}</b>`;
    for (const p of [...splitText(huge, 4096), clipHtml(huge, 4096)]) expect([p.length <= 4096, telegramHtmlError(p)]).toEqual([true, null]);
  });
});
