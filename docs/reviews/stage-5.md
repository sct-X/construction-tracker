# Review: Stage 5 (and final check of the project)

Reviewer: fresh and skeptical. I had not seen the work before. Commit reviewed: `55a745b` (HEAD of
github.com/sct-X/construction-tracker main). Date: 2026-10-08. Scope: the desktop Setup area (new job from
template, program editor, templates, trades), the Pages demo deploy, the README, the eval script, and the
project's final goal checks.

## Verdict

**SIGN-OFF.** I found no MUST-FIX items. Every final goal check passes from a fresh clone with no `.env` and no
keys. Setup works in both data modes. It is desktop-only, and every save goes through `applySetup` into change
history. The live demo serves this exact build. The README steps work when followed literally. Below are 9
NICE-TO-HAVE items, mostly small doc and hygiene gaps.

## Command results

Fresh `git clone https://github.com/sct-X/construction-tracker` (HEAD `55a745b`) into a scratch dir. No `.env`.
No `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` or `TELEGRAM_BOT_TOKEN` in the environment. Ports 4310
and 4320 were free. Port 8787 was taken by an unrelated process, so the README run used `PORT=8899`.

| command | result |
| --- | --- |
| `npm ci` | exit 0, 0 vulnerabilities |
| `npm test` | exit 0, 30 files, **353 passed**, 0 skipped |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0, no chunk warning |
| `npx playwright test` | exit 0, **95 passed, 2 skipped** (29.5 s) |
| `npm run eval` (no keys) | exit 0. gpt-5-mini / gemini-2.5-flash / claude-haiku-4-5 each `skipped (no key)` |
| `npm run eval -- --dry` | exit 0, pass 30/30 |
| `curl https://sct-x.github.io/construction-tracker/` | 200. `<meta name="robots" content="noindex">`, assets under `/construction-tracker/`, same hashes as my fresh `build:pages` (`index-CmWQJw3Q.js`) |

The two Playwright skips are both correct:
- `old-worker.spec.ts` in `api` is skipped because the old service worker only ever lived on the Pages site (mock only).
- `stage5-setup.spec.ts` "mock: the dev bar Reset puts Setup changes back" in `api-setup` is skipped because the dev bar exists only in the demo.

## Final goal checks

1. **Fresh clone: test, build, e2e.** All pass (table above).
2. **One bot integration test per flow, matching SPEC.** Each runs the real grammY bot over a fake transport,
   with a temp SQLite file and a scripted FakeLlm through the real parser:
   - a: `packages/bot/test/flows.test.ts` › "flow a" › `"Park Rd windows now arriving 16 Nov" -> card -> Confirm -> API Fri 12 Mar 2027 -> /undo -> Fri 26 Feb 2027`. The card shows "Install windows starts Mon 16 Nov", "Finish Fri 12 Mar 2027" and "Slip +14 days, $9,000". The HTTP API returns 2027-03-12, 14 days and $9,000. After `/undo` it returns 2027-02-26.
   - b: `packages/bot/test/stage3.test.ts` › "flow b" › `"slab inspection at Seaview is done" -> refused, naming the 2 empty categories`. It uses fixture OGG audio and a FakeTranscriber. The refusal names Plumbing under slab and Membrane and termite barrier, and no change set is saved.
   - c: `stage3.test.ts` › "flow c" › `each photo is filed into its category (Confirm each), then the voice note signs the hold point off`.
   - d: `flows.test.ts` › "flow d" › `"the windows are late" -> asks which job (Park Rd / Seaview St) and saves no change set`.
   - e: `flows.test.ts` › "flow e" › `a message from another Telegram user gets no reply, saves nothing, and is logged`.
   - f: `stage3.test.ts` › "flow f" › `"fire reminders" (no LLM) sends what is due now: Book concrete pump act-by Fri 18 Sep, Beatty St amber` (today is Thu 17 Sep).
3. **Playwright Monday in both modes, and after flow a.** `e2e/monday.spec.ts` runs in `mock` and `api` and
   checks the seeded numbers. `e2e/api-change.spec.ts` drives the real bot (`packages/server/scripts/bot-change.ts`)
   and checks the card. The local-API Monday screen then shows Park Rd Fri 12 Mar 2027, +14 days, $9,000. Its
   Why it moved has one cause, "Park Rd windows, ETA Mon 26 Oct → Mon 16 Nov", quoting the message. Passed.
4. **Eval.** `npm run eval` exists and runs with no keys (all skipped, exit 0). `--dry` gives 30/30. There are
   30 cases in `packages/eval/src/cases.ts`:
   - Australian phrasing and site slang: arvo, sparky, plumbo, "the boys", "locked in".
   - Typos: "windoes", "thru", "cant".
   - Shorthand: "wks", "wk".
   - Relative dates: "the 12th", "next wednesday", "yesterday", "11 jan" rolling into 2027.
   - Questions where the right answer is to ask: flow d, a note with no job, a photo caption with no job, "push the sparky back a week".
   - Also three reads, one refusal and two multi-op messages.
5. **Live Pages.** HTTP 200. Playwright against the live URL (1280, Sydney timezone):
   - Park Rd: Fri 26 Feb 2027, On track.
   - Seaview St: Fri 29 Oct 2027, On track.
   - Beatty St: Fri 4 Dec 2026, +5 days, $1,430, "Not confirmed for 9 days".
   - noindex meta present, no console errors.
   - The dev bar has only "Today is" and Reset.
   - `sw.js` and `404.html` are served.
6. **PROGRESS.md.** Stages 0 to 4 are ticked with sign-offs. Stage 5 was unticked. I ticked it.
7. **README, followed literally.** In the clone: `npm ci`, `cp .env.example .env`, `npm run build`, then `PORT=8899 npm start`.
   - `/api/health` returned `{"ok":true,"today":"2026-10-08"}`, and `/` returned 200.
   - The log said `Telegram bot off: TELEGRAM_BOT_TOKEN is not set.` exactly as the README says.
   - With `CT_TODAY=2026-09-17` the API gave the demo numbers.
   - `npm run seed -- --reset --empty` and `npm run seed -- --reset` both worked. `git status` stayed clean (`.env` and `data/` are ignored).
   - Every script the README names exists, and so does `packages/eval/README.md`.
   - The README's log lines match the code: `Ignored a text message from Telegram user <id> (@user): not the allowed user.` (bot.ts), `Telegram bot @<name> is listening.`, `No language model: ...`, `Voice notes: ...` / `Voice notes off: ...`. `/start`, `/help`, `/cancel`, `/undo` and `/reminders` are all handled.
   - The placeholder-ID route works: the bot starts with a numeric placeholder ID and no model key.
   - The English is plain, and site words are explained where they appear.
8. **Setup.**
   - **Desktop-only.** Setup is a rail link only. It is absent from the phone bar and from More. At 390 px every Setup route shows "Setup works on a computer. Open this page on a desktop."
   - **Writes.** The web's only writes are `api.applySetup` in the four Setup screens. Each is previewed first with `previewSetup`.
   - **Server rules.** Over HTTP, `applySetup('set_shipment_eta', ...)` is refused with "set_shipment_eta is not a Setup operation.". `undo` returns "No such method". A foreign Host or Origin gets 403.
   - **Change history.** A Setup `add_trade` showed up in change history (channel `web`, also under the side filter).
   - **Mock mode.** A Tiling 10 -> 15 edit showed the change bar (Fri 26 Feb → Fri 5 Mar 2027, 7 days later, $4,500). After Save, Changes showed "Changed in Setup on the computer", and Monday showed Park Rd +7 days with that cause in Why it moved.
   - **No day-to-day fields.** The setup op catalogue has no ETAs, item statuses or step-done fields.
9. **Repo hygiene.**
   - The only tracked env file is `.env.example`. `.env`, `/data/`, `*.db*` and `/models/` are git-ignored.
   - Searching tracked files for `sk-`, `sk-ant-`, `AIza`, bot-token shapes and `ghp_` found nothing. `.env` is in no commit.
   - The seed's trade phones are all in ACMA's fictional range.
   - Job names match SPEC exactly. For gaps in `.env.example`, see item 2 below.
10. **Screenshots** (my own, mock mode, `vite preview` of dist-pages): New job, Programs, the Park Rd program
    editor (full page and with a pending change), Templates, the duplex template editor and Trades at 1280.
    The Setup phone message at 390. None scrolls sideways (scrollWidth 1280). The layout is calm and on-token:
    the hi-vis accent is used only for the current tab and "7 days later", and colour is never used alone.

## Findings

1. **NICE-TO-HAVE: some example phone numbers are not in ACMA's fictional range.**
   - `packages/core/src/phone.ts` help text ("0412 345 678", "02 9876 5432"), shown in the live demo.
   - The Trades phone placeholder `0412 345 678` (`packages/web/src/screens/SetupTrades.tsx:194`).
   - `e2e/stage5-setup.spec.ts:192` `0491 570 999`, which is not one of ACMA's listed fictional mobiles.

   Use fictional numbers instead, for example `0491 570 006` / `0491 570 737` and a landline like `02 5550 1234`.
   The tests in `core/test/setup5.test.ts` can keep the format examples, or switch to fictional ones too.
2. **NICE-TO-HAVE: `.env.example` (and the README table) is missing variables the code reads.**
   - Optional model settings in `packages/llm/src/providers/env.ts`: `LLM_BASE_URL`, `LLM_MAX_TOKENS`, `LLM_TIMEOUT_MS`, `LLM_REASONING_EFFORT`, `LLM_THINKING_BUDGET`.
   - `ENV_FILE` (`packages/server/src/config.ts:90`).
   - Aliases: `GOOGLE_API_KEY` (in the README, not in `.env.example`), `TELEGRAM_ALLOWED_USER_ID` (bot/start.ts:47) and `TZ_TODAY_OVERRIDE`.
   - Eval only, documented in `packages/eval/README.md`: `EVAL_MODELS`, `EVAL_CONCURRENCY`, `EVAL_TIMEOUT_MS`.
   - Test and dev only, fine to leave out: `E2E_PORT`, `E2E_DATA_DIR`, `E2E_TODAY`, `CI`, `STAGE4B_REVIEW`, `VITE_DATA`, `CT_API`.

   Add the optional model settings as commented lines, or drop the aliases.
3. **NICE-TO-HAVE: a stale comment in `packages/server/src/config.ts`.** It says `TZ_TODAY_OVERRIDE` is "the
   .env.example name", but `.env.example` uses `CT_TODAY`. Also, `DOMINIC_TELEGRAM_USER_ID ?? TELEGRAM_ALLOWED_USER_ID`
   never falls back when the first is an empty string, which is what `.env.example` ships. Harmless, but the alias
   can never work from a copied `.env`.
4. **NICE-TO-HAVE: the README's Mac run shows no slip on the first start.** The README's Mac section starts on
   the real date. The first start saves this week's Monday snapshot, so every build reads "On track" and none of
   the demo's numbers show. The `CT_TODAY` row explains this, but one line in the Mac section would save a
   puzzled first run: "To see the demo's numbers, set `CT_TODAY=2026-09-17` in `.env`." I checked that setting
   it later still gives the right numbers, because the snapshot comparison uses the 14 Sep snapshots.
5. **NICE-TO-HAVE: program editor text gets cut off at 1280.** The Trade column cuts names off ("Frame car", "Roof
   plum", "Window in", "Plumber, E", "Landscap"). So do long step names ("Rough-in plumbing and electrica"). A
   wider trade column, or the full value in a `title`, would help.
6. **NICE-TO-HAVE: Setup has no way to manage photo categories (logged as not done).** You can tick a hold point
   on a new step in the editor, but you can't give it required photo categories in the UI. Rule 6 then has
   nothing to check for that step. Core `add_photo_category` exists. Job settings (name, holding cost) are also
   not editable in the UI, though `edit_job` exists. Neither is named in SPEC's Setup list, but both are what
   Dominic will reach for next.
7. **NICE-TO-HAVE: the flow d wording is shipment-first.** The question is "Which shipment do you mean by "the
   windows"?". Its buttons are labelled by job, "Park Rd windows (Park Rd)" / "Seaview St windows (Seaview St)".
   SPEC says "asks which job". The meaning is the same and the test's title says "asks which job". Wording that
   says "which job" would match SPEC word for word.
8. **NICE-TO-HAVE: a Setup duration edit changes that step's planned end.** This is intended, and the change
   bar says so ("Planned dates don't change, apart from this step's own planned end"). It still bends rule 3
   ("Planned dates never change"). Record it once as a decision in PROGRESS.md so a later maintainer doesn't
   "fix" it either way.
9. **NICE-TO-HAVE: whisper.cpp has not been run end to end.** The README says so honestly. Before Dominic relies
   on voice notes, send one real voice note through on the target machine.

## Sign-off

No MUST-FIX. Stage 5 ticked in PROGRESS.md: "Reviewer sign-off: 2026-10-08, fresh reviewer, 353 unit + 95 e2e".
