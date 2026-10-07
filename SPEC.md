# SPEC — Construction Tracker (one-user rebuild)

Read this and PROGRESS.md before doing anything. This file is the contract. Where
`docs/UI_PLAN.md` (written for a five-person app with roles) conflicts with this
file on people, roles, data entry or hosting, THIS FILE WINS. Use the UI plan for
the core chain, calculation rules, screen content and design rules.

## What the app is

- One user: Dominic. It is his dashboard. Nobody else uses it.
- Day-to-day changes come in ONLY through a Telegram bot (text, voice notes,
  photos), only from Dominic's Telegram account. Every change is shown back as a
  confirm card and saved only when he taps Confirm.
- The web app is a read-only dashboard, plus a desktop-only Setup area: new job
  from template, program editor, templates, trades.
- Scott builds and maintains it; he is not from construction. Plain English.

## Locked decisions

- Monorepo (npm workspaces), TypeScript throughout, Node 22+:
  - `packages/core`: types, the forecast calculator (pure function, data in,
    dates out), the operations layer (every allowed change as a validated
    function), seed data.
  - `packages/server`: HTTP API (Fastify or Hono), SQLite via better-sqlite3 in
    WAL mode, numbered migrations from day one, photos in a folder on disk.
  - `packages/bot`: Telegram bot using grammY with long polling (no webhook,
    nothing exposed to the internet).
  - `packages/web`: Vite, React, hash-based routing, Vitest, Playwright.
- Runs natively on macOS, Windows and Linux. No Docker. One in-process
  scheduler (Monday snapshot, reminders), not cron or Task Scheduler. Paths via
  `node:path`, never hard-coded slashes.
- One data layer interface in the web app, two implementations: a mock (seed
  data in the browser, with reset) for the public GitHub Pages demo, and the
  real API for the local stack. Same screens, swapped behind the interface.
- Injectable clock everywhere ("today is"), timezone Australia/Sydney. Default
  today for seed data and tests: Thu 17 Sep 2026.
- Secrets (bot token, model API keys, Dominic's Telegram user ID) live in a
  git-ignored `.env`. Ship `.env.example`.
- Real job names from the brief: Park Rd, Seaview St, Beatty St, West St,
  Tollbar Ave, Lower Beach St, John St. All other seed data is invented.
- Out of scope but don't block: an analysis agent for Dominic (next version),
  email intake (later; `inbound_message.channel` exists for it).

## Telegram input path

1. Allowlist: messages from any Telegram user ID other than the configured one
   are ignored and logged.
2. Voice notes go through a `Transcriber` interface with two implementations:
   local whisper.cpp and a cloud API. Prime it with job names, trade names and
   site terms (lock-up, hold point, before-cover, OC). Show the transcript on
   the confirm card.
3. Parsing: an LLM turns text into calls to the operations layer only, never
   SQL. Provider-agnostic interface; the model is one config line (candidates:
   GPT-5 mini, Gemini 2.5 Flash, Claude Haiku 4.5). Operations include at
   least: set_shipment_eta, set_shipment_status, mark_step_done,
   set_item_status, set_item_expected_date, add_item, override_lead_time,
   add_daily_note, attach_photo, confirm_job. Job, trade and item names are
   fuzzy-matched against the database; if more than one thing matches, or a
   needed detail is missing, the bot asks a question instead of guessing.
   Relative dates ("next Tuesday", "the 14th") resolve against the clock.
4. Simple read-only questions ("what's Park Rd's finish?", "what are we waiting
   on at Beatty?") are answered from read-only tools. Questions never create a
   change.
5. Confirm card: what was understood, every field's before and after, and the
   forecast impact from the calculator run as a dry run (new forecast finish,
   slip, slip cost). Buttons: Confirm, Edit, Cancel. Edit = Dominic replies
   with a correction and gets a new card.
6. Audit and undo: tables `inbound_message` (channel, sender, raw text, audio
   path, transcript, received at), `change_set` (message, status: proposed |
   confirmed | cancelled | undone, summary) and `change` (table, row, field,
   before, after). `/undo`, or replying "undo" to a confirmation, reverses that
   change set.
7. Photos: sent to the bot, ideally as files (full resolution). The caption
   decides job, stage and photo category; if it can't, the bot asks. Confirm
   card as above.
8. Reminders (act-by dates due, jobs going amber) are sent to Dominic on
   Telegram by the scheduler.

## Data model

side; user (name, telegram_user_id); job (side, kind build|design, path DA|CDC,
weekly holding cost, last confirmed date, is_template, planned_finish,
start_date, starts_from_stage); stage (order, status); step (duration in
working days, planned start/end, forecast start/end, status, is_hold_point; one
placeholder step per stage for stage-level jobs); step_link (this step waits
for that step); requirement (trade or material, lead time); item (job,
required; type: trade to book | material to order | decision | consultant
report | council request | inspection | defect | condition of consent | manual
reminder; title, waiting on, owner as plain text, needed-by, lead time, act-by,
expected date, status: to do | ordered or booked | confirmed | done; confirmed
date; notes; optional links to step, requirement, shipment, photo); trade (per
side: name, type, phone); shipment (status: design | in production | shipped |
delivered; ETA; linked items take their expected date from the ETA);
photo_category (per stage, "required for hold point" flag, plus a job-wide
"General" category); photo; daily_note; forecast_snapshot (saved each Monday);
inbound_message; change_set; change.
Removed: person, membership, roles, push subscriptions, in-app notifications,
offline upload queue. Sides stay; Dominic gets the side switcher.

## Rules

1. Item needed-by = its step's forecast start, calculated WITHOUT that item's
   own expected date (otherwise a late item stops looking late). Act-by =
   needed-by minus lead time.
2. Step forecast start = latest of planned start, the finish of every step it
   waits for, and the expected date of every item it needs.
3. Job forecast finish = latest forecast end of any step. Planned dates never
   change; late means forecast vs planned.
4. Slip = today's forecast finish minus last Monday's snapshot, in calendar
   days. Slip cost = slip / 7 x weekly holding cost, rounded to the nearest $10.
5. Working days are Mon to Fri, minus a shutdown list (21 Dec 2026 to 8 Jan
   2027). Lead times are calendar weeks.
6. A hold-point step can't be marked done until every required photo category
   has at least one stored photo. The bot's refusal names the empty categories.
7. A job goes amber after 7 days unconfirmed.
8. Templates are jobs with is_template and no dates; copying one copies stages,
   steps, links, requirements and photo categories.
9. Design jobs have stages as a checklist, no steps, no Gantt.

## Seed data (tests assert these exact numbers; the same seed loads into the
browser mock and into SQLite)

- Park Rd, full program, $4,500/wk. "Install windows" planned start Mon 2 Nov
  2026, windows lead time 12 weeks, so act-by Mon 10 Aug. Windows shipment
  seeded at ETA 26 Oct, in production, 3 linked items, 2 owned by Raff.
  Forecast finish Fri 26 Feb 2027, equal to the Mon 14 Sep snapshot. Changing
  the ETA to 16 Nov must give: Install windows starts 16 Nov, finish Fri 12 Mar
  2027, slip +14 days, $9,000. Tune step durations in the seed until this
  holds. NEVER tune the calculator to fit.
- Seaview St, stage level, $3,800/wk, finish 30 Oct 2027 (see PROGRESS
  decisions), slip 0, confirmed 1 day ago, "Book concrete pump" act-by Fri 18
  Sep, slab inspection hold point 28 Sep with 1 of 3 required photo categories
  filled.
- Beatty St, stage level, $2,000/wk, finish 4 Dec 2026, slip +5 days, $1,430,
  tiler expected 5 Oct, last confirmed 9 days ago (amber).
- Design: West St (with council, 2 outstanding, oldest 23 days), Tollbar Ave
  (with council, 1, 8 days), Lower Beach St (design, 0), John St (design, 1, 4
  days).
- A second shipment of windows on another job, so "the windows" is ambiguous.
- About 30 items on Park Rd across every item type, a duplex template, trades
  with phone numbers, a week of daily notes, some placeholder photos.

## Screens (web; read-only except Setup)

Monday screen with "Why it moved" (each slip traced to the change that caused
it, from the change log); jobs list; build job overview; program view (desktop
Gantt with planned outlines, phone look-ahead and stages strip); step detail;
shipments; waiting-on list; to-chase list with tap-to-call trade numbers;
photo gallery by job and category; daily notes; design checklist; change
history (every change set, its source message or transcript, before and
after). Setup (desktop): new job from template, program editor, templates,
trades. The Pages demo has a dev bar: "today is" date and reset only.

## Design

Palette from site materials (concrete, steel, timber) with hi-vis orange as
the single accent. Numbers are the largest type on the Monday screen. Colour
never carries meaning alone: "14 days late", not just red. Desktop tables,
phone cards, one token set. No stock imagery, no gradient cards, no all-caps
eyebrow labels. Telegram replies are short, plain English, dates written as
"Mon 16 Nov". UI work must first read `docs/SKILL_tracker-ui-design.md` and
`docs/SKILL_no-vibecoded-design.md` (or the skills of the same name if the
Skill tool offers `anthropic-skills:tracker-ui-design` /
`anthropic-skills:no-vibecoded-design`). Check every UI at 390px and 1280px.

## Testing

- `npm test` needs no API keys or bot token.
- Fake Telegram transport (feeds updates, captures replies and button presses)
  and a fake LLM returning scripted operation calls. Integration tests run the
  full bot against a temporary SQLite file.
- One integration test per bot flow:
  a "Park Rd windows now arriving 16 Nov" -> card shows Install windows starts
    16 Nov, finish Fri 12 Mar 2027, slip +14 days, $9,000 -> Confirm -> API
    returns the new finish -> /undo -> API returns Fri 26 Feb 2027 again.
  b voice note (fixture audio, fake transcriber) "slab inspection at Seaview is
    done" -> refused, naming the 2 empty photo categories.
  c three captioned photos for those categories -> each filed correctly ->
    retrying b now succeeds.
  d "the windows are late" -> bot asks which job, saves nothing.
  e message from a non-allowlisted user ID -> ignored, nothing saved, logged.
  f "fire reminders" with today Thu 17 Sep -> Dominic gets "Book concrete
    pump" with act-by Fri 18 Sep, and Beatty St amber.
- Playwright: the Monday screen shows the seeded numbers in mock mode and
  local-API mode; after flow a's change, the local-API Monday screen shows Park
  Rd +14 days, $9,000 with Why it moved naming the windows ETA.
- `npm run eval`: 30 realistic messages (Australian phrasing, site jargon,
  typos, relative dates, ambiguous ones where the right answer is a question)
  with expected operations, run against each configured provider with real
  keys, printing pass rate and cost per provider; skips providers with no key.
  Not part of `npm test`.

## GitHub

Public repo `construction-tracker` (account sct-X). Actions: test and build on
every push to main, deploy the web app in mock mode to Pages. Vite base path =
repo name, noindex meta tag. Commit per stage with clear messages. README
covers: running the full stack on a Mac, creating the bot with BotFather and
finding Dominic's Telegram user ID, filling .env, running the eval, moving the
same setup to a Windows or Linux mini PC.

## Prior art

The five-person prototype lives read-only at `/Users/imac/dev/construction-tracker`
(commit 2f6d8a7). Its `src/domain/` calculator and `src/seed/` data already hit
the Park Rd / Seaview / Beatty numbers; port freely (`git -C
/Users/imac/dev/construction-tracker show 2f6d8a7:<path>`). Its PROGRESS.md
"Decisions" section explains the seed tuning. Never write to that folder.
