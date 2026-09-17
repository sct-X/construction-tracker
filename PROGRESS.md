# PROGRESS

## Stage checklist

- [x] Stage 0: types, seed data, calculator, unit tests, data layer, dev bar. Built, awaiting review. Reviewer sign-off: pending
- [ ] Stage 1: shell, per-role nav, jobs list, Monday screen, Why it moved. Reviewer sign-off: pending
- [ ] Stage 2: shipments + ETA impact preview, Gantt, look-ahead, step detail, build job overview. Reviewer sign-off: pending
- [ ] Stage 3: photo upload + IndexedDB queue, upload queue, gallery, Alec's Today. Reviewer sign-off: pending
- [ ] Stage 4: waiting-on list, item sheet, call list. Reviewer sign-off: pending
- [ ] Stage 5: hold-point check, daily notes, design checklist, notifications + activity. Reviewer sign-off: pending
- [ ] Stage 6: program editor, templates + new job, trades, people + roles, my settings. Reviewer sign-off: pending
- [ ] Deployed to GitHub Pages, live URL confirmed

## Decisions

- 2026-09-18 Orchestrator: repo created private first; flipped to public only if Pages refuses to enable on the free plan (data is invented).
- 2026-09-18 Orchestrator: phone breakpoint 768px; tests drive the dev bar via URL params `as` and `today`.
- 2026-09-18 Stage 0: libraries: react-router-dom 6 (HashRouter), vitest 2, @playwright/test 1.63, no UI kit, no icon library, no web fonts (system stack for UI, a condensed system face for hero numbers so the app works offline).
- 2026-09-18 Stage 0: the API (`src/data/api.ts`) is synchronous over a local copy of the data and returns copies; `subscribe` fires on every change. A server adapter keeps the copy warm and refreshes quietly, which is the UI Plan's loading rule. Photo queue methods are async (IndexedDB, hand-rolled, memory fallback in tests).
- 2026-09-18 Stage 0: money fields are named in `MONEY_FIELDS` (`weeklyHoldingCost`, `slipCost`, `slipSincePlanCost`, `costDelta`, `slipCostAfter`); every read for the site role is deep-copied with those keys deleted. Alec's `listJobs` returns builds only and `listItems` returns material items only.
- 2026-09-18 Stage 0: step end is inclusive (`start + duration - 1` working days); a successor starts the next working day; an item's expected date snaps forward to a working day before it can start a step. Done steps use actual dates when recorded, else planned. Nothing is clamped to today.
- 2026-09-18 Stage 0: rule 1 reads "without that item's own expected date" as also excluding items on the same shipment, otherwise the three windows items would hide each other's lateness. Flow d needs all three to read "14 days late".
- 2026-09-18 Stage 0: freshness is amber when days unconfirmed > 7 (8 or more); a job never confirmed is amber with "Never confirmed".
- 2026-09-18 Stage 0: last Monday's snapshot is the one dated `lastMonday(today)`, falling back to the latest snapshot on or before today; slip is undefined with no snapshot. Snapshots saved by the app also carry per-step starts and ends so "why it moved" can compare against last Monday; seeded Seaview and Beatty snapshots carry only the finish, so their explanation runs against the plan.
- 2026-09-18 Stage 0: Park Rd durations (working days): site setup 5, excavation 10, under-slab plumbing 5, formwork 5, slab inspection 1, pour 1, frame 15, frame inspection 1, trusses 5, roof cover 10, fascia 10, brickwork 7, roof plumbing 4 (in progress from 14 Sep), cladding 15 (from 16 Sep), install windows 10 (2 Nov), external doors 5, stormwater 15 (21 Sep), stormwater inspection 1, landscaping 10 (8 Feb 2027), rough-in 10, insulation 4, plasterboard 8 (11 Dec, crosses the shutdown), waterproofing 3, tiling 10, kitchen 10, painting 5, fit-off 3, final inspection 1, handover 1 (Fri 26 Feb 2027). The chain from Install windows to Handover has zero slack so 16 Nov gives 12 Mar exactly.
- 2026-09-18 Stage 0: Seaview's Slab stage has three steps (prep, "Slab inspection before pour" hold point Mon 28 Sep, "Pour ground floor slab" Fri 2 Oct) rather than one placeholder, because flow e needs the hold point and "Book concrete pump" needs a Friday needed-by for a 2-week lead to land on Fri 18 Sep. Flow c's "for: Pour ground floor slab, 28 Sep" therefore reads 2 Oct; 28 Sep is the inspection.
- 2026-09-18 Stage 0: Seaview placeholder durations 15/40/15/30/135/40/5 land Handover on Fri 29 Oct 2027 (see open problems).
- 2026-09-18 Stage 0: Beatty placeholder durations 10/15/15/10/30/5 give planned finish Fri 27 Nov; the tiler expected Mon 5 Oct moves it to Fri 4 Dec. The 14 Sep snapshot is seeded at Sun 29 Nov so slip reads exactly +5 days, $1,430 (see open problems).
- 2026-09-18 Stage 0: design jobs use typed `neededBy`; "oldest N days" is days since `item.createdAt`. West St items created 25 Aug and 3 Sep, Tollbar 9 Sep, John St 13 Sep.
- 2026-09-18 Stage 0: `copyTemplate` copies stages, steps, links, requirements and photo categories; stages before "starts from" are done with planned start = end = the working day before the start date; the rest run forward from the start date through the links. Template stage statuses are reset to not started.
- 2026-09-18 Stage 0: Park Rd "Windows installed" category is not flagged required because Lock-up has no hold point; Slab, Frame, External works and Handover categories are.
- 2026-09-18 Stage 0: `fireRemindersDueToday` raises act-by-today (owner, status to do), overdue (owner), and hold-point-a-week-away-with-photos-missing (builders and admins on the side), deduplicated per person, kind, item/step and day. ETA changes raise "X now expected D. N of your items moved." to each owner of a linked open item.
- 2026-09-18 Stage 0: Raff's call-list cut (act-by within 14 days or past, status to do or booked) is 9 items across 3 jobs in the seed, matching flow c.
- 2026-09-18 Stage 0: service worker parses the built index.html for `/assets/` URLs at install; navigation is network-first with the cached shell as fallback, hashed assets cache-first; registered only in production builds.
- 2026-09-18 Stage 0: Playwright "phone" project is Desktop Chrome at 390x844 with `isMobile` and touch (no WebKit download); CI does not run Playwright.

## Open problems

- SPEC says Seaview St finishes 30 Oct 2027, which is a Saturday. Steps end on working days, so the calculator lands on Fri 29 Oct 2027 and the unit test asserts that. Either accept 29 Oct in the spec and flow text, or say if a Saturday finish is really intended (that would need a calculator change, which Stage 0 did not make).
- SPEC's Beatty numbers (finish Fri 4 Dec, slip +5 days) force the 14 Sep snapshot to Sun 29 Nov. It is seeded that way; a snapshot the app saves always lands on a weekday. Beatty's "why it moved" therefore explains +7 days against the plan (27 Nov) while the slip figure is +5 against the snapshot.
- Flow c reads "Book concrete pump. Act by Fri 18 Sep. For: Pour ground floor slab, 28 Sep". With lead times in whole calendar weeks, a Monday needed-by cannot give a Friday act-by, so the pour is planned Fri 2 Oct and 28 Sep is the slab inspection. Stage 4 should word the row from the data.
- Public holidays (Australia Day 26 Jan 2027, Easter 2027) are not working-day exceptions; SPEC's calendar is weekdays minus the shutdown only.

## Reviewer sign-offs

(none yet)
