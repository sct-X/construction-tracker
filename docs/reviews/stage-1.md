# Review: Stage 1

Reviewer: fresh, skeptical; had not seen the work. Commit reviewed: `70e6fbd`.
Date: 2026-10-07. Scope: server API over SQLite, scheduler, web shell, jobs list, Monday screen with
Why it moved, both data layers.

## Verdict

**FIX-FIRST.** The working tree is in good shape and every check passes there, but the commit itself
cannot be built: the web app's whole data layer (`packages/web/src/data/`) is git-ignored and was never
committed. A fresh checkout fails `npm test`, `npm run typecheck` and `npm run build`, so
`npx playwright test` cannot pass either. Once that folder is committed (finding 1), I found nothing
else that blocks sign-off.

## Command results

Working tree (`rm -rf packages/*/dist packages/web/dist-pages` first):

| command | result |
| --- | --- |
| `npm ci` | exit 0 |
| `npm test` | exit 0, 13 files, 146 tests |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 |
| `npx playwright test` (all projects, no flags) | exit 0, 23 passed (mock 11, api 11, api-change 1) |

Fresh `git clone` of `70e6fbd`:

| command | result |
| --- | --- |
| `npm ci` | exit 0 |
| `npm test` | **exit 1**: `src/screens/Monday.test.tsx` cannot import `../data/DataContext` |
| `npm run typecheck` | **exit 2**: `Cannot find module './data/DataContext'`, `'./data/layer'` (8 errors) |
| `npm run build` | **exit 1**: vite cannot resolve `./data/layer` |
| same clone after copying in `packages/web/src/data/` | test 146 passed, typecheck 0, build 0, `CI=1 npx playwright test` 23 passed |

Build order and the api project: the api project does **not** depend on an earlier `npm run build`.
Its webServer command runs `npm run build -w @ct/web && npm run e2e:server` itself, the mock webServer
runs `build:pages` itself, and the server runs from source through tsx. So `npm ci`, `npm test`,
`npm run build`, `npx playwright test` works in that order on a fresh machine, with one extra step:
the Playwright browsers have to be installed (`npx playwright install chromium`). There is no CI
workflow yet (`.github/` does not exist); SPEC's GitHub section puts that in Stage 5.

## Findings

### 1. MUST-FIX: the web data layer is git-ignored and missing from the commit
`.gitignore:4` is `data/`, an unanchored pattern, so it matches any folder named `data`, including
`packages/web/src/data/`. `git check-ignore -v packages/web/src/data/layer.ts` prints `.gitignore:4:data/`.
Six files are not in `70e6fbd`: `DataContext.tsx`, `layer.ts`, `http.ts`, `mock.ts`, `http.test.ts`,
`mock.test.ts`. This means both DashboardApi implementations, the context every screen uses, and their
tests. Fix: anchor the pattern (`/data/`; the server's default DATA_DIR is `./data` at the repo root),
then `git add packages/web/src/data`. Prove it by running the four commands on a fresh `git clone`, not
in the working tree. I checked the rest of `git status --ignored`: the only other ignored paths are
`test-results/` and `e2e/screenshots/`, which are meant to be ignored.

### 2. NICE-TO-HAVE: the focus ring is below 3:1 against the page
`packages/web/src/styles/app.css:33-36`: a 3px `--hivis` (#f26a1b) outline measures 2.71:1 on concrete
#f1f1ee, 2.93:1 on formply and 2.40:1 on the rail (#e3e4e0). WCAG 1.4.11 asks for 3:1. At 3px it is
easy to see (screenshot `e2e/screenshots/review-focus-nav-1280.png`), so this does not block. A steel
inner ring with an orange outer ring (`outline: 2px solid var(--steel); box-shadow: 0 0 0 5px var(--hivis)`)
would pass and keep the accent. Orange is never used as text colour anywhere (grep: only the outline,
the nav underline and the `+N days` background). Steel on orange is 4.89:1 and steel on amber is 8.93:1,
so both pass AA.

### 3. NICE-TO-HAVE: phone cards hide their labels from screen readers
`packages/web/src/components/bits.tsx:28` marks `CellLabel` `aria-hidden`, and
`packages/web/src/styles/app.css:549-564` sets every table element to `display: block` at 760px and
below. WebKit (Safari on iPhone) drops table semantics when display changes, so on Dominic's phone
VoiceOver reads "Fri 4 Dec 2026 … +5 days" with no column headers and no labels. Either keep the labels
readable (remove `aria-hidden`, hide the thead from AT on phone instead), or add explicit
`role="table|row|cell|columnheader"` to the elements.

### 4. NICE-TO-HAVE: repeated h3s with no job name
`packages/web/src/screens/Monday.tsx:177` and `:275`: every slipping job gets an h3 "Why it moved", and
every job with act-by items gets "Act on by Thu 24 Sep" (twice on the seed). In a headings list these
cannot be told apart. Add the job name, visually hidden if needed ("Why Beatty St moved").

### 5. NICE-TO-HAVE: the "Act on by" heading wording
`packages/web/src/screens/Monday.tsx:275` reads "Act on by Thu 24 Sep", which is awkward English. The rows
already say "Act by Fri 18 Sep, tomorrow". Something like "To do by Thu 24 Sep" or "Act this week" would
read better.

### 6. NICE-TO-HAVE: "$0" is drawn at the largest type size
`packages/web/src/screens/Monday.tsx:134`: on-track jobs show "$0" at 36px, the same weight as Beatty's
$1,430, so the eye lands on nothing. When `slipDays === 0`, show the cost in the muted sub style (or
"Nothing"), and keep the big number for a real cost.

### 7. NICE-TO-HAVE: design rows repeat their group's stage
`packages/web/src/screens/Monday.tsx:332-335`: under the "With council" group heading each row repeats
"With council, DA". Show only the path (DA/CDC) under the name.

### 8. NICE-TO-HAVE: desktop layout defects in the build rows (`review-monday-1280.png`)
- `app.css:322` limits the Why it moved panel to 860px while the table is about 984px wide, so the
  panel's right edge stops short of the row rules above and below it. Pick one: make it full width,
  or line it up with a column edge.
- `app.css:410`: the act-by grid gives the title column a lot of empty space while the "who" column
  wraps ("Raff, waiting on Northern Concrete / Pumping"). Give the who column more of the width.
- On the phone (`review-monday-390.png`) the layout is clean and there is no horizontal scroll at 390
  (scrollWidth 390 on both screens). The fixed bottom tab bar shows up mid-page in full-page captures,
  which is only an artifact of how the screenshot is taken.

### 9. NICE-TO-HAVE: the jobs list is thin
`packages/web/src/screens/Jobs.tsx:76-79`: design jobs fill the Forecast finish column with "No program
while in design", and on the phone each design card spends a label plus a line on it. `JobListRow`
already carries `slipDays`, but the list doesn't show it. Suggestions: drop the finish cell for design
rows on the phone, and add a slip column (in words) for builds. Builds and design are shown one after
the other with no break between them; a group heading would help.

### 10. NICE-TO-HAVE: owner "Dom" vs "Dominic" in the seed shows on Monday
`packages/core/src/seed/parkRd.ts:80` (and `design.ts:61`) use owner/waitingOn "Dom", while every other
item uses "Dominic". The Monday act-by list shows "Tile choice … Dom" next to "Dominic, waiting on Jade
Coast Windows". Use one name.

### 11. NICE-TO-HAVE: the RPC whitelist exposes `undo`
`packages/server/src/http.ts:22-44` whitelists every DashboardApi method, including `undo` and
`applySetup`. The web stays read-only (I grepped: no screen calls either; the only controls are the side
switcher, the error Retry button and the mock-only dev bar), and Setup needs `applySetup` in Stage 5.
But SPEC puts undo on the bot only. The server binds 127.0.0.1 and does no Host header check
(`http.ts:135`), so a DNS-rebinding page in Dominic's browser could POST `undo`. Low risk on a home
mini PC. A cheap hardening: refuse requests whose `Host` is not localhost or 127.0.0.1, and decide
whether `undo` belongs on HTTP at all.

### 12. NICE-TO-HAVE: api-change is not retry-safe and not Windows-safe
- `playwright.config.ts:43` sets `retries: 1` on CI. `e2e/api-change.spec.ts:20` asserts Park Rd is
  "On track" before it applies the change, so a retry after a late failure fails on that first
  assertion, because the change has already been applied and the server is not reseeded. Undo or reseed
  first, or skip the precondition when the ETA is already 16 Nov.
- `e2e/api-change.spec.ts:22`: `execFileSync('npm', …)` throws ENOENT on Windows (npm is `npm.cmd`, and
  Node 20+ refuses to spawn a .cmd without `shell: true`). SPEC wants the setup to run on a Windows
  mini PC too. Spawn `process.execPath` with tsx, or pass `shell: process.platform === 'win32'`.
- `e2e/api-change.spec.ts:16` hard-codes `ct-e2e-4310` and ignores `E2E_PORT`.
- The api-change run passes no `--message`, so in API mode nothing checks the source-message quote. The
  mock Beatty test covers it, and Stage 2's bot flow will replace this test anyway.

### 13. NICE-TO-HAVE: leftover "pending" scaffolding
`playwright.config.ts:18` (`apiServerReady`) and `e2e/helpers.ts:4-7` (`skipIfPending`) skip the api
project when `e2e:server` is missing. That script now exists, so this code can never run. Remove it so a
broken api project fails loudly instead of being skipped.

### 14. NICE-TO-HAVE: `.env.example` tidy-up
`.env.example:25-28` has two comments saying the same thing about `CT_TODAY`. `HOST`, `REMINDER_TIME` and
`WEB_DIST` (documented in CONTRACTS "Env") are missing from it.

### 15. NICE-TO-HAVE: Monday fetches the whole change history
`packages/web/src/screens/Monday.tsx:40` calls `getChangeHistory({statuses:['confirmed']})` with no
limit on every Monday load, just to look up the before/after values for a few causes. That is fine at
today's size, but it grows forever. Better: have `whyItMoved` return each cause's field changes, or
filter the history by change-set ids.

### 16. NICE-TO-HAVE: no test of the live entry point's defaults
No test calls `loadConfig({})` or `startApp` to check HOST 127.0.0.1, port 8787, and that the scheduler
starts. I checked by hand: `npm start` with a temp DATA_DIR listened on `127.0.0.1` only (lsof), seeded,
ran in WAL mode (`pragma journal_mode` = wal), saved Mon 5 Oct snapshots on its first tick (catch-up),
and logged one reminders message. A text/plain POST was refused with 400.

## Checklist results (passes)

- **Read-only web**: screens use only `useSideQuery`/`useData` from `DataContext`. Neither
  implementation is imported outside `data/layer.ts`, which dynamic-imports one of them by build-time
  `VITE_DATA`. The same `MondayScreen`/`JobsScreen` run in both modes, and both Playwright projects
  check it. The dev bar is mock only and holds just the "Today is" date and Reset.
- **Monday vs SPEC**: shows the finish (long form), slip as "+5 days" / "On track" with "Later than
  Mon 14 Sep" under it, slip cost from core `slipCost` (nearest $10: $1,430, $9,000), amber as "Not
  confirmed for 9 days" on an amber pill (words, not colour alone), act-by due list, and design jobs
  grouped by stage with outstanding count and oldest age (23/8/4 days, Lower Beach St "Nothing"). Why
  it moved shows each cause with field before → after ("Book tiler, expected date Mon 28 Sep → Mon 5
  Oct"), finish before → after, holding cost, the quoted source message with channel and time, and the
  plain leftover line ("2 days earlier for reasons not in the change log"). Numbers are the largest
  type: `.num` 36px desktop and 38px phone, against h1 24px and job names 18px.
- **Server**: `POST /api/rpc/:method` `{args}` → `{result}` / `{error}` with 404/400/409/500 as in
  CONTRACTS. Compile-time whitelist check. Binds 127.0.0.1 by default. WAL, foreign keys and
  busy_timeout are set. Every RPC reloads the store, and a test covers apply-op from another process.
  `CT_TODAY` sets the clock, with `TZ_TODAY_OVERRIDE` as a fallback. The scheduler is a
  `setInterval` in the process (no cron) and never overlaps or throws. Monday snapshot catch-up runs on
  every tick, upserted on (job, date). Reminders are deduped with INSERT OR IGNORE claims and released
  if the send fails. Paths go through `node:path`; stored photo paths use `/`; there is no
  macOS-only code. `npm start` is one process, and `app.ts:59-65` marks the bot hook.
- **Design**: concrete/formply/steel palette with timber only behind quoted messages, and hi-vis
  orange as the one accent. Amber appears only with words. No gradients (0 computed), no
  `text-transform: uppercase` (0), no images. Barlow and Barlow Condensed are self-hosted. Desktop
  shows tables and the phone shows cards from the same DOM. No horizontal scroll at 390.
- **Accessibility**: one `header` (rail), one `nav aria-label="Main"`, one `main`, and the dev bar is
  a labelled region. Headings go h1 → h2 → h3. `lang="en-AU"`. Loading uses `role=status` and errors
  `role=alert`. `aria-current="page"` on the nav is shown by weight and an underline, not by colour
  alone. Every focusable element shows the orange outline (Tab order checked: date input, Reset,
  brand, side select, Monday, Jobs). No skip link, which is minor with three rail items.

Screenshots taken for this review (git-ignored): `e2e/screenshots/review-monday-390.png`,
`review-monday-390-fold.png`, `review-monday-1280.png`, `review-jobs-390.png`, `review-jobs-1280.png`,
`review-focus-nav-1280.png`.

## Re-check (2026-10-07, after d04da69 and dd73c7e)

**Verdict: SIGN-OFF.** No MUST-FIX remains.

Fresh `git clone` of `dd73c7e` into a temp dir (nothing copied in):

| command | result |
| --- | --- |
| `npm ci` | exit 0 |
| `npm test` | exit 0, 14 files, 152 tests |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 |
| `npx playwright test` (all projects, no flags) | exit 0, 23 passed (mock, api, api-change) |
| `git status --ignored` in the clone | only build output, `test-results/`, `e2e/screenshots/` |

Findings re-checked:

- 1 (gitignore): fixed. `packages/web/src/data/` is committed, and the fresh clone builds and passes.
- 2 (focus ring): fixed. A 2px steel outline (about 14:1 on concrete) with a 3px hi-vis ring outside it.
- 3 (phone labels): fixed. `CellLabel` is no longer `aria-hidden`.
- 4 (headings): fixed. "Why it moved for Beatty St" and "Act by this week for Park Rd" now include
  the job name, visually hidden. One small slip: the heading's accessible name reads "for Park Rdto
  Thu 24 Sep", because JSX drops the newline between the sr-only span and `.h-note`
  (`packages/web/src/screens/Monday.tsx:286-287`). Add `{' '}`. NICE-TO-HAVE.
- 5 (wording): fixed. The heading is "Act by this week", with "to Thu 24 Sep" as a note beside it.
- 6 ($0): fixed. On-track jobs now read "Nothing this week" in muted text; the big type is kept for a
  real cost.
- 7 (design stage repeat): fixed. Rows show "DA, council" / "CDC, certifier". NICE-TO-HAVE: "DA,
  council" under John St, which is still in Design, could be read as "with council". Showing just
  "DA" / "CDC" would be clearer.
- 8 (desktop layout): fixed. The Why it moved panel spans the table width, and the act-by "who"
  column no longer wraps.
- 9 (jobs list): fixed. There are Builds and Design group headings, and a slip column for builds:
  "On track", or a hi-vis square plus "5 days later" in words. Design phone cards drop the empty
  finish cell.
- 10 (Dom vs Dominic): still open, NICE-TO-HAVE. It is seed data (Stage 0) and still shows on Monday.
- 11 (undo on HTTP): fixed. `undo` is deliberately excluded (`RPC_EXCLUDED`, still checked at compile
  time), and an `onRequest` hook refuses `/api` requests whose Host or Origin is not loopback or in
  ALLOWED_HOSTS (403). The api-mode e2e still passes, so the browser's same-origin calls get through.
- 12 (api-change): fixed. The test is retry-safe (it reads the ETA first and applies the change only
  if needed), runs tsx through `process.execPath` rather than npm, honours `E2E_PORT`, and asserts
  the field before/after.
- 13 (pending scaffolding): removed.
- 14 (.env.example): HOST, REMINDER_TIME, WEB_DIST and ALLOWED_HOSTS added.
- 15 (full history fetch): not changed, NICE-TO-HAVE.
- 16 (entry point test): `packages/server/test/app.test.ts` added.

New screenshots of the clone's Pages build in mock mode: `e2e/screenshots/review-{monday,jobs}-{390,1280}.png`.
No horizontal scroll at 390 (scrollWidth 390). No gradients and no uppercase text (0 of each
computed). Numbers stay the largest type (36px desktop and 38px phone, against h1 24px). Hi-vis is
still the one accent. Amber and slip always come with words.
