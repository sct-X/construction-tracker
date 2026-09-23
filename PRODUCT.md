# Product

<!-- impeccable:product-schema 1 -->

<!-- Rewritten 23 Sep 2026 from Dom's change brief ("timing first") and the
     code as of c1025a1. Facts marked [inferred] are not confirmed by a user
     answer. -->

## Platform

web

## Users

- **Dom and Norm (partners).** Open the app on Overview. They want to see, per job, what's late, what's next and what the job is waiting on. They scan; they don't read.
- **Dominic (admin).** Same view as the partners plus setup: templates and new job, trades, people and roles, program editing. On both sides.
- **Raff (builder).** Phone, between calls on site or in the ute. Opens on My items (his waiting-on items): dated actions to book, order or chase, ticked off as they're done. Also sees jobs, shipments, photos and notes; no setup, no Call mode.
- **Alec (site hand).** Phone, gloves on, patchy reception. Opens on Today for the last build job he opened: today's plan, this week's deliveries, notes, and before-cover photos uploaded into named categories. Build jobs only. Never sees money.

Two "sides" (Norm and Dom; Norm) partition the data. Only Dominic and Norm are on both and get the side switcher; everyone else never sees a side name.

## Product Purpose

Cruise keeps the timing of each job on track. One list of dated actions (waiting-on items) against each job's program of stages and steps, shown so a partner can tell in seconds what's overdue, what's next, and what the job is waiting on. Anything that doesn't help answer those three is pared back. Success on site: a hold point can't be ticked until the photos the certifier needs exist.

## Positioning

Dates are derived, not typed: lead times, shipment ETAs and step links roll forward into each item's act-by and needed-by dates, so "overdue" and "next" come from the program itself rather than someone remembering to update a list. A spreadsheet or a generic task app cannot truthfully do this.

## Operating Context

- Rituals: partners check Overview (Monday is the usual review) [inferred]; builders work their items from the phone; daily site notes; before-cover photos before every hold point.
- Vocabulary: subbie/trade, lead time, lock-up, hold point, certifier, before-cover photo, OC, DA/CDC/CC, look-ahead, defect, act-by, needed-by, pending approval.
- Environments: desktop browser and phone (partners, admin); phone home-screen install with a service worker; offline on site with a photo queue that survives reload.
- Locale: en-AU. Dates read "Mon 28 Sep" with relative time alongside.

## Capabilities and Constraints

- Stack: Vite + React + TypeScript, hash routing, no backend (mock data layer behind one API interface), Vitest, Playwright. SPEC.md (locked) holds rules, roles and mock data.
- Overview (home for partners and admin, jobs index for everyone): per job its stage, the next steps with dates and next hold point, the top waiting-on items, and freshness. No screen shows a finish date or money; the calculator stays underneath only to produce act-by and needed-by dates.
- Waiting on is its own bottom tab, with a Call mode for partners and admin. The bell (notifications) sits top right.
- Partner/admin bottom tabs: Overview, Waiting on. Shipments lives inside each job page as a tab (`/jobs/:id/shipments`, that job's shipments only; old `/shipments/:id` links forward into the job); the desktop sidebar keeps the side-wide Shipments list. Builder: My items, Jobs, + Photos, with the global Shipments list. Site: Today, Jobs.
- Planned direction for partner and admin only (not yet built): a job dropdown at the top of each job page switches jobs. Builder and site views stay as they are for now.
- Hold points refuse completion until required photo categories are filled; the refusal names the empty categories.
- Money fields are stripped by the data layer for the site role; nothing is hidden with CSS.
- Sign-in is a person list with no password; signed out is a real state.
- Offline is a thin, calm bar; date changes are disabled offline with "Needs signal".
- Tap targets at least 56px on site-role screens; category pickers are buttons, never dropdowns. Filters elsewhere are dropdowns.
- Desktop tables and phone cards from one token set; phone breakpoint below 768px.
- Every `data-testid` and every word asserted by the Playwright specs is load-bearing.
- No stock imagery: the photos users upload are the only images.

## Brand Commitments

- Product name: Cruise, with the Cruise logo.
- Hi-vis orange is the single accent. [confirmed in SPEC.md]
- Light theme by default; dark and system available from My settings.
- A self-hosted web font pair is approved. [confirmed]
- No Inter, Geist, Space Grotesk or Roboto. [binding]
- No gradient cards, no all-caps eyebrow labels. [confirmed in SPEC.md]
- Dom's change brief, 23 Sep 2026, verbatim: "This version is about one thing: making sure the timing of each job is on track. Anything that doesn't help me see what's late, what's next and what we're waiting on should be pared back. The app is also a bit text heavy right now, so I'd like it more visual and cleaner overall." [binding]
- The earlier client brief still stands where it doesn't conflict: "modern easy on the eyes app… sleek. well spaced. not too much writing." [binding]

## Evidence on Hand

- Seed data in `src/seed` built from Cerr Build's real job folders: the seven jobs, approvals, consultants, suppliers and trades are real; program dates, phone numbers and emails are placeholders (see README "What's real"). No customers, testimonials or press exist and none may be invented.
- Placeholder photos are generated SVG/canvas.
- `docs/DESIGN_CRITIQUE_BEFORE.md` and older screenshots are evidence and anti-reference only.

## Product Principles

1. Timing first: every screen answers what's late, what's next, and what we're waiting on. Anything else is pared back.
2. Waiting on leads: on a job card it is the most important thing and is read first.
3. Red means overdue, and only overdue: things actually past their date. No amber "coming soon" warnings; keep the signal rare so it means something.
4. Every date carries relative time: "Mon 28 Sep, in 5 days", "Mon 21 Sep, overdue by 2 days".
5. Progress through stages is shown visually, as a progress bar, not a text label.
6. Less text, more visual: the bar, colour and spacing carry the information; a label is one or two words and a screen never explains what it already shows.
7. Colour agrees with words, never replaces them: overdue is red and says "overdue".
8. Nothing is censored: what a role can't see is absent, never blanked.

## Accessibility & Inclusion

Visible keyboard focus everywhere; reduced motion respected; text contrast at least 4.5:1 on its surface; 56px tap targets on site-role screens; status never by colour alone, so the overdue red always travels with the word. [inferred from SPEC.md and the existing test suite]
