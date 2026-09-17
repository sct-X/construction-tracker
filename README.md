# Construction Tracker prototype

A clickable front end for a small builder-developer's job tracker: forecast finish dates, the waiting-on list, site photos by stage, and the Monday screen. Static, mock data, no server. Read SPEC.md first, then docs/UI_PLAN.md.

## Running it

```
npm install
npx playwright install chromium   # once, for the flow specs
npm run dev                       # http://localhost:5173/construction-tracker/
```

Scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm test` | Vitest unit tests (the calculator against SPEC.md's numbers, the data layer, money stripping) |
| `npm run build` | `tsc -b && vite build` into `dist/` |
| `npm run preview` | Serves `dist/` at http://localhost:4173/construction-tracker/ |
| `npx playwright test` | Flow specs in `e2e/` against the built app, on a 390x844 phone and a 1280x800 desktop |

CI (`.github/workflows/deploy.yml`) runs `npm test` and `npm run build` on every push to main and deploys `dist/` to GitHub Pages. Playwright runs locally only.

## The dev bar

There is no login. The dark strip at the top sets who you are and what day it is:

- **As**: Dominic (admin), Dom and Norm (partners), Raff (builder), Alec (site). Alec's data never contains a price.
- **Side**: shown to Dominic and Norm only. "Norm and Dom" has all the jobs; "Norm" is empty.
- **Today is**: default Thu 17 Sep 2026. Every date, slip and reminder is relative to this.
- **Offline**: turns the signal off. Photos and notes queue; date changes need signal.
- **Fire reminders due today**: stands in for the server's scheduler and raises notifications for the chosen day.
- **Reset data**: wipes local storage and the photo queue and reseeds.

The same controls work from the URL: `#/monday?as=alec&today=2026-09-17&offline=1`.

Data lives in your browser (localStorage plus IndexedDB for the photo queue). Nothing is shared between people or devices in this prototype.

## Layout

- `src/domain/`: types, dates, money, the forecast calculator (pure) and its tests.
- `src/seed/`: the mock data (Park Rd in full, Seaview and Beatty at stage level, four design jobs, a duplex template).
- `src/data/`: the `TrackerApi` interface, the mock implementation, session, photo queue, React hooks.
- `src/screens/`: one folder per screen; README.md lists all 22 with their routes.
- `docs/CONTRACTS.md`: how screens call the API, the forecast shape, money and date rules, test ids, tokens.

## Click-through script

Five flows from docs/UI_PLAN.md section 4, filled in as each stage lands.

### a. Dom and Norm open the Monday screen

(Stage 1)

### b. Alec uploads photos and reception drops halfway

(Stage 3)

### c. Dominic rings Raff and works through the call list

(Stage 4)

### d. Changing the windows shipment ETA moves Park Rd's finish

(Stage 2)

### e. Raff tries to tick off a hold point with photos missing

(Stage 5)
