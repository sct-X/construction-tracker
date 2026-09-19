# Construction Tracker prototype

A clickable front end for a small builder-developer's job tracker: forecast finish dates, the waiting-on list, site photos by stage, and the Monday screen. Static, mock data, no server. Read SPEC.md first, then docs/UI_PLAN.md.

Live: https://sct-x.github.io/construction-tracker/ (every push to main deploys it). Locally it runs at http://localhost:5173/construction-tracker/ with `npm run dev`, or http://localhost:4173/construction-tracker/ with `npm run preview` after a build.

## Running it

```
npm install
npx playwright install chromium   # once, for the flow specs
npm run dev                       # http://localhost:5173/construction-tracker/
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm test` | Vitest unit tests: the calculator against SPEC.md's numbers, the seed, the data layer, money stripping, the photo queue |
| `npm run build` | `tsc -b && vite build` into `dist/` (type-checks the app and the specs) |
| `npm run preview` | Serves `dist/` at http://localhost:4173/construction-tracker/ |
| `npx playwright test` | The flow specs in `e2e/` against the built app (it starts `vite preview` itself), on a 390x844 phone project and a 1280x800 desktop project |

Run `npm run build` before Playwright: the specs test `dist/`, not the dev server. To run two Playwright sessions side by side, give each its own port and output folder: `PW_PORT=4212 PW_OUT=/tmp/pw-mine npx playwright test`. A single spec: `npx playwright test e2e/flow-d-eta-moves-finish.spec.ts --project=desktop`.

CI (`.github/workflows/deploy.yml`) runs `npm test` and `npm run build` on every push to main and deploys `dist/` to GitHub Pages. Playwright runs locally only.

## Roles and sides

There is no login. Five people cover the four roles (the four real ones with placeholder contact details, and Alec, a stand-in site person); every row of data belongs to one of two sides.

| Person | Role | Home screen | Sees |
| --- | --- | --- | --- |
| Dominic | admin | Monday | everything, plus Setup (templates, trades, people) |
| Dom, Norm | partner | Monday | everything but People; Norm also belongs to the second side |
| Raff | builder | My items (`#/waiting?owner=me`) | jobs, items, calls' data, shipments, photos, notes; no setup |
| Alec | site | Today for the last build job he opened | build jobs only, photos, deliveries, notes; his data never contains a price |

Sides: "Norm and Dom" has all the jobs; "Norm" is empty (it exists to prove nothing leaks across). Only Dominic and Norm get the side switcher.

## The dev bar

The dark strip at the top stands in for sign-in and for the server's clock and scheduler.

- **As**: who you are (Dominic, Dom, Norm, Raff, Alec). Switching person keeps the data and the date.
- **Side**: shown to Dominic and Norm only. Every screen shows one side at a time.
- **Today is**: default Thu 17 Sep 2026. Every date, slip, freshness word and reminder is relative to this. Change it to move the calendar, for example to 28 Sep 2026 for the hold-point flow.
- **Offline**: turns the signal off. A thin amber bar appears under the header; photos, notes and status ticks queue on the phone, anything that changes a date goes grey with "Needs signal".
- **Fire reminders due today**: stands in for the server's scheduler. Raises the day's notifications (act-by today, overdue, hold point a week away, job unconfirmed 7 days) to the people who own them; a banner buzzes for the person you are. Firing twice raises nothing new.
- **Reset**: wipes the local data and the photo queue, reseeds, and puts today back to 17 Sep 2026 with offline off. You stay who you were.

The same controls work from the URL, on any route, so a link can set the scene: `#/monday?as=dom&today=2026-09-17`, `#/steps/sv-slab-insp?as=raff&today=2026-09-28`, `#/jobs/park-rd/upload?as=alec&offline=1`, `#/monday?as=norm&side=side-norm`. The Playwright specs drive the app this way.

## What's fake

There is no backend: `src/data/mockApi.ts` holds the seed in your browser (localStorage for records, IndexedDB for the photo queue) behind the same `TrackerApi` interface a server would sit behind, so nothing is shared between people, devices or browsers, and a private window starts from the seed. Push notifications are an in-app banner and a bell count, not a real push; "install to home screen" and the offline shell are real (a web app manifest and a service worker), but "offline" for the data is the dev bar's toggle, not the network. Photos you upload are downscaled and kept in your browser, and the seeded photos are generated placeholders.

## What's real

The seven jobs are Cerr Build's real ones, taken from the job folders: the addresses, the approval paths and their milestones, the consultants and trades on each job, the suppliers (HiHaus windows, Wooden Age Joinery, CJ Linea and the rest), and the stage each is at. Nothing else from the folders is in. What is still made up: the program dates and durations (SPEC "Mock data" fixes them), the weekly holding costs, every phone number (the trades carry ACMA fictitious numbers, 0491 570 006 to 0491 579 858, which never connect) and every email address. No contract sums, claims, fees or bank details are in the app.

## Layout

- `src/domain/`: types, dates, money, the forecast calculator (pure) and its tests.
- `src/seed/`: the mock data (Park Rd in full, Seaview and Beatty at stage level, four design jobs, a duplex template).
- `src/data/`: the `TrackerApi` interface, the mock implementation, session, photo queue, React hooks.
- `src/screens/`: one file per screen; `src/screens/README.md` lists all 22 with their routes.
- `docs/CONTRACTS.md`: how screens call the API, the forecast shape, money and date rules, test ids, tokens.
- `e2e/`: the five flow specs plus one per stage, and `no-money-for-site.spec.ts`, which visits every route as Alec.

## Click-through script

The five flows from docs/UI_PLAN.md section 4, against the live app or localhost. Each starts from a fresh Reset with today Thu 17 Sep 2026 unless it says otherwise. The words and numbers are what the seed produces; the flow specs in `e2e/` assert the same ones.

### a. Dom and Norm open the Monday screen

1. Open `#/monday?as=dom&today=2026-09-17` (or set As: Dom in the dev bar; a partner lands on Monday).
2. The header reads "Week of Mon 14 Sep. Compared with Monday's forecast."
3. Beatty St is the top build row because it cost the most this week: Fri 4 Dec 2026, +5 days, $1,430, and an amber "! Last confirmed 9 days ago". Park Rd reads Fri 26 Feb 2027, slip 0 ("Nothing moved"), $4,500/wk, "Last confirmed 2 days ago"; Seaview St Fri 29 Oct 2027, slip 0.
4. Park Rd's waiting-on cell lists three items; the tile choice decision says "With you" because Dom owns it. Beatty's tiler reads "expected 5 Oct, 7 days late".
5. Click Beatty's "+5 days". "Why it moved" opens as a numbered chain: "Book tiler expected 5 Oct, needed 28 Sep", "Tiling, whole stage starts 5 Oct, not 28 Sep (+7 days)", and last "Finish 4 Dec, 5 days later than Monday's snapshot (29 Nov)". Every line links to the item, step or program.
6. Back on Monday, "since the original plan" changes Beatty to +7 days, $2,000 and the header to "Compared with the original plan."; "since Monday" puts it back.
7. Click the "Tile choice" item in Park Rd's cell, set its status to Done on the item sheet, Save. Back on Monday the cell has moved on to the next item.
8. The four design jobs sit below with a stage and a count instead of dates: "West St. With council. 2 outstanding, oldest 23 days"; Tollbar "1 outstanding, 8 days"; Lower Beach "Nothing outstanding"; John St "1 outstanding, 4 days".
9. Switch As: Norm. Same screen, plus the side switcher in the header. Pick "Norm": "No jobs on this side yet."
10. Switch As: Alec and type `#/monday`: "You don't have access to this". The site role never sees the Monday screen or a price.

For the flow-d numbers on Monday (Park Rd Fri 12 Mar 2027, +14 days, $9,000), do flow d first.

### b. Alec uploads photos and reception drops halfway

Best on a phone or the 390px phone project; the desktop app centres the phone layout for Alec.

1. Open `#/jobs/park-rd?as=alec&today=2026-09-17`. Today shows "Thursday 17 September", "Lock-up stage", a full-width "Add photos" button and this week's steps and deliveries. No price anywhere on any of Alec's screens.
2. Tap "Add photos". Stage is already Lock-up (marked "now"); the categories are tall buttons with counts: "Windows installed, none yet", "External cladding", "Brickwork", then General. No dropdowns.
3. Tap "Windows installed", then "Choose from camera roll" and pick three photos (any images). Three thumbnails appear; the button reads "Upload 3 photos". Remove one with its x and the button follows: "Upload 2 photos". Add it back.
4. Tick Offline in the dev bar. The thin amber bar appears: "No signal. Showing what loaded at ...".
5. Tap "Upload 3 photos". No error, no red: a timber note with a clock says "No signal: 3 photos saved on this phone, they'll send when you're back in range." The strip under the header reads "3 photos waiting to send" and the category button says "3 waiting to send".
6. Reload the page. Still offline, still "3 photos waiting to send": the queue is in IndexedDB, not in memory.
7. Tap the strip. The upload queue lists the three under "64-66 Park Rd, Lock-up: Windows installed", each "Waiting" with a clock, "Send now" greyed with "No signal", and the sentence about keeping the app open on an iPhone.
8. Untick Offline. Without a tap the three send one at a time, the list reads "Everything's uploaded." and the strip disappears.
9. Open the job's Photos tab: "Windows installed" now holds 3 photos, each landed once. Reset.

### c. Dominic rings Raff and works through the call list

1. Open `#/calls?as=dominic&today=2026-09-17`. The list is set to Raff: "11 items across 3 jobs to chase with Raff" (the fortnight's cut: to do or booked, act-by within 14 days or past). The other people's buttons show their counts.
2. Jobs are grouped, most urgent question first. Seaview St leads with "Book concrete pump", act by Fri 18 Sep ("act by, tomorrow"), "For Pour ground floor slab, Fri 2 Oct", "Waiting on IR Formwork Constructions" with a tap-to-call number. Each job header carries its freshness words and finish: Beatty "unconfirmed 9 days", "Finish Fri 4 Dec 2026, 7 days late".
3. Raff says the pump is booked. Click "Mark booked" (or press B with the row marked). The row folds into Seaview's "Done this call" strip as "booked", with "Back on the list" to undo.
4. Park Rd, "Book plasterer": click "Mark booked", then "Back on the list", and the button now says "Mark confirmed". Click it, enter 2026-09-23, confirm. The strip reads "confirmed for Wed 23 Sep".
5. Beatty St, "Book tiler": open "Date, note, skip" on the phone (the desktop shows the date inline) and set the expected date to 2026-10-12. The row folds as "expected moved to Mon 12 Oct" and a line appears under the job: "Beatty St finish moves +7 days, $2,000, now Fri 11 Dec".
6. Type a note on "Order tiles" ("Raff to order Monday", Enter): it is kept on the item. Skip Seaview's slab inspection: "skipped, stays for next call".
7. Click "Finish call". The panel lists the three jobs with a "Confirmed today" tick each, the touched ones pre-ticked with their counts ("2 items updated" on Beatty). Confirm.
8. The summary reads "Call with Raff finished" with one line per job. On Monday and the jobs list every one of the three now reads "Last confirmed today"; Beatty's amber is gone. Reset.

### d. Changing the windows shipment ETA moves Park Rd's finish

1. Open `#/shipments?as=dominic&today=2026-09-17`. "Park Rd windows" reads In production, ETA 26 Oct 2026, 3 items, "ETA 1 week before needed". Click the row.
2. The shipment's hero is "Mon 26 Oct 2026", status buttons with In production pressed, "Needed by Mon 2 Nov", three linked items each expected Mon 26 Oct.
3. Change the ETA input to 2026-11-16. Before anything is saved, the impact panel appears on timber paper: "3 linked items would be expected Mon 16 Nov", "Install windows would start Mon 16 Nov, not Mon 2 Nov, and 11 steps after it move with it", then "64-66 Park Rd finish Fri 12 Mar 2027, +14 days, $9,000, was Fri 26 Feb". The hero still says 26 Oct.
4. Click "Save new ETA". The hero reads Mon 16 Nov 2026, the timing "ETA 2 weeks after needed", every linked item "Mon 16 Nov" and "14 days late". History's top line: "Park Rd windows ETA changed 26 Oct to 16 Nov (Dominic)".
5. Open Park Rd's Program. The Install windows bar and everything after it sit two weeks right of their timber planned outlines, each with "! 14 days late" in words.
6. Open Monday: Park Rd reads Fri 12 Mar 2027, +14 days, $9,000, and is now the top row. Click "+14 days": "Why it moved" names the ETA change first, then "Install windows starts 16 Nov, not 2 Nov (+14 days)", and links to the shipment.
7. Switch As: Raff. His bell count has gone up and the notification reads "Park Rd windows now expected 16 Nov. 2 of your items moved." (raised the moment the ETA was saved; the in-app banner is the stand-in for the phone buzz). Reset.

### e. Raff tries to tick off a hold point with photos missing

This flow needs today on or after Mon 28 Sep 2026, the day of the inspection; a step cannot be ticked off before it starts.

1. Open `#/steps/sv-slab-insp?as=raff&today=2026-09-28` (Seaview St, Program, "Slab inspection before pour", marked hold point). Reset first, then reload so the URL's date applies again.
2. The step lists its required photo sets with "1 of 3 required photo sets uploaded": "Steel reinforcement in place: 4 photos", "Plumbing under slab: none yet", "Membrane and termite barrier: none yet".
3. Click "Mark done". It is live, not greyed, and refuses in words: "Can't tick this off yet. The certifier needs before-cover photos and 2 categories are empty: Plumbing under slab; Membrane and termite barrier." The status stays "Not started". No dialog, no red.
4. Each empty set has its own "Add photos". Click the one on "Plumbing under slab": the upload screen opens with job, stage and category already set. Upload one photo and click Done, which returns to the step.
5. "2 of 3 required photo sets uploaded". Click "Mark done" again: refused, naming only "Membrane and termite barrier". Add a photo to that set the same way.
6. "3 of 3 required photo sets uploaded. Every required set has a photo. You can tick this off." Click "Mark done": the status reads Done, and the Seaview overview's next hold point says "No hold points left".
7. Variation: Reset, reload, tick Offline, use "Add photos" on Plumbing under slab and upload two. The row says "2 waiting to send, they don't count yet", the block says "2 photos are waiting to upload. You can tick this off once they've sent.", and Mark done is disabled with "Needs signal". Untick Offline: the row moves to "2 photos" and the count to 2 of 3. Reset.

### Also worth a look

- Templates and new job (`#/templates` as Dominic): the duplex template as its stage sequence, "8 stages, 29 steps, 25 needs, 13 photo sets"; New job from it starting Mon 5 Oct 2026 shows "Planned finish Fri 4 Jun 2027" before Create, and the new job lands on Monday with "Slip appears after the first Monday".
- Daily notes (`#/jobs/park-rd/notes` as Alec): a week of diary entries with weather and who was on site; a note saved offline carries a clock until signal returns.
- Design checklist (`#/jobs/west-st` as Dominic): stages as a ladder with the outstanding items under the current one.
