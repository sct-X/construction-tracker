/**
 * Stage 3 integration tests: voice notes, photos, the hold-point rule and
 * reminders, through the real bot (grammY, fake transport) over the server's
 * SqliteStore on a temporary folder, a scripted FakeLlm and a FakeTranscriber.
 * Fixtures: a tiny real OGG/Opus voice note and three small JPEGs (made with ffmpeg).
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_TODAY, fixedClock, SEAVIEW, type Clock, type ProgramView } from '@ct/core';
import { createParser, FakeLlm, toolCall, type LlmResponse } from '@ct/llm';
import { buildServer, createScheduler, dataPaths, ensureDataDirs, manualReminderText, seedDatabase, SqliteStore, type DataPaths } from '@ct/server';
import { createTelegramNotifier, diskMediaStore, FakeTranscriber, type FakeTranscript } from '../src/index.js';
import { CHAT_ID, createHarness, DOMINIC_ID, steppingClock, type ApiCall, type Harness } from './harness.js';

const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));
const OGG = fixture('voice.ogg');
const PLUMBING = fixture('plumbing.jpg');
const MEMBRANE = fixture('membrane.jpg');
const STEEL = fixture('steel.jpg');

const SLAB_SAID = 'slab inspection at Seaview is done';
const REFUSAL = "Can't sign off Slab inspection before pour yet. No photos for: Plumbing under slab, Membrane and termite barrier.";

let clock: Clock & { advance(ms: number): void };
let dir: string;
let paths: DataPaths;
let store: SqliteStore;
let apiStore: SqliteStore;
let app: FastifyInstance;
let llm: FakeLlm;
let transcriber: FakeTranscriber;
let h: Harness;
let seedChangeSets: number;
let seedInbound: number;
let seedPhotos: number;

function setup(script: LlmResponse[], voice: FakeTranscript[] = [], o: { pendingTtlMs?: number; clock?: Clock } = {}) {
  llm = new FakeLlm(script);
  transcriber = new FakeTranscriber(voice);
  h = createHarness({
    store,
    clock: o.clock ?? clock,
    parser: createParser(llm),
    transcriber,
    media: diskMediaStore(paths.dataDir),
    remindersNow: async () => manualReminderText(store.load(), (o.clock ?? clock).today()),
    ...(o.pendingTtlMs !== undefined ? { pendingTtlMs: o.pendingTtlMs } : {}),
  });
}

beforeEach(async () => {
  clock = steppingClock(DEFAULT_TODAY, '10:00');
  dir = mkdtempSync(join(tmpdir(), 'ct-bot-s3-'));
  paths = ensureDataDirs(dataPaths(dir));
  store = new SqliteStore(paths.dbFile, { clock });
  seedDatabase(store);
  apiStore = new SqliteStore(paths.dbFile, { clock });
  app = await buildServer({ store: apiStore, clock, paths, webDist: join(dir, 'web') });
  const ds = store.load();
  seedChangeSets = ds.changeSets.length;
  seedInbound = ds.inboundMessages.length;
  seedPhotos = ds.photos.length;
});

afterEach(async () => {
  await app.close();
  apiStore.close();
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

const newChangeSets = () => store.load().changeSets.slice(seedChangeSets);
const newInbound = () => store.load().inboundMessages.slice(seedInbound);
const newPhotos = () => store.load().photos.slice(seedPhotos);
const telegramPhotos = () => (existsSync(join(paths.photosDir, 'telegram')) ? readdirSync(join(paths.photosDir, 'telegram')) : []);
const audioFiles = () => readdirSync(paths.audioDir);
const slabInspection = () => store.load().steps.find((s) => s.id === 'sv-slab-insp')!;

async function rpc<T>(method: string, ...args: unknown[]): Promise<T> {
  const res = await app.inject({ method: 'POST', url: `/api/rpc/${method}`, payload: { args } });
  expect(res.statusCode, res.body).toBe(200);
  return res.json<{ result: T }>().result;
}

const replyTo = (c: ApiCall) => (c.payload.reply_parameters as { message_id?: number } | undefined)?.message_id;
const sendsIn = (calls: ApiCall[]) => calls.filter((c) => c.method === 'sendMessage');

const markSlabDone = () => toolCall('mark_step_done', { step: 'slab inspection', job: 'Seaview' });
const attach = (category: string) => toolCall('attach_photo', { job: 'Seaview', category });

/** Sends a captioned photo, checks its card, presses Confirm. Returns the card text. */
async function filePhoto(data: Uint8Array, caption: string): Promise<string> {
  const calls = await h.photo(data, { caption });
  const photoMsg = h.lastUserMessageId();
  const card = h.lastWithButton('Confirm');
  const cardSend = sendsIn(calls).find((c) => String(c.payload.text) === card.history[0]);
  expect(cardSend && replyTo(cardSend), 'the card replies to the photo').toBe(photoMsg);
  const text = card.text;
  await h.press(card.messageId, 'Confirm');
  expect(h.messages.get(card.messageId)!.text).toMatch(/^Saved\. Photo filed: Seaview St, Slab, /);
  return text;
}

// ---------------------------------------------------------------------------
// SPEC flows b and c
// ---------------------------------------------------------------------------

describe('flow b: voice note on a hold point with empty photo categories', () => {
  it('"slab inspection at Seaview is done" -> refused, naming the 2 empty categories; only the inbound message is saved', async () => {
    setup([markSlabDone()], [SLAB_SAID]);
    const calls = await h.voice(OGG);

    const [reply] = h.sent(calls);
    expect(reply).toBe(`Heard: "${SLAB_SAID}"\n\n${REFUSAL} Nothing saved.`);

    // The transcriber got the stored file and a prompt primed with jobs, trades and site terms.
    expect(transcriber.calls).toHaveLength(1);
    const { audioFile, opts } = transcriber.calls[0]!;
    expect(opts.language).toBe('en');
    for (const word of ['Seaview St', 'Park Rd', 'Beatty St', 'lock-up', 'hold point', 'before-cover', 'OC', 'practical completion', 'fit-off', 'rough-in']) {
      expect(opts.prompt).toContain(word);
    }
    expect(readFileSync(audioFile)).toEqual(Buffer.from(OGG));

    // Saved: the inbound message (audio path + transcript), the audio file. Nothing else.
    const inbound = newInbound();
    expect(inbound).toHaveLength(1);
    expect(inbound[0]).toMatchObject({ channel: 'telegram', sender: String(DOMINIC_ID), transcript: SLAB_SAID, rawText: null });
    expect(inbound[0]!.audioPath).toMatch(/^audio\/2026-09-17-[0-9a-f]{12}\.oga$/);
    expect(join(paths.dataDir, ...inbound[0]!.audioPath!.split('/'))).toBe(audioFile);
    expect(newChangeSets()).toHaveLength(0);
    expect(slabInspection().status).not.toBe('done');
    expect(llm.requests[0]!.messages.at(-1)!.content).toBe(SLAB_SAID);
  });
});

describe('flow c: three captioned photos, then flow b again', () => {
  it('each photo is filed into its category (Confirm each), then the voice note signs the hold point off', async () => {
    setup(
      [
        markSlabDone(), // flow b, refused
        attach('plumbing under slab'),
        attach('membrane and termite barrier'),
        attach('steel reinforcement'),
        markSlabDone(), // flow b again
      ],
      [SLAB_SAID, SLAB_SAID],
    );
    await h.voice(OGG);
    expect(h.last().text).toContain(REFUSAL);

    const plumbingCard = await filePhoto(PLUMBING, 'Seaview plumbing under slab');
    expect(plumbingCard).toContain('Photo filed: Seaview St, Slab, Plumbing under slab.');
    expect(plumbingCard).toContain('New photo: Plumbing under slab (Seaview St)');
    expect(plumbingCard).toContain('Slab inspection before pour photos: 2 of 3. Still needed: Membrane and termite barrier.');
    // The caption went to the parser marked as a photo caption.
    expect(llm.requests[1]!.messages.at(-1)!.content).toBe('Photo caption: Seaview plumbing under slab');

    const membraneCard = await filePhoto(MEMBRANE, 'membrane + termite barrier, Seaview');
    expect(membraneCard).toContain('Slab inspection before pour photos: 3 of 3. All there, so it can be signed off.');
    const steelCard = await filePhoto(STEEL, 'Seaview reo');
    expect(steelCard).toContain('Photo filed: Seaview St, Slab, Steel reinforcement in place.');

    // Filed: three photo rows, each linked to its own inbound message, files on disk under photos/telegram.
    const photos = newPhotos();
    expect(photos.map((p) => p.categoryId)).toEqual(['sv-pc-slab-plumbing', 'sv-pc-slab-membrane', 'sv-pc-slab-steel']);
    const inbound = newInbound();
    for (const [i, p] of photos.entries()) {
      expect(p).toMatchObject({ jobId: SEAVIEW, stageId: 'sv-st-slab', isPlaceholder: false, takenOn: DEFAULT_TODAY });
      expect(p.filePath).toMatch(/^telegram\/2026-09-17-[0-9a-f]{12}\.jpg$/);
      const msg = inbound.find((m) => m.id === p.messageId)!;
      expect(msg.photoPath).toBe(p.filePath);
      expect(readFileSync(join(paths.photosDir, ...p.filePath.split('/')))).toEqual(Buffer.from([PLUMBING, MEMBRANE, STEEL][i]!));
    }
    expect(photos[0]!.caption).toBe('Seaview plumbing under slab');

    // The API serves the stored photo.
    const res = await app.inject({ method: 'GET', url: `/api/photos/${photos[0]!.id}/file` });
    expect(res.statusCode).toBe(200);

    // Retrying flow b: a card this time, Confirm, the step is done.
    const calls = await h.voice(OGG);
    const card = h.lastWithButton('Confirm');
    expect(h.sent(calls)).toEqual([card.history[0]]);
    expect(card.text).toMatch(new RegExp(`^Heard: "${SLAB_SAID}"`));
    expect(card.text).toContain('Slab inspection before pour at Seaview St done Thu 17 Sep.');
    expect(slabInspection().status).not.toBe('done');
    await h.press(card.messageId, 'Confirm');
    expect(h.messages.get(card.messageId)!.text).toMatch(/^Saved\. Slab inspection before pour at Seaview St done Thu 17 Sep\./);
    expect(slabInspection()).toMatchObject({ status: 'done', actualEnd: DEFAULT_TODAY });
    const program = await rpc<ProgramView>('getProgram', SEAVIEW);
    expect(JSON.stringify(program)).toContain('"sv-slab-insp"');
    // The change set links to the second voice note's inbound message (with its transcript).
    const cs = newChangeSets().at(-1)!;
    expect(store.load().inboundMessages.find((m) => m.id === cs.messageId)).toMatchObject({ transcript: SLAB_SAID });
    expect(llm.remaining).toBe(0);
    expect(transcriber.remaining).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

describe('photos', () => {
  it('an uncaptioned photo asks which job, then which category (incl. General), with buttons replying to the photo', async () => {
    setup([]);
    const calls = await h.photo(PLUMBING);
    const photoMsg = h.lastUserMessageId();
    const sends = sendsIn(calls);
    // First compressed photo: the "send as a file" tip, then the question.
    expect(String(sends[0]!.payload.text)).toMatch(/^Tip: to keep a photo at full resolution, send it as a file/);
    expect(String(sends[1]!.payload.text)).toBe('Which job is this photo for?');
    expect(replyTo(sends[1]!)).toBe(photoMsg);
    const q1 = h.last();
    expect(q1.buttons.map((b) => b.text)).toEqual(expect.arrayContaining(['Park Rd', 'Seaview St', 'Beatty St', 'West St']));
    expect(llm.requests).toHaveLength(0); // no caption, no model call

    await h.press(q1.messageId, 'Seaview St');
    const q2 = h.last();
    expect(q2.text).toBe('Which photo category at Seaview St?');
    expect(q2.buttons.map((b) => b.text)).toEqual([
      'General',
      'Slab: Steel reinforcement in place',
      'Slab: Plumbing under slab',
      'Slab: Membrane and termite barrier',
      'Frame: Frame bracing and tie-downs',
      'Roof: Roof complete',
    ]);
    expect(newChangeSets()).toHaveLength(0);

    await h.press(q2.messageId, 'Slab: Membrane and termite barrier');
    const card = h.lastWithButton('Confirm');
    expect(card.text).toContain('Photo filed: Seaview St, Slab, Membrane and termite barrier.');
    expect(card.text).toContain('Slab inspection before pour photos: 2 of 3. Still needed: Plumbing under slab.');
    await h.press(card.messageId, 'Confirm');
    expect(newPhotos()).toHaveLength(1);
    expect(newPhotos()[0]!.caption).toBeNull();
  });

  it('a caption that matches nothing asks, with the job\'s categories (incl. General)', async () => {
    setup([attach('the back fence')]);
    await h.photo(PLUMBING, { caption: 'Seaview back fence' });
    const q = h.last();
    expect(q.text).toBe('Which photo category at Seaview St?');
    expect(q.buttons[0]!.text).toBe('General');
    await h.press(q.messageId, 'General');
    expect(h.lastWithButton('Confirm').text).toContain('Photo filed: Seaview St, General.');
  });

  it('the caption decides stage and category; an ambiguous stage-only caption asks among that stage\'s categories', async () => {
    setup([toolCall('attach_photo', { job: 'Seaview', stage: 'slab' })]);
    await h.photo(PLUMBING, { caption: 'Seaview slab' });
    const q = h.last();
    expect(q.text).toBe('Which photo category at Seaview St, Slab?');
    expect(q.buttons.map((b) => b.text)).toEqual(['General', 'Slab: Steel reinforcement in place', 'Slab: Plumbing under slab', 'Slab: Membrane and termite barrier']);
  });

  it('a photo sent as a file keeps its full resolution (the original bytes), with no tip', async () => {
    setup([attach('steel reinforcement')]);
    const calls = await h.document(STEEL, { caption: 'Seaview reo', fileName: 'IMG_4410.JPG', mime: 'image/jpeg' });
    expect(h.sent(calls).some((t) => t.startsWith('Tip:'))).toBe(false);
    await h.press(h.lastWithButton('Confirm').messageId, 'Confirm');
    const [photo] = newPhotos();
    expect(photo!.filePath).toMatch(/^telegram\/2026-09-17-[0-9a-f]{12}\.jpg$/);
    expect(readFileSync(join(paths.photosDir, ...photo!.filePath.split('/')))).toEqual(Buffer.from(STEEL));
    expect(h.log.lines.some((l) => l.includes('(sent as a file, full resolution)'))).toBe(true);
  });

  it('a compressed photo keeps the largest size Telegram sent; the tip comes only the first time', async () => {
    setup([attach('plumbing under slab'), attach('membrane')]);
    const first = await h.photo(PLUMBING, { caption: 'Seaview plumbing under slab' });
    expect(h.sent(first).filter((t) => t.startsWith('Tip:'))).toHaveLength(1);
    await h.press(h.lastWithButton('Confirm').messageId, 'Confirm');
    const second = await h.photo(MEMBRANE, { caption: 'Seaview membrane' });
    expect(h.sent(second).some((t) => t.startsWith('Tip:'))).toBe(false);
    await h.press(h.lastWithButton('Confirm').messageId, 'Confirm');
    const [a, b] = newPhotos();
    expect(readFileSync(join(paths.photosDir, ...a!.filePath.split('/')))).toEqual(Buffer.from(PLUMBING));
    expect(readFileSync(join(paths.photosDir, ...b!.filePath.split('/')))).toEqual(Buffer.from(MEMBRANE));
    // The tip is remembered on disk (survives a restart).
    expect(diskMediaStore(paths.dataDir).flag('photo-as-file-tip')).toBe(true);
  });

  it('a document that is not an image is not taken as a photo', async () => {
    setup([]);
    const calls = await h.document(new Uint8Array([1, 2, 3]), { mime: 'application/pdf', fileName: 'quote.pdf' });
    expect(h.sent(calls)).toEqual(["I can read text, voice notes and photos. Send one of those and I'll take it from there."]);
    expect(telegramPhotos()).toHaveLength(0);
  });

  it('Cancel on a photo card deletes the stored file and clears the message\'s photo path', async () => {
    setup([attach('plumbing under slab')]);
    await h.photo(PLUMBING, { caption: 'Seaview plumbing under slab' });
    expect(telegramPhotos()).toHaveLength(1);
    await h.press(h.lastWithButton('Cancel').messageId, 'Cancel');
    expect(telegramPhotos()).toHaveLength(0);
    expect(newPhotos()).toHaveLength(0);
    expect(newInbound()[0]!.photoPath).toBeNull();
    expect(h.log.lines.some((l) => /Deleted photo telegram\/.+: not filed/.test(l))).toBe(true);
  });

  it('Edit on a photo card keeps the file for the corrected card', async () => {
    setup([attach('plumbing under slab'), attach('membrane and termite barrier')]);
    await h.photo(PLUMBING, { caption: 'Seaview plumbing under slab' });
    await h.press(h.lastWithButton('Edit').messageId, 'Edit');
    expect(telegramPhotos()).toHaveLength(1);
    await h.text('no, the membrane one');
    const card = h.lastWithButton('Confirm');
    expect(card.text).toContain('Membrane and termite barrier');
    await h.press(card.messageId, 'Confirm');
    expect(newPhotos()).toHaveLength(1);
    expect(existsSync(join(paths.photosDir, ...newPhotos()[0]!.filePath.split('/')))).toBe(true);
  });

  it('an unanswered photo question expires: the file is deleted', async () => {
    setup([toolCall('confirm_job', { job: 'Beatty' })], [], { pendingTtlMs: 60_000 });
    await h.photo(PLUMBING);
    expect(h.last().text).toBe('Which job is this photo for?');
    clock.advance(61_000);
    await h.text('Beatty confirmed');
    expect(telegramPhotos()).toHaveLength(0);
    expect(h.lastWithButton('Confirm').text).toContain('Beatty St confirmed');
  });

  it('/cancel during a photo question deletes the file', async () => {
    setup([]);
    await h.photo(PLUMBING);
    await h.text('/cancel');
    expect(h.last().text).toBe('OK, dropped it. Nothing saved.');
    expect(telegramPhotos()).toHaveLength(0);
  });

  it('a new text request while a photo question is open puts the photo aside and asks again after', async () => {
    setup([toolCall('confirm_job', { job: 'Beatty' })]);
    await h.photo(PLUMBING);
    const photoMsg = h.lastUserMessageId();
    await h.text('Beatty confirmed');
    const card = h.lastWithButton('Confirm');
    expect(card.text).toContain('Beatty St confirmed');
    const again = h.last();
    expect(again.text).toBe('Back to this photo: Which job is this photo for?');
    const send = h.calls.filter((c) => c.method === 'sendMessage').at(-1)!;
    expect(replyTo(send)).toBe(photoMsg);
    // Confirming the Beatty card doesn't lose the photo question.
    await h.press(card.messageId, 'Confirm');
    await h.press(again.messageId, 'Seaview St');
    expect(h.last().text).toBe('Which photo category at Seaview St?');
    expect(telegramPhotos()).toHaveLength(1);
  });

  it('an album with one caption: one parse, a card per photo', async () => {
    setup([attach('plumbing under slab')]);
    await h.photo(PLUMBING, { caption: 'Seaview plumbing under slab', mediaGroupId: 'album-1' });
    await h.photo(MEMBRANE, { mediaGroupId: 'album-1' });
    const cards = [...h.messages.values()].filter((m) => m.buttons.some((b) => b.text === 'Confirm'));
    expect(cards).toHaveLength(2);
    for (const c of cards) expect(c.text).toContain('Photo filed: Seaview St, Slab, Plumbing under slab.');
    expect(llm.requests).toHaveLength(1);
    for (const c of cards) await h.press(c.messageId, 'Confirm');
    expect(newPhotos().map((p) => p.caption)).toEqual(['Seaview plumbing under slab', 'Seaview plumbing under slab']);
  });

  it('an uncaptioned album: asked once, the answers apply to the rest, a card per photo', async () => {
    setup([]);
    await h.photo(PLUMBING, { mediaGroupId: 'album-2' });
    const quiet = await h.photo(MEMBRANE, { mediaGroupId: 'album-2' });
    expect(h.sent(quiet)).toEqual([]); // waits behind the open question
    expect(h.handle.photoQueue.get(CHAT_ID)).toHaveLength(1);
    await h.press(h.last().messageId, 'Seaview St');
    const after = await h.press(h.last().messageId, 'Slab: Plumbing under slab');
    const cards = sendsIn(after).filter((c) => String(c.payload.text).includes('Save this?'));
    expect(cards).toHaveLength(2);
    expect(new Set(cards.map(replyTo)).size).toBe(2); // each card replies to its own photo
    for (const c of [...h.messages.values()].filter((m) => m.buttons.some((b) => b.text === 'Confirm'))) await h.press(c.messageId, 'Confirm');
    expect(newPhotos().map((p) => p.categoryId)).toEqual(['sv-pc-slab-plumbing', 'sv-pc-slab-plumbing']);
    expect(telegramPhotos()).toHaveLength(2);
  });

  it('a caption that is also a hold-point sign-off files the photo first, so the sign-off passes in one card', async () => {
    setup([
      attach('plumbing under slab'),
      // One model answer, two calls (in the order said: sign-off first, the bot files the photo first anyway).
      { toolCalls: [...markSlabDone().toolCalls, ...attach('membrane and termite barrier').toolCalls], usage: { inputTokens: 0, outputTokens: 0 } },
    ]);
    await filePhoto(PLUMBING, 'Seaview plumbing under slab');
    await h.photo(MEMBRANE, { caption: 'Seaview membrane, slab inspection done' });
    const card = h.lastWithButton('Confirm');
    expect(card.text).toContain('Photo filed: Seaview St, Slab, Membrane and termite barrier; Slab inspection before pour at Seaview St done Thu 17 Sep.');
  });

  it('when the model is down, a captioned photo still gets asked about with buttons', async () => {
    llm = new FakeLlm([]); // exhausted: throws
    setup([]);
    await h.photo(PLUMBING, { caption: 'Seaview plumbing' });
    expect(h.last().text).toBe('Which job is this photo for?');
    expect(h.log.lines.some((l) => l.startsWith('error Parser failed on a photo caption'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Voice notes: failures
// ---------------------------------------------------------------------------

describe('voice notes: failures', () => {
  it('a transcriber failure gets a polite reply and saves nothing (no inbound row, no audio file)', async () => {
    setup([], [new Error('whisper-cli exited with 1')]);
    const calls = await h.voice(OGG);
    expect(h.sent(calls)).toEqual(["Sorry, I couldn't make out that voice note: the transcriber didn't work. Nothing saved. Try again, or type it."]);
    expect(newInbound()).toHaveLength(0);
    expect(newChangeSets()).toHaveLength(0);
    expect(audioFiles()).toHaveLength(0);
    expect(h.log.lines.some((l) => l.startsWith('error Transcription failed (fake): whisper-cli exited with 1'))).toBe(true);
    expect(llm.requests).toHaveLength(0);
  });

  it('a spoken question is answered read-only, after what was heard', async () => {
    setup([toolCall('get_job_finish', { job: 'Park Rd' })], ["what's Park Rd's finish"]);
    const calls = await h.voice(OGG);
    expect(h.sent(calls)[0]).toMatch(/^Heard: "what's Park Rd's finish"\n\nPark Rd finishes Fri 26 Feb 2027/);
    expect(newChangeSets()).toHaveLength(0);
  });

  it('an empty transcript (silence) saves nothing', async () => {
    setup([], ['   ']);
    const calls = await h.voice(OGG);
    expect(h.sent(calls)).toEqual(["I couldn't hear any words in that voice note. Nothing saved. Try again, or type it."]);
    expect(newInbound()).toHaveLength(0);
    expect(audioFiles()).toHaveLength(0);
  });

  it('with no transcriber set up, a voice note is politely refused', async () => {
    llm = new FakeLlm([]);
    h = createHarness({ store, clock, parser: createParser(llm), media: diskMediaStore(paths.dataDir) });
    const calls = await h.voice(OGG);
    expect(h.sent(calls)[0]).toMatch(/^Voice notes aren't switched on here yet/);
    expect(newInbound()).toHaveLength(0);
  });

  it('an audio file (not a voice note) is transcribed the same way', async () => {
    setup([toolCall('confirm_job', { job: 'Beatty' })], ['Beatty all confirmed']);
    const calls = await h.update({
      message: {
        message_id: 777,
        date: 0,
        chat: { id: DOMINIC_ID, type: 'private', first_name: 'Dominic' },
        from: { id: DOMINIC_ID, is_bot: false, first_name: 'Dominic' },
        audio: { file_id: 'aud-1', file_unique_id: 'u-aud-1', duration: 4, mime_type: 'audio/mp4', file_size: 3 },
      },
    } as never);
    // Fake Telegram has no such file yet: a polite reply, nothing saved.
    expect(h.sent(calls)).toEqual(["I couldn't download that voice note from Telegram. Send it again in a minute. Nothing saved."]);
    expect(audioFiles()).toHaveLength(0);
    h.files.set('aud-1', { fileId: 'aud-1', data: new Uint8Array([1, 2, 3]), path: 'music/aud-1.m4a' });
    await h.update({
      message: {
        message_id: 778,
        date: 0,
        chat: { id: DOMINIC_ID, type: 'private', first_name: 'Dominic' },
        from: { id: DOMINIC_ID, is_bot: false, first_name: 'Dominic' },
        audio: { file_id: 'aud-1', file_unique_id: 'u-aud-1', duration: 4, mime_type: 'audio/mp4', file_size: 3 },
      },
    } as never);
    expect(h.lastWithButton('Confirm').text).toMatch(/^Heard: "Beatty all confirmed"/);
    expect(newInbound()[0]!.audioPath).toMatch(/\.m4a$/);
  });
});

// ---------------------------------------------------------------------------
// SPEC flow f: reminders
// ---------------------------------------------------------------------------

describe('flow f: reminders to Telegram', () => {
  it('"fire reminders" (no LLM) sends what is due now: Book concrete pump act-by Fri 18 Sep, Beatty St amber', async () => {
    setup([]);
    const calls = await h.text('fire reminders');
    const [text] = h.sent(calls);
    expect(sendsIn(calls)[0]!.payload.chat_id).toBe(DOMINIC_ID);
    expect(text).toMatch(/^Reminders due now, Thu 17 Sep \(you asked, so this includes any already sent today\):/);
    expect(text).toContain('- Seaview St: Book concrete pump. Act by Fri 18 Sep (tomorrow).');
    expect(text).toContain('- Beatty St is amber: last confirmed 9 days ago. Check it and confirm the job.');
    expect(llm.requests).toHaveLength(0);
    expect(newChangeSets()).toHaveLength(0);
  });

  it('the scheduler\'s daily send goes to Dominic through the TelegramNotifier; /reminders still shows them after', async () => {
    setup([]);
    const at730 = fixedClock(DEFAULT_TODAY, '07:30');
    const log = { info() {}, warn() {}, error() {} };
    const scheduler = createScheduler({ store, clock: at730, notifier: createTelegramNotifier(h.handle.bot.api, DOMINIC_ID), log, reminderTime: '07:00' });

    const before = h.calls.length;
    const tick = await scheduler.tick();
    expect(tick.reminders!.sent.length).toBeGreaterThanOrEqual(2);
    const daily = sendsIn(h.calls.slice(before));
    expect(daily).toHaveLength(1);
    expect(daily[0]!.payload.chat_id).toBe(DOMINIC_ID);
    expect(String(daily[0]!.payload.text)).toMatch(/^Reminders, Thu 17 Sep:/);
    expect(String(daily[0]!.payload.text)).toContain('Seaview St: Book concrete pump. Act by Fri 18 Sep (tomorrow).');
    expect(String(daily[0]!.payload.text)).toContain('Beatty St is amber');

    // Dedup: the next tick sends nothing.
    const mid = h.calls.length;
    await scheduler.tick();
    expect(sendsIn(h.calls.slice(mid))).toHaveLength(0);

    // On request, regardless of the dedup, labelled as such.
    const asked = await h.text('/reminders');
    expect(h.sent(asked)[0]).toContain('(you asked, so this includes any already sent today)');
    expect(h.sent(asked)[0]).toContain('Book concrete pump');
  });

  it('a failed Telegram send leaves the reminders to go out on the next tick', async () => {
    setup([]);
    let fail = true;
    const flaky = { async send(n: { text: string }) { if (fail) throw new Error('Telegram down'); await createTelegramNotifier(h.handle.bot.api, DOMINIC_ID).send(n); } };
    const errors: string[] = [];
    const scheduler = createScheduler({ store, clock: fixedClock(DEFAULT_TODAY, '07:30'), notifier: flaky, log: { info() {}, warn() {}, error: (m) => void errors.push(m) }, reminderTime: '07:00' });
    await scheduler.tick();
    expect(errors).toEqual(['Sending reminders failed (will retry next minute)']);
    fail = false;
    const before = h.calls.length;
    await scheduler.tick();
    expect(String(sendsIn(h.calls.slice(before))[0]!.payload.text)).toContain('Book concrete pump');
  });
});
