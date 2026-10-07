# Stage 0 review

Reviewer: fresh skeptical review, 2026-10-07. I read SPEC.md, PROGRESS.md, docs/CONTRACTS.md, everything in
packages/core and packages/server, and ran probes against the operations layer. I did not change any code.

## Commands

| command | result |
| --- | --- |
| `npm ci` | exit 0, 0 vulnerabilities |
| `npm test` | exit 0: 6 test files, 98 tests passed |
| `npm run typecheck` | exit 0 (core, server) |
| `npm run build` | exit 0 (core, then server) |

I also checked that core really can't use Node globals: a file using `process` and `Buffer` added to core's
tsconfig program fails with TS2591, so the `types: []` guard works, test files included.

## What holds up

- The calculator (`packages/core/src/calculator.ts`) has no special cases for any job, shipment or item. It
  applies rules 1-5 generically, and every SPEC number is driven by seed durations and dates.
- The Park Rd 16 Nov scenario is asserted on calculator and dry-run output: `packages/core/test/seed.test.ts:73-98`
  (Install windows 16 Nov, Fri 12 Mar 2027, +14 days, $9,000, and the items still read late against 2 Nov per
  rule 1). It also runs through both stores with undo: `store.test.ts:59-76`, `seed.test.ts:183-194`,
  `server/test/sqliteStore.test.ts:100-124`.
- Seaview (29 Oct 2027, slip 0, 1 day, pump act-by 18 Sep, hold point 28 Sep at 1 of 3), Beatty (4 Dec, +5,
  $1,430, amber at 9 days), the four design rows, act-by Mon 10 Aug, the shipment facts and the second-shipment
  ambiguity are all asserted on computed output.
- Audit tables match SPEC: `inbound_message.channel` has a CHECK for telegram|email|web; `change_set.status` has a
  CHECK for proposed|confirmed|cancelled|undone; `change` stores table/row/field/before/after. The migration is
  numbered, WAL and foreign keys are checked in a test, and a test confirms the column map matches the schema.
- Templates: `copy_template` copies stages, steps, links, requirements and photo categories, and remaps every id
  (`template.test.ts:27-48`).
- The hold-point refusal names the empty categories. Lead times use `addCalendarWeeks`. Working days skip
  weekends and the shutdown. Slip cost rounds half away from zero to the nearest $10. Amber is `days > 7`.
- Seed hygiene is good. The only real job names are the SPEC's seven. Every phone number comes from ACMA's
  published fictitious-number list. Park Rd has 34 items covering all 9 types. There is a Duplex template
  (29 steps, no dates), a week of Park Rd notes (10-17 Sep) and placeholder photos with `isPlaceholder`.
- `DashboardApi` covers every SPEC screen: Monday + `getWhyItMoved`, jobs list, overview, program, step detail,
  shipments, waiting-on, to-chase, photos, notes, design checklist, change history, and Setup through
  preview/apply. `operationCatalogue()` exports zod-derived JSON Schema (draft 2020-12) and is JSON-safe.

## Findings

1. **MUST-FIX** `packages/core/src/operations/setup.ts:225-248` (add_step), and by extension `add_link`
   (`:311`), `add_requirement` (`:348`) and `edit_step` (`:265`). Rule 9 says design jobs have no steps, but
   `add_step` on a design job is accepted. My probe `add_step {job: "West St", stage: "Design", name: "X",
   durationDays: 3}` returned a proposal. `forecastDesign` then ignores the step, so it is invisible yet stored.
   Refuse step and link operations on `job.kind === 'design'`, and add a test.

2. **MUST-FIX** `packages/core/src/store.ts:64-83` (`undoBlocker`). Undo only checks that the inverse still
   applies, i.e. that the current value equals the stored `after`. It does not check what PROGRESS promises:
   "Undo is refused when a later confirmed change touched the same field or row". My probe: A sets the ETA
   26 Oct -> 16 Nov, B sets 16 Nov -> 23 Nov, C sets 23 Nov -> 16 Nov. Then `undo(A)` returns `ok: true` and the
   ETA goes back to 26 Oct, while B and C stay `confirmed`. The log then says the latest confirmed ETA is
   16 Nov while the data says 26 Oct. This shape is easy to hit by voice ("16th... no, 23rd... sorry, 16th"),
   followed by "undo" in reply to the first card. Fix: block the undo whenever any later confirmed change set
   touches the same (table, rowId[, field]), whatever the values. Both stores share `undoBlocker`, so one fix
   covers both. Add the A-B-A test.

3. **MUST-FIX** `packages/core/src/operations/daily.ts:308` and `packages/core/src/operations/framework.ts:204`
   (attach_photo). SPEC Telegram 7 says: "The caption decides job, stage and photo category; if it can't, the
   bot asks." A caption naming no category asks correctly. A caption that names a category that doesn't match
   (probe: `category: "formwork pics"` at Seaview) is a refusal ("I can't find a photo category called...").
   That throws the photo away instead of asking. When `resolveCategory` finds nothing, attach_photo should
   return a question with `field: 'category'` and the job/stage category options, the same as the
   no-category path.

4. NICE-TO-HAVE `packages/core/src/readModels.ts:383`. The "otherDays" line reads "-2 days not from a logged
   change". The Orchestrator decision (PROGRESS, last decision) words it as "2 days earlier for reasons not in
   the change log". Align the wording now, before the Monday screen and bot copy it.

5. NICE-TO-HAVE `packages/core/src/operations/setup.ts:104-107`. Rule 8 says templates have no dates, but
   `create_job {isTemplate: true, startDate, plannedFinish}` gives a template with dates, and `edit_job`
   (`:135`) can add dates to a template. Ignore or refuse dates when `isTemplate`.

6. NICE-TO-HAVE `packages/core/src/operations/daily.ts:115` (also `:91`). `mark_step_done` and
   `mark_step_started` accept a template step by exact id (probe: `tpl-handover` returned a proposal "Handover
   and clean at Duplex done"). That writes actual dates onto a template. Refuse when the step's job is a
   template.

7. NICE-TO-HAVE `packages/core/src/calculator.ts:494-511`. Forecasts never involve `today`. A not-started step
   whose planned start has passed keeps a past forecast start, and an in-progress step's forecast end can sit in
   the past. Probe: Park Rd forecast with today = 20 Nov still finishes 26 Feb, and cladding (not started) still
   "starts" 16 Sep. This is rule 2 exactly as written, so it is correct for Stage 0. But a job that sits idle
   never slips, which undercuts the Monday screen. Ask the owner whether rule 2 should include "not before today"
   for unstarted steps. Do not change the calculator without an owner decision.

8. NICE-TO-HAVE `packages/core/src/operations/framework.ts:139`. The zod objects strip unknown keys silently. If
   an LLM sends a misnamed arg (e.g. `expected` on set_item_status), it is dropped without a word. Consider
   `.strict()`, or carry an `ignored: string[]` on the proposal so the confirm card can show it.

9. NICE-TO-HAVE `packages/core/src/operations/daily.ts:45`. `set_shipment_eta` (and `set_item_expected_date`,
   `:179`) accepts an explicit past date (probe: ETA `2020-01-01` proposed "Wed 1 Jan 2020"). Word dates
   already prefer the future. An ISO past ETA is almost certainly a mistake: consider a question.

10. NICE-TO-HAVE `packages/core/src/operations/setup.ts:102,114`. `create_job` for a design job with no path
    builds the DA stages but stores `path: null`. Store `'DA'`, or ask for the path.

11. NICE-TO-HAVE `packages/core/src/operations/setup.ts:272`. `edit_step` with `stage` moves the step but keeps
    its old `order`, which can collide with steps already in the target stage. Give it `count + 1` in the new
    stage.

12. NICE-TO-HAVE `packages/core/src/api.ts:56-82`. The contract has no hook for the Pages demo's dev bar
    ("today is" and reset, SPEC Screens). `LocalDashboardApi` fixes its clock at construction, and
    `InMemoryStore.reset` is not on any interface. Add a small `DemoControls { setToday(iso); reset() }`, or
    document that the web shell rebuilds the API. There is also no way to get a photo's URL or bytes
    (`getPhotos` returns `filePath` only). Stage 1 needs one, e.g. `photoUrl(photoId)`.

13. NICE-TO-HAVE `packages/core/src/store.ts:97`, `packages/server/src/sqliteStore.ts:38`. Both stores fall
    back to `systemClock()` when no clock is passed. Calculator and read models are clean, but a forgotten
    clock in the bot or demo would stamp real time next to a pretend "today". Consider making `clock` required.

14. NICE-TO-HAVE `packages/core/src/seed/seaview.ts:45-48`. SPEC's data model says stage-level jobs have "one
    placeholder step per stage". Seaview's Slab stage has three real steps (needed for the 28 Sep hold point and
    the 2 Oct pour). That is reasonable, but only the seed comment records it. Add it to PROGRESS Decisions.

15. NICE-TO-HAVE `packages/core/src/seed/index.ts:97`. Beatty's 14 Sep snapshot is a hand-stored Sun 29 Nov,
    which no Monday run could produce. PROGRESS documents and accepts this. Keep a test that fails if someone
    "fixes" it to a calculator snapshot without revisiting SPEC's +5 / $1,430.

16. NICE-TO-HAVE `packages/core/src/seed/parkRd.ts:80` and `packages/core/src/seed/design.ts:61`. Owner and
    waiting-on mix "Dom" and "Dominic". The `toChase`/`waitingOn` owner filters are exact text, so Dominic's own
    list splits in two. Pick one spelling.

17. NICE-TO-HAVE `packages/core/src/seed/duplexProgram.ts:35`. The Park Rd notes for 16-17 Sep say the cladders
    have started, but the `cladding` step is `not_started`. Marking it `in_progress` with `actualStart:
    '2026-09-16'` changes no number (same start, same end) and makes the program view honest.

18. NICE-TO-HAVE `packages/core/test/seed.test.ts`. A few SPEC seed facts have no test: Seaview's $3,800/wk,
    the amber boundary at exactly 7 days (not amber) versus 8, every trade having a phone from the ACMA list, a
    week of daily notes, and placeholder photos. Cheap guards against seed drift.

## Verdict

FIX-FIRST: items 1-3. Each is small and local (one refusal, one blocker rule, one question path) and needs a
test. Nothing in the calculator or the seed numbers needs to change.
