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
- Photo queue: `queuePhoto(input)`, `listQueuedPhotos()`, `removeQueuedPhoto(id)`, `flushPhotoQueue()` are async (IndexedDB). The provider flushes automatically when `offline` turns false. Only uploaded photos (`addPhoto` / a successful flush) count for hold points.
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

## Money

Fields in `MONEY_FIELDS` (`src/domain/money.ts`): `weeklyHoldingCost`, `slipCost`, `slipSincePlanCost`, `costDelta`, `slipCostAfter`. The data layer deletes them for the site role. Render money through one `<Money value={x} label="..."/>` component that returns `null` when `value === undefined`, label included. Never hide money with CSS, never default it to 0. Format with `formatMoney()` ("$9,000"). Activity and notification text never contains money.

## Dates

All dates are `YYYY-MM-DD` strings. Helpers in `src/domain/dates.ts`: `formatLong` "Fri 26 Feb 2027", `formatShort` "Mon 2 Nov", `formatDayMonth` "2 Nov", `formatDayMonthYear2` "12 Mar 27", `formatWeekRange(monday)` "14-18 Sep", `relativeDays(from, today)` "9 days ago", `formatDelta(14)` "+14 days", `formatStamp` "Tue 3:10pm", `lastMonday`, `addCalendarWeeks`, `addWorkingDays`, `isWorkingDay`, `calendarDaysBetween`. Use the session's `today`, never `new Date()`, for anything the user sees.

## Test ids

`data-testid` on every primary control and every row, kebab-case, `<screen>-<thing>[-<id>]`: `monday-row-park-rd`, `monday-slip-park-rd`, `item-status-advance`, `upload-category-pc-lockup-windows`, `step-mark-done`, `shipment-eta-input`, `shipment-save-eta`. Flow specs in `e2e/` find things by these ids and by visible text; give both.

## Tokens and styling

One token set in `src/styles/tokens.css`, read the plan at the top. Use the variables, never raw hex. Semantic colour always comes with words (`--late-ink` on `--late-bg` plus "14 days late"). Hero figures use `.display` (condensed, tabular). Tap targets `min-height: var(--tap)` (56px) on every phone control; category pickers are buttons. Phone below 768px: `@media (min-width: 768px)` switches cards to tables. One CSS file per screen, class names `screen__part`. Hairlines over shadows; shadow only for sheets and menus. No gradients, no all-caps labels, no icons library, no stock imagery.
