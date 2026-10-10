# CONTRACTS

The Stage 0 reference. Later stages read this instead of the source. If code and this file
disagree, fix one of them in the same commit.

## Layout and commands

```
package.json            workspaces packages/*; scripts: test (vitest run, all projects), build, typecheck
tsconfig.base.json      strict, NodeNext ESM, paths @ct/core -> packages/core/src (typecheck/tests only)
vitest.config.ts        test.projects = packages/*; each package has its own vitest.config.ts
packages/core           @ct/core   pure TS, runs in Node and the browser (tsconfig types: [] = no Node globals)
packages/server         @ct/server SQLite storage, HTTP API (Fastify), scheduler, reminders (see "Server")
```

- Imports inside a package use `.js` extensions (`./dates.js`). Packages import each other by name (`@ct/core`).
- Tests resolve `@ct/core` to source (vitest alias, tsconfig `paths`); `npm run build` emits `dist/` in order core, server.
  A new package: add it to the root `build` script after its dependencies, give it a `vitest.config.ts`
  with the `@ct/core` alias (copy packages/server/vitest.config.ts), and a `typecheck` script.
- Node 22.12+ (`.nvmrc`). Secrets in `.env` (see `.env.example`); `npm test` needs none.

## Conventions (locked)

- Calendar dates: `ISODate` = `'YYYY-MM-DD'` in Australia/Sydney. Instants: `Instant` = `Date#toISOString()` (UTC, `Z`).
  Instants compare as strings. Format with the Sydney helpers; never `new Date(iso).getDate()`.
- Every row key is always present; "no value" is `null`, never `undefined`. Rows are JSON-safe.
- Field names camelCase in TS, snake_case in SQL (`order` -> `sort_order`, change `table` -> `table_name`,
  `before`/`after` -> `before_json`/`after_json`). Mapping: `packages/server/src/schema.ts`.
- Forecast dates are computed, never stored (except per step inside snapshots).
- Clock is injected everywhere: `Clock { today(): ISODate; now(): Date }`. Default test today `DEFAULT_TODAY = '2026-09-17'`.
- People are plain text (`item.owner`, `item.waitingOn`). No roles, no money hiding, no in-app notifications.
- Dates for people: `formatDate(iso, today)` -> "Mon 16 Nov" (same year as today) or "Fri 12 Mar 2027".

## Types (`packages/core/src/types.ts`)

`Dataset` (keys) and row types (fields):

| key | row | fields |
| --- | --- | --- |
| sides | Side | id, name |
| users | User | id, name, telegramUserId |
| jobs | Job | id, sideId, name, kind `build\|design`, path `DA\|CDC\|null`, weeklyHoldingCost, lastConfirmed, isTemplate, plannedFinish, startDate, startsFromStageId, templateId, createdAt |
| stages | Stage | id, jobId, name, order, status `not_started\|in_progress\|done` (manual on design jobs, derived on builds) |
| steps | Step | id, jobId, stageId, name, order, durationDays (working days), plannedStart, plannedEnd, actualStart, actualEnd, status, isHoldPoint, isPlaceholder, tradeType |
| stepLinks | StepLink | id, jobId, stepId, waitsForStepId ("step waits for that step") |
| requirements | Requirement | id, jobId, stepId, kind `trade\|material`, name, leadTimeWeeks, tradeType |
| items | Item | id, jobId, type (ITEM_TYPES), title, waitingOn, owner, tradeId, neededBy (typed; only used with no step), leadTimeWeeks (null = requirement's, else 0), expectedDate (ignored when on a shipment), status (ITEM_STATUSES), confirmedDate, notes, stepId, requirementId, shipmentId, photoId, createdAt, doneAt |
| trades | Trade | id, sideId, name, type, phone |
| shipments | Shipment | id, jobId, name, supplier, status (SHIPMENT_STATUSES), eta, notes |
| photoCategories | PhotoCategory | id, jobId, stageId (null = job-wide "General"), name, requiredForHoldPoint, order |
| photos | Photo | id, jobId, stageId, categoryId, filePath (relative to photos dir, `/`), caption, takenOn, receivedAt, isPlaceholder, messageId |
| dailyNotes | DailyNote | id, jobId, date, text, createdAt, messageId |
| snapshots | ForecastSnapshot | id, jobId, date (the Monday), savedAt, forecastFinish, stepStarts, stepEnds (Record stepId -> ISODate) |
| inboundMessages | InboundMessage | id, channel `telegram\|email\|web`, sender, rawText, audioPath (rel. DATA_DIR), transcript, photoPath, receivedAt |
| changeSets | ChangeSet | id, messageId, status `proposed\|confirmed\|cancelled\|undone`, summary, opName, opArgs, createdAt, confirmedAt, cancelledAt, undoneAt |
| changes | ChangeRecord | id, changeSetId, seq, kind `update\|insert\|delete`, table (TableName), rowId, field (null for insert/delete), before, after (whole row for insert after / delete before) |

- `ITEM_TYPES`: trade, material, decision, consultant_report, council_request, inspection, defect, condition_of_consent, manual_reminder.
- `ITEM_STATUSES`: to_do, ordered_or_booked, confirmed, done. `SHIPMENT_STATUSES`: design, in_production, shipped, delivered.
- Labels: `ITEM_TYPE_LABELS`, `ITEM_STATUS_LABELS`, `SHIPMENT_STATUS_LABELS`, `STEP_STATUS_LABELS`.
- `TableName` = side, user, job, stage, step, step_link, requirement, item, trade, shipment, photo_category, photo, daily_note
  (changeable tables; `TABLE_KEYS` maps to Dataset keys). Snapshots/inbound/change sets are written by the Store only.
- `emptyDataset()`, `cloneDataset(ds)`.

## Dates (`dates.ts`, `relativeDates.ts`, `money.ts`)

- Working days: `isWorkingDay`, `snapToWorkingDay`, `nextWorkingDay`, `previousWorkingDay`, `addWorkingDays(iso, n)`,
  `stepEnd(start, days)` (inclusive), `workingDaysBetween(a, b)`. `SHUTDOWNS` = 21 Dec 2026 to 8 Jan 2027.
- Calendar: `addCalendarDays`, `addCalendarWeeks`, `addMonths`, `calendarDaysBetween(from, to)`, `lastMonday`, `maxDate`, `minDate`, `isISODate`.
- Sydney: `sydneyDate(instant)`, `sydneyTime`, `sydneyInstant(date, 'HH:mm')`, `sydneyStamp(date, time)`, `sydneyOffsetMinutes`.
- Clocks: `systemClock()`, `fixedClock(today, time='09:00')` (now() ticks 1 ms per call), `overrideClock(today)`,
  `clockFromOverride(process.env.TZ_TODAY_OVERRIDE)`.
- Format: `formatShort` "Mon 16 Nov", `formatLong` "Fri 12 Mar 2027", `formatDate(iso, today?)`, `formatDayMonth` "16 Nov",
  `formatDays(14)` "+14 days", `formatTime` "3:10pm", `formatStamp` "Tue 15 Sep, 3:10pm", `relativeDays(iso, today, {deadline})`.
- `resolveDate(phrase, today, { prefer?: 'future'|'past' }): ISODate | null`. "Tuesday"/"this Tuesday" = next one after today;
  "next Tuesday" = Tuesday of next week; "the 14th" / "16 Nov" = next on/after today (prefer past = last on/before);
  also today, tomorrow, next week, end of the week, in N days/weeks/months, in a fortnight, 16/11[/2026], Nov 16, ISO.
- Money: `slipCost(days, weekly)` = days/7 x weekly, nearest $10 (null weekly -> null); `formatMoney(9000)` "$9,000".

## Calculator (`calculator.ts`)

```ts
forecastJob(ds: Dataset, jobId: string, today: ISODate): JobForecast   // throws on unknown job
forecastAll(ds, today): Record<jobId, JobForecast>                     // live jobs only
makeSnapshot(ds, jobId, today, savedAt, id): ForecastSnapshot          // what the Monday scheduler saves
pickSnapshot(snapshots, today)    // last Monday's, else the latest dated on/before today
holdPointCheck(step, photoCategories, photos, forecastStart?) -> HoldPointCheck
freshnessFor(job, today)          // amber = more than 7 days, or never confirmed
```

`JobForecast`: jobId, kind, today, forecastFinish, plannedFinish, lateDays (forecast - planned), isLate,
snapshot {id, date, forecastFinish, savedAt} | null, slipDays | null, slipCost | null, slipSincePlanDays, slipSincePlanCost,
weeklyHoldingCost, freshness {lastConfirmed, daysUnconfirmed, amber, text}, currentStageId/Name, stages: StageForecast[],
steps: Record<id, StepForecast>, stepOrder (dependency order), items: Record<id, ItemForecast>, holdPoints, nextHoldPoint.

- `StepForecast`: plannedStart/End, forecastStart/End, lateDays, isLate, driver (`planned|started|step|item`), reason
  ("Starts 16 Nov, not 2 Nov, because the Park Rd windows shipment is expected 16 Nov."), waitsFor, holdsUp, itemIds.
- `ItemForecast`: neededBy, actBy, expected (shipment ETA when on a shipment), expectedFromShipmentId, leadTimeWeeks,
  lateDays, isLate, lateText ("14 days after needed" / "overdue by 3 days"), actByPassed, daysSitting.
- `HoldPointCheck`: stepId, stepName, stageId, forecastStart, status, required [{categoryId, name, photoCount}],
  missingCategories (names), filledCount, ok.
- Rules: needed-by excludes the item's own expected date and its shipment-mates' (rule 1); started/done steps use actual
  dates when set; expected dates snap forward to a working day; design jobs have no finish (rule 9).

## Changes (`changes.ts`)

```ts
type Change =
  | { kind: 'update'; table; rowId; field; before; after }
  | { kind: 'insert'; table; rowId; row }
  | { kind: 'delete'; table; rowId; row };
applyChanges(ds, changes, { check = true }): Dataset   // copy; stale before/missing row -> ChangeConflictError
invertChanges(changes): Change[]                        // reverse order, swap, insert<->delete
changesOf(ds, changeSetId), toChangeRecord, fromChangeRecord, findRow, jsonEqual
jobIdOfChange(ds, c), jobIdsOfChanges(ds, changes)
```

## Operations (`operations/`)

```ts
runOperation(ds, name, rawArgs, ctx: OpContext): OpResult
OpContext = { today: ISODate; now: Date; newId?: (prefix) => string }
OpResult =
  | { kind: 'proposal'; op; args; changes: Change[]; summary: string; jobIds: string[] }
  | { kind: 'refusal'; op; reason: string }
  | { kind: 'question'; op; question: string; field: string | null; options: {label, value}[] | null; args }
operationCatalogue(group?: 'daily' | 'setup'): { name, description, group, parameters: JSONSchema }[]
OPERATIONS, OPERATION_NAMES, getOperation(name), defineOp, runOp
```

- Args are validated with zod. A missing required arg -> `question` (per-op wording `ask`, buttons from the op's optional
  `askOptions[field](ds)`), but names first: runOp first runs
  the op on the given args (missing ones guarded) and returns any ambiguity question or unknown-name refusal it hits
  before needing a missing arg (question `args` then omit the missing ones); bad values -> `refusal`;
  an unknown arg -> `refusal` naming it. Nulls and empty strings from an LLM count as "not given".
- Rule 9: step, link and requirement ops refuse design jobs. Rule 8: no planned or actual dates ever go on a
  template (dated args refused; template steps can't be started or done).
- Names are fuzzy-matched (exact id first). Ambiguous -> `question` with `field` and `options` (value = id):
  re-run with `{ ...question.args, [field]: option.value }`. Not found -> `refusal`. Templates are excluded
  except by id or where the op asks for a template.
- Date args take ISO or words ("16 Nov", "next Tuesday"); `resolveDate` against `ctx.today`
  (future for ETAs/expected, past for done/confirmed/note dates).
- Operations never write. Store applies `changes`; summaries are one plain sentence with "Mon 16 Nov" dates.
- Rules at save (`operations/rules.ts`): `ruleRefusalOnSave(after, changes)` / `assertRulesOnSave` (throws
  `RuleRefusalError {reason}`), run by both stores inside confirmChangeSet and applyChangeSet on the data WITH the changes:
  a hold-point step set to done needs every required category filled (`holdPointSignOffRefusal` text); new photo, item
  and daily-note rows (and an item's step/shipment/trade/requirement/photo link) must point at rows that still exist
  ("The photo category this change points at no longer exists, so it can't be saved."). HTTP maps it to 409.

Daily (bot) operations, args (`?` optional):

| op | args | notes |
| --- | --- | --- |
| set_shipment_eta | shipment, job?, eta | "Park Rd windows ETA Mon 26 Oct to Mon 16 Nov" |
| set_shipment_status | shipment, job?, status | |
| mark_step_started | step, job?, date? | sets actualStart |
| mark_step_done | step, job?, date? | hold point: refused with `holdPointSignOffRefusal` ("Can't sign off Slab inspection before pour yet. No photos for: Plumbing under slab, Membrane and termite barrier.") until every required category has a photo; sets actualEnd (+actualStart) |
| set_item_status | item, job?, status, date?, expectedDate? | confirmed sets confirmedDate; done sets doneAt. Stage 6b (v1 "Booked needs an expected date"): ordered_or_booked / confirmed with no expected date (the item's own, or its shipment's ETA) and no `expectedDate` -> question `field: 'expectedDate'`, no options: "Book concrete pump at Seaview St needs an expected date to be ordered or booked. When is it expected?"; `expectedDate` sets item.expectedDate (summary "..., expected Thu 24 Sep"); refused on a shipment item (change the ETA), and a shipment item whose shipment has no ETA is refused ("Give the shipment an ETA first.") |
| set_item_expected_date | item, job?, date | refused for shipment items (change the ETA) |
| override_lead_time | item, job?, weeks | item.leadTimeWeeks |
| add_item | job, type, title, waitingOn?, owner? (default "Dominic"), trade?, step?, neededBy?, expectedDate?, leadTimeWeeks?, notes? | build job with no step and no date -> question (field step), except defect/reminder |
| add_daily_note | job, text, date?, messageId? | |
| attach_photo | job, category?, stage?, filePath, caption?, takenOn?, messageId? | never refuses on names: missing/unmatched/ambiguous job -> question with a button per live job (`askOptions`); stage or category -> question (that job's/stage's categories, incl. General) |
| confirm_job | job, date? | lastConfirmed |
| set_holding_cost | job, dollars (0 = none) | weeklyHoldingCost (null for 0); builds only, not templates; summary "Park Rd holding cost $4,500 a week (was $3,800)" / "... removed (was $4,500)" (review 6 #2: the cost left the web). A job with no cost: the confirm card has no $ (slipText leaves it out) |
| set_stage_status | job, stage, status | design jobs only. Stage 6b: "With council" / "With certifier" read "Pending approval" in summaries, refusals and options (core `stageDisplayName`, readModelsTiming); `resolveStage` matches either name |

Setup operations (web Setup area; `LocalDashboardApi.applySetup` refuses non-setup ops): copy_template
(template, name, startDate, startsFromStage?, weeklyHoldingCost?, path?, side?), create_job (name, kind, path?, side?,
weeklyHoldingCost?, startDate?, plannedFinish?, isTemplate?; design jobs get DA/CDC stages, every job a General category),
edit_job, add_stage (job, name, order?), edit_stage, delete_stage (empty only), add_step (job, stage, name, durationDays,
plannedStart?, after?[], isHoldPoint?, isPlaceholder?, tradeType?), edit_step (recomputes plannedEnd), delete_step
(refused with items; removes links and requirements), add_link / remove_link (step, waitsFor; refuses cycles),
add_requirement, edit_requirement (requirement id; kind?, name?, leadTimeWeeks?, tradeType?), delete_requirement (refused while
items link to it), add_photo_category, save_as_template (job, name: a build's stages, steps, links, requirements and photo
categories copied into a new template with no dates, statuses not started), add_trade, edit_trade, delete_trade. edit_step also
takes `order` (1-based place in its stage, or in the target stage with `stage`; the stage's steps are renumbered). add_trade /
edit_trade phones must be Australian (`formatAuPhone` in `phone.ts`: mobile, landline with area code, 13 / 1300 / 1800, +61) and
are saved written the usual way ("0491 579 212"); anything else is refused with `AU_PHONE_HELP`. edit_trade refuses a rename onto
another trade's name on the same side.

copy_template: stages before `startsFromStage` are done (steps dated the working day before start); the rest run
forward from startDate through links; job.plannedFinish = latest planned end; lastConfirmed = today; weeklyHoldingCost = the arg, else the template's, else null (Setup no longer sends one).

## Dry run (`dryRun.ts`)

```ts
dryRun(ds, { changes, jobIds? }, today): { impacts: JobImpact[]; after: Dataset }
JobImpact = { jobId, jobName, kind, finishBefore, finishAfter, finishDeltaDays, slipBefore, slipAfter,
  slipCostBefore, slipCostAfter, costOfChange, movedSteps: MovedStep[], movedItems, amberBefore, amberAfter }
MovedStep = { stepId, name, from, to, deltaDays, text: "Install windows Mon 2 Nov to Mon 16 Nov" }
```
Confirm card numbers: `impacts[0].finishAfter`, `slipAfter`, `slipCostAfter`, `movedSteps`.

## Fuzzy matcher (`fuzzy.ts`)

`fuzzyMatch(query, candidates: {id, name, aliases?, value?}[])` -> `{kind:'unique', match, score} | {kind:'ambiguous',
candidates} | {kind:'none'}`. Every meaningful query word must match a candidate word (exact, plural, 3+ letter prefix,
or typo distance 1-2); stopwords (the, at, job...) dropped; rd/st/ave expanded; sparky/chippy/brickie mapped. Fully
covered candidates beat partial ones; a tie is ambiguous. "the windows" vs the two shipments -> ambiguous.

## Read models (`readModels.ts`) and DashboardApi (`api.ts`)

All pure `(ds, ..., today)`; lists skip templates; `SideFilter = { sideId? }`.

| function | returns |
| --- | --- |
| mondayRows(ds, today, filter?) | `MondayView {today, weekOf, builds: MondayBuildRow[], design: MondayDesignRow[]}`; builds by slipCost desc; design by oldest desc |
| mondayBuildRow | jobId, name, currentStageName, forecastFinish, plannedFinish, lateDays, snapshotDate/Finish, slipDays, slipCost, slipSincePlan*, weeklyHoldingCost, lastConfirmed, daysUnconfirmed, amber, freshnessText, waitingOn (top 3), actByDue (to do, act-by <= today+7), nextHoldPoint {stepId, stepName, date, filled, required, missing} |
| MondayDesignRow | jobId, name, path, stageName, outstanding, oldestDays, oldestTitle, oldestWaitingOn, amber, freshnessText |
| whyItMoved(ds, jobId, today) | `{snapshotDate, snapshotFinish, forecastFinish, slipDays, slipCost, causes: WhyCause[], otherDays, lines}` |
| jobsList(ds, today, filter?) | `{builds, design}` rows: jobId, name, kind, currentStageName, forecastFinish, slipDays, amber, freshnessText |
| jobOverview(ds, jobId, today) | job, forecast, stages, nextHoldPoint, waitingOn (top 5), notesThisWeek, latestPhotos (6), shipments |
| programView / stepDetail | stages, steps in dependency order, links / step, waitsFor, holdsUp, requirements, items, holdPoint |
| waitingOn(ds, today, {jobId?, type?, owner?, status?, includeDone?, sideId?}) | `{total, groups: [overdue, this_week, later]}` of WaitingRow (Stage 6a: three groups by key date) |
| toChase(ds, today, {owner?, withinDays=14}) | every live job with rows (to do or ordered/booked, act-by within 14 days or past; to-do first, then act-by) |
| shipmentsList(ds, today) | ShipmentRow: eta, status(+Label), linkedCount, earliestNeededBy, isLate, lateDays, owners |
| changeHistory(ds, {jobId?, sideId?, statuses?, limit?}, today?) | newest first: summary, status, message {rawText, transcript}, jobNames, changes [{rowLabel, field, before, after}], effects (with today) |
| designChecklist(ds, jobId, today) | stages with isCurrent, outstanding, oldestDays, items oldest first |
| photoGallery, dailyNotes, tradesList, templatesList | gallery by stage/category; notes newest first; trades with openItems and (6d) jobNames; templates with counts, (6d) path, needs, photoSets, stageNames |

`WaitingRow`: itemId, jobId, jobName, title, type(+Label), status(+Label), owner, waitingOn, tradeId, tradeName,
tradePhone, stepId/Name, shipmentId/Name, neededBy, actBy, expected, leadTimeWeeks, isLate, lateDays, lateText,
actByPassed, overdue (`isOverdue`), daysSitting, notes.

whyItMoved: confirmed change sets with `confirmedAt > snapshot.savedAt` that touch the job are taken back (lenient
inverse), then replayed one at a time with the calculator; each cause = {changeSetId, summary, confirmedAt, messageId,
sourceText (transcript or text), sourceChannel, finishBefore, finishAfter, deltaDays, cost, movedSteps}. `otherDays` =
slip not explained by any change (finish with every change taken back minus the snapshot finish); when non-zero
`lines` has "N days earlier|later for reasons not in the change log". Rule 2 is applied as written: unstarted steps
whose planned start has passed are not pushed to today (Orchestrator decision).

Stage 6a read models (timing first; files `readModelsOverview.ts`, `readModelsTiming.ts`, additions in `readModels.ts`):

| function | returns |
| --- | --- |
| overview(ds, today, filter?) | `OverviewView {today, builds, design}` of `OverviewRow`: jobId, sideId, name, kind, path, stages [{stageId, name, status}], currentStageId/Name, stageLabel ("Pending approval" for With council / With certifier), stagePosition ("Stage 5 of 8"), nextSteps (builds: next 3 not-done steps, under way first then forecast start: stepId, name, stageName, status, start, end, underWay, isHoldPoint, lateDays; design: []), nextHoldPoint (HoldPointSummary), waitingOn (top 3: overdue first, longest overdue first, then key date), overdue (count of isOverdue), outstanding, oldestDays (design), lastConfirmed, daysUnconfirmed, unconfirmed (rule 7), freshnessWords. Builds in dataset (side) order; design by oldestDays desc. NO finish, slip or money fields. |
| topWaiting(rows, n=3), overviewRow(ds, job, today) | as used by overview |
| freshnessWords(freshness) | "Not confirmed for 9 days" (> 7 days), "Never confirmed", else the calculator's text ("Last confirmed 2 days ago") |
| stageDisplayName(name), stagePositionWords(stages, currentId) | "Pending approval"; "Stage 5 of 8" / "All 8 stages done" / "No stages yet" |
| waitingKeyDate(row) | act-by while to do (else expected, else needed-by); once ordered/booked/confirmed: expected, else needed-by |
| tradesThisWeek(ds, forecast, today) | `TradeOnRow[]` {key, trade, stepId, stepName, start, end, underWay, when ("On site, until Fri 25 Sep" / "Mon 21 Sep, in 4 days")}: not-done steps meeting today..today+7, named by the trade items booked on the step (trade name, else waitingOn), else the step's trade type |
| overdueFirst(rows), rowsForJob(ds, forecast, today, includeDone?) | now exported |
| Stage 6c `readModelsProgram.ts` | `isStepOverdue(step, today)` (not done, late, and not started after its planned start or open after its planned end: Dom's red cue; late with both dates ahead is plain words), `isStageOverdue`, `daysLateWords` ("7 days late"), `workStatusWords` (Not started / Under way / Done), `stepWhenWords` ("starts in 6 weeks", "ends today"), `lengthWords` ("3 wks"), `weekRangeWords` ("28 Sep-2 Oct"), `shortWithRelative`, `lookAhead(steps, today)` -> `{weeks: [{n, title, from, to, range, rows: [{step, mode starts/finishes, line "Mon to Thu, Roof plumber, started", late, overdue}]}], horizon, horizonWords, laterLate, laterRest}` (v1 LookAhead), `stageProgressWords` ("In progress, week 3 of 12"), `stageTimeThrough` (0..1), `leadTimeWords`, `holdPointReadinessWords` ("1 of 3 required photo sets uploaded"). `DesignChecklist.done[]` gained `type`. |

- `WaitingRow.keyDate` (waitingKeyDate). `waitingOn()` groups are now THREE (Stage 6a, v1 Waiting on): `overdue` (exactly
  isOverdue, overdueFirst order), `this_week` (key date before next Monday), `later` (the rest and anything without a key date);
  `WaitingGroupKey = 'overdue' | 'this_week' | 'later'` (`next_week` is gone; the bot flattens the groups, so it is unaffected).
  Seed today: 5 / 3 / 39, total 47.
- `JobOverview` gained `stageLabel`, `stagePosition`, `overdue` (every open overdue row, overdueFirst), `tradesThisWeek`,
  `freshnessWords` (the v1 job first page). Its forecast/finish fields stay for the bot; the web doesn't show them.

`DashboardApi` (all async): getToday, listSides, getMonday, getOverview(filter?) (Stage 6a; on the server RPC whitelist), getWhyItMoved, listJobs, getJobOverview, getProgram, getStep,
getDesignChecklist, getWaitingOn, getToChase, getShipments, getPhotos, getDailyNotes, getChangeHistory, listTrades,
listTemplates, getProgramSetup(jobId) (Stage 5), previewSetup(op, args) -> {result, impact, templates}, applySetup(op, args) ->
{ok, changeSet, result} | {ok:false, result, reason}, undo(changeSetId), and sync `photoUrl(photo: {id, caption, isPlaceholder}): string`.
applySetup records every save as coming from Setup: an inbound message `{channel: 'web', sender: SETUP_SENDER ('web-setup'),
rawText: null}` linked as the change set's `messageId` (written only after the changes are checked to apply), so change history
and why-it-moved have `channel/sourceChannel 'web'` and no quoted text. `SetupPreview.templates` = per touched template
`{jobId, name, workingDaysBefore, workingDaysAfter}` (templates have no forecast, so no `impact`).
`new LocalDashboardApi(store, clock, { photoUrl? })` implements it over any Store (web mock and the server routes);
the Stage 1 HTTP client implements the same interface. Photo URLs: `apiPhotoUrl(id)` = `/api/photos/:id/file`
(server route and HTTP client); `placeholderPhotoUrl(photo)` = flat SVG data URL (default for `isPlaceholder`).

Demo dev bar: `DevControls { getToday(); setToday(iso); reset(dataset?) }` (all async), NOT on DashboardApi.
`createMockDashboard(dataset = buildSeed(), today = DEFAULT_TODAY)` -> `{ api, dev, store, clock }` (InMemoryStore +
`SettableClock`). `SettableClock implements Clock` with `set(iso)`.

## Store (`store.ts`; SqliteStore in server)

```ts
interface Store {                       // synchronous; wrap at the API edge
  load(): Dataset;                      // fresh copy
  recordInbound(NewInbound): InboundMessage;            // {channel, sender, rawText?, audioPath?, transcript?, photoPath?, receivedAt?}
  updateInbound(id, {rawText?, transcript?, audioPath?, photoPath?}): InboundMessage;
  proposeChangeSet({messageId?, summary, opName?, opArgs?, changes}): ChangeSet;   // recorded, not applied
  confirmChangeSet(id): ChangeSet;      // applies; ChangeConflictError if stale, RuleRefusalError if a rule no longer
                                        // holds on current data (ruleRefusalOnSave); either way stays proposed
  cancelChangeSet(id): ChangeSet;
  applyChangeSet(input): ChangeSet;     // propose + confirm atomically (same rule check)
  undo(id): { ok: true; changeSet } | { ok: false; reason };   // refused ("Undo that first") if any later confirmed
                                        // change set touched the same row+field (or the row, for insert/delete)
  saveSnapshot(snapshot): ForecastSnapshot;                     // upsert on (jobId, date)
}
new InMemoryStore(dataset, { clock?, newId? })   // + reset(dataset) for the demo
latestUndoable(ds)  // newest confirmed change set (/undo);  undoBlocker(ds, id)
```

## Server storage (`packages/server/src`)

- `openDatabase(file | ':memory:')`: creates the folder, WAL, foreign_keys ON, busy_timeout, runs `migrate`.
- `migrate(db, dir = MIGRATIONS_DIR)`: applies `migrations/NNN_name.sql` in order, once, recorded in `schema_migrations`.
  Add a migration as a new numbered file; never edit a shipped one. Update `schema.ts` to match (a test checks columns).
- `new SqliteStore(file | db, { clock?, newId? })` implements Store; `.db`, `.close()`, `.isEmpty()`, `.insertRow(spec, row)`.
- `seedDatabase(store, dataset = buildSeed(), { replace? })`, `seedIfEmpty(store)`.
- Paths: `resolveDataDir(env, cwd)` (DATA_DIR, default ./data), `dataPaths(dir)` -> {dataDir, dbFile: tracker.db,
  photosDir: photos, audioDir: audio}, `ensureDataDirs`, `photoFile(paths, stored)` (refuses `..`), `dataFile`,
  `storedPhotoPath`, `newPhotoPath(jobId, date, id, ext)` -> "park-rd/2026-09-17-id.jpg".

## Server (`packages/server/src`: http, scheduler, reminders, app)

Root scripts (tsx from source, no build; `--tsconfig packages/server/tsconfig.json` maps `@ct/core` to src):
`npm start` (main.ts: .env, migrate, seed if empty, API + scheduler; Stage 2 bot hook marked in `app.ts`),
`npm run dev:server` (watch), `npm run seed [-- --reset]`, `npm run e2e:server`, `npm run apply-op -- <op> '<json>'
[--message text] [--data-dir DIR] [--today YYYY-MM-DD]` (propose + confirm one op; prints `{ok, changeSetId, summary,
finishAfter, slipAfter, slipCostAfter}`; exit 1 on a refusal/question).

Env: `DATA_DIR` (./data), `PORT` (8787), `HOST` (127.0.0.1), `CT_TODAY` (YYYY-MM-DD; `TZ_TODAY_OVERRIDE` accepted too),
`REMINDER_TIME` (07:00 Sydney), `WEB_DIST` (packages/web/dist), `ENV_FILE` (./.env), `ALLOWED_HOSTS` (comma list of
extra host names for /api; HOST is added when it is a specific address, not 0.0.0.0/::). Set variables beat `.env`.

HTTP (the web HTTP client implements exactly this):

| route | response |
| --- | --- |
| `POST /api/rpc/:method` body `{"args": [...]}` | 200 `{"result": value}` (undefined -> null); `{"error": "plain message"}` with 404 unknown method or `Unknown job/step ...`, 400 bad body/args, 409 ChangeConflictError, 500 otherwise. Missing/empty body = no args. `:method` = `RPC_METHODS` (21): every DashboardApi read (incl. `getProgramSetup`), `previewSetup`, `applySetup` (Setup area only) and `photoUrl`. NOT `undo` (`RPC_EXCLUDED`, 404): the web is read-only and undo/day-to-day changes come only through the bot. A compile-time check makes every DashboardApi method either listed or excluded |
| `GET /api/photos/:id/file` | the file under DATA_DIR/photos as `PHOTO_TYPES` (jpg/jpeg, png, webp, heic, heif; anything else `application/octet-stream` + `Content-Disposition: attachment`), always with `PHOTO_SECURITY_HEADERS` (`X-Content-Type-Options: nosniff`, CSP `default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox`); placeholder seed photos -> the same SVG as `placeholderPhotoUrl` (same headers); 404 `{"error"}` otherwise |
| `GET /api/health` | `{"ok": true, "today": "YYYY-MM-DD"}` |
| other `/api/*` | 404 `{"error"}` |
| any `/api/*` with a bad Host/Origin | 403 `{"error"}`. Host must be localhost, 127.0.0.1, [::1], `*.localhost` or in `ALLOWED_HOSTS` (DNS-rebinding guard); an `Origin` header, when present, must name one of those too |
| any other GET | packages/web/dist: the file if it exists (also with a leading base segment stripped, e.g. `/construction-tracker/assets/x.js`), else `index.html`; 404 text when dist isn't built (checked per request) |

Every request reloads the store, so writes by another process on the same SQLite file (WAL) show up at once.

```ts
buildServer({ store, clock, paths, webDist?, log?, allowedHosts? }): Promise<FastifyInstance>   // not listening; tests use .inject
startApp(config: ServerConfig, { log?, notifier?, clock?, scheduler?, env?, bot? }): Promise<RunningApp>  // {store, clock, server, scheduler, firstTick, notifier, bot, url, stop()}
// Stage 3: the bot starts BEFORE the scheduler (with dataDir and remindersNow = manualReminderText); notifier =
// opts.notifier ?? bot.notifier (Telegram, Dominic's chat) ?? logNotifier.
loadConfig(env, cwd): ServerConfig; clockFromEnv(env); todayOverrideFromEnv(env); loadEnvFile(env, cwd)
applyOperation(store, clock, op, args, { message?, sender? }) -> {ok:true, changeSet, summary, impacts} | {ok:false, result, reason}
removeDatabaseFile(file)                                   // db + -wal + -shm
E2E_DEFAULT_PORT 4310, E2E_DEFAULT_TODAY '2026-09-17', e2eDataDir(port, os.tmpdir()) = <tmp>/ct-e2e-<port>
```

Scheduler (`scheduler.ts`): `startScheduler({ store, clock, notifier, log, reminderTime?, intervalMs? })` runs a tick now
(`firstTick`) and every minute; `createScheduler(...)` -> `{ tick(), start(), stop() }` (ticks never overlap or throw).
A tick: `ensureMondaySnapshots(store, clock)` (each live build job without a snapshot dated `lastMonday(today)` gets
`makeSnapshot(..., savedAt = now)`, id `snap-<job>-<monday>`; catches up a missed Monday) and, from `reminderTime` on,
`fireReminders`. A failed send backs off (`reminderRetryMinutes`: 2, 4, 8, 16, 32, then 60 min; a success resets it),
logging "Sending reminders failed (attempt N; will retry in M min)".

Reminders (`reminders.ts`):

```ts
computeReminders(ds, today): Reminder[]   // pure. Reminder = {key, kind 'act_by'|'unconfirmed', jobId, jobName, itemId, dueOn, text}
fireReminders(store: SqliteStore, clock, notifier): Promise<{ sent: Reminder[]; alreadySent: number; text: string | null }>
interface Notifier { send(n: { text: string; reminders: Reminder[] }): Promise<void> }   // the bot's createTelegramNotifier fits it
manualReminderText(ds, today): string | null   // "/reminders": all due today, ignoring reminder_sent (not recorded either)
logNotifier(log), memoryNotifier() (.sent), reminderText(reminders, today), sentReminderKeys(store)
```

- act_by: Monday `actByDue` rows (to do, act-by <= today + 7) on live builds; key `actby:<item>:<actBy>:soon|due`
  (`due` once act-by <= today). Text: "Seaview St: Book concrete pump. Act by Fri 18 Sep (tomorrow)."
- unconfirmed (Stage 6b; was `amber`): live jobs (build and design) more than 7 days unconfirmed (`freshnessFor(job).amber`);
  key still `amber:<job>:<lastConfirmed|never>` so a reminder already sent isn't resent. Text, in words only (never "amber"):
  "Beatty St: not confirmed for 9 days. Check it and confirm the job." (`unconfirmedText`, from core `freshnessWords`).
- One digest message per run (Stage 6b): "Reminders, Thu 17 Sep:" then lines grouped by job, "<Job>:" (or "<Job>: not
  confirmed for 9 days. Check it and confirm the job.") and "- <item>. Act by Fri 18 Sep (tomorrow)." under it; jobs with
  something overdue first, overdue items first. At most `DIGEST_MAX_LINES` (15) body lines: picked overdue items first, then
  unconfirmed jobs, then items coming up; the rest are NOT claimed (they lead a later digest) and counted in the last line
  "+N more: /reminders for the full list" (`digestLines`, `reminderText`). A long-past act-by (`due`) and an unconfirmed job
  (`repeatWeekly`) go again at most once every `REPEAT_EVERY_DAYS` (7) after the last send, key `<key>:again-<YYYY-MM-DD>`;
  a `soon` act-by goes once. `manualReminderText` (/reminders) is the full list, uncut, same grouping; the bot splits it
  (and the notifier splits any text) on line breaks at Telegram's 4096 characters (bot `MAX_TEXT` 4096). Keys are claimed in
  `reminder_sent` (migration 002, not a Dataset table) before sending and released if `send` throws.

Core fix carried here: add_step asks "which step" for an ambiguous `after` entry with `field: 'afterChoice'`;
re-run with `{ ...question.args, afterChoice: id }`.

## Web (`packages/web`)

### Stage 6a: the v1 look (SPEC "Revision 2026-10-10"); this subsection overrides older Web bullets below

- **One token set**, `src/styles/tokens.css`: v1's Apple foundation (iOS grouped surfaces `--ground/--plate/--raised/--fill`,
  labels `--text/--text-secondary/--text-muted`, `--line`, one tint `--tint/--tint-fill/--tint-wash`, red `--late-ink/--late-bg`
  for overdue ONLY, green `--ok-*`, no amber; `--note-*` = can't-do-yet on the neutral fill), the system face (`--font-ui`,
  `--font-display`, no web font ships), iOS type ramp `--type-large-title ... --type-caption-2`, spacing `--space-1..16`, radii
  `--radius-sm/md/row/segment/thumb/button/lg/sheet/pill`, motion, and the Liquid Glass material `--lg-*` (Regular 52% / blur 20 /
  saturate 175%, Thick 78% / blur 30, edge, highlight, selected pill, glass-button fills). Dark values exist under
  `:root[data-theme='dark']` (nothing sets it yet). The site-materials palette (concrete/steel/timber/hi-vis/amber, Barlow) is gone;
  the `@fontsource` packages are uninstalled.
- **Primitives**, `src/styles/base.css` (ported from v1 base.css): `.btn` (gray) `--primary` (the ONE filled tint button per screen)
  `--tinted` `--fill` `--ghost` `--small` `--desktop` (36px on >= 768px), `.btn--glass` / `.btn--glass-prominent` (static glass
  buttons, press glow from `shell/glassPress.ts`), `.seg` + `.seg__btn[aria-pressed]` (segmented control), `.input`,
  `.form-field` + `.form-field__label` (renamed from v1's `.field`), `.group` / `.group__header`
  (`--large` = a Title 3 group head) / `.group__list` / `.cell` / `.cell--link` (inset grouped list with disclosure chevron),
  `.chevron`, `.table`, `.plate`, `.count`, `.status` + `--late|--note|--ok|--muted|--plain` (`components/StatusText.tsx`, adds the
  "!" for late and note), `.stagebar` (`components/StageBar.tsx`), `.filterbar` / `.filter` / `.filter__select`, `.glass` +
  `.glass--regular|--thick` + `.glass--float` + `.glass--static` + `.glass--yields`, `.lg-press`, `.skip`, `.loading`,
  `.load-error`, `.empty-line`. Fallbacks: solid surfaces without backdrop-filter, under `prefers-reduced-transparency`,
  `prefers-contrast: more` (1px outline) and `forced-colors`; `prefers-reduced-motion` collapses motion; focus is `--focus-ring`.
- **Shell**, `src/app/App.tsx` + `src/styles/shell.css` (ported from v1 shell.css): phone (< 768px, `shell/useNarrow.ts`
  `usePhoneWidth`) = `.topbar` (edge-attached Regular glass: the mark, the side switcher, `phone: 'tool'` glyph links: Changes) and
  `.tabbar` (floating Regular glass capsule, `phone: 'tab'` links: Overview, Waiting on; minimises on scroll down via
  `shell/useTabBarMinimise.ts`, rule `nextMinimised` unit-tested); desktop = `.sidebar` macOS source list (mark + "Tracker", side
  switcher, `nav[aria-label=Main]` with glyphs, `nav[aria-label=Setup]` group). Glyphs: `shell/icons.tsx` (`NavIcon name`,
  `PhoneGlyph`, `LogoMark`: v1's arc-and-dot mark; the "Cruise" name is NOT adopted). `main.shell__content.page` holds every screen.
  Dev bar (`components/DevBar.tsx`, `.devbar`, region "Demo controls": "Today is" + Reset) only in mock mode.
- **Route table** (`app/routes.tsx`): RouteDef adds `group: 'main'|'setup'`, `icon`, `phone: 'tab'|'tool'`, `redirect`. The job
  header's job switcher is every job page's h1, so a job screen starts at h2.
  Main: `#/` Overview, `#/waiting`, `#/shipments` (desktop sidebar), `#/history` (+ `/:jobId`); Setup group `#/setup` (New job),
  `/setup/programs`, `/setup/templates`, `/setup/trades` (desktop only). Redirects: `#/jobs`, `#/monday` -> `#/`; `#/chase` ->
  `#/waiting`. Job tabs, builds: Overview, Program, Waiting on, Shipments (`/jobs/:jobId/shipments`), Photos, Notes; design:
  Checklist, Waiting on. Helpers (`app/jobNav.ts`): `mainLinks(group?)`, `phoneLinks('tab'|'tool')`, `isHere(link, current)`,
  `jobTabs`, `jobHome`, `tabHref`, `switchJobHref`, `fillPath`, `activeTabPath`.
- **Job header** (`shell/JobHeader.tsx`, `data-testid="job-bar"`): v1 PageHeader on every `/jobs/:jobId...` route: back link
  (`back`: "Overview" on a job's home tab, "Job overview"/"Checklist" on another tab, the parent tab's name on a deeper page), the
  job switcher (the job's name is a button in the h1, `job-switcher`; it opens a Thick glass listbox `role=listbox` "Switch job",
  `job-switcher-menu`, options `job-switcher-<jobId>` with `aria-selected`, Builds / Design groups, "(4 overdue)" in late ink;
  arrows, Home/End, type-ahead, Enter/Space, Escape/Tab close and refocus; morph 240ms, fade under reduced motion; while open
  `:root[data-lg-menu]` makes `.glass--yields` static), a design meta line ("Design, DA, Pending approval"), then the tabs
  (`job-tabs`, `nav[aria-label="<Job> pages"]`, `job-tab-<label>`; underlined strip on desktop, sticky glass capsule on the
  phone, current tab scrolled into view). The App loads `getOverview()` (all sides) once for the header and the menu counts.
  Deep link to the other side's job switches side; the side switcher leaves a job page for `#/`.
- **Screens in the v1 look (Stage 6a)**:
  - Overview `screens/Overview.tsx` + `styles/overview.css`: `overview-screen`, groups `overview-builds` / `overview-design`,
    cards `overview-card-<jobId>` (an `<a>` to the job's home; `data-kind`, `data-overdue`): v1's FINAL card only (Dom's D8/D9,
    orchestrator 2026-10-10): the name, `card-bar` (stage bar, aria-label "Stage 5 of 8, Lock-up"), `card-stage`, `card-overdue`
    ("!4 overdue" / "Nothing overdue"). No next steps, waiting-on or freshness on the card: the job first page holds them
    (core `OverviewRow` still carries them, unused by the card); empty
    `overview-empty` "No jobs on this side yet."; desktop "New job" button `overview-new-job`.
  - Job first page `screens/JobOverview.tsx` + `styles/job.css`: `job-progress` (`job-stage`, `job-stage-of`, `job-stage-bar`,
    `job-next-hold` > `job-hold-photos` "0 of 1 required photo set"), `job-overdue` (`job-overdue-count`,
    `job-overdue-<itemId>`, `job-overdue-none`), `job-trades` (`job-trade-<stepId>`, `job-trades-none`), `job-fresh`.
  - Waiting on `screens/WaitingOn.tsx` + `styles/waiting.css` (`#/waiting`, job tab `/jobs/:jobId/waiting`): `waiting-on`,
    `waiting-sub` ("47 to act on, 5 overdue"), `waiting-filters` (Everyone | Mine = owner "Dominic", `waiting-owner-all|me`; the
    job menu `job-picker` on `#/waiting` only, it opens the job's tab), groups `waiting-group-overdue|this_week|later`
    (`data-count`; Later is a closed `<details>`), rows `waiting-row-<itemId>` (`data-overdue`) > `when` (one phrase,
    `ui/when.ts whenWords`), `call` (`tel:` glass button "Call <trade>", the number in its accessible name).
  - Shipments `screens/Shipments.tsx` + `styles/shipments.css` (`#/shipments` side-wide with `ship-job`; job tab
    `/jobs/:jobId/shipments` that job only), ported from v1: `shipment-row-<id>` > `ship-status`, `eta` (the row's figure
    "26 Oct 2026", Title 1 / Large Title) with its relative time, `timing` (`ui/itemWords.ts shipmentTiming`: "ETA 1 week before
    needed" ok tone, "ETA 2 weeks after needed" plain, never red), `needed-by` ("Mon 2 Nov, in 6 weeks"), `linked-items` (the
    count, "3 items"; titles in its title attribute). Desktop: a hairline `.table` on the ground with a Job column side-wide;
    phone: a `.plate` per shipment ("3 items for Park Rd" side-wide). Red only for an ETA gone and not delivered.
  - Program `screens/Program.tsx` + `styles/program.css` + `components/gantt/{Gantt,LookAhead,StagesStrip,timeScale}` (Stage 6c,
    v1 port, read-only): section head (h2 "Program", `program-sub`, view switch). Desktop: v1 Gantt (`gantt`, views All /
    Look-ahead / Late only `program-view-all|lookahead|late`, "Edit program" glass link `program-edit` to the Setup editor);
    rows `gantt-stage-<stageId>` and `g-step-<stepId>` (`data-overdue`; a placeholder-only stage is drawn as its step row) >
    `gantt-bar-<id>` (link to the step; its sr-only text is the step sentence "Mon 2 Nov to Fri 13 Nov, starts in 6 weeks. ..."),
    `gantt-planned-<id>`, `gantt-late-<id>` ("7 days late", red with "!" only when `isStepOverdue`); `gantt-today`,
    `gantt-caption` (legend, or the hovered/focused step's sentence). Phone (< 768px): `program-lookahead-link` /
    `program-full-link`; `stages-strip` > `stage-chip-<stageId>` (current `aria-current`), `lookahead` > `lookahead-week-1..3`,
    `la-step-<stepId>` (line, late words, needs via `needLines`: overdue red, late plain, "not confirmed"), `lookahead-later`,
    `lookahead-more`; `stages` > `stage-band-<stageId>`. Full program = the dense Gantt (164px labels, 44px rows).
  - Step detail `screens/StepDetail.tsx` + `styles/step.css` (v1, read-only, no Mark buttons): h2 step name + meta ("Lock-up
    stage, Window installer"), `step-dates` > `step-forecast` (value only, `rangeWords`), "Forecast, starts in 6 weeks",
    `step-late` (on plan / 7 days late / N days early), `step-planned`, `step-duration`, `step-status`; `step-reason` only when
    there is a why; `hold-point` > `hold-readiness`, `hold-category` ("4 photos" / "! none yet" on the neutral fill),
    `hold-photos` (link to the Photos tab); Order of work `waits-for` / `holds-up` (dates with relative time); Needs: lead times
    line, `needs` list of `components/ItemRow` rows `need-<itemId>` (`data-overdue`; type column, title, "waiting on X, with
    you|<owner>", `when` from `whenWords`, status, `call` glass button "Call <trade>").
  - Design checklist `screens/DesignChecklist.tsx` + `styles/checklist.css` (v1, read-only, no status segments or Add item):
    `ck-summary` > `ck-outstanding` ("2 outstanding, oldest 23 days"), `ck-freshness`; `ck-stages` > `ck-stage-<order>`
    (tick box, `stageDisplayName`, `ck-stage-words-<order>`; the current one a plate with `aria-current=step` and its items
    `ck-item-<itemId>`: "outstanding 23 days" plain, or "! Needed Fri 25 Sep, overdue by 3 days" when past needed-by with
    nothing to come), `ck-empty`; `ck-done` (Done (N), folded). ItemRow: `components/ItemRow.tsx` + `styles/itemrow.css`.
- **Timing first on every screen**: no forecast finish, slip, slip cost, holding cost or Why it moved on the web. Program's
  subtitle is `programSubWords` ("Rough-in. 3 steps later than planned."); Changes shows "Moved N steps at <job>" per effect;
  Setup's change bar shows the steps that move (no finish, no $); Setup New job keeps the PLANNED finish (v1 did). Words: `ui/when.ts` (`shortRelative` "Mon 21 Sep, in 4 days",
  `whenWords`, `stepWhen`), core `freshnessWords`, `stageDisplayName`. Freshness is words only, no amber.
- **Stage 6d screens (v1 look)**. Shared:
  `components/FilterSelect.tsx` (v1 FilterSelect: one `<select class="input filter__select">` in `.filter`, sr-only label unless
  `labelShown`, options may carry `group` for `<optgroup>`).
  - Photos `screens/Photos.tsx` + `styles/photos.css` (job tab, no `ownHeading`): h2 "Photos" + `photos-sub` ("17 photos");
    `photos-filters` > `photos-stage` (All stages / each stage / "General" = the job-wide set, last) and, desktop only,
    `photos-sort` (Newest / Oldest first); stage plates `photo-stage-<stageId|job>` > h3 name and the count words
    (`hold-progress` when the stage has required sets: "4 photos, 1 of 3 required sets", else `stage-count`), `hold-step`
    ("Slab inspection before pour, Mon 28 Sep, in 11 days", open hold points only); categories `photo-cat-<id>`
    (`data-required`) > h4 name, count, `cat-needed` ("needed for inspection", or the neutral "!" note "Needed before the slab
    inspection before pour" while empty); square thumbnail grid (3 across on the phone, 120px auto-fill on the desktop), buttons
    "Open photo: <caption>, taken <date>". Full-size view `lightbox` (`role=dialog`, solid panel over the page: title, Close,
    the image, `view-taken`, `view-received` ("From the bot, Wed 16 Sep, 5:10pm" / "Filed ..."), `view-category`); Escape,
    focus trapped and returned. No upload, no move/delete.
  - Daily notes `screens/Notes.tsx` + `styles/diary.css` (classes `diary__*`; `.notes` belongs to the old job overview):
    h2 "Daily notes" + `notes-sub` ("6 notes"); `notes-list`; weeks `notes-week-<monday>` ("This week, 14-18 Sep", "Last
    week, 7-11 Sep", "Week of 31 Aug-4 Sep"); rows `note-<id>` > `note-date` ("Thu 17 Sep") with the relative day and "From the
    bot, 3:55pm" / "Saved ...". Phone: a plate per day; desktop: a hairline table Day / Note / Came in. No entry box.
  - Changes `screens/History.tsx` + `styles/history.css` (`#/history`, `#/history/:jobId`; v1 Activity): PageHeader "Changes",
    `history-sub` ("7 changes", "2 changes at Beatty St"); `history-filters` > `job-picker` (FilterSelect: All jobs, Builds,
    Design; it moves to `#/history/<id>`); days (h2 "Yesterday", "Tue 15 Sep, 2 days ago") down a timeline rail; rows
    `history-<changeSetId>` (`data-status`) > time, `status` ("Saved" / "Undone" / "Cancelled" / "Waiting for Confirm"), the
    summary, job links (not when filtered), the "Would have changed (not saved):" / "Changed, then undone:" lead, `fields`
    (row, field, before → after; > 12 changes counted by table), `forecast` ("Moved 3 steps at Beatty St" / "Moved no
    forecast."; nothing for confirm-job, note and photo sets), `source-setup` or `source` (the quoted text or transcript and
    "Voice note on Telegram, Tue 15 Sep, 10:11am"). Never a finish or money.
  - Setup (desktop only; `setup/SetupFrame.tsx` = PageHeader (title, meta, back, actions) or, below 768px (`usePhoneWidth`),
    `setup-phone` "Setup works on a computer. Open this page on a desktop."; the old "Setup pages" tab strip is gone, the
    sidebar's Setup group navigates). New job `su-nj`: one 560px column (v1 newJob): Job name, Side (`nj-side-<id>`), Kind
    (`nj-kind`: Build / Design), Approval path (`nj-path-DA|CDC`; the template's path shows picked until one is), Template
    (`nj-template-<id>`, a segmented pick with "8 stages, 29 steps, 25 needs, 13 photo sets"), Start on site (no holding cost:
    review 6 #2; a new job takes its template's weekly holding cost, or none, and the bot sets it with `set_holding_cost`),
    Starts from = the stage ladder `nj-stages` > `nj-from-<stageId>` (number, name, "done" or the stage's planned dates from the
    preview); `nj-preview` (aria-live): "Planned finish" + `nj-finish` (the one finish on the web, as v1), "29 steps, about 35
    weeks, from Mon 21 Sep 2026, in 4 days.", `nj-done`; design: "Pending approval" names and "no program and no finish date";
    `nj-problem`; `nj-create` (the one filled button). Programs `setup-programs`: an inset grouped list, `setup-program-<id>`
    cells (name, stage now, chevron) to the editor. Templates `su-tpl`: meta "1 template on Norm and Dom", header actions
    `fromjob-open` "Save job as template" (toggles the `fromjob` plate: `fj-job-<id>` segmented pick, Template name,
    `fromjob-preview`, `fromjob-create`) and `templates-new-job` "New job"; rows `template-<id>` (name link to the editor,
    "Build, CDC", counts, the numbered stage sequence, Edit / Use for a new job). Trades `su-trades`: meta "18 trades on Norm and
    Dom", header `add-trade-open` "Add trade" opens the `add-trade` plate (Name, What they do, Phone, `add-trade-save` "Save
    trade"); table Trade / Type / Phone (`trade-phone`, Title 3 bold `tel:` link) / On jobs (`trade-jobs`) / Edit
    (`trade-edit-<id>` inline plate, `trade-edit-save`). Program editor `su-ed` (`/setup/programs/:id`, `/setup/templates/:id`):
    v1's editor (review 6 #4): PageHeader back "Program" (the job's Program tab) / "Templates", h1 the job's name, meta "Program
    editor" / "Template editor, 160 working days"; numbered stage chips `ed-stages` > `ed-chip-<stageId>` (`aria-pressed`) and
    `ed-chip-add` "Add stage"; the chart: the Program screen's `components/gantt/Gantt` with the editor-only props `onPickStep`
    (a bar picks its step instead of opening the step page) and `pickedStepId` (`gantt__bar--picked` ring, `aria-current`),
    redrawn from `SetupPreview.program` while a change is pending; a template has no chart but `ed-tree` (v1 StepTree:
    `ed-pick-<stepId>` buttons "Frame, 15 working days"); the panel `editor-panel` (`data-kind`; under the chart below 1400px,
    beside it from 1400px): "Nothing picked / Pick a bar on the chart, or a stage above.", a step `ed-step-<id>`
    (`data-step-name`: `ed-name`, `ed-days`, `ed-trade`, `ed-dates` forecast with relative time (live jobs), `ed-hold`,
    `ed-up`/`ed-down`, `ed-detail-<id>` waits for / needs / remove), a stage `ed-stage-<id>` (name, Move earlier/later, its
    steps, `ed-addstep-<id>` > `ed-newstep-<id>`, Delete when empty) or the new-stage form; after a save the panel stays on what
    was made or changed. `editor` wraps it all. v1's footer, always there: Thick Liquid Glass, sticky (`editor-foot` at rest: "Edit a step to see what moves.", "No
    unsaved changes", Discard and Save disabled; `change-bar` while one edit is pending: the summary, `preview-moved`,
    `bar-note` / `template-impact`, `bar-problem`, "1 unsaved change", `bar-discard` glass, `bar-save` "Save 1 change"
    prominent glass). Still one change at a time, each a setup op previewed first.
  - Read models for them (additive): `tradesList(ds, filter, today?)` rows gain `jobNames` (live jobs with open items for the
    trade, plus, with today, jobs where it is on this week as `tradesThisWeek` names it); `TemplateRow` gains `path`, `needs`,
    `photoSets`, `stageNames`; `SetupPreview.program` (ProgramView after the change for the live build it is about, else null).
- **All screens are now in the v1 look** (6a, 6c, 6d). The old stylesheets (`legacy.css`, `lists.css`, `screens4a.css`) and
  `components/listBits.tsx` are deleted (review 6, item 6); every screen has its own file in `src/styles/` on the v1 tokens.
- **Look** (v1 V3): light by default; dark and "Match device" from the Look menu at the foot of the desktop sidebar
  (`shell/theme.ts`: `readTheme`/`applyTheme`/`saveTheme`, localStorage `ct-theme` in try/catch, `?theme=light|dark|system` in
  the hash too; sets `<html data-theme>`, applied before the first paint in main.tsx). The phone has no menu (the hash param or
  a desktop choice carries over).
- An unknown id (stale link) reads v1's "Not found / Nothing at this address." with an Overview button (`bits.tsx LoadError`,
  `not-found`), not the raw "Unknown step ...".

#### How to build a screen in the v1 style (for the next agent)

1. Read v1's screen (`/Users/imac/dev/construction-tracker/src/screens/<Name>.tsx` + `.css`, read-only) and its reference shot
   (`e2e/screenshots/v1-ref-*.png`; take more with the prototype's `?dev=1&as=dominic&today=2026-09-17`). Drop anything for
   editing, roles, upload or notifications; the web is read-only.
2. Data: `useSideQuery` / `useJobQuery` over DashboardApi; if the screen needs words or groupings, add a pure read model in core
   (`readModels*.ts`) with a test, not logic in the screen. Never show finish, slip or $.
3. Markup: a top-level screen starts with `<PageHeader title meta actions>`; a job screen gets the job header from the shell, so
   it starts with an h2 section title (see `.waiting__head` / `.ships__head`) (the switcher is the h1). Build from
   the primitives: content in `.plate` cards or `.group` > `.group__list` > `.cell` rows, statuses with `<StatusText>` (red only
   when `row.overdue`), dates through `ui/when.ts` so each carries its relative time, the one filled `.btn--primary` per screen,
   secondary actions `.btn--glass`. Phone/desktop: same DOM where possible; switch with `usePhoneWidth()` (768px) or
   `@media (min-width: 768px)` / `.shell--desktop` selectors. Glass only on the floating layer (sticky filter bars on the phone,
   menus): `glass glass--regular glass--float`; never on content.
4. CSS: one file per screen in `src/styles/`, BEM-ish prefix per screen (`overview__`, `job__`, `wrow`, `ships__`), every value a
   token. Delete rules nothing uses (grep the class, then build).
5. Test ids stay stable (update the specs in the same change); add the screen to `e2e/screenshots.spec.ts` and compare its
   `<project>-6a-*` shots with the `v1-ref-*` ones at 390 and 1280; specs fail on sideways scroll.

### Earlier stages (kept for history; where they disagree with Stage 6a above, 6a wins)

- Vite + React, hash routes. Route table `src/app/routes.tsx` (`{ path, title, nav?, render(params) }`, ":name" params via
  `matchPath`); nav links are the rows with `nav`, in order. Stage 1: `#/` Monday, `#/jobs` Jobs.
- Data: screens call `useData()` / `useSideQuery((api, {sideId}) => ...)` from `src/data/DataContext.tsx`, never an
  implementation. `src/data/layer.ts` picks one at build time from `import.meta.env.VITE_DATA`:
  `mock` = `createBrowserMock()` (core `createMockDashboard` + localStorage `ct-demo:<SEED_VERSION>`, try/catch) with
  DevControls; `api` = `HttpDashboardApi` (POST `api/rpc/:method` `{args}`, relative URL, trailing `undefined` args
  dropped, `{error}` thrown as `ApiError`). `useData().refresh()` refetches every screen (dev bar uses it).
- Scripts (`-w @ct/web`): `dev` (mock), `dev:api` (proxy /api to `CT_API`, default http://localhost:4310), `build`
  (api, base `./`, `dist/`, what the server serves), `build:pages` (mock, base `/construction-tracker/`, noindex,
  `dist-pages/`), `preview:pages` (port 4320), `typecheck` (src + root e2e). Vitest project `web` (jsdom).
- Playwright (root `playwright.config.ts`, `e2e/`): projects `mock`, `api`, `api-change` (see PROGRESS). Run with
  `npx playwright test [--project=mock]`. Stable test ids: `build-row-<jobId>` (inside: `finish`, `slip`, `slip-cost`,
  `freshness` with `data-amber`, `why-it-moved` > `why-cause` / `why-leftover`, `act-by`), `design-row-<jobId>`
  (`outstanding`, `oldest`), `jobs-group-builds|design` > `job-row-<jobId>` (`data-kind`; inside: `finish`, `slip`,
  `freshness`), `monday-sub`, `side-switcher`, `dev-today`. Headings name their job for screen readers ("Why it moved for
  Beatty St", "Act by this week for Seaview St").
- Stage 4b screens (read-only; files `src/screens/{WaitingOn,ToChase,Shipments,Photos,Notes,History}.tsx`, shared
  `src/components/listBits.tsx` (JobPicker select, CallLink, DateCell), wording `src/ui/itemWords.ts`, styles
  `src/styles/lists.css` imported by those files). Routes: main links `#/waiting`, `#/chase`, `#/shipments`, `#/history`
  (+ `#/history/:jobId`, not in nav); job tabs `#/jobs/:jobId/waiting` (both kinds), `/photos` and `/notes` (tab "Notes";
  builds). Per-job screens are remounted with `key={jobId}`. Test ids: `waiting-group-overdue|this_week|later`
  (`data-count`; next week folds into Later) > `waiting-row-<itemId>` (`data-urgency` late|overdue|none; inside `urgency`,
  `needed-by`, `act-by`, `expected`, `owner`, `status`, `call`); `chase-job-<jobId>` / `chase-row-<itemId>` (`call`,
  `act-by`), `chase-count`, `chase-nothing`; `shipment-row-<shipmentId>` (`ship-job`, `ship-status`, `eta`, `needed-by`,
  `timing`, `linked-items`); `photo-stage-<stageId|job>` > `hold-progress` ("1 of 3"), `photo-cat-<categoryId>`,
  `lightbox`; `note-<id>` > `note-date`; `history-<changeSetId>` (`data-status`; inside `status`, `fields`, `forecast`,
  `source`); `job-picker`. Calls are `tel:` links with the trade name and number written out (`telHref`).
  Shipments read `ShipmentRow.linkedItems`; Changes calls `getChangeHistory({sideId, jobId?})` and shows each
  `HistoryEntry.effects` row (finish before -> after, days, cost) or "Moved no forecast." (nothing for confirm-job,
  note and photo change sets).
- Stage 4a shell (`src/app/App.tsx`, `src/app/jobNav.ts`, `src/components/{MainNav,JobBar}.tsx`). RouteDef grew
  `kinds?: JobKind[]` (job tabs only), `tab?` (tab label), `parent?` (tab a deeper page sits under). `nav` on a path with
  no params = a main link (rail on desktop; phone bottom bar, past 5 links the rest go under a "More" button); `nav` on a
  path under `/jobs/:jobId` = a job tab, in table order, filtered by `kinds`. Every `/jobs/:jobId...` route gets the job bar
  (job name, kind and stage, phone job switcher `job-switcher` that keeps the tab when the other job has it, tabs
  `nav[aria-label="<Job> pages"]`). The desktop rail lists this side's jobs under Jobs (`list "Jobs on this side"`). A deep
  link to a job on the other side switches the side; switching side away from the open job goes to `#/jobs`.
  Helpers: `mainLinks()`, `jobTabs(kind)`, `jobHome(job)` (build -> `#/jobs/:id`, design -> `#/jobs/:id/checklist`),
  `tabHref(job, label)` (null when no such tab), `switchJobHref(route, job)`, `fillPath`. `useJobQuery(load, key)`
  (`src/data/useJobQuery.ts`) = useSideQuery for one id.
- Stage 4a screens (`src/screens/{JobOverview,Program,StepDetail,DesignChecklist}.tsx`, styles `src/styles/screens4a.css`,
  time axis `src/components/Timeline.tsx`: `makeScale`, `TimeAxis`, `TimeGrid` (week/month lines, hatched shutdown, today
  line), `Bar` (dashed planned outline behind a solid forecast bar, or a diamond for a hold point; late words beside it),
  `TimelineKey`). Routes: `#/jobs/:jobId` Overview (builds; a design job is replaced by its checklist),
  `#/jobs/:jobId/checklist` (design), `#/jobs/:jobId/program` (builds), `#/jobs/:jobId/steps/:stepId` (under Program).
  Program: desktop Gantt (filters "From the current stage" default, done stages summarised in one line; "Whole program";
  "Late steps only") with the view switch Gantt / Next 3 weeks / Stages; a phone (<= 760px, matchMedia) has no Gantt and
  opens on the look-ahead (this week incl. steps under way, next week, week after, then "Later, running late"; each step
  with dates, trade, hold point, the reason when late, and its items not yet confirmed). Test ids: `overview-hero`,
  `ov-finish`, `ov-slip`, `ov-slip-cost`, `ov-freshness`, `ov-stages`, `ov-waiting` > `ov-waiting-row`, `ov-hold`,
  `ov-shipments`, `ov-notes`, `ov-photos`; `program-sub`, `gantt` > `g-step-<stepId>` (class `is-late`), `gantt-done`,
  `lookahead` > `la-step-<stepId>`, `stages-strip`; `step-dates` (`step-forecast`, `step-planned`, `step-reason`),
  `hold-point` > `hold-category`, `needs` > `need-<itemId>`, `waits-for`, `holds-up`; `ck-summary` (`ck-outstanding`,
  `ck-oldest`, `ck-freshness`), `ck-stages` > `ck-stage-<order>` > `ck-item`; `job-bar`, `job-switcher`.
- Read-model additions (Stage 4a, all additive): `JobListRow.sideId/path`; `ProgramView.steps` are `ProgramStep`
  (StepForecast + `stageName`, `tradeType`), `ProgramView.items` (open step-linked WaitingRows, act-by order),
  `ProgramView.shutdowns`; `StepDetail.step` is a ProgramStep; `DesignChecklist` items carry `status(+Label)`, `expected`,
  `notes`, plus `done` items, `lastConfirmed`, `daysUnconfirmed`, `amber`, `freshnessText` (Monday design rows use them);
  `WhyCause.changes` (HistoryChange[], field before/after), `sourceKind` 'voice'|'text'|null, `sourceReceivedAt`, so
  Monday no longer fetches change history; `ShipmentRow.linkedItems` [{itemId, title, status(+Label), owner, neededBy}];
  `HistoryFilter` extends SideFilter (`sideId`: entries touching a job or trade on that side); `changeHistory(ds, filter,
  today?)` -> each confirmed entry's `effects: HistoryEffect[]` {jobId, jobName, finishBefore, finishAfter, deltaDays,
  cost, movedSteps} found by taking back every confirmed change set from the page's oldest on and replaying in order
  (so changes older than the snapshot count too); `LocalDashboardApi.getChangeHistory` passes today. `historyChanges(ds,
  changes)` exported.
- Stage 4 review fixes: screens other than Monday are `React.lazy` chunks behind one Suspense in App. The side switcher
  leaves a job page itself; the job bar only follows a linked job's side once per route. Overdue wording everywhere is
  `urgencyWords` (`ui/itemWords.ts`). `monthLabels(scale, widthPx, short?)` lays out axis labels without collisions.
  Type sizes are tokens only: --t-hero, --t-num, --t-num-md, --t-title, --t-h1, --t-h2, --t-body, --t-small, --t-label,
  --t-tiny (phone overrides in tokens.css). Skip link `.skip`; `<main tabIndex=-1>` takes focus on a route change.
- Design rules live in `src/styles/tokens.css` (palette and type) and `app.css`; phone layout is the same DOM at <= 760px.
- Stage 5 Setup (desktop only; files `src/screens/Setup{NewJob,Programs,ProgramEditor,Templates,Trades}.tsx`, shared
  `src/setup/{SetupFrame.tsx,preview.tsx,validate.ts}`, styles `src/styles/setup.css`, classes prefixed `su-`). Routes: `#/setup`
  New job (main link `nav` + `desktopOnly`: in the rail, never in the phone bar or More), `#/setup/programs`,
  `#/setup/programs/:jobId` (editor), `#/setup/templates`, `#/setup/templates/:jobId` (same editor, no dates), `#/setup/trades`;
  `#/setup?template=<id>` preselects a template. `RouteDef.desktopOnly`; the Setup link is `is-section` on its sub-pages. At
  <= 760px every Setup route renders only "Setup works on a computer. Open this page on a desktop." (`setup-phone`). Reads:
  `getProgramSetup(jobId)` -> core `programSetup(ds, jobId, today)` (`setupViews.ts`): job, stages in order with photo categories
  and steps as stored + `waitsFor` ids, `requirements`, `itemCount`, forecast start/end and `lateDays` (live builds only),
  `forecastFinish`, `workingDays` (`programWorkingDays`: longest chain of links), `tradeTypes` on the side. Every write is ONE
  setup op through `applySetup` after a `previewSetup` dry run (debounced, `usePreview`): New job shows planned finish and each
  stage's dates from the proposal's inserted rows before Create, then opens the job (`jobHome`); the editor holds one pending edit
  at a time (other inputs disabled) and docks a change bar (`change-bar`: `preview-finish`, `preview-delta` "7 days later",
  `preview-moved`, `bar-note` "Planned dates don't change...", `template-impact` for templates, `bar-problem`, `bar-save`,
  `bar-discard`) until Save or Discard. Inputs are checked in plain words first (`validate.ts`); core refusals are shown as
  given. Test ids: `nj-preview`, `nj-finish`, `nj-stages`, `nj-done`, `nj-problem`, `nj-create`; `editor`, `ed-stage-<id>`,
  `ed-step-<id>` (`data-step-name`; inside `ed-name`, `ed-days`, `ed-hold`, `ed-trade`, `ed-up`, `ed-down`, `ed-more`),
  `ed-detail-<id>`, `ed-req-<id>`, `ed-addstep-<stageId>`, `ed-newstep-<stageId>`, `ed-saved`; `setup-programs`,
  `setup-program-<id>`; `templates`, `template-<id>`, `fromjob-preview`, `fromjob-create`; `add-trade`, `add-trade-save`,
  `trade-saved`, `trades`, `trade-<id>` > `trade-phone` (tel: link), `trade-edit-<id>`, `trade-edit-save`. Change history shows
  a Setup change set with "Changed in Setup on the computer, <stamp>" (`source-setup`), Monday's why-it-moved the same
  (`why-setup`); a change set with more than 12 field changes is counted by table ("Added 29 steps"). Playwright: project
  `api-setup` (depends on `api-change`, so it runs last on the shared server) runs `e2e/stage5-setup*.spec.ts`; `api` ignores them;
  the mock project runs them too (each test has its own browser storage). Screenshots `e2e/screenshots/<project>-setup-*.png`.

## Seed (`packages/core/src/seed`)

`buildEmptySeed()`: the going-live start: `buildSeed()` minus every non-template job and its rows (keeps sides, users,
trades, the duplex template's job/stages/steps/links/requirements/photo categories; items, shipments, photos, notes,
snapshots and the change log empty). Server: `seedDataset('demo' | 'empty')`, `seedKindFromEnv(env)` (SEED=demo|empty,
blank = demo), `ServerConfig.seed`; startApp seeds a new database with it; `npm run seed -- --reset --empty` (or
`--demo`; default from SEED).

`buildSeed()` (fresh copy), `SEED_VERSION`, `DEFAULT_TODAY`, ids: `SIDE_ND`, `SIDE_NORM`, `PARK_RD` ('park-rd'),
`SEAVIEW`, `BEATTY`, `PARK_RD_WINDOWS` ('sh-pr-windows'), `SEAVIEW_WINDOWS` ('sh-sv-windows'), `BEATTY_TILER`,
`TEMPLATE_DUPLEX` ('tpl-duplex'), `TRADE_IDS`, `SEED_SENDER`. Step ids are prefixed: Park Rd `pr-<step>` (e.g.
`pr-install-windows`), template `tpl-<step>`, Seaview `sv-*`, Beatty `bt-*`.

Numbers (today Thu 17 Sep 2026), all asserted in tests:
- Park Rd: finish Fri 26 Feb 2027 = Mon 14 Sep snapshot, slip 0; Install windows planned Mon 2 Nov; windows act-by Mon
  10 Aug; shipment ETA 26 Oct, in production, 3 linked items (2 Raff). ETA 16 Nov -> Install windows 16 Nov, finish Fri
  12 Mar 2027, slip +14, $9,000. 34 items, every type. Book plasterer act-by Fri 18 Sep.
- Seaview St: finish Fri 29 Oct 2027, slip 0, confirmed 1 day ago; Book concrete pump act-by Fri 18 Sep; hold point
  "Slab inspection before pour" Mon 28 Sep, 1 of 3 categories (missing: Plumbing under slab; Membrane and termite barrier).
  Second windows shipment "Seaview St windows" (ETA 14 Dec, design) makes "the windows" ambiguous.
- Beatty St: finish Fri 4 Dec 2026, slip +5, $1,430, last confirmed 9 days ago (amber); tiler expected Mon 5 Oct.
  Seeded change set `cs-0915-tiler` (voice note, 15 Sep) moved the tiler 28 Sep -> 5 Oct: why-it-moved cause +7 days
  (27 Nov -> 4 Dec), otherDays -2 ("2 days earlier for reasons not in the change log") because the 14 Sep snapshot
  is the stored Sun 29 Nov.
- Design: West St (With council, 2, oldest 23 days), Tollbar Ave (With council, 1, 8), Lower Beach St (Design, 0),
  John St (Design, 1, 4).
- Seeded log: 7 messages / change sets (6 confirmed, 1 cancelled). A week of Park Rd notes; placeholder photos
  (`isPlaceholder`, `filePath: placeholder/<id>.jpg`, no file on disk). Side "Norm" exists with no jobs.

## LLM (`packages/llm`, `@ct/llm`)

Plain fetch, no SDKs; Node globals allowed (tsconfig `types: ["node"]`). Tests use `FakeLlm` or an injected `fetch`; no keys, no network.

```ts
interface ToolDef { name; description; parameters: object /* JSON schema */ }
type ChatMsg = { role: 'user' | 'assistant'; content: string }
interface LlmRequest { system; messages: ChatMsg[]; tools: ToolDef[] }
interface LlmResponse { toolCalls: { name; args; malformed?; rawArgs? }[]; text?; usage: { inputTokens; outputTokens } }
interface LlmProvider { readonly id; readonly model; complete(req): Promise<LlmResponse> }   // throws LlmError {provider, status?}
type ParseResult = { kind: 'ops'; calls: { op; args }[] } | { kind: 'read'; tool; args } | { kind: 'question'; text } | { kind: 'reply'; text }
interface ParseContext { today: ISODate; jobs: string[]; trades: string[]; shipments: string[]; history?: ChatMsg[] }
createParser(provider, { onResponse? }): Parser            // parser.parse(text, ctx): Promise<ParseResult>
createProviderFromEnv(env, { fetch? }): LlmProvider        // plain-English Error when provider/key missing
new FakeLlm(script: (LlmResponse | (req) => LlmResponse)[])  // .requests, .remaining; throws when exhausted
toolCall(name, args), textReply(text)                      // script helpers
mapResponse(res): ParseResult; buildSystemPrompt(ctx); normalizeMessages(msgs)
costUsd(usage, model): number | null; priceFor(model); MODEL_PRICES
```

Tools the parser offers (`parserTools()`): `opTools()` = core `operationCatalogue('daily')` minus `BOT_SET_ARGS`
(`filePath`, `messageId`: the bot sets them before `runOperation`), then `READ_TOOLS`, then `ASK_QUESTION_TOOL`
(`ask_question {question}`). Read tools (the bot answers from read models, fuzzy-matching names itself; never a change):

| tool | args | answer from |
| --- | --- | --- |
| get_job_finish | job | forecast finish, planned finish, slip and slip cost (`mondayRows` / `forecastJob`) |
| get_why_it_moved | job | `whyItMoved` |
| get_waiting_on | job?, owner? | `waitingOn` |
| get_to_chase | owner? | `toChase` |
| get_shipments | job? | `shipmentsList` |
| get_next_hold_point | job | `jobOverview(...).nextHoldPoint` (date, empty categories) |

Mapping (`mapResponse`): malformed args -> `question` `REPHRASE_QUESTION`; `ask_question` -> `question` (wins over ops);
any op -> `ops` in call order (reads ignored); else the first read -> `read`; else text -> `reply` (`FALLBACK_REPLY`
when empty). Unknown tool names are dropped (only unknown -> rephrase question). Op args go to `runOperation` as the
model gave them: names as said (core fuzzy-matches), dates as said (core resolves against the clock).

System prompt: Sydney today with weekday ("Today is Thursday 17 September 2026 (2026-09-17, ...)"), site jargon
(lock-up, hold point, before-cover, OC, PC items, sparky/chippy/plumbo/brickie), the job/trade/shipment names, and the
rules (only provided tools, never invent ids, names and dates as said, ask when the job is unclear, a question is never
a change, chit-chat -> one sentence, no tool).

Providers (`id`, default model, endpoint): `openai` gpt-5-mini `POST {base}/chat/completions` (Bearer; tools
`{type:'function', function}`; `max_completion_tokens` 4096; no temperature); `gemini` gemini-2.5-flash
`POST {base}/models/{model}:generateContent` (`x-goog-api-key` header; `systemInstruction`, `contents` user/model,
`tools[0].functionDeclarations`, `toolConfig.functionCallingConfig.mode AUTO`; `toGeminiSchema` keeps only type,
format (string enum/date-time, number float/double, integer int32/int64), description, nullable, enum (as strings),
properties, required (only kept keys), items, minItems, maxItems, minimum, maximum, anyOf, title; `["x","null"]` and
anyOf-with-null -> nullable; const -> enum; no-property tools get no `parameters`); `anthropic` claude-haiku-4-5
`POST {base}/messages` (`x-api-key`, `anthropic-version: 2023-06-01`, `input_schema`, `tool_choice auto`, max_tokens
1024). Options `{ apiKey, model?, fetch?, baseUrl?, maxTokens?, timeoutMs (30000), retries (1, on 429/5xx/network),
retryDelayMs }`. Usage: Gemini output = candidates + thoughts tokens; Anthropic input includes cache tokens.

Env: `LLM_MODEL` is the one line that picks the model AND the provider (gpt-* / o<digit>* -> openai, gemini-* -> gemini,
claude-* -> anthropic); `LLM_PROVIDER` is only read when `LLM_MODEL` is blank (that provider's default model) or not a
known family (e.g. a fine-tune id); a stale `LLM_PROVIDER` never overrides a known model. `.env.example` ships
`LLM_MODEL=gpt-5-mini` with `LLM_PROVIDER` commented out. Keys: `OPENAI_API_KEY`, `GEMINI_API_KEY` (or `GOOGLE_API_KEY`), `ANTHROPIC_API_KEY`; optional `LLM_BASE_URL`,
`LLM_MAX_TOKENS`, `LLM_TIMEOUT_MS`, `LLM_REASONING_EFFORT` (openai), `LLM_THINKING_BUDGET` (gemini).

Prices (`MODEL_PRICES`, USD per 1M input/output, ESTIMATES from vendor pricing pages, edit when they change):
gpt-5-mini 0.25/2.00, gpt-5-nano 0.05/0.40, gpt-5 1.25/10.00, gemini-2.5-flash 0.30/2.50, gemini-2.5-flash-lite
0.10/0.40, claude-haiku-4-5 1.00/5.00, claude-sonnet-4-5 3.00/15.00. Dated ids match their base.

## Bot (`packages/bot`, `@ct/bot`)

grammY, long polling only (no webhook). Depends on `@ct/core` and `@ct/llm`; tests also use `@ct/server` (vitest alias
and tsconfig `paths`, never a runtime import, so server -> bot is not a cycle). Started by the server (`startApp`) in the
same process over the same store and clock; `RunningApp.bot` is the `RunningBot` or null.

```ts
createBot({ token, allowedUserId, store, clock, parser, log?, transport?, botInfo?, transcriber?, photoStore?, pendingTtlMs? }): BotHandle
  // BotHandle { bot: grammY Bot, handleUpdate(update), pending: Map<chatId, Pending>, cards: Map<csId, Card>,
  //             handleInbound(chatId, inbound, text, { transcript?, replyTo?, botArgs?: { filePath? } }) }
  //             // Stage 3: transcripts and captions; the photo handler passes the stored file as botArgs.filePath
startBot({ store, clock, log, env, parser?, transcriber?, photoStore? }): Promise<RunningBot | null>  // {handle, stop()}
botConfigFromEnv(env) -> {ok, token, allowedUserId} | {ok:false, reason}
cardText({ summary, transcript?, changes, impacts, ds, today }); changeLines; impactLines; finishSentence; valueText; fieldLabel
answerRead(api: DashboardApi, tool, args) -> { text }      // the 6 read tools; unknown tool -> a plain "can't answer" text
// Stage 3 (createBot also takes transcriber?, media?, downloader?, remindersNow?, apiRoot?; startBot dataDir?, media?,
// downloader?, remindersNow?; RunningBot.notifier; BotHandle.photoQueue)
interface Transcriber { name?; transcribe(audioFile, { prompt, language?: 'en' }): Promise<{ text }> }   // throws -> polite reply
new WhisperCppTranscriber({ modelPath, whisperBin? ('whisper-cli'), ffmpegBin? ('ffmpeg'), threads?, timeoutMs? (120 s), spawn?, tmpDir? })
  // spawn(args array, shell: false, windowsHide): ffmpegArgs(in, wav) = -hide_banner -loglevel error -nostdin -y -i IN -ar 16000
  // -ac 1 -c:a pcm_s16le WAV; whisperArgs = -m MODEL -f WAV -l en --prompt P -nt -np -otxt -of BASE [-t N]; reads BASE.txt
  // (stdout fallback); temp folder removed; cleanTranscript drops [BLANK_AUDIO] etc. and joins lines
new CloudTranscriber({ apiKey, model? ('gpt-4o-mini-transcribe'), baseUrl?, fetch?, timeoutMs? (60 s) })
  // POST {base}/audio/transcriptions multipart: file (".oga" sent as voice.ogg), model, prompt, language, response_format json;
  // Authorization: Bearer header (never the URL)
new FakeTranscriber(script: (string | Error | fn)[])     // .calls, .remaining
transcriberFromEnv(env) -> {ok, transcriber, description} | {ok:false, reason}
transcriptionPrompt({ jobs, trades, terms? = SITE_TERMS }) // "Construction site update. Jobs: ... Terms: lock-up, hold point,
  // before-cover, OC, PC, practical completion, slab, frame, fit-off, rough-in. Trades: ..." (<= 700 chars, trades trimmed first)
interface MediaStore { saveAudio(data, {date, ext}) -> {storedPath "audio/<date>-<12hex>.<ext>" (rel DATA_DIR), file};
  removeAudio; savePhoto(data, {date, ext}) -> {filePath "telegram/<date>-<12hex>.<ext>" (rel photos dir), file};
  removePhoto; flag(name); setFlag(name) }   // diskMediaStore(dataDir): flags in DATA_DIR/bot-state.json
interface FileDownloader { download({ fileId, filePath }): Promise<Uint8Array> }   // telegramDownloader(token, {apiRoot?})
createTelegramNotifier(api, chatId) -> { send({ text }) }  // the server's Notifier; splits > 4000 chars on lines; throws on failure
```

Env: `TELEGRAM_BOT_TOKEN` (unset -> "Telegram bot off" log; `@ct/server` depends on `@ct/bot`; e2e-server and server tests pass `bot: false`; startApp only then loads `@ct/bot`, by dynamic import),
`DOMINIC_TELEGRAM_USER_ID` (digits; unset -> off), and the LLM env (provider/key missing -> the bot STILL starts with
`parser: null`, warn "No language model: <reason>. ..."; reminders, /undo, /reminders, buttons and photo filing by buttons
work; typed text and voice transcripts get `NO_MODEL_REPLY` "I can't read messages yet: add a model key to .env.").
Voice: `TRANSCRIBER=local|cloud` (unset: local when `WHISPER_MODEL_PATH` is set, else voice off; never cloud by itself),
local: `WHISPER_MODEL_PATH` (required), `WHISPER_CPP_BIN` (whisper-cli), `FFMPEG_BIN` (ffmpeg), `WHISPER_THREADS`; cloud:
`TRANSCRIBE_API_KEY` or `OPENAI_API_KEY`, `TRANSCRIBE_MODEL` (gpt-4o-mini-transcribe), `TRANSCRIBE_BASE_URL`. Optional
`TELEGRAM_API_ROOT` (a local Bot API server; tests use a fake one).
Network: main.ts calls `net.setDefaultAutoSelectFamilyAttemptTimeout(connectAttemptMsFromEnv())` right after loading
.env (`NET_CONNECT_ATTEMPT_MS`, default `DEFAULT_NET_CONNECT_ATTEMPT_MS` 2500; grammY's node-fetch and native fetch
both read it). startBot installs `pollingNetworkLog(log)`: a getUpdates HttpError logs warn "Can't reach Telegram,
retrying: <code>" once per outage (`networkErrorCode`), then info "Reached Telegram again.".
`startApp(config, { env?, bot? })`: `env` default `process.env`; `bot: false` never starts it.

Behaviour:
- Allowlist middleware runs first: any update whose `from.id` is not the allowed id gets no reply, no inbound row,
  no parse; one `warn` log line "Ignored a text message from Telegram user <id> (@name): not the allowed user."
  (button presses: "Ignored a button press ..."). Dominic in a non-private chat (group, supergroup, channel) is ignored
  the same way ("... in group chat <id>: the bot only talks in a private chat."). README: turn off "Allow Groups".
- Errors: a second middleware catches anything a handler throws: logged ("Error handling update <id>"), the button press
  answered, and "Something went wrong on my side, so nothing was saved. Try again in a minute." sent. A parser/provider
  failure: "I couldn't read that just now (the language model didn't answer). ... Nothing saved."
- Updates are handled one at a time by grammY's built-in poller (`bot.start`); the pending/card state relies on that.
  Don't add `@grammyjs/runner` (concurrent updates) without locking per chat. A slow provider holds later updates.
- Every allowed text (commands too) -> `recordInbound({channel: 'telegram', sender: String(from.id), rawText})` first.
  Other messages (stickers, non-image documents...): "I can read text, voice notes and photos. ...".
- `/undo` (or "undo" / "undo that" not as a reply) -> newest confirmed change set whose message came in on Telegram.
  "undo" (or `/undo`) as a reply to a card -> that card's change set: looked up in memory, else read off the card's
  button callback data (survives restarts). Core's refusal text is sent as is ("Can't undo "X": it was changed again
  since ("Y"). Undo that first."). `/start`, `/help` -> one-paragraph help; `/cancel` drops a pending question.
- Parse context: today, live job names, trade names, live jobs' shipment names, history (only in a question/edit thread).
  `reply` -> text; `read` -> `answerRead` via `LocalDashboardApi` (never a change set); `question` -> sent, pending
  `parser-question` (the reply is parsed with [user, question] history); `ops` -> each call through `runOperation` in
  order on a working copy (later calls see earlier changes). Only `daily` ops. Bot-owned args (`BOT_SET_ARGS`:
  `messageId`, `filePath`) are stripped from every call (model output and resumed questions alike) and set by the bot:
  `messageId` = the linked inbound row, `filePath` = `botArgs.filePath` from the photo handler. An op taking `filePath`
  (attach_photo) without one -> "Send the photo itself (as a photo or a file) and I'll file it. Nothing saved."; a core
  question about a bot-owned arg is never asked. Core attach_photo also refuses a path outside the photos folder
  (`isSafePhotoPath`: relative, `/` only, no `..`, no drive or scheme). Refusal -> reason + "Nothing saved." A model
  free-text reply is clipped to 400 characters.
- A core question pauses the run: options become inline buttons (`a:<n>`), one per row; a pressed or typed option
  (number, label, fuzzy) re-runs with `{...args, [field]: value}` plus the calls before and after, the label added to
  the history. Any other text while a question is open (incl. any answer to a no-options question, never taken raw) is
  parsed ON ITS OWN first: if that gives ops, it is a new request (question dropped, change linked to this message);
  otherwise it is parsed again with the thread's history and the result links to the message that started the thread.
  A pending question also ends after `pendingTtlMs` (30 min), on any other button press, `/undo`, "undo" or `/cancel`;
  an expired option button answers "That question has expired. Send the message again." When core asks
  for a missing arg, names are already resolved (core runOp, "names first"), so "the windows are late" -> "Which
  shipment do you mean by "the windows"?" [Park Rd windows (Park Rd)] [Seaview St windows (Seaview St)], then the ETA.
- All proposals of one message -> ONE change set (`proposeChangeSet`, status proposed, `messageId` = the first message
  of the thread, or the correction for an Edit). `opName`/`opArgs` = the op and validated args (several calls: names
  joined with ", " and `{calls}`). Card (plain text, no parse mode): "Heard: ..." (transcript, Stage 3), the summary,
  "- <row>, <field>: <before> → <after>" per change, then per touched build job: up to 4 "<Step> starts Mon 16 Nov (was
  Mon 2 Nov)", "Finish Fri 12 Mar 2027 (was Fri 26 Feb 2027)", "Slip +14 days, $9,000 since last Monday" (or "No change
  to the forecast (finish ...)"), then "Save this?". Buttons `c:<cs>` Confirm, `e:<cs>` Edit, `x:<cs>` Cancel.
- Confirm -> `confirmChangeSet`; card edited to "Saved. <summary>." + "<Job> finishes <date>, <slip> since last
  Monday." with an `u:<cs>` Undo button. ChangeConflictError -> stale card cancelled and edited to "Out of date, nothing
  saved: ...", then "That card was out of date: something changed since I made it, so nothing was saved. Here's a fresh
  one." and the same calls re-run against current data -> a new card. Cancel -> `cancelChangeSet`, card "Cancelled,
  nothing saved: <summary>." Edit -> cancelled at once, card "Changing this one (not saved): ...", bot asks "What should
  it be instead? ..."; the reply is parsed with [original, "Proposed: <summary>.", the ask] history -> a NEW card.
- Undo (button, reply or /undo) -> `store.undo`; "Undone: <summary>." + finish lines; the card loses its buttons.
- Stage 6b wording (SPEC revision 2026-10-10): never "amber": a card that confirms an unconfirmed build says "Confirmed again:
  it hadn't been confirmed for 9 days" (`impactLines(impact, today, before?)`). Waiting-on / to-chase answers: overdue (v1:
  needed-by and expected both passed, or nothing expected, and not done) first, "- Tile choice (Dominic): needed Mon 14 Sep,
  overdue by 3 days"; late but not overdue (expected after needed-by) in plain words, "- Book tiler (Harbour Tiling): expected
  Mon 5 Oct, 7 days late (needed Mon 28 Sep)" (`itemTiming`, `waitingLine`); shipments ", N days late for when it's needed".
  Stage names "With council" / "With certifier" read "Pending approval" (card rows, design-job finish answer "It's at the
  Pending approval stage."). Booked with no expected date: core's question is sent with no buttons; the answer is parsed with
  the thread like any no-options question, then the card.
- Pending state and the card map are in memory (one chat). A restart loses pending questions, not cards' buttons.
- Change history quotes the right text: a change set's message is the message that started its thread (a pick or a
  short answer is a detail of it), a fresh request's own message, or the correction for an Edit.

Stage 3 behaviour:
- Voice notes and audio files (`message:voice`, `message:audio`): "typing" action, getFile + downloader (20 MB cap), saved
  via MediaStore under DATA_DIR/audio, transcribed with the priming prompt, THEN `recordInbound({rawText: caption,
  audioPath, transcript})` and `handleInbound(..., transcript, {transcript})` (same parse/question/card flow). Cards start
  `Heard: "..."`; a refusal, question, model reply or "Nothing to change" in the first turn starts with it too.
  Transcriber error or empty transcript: audio file deleted, NO inbound row, "Sorry, I couldn't make out that voice note:
  the transcriber didn't work. Nothing saved. Try again, or type it." No transcriber/media: "Voice notes aren't switched on
  here yet...". Download failure: "I couldn't download that voice note from Telegram...".
- Photos: `message:photo` keeps the largest size (width x height, then bytes); `message:document` with an `image/*` mime is
  kept as sent (full resolution); other documents fall through. Saved under photos/telegram/ (unique name), inbound row
  `{rawText: caption, photoPath}`. The first compressed photo ever (flag `photo-as-file-tip`) also gets "Tip: to keep a
  photo at full resolution, send it as a file ...". Then attach_photo runs with bot-set `filePath`/`messageId`: the
  caption is parsed as "Photo caption: <caption>"; its first attach_photo call gives job/stage/category (other ops in the
  same answer join the same card AFTER the photo, so "membrane photo, slab inspection done" files the photo first and the
  sign-off passes); no attach_photo call -> attach_photo with the job of another call, if any; `caption` is always the real
  caption. No caption, parse failure or no match -> core asks with buttons (job, then that job's/stage's categories incl.
  "General"). Questions and the card are sent as replies to the photo (`reply_parameters`). Cards add hold-point progress
  for required categories, from the data with the change applied: "Slab inspection before pour photos: 2 of 3. Still
  needed: Membrane and termite barrier." / "... 3 of 3. All there, so it can be signed off." (also on the Saved card).
- One question at a time: a photo arriving while a photo question is open waits in `photoQueue` ("Got it. I'll ask about
  this one when the photo before it is sorted.", silent inside an album); after every update (`afterTurn`), if no live
  question is open, the next waiting photo is processed. An open photo question survives Confirm/Cancel/Undo presses on
  other cards, /undo and "undo"; Edit or a new text request puts it aside (front of the queue) and it is asked again
  after ("Back to this photo: ..."). A stale option button doesn't lose it. /cancel drops it and the queue.
- Albums (media groups): each photo gets its own card. Photos without their own caption use the album's caption; the
  first photo's parsed args, and later its answers to questions, are reused for the rest (one model call, one set of
  questions per album; remembered 10 min).
- Unfiled photos are deleted (decision): after every update, a photo stored by this process that is in no confirmed photo
  row, proposed change set, open question/edit or queue is removed from disk and its inbound `photoPath` cleared (logged
  "Deleted photo ...: not filed"). So Cancel, an expired or /cancel-led question, or a refusal deletes it; Edit keeps it
  for the new card; Cancel after a restart still deletes the cancelled card's photo. Confirmed photos stay, even if undone.
- Hold-point rule: core refuses mark_step_done ("Can't sign off ... yet. No photos for: A, B.") + " Nothing saved.".
- Reminders: `/reminders` or "fire reminders" / "send reminders" / "show me my reminders now" (`REMINDERS_WORDS`, no LLM, an
  open question stays open) -> `remindersNow()` text ("Reminders due now, Thu 17 Sep (you asked, so this includes any
  already sent today):" + lines), or "Nothing due right now, Thu 17 Sep."; not recorded in reminder_sent. The daily send
  is the scheduler's `fireReminders` through `RunningBot.notifier` to Dominic's private chat (chat id = his user id).
- Review fixes: Confirm -> `RuleRefusalError` cancels the card (decision: cancelled, not left proposed), edits it to
  "Not saved: <summary>." and sends "<reason> Nothing saved." (e.g. a hold-point photo undone after the card was made).
  A file over 20 MB (Telegram's `file_size`, or getFile's "file is too big") -> `TooBigError` -> "That file is over
  Telegram's 20 MB limit for bots, so I can't fetch it. Send it as a photo or a smaller file. Nothing saved." Photo bytes are checked
  with `detectImageType` (media.ts; magic bytes: jpg, png, webp, heic, heif), which also gives the stored extension;
  anything else (HTML, SVG, GIF, PDF named .jpg...) -> "That file isn't a photo I can keep: I take JPEG, PNG, WebP or
  HEIC. Nothing saved." and nothing stored or recorded. `startBot` runs `handle.sweepOrphanPhotos()` (photos/telegram
  files no photo row or proposed change set refers to; `MediaStore.listPhotos?`). With no card in memory (after a
  restart) Edit / an out-of-date card take `filePath` from the change set's photo insert. A spoken "fire reminders"
  skips the LLM too. The notifier throws only when the first part fails (later parts: two tries, then dropped), so a
  long message is never resent in part.
- Not done (optional Stage 2 review idea): parsing an answer to an open question once with the thread and letting the model
  say whether it's a new request. Still two calls for a free-text answer.

Test harness (`packages/bot/src/fakeTelegram.ts`, exported from `@ct/bot` and re-exported by `test/harness.ts`; also used by
`packages/server/scripts/bot-change.ts`, Playwright's api-change bot step; `parser` may be null): `createHarness({ store, clock, parser, allowedUserId?,
pendingTtlMs?, transcriber?, media?, remindersNow? })` -> `{ handle, log (memory), calls (every API call), messages (bot messages by id, edits
applied, buttons), text(text, {from?, replyTo?, chat?}), press(messageId, buttonTextOrData, {from?}), update(rawUpdate),
sent(calls?), lastWithButton(text), last() }`. Built on a real grammY Bot with `botInfo` preset (`BOT_INFO`) and an API
transformer that records calls and returns fake results (sendMessage -> a message with a new id). `DOMINIC_ID`,
`STRANGER_ID`, `steppingClock(today)` (now() movable with `advance(ms)`). Integration tests (`test/flows.test.ts`): server SqliteStore on a temp file + `seedDatabase`, a second
SqliteStore on the same file behind `buildServer` (`inject` POST /api/rpc/getMonday), `createParser(new FakeLlm(...))`,
`fixedClock('2026-09-17', '10:00')`.
Stage 3 harness additions: `files` (fake Telegram files by file_id; `getFile` answers from it and the injected
downloader serves the bytes), `voice(bytes, {duration?, caption?})`, `photo(bytes, {caption?, mediaGroupId?, width?,
height?})` (three sizes, out of order; `bytes` is the largest), `document(bytes, {mime?, fileName?, caption?})`,
`lastUserMessageId()`. Fixtures in `packages/bot/test/fixtures`: `voice.ogg` (0.6 s Opus, made with ffmpeg),
`plumbing.jpg`, `membrane.jpg`, `steel.jpg`. Tests: `test/stage3.test.ts` (flows b, c, f, photos, voice failures,
scheduler -> TelegramNotifier), `test/transcriber.test.ts` (argv via mock spawn, cloud request, env, prompt; real ffmpeg
when installed), `test/start.test.ts` (startApp + fake Telegram Bot API: the first tick's reminders reach chat 42).
