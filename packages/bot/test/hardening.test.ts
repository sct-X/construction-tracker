/**
 * Stage 2 review fixes: bot-owned args, attach_photo only from a real photo,
 * pending questions that expire or give way to a fresh request, private chats
 * only, polite errors, short model replies, a bot-level relative date.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_TODAY, type HistoryEntry, type Store } from '@ct/core';
import { createParser, FakeLlm, textReply, toolCall, type LlmResponse } from '@ct/llm';
import { buildServer, dataPaths, ensureDataDirs, seedDatabase, SqliteStore } from '@ct/server';
import { CHAT_ID, createHarness, DOMINIC_ID, steppingClock, type Harness } from './harness.js';

const clock = steppingClock(DEFAULT_TODAY);
let dir: string;
let store: SqliteStore;
let apiStore: SqliteStore;
let app: FastifyInstance;
let llm: FakeLlm;
let h: Harness;
let seedChangeSets: number;
let seedInbound: number;

function setup(script: LlmResponse[], o: { store?: Store } = {}) {
  llm = new FakeLlm(script);
  h = createHarness({ store: o.store ?? store, clock, parser: createParser(llm) });
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'ct-bot-h-'));
  const paths = ensureDataDirs(dataPaths(dir));
  store = new SqliteStore(paths.dbFile, { clock });
  seedDatabase(store);
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

const newChangeSets = () => store.load().changeSets.slice(seedChangeSets);
const inboundId = (text: string) => store.load().inboundMessages.find((m) => m.rawText === text)!.id;
const etaCall = (eta: string) => toolCall('set_shipment_eta', { shipment: 'windows', job: 'Park Rd', eta });

async function proposedHistory(): Promise<HistoryEntry[]> {
  const res = await app.inject({ method: 'POST', url: '/api/rpc/getChangeHistory', payload: { args: [{ statuses: ['proposed'] }] } });
  return res.json<{ result: HistoryEntry[] }>().result;
}

describe('bot-owned args are never taken from the model', () => {
  it('a model-supplied messageId is replaced by the real inbound message', async () => {
    setup([toolCall('add_daily_note', { job: 'Park Rd', text: 'Frame inspection passed', messageId: 'msg-FAKE' })]);
    await h.text('note for Park Rd: frame inspection passed');
    const [cs] = newChangeSets();
    const id = inboundId('note for Park Rd: frame inspection passed');
    expect(cs).toMatchObject({ status: 'proposed', messageId: id });
    expect((cs!.opArgs as Record<string, unknown>).messageId).toBe(id);
    const change = store.load().changes.find((c) => c.changeSetId === cs!.id)!;
    expect((change.after as Record<string, unknown>).messageId).toBe(id);
  });

  it('attach_photo never runs from plain text, with or without a model filePath', async () => {
    setup([
      toolCall('attach_photo', { job: 'Seaview', category: 'plumbing under slab', filePath: '../../../.env' }),
      toolCall('attach_photo', { job: 'Seaview', category: 'plumbing under slab' }),
    ]);
    for (const text of ['plumbing under slab photo for Seaview', 'file it under plumbing at Seaview']) {
      const calls = await h.text(text);
      expect(h.sent(calls)).toEqual(["Send the photo itself (as a photo or a file) and I'll file it. Nothing saved."]);
    }
    expect(newChangeSets()).toEqual([]);
    expect(h.handle.pending.size).toBe(0);
  });

  it('a photo the bot stored itself files under the bot path, never the model one', async () => {
    setup([toolCall('attach_photo', { job: 'Seaview', category: 'plumbing under slab', filePath: '../evil.jpg' })]);
    const inbound = store.recordInbound({ channel: 'telegram', sender: String(DOMINIC_ID), rawText: 'plumbing under slab', photoPath: 'seaview/2026-09-17-a.jpg' });
    await h.handle.handleInbound(CHAT_ID, inbound, 'plumbing under slab', { botArgs: { filePath: 'seaview/2026-09-17-a.jpg' } });
    const card = h.lastWithButton('Confirm');
    expect(card.text).toContain('New photo: Plumbing under slab (Seaview St)');
    const change = store.load().changes.find((c) => c.changeSetId === newChangeSets()[0]!.id)!;
    expect(change.after).toMatchObject({ filePath: 'seaview/2026-09-17-a.jpg', messageId: inbound.id });
  });
});

describe('pending questions expire and never claim an unrelated message', () => {
  it('after 30 minutes the question is dropped: the next text is parsed on its own and linked to itself', async () => {
    setup([toolCall('ask_question', { question: 'Which job?' }), etaCall('16 Nov')]);
    await h.text('windows late');
    clock.advance(31 * 60 * 1000);
    await h.text('Park Rd windows now arriving 16 Nov');
    expect(llm.requests[1]!.messages.map((m) => m.content)).toEqual(['Park Rd windows now arriving 16 Nov']);
    expect(newChangeSets()[0]!.messageId).toBe(inboundId('Park Rd windows now arriving 16 Nov'));
    expect((await proposedHistory())[0]!.message!.rawText).toBe('Park Rd windows now arriving 16 Nov');
  });

  it('a complete change sent while a question is open is a new request, linked to its own message', async () => {
    setup([toolCall('ask_question', { question: 'Which job?' }), etaCall('16 Nov')]);
    await h.text('windows late');
    await h.text('Park Rd windows now arriving 16 Nov');
    expect(llm.requests).toHaveLength(2); // parsed on its own once; complete, so no threaded parse
    expect(newChangeSets()[0]!.messageId).toBe(inboundId('Park Rd windows now arriving 16 Nov'));
    expect((await proposedHistory())[0]!.message!.rawText).toBe('Park Rd windows now arriving 16 Nov');
    expect(h.handle.pending.size).toBe(0);
  });

  it('pressing another button drops the open question', async () => {
    setup([etaCall('16 Nov'), toolCall('ask_question', { question: 'Which job?' }), textReply('Righto.')]);
    await h.text('Park Rd windows now arriving 16 Nov');
    const card = h.lastWithButton('Confirm');
    await h.text('Beatty late');
    expect(h.handle.pending.size).toBe(1);
    await h.press(card.messageId, 'Cancel');
    expect(h.handle.pending.size).toBe(0);
    await h.text('Beatty St');
    expect(llm.requests[2]!.messages.map((m) => m.content)).toEqual(['Beatty St']);
  });

  it('an expired option button says so and changes nothing', async () => {
    setup([toolCall('set_shipment_eta', { shipment: 'the windows' })]);
    await h.text('the windows are late');
    const q = h.last();
    clock.advance(31 * 60 * 1000);
    const calls = await h.press(q.messageId, 'Park Rd windows (Park Rd)');
    expect(calls.find((c) => c.method === 'answerCallbackQuery')!.payload.text).toBe('That question has expired. Send the message again.');
    expect(newChangeSets()).toEqual([]);
  });
});

describe('chats, errors and replies', () => {
  it("Dominic's messages in a group chat are ignored and logged", async () => {
    setup([etaCall('16 Nov')]);
    const calls = await h.text('Park Rd windows now arriving 16 Nov', { chat: { id: -100123, type: 'group' } });
    expect(calls).toEqual([]);
    expect(store.load().inboundMessages).toHaveLength(seedInbound);
    expect(llm.requests).toHaveLength(0);
    expect(h.log.lines.some((l) => l.includes('in group chat -100123'))).toBe(true);
  });

  it('a failure anywhere gets a short polite reply, is logged, and the button stops spinning', async () => {
    const broken = new Proxy(store, {
      get(t, k) {
        if (k === 'confirmChangeSet') return () => { throw new Error('disk full'); };
        const v = Reflect.get(t, k) as unknown;
        return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(t) : v;
      },
    });
    setup([etaCall('16 Nov')], { store: broken });
    await h.text('Park Rd windows now arriving 16 Nov');
    const calls = await h.press(h.lastWithButton('Confirm').messageId, 'Confirm');
    expect(h.sent(calls)).toEqual(['Something went wrong on my side, so nothing was saved. Try again in a minute.']);
    expect(calls.some((c) => c.method === 'answerCallbackQuery')).toBe(true);
    expect(h.log.lines.some((l) => l.startsWith('error Error handling update') && l.includes('disk full'))).toBe(true);
  });

  it('a provider failure gets a polite reply and saves nothing', async () => {
    setup([]); // the FakeLlm throws at once
    const calls = await h.text('Park Rd windows now arriving 16 Nov');
    expect(h.sent(calls)).toEqual(["I couldn't read that just now (the language model didn't answer). Try again in a minute. Nothing saved."]);
    expect(newChangeSets()).toEqual([]);
  });

  it("the model's free-text reply is kept short", async () => {
    setup([textReply('Sure. '.repeat(200))]);
    const [reply] = h.sent(await h.text('hello'));
    expect(reply!.length).toBeLessThanOrEqual(400);
  });

  it('"next Tuesday" resolves against the clock (Thu 17 Sep -> Tue 22 Sep)', async () => {
    setup([etaCall('next Tuesday')]);
    await h.text('Park Rd windows next Tuesday');
    expect(h.lastWithButton('Confirm').text).toContain('Park Rd windows, ETA: Mon 26 Oct → Tue 22 Sep');
  });
});
