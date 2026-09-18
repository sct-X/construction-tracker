# Product

<!-- impeccable:product-schema 1 -->

<!-- Written by the design lead from SPEC.md and docs/UI_PLAN.md "Read this
     first" (no user interview was possible in this session; facts marked
     [inferred] come from the brief, not from a confirmed answer). -->

## Platform

web

## Users

- **Dom and Norm (partners).** Desktop, Monday morning. They open one screen to see each build job's forecast finish, how far it slipped since last Monday, and what the slip costs in holding money. They read numbers, not prose.
- **Dominic (admin).** Same as the partners plus setup: templates, trades, people, program editing. Desktop first.
- **Raff (builder).** Phone, between calls on site or in the ute. Works a list of dated actions: what to book, what to order, who to chase, and ticks them off after a call.
- **Alec (site hand).** Phone, gloves on, patchy reception. Uploads before-cover photos into named categories, reads today's plan and this week's deliveries. Never sees money.

Two "sides" (Norm and Dom; Norm) partition the data; only Dominic and Norm can switch.

## Product Purpose

One list of dated actions (waiting-on items) viewed about twenty ways, plus a calculator that turns late items into a later finish date and a dollar figure. Success on a Monday: the partners know in seconds which job moved, by how many days, at what cost, and why. Success on site: a hold point can't be ticked until the photos the certifier needs exist.

## Positioning

The forecast is derived, not typed: lead times, shipment ETAs and step links roll forward into a finish date and a holding-cost figure automatically, and the "why it moved" chain names the cause. A spreadsheet or a generic task app cannot truthfully do this.

## Operating Context

- Rituals: Monday morning review (partners, desktop); a Monday forecast snapshot; call lists worked from the phone; daily site notes; before-cover photos before every hold point.
- Vocabulary: subbie/trade, lead time, lock-up, hold point, certifier, before-cover photo, OC, DA/CDC/CC, look-ahead, defect, holding cost, act-by, needed-by.
- Environments: desktop browser (partners, admin); phone home-screen install with a service worker; offline on site with a photo queue that survives reload.
- Locale: en-AU, dates as "Fri 26 Feb 2027", money as "$4,500/wk".

## Capabilities and Constraints

- Stack: Vite + React + TypeScript, hash routing, no backend (mock data layer behind one API interface), Vitest, Playwright. See SPEC.md (locked) for rules, roles and mock data.
- Rules that shape the UI (SPEC.md "Rules"): needed-by and act-by dates; forecast vs planned; slip in calendar days and dollars; hold points refuse completion until required photo categories are filled (the refusal names the empty categories); a job goes amber after 7 days unconfirmed.
- Money is stripped by the data layer for the site role; the money component renders nothing (label included) when the field is absent. Never hidden with CSS.
- Colour never carries meaning alone: late/amber/ok always come with words ("14 days late").
- Tap targets at least 56px on the site role's screens; category pickers are buttons, never dropdowns.
- Offline is a thin, calm bar; date changes are disabled offline with "Needs signal".
- Desktop tables and phone cards from one token set; phone breakpoint below 768px.
- Every `data-testid` and every word asserted by the Playwright specs is load-bearing.
- No stock imagery: the photos users upload are the only images.
- Undecided: a light theme (dark ships as the default; tokens are themable via `[data-theme]`).

## Brand Commitments

- Hi-vis orange is the single accent, tuned for dark backgrounds. [confirmed in SPEC.md]
- The client's brief for the redesign, verbatim: "I want a modern easy on the eyes app. dark mode. cool. sleek. well spaced. not too much writing. get rid of all the fluff in terms of writing." [binding]
- A self-hosted web font pair is approved. [confirmed]
- No Inter, Geist, Space Grotesk or Roboto. [binding]
- No gradient cards, no all-caps eyebrow labels. [confirmed in SPEC.md]

## Evidence on Hand

- Seed data in `src/seed` built from Cerr Build's real job folders: the sites, approvals, consultants, suppliers and trades are real; program dates, holding costs, phone numbers and emails are placeholders (see README "What's real"). No customers, testimonials or press exist and none may be invented.
- Placeholder photos are generated SVG/canvas.
- The incumbent look (screenshots in the design lead's scratchpad, and `docs/DESIGN_CRITIQUE_BEFORE.md`) is evidence and anti-reference only.

## Product Principles

1. Numbers first: on partner screens the date and the dollar figure are the largest type; everything else is secondary.
2. Words carry meaning; colour only agrees with them. The Monday screen must read printed in greyscale.
3. Fewer words: a label is one or two words; a screen never explains what it already shows.
4. Two densities, one system: tables for the desk, cards and 56px targets for the glove.
5. Nothing is censored: what a role can't see is absent, never blanked.

## Accessibility & Inclusion

Visible keyboard focus everywhere; reduced motion respected; text contrast at least 4.5:1 on its surface; 56px tap targets on site-role screens; status never by colour alone. [inferred from SPEC.md and the existing test suite]
