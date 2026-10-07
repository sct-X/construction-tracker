# Review: Stage 3

Reviewer: fresh, skeptical; had not seen the work. Commit reviewed: `aa72422`.
Date: 2026-10-07. Scope: voice through the Transcriber interface (whisper.cpp and cloud, primed prompt,
transcript on the card), photos with category matching, the hold-point rule (Rule 6), reminders sent to
Telegram by the scheduler.

## Verdict

**FIX-FIRST.** Two small blockers. The rest is solid. The build is clean from a fresh clone. Flows b, c
and f are tested the way SPEC asks: the full bot, fake transport, temp SQLite, fake transcriber, scripted
FakeLlm and real fixture files. The transcriber cannot be shell-injected, file storage cannot be
path-traversed, the allowlist covers media and buttons, and reminders reach Dominic's chat with dedup and
catch-up. The blockers:

1. Rule 6 can be bypassed at Confirm time. The check runs only when the card is proposed.
2. A file over 20 MB gets a reply that tells Dominic to retry, and a retry can never work.

## Command results

Fresh `git clone` of `aa72422` into a scratch dir, run with no API keys and no bot token in the environment:

| command | result |
| --- | --- |
| `npm ci` | exit 0 |
| `npm test` | exit 0, 22 files, 258 tests |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 |
| `npx playwright test` | exit 0, 23 passed |

## What I checked and found sound

- **Flows b, c, f** (`packages/bot/test/stage3.test.ts:111`, `:140`, `:476`) go through the real grammY bot
  over `SqliteStore` on a temp folder, with `FakeTranscriber`, a scripted `FakeLlm` and real OGG/JPEG
  fixtures.
  - b: the refusal names "Plumbing under slab" and "Membrane and termite barrier". Nothing is saved except
    the inbound row (audio path and transcript). The transcriber gets the stored file and a primed prompt.
  - c: each photo is filed into the right category, byte for byte, under `photos/telegram`, and linked to
    its own inbound row. The API serves it. Retrying b then gives a card, Confirm, and the step is done.
    The change set links to the second voice note's message.
  - f: the text "fire reminders" never calls the LLM. It gives "Book concrete pump. Act by Fri 18 Sep
    (tomorrow)" and "Beatty St is amber". The scheduler sends through `createTelegramNotifier` to chat
    `DOMINIC_ID`. Dedup is tested on the next tick, retry after a failed send is tested, and `start.test.ts`
    shows the first tick reaching chat 42 through a fake Bot API server.
- **Transcriber** (`packages/bot/src/transcriber.ts`):
  - Both programs run through `spawn` with an args array, `shell: false` and `windowsHide`. The input path
    is an absolute path the bot generated, so no file name can turn into a flag or a shell word.
  - Paths use `node:path`. A `mkdtemp` work folder is removed in `finally` (`:209-211`), also after a
    timeout or a non-zero exit. ENOENT is reported plainly.
  - The prompt lists jobs, then site terms (lock-up, hold point, before-cover, OC, ...), then trades, under
    700 chars.
  - The cloud key is sent only in the `Authorization` header. The upload's file name is a fixed `voice.ext`.
  - On failure or an empty transcript, the audio is deleted and Dominic gets a polite reply.
- **Media storage** (`packages/bot/src/media.ts`):
  - File names are `date-<12 hex>.<ext>`. The extension must match `[A-Za-z0-9]{1,5}`, so a sender's file
    name can't carry a path.
  - `writeFile(..., { flag: 'wx' })` never overwrites a file.
  - `inside()` resolves and checks `relative()`, so removal can't escape its folder.
  - Core `isSafePhotoPath` blocks `..`, backslashes, drive letters and URL schemes.
  - A document keeps its bytes. A non-image document gets the generic polite reply and nothing is stored.
- **Orphan cleanup**: Cancel, an expired question, `/cancel` and a refusal each delete the file and clear
  `inbound_message.photo_path`. Edit keeps the file. Each case is tested.
- **Allowlist**: one middleware before everything (`bot.ts:996`). I probed with a stranger sending a
  voice note, a photo and a document. All three were ignored and logged, with no getFile call, no
  transcriber call, no file and no inbound row. Button presses from a stranger are already tested in
  `flows.test.ts:194`.
- **Rule 6 in core**: `mark_step_done` refuses through `holdPointSignOffRefusal`
  (`packages/core/src/operations/daily.ts:127-150`), so `apply-op` and the bot get the same sentence. The
  bot passes it on as is, and cards show progress ("2 of 3. Still needed: ...").
- **Reminders**: in the seed the text is five short lines with dates like "Fri 18 Sep". The manual send
  says it ignores dedup and doesn't touch `reminder_sent`. The scheduler starts after the bot, so it uses
  the Telegram notifier.
- **Audit**: a voice row has `audio_path` and `transcript`. A photo row has `photo_path` and its caption
  as `raw_text`. A photo row's `messageId` is its own inbound message. Answers to questions link to the
  message that started the thread.

## Findings

1. **MUST-FIX: Rule 6 can be bypassed at Confirm time.**
   - Where: `packages/server/src/sqliteStore.ts:155-163` and `packages/core/src/store.ts:169-179`.
     `confirmChangeSet` only replays the field before-values (`applyChanges`). The hold-point check
     happens once, when the card is proposed.
   - Reproduced in the clone through the bot:
     1. File the two missing Seaview photos (Confirm each).
     2. Send "slab inspection done". The card is proposed.
     3. Send `/undo`, which undoes the membrane photo.
     4. Press Confirm on the sign-off card.
     5. It answers "Saved. Slab inspection before pour at Seaview St done". The step is `done` while
        "Membrane and termite barrier" has no photo.
   - Fix: when a change set sets `step.status` to `done` on a hold-point step, re-run `holdPointCheck` on
     the current data at confirm time. Do it in core, or in both stores' `confirmChangeSet`. On failure,
     throw a refusal the bot shows with `holdPointSignOffRefusal`'s sentence, for example a
     `ChangeConflictError` subtype or a `RuleRefusalError` that `confirm()` in `packages/bot/src/bot.ts:634-640`
     maps to the message plus "Nothing saved".
   - Decide too, and record in PROGRESS: should undoing a photo that a done hold point relied on be
     refused, or allowed as history? It is allowed today.
2. **MUST-FIX: a file over 20 MB is told to "Send it again in a minute", which can never work.**
   - Where: `packages/bot/src/bot.ts:770` throws a plain Error, and `:799` and `:849` reply "I couldn't
     download that ... from Telegram. Send it again in a minute." Probed with a 25 MB `image/heic`
     document: that is the reply.
   - Why it matters: the bot's own tip (`:170`) tells Dominic to send photos as files, which is exactly the
     path where large originals (high-megapixel and RAW) show up. When `file_size` is missing, getFile's
     "file is too big" error gets the same reply.
   - Fix: a typed `TooBigError`, raised for the size check and for getFile's "file is too big", with a
     reply like "That file is 25 MB; Telegram only lets me fetch up to 20 MB. Send it as a normal photo
     (not as a file), or a smaller copy. Nothing saved." Add a test for it.
3. NICE-TO-HAVE: the extension of an "image" document comes from the sender's file name.
   - Where: `packages/bot/src/media.ts:109-111`, so a document with mime `image/jpeg` named `x.html` is
     stored as `.html`. `image/svg+xml` is accepted too. `/api/photos/:id/file` then serves it as
     `text/html` or `image/svg+xml` (`packages/server/src/http.ts:59-67`), so script runs on the
     dashboard's origin. I probed both: they are stored as `.html` and `.svg`.
   - Risk: low, because only Dominic can send and the API is read-only.
   - Fix: map the mime type to an allowlisted image extension (jpg, png, webp, heic, heif, gif, tif),
     refuse SVG, and send `X-Content-Type-Options: nosniff` on photo files.
4. NICE-TO-HAVE: a restart loses `unsettled` and the cards' `botArgs`, because both live in memory
   (`packages/bot/src/bot.ts:270`, `:691`, `:660`).
   - A photo whose question was open at restart stays in `photos/telegram` for good.
   - After a restart, Edit or an out-of-date card on a photo card loses `filePath`, so the correction gets
     "Send the photo itself" and the file is never deleted.
   - Fix: run a startup sweep of `photos/telegram` files that no photo row or proposed change set refers
     to (older than a day), and take `filePath` from the change set's stored `opArgs` when no card is in
     memory.
5. NICE-TO-HAVE: the parser prompt never explains the "Photo caption: ..." convention.
   - Where: `packages/llm/src/prompt.ts`. Only the `attach_photo` tool description hints at it. A real
     model may reply or ask instead of calling `attach_photo`. The bot recovers with buttons, but it costs
     a question.
   - Fix: add one prompt line, and add caption cases to the Stage 5 eval.
6. NICE-TO-HAVE: a reminder message split into several parts can send the first part twice.
   - Where: `packages/bot/src/notifier.ts:24`. If part 2 fails, the scheduler releases every key and
     resends part 1 next minute. It only matters for messages over 4,000 chars.
7. NICE-TO-HAVE: when Telegram can't be reached, reminders log an error every minute.
   - Cause: a bad token, or Dominic never pressed Start or blocked the bot (403). `start.ts:103` builds
     the notifier even when polling failed.
   - Also, a missing LLM key turns the whole bot off, so reminders fall back to the log although Telegram
     would work (`packages/server/src/app.ts:83`).
   - Fix: back off after repeated failures (say, hourly), and treat a 403 as "tell the log once".
8. NICE-TO-HAVE: a spoken "fire reminders" goes to the LLM. Only the typed text skips it
   (`packages/bot/src/bot.ts:1037` vs `:824`). Run `REMINDERS_WORDS` against the transcript too.
9. NICE-TO-HAVE: a failed or empty transcription leaves no `inbound_message` row (`packages/bot/src/bot.ts:803-816`).
   This was a deliberate decision. Still, a row with the audio kept and a null transcript would let
   Dominic or Scott see that a voice note came in and failed.
10. NICE-TO-HAVE: PROGRESS.md:83 says root files were "not mine, suggested for `.env.example`", but the
    commit does edit `.env.example` (FFMPEG_BIN, WHISPER_THREADS, TRANSCRIBE_MODEL are in). It still
    leaves out `TRANSCRIBE_API_KEY`, `TRANSCRIBE_BASE_URL` and `TELEGRAM_API_ROOT`. Fix the note and add
    the missing lines.
11. NICE-TO-HAVE: `calculator.holdPointRefusalText` (`packages/core/src/calculator.ts:657`) is now unused.
    Remove it, or have `holdPointSignOffRefusal` replace it, so there is one Rule 6 sentence.
12. NICE-TO-HAVE: HEIC documents are stored as `.heic`, and Chrome and Firefox can't show HEIC in the
    gallery. Consider converting to JPEG in the background (keeping the original), or say so in the README.

## Re-check

Commit `cb9f6bb` ("Stage 3: review fixes"), checked from a fresh `git clone` of HEAD, run with no API keys
and no bot token in the environment. HEAD also includes Stage 4's web commit `0dcc9a9`.

| command | result |
| --- | --- |
| `npm ci` | exit 0 |
| `npm test` | exit 0, 25 files, 308 tests |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 |
| `npx playwright test` | exit 0, 73 passed |

1. **Rule 6 at Confirm: fixed.**
   - Code: `packages/core/src/operations/rules.ts` runs `assertRulesOnSave` on the data with the changes
     applied. Both `InMemoryStore` and `SqliteStore` call it in `confirmChangeSet` and `applyChangeSet`,
     inside the write transaction. The HTTP layer maps `RuleRefusalError` to 409.
   - Reproduction redone in the clone through the bot:
     1. File the two missing Seaview photos (Confirm each).
     2. Send "slab inspection done", which proposes the card.
     3. Send `/undo`, which undoes the membrane photo.
     4. Press Confirm.
   - Result: the card reads "Not saved: ...". The reply is "Can't sign off Slab inspection before pour yet.
     No photos for: Membrane and termite barrier. Nothing saved." The button says "Not saved". The step
     stays `not_started` and the change set is `cancelled`.
   - Tests: `core/test/store.test.ts:230`, `server/test/sqliteStore.test.ts:207` and
     `bot/test/stage3.test.ts:568`.
   - Still open (fine as recorded history, not a blocker): undoing a photo after the hold point is signed
     off is still allowed.
2. **20 MB limit: fixed.**
   - Code: a `TooBigError` is raised for an over-limit `file_size` and for getFile's "file is too big".
   - Probe: a 25 MB HEIC document gets "That file is over Telegram's 20 MB limit for bots, so I can't fetch
     it. Send it as a photo or a smaller file." Nothing is stored.
   - Tests: `stage3.test.ts:588` and the size-check case.

NICE-TO-HAVE follow-ups also landed:

- (3) The photo type now comes from the file's bytes. My `.svg` and `.html` probes are refused politely
  and nothing is stored. The photo route serves only image types, with `nosniff` and a sandbox CSP.
- (4) A start-up orphan sweep, and `botArgsOf` for Edit or an out-of-date card after a restart.
- (5) A prompt line for "Photo caption:".
- (6) Only a reminder's first part decides a resend.
- (7) Backoff of 2 to 60 minutes after failed reminder sends.
- (8) A spoken "fire reminders" skips the LLM.

Minor, not blocking: the 20 MB reply doesn't end with "Nothing saved."

**SIGN-OFF.**
