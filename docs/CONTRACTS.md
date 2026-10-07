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
holdPointRefusalText(check)       // "Can't mark X done yet. ... 2 categories are empty: A; B."
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

- Args are validated with zod. A missing required arg -> `question` (per-op wording), but names first: runOp first runs
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

Daily (bot) operations, args (`?` optional):

| op | args | notes |
| --- | --- | --- |
| set_shipment_eta | shipment, job?, eta | "Park Rd windows ETA Mon 26 Oct to Mon 16 Nov" |
| set_shipment_status | shipment, job?, status | |
| mark_step_started | step, job?, date? | sets actualStart |
| mark_step_done | step, job?, date? | hold point: refused with holdPointRefusalText until every required category has a photo; sets actualEnd (+actualStart) |
| set_item_status | item, job?, status, date? | confirmed sets confirmedDate; done sets doneAt |
| set_item_expected_date | item, job?, date | refused for shipment items (change the ETA) |
| override_lead_time | item, job?, weeks | item.leadTimeWeeks |
| add_item | job, type, title, waitingOn?, owner? (default "Dominic"), trade?, step?, neededBy?, expectedDate?, leadTimeWeeks?, notes? | build job with no step and no date -> question (field step), except defect/reminder |
| add_daily_note | job, text, date?, messageId? | |
| attach_photo | job, category?, stage?, filePath, caption?, takenOn?, messageId? | never refuses on names: unmatched/ambiguous job -> question (jobs); stage or category -> question (that job's/stage's categories) |
| confirm_job | job, date? | lastConfirmed |
| set_stage_status | job, stage, status | design jobs only |

Setup operations (web Setup area; `LocalDashboardApi.applySetup` refuses non-setup ops): copy_template
(template, name, startDate, startsFromStage?, weeklyHoldingCost?, path?, side?), create_job (name, kind, path?, side?,
weeklyHoldingCost?, startDate?, plannedFinish?, isTemplate?; design jobs get DA/CDC stages, every job a General category),
edit_job, add_stage (job, name, order?), edit_stage, delete_stage (empty only), add_step (job, stage, name, durationDays,
plannedStart?, after?[], isHoldPoint?, isPlaceholder?, tradeType?), edit_step (recomputes plannedEnd), delete_step
(refused with items; removes links and requirements), add_link / remove_link (step, waitsFor; refuses cycles),
add_requirement, add_photo_category, add_trade, edit_trade, delete_trade.

copy_template: stages before `startsFromStage` are done (steps dated the working day before start); the rest run
forward from startDate through links; job.plannedFinish = latest planned end; lastConfirmed = today.

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
| waitingOn(ds, today, {jobId?, type?, owner?, status?, includeDone?, sideId?}) | `{total, groups: [overdue, this_week, next_week, later]}` of WaitingRow |
| toChase(ds, today, {owner?, withinDays=14}) | every live job with rows (to do or ordered/booked, act-by within 14 days or past; to-do first, then act-by) |
| shipmentsList(ds, today) | ShipmentRow: eta, status(+Label), linkedCount, earliestNeededBy, isLate, lateDays, owners |
| changeHistory(ds, {jobId?, statuses?, limit?}) | newest first: summary, status, message {rawText, transcript}, jobNames, changes [{rowLabel, field, before, after}] |
| designChecklist(ds, jobId, today) | stages with isCurrent, outstanding, oldestDays, items oldest first |
| photoGallery, dailyNotes, tradesList, templatesList | gallery by stage/category; notes newest first; trades with openItems; templates with counts |

`WaitingRow`: itemId, jobId, jobName, title, type(+Label), status(+Label), owner, waitingOn, tradeId, tradeName,
tradePhone, stepId/Name, shipmentId/Name, neededBy, actBy, expected, leadTimeWeeks, isLate, lateDays, lateText,
actByPassed, overdue (`isOverdue`), daysSitting, notes.

whyItMoved: confirmed change sets with `confirmedAt > snapshot.savedAt` that touch the job are taken back (lenient
inverse), then replayed one at a time with the calculator; each cause = {changeSetId, summary, confirmedAt, messageId,
sourceText (transcript or text), sourceChannel, finishBefore, finishAfter, deltaDays, cost, movedSteps}. `otherDays` =
slip not explained by any change (finish with every change taken back minus the snapshot finish); when non-zero
`lines` has "N days earlier|later for reasons not in the change log". Rule 2 is applied as written: unstarted steps
whose planned start has passed are not pushed to today (Orchestrator decision).

`DashboardApi` (all async): getToday, listSides, getMonday, getWhyItMoved, listJobs, getJobOverview, getProgram, getStep,
getDesignChecklist, getWaitingOn, getToChase, getShipments, getPhotos, getDailyNotes, getChangeHistory, listTrades,
listTemplates, previewSetup(op, args) -> {result, impact}, applySetup(op, args) -> {ok, changeSet, result} | {ok:false,
result, reason}, undo(changeSetId), and sync `photoUrl(photo: {id, caption, isPlaceholder}): string`.
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
  confirmChangeSet(id): ChangeSet;      // applies; ChangeConflictError if stale (stays proposed)
  cancelChangeSet(id): ChangeSet;
  applyChangeSet(input): ChangeSet;     // propose + confirm atomically
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
| `POST /api/rpc/:method` body `{"args": [...]}` | 200 `{"result": value}` (undefined -> null); `{"error": "plain message"}` with 404 unknown method or `Unknown job/step ...`, 400 bad body/args, 409 ChangeConflictError, 500 otherwise. Missing/empty body = no args. `:method` = `RPC_METHODS`: every DashboardApi read, `previewSetup`, `applySetup` (Setup area only) and `photoUrl`. NOT `undo` (`RPC_EXCLUDED`, 404): the web is read-only and undo/day-to-day changes come only through the bot. A compile-time check makes every DashboardApi method either listed or excluded |
| `GET /api/photos/:id/file` | the file under DATA_DIR/photos (type from extension); placeholder seed photos -> the same SVG as `placeholderPhotoUrl`; 404 `{"error"}` otherwise |
| `GET /api/health` | `{"ok": true, "today": "YYYY-MM-DD"}` |
| other `/api/*` | 404 `{"error"}` |
| any `/api/*` with a bad Host/Origin | 403 `{"error"}`. Host must be localhost, 127.0.0.1, [::1], `*.localhost` or in `ALLOWED_HOSTS` (DNS-rebinding guard); an `Origin` header, when present, must name one of those too |
| any other GET | packages/web/dist: the file if it exists (also with a leading base segment stripped, e.g. `/construction-tracker/assets/x.js`), else `index.html`; 404 text when dist isn't built (checked per request) |

Every request reloads the store, so writes by another process on the same SQLite file (WAL) show up at once.

```ts
buildServer({ store, clock, paths, webDist?, log?, allowedHosts? }): Promise<FastifyInstance>   // not listening; tests use .inject
startApp(config: ServerConfig, { log?, notifier?, clock?, scheduler? }): Promise<RunningApp>  // {store, clock, server, scheduler, firstTick, notifier, url, stop()}
loadConfig(env, cwd): ServerConfig; clockFromEnv(env); todayOverrideFromEnv(env); loadEnvFile(env, cwd)
applyOperation(store, clock, op, args, { message?, sender? }) -> {ok:true, changeSet, summary, impacts} | {ok:false, result, reason}
removeDatabaseFile(file)                                   // db + -wal + -shm
E2E_DEFAULT_PORT 4310, E2E_DEFAULT_TODAY '2026-09-17', e2eDataDir(port, os.tmpdir()) = <tmp>/ct-e2e-<port>
```

Scheduler (`scheduler.ts`): `startScheduler({ store, clock, notifier, log, reminderTime?, intervalMs? })` runs a tick now
(`firstTick`) and every minute; `createScheduler(...)` -> `{ tick(), start(), stop() }` (ticks never overlap or throw).
A tick: `ensureMondaySnapshots(store, clock)` (each live build job without a snapshot dated `lastMonday(today)` gets
`makeSnapshot(..., savedAt = now)`, id `snap-<job>-<monday>`; catches up a missed Monday) and, from `reminderTime` on,
`fireReminders`.

Reminders (`reminders.ts`):

```ts
computeReminders(ds, today): Reminder[]   // pure. Reminder = {key, kind 'act_by'|'amber', jobId, jobName, itemId, dueOn, text}
fireReminders(store: SqliteStore, clock, notifier): Promise<{ sent: Reminder[]; alreadySent: number; text: string | null }>
interface Notifier { send(n: { text: string; reminders: Reminder[] }): Promise<void> }   // Stage 3: Telegram
logNotifier(log), memoryNotifier() (.sent), reminderText(reminders, today), sentReminderKeys(store)
```

- act_by: Monday `actByDue` rows (to do, act-by <= today + 7) on live builds; key `actby:<item>:<actBy>:soon|due`
  (`due` once act-by <= today). Text: "Seaview St: Book concrete pump. Act by Fri 18 Sep (tomorrow)."
- amber: live jobs (build and design) with `freshness.amber`; key `amber:<job>:<lastConfirmed|never>`.
  Text: "Beatty St is amber: last confirmed 9 days ago. Check it and confirm the job."
- One message per run: "Reminders, Thu 17 Sep:" then "- <text>" lines (act-by first). Keys are claimed in
  `reminder_sent` (migration 002, not a Dataset table) before sending and released if `send` throws.

Core fix carried here: add_step asks "which step" for an ambiguous `after` entry with `field: 'afterChoice'`;
re-run with `{ ...question.args, afterChoice: id }`.

## Web (`packages/web`)

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
- Design rules live in `src/styles/tokens.css` (palette and type) and `app.css`; phone layout is the same DOM at <= 760px.

## Seed (`packages/core/src/seed`)

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
Transcriber / PhotoStore                                   // placeholder shapes, Stage 3 defines them properly
```

Env: `TELEGRAM_BOT_TOKEN` (unset -> "Telegram bot off" log; `@ct/server` depends on `@ct/bot`; e2e-server and server tests pass `bot: false`; startApp only then loads `@ct/bot`, by dynamic import),
`DOMINIC_TELEGRAM_USER_ID` (digits; unset -> off), and the LLM env (provider/key missing -> off with the reason).
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
  Non-text messages: "I can only read text messages for now." (Stage 3 adds voice/photo handlers before that one).
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
- Pending state and the card map are in memory (one chat). A restart loses pending questions, not cards' buttons.
- Change history quotes the right text: a change set's message is the message that started its thread (a pick or a
  short answer is a detail of it), a fresh request's own message, or the correction for an Edit.

Test harness (`packages/bot/test/harness.ts`, for Stage 3 too): `createHarness({ store, clock, parser, allowedUserId?,
pendingTtlMs?, transcriber?, photoStore? })` -> `{ handle, log (memory), calls (every API call), messages (bot messages by id, edits
applied, buttons), text(text, {from?, replyTo?, chat?}), press(messageId, buttonTextOrData, {from?}), update(rawUpdate),
sent(calls?), lastWithButton(text), last() }`. Built on a real grammY Bot with `botInfo` preset (`BOT_INFO`) and an API
transformer that records calls and returns fake results (sendMessage -> a message with a new id). `DOMINIC_ID`,
`STRANGER_ID`, `steppingClock(today)` (now() movable with `advance(ms)`). Integration tests (`test/flows.test.ts`): server SqliteStore on a temp file + `seedDatabase`, a second
SqliteStore on the same file behind `buildServer` (`inject` POST /api/rpc/getMonday), `createParser(new FakeLlm(...))`,
`fixedClock('2026-09-17', '10:00')`.
