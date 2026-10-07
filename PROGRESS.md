# PROGRESS

## Stage checklist

- [ ] Stage 0: monorepo, types, seed data, calculator, operations layer, migrations, change log and undo, unit tests. Reviewer sign-off: —
- [ ] Stage 1: server API over SQLite, scheduler (Monday snapshot, reminders), web shell, jobs list, Monday screen with Why it moved, both data layer implementations. Reviewer sign-off: —
- [ ] Stage 2: bot: allowlist, text parsing through the LLM interface, ambiguity questions, confirm card with dry-run forecast impact, Edit, Cancel, /undo, read-only questions. Reviewer sign-off: —
- [ ] Stage 3: bot: voice via Transcriber, photos with category matching, hold-point rule, reminders to Telegram. Reviewer sign-off: —
- [ ] Stage 4: remaining read-only screens and change history. Reviewer sign-off: —
- [ ] Stage 5: Setup area, Pages demo deploy, README, eval script. Reviewer sign-off: —

## Decisions

- 2026-10-07 Orchestrator: subagents run on model "opus" = Claude Opus 5.5 (claude-opus-5-5).
- 2026-10-07 Orchestrator: the repo sct-X/construction-tracker already holds the five-person prototype (live on Pages). The rebuild is developed in `/Users/imac/dev/construction-tracker-next`; how it lands on GitHub (replace main, keeping v1 on a branch, or another repo name) is Scott's call, asked separately. The old folder is read-only prior art.
- 2026-10-07 Orchestrator: Seaview's finish is Fri 29 Oct 2027. The brief's "30 Oct 2027" is a Saturday and rule 3 makes a finish a step's end, which is always a working day. Same call the prototype made.
- 2026-10-07 Orchestrator: one Node process (`npm start`) runs the API, the scheduler and the bot over one SQLite connection, so reminders and the bot share state. Each part is still its own package and testable alone.
- 2026-10-07 Orchestrator: operations are pure core functions `(dataset, args, ctx) -> proposed changes` (field-level before/after, plus row inserts/deletes) or a refusal/question. Storage applies changes; undo applies the inverse; a dry run applies to a copy and reruns the calculator. The browser mock and SQLite share this path.
- 2026-10-07 Orchestrator: dates are ISO `YYYY-MM-DD` strings in Australia/Sydney; the clock is `{ today(): string; now(): Date }`.
- 2026-10-07 Orchestrator: carried from the prototype: step end is inclusive (start + duration - 1 working days), a successor starts the next working day, an expected date snaps forward to a working day; rule 1 also excludes other items on the same shipment; amber = more than 7 days unconfirmed, never confirmed = amber.
- 2026-10-07 Stage 0: toolchain: TypeScript 5.9 (not 7), zod 4 (`z.toJSONSchema` for the op catalogue), vitest 5 (vitest 4.1 crashes npm 10.9's installer), better-sqlite3 12. Tests and typecheck resolve `@ct/core` to source (vitest alias, tsconfig `paths`); `npm run build` emits dist in order core, server. Core's tsconfig has `types: []`, so a Node global in core fails typecheck.
- 2026-10-07 Stage 0: rows use `null` for "no value" and every key is always present, so a row round-trips JSON and SQLite exactly (a test loads the seed from SQLite and deep-equals `buildSeed()`). Instants are UTC ISO strings; Sydney formatting goes through Intl. Step forecast start/end are not stored columns (SPEC lists them on step); the calculator derives them and snapshots store them per step.
- 2026-10-07 Stage 0: item status values are `to_do | ordered_or_booked | confirmed | done`; owner and waiting-on are plain text. Shipments belong to a job (`shipment.jobId`).
- 2026-10-07 Stage 0: the Store interface is synchronous (better-sqlite3 is); DashboardApi is async. Store has propose / confirm / cancel / applyChangeSet / undo so the bot's confirm card records a proposed change set before Confirm. Confirming a stale proposal throws ChangeConflictError and leaves it proposed. Undo is refused when a later confirmed change touched the same field or row ("Undo that first").
- 2026-10-07 Stage 0: operations take names, not ids: they fuzzy-match (exact id first) and return a question with `field` + `options` (value = id) when ambiguous; the bot re-runs with `{...args, [field]: value}`. A missing required arg is a question; date args accept words and resolve against the clock. `LocalDashboardApi.applySetup` runs setup ops only; day-to-day changes stay on the bot.
- 2026-10-07 Stage 0: "why it moved" = take back every confirmed change set since the snapshot's `savedAt` that touches the job, replay them one at a time through the calculator, and credit each with the finish it moved. Slip no change explains is `otherDays`.
- 2026-10-07 Stage 0: Beatty's why-it-moved shows the tiler change (seeded `cs-0915-tiler`, voice note Tue 15 Sep, 28 Sep to 5 Oct) as +7 days (27 Nov to 4 Dec) and `otherDays` -2, because the 14 Sep snapshot is the stored Sun 29 Nov that SPEC's +5 / $1,430 needs (no calculator finish can be a Sunday). Beatty's painter and joinery are now expected 12 Oct and 9 Oct (were 19 Oct) so the tiler, not them, sets the Finishes start.
- 2026-10-07 Stage 0: seed is the prototype's tuned program with every non-brief name invented: job names exactly as in SPEC ("Park Rd", not an address), invented trades on ACMA fictitious mobiles, councils as "Council". Second windows shipment "Seaview St windows" (ETA Mon 14 Dec, design) feeds Seaview's Lock-up placeholder (needed Mon 11 Jan) without moving its finish. Side "Norm" exists with no jobs (the brief names no jobs for it). Park Rd has 34 items, every type. Design stages: DA = Design, With council, Approved, Construction certificate; CDC = Design, With certifier, Approved.
- 2026-10-07 Stage 0: relative dates: "Tuesday" / "this Tuesday" = the next one after today; "next Tuesday" = Tuesday of next week; "the 14th" and "16 Nov" = the next one on or after today (ops use prefer past for done, confirmed and note dates).
- 2026-10-07 Stage 0: the to-chase list puts to-do items before ordered/booked ones within a job, then act-by, so "Book concrete pump" leads Seaview rather than a booked item whose act-by has passed. Monday `actByDue` = to-do items with act-by on or before today + 7.
- 2026-10-07 Orchestrator (Scott chose): the rebuild replaces main of sct-X/construction-tracker. The prototype is kept as branch and tag `v1-prototype` on GitHub (commit 2f6d8a7; branch `v1-five-person` also existed). The new history is joined with `git merge --allow-unrelated-histories -s ours origin/main` so the push is a fast-forward, no force push.
- 2026-10-07 Orchestrator: Beatty keeps SPEC's +5 days / $1,430. Why it moved lists each logged change with its own days (tiler +7), and when changes don't add up to the slip it adds one plain line, e.g. "2 days earlier for reasons not in the change log". It never hides the gap.

## Open problems

- (resolved) Beatty's why-it-moved residual: see Orchestrator decision 2026-10-07.
