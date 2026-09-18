# Construction Tracker prototype: SPEC

Every subagent reads this file and PROGRESS.md first, then docs/UI_PLAN.md (the screen spec, pass criteria, flows and wireframes). docs/BUILD_PLAN.md is background. Screen subagents also read DESIGN.md, docs/COPY_RULES.md, docs/SKILL_tracker-ui-design.md and docs/SKILL_no-vibecoded-design.md before writing UI. The Monday screen (`src/screens/Monday.tsx`, `monday.css`) is the reference screen for the dark world.

These decisions are locked. Do not revisit them. If something here conflicts with docs/UI_PLAN.md, this file wins.

## Stack (locked)

- Vite + React + TypeScript. Hash-based routing (GitHub Pages serves from a sub-path and doesn't rewrite URLs). Vitest for unit tests. Playwright for the five flows.
- No backend. Web app manifest with `display: standalone` and a service worker so it installs to a phone home screen and opens offline.
- Vite `base` is `/construction-tracker/`. A `noindex` meta tag on the page.
- One data layer: every screen reads and writes through a single API interface (`src/data/api.ts`). The prototype implementation is a mock holding seed data in the browser, persisted locally (localStorage for records, IndexedDB for the photo queue), with a reset. The real server swaps in behind the same interface later.
- The forecast calculator (`src/domain/forecast.ts`) is a pure function: data in, dates out, no UI imports, no data-layer imports. It moves to the server unchanged.
- The data layer strips every money field for the site role, so Alec's data never contains a price. Never hide money with CSS.

## Roles and people (locked)

- admin: Dominic. partner: Dom, Norm. builder: Raff. site: Alec.
- No login. A dev bar replaces it: person switcher, a "today is" date (default Thu 17 Sep 2026), an offline toggle, reset, and "fire reminders due today".
- Two sides from day one: "Norm and Dom" and "Norm". Every row carries a side. Only Dominic and Norm get the side switcher. The Norm side is empty.

## Data model (locked)

side; person; membership (role on a side); job (side, kind build|design, path DA|CDC, weekly holding cost, last confirmed date, is_template); stage (order, status); step (duration in working days, planned start/end, forecast start/end, status, is_hold_point); step_link (this step waits for that step); requirement (trade or material, lead time); item (type: trade to book, material to order, decision, consultant report, council request, inspection, defect, condition of consent, manual reminder; title, waiting on, owner, needed-by, lead time, act-by, expected date, status: to do | ordered or booked | confirmed | done; confirmed date; optional links to step, requirement, shipment, photo); trade (per side: name, type, phone); shipment (status: design | in production | shipped | delivered; ETA; linked items take their expected date from the ETA); photo_category (per stage, "required for hold point" flag); photo; daily_note; forecast_snapshot (saved each Monday); activity log; notifications.

Accepted additions from the UI Plan's model gaps: item.job (required), job.planned_finish, job.start_date, job.starts_from_stage, one placeholder step per stage for stage-level jobs, a job-wide "General" photo category, a push_subscription table, item.notes.

## Rules (locked)

1. Item needed-by = its step's forecast start, calculated WITHOUT that item's own expected date (otherwise a late item stops looking late). Act-by = needed-by minus lead time.
2. Step forecast start = latest of planned start, the finish of every step it waits for, and the expected date of every item it needs.
3. Job forecast finish = latest forecast end of any step. Planned dates never change; late means forecast vs planned.
4. Slip = today's forecast finish minus last Monday's snapshot, in calendar days. Slip cost = slip / 7 x weekly holding cost, rounded to the nearest $10.
5. Working days are Mon to Fri, minus a shutdown list (21 Dec 2026 to 8 Jan 2027). Lead times are calendar weeks. Public holidays other than the shutdown are out of scope for the prototype.
6. A hold-point step can't be marked done until every required photo category has at least one uploaded (not queued) photo. The refusal names the empty categories.
7. A job goes amber after 7 days unconfirmed.
8. Templates are jobs with is_template and no dates; copying one copies stages, steps, links, requirements and photo categories.
9. Design jobs have stages as a checklist, no steps, no Gantt.

## Mock data (the unit tests assert these exact numbers)

- Park Rd, full program, $4,500/wk. "Install windows" planned start Mon 2 Nov 2026, windows lead time 12 weeks, so act-by Mon 10 Aug 2026. Windows shipment seeded at ETA 26 Oct 2026, in production, 3 linked items, 2 owned by Raff. Forecast finish Fri 26 Feb 2027, equal to the Mon 14 Sep 2026 snapshot. Changing the ETA to 16 Nov 2026 must give: Install windows starts 16 Nov, finish Fri 12 Mar 2027, slip +14 days, $9,000. Tune step durations in the mock data until this holds. Never tune the calculator to fit.
- Seaview St, stage level, $3,800/wk, finish Fri 29 Oct 2027 (SPEC's 30 Oct is a Saturday; see PROGRESS), slip 0, confirmed 1 day ago, "Book concrete pump" act-by Fri 18 Sep 2026, slab inspection hold point 28 Sep 2026 with 1 of 3 required photo categories filled.
- Beatty St, stage level, $2,000/wk, finish 4 Dec 2026, slip +5 days, $1,430, tiler expected 5 Oct 2026, last confirmed 9 days ago (amber).
- Design: West St (with council, 2 outstanding, oldest 23 days), Tollbar Ave (with council, 1, 8 days), Lower Beach St (design, 0), John St (design, 1, 4 days).
- About 30 items on Park Rd across every item type, a duplex template, trades with phone numbers, a week of daily notes, some placeholder photos (generated SVG/canvas, no stock imagery).
- Use the brief's real job names above. All data is invented.

## Scope: six stages, 22 screens (docs/UI_PLAN.md section 6 is the build order)

0. types, seed data, calculator, unit tests, data layer, dev bar
1. shell with per-role navigation, jobs list, Monday screen, "Why it moved"
2. shipments with the ETA impact preview, desktop Gantt with planned outlines, phone look-ahead and stages strip, step detail, build job overview
3. photo upload with an IndexedDB queue that survives the offline toggle and a reload, upload queue, gallery, Alec's Today
4. waiting-on list, item sheet with add and edit, call list with Finish call
5. hold-point check, daily notes, design checklist, notifications and activity, with an in-app stand-in for the phone buzz
6. program editor, templates and new job, trades, people and roles, my settings

Version two (quotes, invoices, documents) is out of scope; don't block it.

## Design (locked)

- Light theme by default, dark available. The world is "the surveyor's readout" (DESIGN.md): a tonal ladder (light: well #e8e5df, ground #f4f2ee, plate #fbfaf8, raised #ffffff; dark alternate: #0f1113 / #131517 / #1a1d20 / #212529; never pure white for the page, never #000), regions separated by tone rather than borders, one token set in `src/styles/tokens.css` with the same role names in both themes. The shell sets `data-theme` on `<html>` from the session (`theme: light | dark | system`, chosen in My settings; `?theme=` in the hash for tests). Screens use roles and never branch on the theme.
- Hi-vis orange (#e8730c, the vest; #ff8c26 in dark) is the single accent: the one primary action on a screen, the focus ring, the today line on the program, the chosen picker row. Never a heading, never "you are here", never a status.
- Type: Barlow Semi Condensed (600/700, tabular figures) for every figure and title; Atkinson Hyperlegible Next (variable) for words. Self-hosted latin WOFF2 in `public/fonts` (68 KB), `font-display: swap`, precached by the service worker. No Inter, Geist, Space Grotesk or Roboto.
- Numbers are the largest type on partner screens; a page title is never larger than the figures beneath it.
- Colour never carries meaning alone: "14 days late", not just red. Late and amber words carry a leading "!".
- Less writing: labels are one or two words, no explanatory paragraphs, no sentence that restates what the UI shows (docs/COPY_RULES.md). Rule-bearing words (late, unconfirmed, needed-by, act-by, expected, on plan) and every e2e-asserted phrase stay.
- Tap targets at least 56px on Alec's screens; category pickers are buttons, never dropdowns.
- Offline is a thin calm bar.
- Desktop tables, phone cards (plates), one token set. Phone breakpoint: below 768px.
- No stock imagery, no gradient cards, no all-caps eyebrow labels, no shadow on anything that does not float.
- The money component renders nothing (label included) when the field is absent; never hidden with CSS.
- The dev bar is a quiet collapsible strip, never three rows on a phone.

## Testing (locked)

- `npm test` runs Vitest. `npm run build` runs tsc + vite build. `npx playwright test` runs the flow specs against the built app (`vite preview`).
- Playwright specs: `e2e/flow-a-monday.spec.ts`, `e2e/flow-b-photos-offline.spec.ts`, `e2e/flow-c-call-list.spec.ts`, `e2e/flow-d-eta-moves-finish.spec.ts`, `e2e/flow-e-hold-point.spec.ts`, `e2e/no-money-for-site.spec.ts` (visits every screen as Alec and asserts no "$" in the page text).
- The dev bar is driven in tests through the URL: `#/...?as=alec&today=2026-09-17` sets the person and date; plus `data-testid` hooks on dev bar controls.

## GitHub

- Repo `construction-tracker` on the signed-in account (`sct-X`). GitHub Actions workflow tests, builds and deploys to Pages on every push to main. Commit per stage.
- README covers running it, the dev bar, and a click-through script for the five flows.

## How subagents work here

- Read SPEC.md, PROGRESS.md, docs/UI_PLAN.md (at least the screens you own, section 4 flows, section 5 wireframes) before writing.
- Own only the files named in your task. Shared files (`src/data/api.ts`, `src/domain/*`, `src/seed/*`, `src/styles/tokens.css`, `src/App.tsx`, routes) are edited only when your task says so; otherwise report the need.
- Log every decision you make in PROGRESS.md under "Decisions", one line each.
- Final report to the orchestrator: 10 lines or fewer.
