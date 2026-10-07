# Review: Stage 4

Reviewer: fresh, skeptical; had not seen the work. Commit reviewed: `0dcc9a9`.
Date: 2026-10-07. Scope: build job overview; program (desktop Gantt with planned outlines, phone
look-ahead and stages strip); step detail; shipments; waiting on; to chase with tap-to-call; photos by
job and category; daily notes; design checklist; change history.

## Verdict

**FIX-FIRST.** The screens are complete, read-only, and correct against the seed in both data layers.
The design holds together. One real bug blocks sign-off: switching side from a job page is undone. That
bug is also why the "side switcher away from a job" test is flaky. Two smaller must-fixes are rule
breaks: a tel: link that does not say who it calls, and overdue rows on the overview that rely on colour
alone.

## Command results

Fresh `git clone` of `0dcc9a9` into a scratch dir. No API keys and no bot token in the environment.
Ports 4310 and 4320 were free, so no server was reused.

| command | result |
| --- | --- |
| `npm ci` | exit 0 |
| `npm test` | exit 0, 25 files, 296 tests |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0. Warning: `dist-pages` main chunk 507.91 kB (> 500 kB) |
| `npx playwright test` (run 1) | exit 0, 73 passed |
| `npx playwright test` (run 2) | exit 0, 73 passed |
| `... -g "side switcher away" --repeat-each=40 --workers=8 --project=mock --project=api` | **6 failed / 80**, all `[api]` |

Flaky test: `e2e/stage4a-screens.spec.ts:118` "side switcher away from a job goes back to the jobs list".
Under load in api mode the URL stays at `#/jobs/park-rd`. Cause: see item 1. It is a race in the app,
not only in the test.

My own checks (scratch specs, not committed). Every in-scope screen at 390x844 and 1280x800, in mock and
api, rendered its ready test id with no sideways page scroll: 17 views x 2 sizes x 2 modes, 68 of 68
passed. Screenshots are in `e2e/screenshots/review4-*.png` (viewport) and `review4-*-full.png` (full
page). I looked at all of them.

## What I checked and found right

- **Reachable from the nav.** Main links: Monday, Jobs, Waiting on, To chase, Shipments, Changes. On a
  phone, Shipments and Changes sit under "More". Build job tabs: Overview, Program, Waiting on, Photos,
  Notes. Design job tabs: Checklist, Waiting on. `#/jobs/<design>` redirects to the checklist. Step detail
  is reached from the Gantt, the look-ahead, the strip and the overview's hold point. History per job is
  at `#/history/:jobId`, reached through the job picker.
- **Read-only.** The only buttons and inputs are view toggles (Gantt / Next 3 weeks / Stages, the Gantt
  filters), owner chips, job pickers, the photo lightbox, Retry, "More" and the dev bar. None of them
  calls `applySetup`, `previewSetup` or `undo` (grep of `packages/web/src`).
- **Seed content, mock and api.**
  - Park Rd Install windows: planned and forecast Mon 2 Nov to Fri 13 Nov. "Starts 2 Nov as planned." Windows expected Mon 26 Oct from the shipment.
  - To chase, Seaview: "Book concrete pump", act-by Fri 18 Sep, "Call Northern Concrete Pumping 0491 570 157" (`tel:0491570157`).
  - Seaview photos: Slab "1 of 3", still needed Plumbing under slab and Membrane and termite barrier.
  - Shipments: Park Rd windows (Mon 26 Oct, in production, 3 linked items) and Seaview St windows (Mon 14 Dec, design), on two jobs.
  - History: 7 change sets, each with its quoted message or voice transcript and field before -> after. Beatty tiler +7 days, Fri 27 Nov -> Fri 4 Dec, $2,000.
  - West St checklist: 2 items, oldest 23 days, With council is the current stage.
- **Design.**
  - One token file. Concrete, formply, steel and timber palette, with hi-vis as the only accent. Barlow with Barlow Condensed for numbers.
  - No all-caps text anywhere (computed `text-transform` scan). The only gradients are the shutdown hatching and the scroll shadows.
  - Desktop tables and phone cards come from the same DOM.
  - At 1280 the Gantt is legible: planned outlines, "7 days late" written beside the bar, hold-point diamonds with "Hold point" tags, the shutdown hatched and labelled, and a key in words (`review4-program-beatty-1280-full.png`, `review4-program-park-whole-1280-full.png`).
- **Accessibility.**
  - Each screen has one h1, with h2/h3 below it in order. Landmarks: header, nav "Main", main, and a nav "<Job> pages" per job.
  - The focus ring is visible (`review4-focus-gantt-1280.png`, `review4-focus-call-1280.png`).
  - The Gantt's text alternative is per-step text: ", Not started, forecast Mon 2 Nov to Fri 13 Nov", plus "N days late, planned ..." when late, inside a group per stage.
  - The CallLink name says who: "Call Smooth Wall Plastering 0491 573 770".

## Findings

1. **MUST-FIX. Switching side from a job page is undone.** `packages/web/src/components/JobBar.tsx:19-25`.
   - Repro (mock): open `#/jobs/park-rd`, wait for the job bar, pick "Norm" in the side switcher. The app goes to `#/jobs`, but the switcher flips back to "Norm and Dom". My probe failed 10 out of 10 runs in mock and passed in api once the job bar had rendered.
   - Cause: the effect tells "deep link to another side's job" apart from "Dominic just switched" using `lastSide`. After the first branch runs `location.replace('#/jobs')` and sets `lastSide = Norm`, `useSideQuery(loadAllJobs)` resolves. It is a microtask, so it lands before the hashchange task. The new `job` object re-runs the effect, the deep-link branch now matches, and it calls `setSideId(job.sideId)`.
   - The api flake is the same race the other way round. The test picks Norm while `allJobs` is still loading (`job === null`), so `lastSide` becomes Norm. When the job arrives, it is treated as a deep link: the side goes back and the URL never changes.
   - Fix: decide "deep link" once, on the first load of that job (a ref keyed by jobId). Or have the side switcher itself navigate to `#/jobs` when the current route is a job route, and drop the redirect branch from the effect.
2. **MUST-FIX. Make the side-switch test deterministic and make it check the outcome.**
   `e2e/stage4a-screens.spec.ts:118-124`. Wait for `job-bar` before switching, then assert the side switcher
   still reads "Norm" after the URL is `#/jobs`. As written, the test passes while bug 1 happens in mock.
3. **MUST-FIX. A tel: link on step detail does not say who it calls.**
   - `packages/web/src/screens/StepDetail.tsx:195-199` renders `<a href="tel:...">0491 575 789</a>`. Its accessible name is only the number (`review4-step-windows-1280-full.png`, "Book window installers"; also `review4-step-slab-390-full.png`).
   - Use `CallLink` from `components/listBits.tsx`, as Waiting on and To chase do, so the link reads "Call ClearView Window Installs 0491 575 789".
4. **MUST-FIX. On the overview, colour alone says a row is overdue.**
   - In `packages/web/src/screens/JobOverview.tsx:182-195`, overdue rows that are not "late" get the orange marker and bold, but the words are only dates. For example "Book cladders: Expected Wed 16 Sep, needed Wed 16 Sep" and "Order cladding: Expected Tue 15 Sep, needed Wed 16 Sep" (`review4-overview-park-1280-full.png`). Waiting on says "1 day overdue" for the same rows.
   - Use `urgencyWords` (`ui/itemWords.ts:18`) here too, so every screen says the same words.
5. NICE-TO-HAVE. **The same state is worded differently on different screens.**
   - Overview: "Overdue by 3 days" and "Act by Mon 10 Aug, overdue by 5 weeks" (core `lateText` / `relativeDays`).
   - Waiting on and To chase: "3 days overdue" and "Act-by passed 38 days ago".
   - Pick one set of words (item 4's fix covers most of it).
6. NICE-TO-HAVE. **Overview stage chart axis.**
   - `review4-overview-beatty-1280.png`: "OctNov" collide at the left, and "Dec" is clipped to "D" at the right edge. The collision guard in `components/Timeline.tsx:62-67` only drops a month shorter than 12 days, and a 12-day month still collides.
   - Beatty's mini chart also runs Oct 2025 to Dec 2026, which squeezes the live stages into the right 15%. Start it at the current stage, as the Gantt's default filter does.
7. NICE-TO-HAVE. **Gantt rows carry no visible dates, and step names do not look like links.**
   - On-time steps show no planned or forecast date as text. "Install windows planned Mon 2 Nov" can only be read off the axis or by opening step detail (`review4-program-park-1280.png`). Add the forecast range, plus the planned range when moved, under or beside the name.
   - `Program.tsx:240`: step names look like plain text until focused (`review4-focus-gantt-1280.png`), yet they are the only way into step detail.
8. NICE-TO-HAVE. **The hold-point photo state looks interactive and is drawn three ways.**
   - Step detail and the overview draw a checkbox square with a tick (`StepDetail.tsx:161`, `JobOverview.tsx:272`; `review4-step-slab-390-full.png`). In a read-only app it reads like a checklist you can tick.
   - Photos shows the same fact as an orange "1 of 3" badge (`review4-photos-seaview-1280-full.png`). The overview says "0 of 1 photo category filled".
   - On the design checklist, the current-stage marker has a hi-vis outline that looks exactly like the focus ring (`review4-checklist-west-1280-full.png`).
9. NICE-TO-HAVE. **The type scale has drifted from the tokens.**
   - `styles/tokens.css` defines 7 sizes. `app.css`, `lists.css` and `screens4a.css` hold 56 hard-coded `font-size` values, and the screens compute 19 distinct sizes from 11px to 44px.
   - Stage 4a and 4b each added their own stylesheet (`screens4a.css` 1259 lines, `lists.css` 860 lines). They repeat blocks such as group heads, sub lines and date cells.
   - Visible result: date "heroes" differ beside each other. The ETA is 24px condensed while "First needed" is about 19px Barlow bold (`review4-shipments-1280.png`); Act by and Needed by also differ in `review4-chase-390.png`.
   - Fold sizes back onto the tokens.
10. NICE-TO-HAVE. **The lightbox does not trap focus.**
    - `Photos.tsx:151-179`: the dialog is `aria-modal`, but four Tabs from Close land in the dev bar's date input outside it.
    - The effect also depends on an inline `onClose` that is a new function on every render, so it re-runs on every render of `PhotosBody`.
11. NICE-TO-HAVE. **Heading names and navigation aids.**
    - Some heading names run words together. The Photos h3 reads "Steel reinforcement in place4 photosNeeded for the hold point" (`Photos.tsx:125-129`). The overview h2s read "StagesFull program" and "Latest photosAll photos" because the links sit inside the headings (`JobOverview.tsx:212-218`, `292-299`). The step h1 reads "Install windows , Park Rd" (stray space, `StepDetail.tsx:54`).
    - There is no skip link to `#main` (`app/App.tsx:37-44`): the desktop rail puts about 15 links before the content. Focus is not moved to the h1 on a route change.
12. NICE-TO-HAVE. **Empty states say the same thing twice.** On a side with no jobs:
    - History: "Nothing has changed yet." then "No changes yet..." (`History.tsx:45-47`, `63`).
    - Waiting on: "Nothing open." then "Nothing waiting." (`WaitingOn.tsx:59`, `77`).
    - Shipments: "Nothing on order from overseas." then "No shipments being tracked." (`Shipments.tsx:34`, `47`).
13. NICE-TO-HAVE. **A cancelled change set looks like a saved one below its summary.** Only the summary is struck through. The field line still shows "Mon 26 Oct -> **Mon 2 Nov**" exactly as a saved change does (`review4-history-1280-full.png`, first entry). Dim the field lines or word them "would have changed".
14. NICE-TO-HAVE. **Copy and placeholder details.**
    - "Needed before Slab inspection before pour." reads badly (`Photos.tsx:143`).
    - The mock placeholder thumbnails clip long captions ("Cracked roof tiles above garage", `review4-overview-park-1280-full.png`). Mock only.
    - Diary notes put timber behind every entry (`review4-notes-park-1280-full.png`). That matches "words Dominic sent", but the page becomes a wall of beige.
15. NICE-TO-HAVE. **Hi-vis does several jobs at once.** It marks the today line and chip, the current tab and nav item, late bars, overdue chips, the "1 of 3" badge, the current checklist stage and focus. Words always come with it, so no rule is broken. But on the Beatty Gantt, "today" and "late" are the same orange (`review4-program-beatty-1280-full.png`). Consider steel for the today line.
16. NICE-TO-HAVE. **Bundle size.** The Pages build ships one 508 kB chunk. Lazy-loading the screens would shrink it and clear the build warning.
