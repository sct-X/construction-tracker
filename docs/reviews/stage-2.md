# Review: Stage 2

Reviewer: fresh, skeptical; had not seen the work. Commit reviewed: `50b9739`.
Date: 2026-10-07. Scope: bot allowlist, text parsing through the LLM interface, ambiguity questions,
confirm card with dry-run forecast impact, Edit, Cancel, /undo (and "undo" as a reply), read-only questions.

## Verdict

**FIX-FIRST.** The build is clean from a fresh clone, flows a, d and e are tested the way SPEC asks, the
allowlist is solid (button presses included), and the card, Edit, Cancel, stale and undo paths behave. Three
things block sign-off: the bot trusts args the model must never set (which lets a text message file a
"photo" that fills a hold-point category with no photo), an unanswered question links later unrelated
messages to the wrong source message in the audit log, and switching the model is not one config line as
shipped.

## Command results

Fresh `git clone` of `50b9739` into a temp dir, with no API keys, no bot token and no `ANTHROPIC_BASE_URL`
in the environment:

| command | result |
| --- | --- |
| `npm ci` | exit 0 |
| `npm test` | exit 0, 19 files, 206 tests |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 |
| `npx playwright test` | exit 0, 23 passed |

## What I checked and found sound

- Flows a, d, e (`packages/bot/test/flows.test.ts`): each runs the real `createParser` over a scripted
  `FakeLlm`, a real grammY `Bot` through an API transformer (no network), and a `SqliteStore` on a temp
  file. Flow a checks the HTTP API (a second connection, `inject`) before Confirm, after Confirm (Fri 12 Mar
  2027, +14, $9,000, Why it moved quotes the message) and after `/undo` (Fri 26 Feb 2027). Flow d saves no
  change set. Flow e: no API calls, no inbound row, no parse, one warn line.
- Audit rows (checked in the SQLite file): `inbound_message` (telegram, sender, raw text, received at),
  `change_set` (proposed -> confirmed / cancelled / undone, with timestamps), `change` rows with
  table/row/field/before/after written at propose time.
- LLM: no SQL anywhere; the model only sees core's `daily` op catalogue, six read tools and `ask_question`;
  setup ops and unknown tools are dropped. Three providers behind `LlmProvider`, plain fetch. Gemini's key is
  in `x-goog-api-key` (a test asserts it is not in the URL); grammY redacts the bot token in errors by default.
- Allowlist is the first middleware, so it covers every update type; `allowed_updates` is message and
  callback_query only. A stranger pressing Confirm, Undo or a question-answer button does nothing (tested
  or probed). Long polling only, no webhook, no port opened by the bot.
- Questions: read tools go through `LocalDashboardApi` and never touch `proposeChangeSet`; core ambiguity
  becomes a question with buttons; relative dates resolve against the injected clock (probed: "next Tuesday"
  on Thu 17 Sep -> Tue 22 Sep).
- Card: summary, every field before -> after, moved steps, new finish, slip, slip cost, Confirm/Edit/Cancel.
  Edit cancels and yields a new card linked to the correction; Cancel marks cancelled; a stale card says so,
  is cancelled and re-proposed; double Confirm/Undo answer "already ...". Plain text, no parse mode, so no
  escaping is needed. Dates read "Mon 16 Nov".
- Robustness: a parser/provider error gets a polite reply (probed with an exhausted FakeLlm); `bot.catch`
  is set; grammY's built-in poller handles updates one at a time (`node_modules/grammy/out/bot.js:191`), so
  two quick messages cannot interleave.

## Findings

1. **MUST-FIX.** The bot keeps bot-set args that the model supplies, and `attach_photo` is reachable from
   plain text. `withBotArgs` only fills `messageId` when the model left it out
   (`packages/bot/src/bot.ts:189-193`), and nothing removes `filePath`; CONTRACTS says the bot sets both.
   Probed: a model call `add_daily_note {..., messageId: "msg-FAKE"}` is proposed with `opArgs.messageId =
   "msg-FAKE"`, and `attach_photo {job: Seaview, category: plumbing under slab, filePath: "../../../.env"}`
   from a text message gives a card and, on Confirm, a stored `photo` row with that path and
   `isPlaceholder: false`. With no `filePath`, core asks "What should filePath be?" and whatever Dominic
   types becomes the path (`bot.ts:340-344, 367-369`). Either way a hold-point photo category counts as
   filled with no photo, which defeats rule 6. Fix: strip `BOT_SET_ARGS` from every model call before
   `runOperation`, then set `messageId` yourself; refuse `attach_photo` unless it comes from the photo handler
   (Stage 3), e.g. "Send the photo itself and I'll file it"; never resume a question whose field is a bot-set
   arg. Add a test.

2. **MUST-FIX.** A pending question never expires and claims the next message, however unrelated or late.
   `handleInbound` links the new change set to the pending question's message
   (`bot.ts:374-376`: `messageId = p.messageId ?? inbound.id`) and feeds the old thread to the model.
   Probed: the parser asks "Which job?" about "windows late"; Dominic ignores it and later sends "Park Rd
   windows now arriving 16 Nov"; the change set's `messageId` is the "windows late" row. Change history and
   Why it moved will quote the wrong message. The transcript carries over the same way (`bot.ts:376`).
   Fix: link the change set to the message that completed it (or keep both ids), and drop a pending question
   after a short time (say 30 minutes) or when a new message parses as a complete change by itself.

3. **MUST-FIX.** Switching the model is not one config line as shipped. `.env.example:7-10` says "One line
   to switch" but sets both `LLM_PROVIDER=openai` and `LLM_MODEL=gpt-5-mini`; `createProviderFromEnv`
   lets `LLM_PROVIDER` win (`packages/llm/src/providers/env.ts:46-48`). Changing only `LLM_MODEL` to
   `claude-haiku-4-5` or `gemini-2.5-flash` builds an OpenAI provider with that model id, which fails at the
   first message. Fix: leave `LLM_PROVIDER` blank or commented in `.env.example` (the provider is already
   inferred from the model), and refuse at start, with a plain reason, when `LLM_PROVIDER` and the model's
   family disagree. Add a test.

4. **NICE-TO-HAVE.** When a question with no options is pending ("What is the new ETA?"), the next text is
   used as the value without parsing (`bot.ts:367-369`). Probed: "Beatty tiler now 12 Oct" gets "I couldn't
   read "Beatty tiler now 12 Oct" as a date. Nothing saved." and the Beatty change is lost; a read question
   sent then is lost the same way. Nothing wrong is saved, but Dominic has to resend. When core rejects the
   typed value, parse the text fresh with the question in the history instead.

5. **NICE-TO-HAVE.** The allowlist checks only `from.id` (`bot.ts:539-548`). If the bot is added to a group
   that Dominic is in, his messages there are answered in the group, so job data is visible to everyone
   in it (probed: reply sent to chat -100123). Ignore non-private chats, and have the README say to turn
   off "Allow Groups" in BotFather.

6. **NICE-TO-HAVE.** Errors other than the parser's (store, dry run, read models, a failed `sendMessage`)
   go to `bot.catch` (`bot.ts:612-614`). They are logged and polling carries on, but Dominic gets no reply,
   and in the callback handler (`bot.ts:578-605`) `answerCallbackQuery` is skipped, so the button keeps
   spinning. Reply "Something went wrong, nothing saved" from `bot.catch` when there is a chat, and answer
   callback queries in a `finally`.

7. **NICE-TO-HAVE.** Missing tests: the polite reply when the provider throws, two quick messages (and a
   note in CONTRACTS that safety depends on grammY's sequential poller, so nobody adds `@grammyjs/runner`),
   and one bot-level relative date ("next Tuesday" against the fixed clock). All three behave correctly
   when probed. Also note that a slow provider (30 s timeout, one retry) holds up Confirm presses while it
   waits.

8. **NICE-TO-HAVE.** The model's free-text `reply` is sent as is with no length cap other than 4,000
   characters (`bot.ts:306-308`). Only the prompt keeps replies short. Clip it to a sentence or two.

9. **NICE-TO-HAVE.** For row types `rowLabel` doesn't know, the card shows the raw id, e.g.
   "New photo: photo-muy0..." (`packages/bot/src/format.ts:103-131`). Label photos by category before
   Stage 3 relies on this card.

## Re-check (commit `191f539`, "Stage 2: review fixes")

Fresh `git clone` of `191f539` into a temp dir, with no API keys, no bot token and no `ANTHROPIC_BASE_URL`:

| command | result |
| --- | --- |
| `npm ci` | exit 0 |
| `npm test` | exit 0, 20 files, 221 tests |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 |
| `npx playwright test` | exit 0, 23 passed |

I re-ran my original probes against the fixed code, and read the diff and the new
`packages/bot/test/hardening.test.ts`.

1. **Fixed.** `withBotArgs` (`packages/bot/src/bot.ts`) now strips every `BOT_SET_ARGS` key the model sends,
   then sets `messageId` from the inbound row and `filePath` only from `botArgs` (the Stage 3 photo
   handler). `attach_photo` without a bot-stored file is refused with "Send the photo itself...", and a core
   question about a bot-owned field is refused rather than asked. Core's `isSafePhotoPath` refuses `..`,
   absolute and drive-letter paths. Probe: the model's `messageId: "msg-FAKE"` is replaced by the real id;
   the `../../../.env` photo is refused and no photo row is written. Tests cover all of this.
2. **Fixed.** A pending question expires after 30 minutes (`takePending`). While one is open, the text is
   first parsed on its own. A complete change becomes a new request linked to its own message; anything
   else is parsed with the thread and linked to the message that started it. A button press other than the
   answer drops the question. Probe: "Park Rd windows now arriving 16 Nov" sent after an unanswered "Which
   job?" now links to itself, and "Beatty tiler now 12 Oct" sent after "What is the new ETA?" gets its own
   card (this also fixes finding 4). Tests cover expiry, the fresh request and the change-history quote.
3. **Fixed.** `LLM_MODEL` decides the provider; `LLM_PROVIDER` counts only when the model is blank or of no
   known family. `.env.example` has no active `LLM_PROVIDER` line. A test parses `.env.example` and switches
   to Claude by changing `LLM_MODEL` alone.

Nice-to-haves fixed too: private chats only (5), polite reply and the button stops spinning on any error (6),
tests for provider failure and relative dates (7), model replies capped at 400 characters (8), and photo
rows labelled on the card (9).

Remaining notes (NICE-TO-HAVE, not blocking):

- While a question is open, each answer costs two model calls: the solo parse, then the threaded one.
  Also, a solo parse that returns an op with missing args still counts as "a new request". Say "16 Nov" is
  parsed as `set_shipment_eta {eta}` alone: the bot then asks "which shipment?" again instead of using the
  thread. That is safe (a question, never a guess) but repeats a question. Count a solo parse as new only
  when its ops run without a core question.
- `isSafePhotoPath` rejects any name containing `..` (e.g. `a..b.jpg`). That is harmless because the bot
  names the files itself.

**Verdict: SIGN-OFF.** No MUST-FIX remains.
