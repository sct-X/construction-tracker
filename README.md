# Construction Tracker prototype

A clickable front end for a small builder-developer's job tracker: where each job is, what comes next, the waiting-on list, and site photos by stage. No forecast finish, no slip, no money on any screen. Static, mock data, no server. Read SPEC.md first, then docs/UI_PLAN.md.

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

Sign-in is a name with no password: `#/sign-in` lists everyone, and My settings has Sign out, so any person's view is one pick away. Six people cover the four roles (the real ones with placeholder contact details, plus Alec, a stand-in site person); every row of data belongs to one of two sides.

| Person | Role | Home screen | Sees |
| --- | --- | --- | --- |
| Dominic | admin | Overview | everything, plus Setup (templates, trades, people); on both sides |
| Dom | partner | Overview | everything but People |
| Norm | partner | Overview | everything but People; on both sides |
| Raff | builder | My items (`#/waiting?owner=me`) | jobs, items, shipments, photos, notes; no setup, no Call mode |
| Alec | site | Today for the last build job he opened | build jobs only, photos, deliveries, notes |
| Pino | builder (Norm side) | My items | the Norm side's jobs and items |

| Side | Jobs | People |
| --- | --- | --- |
| Norm and Dom | the seven jobs | Dominic, Dom, Norm, Raff, Alec |
| Norm | Norm's Eastwood builds: 12 and 14 Hunts Ave, 232 North Rd | Dominic, Norm, Pino |

Only Dominic and Norm, who are on both sides, get the side switcher. Everyone else is on one side and never sees its name: to Dom the app is just the app.

## The dev bar

The dark strip at the top stands in for the server's clock and scheduler. It is hidden until the address carries `?dev=1` (or any of the params below), and then stays on for that browser.

- **As**: who you are (or "Signed out"). Switching person keeps the data and the date; sign-in proper is `#/sign-in`.
- **Side**: shown to Dominic and Norm only. Every screen shows one side at a time.
- **Today is**: default Thu 17 Sep 2026. Every date, freshness word and reminder is relative to this. Change it to move the calendar, for example to 28 Sep 2026 for the hold-point flow.
- **Offline**: turns the signal off. A thin amber bar appears under the header; photos, notes and status ticks queue on the phone, anything that changes a date goes grey with "Needs signal".
- **Fire reminders due today**: stands in for the server's scheduler. Raises the day's notifications (act-by today, overdue, hold point a week away, job unconfirmed 7 days) to the people who own them; a banner buzzes for the person you are. Firing twice raises nothing new.
- **Reset**: wipes the local data and the photo queue, reseeds, and puts today back to 17 Sep 2026 with offline off. You stay who you were.

The same controls work from the URL, on any route, so a link can set the scene: `#/overview?as=dom&today=2026-09-17`, `#/steps/sv-slab-insp?as=raff&today=2026-09-28`, `#/jobs/park-rd/upload?as=alec&offline=1`, `#/overview?as=norm&side=side-norm`. The Playwright specs drive the app this way. `#/monday`, `#/jobs` and `#/calls` forward to their new homes.

## What's fake

There is no backend: `src/data/mockApi.ts` holds the seed in your browser (localStorage for records, IndexedDB for the photo queue) behind the same `TrackerApi` interface a server would sit behind, so nothing is shared between people, devices or browsers, and a private window starts from the seed. Push notifications are an in-app banner and a bell count, not a real push; "install to home screen" and the offline shell are real (a web app manifest and a service worker), but "offline" for the data is the dev bar's toggle, not the network. Photos you upload are downscaled and kept in your browser, and the seeded photos are generated placeholders.

## What's real

The seven jobs are Cerr Build's real ones, taken from the job folders: the addresses, the approval paths and their milestones, the consultants and trades on each job, the suppliers (HiHaus windows, Wooden Age Joinery, CJ Linea and the rest), and the stage each is at. Nothing else from the folders is in. What is still made up: the program dates and durations (SPEC "Mock data" fixes them), every phone number (the trades carry ACMA fictitious numbers, 0491 570 006 to 0491 579 858, which never connect) and every email address. No contract sums, claims, fees or bank details are in the app.

## Layout

- `src/domain/`: types, dates, money, the forecast calculator (pure) and its tests.
- `src/seed/`: the mock data (Park Rd in full, Seaview and Beatty at stage level, four design jobs, a duplex template).
- `src/data/`: the `TrackerApi` interface, the mock implementation, session, photo queue, React hooks.
- `src/screens/`: one file per screen; `src/screens/README.md` lists all 22 with their routes.
- `docs/CONTRACTS.md`: how screens call the API, the forecast shape, money and date rules, test ids, tokens.
- `e2e/`: the five flow specs plus one per stage, and `no-money-for-site.spec.ts`, which visits every route as Alec.

## Click-through script

The five flows from docs/UI_PLAN.md section 4, against the live app or localhost. Each starts from a fresh Reset with today Thu 17 Sep 2026 unless it says otherwise. The words and numbers are what the seed produces; the flow specs in `e2e/` assert the same ones.

### a. Dom and Norm open the overview

1. Open `#/sign-in` and pick Domenic Morello (or `#/overview?as=dom&today=2026-09-17`); a partner lands on the overview. No side name anywhere: Dom is on one side and does not know it.
2. One row per build: name and stage on the left, then the next three steps with their dates (the running one marked), the top three waiting-on items, and the freshness words. Park Rd: Lock-up; "Roof plumbing, under way", "External cladding, Wed 16 Sep", "Stormwater drainage, Mon 21 Sep"; the tile choice says "With you" because Dom owns it; "Last confirmed 2 days ago".
3. Beatty St: Rough-in; "Book tiler expected 5 Oct, 7 days late" and an amber "! Last confirmed 9 days ago". Seaview St's next steps include "Slab inspection before pour, Mon 28 Sep, 2 photo sets empty".
4. Nothing on the page is a finish date, a slip or a dollar. A step opens its step detail, an item its sheet, the row its job.
5. The design jobs sit below with a stage, the stage after it and a count: "59-61 West St. Pending approval, DA. 2 outstanding, oldest 23 days"; Tollbar "1 outstanding, oldest 8 days"; Lower Beach "Nothing outstanding"; John St "1 outstanding, oldest 4 days".
6. Sign out from My settings and pick Norm Cerreto. Same screen, plus the side switcher: pick "Norm" and the three Eastwood builds appear with Pino's items; Park Rd is gone.
7. Alec gets the same overview with builds only and never a price.

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

### c. Dominic rings Raff and works through Waiting on in Call mode

1. Open `#/waiting?mode=call&as=dominic&today=2026-09-17` (the List | Call switch on Waiting on; admin and partners only). The Ringing dropdown is set to Raff: "11 items across 3 jobs to chase with Raff" (the fortnight's cut: to do or booked, act-by within 14 days or past); the other names carry their counts.
2. Jobs are grouped, most urgent question first. Seaview St leads with "Book concrete pump", act by Fri 18 Sep ("act by, tomorrow"), "For Pour ground floor slab, Fri 2 Oct", "Waiting on IR Formwork Constructions" with a tap-to-call number. Each job header carries its freshness words: Beatty "unconfirmed 9 days".
3. Raff says the pump is booked. Click "Mark booked" (or press B with the row marked). The row folds into Seaview's "Done this call" strip as "booked", with "Back on the list" to undo.
4. Park Rd, "Book plasterer": click "Mark booked", then "Back on the list", and the button now says "Mark confirmed". Click it, enter 2026-09-23, confirm. The strip reads "confirmed for Wed 23 Sep".
5. Beatty St, "Book tiler": open "Date, note, skip" on the phone (the desktop shows the date inline) and set the expected date to 2026-10-12. The row folds as "expected moved to Mon 12 Oct".
6. Type a note on "Order tiles" ("Raff to order Monday", Enter): it is kept on the item. Skip Seaview's slab inspection: "skipped, stays for next call".
7. Click "Finish call". The panel lists the three jobs with a "Confirmed today" tick each, the touched ones pre-ticked with their counts ("2 items updated" on Beatty). Confirm.
8. The summary reads "Call with Raff finished" with one line per job. On the overview every one of the three now reads "Last confirmed today"; Beatty's amber is gone. Reset.

### d. Changing the windows shipment ETA moves the steps after it

1. Open `#/shipments?as=dominic&today=2026-09-17`. "Park Rd windows" reads In production, ETA 26 Oct 2026, 3 items, "ETA 1 week before needed". Click the row.
2. The shipment's hero is "Mon 26 Oct 2026", status buttons with In production pressed, "Needed by Mon 2 Nov", three linked items each expected Mon 26 Oct.
3. Change the ETA input to 2026-11-16. Before anything is saved, the impact panel appears on timber paper: "3 linked items would be expected Mon 16 Nov", "Install windows would start Mon 16 Nov, not Mon 2 Nov, and 11 steps after it move with it". The hero still says 26 Oct.
4. Click "Save new ETA". The hero reads Mon 16 Nov 2026, the timing "ETA 2 weeks after needed", every linked item "Mon 16 Nov" and "14 days late". History's top line: "Park Rd windows ETA changed 26 Oct to 16 Nov (Dominic)".
5. Open Park Rd's Program. The Install windows bar and everything after it sit two weeks right of their timber planned outlines, each with "! 14 days late" in words.
6. Open the overview: Park Rd's waiting-on lines read "Windows expected 16 Nov, 14 days late". Open the Install windows step: "Starts 16 Nov, not 2 Nov, because the Park Rd windows shipment is expected 16 Nov."
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
