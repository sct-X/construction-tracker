/**
 * The Telegram bot (grammY). One allowed Telegram user (Dominic); everything
 * else is ignored and logged. Text goes through the Parser; changes become a
 * proposed change set shown as a confirm card (before → after and the dry-run
 * forecast impact) and are saved only on Confirm. Questions (from the parser
 * or from a core operation) are asked back and save nothing.
 */
import { Bot, InlineKeyboard, type Context, type Transformer } from 'grammy';
import type { Message, Update, UserFromGetMe } from 'grammy/types';
import {
  applyChanges,
  ChangeConflictError,
  changesOf,
  dryRun,
  forecastJob,
  fuzzyMatch,
  getOperation,
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
} from '@ct/core';
import type { ChatMsg, ParseResult, Parser } from '@ct/llm';
import { cardText, finishSentence } from './format.js';
import { answerRead } from './reads.js';

export interface BotLog {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string, err?: unknown): void;
}

/** Stage 3: voice notes. Shape may grow; Stage 2 only carries it through. */
export interface Transcriber {
  transcribe(input: { filePath: string; mimeType?: string | null; prompt?: string }): Promise<{ text: string }>;
}

/** Stage 3: where photo files go. Shape may grow; Stage 2 only carries it through. */
export interface PhotoStore {
  save(input: { jobId: string; date: string; ext: string; data: Uint8Array }): Promise<{ filePath: string }>;
}

export interface CreateBotOptions {
  token: string;
  /** Dominic's Telegram user id. Every other sender is ignored and logged. */
  allowedUserId: number | string;
  store: Store;
  clock: Clock;
  parser: Parser;
  log?: BotLog;
  /** Tests: an API transformer that captures outgoing calls instead of calling Telegram. */
  transport?: Transformer;
  /** Tests: preset getMe result so handleUpdate works without the network. */
  botInfo?: UserFromGetMe;
  transcriber?: Transcriber;
  photoStore?: PhotoStore;
}

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
    }
  | { kind: 'parser-question'; messageId: string | null; transcript: string | null; history: ChatMsg[] }
  | { kind: 'edit'; history: ChatMsg[]; transcript: string | null };

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
}

export interface BotHandle {
  bot: Bot;
  handleUpdate(update: Update): Promise<void>;
  /** Inspection for tests. */
  pending: Map<number, Pending>;
  cards: Map<string, Card>;
  /**
   * Run already-understood text through the pipeline as if typed (Stage 3: a
   * voice transcript or a photo caption), linked to an inbound row the caller saved.
   */
  handleInbound(chatId: number, inbound: InboundMessage, text: string, opts?: { transcript?: string | null; replyTo?: Message }): Promise<void>;
}

const MAX_TEXT = 4000;
const UNDO_WORD = /^\s*undo(\s+(that|this|it))?\s*[.!]?\s*$/i;

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
  const { store, clock, parser } = opts;
  const log = opts.log ?? consoleBotLog();
  const allowed = String(opts.allowedUserId).trim();
  const api = new LocalDashboardApi(store, clock);
  const bot = new Bot(opts.token, opts.botInfo ? { botInfo: opts.botInfo } : {});
  if (opts.transport) bot.api.config.use(opts.transport);

  const pending = new Map<number, Pending>();
  const cards = new Map<string, Card>();
  const cardByTelegramId = new Map<string, string>(); // `${chatId}:${messageId}` -> change set id

  // -------------------------------------------------------------------------
  // Sending
  // -------------------------------------------------------------------------

  async function send(chatId: number, text: string, keyboard?: InlineKeyboard): Promise<Message.TextMessage> {
    return bot.api.sendMessage(chatId, clipText(text), keyboard ? { reply_markup: keyboard } : {});
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

  /** Args the bot sets itself (never the model): the inbound message id. */
  function withBotArgs(op: string, args: Record<string, unknown>, messageId: string | null): Record<string, unknown> {
    const def = getOperation(op);
    const shape = (def?.schema as unknown as { shape?: Record<string, unknown> } | undefined)?.shape ?? {};
    return messageId && 'messageId' in shape && args.messageId == null ? { ...args, messageId } : args;
  }

  interface RunContext {
    chatId: number;
    messageId: string | null;
    transcript: string | null;
    history: ChatMsg[];
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
      const args = withBotArgs(call.op, call.args, rc.messageId);
      const r: OpResult = runOperation(working, call.op, args, opCtx());
      if (r.kind === 'refusal') {
        await send(rc.chatId, `${r.reason}${/[.!?]$/.test(r.reason) ? '' : '.'} Nothing saved.`);
        return;
      }
      if (r.kind === 'question') {
        const q = r;
        const keyboard = q.options?.length ? new InlineKeyboard() : undefined;
        q.options?.forEach((o, n) => keyboard!.text(o.label, `a:${n}`).row());
        const msg = await send(rc.chatId, q.question, keyboard);
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
        });
        return;
      }
      working = applyChanges(working, r.changes);
      proposals.push(r);
      done.push({ op: r.op, args: r.args });
    }
    if (!proposals.length) {
      await send(rc.chatId, 'Nothing to change.');
      return;
    }
    await proposeCard(ds, proposals, done, rc);
  }

  async function proposeCard(ds: Dataset, proposals: Proposal[], calls: Call[], rc: RunContext): Promise<void> {
    const today = clock.today();
    const changes: Change[] = proposals.flatMap((p) => p.changes);
    const jobIds = [...new Set(proposals.flatMap((p) => p.jobIds))];
    const summary = proposals.map((p) => p.summary).join('; ');
    const { impacts } = dryRun(ds, { changes, jobIds }, today);
    const single = proposals.length === 1 ? proposals[0]! : null;
    const cs = store.proposeChangeSet({
      messageId: rc.messageId,
      summary,
      opName: single ? single.op : proposals.map((p) => p.op).join(', '),
      opArgs: single ? single.args : { calls: calls as never },
      changes,
    });
    const text = cardText({ summary, transcript: rc.transcript, changes, impacts, ds, today });
    const msg = await send(rc.chatId, text, cardKeyboard(cs.id));
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
        await send(rc.chatId, result.text);
        return;
      case 'question': {
        await send(rc.chatId, result.text);
        pending.set(rc.chatId, {
          kind: 'parser-question',
          messageId: rc.messageId,
          transcript: rc.transcript,
          history: [...rc.history, { role: 'assistant', content: result.text }],
        });
        return;
      }
      case 'read': {
        const answer = await answerRead(api, result.tool, result.args);
        await send(rc.chatId, answer.text);
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

  async function resumeQuestion(p: Extract<Pending, { kind: 'op-question' }>, chatId: number, value: string): Promise<void> {
    const field = p.field!;
    const calls = [...p.done, { op: p.current.op, args: { ...p.current.args, [field]: value } }, ...p.rest];
    await runCalls(calls, { chatId, messageId: p.messageId, transcript: p.transcript, history: p.history });
  }

  async function handleInbound(
    chatId: number,
    inbound: InboundMessage,
    text: string,
    o: { transcript?: string | null; replyTo?: Message } = {},
  ): Promise<void> {
    if (UNDO_WORD.test(text)) {
      if (o.replyTo) await undoReplied(chatId, o.replyTo);
      else await undoLatest(chatId);
      return;
    }
    const p = pending.get(chatId);
    pending.delete(chatId);
    if (p?.kind === 'op-question' && p.field) {
      if (p.options?.length) {
        const opt = matchOption(text, p.options);
        if (opt) {
          if (p.questionMessageId) await edit(chatId, p.questionMessageId, `${p.question}\n→ ${opt.label}`);
          await resumeQuestion(p, chatId, opt.value);
          return;
        }
      } else {
        await resumeQuestion(p, chatId, text.trim());
        return;
      }
    }
    // A fresh message, an answer to the parser's own question, an unmatched
    // answer, or an Edit correction: parse it with whatever came before.
    const history = p ? p.history : [];
    const messageId = p?.kind === 'edit' ? inbound.id : (p && 'messageId' in p ? (p.messageId ?? inbound.id) : inbound.id);
    const transcript = o.transcript ?? (p && p.kind !== 'edit' ? p.transcript : null) ?? null;
    let result: ParseResult;
    try {
      result = await parser.parse(text, parseContext(history));
    } catch (e) {
      log.error('Parser failed', e);
      await send(chatId, "I couldn't read that just now (the language model didn't answer). Try again in a minute. Nothing saved.");
      return;
    }
    await handleParse(result, { chatId, messageId, transcript, history: [...history, { role: 'user', content: text }] });
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
      if (!(e instanceof ChangeConflictError)) throw e;
      await stale(chatId, csId, msgId);
      return 'Out of date';
    }
    const after = store.load();
    const lines = [`Saved. ${cs.summary}.`, ...finishLines(after, jobIdsFor(after, csId))];
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
    await runCalls(calls, { chatId, messageId: card?.messageId ?? cs?.messageId ?? null, transcript: card?.transcript ?? null, history: card?.history ?? [] });
  }

  async function cancel(ctx: Context, csId: string): Promise<string | undefined> {
    const chatId = ctx.chat!.id;
    const msgId = ctx.callbackQuery?.message?.message_id;
    const { cs } = findChangeSet(csId);
    if (!cs) return "I can't find that change.";
    if (cs.status !== 'proposed') return `That one is already ${cs.status}.`;
    store.cancelChangeSet(csId);
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
    pending.set(chatId, { kind: 'edit', history: [...history, { role: 'assistant', content: ask }], transcript: card?.transcript ?? null });
    if (msgId) await edit(chatId, msgId, `Changing this one (not saved): ${cs.summary}.`);
    await send(chatId, ask);
    return 'Send the correction';
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

  // Allowlist first: anything not from Dominic stops here, unanswered and unsaved.
  bot.use(async (ctx, next) => {
    const from = ctx.from;
    if (!from || String(from.id) !== allowed) {
      const who = from ? `${from.id}${from.username ? ` (@${from.username})` : ''}` : 'unknown sender';
      const what = ctx.message?.text ? 'a text message' : ctx.callbackQuery ? 'a button press' : 'an update';
      log.warn(`Ignored ${what} from Telegram user ${who}: not the allowed user.`);
      return;
    }
    await next();
  });

  // Every allowed text (commands included) is saved as an inbound message first.
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text;
    const inbound = store.recordInbound({ channel: 'telegram', sender: String(ctx.from.id), rawText: text });
    const chatId = ctx.chat.id;
    const cmd = /^\/(\w+)(@\w+)?\b/.exec(text)?.[1]?.toLowerCase();
    if (cmd === 'undo') {
      pending.delete(chatId);
      if (ctx.message.reply_to_message) await undoReplied(chatId, ctx.message.reply_to_message);
      else await undoLatest(chatId);
      return;
    }
    if (cmd === 'start' || cmd === 'help') {
      await send(
        chatId,
        'Tell me a change in plain words, e.g. "Park Rd windows now arriving 16 Nov", and I\'ll show a card to confirm. ' +
          'Ask things like "what\'s Park Rd\'s finish?". /undo reverses the last saved change.',
      );
      return;
    }
    if (cmd === 'cancel') {
      pending.delete(chatId);
      await send(chatId, 'OK, dropped it. Nothing saved.');
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
    if (chatId === undefined || sep < 0) note = 'That button no longer works.';
    else if (kind === 'c') note = await confirm(ctx, arg);
    else if (kind === 'x') note = await cancel(ctx, arg);
    else if (kind === 'e') note = await startEdit(ctx, arg);
    else if (kind === 'u') {
      await undo(chatId, arg, ctx.callbackQuery.message?.message_id);
    } else if (kind === 'a') {
      const p = pending.get(chatId);
      const n = Number(arg);
      const qMsg = ctx.callbackQuery.message?.message_id;
      if (p?.kind !== 'op-question' || !p.options?.[n] || (p.questionMessageId && qMsg && p.questionMessageId !== qMsg)) {
        note = 'That question has expired. Send the message again.';
      } else {
        pending.delete(chatId);
        const opt = p.options[n]!;
        if (qMsg) await edit(chatId, qMsg, `${p.question}\n→ ${opt.label}`);
        await resumeQuestion(p, chatId, opt.value);
      }
    } else note = 'That button no longer works.';
    await ctx.answerCallbackQuery(note ? { text: note } : undefined);
  });

  // Stage 2 reads text only; Stage 3 adds voice notes and photos ahead of this.
  bot.on('message', async (ctx) => {
    await send(ctx.chat.id, 'I can only read text messages for now. Type it and I\'ll take it from there.');
  });

  bot.catch((err) => {
    log.error(`Bot error on update ${err.ctx.update.update_id}`, err.error);
  });

  return {
    bot,
    handleUpdate: (update) => bot.handleUpdate(update),
    pending,
    cards,
    handleInbound,
  };
}
