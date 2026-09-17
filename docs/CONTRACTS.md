# Contracts for screen subagents

Stage 0 fixed these. Build on them; do not edit `src/domain/*`, `src/data/api.ts`, `src/seed/*` or `src/styles/tokens.css` unless your task says so. Report the need instead.

## Getting data

```tsx
import { useApi, useQuery, useSession } from '../data/context';

const api = useApi();                                   // TrackerApi (src/data/api.ts)
const { person, role, side, sides, today, offline, setSession } = useSession();
const jobs = useQuery((api) => api.listJobs(), []);     // re-runs after every api change
const forecast = useQuery((api) => api.getForecast(jobId), [jobId]);
```

- Reads are synchronous and return copies. Never mutate a returned object; call a mutation.
- `useQuery(fn, deps)` re-runs when `deps` change or when the api notifies (`api.subscribe`). No loading state is needed for the mock; still render the shared empty states from UI_PLAN.
- Every read is already scoped to the session's side and role. `listJobs()` hides templates and, for Alec, design jobs; `listItems()` for Alec returns material items only (his deliveries). `getMondayRows()` is empty for the site role. `canSee(screenKey)` tells navigation what to show (`SCREEN_ACCESS` in api.ts, keys in `src/screens/README.md`).
- Mutations return the new record, log an activity entry as the current person, and notify. `setStepStatus(stepId, 'done')` on a hold point returns `{ ok: false, missingCategories, message }` when required photo categories are empty; show `message` as is.
- Photo queue: `queuePhoto(input)`, `listQueuedPhotos()`, `removeQueuedPhoto(id)`, `flushPhotoQueue()` are async (IndexedDB). The provider flushes automatically when `offline` turns false; the shell's `<QueueBadge>` flushes on the browser's `online` event and retries failed sends. Only uploaded photos (`addPhoto` / a successful flush) count for hold points. See "Photos and the queue (Stage 3)".
- Offline rule: with `offline` true, date changes (expected date, ETA, durations, links) must be disabled in the UI with "Needs signal". Status ticks, notes and photos queue. The mock does not enforce this; the screen does.

## Session

`Session = { personId, sideId, today, offline }` in `src/data/session.ts`, persisted in localStorage. URL params override it on load and on every hash change: `#/monday?as=alec&today=2026-09-17&offline=1&side=side-nd`. Playwright specs use those. The dev bar (`src/dev/DevBar.tsx`) has `data-testid`s `dev-person`, `dev-side`, `dev-today`, `dev-offline`, `dev-reset`, `dev-fire-reminders`. Reset reseeds the data, clears the photo queue, and returns today to 2026-09-17 and offline to false; the person stays.

People: `dominic` (admin), `dom`, `norm` (partners), `raff` (builder), `alec` (site). Sides: `side-nd` "Norm and Dom", `side-norm` "Norm" (empty). Jobs: `park-rd`, `seaview`, `beatty`, `west-st`, `tollbar`, `lower-beach`, `john-st`; template `tpl-duplex`. Windows shipment `sh-park-windows`.

## Forecast result (`JobForecast`, src/domain/forecast.ts)

- `forecastFinish`, `plannedFinish`, `lateDays` (forecast vs planned), `isLate`.
- `snapshotDate`, `snapshotFinish`, `slipDays`, `slipCost` (vs last Monday; both undefined before the first snapshot, show a dash and "Slip appears after the first Monday"). `slipSincePlanDays`, `slipSincePlanCost` for the Monday toggle.
- `freshness: { lastConfirmed, daysUnconfirmed, amber, text }`. Amber after 7 days. Show `text`.
- `currentStageId/Name`, `stages[]` (bands with planned and forecast start/end, `lateDays`, derived `status`), `steps{}` by id (`forecastStart/End`, `plannedStart/End`, `lateDays`, `driver`, `reason` sentence, `waitsFor`, `holdsUp`, `itemIds`), `items{}` by id (`neededBy`, `actBy`, `expected`, `expectedFromShipmentId`, `lateDays`, `isLate`, `lateText` like "14 days late", `actByPassed`, `daysSitting`).
- `holdPoints[]` and `nextHoldPoint` (`required[]` with `uploadedCount`, `missingCategories`, `ok`).
- `whyItMoved[]` (against last Monday when the snapshot holds step dates, else against plan) and `whyItMovedSincePlan[]`: entries `{ kind: 'cause'|'step'|'stage'|'finish', baseline: 'plan'|'snapshot', text, deltaDays, from, to, refId }`. Render `text` in order. Finish lines name their baseline ("7 days later than planned (27 Nov)", "5 days later than Monday's snapshot (29 Nov)"); when a snapshot has no step dates the chain runs against the plan and ends with both finish lines.
- Design jobs: `checklist` with `stages`, `currentStageName`, `outstanding`, `oldestDays`, `outstandingItems[]`; no finish, no steps.
- `api.previewEtaChange(shipmentId, newEta)` returns `{ linkedItemIds, movedSteps[], finishBefore, finishAfter, deltaDays, slipDaysAfter, slipCostAfter, costDelta }` for the impact panel.
- `api.getMondayRows()` returns `MondayRow[]` sorted builds by slip cost then design by oldest item, with `waitingOn` (top three) per build job.

## Shell and shared components (Stage 1)

- Routes: one registry, `src/shell/routes.tsx` (`path`, `screen` key for `canSee`, `title`, `stage`, `element`). To add a screen, swap its Placeholder element there; App.tsx maps the list to `<Route>`s inside `<Guard>`. Keep each entry on one line starting with its path: `e2e/no-money-for-site.spec.ts` reads the paths out of that file and visits every one as Alec.
- `useLayout()` from `src/shell/AppShell` returns `'phone' | 'desktop'` (`'phone'` below 768px and always for the site role). Switch cards and tables on it so every test id exists once.
- `<PageHeader title meta actions back />` (`src/shell/PageHeader.tsx`) opens every screen; wrap the screen in `<main className="page">`. Shared classes in `src/shell/shell.css`: `.page`, `.page__lede`, `.btn`, `.btn--primary` (hi-vis, dark ink), `.btn--desktop`.
- `<StatusText tone="late|amber|ok|muted|plain" testId="...">words</StatusText>` (`src/components/StatusText.tsx`) draws status words on a wash; late and amber get a leading "!". Always words, never a bare colour.
- Shared components take a `testId` prop (never `data-testid`): `Money`, `BigNumber`, `SlipText`, `StatusText`.
- Freshness (rule 7) comes only from the calculator: `getForecast(jobId).freshness` (`amber`, `daysUnconfirmed`, `text`). Screens may reword it ("Unconfirmed 9 days") but never recompute it.
- Nav test ids: `nav-<name>` (`nav-monday`, `nav-waiting`, `nav-calls`, `nav-jobs`, `nav-today`, `nav-upload`, `nav-shipments`, `nav-activity`, `nav-templates`, `nav-trades`, `nav-people`, `nav-notifications`, `nav-settings`, `nav-job-<id>`); `primary-nav`, `setup-nav`, `side-switcher` / `side-name`, `offline-bar`, `unread-count`.

## Program and Gantt (Stage 2)

- `<Gantt forecast steps today view? dense? onSelectStep? renderBar? />` (`src/components/gantt/Gantt.tsx`) draws the desktop program from `getForecast(jobId)` plus `listSteps(jobId)`. Read-only by default: every bar is a link to `#/steps/:id`. `view` is `'all' | 'lookahead' | 'late'`.
- Stage 6 (program editor) reuses it rather than forking: `onSelectStep(stepId)` turns each bar into a button that calls back instead of navigating; `renderBar(step, geometry, defaultBar)` replaces what is drawn in a step's track (return your own handles or wrap `defaultBar`). `geometry` is `{ x, width, plannedX?, plannedWidth?, isHoldPoint, pxPerDay, rowHeight }` in px from the track's left edge; the planned outline stays behind whatever you draw and the late text after it. The axis (`timeScale.ts`, `makeTimeScale({ dates, today })`) is calendar days at 5px a day; `scale.x(iso)` and `scale.span(start, end)` convert dates.
- Phone pieces: `<StagesStrip forecast />` (chips, current stage `aria-current`), `<LookAhead forecast steps items today />` (three weeks plus Later), `<StagesList forecast today />` (bands). Test ids: `gantt`, `gantt-bar-<stepId>`, `gantt-planned-<stepId>` (`data-moved`), `gantt-late-<stepId>`, `gantt-row-<stepId>`, `gantt-stage-<stageId>`, `gantt-today`, `gantt-caption`, `gantt-empty`, `program-view-<all|lookahead|late>`, `program-edit`, `program-full-link`, `lookahead`, `lookahead-week-<1..3>`, `lookahead-step-<stepId>`, `stages-strip`, `stage-chip-<stageId>`, `stage-band-<stageId>`.

## Money

Fields in `MONEY_FIELDS` (`src/domain/money.ts`): `weeklyHoldingCost`, `slipCost`, `slipSincePlanCost`, `costDelta`, `slipCostAfter`. The data layer deletes them for the site role. Render money through one `<Money value={x} label="..."/>` component that returns `null` when `value === undefined`, label included. Never hide money with CSS, never default it to 0. Format with `formatMoney()` ("$9,000"). Activity and notification text never contains money.

## Dates

All dates are `YYYY-MM-DD` strings. Helpers in `src/domain/dates.ts`: `formatLong` "Fri 26 Feb 2027", `formatShort` "Mon 2 Nov", `formatDayMonth` "2 Nov", `formatDayMonthYear2` "12 Mar 27", `formatWeekRange(monday)` "14-18 Sep", `relativeDays(from, today)` "9 days ago", `formatDelta(14)` "+14 days", `formatStamp` "Tue 3:10pm", `lastMonday`, `addCalendarWeeks`, `addWorkingDays`, `isWorkingDay`, `calendarDaysBetween`. Use the session's `today`, never `new Date()`, for anything the user sees.

## Test ids

`data-testid` on every primary control and every row, kebab-case, `<screen>-<thing>[-<id>]`: `monday-row-park-rd`, `monday-slip-park-rd`, `item-status-advance`, `upload-category-pc-lockup-windows`, `step-mark-done`, `shipment-eta-input`, `shipment-save-eta`, `shipment-eta-preview`, `shipment-add`. Every id starts with its screen's name, including the shared component's ids inside it (`<EtaImpact>` renders `shipment-eta-preview-finish`, `shipment-eta-preview-slip`). Shipments: `addShipment`, `linkItemToShipment(itemId, shipmentId | null)` and `setShipmentEta` already exist on the API and log activity; the Stage 2 screens use them unchanged. Flow specs in `e2e/` find things by these ids and by visible text; give both.

## Tokens and styling

One token set in `src/styles/tokens.css`, read the plan at the top. Use the variables, never raw hex. Semantic colour always comes with words (`--late-ink` on `--late-bg` plus "14 days late"). Hero figures use `.display` (condensed, tabular). Tap targets `min-height: var(--tap)` (56px) on every phone control; category pickers are buttons. Phone below 768px: `@media (min-width: 768px)` switches cards to tables. One CSS file per screen, class names `screen__part`. Hairlines over shadows; shadow only for sheets and menus. No gradients, no all-caps labels, no icons library, no stock imagery.

## Photos and the queue (Stage 3)

- `src/data/photoQueue.ts`: `sharedPhotoQueue()` is the browser's one queue (the api sends through it; `createPhotoQueue()` returns it when IndexedDB exists, a fresh memory queue otherwise). `PhotoQueue`: `enqueue(entry)`, `list()`, `get(id)`, `update(id, patch)`, `remove(id)`, `clear()`, `subscribe(listener) => unsubscribe` (fires after every change), `flush(upload, canSend)` (one at a time, oldest first, single-flight, re-reads each entry before sending so a Remove mid-flush wins; a failure marks the entry `failed` with `attempts + 1` and the loop stops only when `canSend()` is false). `QueuedPhoto`: `id`, `sideId`, `jobId`, `stageId`, `categoryId`, `dataUrl` (what the mock uploads, downscaled to 800px on the phone), `thumbDataUrl` (160px, for lists), `blob` (the original File, for the real server), `takenOn`, `uploadedById`, `queuedAt`, `state: 'queued' | 'sending' | 'failed'`, `error`, `attempts`. `sortQueued(list)` orders oldest first.
- `src/components/QueueBadge.tsx`: `useQueuedPhotos(jobId?)` is the ONE hook for reading the queue on any screen (gallery, Today, upload, queue, badge); it refreshes on queue and api changes. `noSignal(offline)` = the session flag or `navigator.onLine === false`. `<ClockGlyph />` is the queued mark, always beside words. `<QueueBadge />` (mounted by the shell after `<OfflineBar />`, `queue-badge`, hidden at zero and on `/queue`) also owns the automatic sends: flush on `online`, retry after a failure with 5s x attempts (max 60s) up to `MAX_AUTO_ATTEMPTS` (5); the queue screen's Retry resets `attempts` and re-arms it.
- `<CategoryPicker categories counts queued? value onChange neededWords? testPrefix? label? />` (`src/components/CategoryPicker.tsx`): tall radio buttons, chosen one filled steel, count in the display face, "none yet", "N waiting to send"; `neededWords(category)` supplies the words for a required category. Test ids `<testPrefix>-<categoryId>`, default `upload-category-<id>`.
- `<HoldPointCheck check refusal? queuedCount? uploadHref? compact? canComplete? testId? />`: `canComplete` (default: the session role is not `site`) chooses the queued sentence, "You can tick this off once they've sent." or "They count once they've sent." Test ids `holdpoint-readiness`, `holdpoint-category-<id>`, `holdpoint-refusal`, `holdpoint-queued`, `holdpoint-add-photos`.
- Screens and test ids: upload `#/jobs/:id/upload?stage=&category=` (`photo-upload`, `upload-stage-<id>`, `upload-category-<id>`, `upload-file-input`, `upload-camera-input` (phone only), `upload-choose`, `upload-take`, `upload-preview-<n>`, `upload-remove-<n>`, `upload-submit`, `upload-progress`, `upload-offline-note`, `upload-failed`, `upload-done`, `upload-finish`, `upload-more`, `upload-no-categories`, `upload-problem`); queue `#/queue` (`upload-queue`, `queue-send-now`, `queue-offline-note`, `queue-group-<jobId>-<categoryId>`, `queue-item-<id>` with `data-state`, `queue-retry-<id>`, `queue-remove-<id>`, `queue-empty`).
- Service worker (`public/sw.js`): cache lookups pass `{ ignoreVary: true }` because `vite preview` (and some hosts) answer with `Vary: Origin` and a `<script crossorigin>` request would otherwise miss its precached response. `e2e/offline-shell.spec.ts` loads once, cuts the connection with `context.setOffline(true)`, reloads and expects the app.
