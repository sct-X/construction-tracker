# v1 UI iterations, and what the rebuild should do with them

This lists every screen or product change made to the old five-person prototype
(`/Users/imac/dev/construction-tracker`, 18 to 24 Sep 2026, ending at commit 2f6d8a7).
For each change it says what the change was, where it came from, whether the new app
(`construction-tracker-next`) has it, whether it clashes with `SPEC.md`, and roughly how
much work it would take to bring across.

Sources: the old `PRODUCT.md`, `DESIGN.md`, `PROGRESS.md`, `docs/COPY_RULES.md`,
`docs/DESIGN_CRITIQUE_*.md`, the 39 commit messages, `public/design-options/`, and Dom's
"Construction Tracker: Change Brief" of 23 Sep (quoted in the old session's notes), plus
his second feedback round (23 Sep) and his Waiting on note (24 Sep).

How to read each entry:

- **Source** says whether the change came from Dom ("Dom's brief" is the 23 Sep document;
  "Dom, round 2" is his answers later that day), from Scott, or from a design pass, where
  the agent redesigned or reviewed screens without being asked for a particular change.
- **New app**: *yes*, *partly* or *no*.
- **Conflict with SPEC**: *none*, or how it clashes.
- **Effort** to port: *small* (an hour or two, one screen), *medium* (a day, a few screens
  or a core change), *large* (touches most screens or reverses a SPEC decision).

A few things changed between the two apps and come up again and again:

- **SPEC is one user and a read-only web.** v1 had five people with roles, sign-in, and
  editing on the web. In the new app Dominic is the only user, and he makes every
  day-to-day change through Telegram. So v1 screens for typing, ticking, uploading or
  signing in have nothing to attach to.
- **SPEC wants the numbers.** The Monday screen must show forecast finish, slip and slip
  cost, plus "Why it moved", with the numbers as the largest type. In its last week v1
  took all of that off the screen.
- **SPEC wants a site-materials look.** That means concrete, steel and timber colours,
  hi-vis orange as the *single* accent, and no stock imagery or gradients. v1 ended on an
  Apple / Liquid Glass look with the system font and a darker "Cruise" orange.

---

## 1. Dom's requests

### D1. Take forecast finish, slip, "why it moved" and money off every screen
- **What:** the calculator kept running underneath, but no screen showed a finish date, a slip in days, a holding cost or the "why it moved" chain. Only act-by and needed-by dates were left.
- **Source:** feedback round of 19 Sep, which the notes record as "grilled and agreed" (Scott answered questions, then the change was built). The notes don't quote Dom directly. Dom's 23 Sep brief then built on it ("pare back anything that isn't timing").
- **New app:** no. The new app shows all of them.
- **Conflict with SPEC:** yes, directly. SPEC's Monday screen is built on forecast finish, slip, slip cost and "Why it moved". The bot's confirm card shows the same numbers, and the seed numbers ($9,000, +14 days) are what the tests check.
- **Effort:** large, and it would mean rewriting SPEC.

### D2. Merge Monday and Jobs into one "Overview" home screen
- **What:** one home screen listing every job, in place of a separate Monday screen and Jobs list.
- **Source:** the 19 Sep feedback round, as for D1.
- **New app:** no. Monday (home) and Jobs are separate.
- **Conflict with SPEC:** partly. SPEC lists "Monday screen" and "jobs list" as two screens, so merging them drops one. A merged screen would also have to keep D1's numbers.
- **Effort:** medium.

### D3. "Timing first" as the app's stated goal
- **What:** the product description was rewritten around three questions: what's late, what's next, and what we're waiting on. Anything else is pared back, with less text and more visuals.
- **Source:** Dom's brief (23 Sep), written into `PRODUCT.md` (commit 3b5b2ff).
- **New app:** partly. Waiting on, To chase, act-by dates and hold points answer those questions, but the Monday screen leads with finish and slip.
- **Conflict with SPEC:** partly. The goal itself is fine. Its "pare back everything else" reading is what removed the money in v1 (D1).
- **Effort:** small as a written principle. It is the owner's call how far to take it.

### D4. Job dropdown at the top of every job page
- **What:** once inside a job, the job's name is a dropdown listing every job, so Dom can jump to another job without going back. It always shows which job he's on.
- **Source:** Dom's brief, change 1 (commit 3516bcb). It later became a custom menu (V9).
- **New app:** partly. A dropdown exists on phones only. On a desktop, the left rail lists the jobs instead.
- **Conflict with SPEC:** none.
- **Effort:** small. Show the existing dropdown on desktop too.

### D5. Shipments as a tab inside each job
- **What:** each job page gets a Shipments tab showing only that job's shipments. The ETA change still moves the later steps.
- **Source:** Dom's brief, change 2 (commit a206bb9).
- **New app:** no. Shipments is one side-wide list in the main menu. The job overview has a small shipments section.
- **Conflict with SPEC:** none. SPEC only says there is a shipments screen, and the side-wide list can stay as well. (The ETA change itself now happens through the bot, not on the web.)
- **Effort:** small. Add one job-tab row to the route table, reusing the Shipments screen filtered to the job.

### D6. Phone bottom bar of just two tabs: Overview and Waiting on
- **What:** everything job-specific lives inside the job page, so the bottom bar shrinks to two tabs.
- **Source:** Dom's brief, under change 2.
- **New app:** no. The phone bar has Monday, Jobs, Waiting on, To chase, Shipments and Changes (four plus "More").
- **Conflict with SPEC:** partly. SPEC requires To chase, Shipments and Changes screens. They would need another way in, such as job tabs or a "More" menu.
- **Effort:** small to medium.

### D7. A stage progress bar in place of the stage name
- **What:** a slim bar of segments, one per stage, with done stages filled and the current one highlighted, so you can see where a job sits at a glance.
- **Source:** Dom's brief, change 3 (built in commit 85244e6 as the `StageBar` component).
- **New app:** partly. Monday and Jobs show the stage as a word. The job overview has a stage time chart, and the phone Program has a stages strip.
- **Conflict with SPEC:** none, as long as the bar sits beside the finish and slip figures and doesn't replace them.
- **Effort:** small to medium. One new component, used on Monday, Jobs and the job overview.

### D8. Waiting on is the first thing read on each job card
- **What:** overdue items, such as "Tile choice needed 14 Sep, 3 days late", move to the top of each card instead of halfway down.
- **Source:** Dom's brief, change 4.
- **New app:** partly. Monday has an "Act by this week" section, and the job overview has a Waiting on block. On both, the finish and slip figures come first.
- **Conflict with SPEC:** partly. SPEC says numbers are the largest type on the Monday screen. Waiting on can come early in the reading order, but it can't out-size the finish and slip figures.
- **Effort:** medium.

### D9. Less text, more visual: four job-card designs, then a trimmed card
- **What:** four phone mockups of the Overview card were made for Dom (`public/design-options/option-1..4.png`):
  1. Waiting on first, slim stage bar underneath.
  2. Stage bar as the hero, Waiting on as tiles.
  3. Compact dense rows.
  4. Bold red band when something is overdue.

  Dom picked option 1, then asked for the card to show only the overdue count. The final card had the job name, the stage bar with the current stage named, and "! 4 overdue" or "Nothing overdue". Tapping the card opens the job.
- **Source:** Dom's brief, change 5 ("show me a couple of options"), then Dom, round 2 (commits 75a2fae and 85244e6).
- **New app:** no. Monday is a table (cards on a phone) with finish, slip, cost and freshness.
- **Conflict with SPEC:** yes, for the final card. With only name, bar and count, it drops the finish, slip and cost that SPEC requires on Monday. Option 1 itself (Waiting on items plus a bar) would fit if the numbers stay.
- **Effort:** medium.

### D10. Overdue marker on each job card
- **What:** a red "! 4 overdue" chip beside the job name, so the jobs that need a call today stand out. It only appears for things actually past their date.
- **Source:** Dom's brief, change 6 (commit 9a0cf2f, labelled "change 5").
- **New app:** partly. Overdue is worked out (core `isOverdue`) and shown in Waiting on, but not on Monday or Jobs rows.
- **Conflict with SPEC:** partly, over the colour only. SPEC makes hi-vis orange the single accent, so a red chip adds a second warning colour. Showing the count in words plus hi-vis would not conflict.
- **Effort:** small. The count can come from the waiting-on read model.

### D11. No amber "coming soon" warnings
- **What:** amber was removed as a warning colour, including the "not confirmed for 7 days" freshness warning and the "oldest item 14 days" warning. Only overdue gets a colour.
- **Source:** Dom's brief, under change 6 (commit 9a0cf2f).
- **New app:** no. Amber marks a job not confirmed for over 7 days.
- **Conflict with SPEC:** yes. SPEC rule 7 says "A job goes amber after 7 days unconfirmed", the Beatty St seed is "amber", and the bot sends reminders for "jobs going amber" (bot test f).
- **Effort:** small in code. It needs the owner to change SPEC rule 7.

### D12. One shared test for "overdue"
- **What:** an item counts as overdue when it is not done and either (a) its needed-by date has passed with nothing expected, or the expected date has also passed, or (b) it is still to do and its act-by date has passed. Every screen uses this one test, so the counts agree.
- **Source:** follow-on from Dom's brief, change 6 (commits 9a0cf2f and ceb58cf).
- **New app:** yes. Core `isOverdue` in `packages/core/src/readModels.ts` is the same rule.
- **Conflict with SPEC:** none.
- **Effort:** none.

### D13. Relative time next to every date
- **What:** dates show how far away they are: "Mon 28 Sep, in 5 days", "Mon 21 Sep, overdue by 2 days", "3 days ago". "Overdue by" is used only for real deadlines.
- **Source:** Dom's brief, change 7 (commit 4048296, labelled "change 6").
- **New app:** partly. Core has `relativeDays` and the waiting-on, to-chase and shipment lists use it, as does Monday's act-by list. Finish dates, the Program, step detail and history show the bare date.
- **Conflict with SPEC:** none. SPEC's "dates written as 'Mon 16 Nov'" can carry the extra words.
- **Effort:** small to medium. It is a sweep across about eight screens.

### D14. The job's first page: progress, then overdue, then trades this week
- **What:** opening a job showed a progress panel at the top (stage name, "Stage 5 of 8", a large stage bar, and the next hold point with its date). Below it came every overdue item, then "Trades on this week" (steps on site or starting in the next 7 days, named by trade). Next steps, non-overdue items and freshness came off.
- **Source:** Dom, round 2 (commit 85244e6).
- **New app:** partly. The build overview has the next hold point, a stage chart, the top 5 waiting-on items, shipments, notes and photos, under a finish / slip / cost hero. It has no "trades on this week" section.
- **Conflict with SPEC:** partly. Adding the progress bar, an overdue list and "trades on this week" is fine. Removing the forecast hero is not, for the same reason as D1.
- **Effort:** medium.

### D15. "Ordered or booked" needs an expected date
- **What:** an item can't be marked booked or ordered unless it has an expected date (its own, or its shipment's ETA). This stops booked items with no date looking overdue.
- **Source:** Dom, round 2 (commit d51e95a).
- **New app:** no. Core `set_item_status` accepts "ordered or booked" with no expected date.
- **Conflict with SPEC:** none. In the new app the bot would ask "When is it expected?" instead of saving.
- **Effort:** small. One core operation check and one bot question, plus tests.

### D16. "Late but not overdue" in plain words, not coloured
- **What:** two future dates that clash, such as "expected Mon 5 Oct, 7 days after needed", or a step forecast later than planned while its dates are still ahead, read in plain words with no warning colour. Colour is kept for things already past their date.
- **Source:** Dom, round 2 (he left it to Scott, who chose plain; commit d51e95a).
- **New app:** no. Both "late" and "overdue" get the same hi-vis flag in Waiting on, and late Gantt bars are hi-vis.
- **Conflict with SPEC:** none. The words stay ("14 days late"), only the colour changes.
- **Effort:** small.

### D17. Waiting on is one simple list, with a Call button on each row
- **What:** the phone list, the desktop table and "Call mode" (grouped by who to ring) became one list, the same on phone and desktop. It is grouped Overdue, This week, Later. Each row shows the title, job, who it's waiting on, one date phrase and a "Call <name>" phone link. Filters are Everyone / Mine plus a job menu. The separate call list was deleted.
- **Source:** Dom, 24 Sep: "waiting on only needs one view, not list and call together. just simplify" (commit 9e6ed9e).
- **New app:** partly. Waiting on has the three groups and phone links, but it keeps a desktop table, and To chase is still its own screen.
- **Conflict with SPEC:** partly. SPEC lists "to-chase list with tap-to-call trade numbers" as its own screen, so merging would remove it. v1's quick buttons on each row (Set date, Mark booked) clash with the read-only web.
- **Effort:** medium.

### D18. The desktop sidebar stops listing every job
- **What:** with the job dropdown as the main way between jobs, the sidebar's job list was removed.
- **Source:** Dom, round 2 (commit d51e95a).
- **New app:** no. The desktop rail lists the side's jobs under Jobs.
- **Conflict with SPEC:** none.
- **Effort:** small. It only makes sense together with D4 (dropdown on desktop).

### D19. Builder and site hand also get the Shipments tab and job dropdown
- **What:** Raff got both. Alec got a read-only Shipments tab beside his Deliveries, but no dropdown.
- **Source:** Dom, round 2 (commit d51e95a).
- **New app:** no.
- **Conflict with SPEC:** yes. There are no other users.
- **Effort:** none needed. Drop it.

---

## 2. Layout and navigation

### L1. A different home screen and tab bar for each person
- **What:** partners and admin opened on Overview, Raff on "My items", and Alec on "Today" for his last site. Each had their own bottom tabs.
- **Source:** the original build (Stage 1), reshaped by the 19 Sep round.
- **New app:** no.
- **Conflict with SPEC:** yes. One user, no roles.
- **Effort:** none. Drop it.

### L2. Sign-in screen (pick your name, no password) and a signed-out state
- **Source:** the 19 Sep feedback round.
- **New app:** no.
- **Conflict with SPEC:** yes. One user; the web runs on his own machine or as a public demo.
- **Effort:** none. Drop it.

### L3. Side names hidden from people on one side only; the "Norm" side filled with jobs
- **Source:** the 19 Sep feedback round.
- **New app:** partly. Dominic gets the side switcher, as SPEC says. The Norm side has no jobs, because SPEC names none.
- **Conflict with SPEC:** the hiding rule is moot, since there are no other people. Seeding Norm jobs would add invented jobs beyond SPEC's list.
- **Effort:** none.

### L4. Every filter is a dropdown
- **What:** filter chip rows (Waiting on, gallery, activity) became one-line dropdowns, to cut clutter.
- **Source:** the 19 Sep feedback round.
- **New app:** partly. Waiting on uses a job dropdown, but To chase still uses a row of owner chips.
- **Conflict with SPEC:** none.
- **Effort:** small.

### L5. "Later" folded by default
- **What:** the long "Later" group in Waiting on starts collapsed, so the phone page isn't thousands of pixels long.
- **Source:** design pass 2 (review fix).
- **New app:** no. All groups are open.
- **Conflict with SPEC:** none.
- **Effort:** small.

### L6. Every job page has the same layout
- **What:** back link, title, tabs, then the main figure, on every job page, including the design checklist.
- **Source:** design pass 2 (review fix).
- **New app:** yes. The job bar (name, dropdown, tabs) is drawn by the shell on every job page.
- **Conflict with SPEC:** none.
- **Effort:** none.

### L7. Slim dev bar, hidden until `?dev=1`
- **What:** the demo controls shrank to one collapsible strip, and later were hidden unless the link asks for them.
- **Source:** design pass 0 (slim strip) and the 19 Sep round (hidden).
- **New app:** partly. It has a slim dev bar with "today is" and Reset only (as SPEC says), always shown in the demo.
- **Conflict with SPEC:** none, but SPEC expects the demo to have the bar, so hiding it is optional.
- **Effort:** small.

### L8. Photo upload, upload queue and offline bar ("No signal", "Needs signal")
- **Source:** the original build (Stage 3), restyled in design passes.
- **New app:** no.
- **Conflict with SPEC:** yes. Photos arrive through Telegram, and SPEC removes the offline upload queue.
- **Effort:** none. Drop it.

### L9. Notification bell, activity feed and the pop-up "buzz" banner
- **Source:** the original build (Stage 5). Dom's brief said to keep the bell.
- **New app:** no.
- **Conflict with SPEC:** yes. SPEC removes in-app notifications; reminders go to Telegram.
- **Effort:** none. Drop it.

### L10. Editing on the web
- **What:** the item sheet (add or edit), Set date, Mark booked / confirmed / done, Confirm program, "Add photos" as the main button on a hold point, the daily-note entry box, and the shipment ETA change form.
- **Source:** the original build, plus design passes (for example, pass 2 made "Add photos" the main button before "Mark done").
- **New app:** no. Only the desktop Setup area writes anything.
- **Conflict with SPEC:** yes. The web is read-only; these changes come through the bot.
- **Effort:** none. Drop it.

### L11. Settings, and People and roles screens
- **What:** theme, notification and install settings; adding people and setting their roles.
- **Source:** the original build (Stage 6).
- **New app:** no.
- **Conflict with SPEC:** yes for People and for notifications. A theme choice alone wouldn't conflict (see V3).
- **Effort:** none. Drop it.

### L12. Desktop tables and phone cards from the same page
- **Source:** the original build, kept through every pass.
- **New app:** yes. SPEC requires it.
- **Conflict with SPEC:** none.
- **Effort:** none.

### L13. "Ring" button: the trade's number as a big tap target that never wraps
- **What:** the phone number became a full-width button reading "Ring 0411 200 303", instead of a small inline link that broke across lines.
- **Source:** design pass 2 (review fix).
- **New app:** partly. Numbers are phone links that show the trade's name and number. Check they don't wrap at 390px.
- **Conflict with SPEC:** none.
- **Effort:** small.

### L14. Alec's "Today" page and the Deliveries list
- **Source:** the original build, restyled in pass 1.
- **New app:** no.
- **Conflict with SPEC:** yes. No site-hand user.
- **Effort:** none. Drop it. Its "on site this week" idea lives on in D14.

---

## 3. Visual style

### V1. Design pass 0: a dark "graphite" look, a self-hosted font pair, dates as the biggest type
- **What:** dark by default; Barlow Semi Condensed for figures and Atkinson Hyperlegible for words; one hi-vis orange button per screen; statuses as words on a tinted background with a leading "!".
- **Source:** design pass, answering the client's first brief ("dark mode. cool. sleek. well spaced. not too much writing").
- **New app:** partly. It uses Barlow / Barlow Condensed, hi-vis as the one accent, and words with every colour. It is light only and uses concrete tones, not graphite.
- **Conflict with SPEC:** partly. A graphite world is not SPEC's concrete, steel and timber palette.
- **Effort:** medium.

### V2. Design passes 1 and 2: every screen restyled on shared building blocks
- **What:** shared building blocks (buttons, segmented controls, panels) and copy trimmed screen by screen. The reviewer's score rose from 22/40 to 30/40.
- **Source:** design passes. The critiques are in `docs/DESIGN_CRITIQUE_*.md`.
- **New app:** partly. It has its own shared bits (`bits.tsx`, `listBits.tsx`, one token file), but no equivalent critique has been run.
- **Conflict with SPEC:** none.
- **Effort:** medium, if a critique pass is wanted.

### V3. Light by default, with dark and "match the system" as options
- **Source:** client decision relayed by Scott, 18 Sep.
- **New app:** no. Light only.
- **Conflict with SPEC:** none, as long as the dark version is still drawn from the site-materials palette.
- **Effort:** medium. A second set of colours, checked for contrast on every screen.

### V4. The app renamed "Cruise", with its own logo
- **Source:** Scott, 23 Sep, before Dom's brief.
- **New app:** no. The page title is "Tracker".
- **Conflict with SPEC:** none in the rules. SPEC calls it "Construction Tracker", so the name is the owner's call.
- **Effort:** small.

### V5. The Apple design foundation
- **What:** the system font (SF Pro) instead of a web font; iOS grey grouped backgrounds; a darker "Cruise" orange (#b0501a) as the one tint; red for overdue only; no amber; iOS-style buttons, icons and large titles; a macOS-style sidebar.
- **Source:** Scott, 23 Sep ("as if Apple made it", marked binding in the old `PRODUCT.md`).
- **New app:** no.
- **Conflict with SPEC:** yes. SPEC asks for concrete, steel and timber colours with *hi-vis* orange as the single accent. It also requires reading `docs/SKILL_tracker-ui-design.md`, which says to ground the look in the building trade. The system font replaces the Barlow signage face.
- **Effort:** large.

### V6. Overview as a grid of rounded cards (the Apple version of D9 and D14)
- **Source:** design pass on top of Dom, round 2 (commit 85244e6).
- **New app:** no. Monday is a table on desktop and cards on a phone.
- **Conflict with SPEC:** partly. SPEC asks for desktop tables. The card layout itself is the visual half of D9.
- **Effort:** medium.

### V7. Liquid Glass, pass 1: frosted glass on the floating bars only
- **What:** the phone top bar and bottom bar (now a floating capsule), the pop-up banner and the editor footer became translucent, blurred glass. Everything else stayed solid.
- **Source:** Scott asked for it; an Apple "Liquid Glass" skill was added and run (commit 20cf8fb).
- **New app:** no.
- **Conflict with SPEC:** yes, in spirit. It is Apple's style, not site materials, and it leans on effects that SPEC's design skills warn against.
- **Effort:** medium.

### V8. Liquid Glass, pass 2: more see-through bars
- **What:** the bars became clearer (52% instead of 88%), so orange buttons and red chips show through. The selected tab sits on a glass pill, and the job tabs and Waiting on filter stick under the top bar as glass.
- **Source:** Scott wanted "that translucent Apple feel" (commit cbda224).
- **New app:** no.
- **Conflict with SPEC:** yes, as V7.
- **Effort:** medium.

### V9. Liquid Glass, pass 3: shrinking tab bar, glass buttons, animated job menu
- **What:** three iOS behaviours:
  - the phone tab bar shrinks while scrolling down and comes back on scroll up;
  - buttons got a glass finish;
  - the job dropdown became a custom menu that grows out of the title, with keyboard support, overdue counts in words, and Builds / Design groups.
- **Source:** Scott, as V7 (commit 2f6d8a7).
- **New app:** no. The new app uses the phone's own dropdown, with Builds / Design groups.
- **Conflict with SPEC:** the glass buttons conflict, as V7. The shrinking tab bar and a custom job menu (without the glass) don't conflict.
- **Effort:** medium for each of the two neutral behaviours.

### V10. Red means overdue and only overdue
- **What:** red (#d70015) was kept for "past its date", always with the word "overdue" and a "!".
- **Source:** Dom's brief (change 6), made a design rule in V5.
- **New app:** no. Hi-vis orange marks overdue, late and short-of-photos, always with words.
- **Conflict with SPEC:** partly. SPEC wants hi-vis as the single accent, and red would be a second one. Owner's call (see D10).
- **Effort:** small.

---

## 4. Wording

### W1. Copy rules: no explanations on screen
- **What:** the rules from `docs/COPY_RULES.md`:
  - no explanatory paragraphs on a screen;
  - one- or two-word labels in sentence case;
  - buttons say the action in two or three words;
  - errors give the problem and fix in one line;
  - empty states are one line;
  - never restate what the screen already shows.

  Pass 1 cut about 120 lines of text this way.
- **Source:** the client's words ("not too much writing. get rid of all the fluff"), applied in design passes 1 and 2.
- **New app:** partly. The wording is plain English throughout, but there has been no trimming pass. For example, some screens have a sentence under the title ("3 builds and 4 design jobs.").
- **Conflict with SPEC:** none. SPEC asks for plain English.
- **Effort:** small. Copy `COPY_RULES.md` over (minus its v1 test phrases) and do one sweep.

### W2. "Overdue", "late" and "ago" each mean one thing
- **What:**
  - "overdue by N days" only for a deadline that is still open;
  - "N days late" only for the gap between two dates (expected after needed, forecast after plan);
  - "N days ago" for past dates that aren't deadlines (a photo, a note).
- **Source:** Dom's brief, change 7 (commit 4048296).
- **New app:** partly. It says "3 days overdue", "Act-by passed 38 days ago" and "Expected 14 days after it's needed". The meanings are mostly kept apart, but the phrasing differs between screens.
- **Conflict with SPEC:** none.
- **Effort:** small.

### W3. "With council" and "With certifier" both read "Pending approval"
- **Source:** the 19 Sep feedback round.
- **New app:** no. The design stages are named "With council" / "With certifier".
- **Conflict with SPEC:** partly. SPEC's seed describes West St and Tollbar Ave as "with council", and the bot's reminders use the stage names.
- **Effort:** small.

### W4. The overdue chip reads "! 4 overdue" or "Nothing overdue"
- **Source:** Dom's brief, change 6, and Dom, round 2.
- **New app:** no. There is no per-job overdue count on job rows (see D10). Waiting on shows an "Overdue" group count.
- **Conflict with SPEC:** none for the words.
- **Effort:** small (comes with D10).

### W5. How "last confirmed" is worded
- **What:** v1 went from an amber "! Last confirmed 9 days ago" chip to plain "Confirmed 8 days ago" text, then removed it from the cards altogether (D9).
- **Source:** design passes, then Dom's brief, change 6.
- **New app:** partly. It has its own wording: "Not confirmed for 9 days" in amber, otherwise "Last confirmed 2 days ago".
- **Conflict with SPEC:** the colourless version conflicts with SPEC rule 7 (amber); the words themselves don't.
- **Effort:** small.

### W6. "Ordered or booked needs an expected date."
- **What:** the one-line refusal shown when someone marked an item booked with no date.
- **Source:** Dom, round 2 (commit d51e95a).
- **New app:** no (see D15). The words would become the bot's question.
- **Conflict with SPEC:** none.
- **Effort:** small (comes with D15).

### W7. Short dates with the weekday ("Mon 28 Sep"), the year only when it isn't this year
- **Source:** the original build.
- **New app:** yes (core `formatDate`).
- **Conflict with SPEC:** none. SPEC uses the same form.
- **Effort:** none.

---

## Counts

| Group | Items | New app has it | Partly | No |
|---|---|---|---|---|
| Dom's requests | 19 | 1 | 8 | 10 |
| Layout and navigation | 14 | 2 | 4 | 8 |
| Visual style | 10 | 0 | 2 | 8 |
| Wording | 7 | 1 | 3 | 3 |
| **Total** | **50** | **4** | **17** | **29** |

## Can be ported with no conflict

These fit `SPEC.md` as written. Each one adds to the new app without taking away any
numbers or giving the web any editing.

1. **D5** Shipments tab inside each job (small).
2. **D4 + D18** Job dropdown on desktop too, and the rail's job list dropped (small).
3. **D7** Stage progress bar on Monday, Jobs and the job overview, beside the numbers (small to medium).
4. **D13 + W2** Relative time on every date, with consistent overdue / late / ago wording (small to medium).
5. **D15 + W6** The bot asks for an expected date before marking an item booked (small).
6. **D16** Late-but-not-overdue shown in plain words, with the warning colour kept for overdue (small).
7. **D10 + W4** "4 overdue" count on each job row, in hi-vis plus words, not red (small).
8. **D14, the additions only** Add "Trades on this week" and an overdue list to the job overview, keeping the forecast hero (medium).
9. **L5** "Later" folded by default in Waiting on (small).
10. **L4** To chase owner chips turned into a dropdown (small).
11. **L13** Phone numbers as big tap buttons that don't wrap (small).
12. **W1** Copy rules and a trimming sweep (small).
13. **V9, the behaviours only** Shrinking phone tab bar and a custom job menu, without the glass finish (medium each).
14. **V4** The "Cruise" name and logo, if the owner wants the name (small).

## Conflicts that need the owner's decision

1. **Numbers versus "timing only"** (D1, D2, D9, D14). In v1, Dom's feedback took forecast finish, slip, money and "Why it moved" off every screen. SPEC makes them the centre of the Monday screen and the bot's confirm card. Which wins?
2. **Apple / Liquid Glass versus site materials** (V5 to V8, V1). v1 ended on Apple's look: system font, grey iOS surfaces, a darker orange, frosted glass. SPEC asks for concrete, steel and timber with hi-vis orange.
3. **Amber** (D11, W5). Dom asked for no amber warnings at all. SPEC rule 7 and the bot's reminders turn a job amber after 7 days unconfirmed.
4. **Red for overdue** (D10, V10). Dom asked for a red marker. SPEC allows one accent colour (hi-vis). Use red, or show overdue in hi-vis plus words?
5. **One Waiting on list and a two-tab bar** (D17, D6). Dom asked for one simple list and a bottom bar of Overview and Waiting on. SPEC keeps To chase, Shipments and Changes as their own screens.
6. **Dropped on purpose** (L1, L2, L8 to L11, L14, D19). v1's people, roles, sign-in, upload, notifications and editing screens clash with SPEC's one user and read-only web. No action unless the owner wants any of them back.
7. **Small naming calls**: "Pending approval" instead of "With council" (W3), and the "Cruise" name (V4).
