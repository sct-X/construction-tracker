# Review: Stage 6 (the v1 UI port)

Reviewer: fresh and skeptical. I had not seen the work before. Commit reviewed: `9e20deb` (HEAD of local main,
not pushed). Date: 2026-10-10. Scope: SPEC "Revision 2026-10-10", PROGRESS Stage 6 (6a to 6d), docs/v1-ui-iterations.md,
docs/CONTRACTS.md (Web), against the read-only v1 prototype at `/Users/imac/dev/construction-tracker` (2f6d8a7).

## Verdict

**NOT SIGNED OFF. 5 MUST-FIX, 14 NICE-TO-HAVE.** Most of v1 is back. The shell, the job switcher, the job first
page, Waiting on, Program and Gantt, Step detail, Checklist, Photos, Notes and Changes all match v1 closely at 390
and 1280. The SPEC rules hold almost everywhere: no amber, red only with words, `#/chase` forwards, and the bot
card keeps finish, slip and $. What blocks sign-off: the Overview card is not v1's card (Dom's D9), Setup New
job shows a `$` holding cost, Shipments and the Program editor don't look like v1, and the README still
describes the old Monday screen.

## Command results

Fresh `git clone /Users/imac/dev/construction-tracker-next` (HEAD `9e20deb`) into a scratch dir. No `.env`, no keys.

| command | result |
| --- | --- |
| `npm ci` | exit 0 |
| `npm test` | exit 0, **409 passed** |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 |
| `npx playwright test` (all projects: mock, api, api-change, api-setup) | exit 0, **131 passed, 2 skipped** (old-worker on api, dev-bar reset on api-setup; both mock-only by design) |
| `npm run eval -- --dry` | exit 0, pass **32/32** |

## Screenshots taken

I ran v1 with `npx vite --port 5197` as admin (`?dev=1&as=dominic&today=2026-09-17`) and the clone's Pages
build with `vite preview` on 4321. Both use today = Thu 17 Sep. Every pair is in
`e2e/screenshots/review6-{v1,new}-<screen>-{390,1280}.png` (98 files, git-ignored). The screens are `overview`,
`job-park-rd`, `job-beatty`, `job-switcher` (open), `waiting`, `waiting-park-rd`, `shipments`,
`shipments-park-rd`, `program-park-rd`, `program-beatty`, `program-park-rd-full` (phone Full program / desktop
Late only), `lookahead-park-rd`, `step-windows`, `step-slab-insp`, `checklist-west`, `photos-park-rd`,
`photos-seaview`, `lightbox`, `notes-park-rd`, `changes` (v1 Activity), `setup-newjob`, `setup-templates`,
`setup-trades`, `setup-editor-park-rd`, and `setup-programs` (new only). I stopped the v1 server afterwards. I
also crawled 29 routes at both widths for banned words, red text without words, amber-like colours and
sideways scroll.

Differences I did not count as findings, because they come from the "still out" list or from data:

- Sign-in, the person picker, the bell and notifications, the Dominic footer, and People and roles are gone.
- Every Mark / Set date / Add item / Add photos / Upload here / Confirm program / Add shipment / Move / Delete
  button and the note entry box are gone (no web editing).
- Waiting on's Call goes to trades only, with no "Call Dom" or "Call Raff" (one user).
- Setup shows a one-line message on a phone (Setup is desktop-only).
- Seed names and counts differ: "Park Rd" vs "64-66 Park Rd", Seaview's "1 overdue" (Order slab steel), 5
  overdue vs 4, and the trade names.
- v1's step and shipment pages had no job tabs; the new app has them on every job page (L6).
- v1's final Waiting on showed Later open. SPEC revision 4 asks for it folded, so the new app follows SPEC.

## Findings

### MUST-FIX

1. **The Overview card is not v1's card (Dom's D9, partly D8).** v1's final card (Dom, round 2) shows only the
   name, the stage bar, the stage, and "! 4 overdue" / "Nothing overdue". v1 PRODUCT.md:40 says so outright:
   "no next steps, waiting-on items or freshness (the job page holds the detail)". The new card adds Next (3
   steps), Waiting on (3 items) and the freshness line. That makes the phone Overview 2954 px tall against v1's
   1246 (`review6-v1-overview-390.png` vs `review6-new-overview-390.png`, and the 1280 pair). The cause is SPEC
   revision 2 itself. It says "Home is v1's Overview" and then lists the extra rows, so it contradicts itself, and
   the code (`packages/web/src/screens/Overview.tsx:117-169`) follows the list. Scott will notice this first.
   Fix: ask Scott which he wants. Then either trim the card to v1's (keep `overview()` for the job page), or
   record in SPEC that the richer card is a deliberate change from Dom's D9.
2. **Setup New job shows money on the web.** It has a "Weekly holding cost $ [4500] a week" field with the hint
   "Used by the bot's confirm card." (`packages/web/src/screens/SetupNewJob.tsx:211-221`,
   `review6-new-setup-newjob-1280.png`). SPEC revision 2 bans holding cost on the web. The only Setup exception
   is the planned finish, and v1's New job had no money field (`review6-v1-setup-newjob-1280.png`). CONTRACTS
   contradicts itself on this too (docs/CONTRACTS.md:454 vs :457). Fix: drop the field and default the cost, or
   set it through the bot. If Scott wants it kept, write that exception into SPEC. The hint text also breaks
   copy rule 1.
3. **Shipments doesn't look like v1.** v1 shows the ETA as the big figure ("26 Oct 2026", display size) with
   "ETA 1 week before needed" under it, and "3 items", on a hairline table with a Job column on the side-wide
   list. The new screen has a 20 px "Mon 26 Oct", moves the gap to the Needed-by column as "7 days to spare",
   lists every linked item, and puts the table on a white plate (`review6-{v1,new}-shipments-1280.png`,
   `-shipments-park-rd-{390,1280}.png`; `packages/web/src/ui/itemWords.ts:61-68`,
   `screens/Shipments.tsx:139-160`). v1's words were "ETA N before/after needed" (v1
   `src/screens/Shipments.tsx:56-58`, a protected phrase in v1 COPY_RULES). Fix: port v1's ETA figure, gap
   words and item count. The linked items can stay behind the row if wanted.
4. **The Program editor isn't in the v1 look.** v1's editor is the Gantt with numbered stage chips, a "Nothing
   picked / Pick a bar" side panel and the glass footer. The new one is a full form table: Working days,
   Waits for, Hold point, Needs, Trade and "Links and needs" per step. It is 4035 px tall
   (`review6-{v1,new}-setup-editor-park-rd-1280.png`). PROGRESS 6d records this as a choice ("Kept our table
   editor"), but SPEC revision 6 says Setup stays "in the v1 look". Core taking one setup op at a time doesn't
   stop a Gantt-plus-panel editor from doing the same. Fix: port v1's editor layout, or get Scott's OK and note
   it in SPEC.
5. **The README still describes the dropped web.** Line 5-6: "It shows when each job will finish, how far that
   moved since last Monday, what it costs". Line 286: "Monday screen, jobs, programs, waiting-on, to-chase".
   Both contradict SPEC revision 2 and 4 on the public repo page. Fix: describe the Overview (timing first),
   one Waiting on with Call, and Shipments in each job. Say that finish, slip and $ appear only on the bot's card.

### NICE-TO-HAVE

6. **Dead code from the old screens.** `packages/web/src/components/listBits.tsx` is imported by nothing, and
   `styles/lists.css` (519 lines) is imported only by that file, so it never reaches the build. I grepped
   `dist-pages`: no `chase-table` or `call-verb`. That also makes PROGRESS 6d's ".tag kept for Program/Step"
   untrue. `components/bits.tsx` `Freshness` and `CellLabel` are unused. So are `ui/format.ts` `lateWords` and
   `statusWords`, and `ui/itemWords.ts` `urgencyWords` and `shipmentStepWords`. `urgencyWords` is still
   unit-tested with the old wording "3 days overdue" / "Act-by passed 38 days ago" (`stage4b.test.tsx:30-31`).
   `styles/screens4a.css` has 27 selectors with no user, including the old job-overview `.notes` at :203,
   `ov-*`, `rail-*`, `wl-*`, `more-menu` and `oseg`. Only `jobbar*`, `num`, `tabs` and `note-date` are still
   used, so they could move into shell/base. `legacy.css` has `job-name`, `screen-head` and `screen-sub` unused.
   `RouteDef.ownHeading` (`app/routes.tsx:13,58`, read at `shell/JobHeader.tsx:68`) is set by no route.
7. **CONTRACTS Web is inaccurate in places.** :460 says "legacy.css, lists.css ... are gone", but :510-511 says
   lists.css "keeps the Waiting on / Shipments leftovers and `.tag`". Neither is true: lists.css is unloaded
   dead code. The route-table bullet (:399) still describes `ownHeading`.
8. **"Moved no forecast."** in Changes (`screens/History.tsx:258`) is unclear next to "Moved 3 steps at Beatty
   St". Use "Moved no steps." or show nothing.
9. **Waiting on shows a "Job" label** before the job menu (`screens/WaitingOn.tsx:93`). v1 had only the select
   (`review6-{v1,new}-waiting-{390,1280}.png`).
10. **Trades "On jobs" misses trades that are on site.** Bayview Roofing reads "Not on a job yet" while it is
    on site at Park Rd this week (job first page, "Trades on this week"). `jobNames` counts open items only
    (`packages/core/src/readModels.ts:907`). Count program steps too.
11. **Step detail layout nits.** "on plan" floats far right of "Mon 28 Sep", and "Holds up: Pour ground floor
    slab starts Fri 2 Oct, in 2 / weeks" wraps with a big line gap (`review6-new-step-slab-insp-390.png`).
    The back link reads "Program" where v1 had "31 Seaview St program". That is acceptable, given the job
    header.
12. **The look-ahead shows red overdue-need pills on a step already under way** (External cladding: "! needs
    cladders, needed Wed 16 Sep, overdue by 1 day"). v1's look-ahead showed no need lines for that step
    (`review6-{v1,new}-program-park-rd-390.png`). The words are correct, but the screen is busier than v1's.
13. **The unknown-step error is an unstyled black-bordered box** with the raw "Unknown step install-windows"
    (`components/bits.tsx:39`). v1 showed a plain "Not found / Nothing at this address. / Home".
14. **Relative time is missing on a few dates (D13).** The shipment linked-item lines ("Raff, needed Mon 2 Nov")
    and the lightbox "Came in" lack it.
15. **Dark mode and "match the system" are not wired (V3).** The dark tokens exist under `data-theme=dark`, but
    nothing sets them, not even `prefers-color-scheme`.
16. **Name: the new app says "Tracker", v1 said "Cruise" (V4).** This is documented as Scott's call. Raise it
    with him, since he'll see it in the sidebar.
17. **Stale test names and wording.** `e2e/stage4a-screens.spec.ts:73` says "goes back to the jobs list" (the
    page is now the Overview). The stage-numbered spec and test files (`stage4a*`, `stage4b*`) now hold
    Overview, job and Waiting on cases. Renaming them by screen would help the next reader.
18. **New job has a "Not set" approval-path option** that v1 lacked. It is harmless, but it is a visible
    difference.
19. **Desktop Close in the lightbox is the small button.** v1 used the full-size one
    (`review6-{v1,new}-lightbox-1280.png`). Trivial.

## SPEC revision rules (item 4 of the brief)

- **No finish, slip, $ or Why it moved on the web:** holds on every route I crawled (29 routes x 2 widths).
  The exception is Setup New job's holding cost (#2). "Finishes" hits are the stage name.
- **No amber:** no visible "amber" in either build (`dist`, `dist-pages`; the only hits are property names and
  `data-unconfirmed`). There are no amber-like colours on any crawled page. Bot and server strings say "not
  confirmed for N days" or "Confirmed again". `flows.test.ts:427` and `scheduler.test.ts:73` assert there is
  no amber.
- **Red only with words:** every red element carries "overdue" and/or "!" (crawl). Late-but-not-overdue is
  plain ("7 days late" on the Gantt, "7 days after needed").
- **Waiting on:** one list grouped Overdue / This week / Later, with Later in a closed `<details>`. Call buttons
  name the trade ("Call Northern Concrete Pumping"). The Overdue count (5) equals the sum of the Overview's
  red counts (4 + 1).
- **Redirects:** `#/chase` -> `#/waiting`, and `#/monday` and `#/jobs` -> `#/` (checked in the browser).
- **The bot's confirm card keeps finish, slip and $:** `packages/bot/test/flows.test.ts:88-89`
  ("Finish Fri 12 Mar 2027 (was Fri 26 Feb 2027)", "Slip +14 days, $9,000") and `e2e/api-change.spec.ts:53-54`
  through the real bot. `api-change.spec.ts:77` checks that none of it leaks onto the Overview.

## Liquid Glass (item 5)

The glass is only on the floating layer: the phone nav bar and tab bar (Regular), the sticky phone job tabs
and Waiting on filter (Regular, `glass--yields`), the job switcher menu and the editor footer (Thick), and
static glass buttons (Call, Edit program, Discard/Save). Cards, rows, the lightbox and the forms are solid.
`styles/base.css:620-720` puts the fallback first: solid fill, blur only inside
`@supports (backdrop-filter)`. It also handles `prefers-reduced-transparency` (solid), `prefers-contrast: more`
(solid plus 1 px outline), `forced-colors` (Canvas/CanvasText, no shadow) and `prefers-reduced-motion`
(base.css:735, shell.css:490). The phone layer budget (`data-lg-menu` drops the strip's blur) and no glass on
glass match the skill. The text stayed legible where red overdue text and plate edges scrolled under the
phone bars in my 390 shots. The Regular fill is 52%, the same value as v1. That is just above the skill's 0.51
worst-case threshold for 4.5:1, which is acceptable but leaves little margin.

## v1 iterations, item by item (item 3)

Dom's requests:

| # | request | new app |
| --- | --- | --- |
| D1 | No finish, slip, why, money on screens | yes, except the Setup holding cost (#2) |
| D2 | Monday + Jobs merged into Overview | yes |
| D3 | Timing first | yes |
| D4 | Job dropdown on every job page, desktop too | yes (custom menu, Builds/Design, "(4 overdue)") |
| D5 | Shipments tab in each job | yes, but the screen differs from v1 (#3) |
| D6 | Phone bar: Overview and Waiting on only | yes (Changes is a glyph in the nav bar) |
| D7 | Stage progress bar | yes (cards, job first page) |
| D8 | Waiting on first on each card | partly: the overdue count sits by the name, but Next comes before Waiting on (#1) |
| D9 | Trimmed card: name, bar, stage, overdue count | **no**: the card carries Next, Waiting on and freshness (#1) |
| D10 | "! 4 overdue" marker, red | yes |
| D11 | No amber | yes (web and bot) |
| D12 | One shared overdue test | yes (counts agree: 4 + 1 = 5) |
| D13 | Relative time next to every date | yes, small gaps (#14) |
| D14 | Job first page: progress, overdue, trades this week | yes |
| D15 | Booked needs an expected date | yes (the bot asks; core refuses) |
| D16 | Late but not overdue in plain words | yes |
| D17 | One Waiting on list with Call | yes (row actions are out: no web editing) |
| D18 | Sidebar lists no jobs | yes |
| D19 | Builder/site get the tab and dropdown | n/a (no other users) |

Layout: L1, L2, L8-L11, L14 dropped as SPEC says. L3 n/a. L4 yes (Waiting on, Photos and Changes are
dropdowns). L5 yes, per SPEC (v1's final unfolded it). L6 yes. L7 partly (the bar is always shown in the demo,
per SPEC). L12 yes. L13 yes.

Visual: V1 superseded. V2 yes. V3 no (#15). V4 no, which is Scott's call (#16). V5 yes. V6 yes. V7 yes. V8
yes. V9 yes (tab bar minimise, glass buttons, the switcher morph). V10 yes.

Wording: W1 partly (#2 hint, #8). W2 yes in the screens, but `urgencyWords` keeps the old phrasing (#6) and
Shipments says "7 days to spare" (#3). W3 yes. W4 yes. W5 yes. W6 yes (in the bot). W7 yes.
