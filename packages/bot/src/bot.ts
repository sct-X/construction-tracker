/**
 * The Telegram bot (grammY). One allowed Telegram user (Dominic); everything
 * else is ignored and logged. Text goes through the Parser; changes become a
 * proposed change set shown as a confirm card (before → after and the dry-run
 * forecast impact) and are saved only on Confirm. Questions (from the parser
 * or from a core operation) are asked back and save nothing.
 */
import { Bot, GrammyError, InlineKeyboard, type Context, type Transformer } from 'grammy';
import type { Message, Update, UserFromGetMe } from 'grammy/types';
import {
  applyChanges,
  ChangeConflictError,
  changesOf,
  dryRun,
  forecastJob,
  formatDate,
  fuzzyMatch,
  getOperation,
  holdPointCheck,
  jobIdsOfChanges,
  LocalDashboardApi,
  runOperation,
  type Change,
  type ChangeSet,
  type Clock,
  type Dataset,
  type InboundMessage,
  type OpResult,
  type Proposal,
  type QuestionOption,
  type Store,
  RuleRefusalError,
} from '@ct/core';
import { BOT_SET_ARGS, type ChatMsg, type ParseResult, type Parser } from '@ct/llm';
import { cardText, finishSentence } from './format.js';
import { detectImageType, extensionFor, telegramDownloader, type FileDownloader, type MediaStore } from './media.js';
import { answerRead } from './reads.js';
import { transcriptionPrompt, type Transcriber } from './transcriber.js';

export interface BotLog {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string, err?: unknown): void;
}

export interface CreateBotOptions {
  token: string;
  /** Dominic's Telegram user id. Every other sender is ignored and logged. */
  allowedUserId: number | string;
  store: Store;
  clock: Clock;
  /**
   * Turns text into operations. None (no model key in .env): reminders, /undo, /reminders, buttons and
   * photo filing by buttons still work; typed messages and voice notes get NO_MODEL_REPLY.
   */
  parser?: Parser | null;
  log?: BotLog;
  /** Tests: an API transformer that captures outgoing calls instead of calling Telegram. */
  transport?: Transformer;
  /** Tests: preset getMe result so handleUpdate works without the network. */
  botInfo?: UserFromGetMe;
  /** Telegram Bot API root (TELEGRAM_API_ROOT), e.g. a local Bot API server. Default https://api.telegram.org. */
  apiRoot?: string;
  /** Voice notes. None: a voice note gets "voice notes aren't switched on" and nothing is saved. */
  transcriber?: Transcriber;
  /** Where voice notes and photos are kept (diskMediaStore(DATA_DIR)). None: they're politely refused. */
  media?: MediaStore;
  /** Gets a file's bytes from Telegram. Default: Telegram's file endpoint with this token. Tests fake it. */
  downloader?: FileDownloader;
  /**
   * "/reminders" and "fire reminders": the reminders that apply right now as one message (ignoring the
   * daily dedup), or null when none. The server supplies it (reminders live there). None: "not connected".
   */
  remindersNow?: () => Promise<string | null>;
  /** A question left unanswered this long is dropped. Default 30 minutes. */
  pendingTtlMs?: number;
}

/**
 * Args only the bot may set (never the model): `filePath` comes from a photo the
 * bot itself stored (Stage 3 photo handler). `messageId` is always the inbound row.
 */
export interface BotArgs {
  filePath?: string;
  /** The photo's own Telegram message: questions and its card are sent as replies to it. */
  photoMessageId?: number;
  /** The album (Telegram media group) the photo came in; answers for one photo apply to the rest. */
  mediaGroupId?: string;
}

/** A photo received and stored, waiting to be filed. */
export interface IncomingPhoto {
  inboundId: string;
  filePath: string;
  caption: string | null;
  telegramMessageId: number;
  mediaGroupId: string | null;
}

/** Waiting behind an open photo question: a photo not asked about yet, or a photo question put aside. */
export type Queued = { kind: 'photo'; photo: IncomingPhoto } | { kind: 'question'; pending: Extract<Pending, { kind: 'op-question' }> };

export type Call = { op: string; args: Record<string, unknown> };

/** What the bot is waiting for in a chat. */
export type Pending =
  | {
      kind: 'op-question';
      /** Inbound message the eventual change set links to. */
      messageId: string | null;
      transcript: string | null;
      /** Calls already resolved, re-run on resume. */
      done: Call[];
      current: Call;
      field: string | null;
      options: QuestionOption[] | null;
      question: string;
      rest: Call[];
      history: ChatMsg[];
      questionMessageId: number | null;
      botArgs: BotArgs;
      /** clock.now() in ms when asked; expires after pendingTtlMs. */
      askedAt: number;
    }
  | { kind: 'parser-question'; messageId: string | null; transcript: string | null; history: ChatMsg[]; botArgs: BotArgs; askedAt: number }
  | { kind: 'edit'; history: ChatMsg[]; transcript: string | null; botArgs: BotArgs; askedAt: number };

/** A confirm card the bot sent (in memory; the change set itself is in the store). */
export interface Card {
  changeSetId: string;
  chatId: number;
  telegramMessageId: number;
  calls: Call[];
  messageId: string | null;
  transcript: string | null;
  summary: string;
  jobIds: string[];
  history: ChatMsg[];
  botArgs: BotArgs;
}

export interface BotHandle {
  bot: Bot;
  handleUpdate(update: Update): Promise<void>;
  /** Inspection for tests. */
  pending: Map<number, Pending>;
  cards: Map<string, Card>;
  /** Photos (and put-aside photo questions) waiting for the open photo question, per chat. */
  photoQueue: Map<number, Queued[]>;
  /** Start-up tidy: deletes photos/telegram files nothing refers to. Returns the paths removed. */
  sweepOrphanPhotos(): Promise<string[]>;
  /**
   * Run already-understood text through the pipeline as if typed (Stage 3: a
   * voice transcript or a photo caption), linked to an inbound row the caller saved.
   */
  handleInbound(chatId: number, inbound: InboundMessage, text: string, opts?: InboundOptions): Promise<void>;
}

export interface InboundOptions {
  transcript?: string | null;
  replyTo?: Message;
  /** Stage 3 photo handler: the stored file's path, the only way attach_photo can run. */
  botArgs?: BotArgs;
}

const MAX_TEXT = 4000;
/** The model's free-text replies are meant to be a sentence or two. */
const MAX_MODEL_REPLY = 400;
const DEFAULT_PENDING_TTL_MS = 30 * 60 * 1000;
const SOMETHING_WRONG = 'Something went wrong on my side, so nothing was saved. Try again in a minute.';
const UNDO_WORD = /^\s*undo(\s+(that|this|it))?\s*[.!]?\s*$/i;
/** "fire reminders", "send reminders", "show me my reminders now" (no LLM). */
export const REMINDERS_WORDS = /^\s*(fire|send|show)\s+(me\s+)?(the\s+|my\s+)?reminders(\s+now)?\s*[.!?]*\s*$/i;
/** Telegram's getFile limit for bots. */
const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;
const PHOTO_TIP_FLAG = 'photo-as-file-tip';
const PHOTO_TIP =
  'Tip: to keep a photo at full resolution, send it as a file (paperclip, then File) instead of as a photo. Telegram shrinks normal photos. This one is filed either way.';
const GROUP_MEMORY_MS = 10 * 60 * 1000;
const TOO_BIG = "That file is over Telegram's 20 MB limit for bots, so I can't fetch it. Send it as a photo or a smaller file. Nothing saved.";
/** The reply to free text when no language model is configured. */
export const NO_MODEL_REPLY = "I can't read messages yet: add a model key to .env.";
const NOT_A_PHOTO = "That file isn't a photo I can keep: I take JPEG, PNG, WebP or HEIC. Nothing saved.";

/** A file Telegram won't let a bot download (over 20 MB). Retrying can't help, so it gets its own reply. */
export class TooBigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TooBigError';
  }
}

export function silentLog(): BotLog {
  return { info() {}, warn() {}, error() {} };
}

function consoleBotLog(): BotLog {
  return {
    info: (m) => console.log(`[bot] ${m}`),
    warn: (m) => console.warn(`[bot] ${m}`),
    error: (m, e) => console.error(`[bot] ${m}`, e instanceof Error ? (e.stack ?? e.message) : (e ?? '')),
  };
}

function clipText(s: string): string {
  return s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT - 1)}…` : s;
}

const cardKeyboard = (csId: string) =>
  new InlineKeyboard().text('Confirm', `c:${csId}`).text('Edit', `e:${csId}`).text('Cancel', `x:${csId}`);
const undoKeyboard = (csId: string) => new InlineKeyboard().text('Undo', `u:${csId}`);

/** The change set a confirm or saved card stands for, read off its buttons (survives restarts). */
function changeSetIdFromMarkup(msg: Message | undefined): string | null {
  const rows = msg?.reply_markup?.inline_keyboard ?? [];
  for (const row of rows) {
    for (const b of row) {
      const data = 'callback_data' in b ? b.callback_data : undefined;
      const m = data ? /^[ceux]:(.+)$/.exec(data) : null;
      if (m) return m[1]!;
    }
  }
  return null;
}

export function createBot(opts: CreateBotOptions): BotHandle {
  const { store, clock, parser, media } = opts;
  const downloader = opts.downloader ?? telegramDownloader(opts.token, opts.apiRoot ? { apiRoot: opts.apiRoot } : {});
  const log = opts.log ?? consoleBotLog();
  const allowed = String(opts.allowedUserId).trim();
  const api = new LocalDashboardApi(store, clock);
  const bot = new Bot(opts.token, { ...(opts.botInfo ? { botInfo: opts.botInfo } : {}), ...(opts.apiRoot ? { client: { apiRoot: opts.apiRoot } } : {}) });
  if (opts.transport) bot.api.config.use(opts.transport);

  const pending = new Map<number, Pending>();
  const ttl = opts.pendingTtlMs ?? DEFAULT_PENDING_TTL_MS;
  const nowMs = () => clock.now().getTime();

  /** Takes (and clears) the chat's pending question, unless it has expired. */
  function takePending(chatId: number): Pending | undefined {
    const p = pending.get(chatId);
    pending.delete(chatId);
    if (p && nowMs() - p.askedAt > ttl) {
      log.info(`Dropped an unanswered question in chat ${chatId} (older than ${Math.round(ttl / 60000)} min).`);
      return undefined;
    }
    return p;
  }

  /** The chat's open question, if it hasn't expired (doesn't take it). */
  function livePending(chatId: number): Pending | undefined {
    const p = pending.get(chatId);
    return p && nowMs() - p.askedAt <= ttl ? p : undefined;
  }

  type PhotoQuestion = Extract<Pending, { kind: 'op-question' }>;
  const isPhotoQuestion = (p: Pending | undefined): p is PhotoQuestion => p?.kind === 'op-question' && !!p.botArgs.filePath;

  // Photos that arrive while a photo question is open wait their turn (one question at a time).
  const photoQueue = new Map<number, Queued[]>();
  const queueOf = (chatId: number): Queued[] => {
    let q = photoQueue.get(chatId);
    if (!q) photoQueue.set(chatId, (q = []));
    return q;
  };

  /**
   * Something else needs the chat (a new request, an Edit): an open photo question is put aside, to be
   * asked again once that's dealt with, so the photo isn't lost. Any other open question is dropped.
   */
  function setAsidePending(chatId: number): void {
    const p = livePending(chatId);
    pending.delete(chatId);
    if (isPhotoQuestion(p)) {
      queueOf(chatId).unshift({ kind: 'question', pending: p });
      log.info(`Put aside the photo question "${p.question}" until this is dealt with.`);
    }
  }

  /** Album captions and answers: photos 2..n of an album reuse photo 1's caption and answers. */
  const groups = new Map<string, { caption: string | null; attachArgs: Record<string, unknown> | null; at: number }>();
  function groupInfo(id: string) {
    const now = nowMs();
    for (const [k, v] of groups) if (now - v.at > GROUP_MEMORY_MS) groups.delete(k);
    return groups.get(id);
  }

  /** Photo files stored by this process and not yet filed (or released). */
  const unsettled = new Set<string>();
  const cards = new Map<string, Card>();
  const cardByTelegramId = new Map<string, string>(); // `${chatId}:${messageId}` -> change set id

  // -------------------------------------------------------------------------
  // Sending
  // -------------------------------------------------------------------------

  async function send(chatId: number, text: string, keyboard?: InlineKeyboard, replyTo?: number): Promise<Message.TextMessage> {
    return bot.api.sendMessage(chatId, clipText(text), {
      ...(keyboard ? { reply_markup: keyboard } : {}),
      ...(replyTo ? { reply_parameters: { message_id: replyTo, allow_sending_without_reply: true } } : {}),
    });
  }

  /** "Heard: "..."" ahead of a voice note's first reply (cards always carry it). */
  function heard(rc: { transcript: string | null; history: ChatMsg[] }): string {
    if (!rc.transcript || rc.history.length > 1) return '';
    const t = rc.transcript.length > 300 ? `${rc.transcript.slice(0, 299)}…` : rc.transcript;
    return `Heard: "${t}"\n\n`;
  }

  async function edit(chatId: number, messageId: number, text: string, keyboard?: InlineKeyboard): Promise<void> {
    try {
      await bot.api.editMessageText(chatId, messageId, clipText(text), keyboard ? { reply_markup: keyboard } : {});
    } catch (e) {
      // "message is not modified" and edits of old messages are not worth failing over.
      log.warn(`Couldn't edit message ${messageId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // -------------------------------------------------------------------------
  // Running operations into a confirm card
  // -------------------------------------------------------------------------

  function opCtx() {
    return { today: clock.today(), now: clock.now() };
  }

  /**
   * Every bot-owned arg is removed from what the model (or a resumed question) supplied,
   * then set by the bot: `messageId` = the inbound row, `filePath` = the stored photo.
   */
  function withBotArgs(op: string, args: Record<string, unknown>, rc: RunContext): Record<string, unknown> {
    const shape = (getOperation(op)?.schema as unknown as { shape?: Record<string, unknown> } | undefined)?.shape ?? {};
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(args)) if (!BOT_SET_ARGS.includes(k)) out[k] = v;
    if (rc.messageId && 'messageId' in shape) out.messageId = rc.messageId;
    if (rc.botArgs.filePath && 'filePath' in shape) out.filePath = rc.botArgs.filePath;
    return out;
  }

  interface RunContext {
    chatId: number;
    messageId: string | null;
    transcript: string | null;
    history: ChatMsg[];
    botArgs: BotArgs;
  }

  async function runCalls(calls: Call[], rc: RunContext): Promise<void> {
    const ds = store.load();
    let working = ds;
    const done: Call[] = [];
    const proposals: Proposal[] = [];
    for (let i = 0; i < calls.length; i++) {
      const call = calls[i]!;
      const def = getOperation(call.op);
      if (!def) {
        await send(rc.chatId, `I don't know how to do "${call.op}". Nothing saved.`);
        return;
      }
      if (def.group !== 'daily') {
        await send(rc.chatId, 'That one is a Setup change: do it in the Setup area on the computer. Nothing saved.');
        return;
      }
      const shape = (def.schema as unknown as { shape: Record<string, unknown> }).shape;
      if ('filePath' in shape && !rc.botArgs.filePath) {
        // attach_photo only ever runs on a photo the bot received and stored itself.
        await send(rc.chatId, "Send the photo itself (as a photo or a file) and I'll file it. Nothing saved.");
        return;
      }
      const args = withBotArgs(call.op, call.args, rc);
      const r: OpResult = runOperation(working, call.op, args, opCtx());
      if (r.kind === 'refusal') {
        await send(rc.chatId, `${heard(rc)}${r.reason}${/[.!?]$/.test(r.reason) ? '' : '.'} Nothing saved.`, undefined, rc.botArgs.photoMessageId);
        return;
      }
      if (r.kind === 'question') {
        const q = r;
        if (q.field && BOT_SET_ARGS.includes(q.field)) {
          await send(rc.chatId, "I can't take that from a message. Nothing saved.");
          return;
        }
        const keyboard = q.options?.length ? new InlineKeyboard() : undefined;
        q.options?.forEach((o, n) => keyboard!.text(o.label, `a:${n}`).row());
        const msg = await send(rc.chatId, `${heard(rc)}${q.question}`, keyboard, rc.botArgs.photoMessageId);
        pending.set(rc.chatId, {
          kind: 'op-question',
          messageId: rc.messageId,
          transcript: rc.transcript,
          done,
          current: { op: call.op, args: q.args },
          field: q.field,
          options: q.options,
          question: q.question,
          rest: calls.slice(i + 1),
          history: [...rc.history, { role: 'assistant', content: q.question }],
          questionMessageId: msg.message_id,
          botArgs: rc.botArgs,
          askedAt: nowMs(),
        });
        log.info(`Asked: ${q.question}`);
        return;
      }
      working = applyChanges(working, r.changes);
      proposals.push(r);
      done.push({ op: r.op, args: r.args });
    }
    if (!proposals.length) {
      await send(rc.chatId, `${heard(rc)}Nothing to change.`);
      return;
    }
    await proposeCard(ds, proposals, done, rc);
  }

  /**
   * Hold-point progress for photos filed into required categories, from the data with the change applied:
   * "Slab inspection before pour photos: 2 of 3. Still needed: Membrane and termite barrier."
   */
  function holdPointLines(after: Dataset, changes: Change[]): string[] {
    const lines: string[] = [];
    const seen = new Set<string>();
    for (const c of changes) {
      if (c.table !== 'photo' || c.kind !== 'insert') continue;
      const catId = (c.row as { categoryId?: unknown }).categoryId;
      const cat = after.photoCategories.find((x) => x.id === catId);
      if (!cat?.requiredForHoldPoint || !cat.stageId) continue;
      for (const step of after.steps) {
        if (step.stageId !== cat.stageId || !step.isHoldPoint || step.status === 'done' || seen.has(step.id)) continue;
        seen.add(step.id);
        const check = holdPointCheck(step, after.photoCategories, after.photos);
        const head = `${step.name} photos: ${check.filledCount} of ${check.required.length}`;
        lines.push(check.ok ? `${head}. All there, so it can be signed off.` : `${head}. Still needed: ${check.missingCategories.join(', ')}.`);
      }
    }
    return lines;
  }

  async function proposeCard(ds: Dataset, proposals: Proposal[], calls: Call[], rc: RunContext): Promise<void> {
    const today = clock.today();
    const changes: Change[] = proposals.flatMap((p) => p.changes);
    const jobIds = [...new Set(proposals.flatMap((p) => p.jobIds))];
    const summary = proposals.map((p) => p.summary).join('; ');
    const { impacts, after } = dryRun(ds, { changes, jobIds }, today);
    const single = proposals.length === 1 ? proposals[0]! : null;
    const cs = store.proposeChangeSet({
      messageId: rc.messageId,
      summary,
      opName: single ? single.op : proposals.map((p) => p.op).join(', '),
      opArgs: single ? single.args : { calls: calls as never },
      changes,
    });
    const notes = holdPointLines(after, changes);
    const text = cardText({ summary, transcript: rc.transcript, changes, impacts, ds, today, notes });
    const msg = await send(rc.chatId, text, cardKeyboard(cs.id), rc.botArgs.photoMessageId);
    const card: Card = {
      changeSetId: cs.id,
      chatId: rc.chatId,
      telegramMessageId: msg.message_id,
      calls,
      messageId: rc.messageId,
      transcript: rc.transcript,
      summary,
      jobIds,
      history: [...rc.history, { role: 'assistant', content: `Proposed: ${summary}.` }],
      botArgs: rc.botArgs,
    };
    cards.set(cs.id, card);
    cardByTelegramId.set(`${rc.chatId}:${msg.message_id}`, cs.id);
    log.info(`Proposed ${cs.id}: ${summary}`);
  }

  // -------------------------------------------------------------------------
  // Parsing
  // -------------------------------------------------------------------------

  function parseContext(history: ChatMsg[]) {
    const ds = store.load();
    const live = ds.jobs.filter((j) => !j.isTemplate);
    const liveIds = new Set(live.map((j) => j.id));
    return {
      today: clock.today(),
      jobs: live.map((j) => j.name),
      trades: ds.trades.map((t) => t.name),
      shipments: ds.shipments.filter((s) => liveIds.has(s.jobId)).map((s) => s.name),
      ...(history.length ? { history } : {}),
    };
  }

  async function handleParse(result: ParseResult, rc: RunContext): Promise<void> {
    switch (result.kind) {
      case 'reply':
        await send(rc.chatId, heard(rc) + (result.text.length > MAX_MODEL_REPLY ? `${result.text.slice(0, MAX_MODEL_REPLY - 1).trimEnd()}…` : result.text));
        return;
      case 'question': {
        await send(rc.chatId, heard(rc) + result.text);
        pending.set(rc.chatId, {
          kind: 'parser-question',
          messageId: rc.messageId,
          transcript: rc.transcript,
          history: [...rc.history, { role: 'assistant', content: result.text }],
          botArgs: rc.botArgs,
          askedAt: nowMs(),
        });
        return;
      }
      case 'read': {
        const answer = await answerRead(api, result.tool, result.args);
        await send(rc.chatId, heard(rc) + answer.text);
        return;
      }
      case 'ops':
        await runCalls(result.calls, rc);
        return;
    }
  }

  function matchOption(text: string, options: QuestionOption[]): QuestionOption | null {
    const t = text.trim();
    const n = Number(t);
    if (Number.isInteger(n) && n >= 1 && n <= options.length) return options[n - 1]!;
    const exact = options.find((o) => o.label.toLowerCase() === t.toLowerCase() || o.value === t);
    if (exact) return exact;
    const r = fuzzyMatch(t, options.map((o) => ({ id: o.value, name: o.label, value: o })));
    return r.kind === 'unique' ? (r.match.value as QuestionOption) : null;
  }

  /** An option was picked (button or typed): re-run with it filled in. */
  async function resumeQuestion(p: Extract<Pending, { kind: 'op-question' }>, chatId: number, opt: QuestionOption): Promise<void> {
    const field = p.field!;
    const resumed = { ...p.current.args, [field]: opt.value };
    const calls = [...p.done, { op: p.current.op, args: resumed }, ...p.rest];
    // An album: the answers for this photo apply to the photos behind it.
    const g = p.botArgs.mediaGroupId && p.current.op === 'attach_photo' ? groupInfo(p.botArgs.mediaGroupId) : undefined;
    if (g) g.attachArgs = { ...resumed };
    await runCalls(calls, {
      chatId,
      messageId: p.messageId,
      transcript: p.transcript,
      history: [...p.history, { role: 'user', content: opt.label }],
      botArgs: p.botArgs,
    });
  }

  async function parse(chatId: number, text: string, history: ChatMsg[]): Promise<ParseResult | null> {
    if (!parser) {
      await send(chatId, NO_MODEL_REPLY);
      return null;
    }
    try {
      return await parser.parse(text, parseContext(history));
    } catch (e) {
      log.error('Parser failed', e);
      await send(chatId, "I couldn't read that just now (the language model didn't answer). Try again in a minute. Nothing saved.");
      return null;
    }
  }

  async function handleInbound(chatId: number, inbound: InboundMessage, text: string, o: InboundOptions = {}): Promise<void> {
    const own: RunContext = {
      chatId,
      messageId: inbound.id,
      transcript: o.transcript ?? null,
      history: [{ role: 'user', content: text }],
      botArgs: o.botArgs ?? {},
    };
    if (UNDO_WORD.test(text)) {
      if (!isPhotoQuestion(livePending(chatId))) pending.delete(chatId);
      if (o.replyTo) await undoReplied(chatId, o.replyTo);
      else await undoLatest(chatId);
      return;
    }
    const p = takePending(chatId);
    if (!p) {
      const result = await parse(chatId, text, []);
      if (result) await handleParse(result, own);
      return;
    }
    if (p.kind === 'op-question' && p.options?.length) {
      const opt = matchOption(text, p.options);
      if (opt) {
        if (p.questionMessageId) await edit(chatId, p.questionMessageId, `${p.question}\n→ ${opt.label}`);
        await resumeQuestion(p, chatId, opt);
        return;
      }
    }
    if (p.kind === 'edit') {
      // The correction: parsed with the card's thread; the new card links to the correction itself.
      const result = await parse(chatId, text, p.history);
      if (result) await handleParse(result, { ...own, transcript: o.transcript ?? p.transcript, history: [...p.history, { role: 'user', content: text }], botArgs: o.botArgs ?? p.botArgs });
      return;
    }
    // A question is open. If the text is a complete change by itself, it is a new request:
    // the question is dropped and the change links to this message. Otherwise it answers
    // the question: parsed with the thread, linked to the message that started it.
    const alone = await parse(chatId, text, []);
    if (!alone) {
      if (isPhotoQuestion(p)) pending.set(chatId, p); // the photo question stays open
      return;
    }
    if (alone.kind === 'ops') {
      if (isPhotoQuestion(p)) {
        pending.set(chatId, p);
        setAsidePending(chatId);
      }
      await handleParse(alone, own);
      return;
    }
    const threaded = await parse(chatId, text, p.history);
    if (!threaded) {
      if (isPhotoQuestion(p)) pending.set(chatId, p);
      return;
    }
    await handleParse(threaded, {
      chatId,
      messageId: p.messageId ?? inbound.id,
      transcript: p.transcript ?? o.transcript ?? null,
      history: [...p.history, { role: 'user', content: text }],
      botArgs: o.botArgs ?? p.botArgs,
    });
    // A reply or a read isn't an answer: an open photo question stays open (the photo isn't dropped).
    if (isPhotoQuestion(p) && threaded.kind !== 'ops' && !pending.has(chatId)) pending.set(chatId, { ...p, askedAt: nowMs() });
  }

  // -------------------------------------------------------------------------
  // Card buttons
  // -------------------------------------------------------------------------

  function jobIdsFor(ds: Dataset, csId: string): string[] {
    return cards.get(csId)?.jobIds ?? jobIdsOfChanges(ds, changesOf(ds, csId));
  }

  /** "Park Rd finishes Fri 12 Mar 2027, +14 days, $9,000 since last Monday." per touched build job. */
  function finishLines(ds: Dataset, jobIds: string[]): string[] {
    const today = clock.today();
    const out: string[] = [];
    for (const id of jobIds) {
      const job = ds.jobs.find((j) => j.id === id);
      if (!job || job.isTemplate || job.kind !== 'build') continue;
      const f = forecastJob(ds, id, today);
      const s = finishSentence(job.name, f.forecastFinish, f.slipDays, f.slipCost, today);
      if (s) out.push(s);
    }
    return out;
  }

  function findChangeSet(id: string): { ds: Dataset; cs: ChangeSet | undefined } {
    const ds = store.load();
    return { ds, cs: ds.changeSets.find((c) => c.id === id) };
  }

  async function confirm(ctx: Context, csId: string): Promise<string | undefined> {
    const chatId = ctx.chat!.id;
    const msgId = ctx.callbackQuery?.message?.message_id;
    const { cs } = findChangeSet(csId);
    if (!cs) return "I can't find that change.";
    if (cs.status !== 'proposed') return `That one is already ${cs.status}.`;
    try {
      store.confirmChangeSet(csId);
    } catch (e) {
      if (e instanceof RuleRefusalError) {
        // Decision: a card that would now break a rule (e.g. a hold-point photo undone since) is cancelled, not kept.
        store.cancelChangeSet(csId);
        for (const path of photoPathsOf(store.load(), csId)) unsettled.add(path);
        if (msgId) await edit(chatId, msgId, `Not saved: ${cs.summary}.`);
        await send(chatId, `${e.reason}${/[.!?]$/.test(e.reason) ? '' : '.'} Nothing saved.`);
        log.info(`Refused at Confirm ${csId}: ${e.reason}`);
        return 'Not saved';
      }
      if (!(e instanceof ChangeConflictError)) throw e;
      await stale(chatId, csId, msgId);
      return 'Out of date';
    }
    const after = store.load();
    const lines = [`Saved. ${cs.summary}.`, ...finishLines(after, jobIdsFor(after, csId)), ...holdPointLines(after, changesOf(after, csId))];
    if (msgId) await edit(chatId, msgId, lines.join('\n'), undoKeyboard(csId));
    log.info(`Confirmed ${csId}: ${cs.summary}`);
    return 'Saved';
  }

  /** The data moved since the card was made: say so, retire it, and offer a fresh card. */
  async function stale(chatId: number, csId: string, msgId: number | undefined): Promise<void> {
    const { cs } = findChangeSet(csId);
    if (cs?.status === 'proposed') store.cancelChangeSet(csId);
    if (msgId) await edit(chatId, msgId, `Out of date, nothing saved: ${cs?.summary ?? 'that change'}.`);
    const card = cards.get(csId);
    const calls: Call[] | null = card?.calls ?? (cs?.opName && getOperation(cs.opName) && cs.opArgs && typeof cs.opArgs === 'object' && !Array.isArray(cs.opArgs) ? [{ op: cs.opName, args: cs.opArgs as Record<string, unknown> }] : null);
    if (!calls) {
      await send(chatId, 'That card was out of date: something changed since I made it. Nothing saved. Send the change again.');
      return;
    }
    await send(chatId, "That card was out of date: something changed since I made it, so nothing was saved. Here's a fresh one.");
    await runCalls(calls, { chatId, messageId: card?.messageId ?? cs?.messageId ?? null, transcript: card?.transcript ?? null, history: card?.history ?? [], botArgs: card?.botArgs ?? botArgsOf(csId) });
  }

  async function cancel(ctx: Context, csId: string): Promise<string | undefined> {
    const chatId = ctx.chat!.id;
    const msgId = ctx.callbackQuery?.message?.message_id;
    const { cs } = findChangeSet(csId);
    if (!cs) return "I can't find that change.";
    if (cs.status !== 'proposed') return `That one is already ${cs.status}.`;
    store.cancelChangeSet(csId);
    // Its photo file goes too (after this update, once nothing else refers to it).
    for (const path of photoPathsOf(store.load(), csId)) unsettled.add(path);
    if (msgId) await edit(chatId, msgId, `Cancelled, nothing saved: ${cs.summary}.`);
    return 'Cancelled';
  }

  async function startEdit(ctx: Context, csId: string): Promise<string | undefined> {
    const chatId = ctx.chat!.id;
    const msgId = ctx.callbackQuery?.message?.message_id;
    const { ds, cs } = findChangeSet(csId);
    if (!cs) return "I can't find that change.";
    if (cs.status !== 'proposed') return `That one is already ${cs.status}.`;
    store.cancelChangeSet(csId);
    const card = cards.get(csId);
    const original = cs.messageId ? ds.inboundMessages.find((m) => m.id === cs.messageId) : undefined;
    const history: ChatMsg[] = card?.history ?? [
      ...(original?.rawText || original?.transcript ? [{ role: 'user' as const, content: (original.transcript ?? original.rawText)! }] : []),
      { role: 'assistant', content: `Proposed: ${cs.summary}.` },
    ];
    const ask = 'What should it be instead? Send the correction and I\'ll make a new card.';
    setAsidePending(chatId);
    pending.set(chatId, { kind: 'edit', history: [...history, { role: 'assistant', content: ask }], transcript: card?.transcript ?? null, botArgs: card?.botArgs ?? botArgsOf(csId), askedAt: nowMs() });
    if (msgId) await edit(chatId, msgId, `Changing this one (not saved): ${cs.summary}.`);
    await send(chatId, ask);
    return 'Send the correction';
  }

  // -------------------------------------------------------------------------
  // Photo files: filed, waiting, or released
  // -------------------------------------------------------------------------

  /** Stored photo paths a change set would file. */
  function photoPathsOf(ds: Dataset, csId: string): string[] {
    return changesOf(ds, csId)
      .filter((c) => c.table === 'photo' && c.kind === 'insert')
      .map((c) => (c.kind === 'insert' ? (c.row as { filePath?: unknown }).filePath : null))
      .filter((x): x is string => typeof x === 'string');
  }

  /**
   * A card's bot-set args when the card isn't in memory (after a restart): the photo file its change set
   * would file, so Edit and an out-of-date card keep working (and the file is still tidied up).
   */
  function botArgsOf(csId: string): BotArgs {
    const path = photoPathsOf(store.load(), csId)[0];
    if (!path) return {};
    unsettled.add(path);
    return { filePath: path };
  }

  /**
   * On start: photos in photos/telegram that no photo row and no proposed change set refers to are left over
   * from before a restart (a question that was open, a card cancelled while down). Nothing is in flight in a
   * fresh process, so they go now. Returns the paths removed.
   */
  async function sweepOrphanPhotos(): Promise<string[]> {
    if (!media?.listPhotos) return [];
    const ds = store.load();
    const keep = new Set(ds.photos.map((p) => p.filePath));
    for (const cs of ds.changeSets) if (cs.status === 'proposed') for (const path of photoPathsOf(ds, cs.id)) keep.add(path);
    const removed: string[] = [];
    for (const path of await media.listPhotos()) {
      if (keep.has(path)) continue;
      await media.removePhoto(path);
      for (const m of ds.inboundMessages) if (m.photoPath === path) store.updateInbound(m.id, { photoPath: null });
      removed.push(path);
    }
    if (removed.length) log.info(`Deleted ${removed.length} unfiled photo(s) left from before the restart: ${removed.join(', ')}.`);
    return removed;
  }

  /** Paths still in play: an open question or edit, a queued photo, or a proposed card. */
  function photoPathsInPlay(ds: Dataset): Set<string> {
    const live = new Set<string>();
    for (const p of pending.values()) if (p.botArgs.filePath) live.add(p.botArgs.filePath);
    for (const q of photoQueue.values()) {
      for (const x of q) live.add(x.kind === 'photo' ? x.photo.filePath : x.pending.botArgs.filePath!);
    }
    for (const cs of ds.changeSets) if (cs.status === 'proposed') for (const path of photoPathsOf(ds, cs.id)) live.add(path);
    return live;
  }

  /**
   * Decision (Stage 3): a photo that ends up not filed (card cancelled, question expired or dropped with
   * /cancel, or refused) is deleted from the photos folder and its inbound message's photoPath cleared;
   * the inbound message itself stays. A filed photo (confirmed) is kept for good, undone or not.
   */
  async function sweepPhotos(): Promise<void> {
    if (!unsettled.size || !media) return;
    const ds = store.load();
    const inPlay = photoPathsInPlay(ds);
    for (const path of [...unsettled]) {
      if (ds.photos.some((ph) => ph.filePath === path)) {
        unsettled.delete(path); // filed
        continue;
      }
      if (inPlay.has(path)) continue;
      unsettled.delete(path);
      try {
        await media.removePhoto(path);
        for (const m of ds.inboundMessages) if (m.photoPath === path) store.updateInbound(m.id, { photoPath: null });
        log.info(`Deleted photo ${path}: not filed (cancelled, dropped or refused).`);
      } catch (e) {
        log.error(`Couldn't delete unfiled photo ${path}`, e);
      }
    }
  }

  /** After every update: if no question is open, take the next waiting photo; then tidy unfiled photos. */
  async function afterTurn(chatId: number): Promise<void> {
    const q = photoQueue.get(chatId);
    while (q?.length && !livePending(chatId)) {
      if (pending.has(chatId)) takePending(chatId); // expired: drop it
      const next = q.shift()!;
      if (next.kind === 'photo') await processPhoto(chatId, next.photo);
      else {
        const p = next.pending;
        const keyboard = p.options?.length ? new InlineKeyboard() : undefined;
        p.options?.forEach((o, n) => keyboard!.text(o.label, `a:${n}`).row());
        const msg = await send(chatId, `Back to this photo: ${p.question}`, keyboard, p.botArgs.photoMessageId);
        pending.set(chatId, { ...p, questionMessageId: msg.message_id, askedAt: nowMs() });
      }
    }
    if (q && !q.length) photoQueue.delete(chatId);
    await sweepPhotos();
  }

  // -------------------------------------------------------------------------
  // Voice notes
  // -------------------------------------------------------------------------

  async function download(fileId: string, size: number | undefined): Promise<{ data: Uint8Array; telegramPath: string }> {
    if (size && size > MAX_DOWNLOAD_BYTES) throw new TooBigError(`File is ${Math.round(size / 1048576)} MB; Telegram lets bots download up to 20 MB`);
    let file;
    try {
      file = await bot.api.getFile(fileId);
    } catch (e) {
      // No file_size in the update: Telegram's own "file is too big" says the same thing.
      if (e instanceof GrammyError && /file is too big/i.test(e.description)) throw new TooBigError(e.description);
      throw e;
    }
    if (!file.file_path) throw new Error('Telegram gave no file path');
    const data = await downloader.download({ fileId, filePath: file.file_path });
    return { data, telegramPath: file.file_path };
  }

  function transcriberPrompt(): string {
    const ds = store.load();
    return transcriptionPrompt({ jobs: ds.jobs.filter((j) => !j.isTemplate).map((j) => j.name), trades: ds.trades.map((t) => t.name) });
  }

  async function handleVoice(ctx: Context): Promise<void> {
    const m = ctx.message!;
    const chatId = ctx.chat!.id;
    const v = m.voice ?? m.audio;
    if (!v) return;
    if (!opts.transcriber || !media) {
      log.warn(`Voice note not read: ${!opts.transcriber ? 'no transcriber set up (TRANSCRIBER)' : 'no data folder for audio'}.`);
      await send(chatId, "Voice notes aren't switched on here yet, so I couldn't listen to that. Type it instead. Nothing saved.");
      return;
    }
    await bot.api.sendChatAction(chatId, 'typing').catch(() => undefined);
    let saved: { storedPath: string; file: string };
    try {
      const { data, telegramPath } = await download(v.file_id, v.file_size);
      saved = await media.saveAudio(data, { date: clock.today(), ext: extensionFor(telegramPath, v.mime_type, 'ogg') });
    } catch (e) {
      log.error('Voice note download failed', e);
      await send(chatId, e instanceof TooBigError ? TOO_BIG : "I couldn't download that voice note from Telegram. Send it again in a minute. Nothing saved.");
      return;
    }
    let transcript = '';
    try {
      transcript = (await opts.transcriber.transcribe(saved.file, { prompt: transcriberPrompt(), language: 'en' })).text.trim();
    } catch (e) {
      log.error(`Transcription failed (${opts.transcriber.name ?? 'transcriber'})`, e);
      await media.removeAudio(saved.storedPath).catch(() => undefined);
      await send(chatId, "Sorry, I couldn't make out that voice note: the transcriber didn't work. Nothing saved. Try again, or type it.");
      return;
    }
    if (!transcript) {
      await media.removeAudio(saved.storedPath).catch(() => undefined);
      await send(chatId, "I couldn't hear any words in that voice note. Nothing saved. Try again, or type it.");
      return;
    }
    const inbound = store.recordInbound({
      channel: 'telegram',
      sender: String(ctx.from!.id),
      rawText: m.caption ?? null,
      audioPath: saved.storedPath,
      transcript,
    });
    log.info(`Voice note ${inbound.id} (${saved.storedPath}): "${transcript}"`);
    if (REMINDERS_WORDS.test(transcript)) {
      await remindersOnRequest(chatId); // spoken "fire reminders": no LLM either
      return;
    }
    await handleInbound(chatId, inbound, transcript, { transcript, ...(m.reply_to_message ? { replyTo: m.reply_to_message } : {}) });
  }

  // -------------------------------------------------------------------------
  // Photos
  // -------------------------------------------------------------------------

  async function receivePhoto(
    ctx: Context,
    file: { fileId: string; size: number | undefined; mime: string | undefined; name: string | undefined; compressed: boolean },
  ): Promise<void> {
    const m = ctx.message!;
    const chatId = ctx.chat!.id;
    if (!media) {
      log.warn('Photo not kept: no data folder for photos.');
      await send(chatId, "Photos aren't switched on here yet (no data folder), so I couldn't keep that one. Nothing saved.");
      return;
    }
    let filePath: string;
    let data: Uint8Array;
    try {
      data = (await download(file.fileId, file.size)).data;
    } catch (e) {
      log.error('Photo download failed', e);
      await send(chatId, e instanceof TooBigError ? TOO_BIG : "I couldn't download that photo from Telegram. Send it again in a minute. Nothing saved.", undefined, m.message_id);
      return;
    }
    // The stored extension comes from the bytes, never the sender's file name or mime type: only real
    // JPEG/PNG/WebP/HEIC/HEIF is kept, so nothing the dashboard could run (.html, .svg) is ever stored.
    const ext = detectImageType(data);
    if (!ext) {
      log.warn(`Refused a file sent as a photo (${file.mime ?? 'no mime type'}${file.name ? `, "${file.name}"` : ''}): not JPEG, PNG, WebP or HEIC.`);
      await send(chatId, NOT_A_PHOTO, undefined, m.message_id);
      return;
    }
    filePath = (await media.savePhoto(data, { date: clock.today(), ext })).filePath;
    unsettled.add(filePath);
    const own = m.caption?.trim() || null;
    const groupId = m.media_group_id ?? null;
    let caption = own;
    if (groupId) {
      const g = groupInfo(groupId);
      if (!g) groups.set(groupId, { caption: own, attachArgs: null, at: nowMs() });
      else if (!own) caption = g.caption;
      else if (!g.caption) g.caption = own;
    }
    const inbound = store.recordInbound({ channel: 'telegram', sender: String(ctx.from!.id), rawText: m.caption ?? null, photoPath: filePath });
    log.info(`Photo ${inbound.id} saved as ${filePath}${file.compressed ? ' (compressed by Telegram)' : ' (sent as a file, full resolution)'}${caption ? `, caption "${caption}"` : ''}.`);
    if (file.compressed && !media.flag(PHOTO_TIP_FLAG)) {
      media.setFlag(PHOTO_TIP_FLAG);
      await send(chatId, PHOTO_TIP);
    }
    const photo: IncomingPhoto = { inboundId: inbound.id, filePath, caption, telegramMessageId: m.message_id, mediaGroupId: groupId };
    if (isPhotoQuestion(livePending(chatId))) {
      // One question at a time: this photo waits until the open one is answered.
      queueOf(chatId).push({ kind: 'photo', photo });
      log.info(`Photo ${filePath} waits behind the open photo question.`);
      if (!groupId) await send(chatId, "Got it. I'll ask about this one when the photo before it is sorted.", undefined, m.message_id);
      return;
    }
    if (pending.has(chatId)) {
      takePending(chatId);
      log.info('Dropped the open question: a photo is a new request.');
    }
    await processPhoto(chatId, photo);
  }

  /**
   * Files one stored photo: the caption goes through the parser (as "Photo caption: ...") for job, stage
   * and category; attach_photo then runs with the bot's filePath and messageId. No caption, no match or
   * more than one match: core asks with buttons. A parser failure still asks, so the photo isn't lost.
   */
  async function processPhoto(chatId: number, photo: IncomingPhoto): Promise<void> {
    const rc: RunContext = {
      chatId,
      messageId: photo.inboundId,
      transcript: null,
      history: [{ role: 'user', content: photo.caption ? `Photo caption: ${photo.caption}` : '(a photo with no caption)' }],
      botArgs: { filePath: photo.filePath, photoMessageId: photo.telegramMessageId, ...(photo.mediaGroupId ? { mediaGroupId: photo.mediaGroupId } : {}) },
    };
    let attach: Record<string, unknown> = {};
    let others: Call[] = [];
    const g = photo.mediaGroupId ? groupInfo(photo.mediaGroupId) : undefined;
    if (g?.attachArgs && g.caption === photo.caption) {
      attach = { ...g.attachArgs }; // the album's first photo already settled job, stage and category
    } else if (photo.caption && parser) {
      let result: ParseResult | null = null;
      try {
        result = await parser.parse(`Photo caption: ${photo.caption}`, parseContext([]));
      } catch (e) {
        log.error('Parser failed on a photo caption; asking instead', e);
      }
      if (result?.kind === 'ops') {
        const first = result.calls.find((c) => c.op === 'attach_photo');
        others = result.calls.filter((c) => c.op !== 'attach_photo');
        if (first) attach = { ...first.args };
        else {
          const job = others.find((c) => typeof c.args.job === 'string')?.args.job;
          if (job) attach.job = job;
        }
      }
    }
    if (photo.caption) attach.caption = photo.caption;
    if (g && !g.attachArgs && g.caption === photo.caption) g.attachArgs = { ...attach };
    await runCalls([{ op: 'attach_photo', args: attach }, ...others], rc);
  }

  // -------------------------------------------------------------------------
  // Reminders on request
  // -------------------------------------------------------------------------

  async function remindersOnRequest(chatId: number): Promise<void> {
    if (!opts.remindersNow) {
      await send(chatId, "Reminders aren't connected in this run.");
      return;
    }
    const text = await opts.remindersNow();
    await send(chatId, text ?? `Nothing due right now, ${formatDate(clock.today(), clock.today())}.`);
    log.info(`Reminders sent on request${text ? '' : ' (none due)'}.`);
  }

  // -------------------------------------------------------------------------
  // Undo
  // -------------------------------------------------------------------------

  async function undo(chatId: number, csId: string, cardMsgId?: number): Promise<void> {
    const { cs } = findChangeSet(csId);
    if (!cs) {
      await send(chatId, "I can't find that change.");
      return;
    }
    const r = store.undo(csId);
    if (!r.ok) {
      await send(chatId, r.reason);
      return;
    }
    const after = store.load();
    const lines = [`Undone: ${cs.summary}.`, ...finishLines(after, jobIdsFor(after, csId))];
    await send(chatId, lines.join('\n'));
    const card = cards.get(csId);
    const msgId = cardMsgId ?? card?.telegramMessageId;
    if (msgId) await edit(chatId, msgId, `Undone: ${cs.summary}.`);
    log.info(`Undone ${csId}: ${cs.summary}`);
  }

  /** /undo: the newest confirmed change set that came in through Telegram. */
  async function undoLatest(chatId: number): Promise<void> {
    const ds = store.load();
    const telegramMsgs = new Set(ds.inboundMessages.filter((m) => m.channel === 'telegram').map((m) => m.id));
    const latest = ds.changeSets
      .filter((c) => c.status === 'confirmed' && c.messageId && telegramMsgs.has(c.messageId))
      .sort((a, b) => (b.confirmedAt ?? '').localeCompare(a.confirmedAt ?? ''))[0];
    if (!latest) {
      await send(chatId, 'Nothing to undo.');
      return;
    }
    await undo(chatId, latest.id);
  }

  /** "undo" sent as a reply to a confirm card: undo that one. */
  async function undoReplied(chatId: number, replyTo: Message): Promise<void> {
    const csId = cardByTelegramId.get(`${chatId}:${replyTo.message_id}`) ?? changeSetIdFromMarkup(replyTo);
    if (!csId) {
      await send(chatId, "I can't tell which change that message is. Reply \"undo\" to a saved card, or send /undo for the latest one.");
      return;
    }
    const { cs } = findChangeSet(csId);
    if (cs?.status === 'proposed') {
      await send(chatId, 'That one was never saved. Tap Cancel on it instead.');
      return;
    }
    await undo(chatId, csId, replyTo.message_id);
  }

  // -------------------------------------------------------------------------
  // Wiring
  // -------------------------------------------------------------------------

  // Allowlist first: anything not from Dominic, or not in a private chat with him
  // (a group would show job data to everyone in it), stops here, unanswered and unsaved.
  bot.use(async (ctx, next) => {
    const from = ctx.from;
    const what = ctx.message?.text ? 'a text message' : ctx.callbackQuery ? 'a button press' : 'an update';
    if (!from || String(from.id) !== allowed) {
      const who = from ? `${from.id}${from.username ? ` (@${from.username})` : ''}` : 'unknown sender';
      log.warn(`Ignored ${what} from Telegram user ${who}: not the allowed user.`);
      return;
    }
    if (ctx.chat && ctx.chat.type !== 'private') {
      log.warn(`Ignored ${what} in ${ctx.chat.type} chat ${ctx.chat.id}: the bot only talks in a private chat.`);
      return;
    }
    await next();
  });

  // Any error: logged, a short polite reply, and a pressed button stops spinning.
  bot.use(async (ctx, next) => {
    try {
      await next();
    } catch (e) {
      log.error(`Error handling update ${ctx.update.update_id}`, e);
      if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: 'Something went wrong' }).catch(() => undefined);
      if (ctx.chat) await send(ctx.chat.id, SOMETHING_WRONG).catch(() => undefined);
    }
    // Then: the next waiting photo (if no question is open) and tidying unfiled photo files.
    if (ctx.chat) {
      try {
        await afterTurn(ctx.chat.id);
      } catch (e) {
        log.error('Follow-up after an update failed', e);
        await send(ctx.chat.id, SOMETHING_WRONG).catch(() => undefined);
      }
    }
  });

  // Every allowed text (commands included) is saved as an inbound message first.
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text;
    const inbound = store.recordInbound({ channel: 'telegram', sender: String(ctx.from.id), rawText: text });
    const chatId = ctx.chat.id;
    const cmd = /^\/(\w+)(@\w+)?\b/.exec(text)?.[1]?.toLowerCase();
    if (cmd === 'reminders' || (!cmd && REMINDERS_WORDS.test(text))) {
      // Read-only, no LLM: what's due now, whatever went out already today. An open question stays open.
      await remindersOnRequest(chatId);
      return;
    }
    if (cmd === 'undo') {
      if (!isPhotoQuestion(livePending(chatId))) pending.delete(chatId);
      if (ctx.message.reply_to_message) await undoReplied(chatId, ctx.message.reply_to_message);
      else await undoLatest(chatId);
      return;
    }
    if (cmd === 'start' || cmd === 'help') {
      await send(
        chatId,
        'Tell me a change in plain words or a voice note, e.g. "Park Rd windows now arriving 16 Nov", and I\'ll show a card to confirm. ' +
          'Send site photos with a caption like "Seaview plumbing under slab" (as a file keeps full resolution). ' +
          'Ask things like "what\'s Park Rd\'s finish?". /reminders shows what\'s due. /undo reverses the last saved change.',
      );
      return;
    }
    if (cmd === 'cancel') {
      pending.delete(chatId);
      const waiting = photoQueue.get(chatId)?.length ?? 0;
      photoQueue.delete(chatId);
      await send(chatId, waiting ? `OK, dropped it and the ${waiting} photo${waiting === 1 ? '' : 's'} waiting behind it. Nothing saved.` : 'OK, dropped it. Nothing saved.');
      return;
    }
    await handleInbound(chatId, inbound, text, { replyTo: ctx.message.reply_to_message });
  });

  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const chatId = ctx.chat?.id;
    const sep = data.indexOf(':');
    const kind = data.slice(0, sep);
    const arg = data.slice(sep + 1);
    let note: string | undefined;
    // A button press that isn't the answer to the open question drops that question, except a photo
    // question: pressing Confirm on one photo's card mustn't lose the next photo (Edit puts it aside).
    if (chatId !== undefined && kind !== 'a' && kind !== 'e' && !isPhotoQuestion(livePending(chatId))) pending.delete(chatId);
    if (chatId === undefined || sep < 0) note = 'That button no longer works.';
    else if (kind === 'c') note = await confirm(ctx, arg);
    else if (kind === 'x') note = await cancel(ctx, arg);
    else if (kind === 'e') note = await startEdit(ctx, arg);
    else if (kind === 'u') {
      await undo(chatId, arg, ctx.callbackQuery.message?.message_id);
    } else if (kind === 'a') {
      const p = takePending(chatId);
      const n = Number(arg);
      const qMsg = ctx.callbackQuery.message?.message_id;
      if (p?.kind !== 'op-question' || !p.options?.[n] || (p.questionMessageId && qMsg && p.questionMessageId !== qMsg)) {
        if (isPhotoQuestion(p)) pending.set(chatId, p); // an old button mustn't lose the photo being asked about
        note = 'That question has expired. Send the message again.';
      } else {
        const opt = p.options[n]!;
        if (qMsg) await edit(chatId, qMsg, `${p.question}\n→ ${opt.label}`);
        await resumeQuestion(p, chatId, opt);
      }
    } else note = 'That button no longer works.';
    await ctx.answerCallbackQuery(note ? { text: note } : undefined);
  });

  bot.on(['message:voice', 'message:audio'], (ctx) => handleVoice(ctx));

  bot.on('message:photo', async (ctx) => {
    // Telegram sends several sizes; the largest is the best there is (still compressed).
    const sizes = [...ctx.message.photo].sort((a, b) => a.width * a.height - b.width * b.height || (a.file_size ?? 0) - (b.file_size ?? 0));
    const best = sizes[sizes.length - 1]!;
    await receivePhoto(ctx, { fileId: best.file_id, size: best.file_size, mime: 'image/jpeg', name: undefined, compressed: true });
  });

  bot.on('message:document', async (ctx, next) => {
    const d = ctx.message.document;
    if (!d.mime_type?.toLowerCase().startsWith('image/')) return next();
    // Sent as a file: the original, full resolution.
    await receivePhoto(ctx, { fileId: d.file_id, size: d.file_size, mime: d.mime_type, name: d.file_name, compressed: false });
  });

  bot.on('message', async (ctx) => {
    await send(ctx.chat.id, 'I can read text, voice notes and photos. Send one of those and I\'ll take it from there.');
  });

  bot.catch((err) => {
    log.error(`Bot error on update ${err.ctx.update.update_id}`, err.error);
  });

  return {
    bot,
    handleUpdate: (update) => bot.handleUpdate(update),
    pending,
    cards,
    photoQueue,
    handleInbound,
    sweepOrphanPhotos,
  };
}
