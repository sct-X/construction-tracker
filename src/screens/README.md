# Screens and routes

Twenty-two screens from docs/UI_PLAN.md section 1, with the hash routes each one owns.
Routes are hash-based (`#/...`) because GitHub Pages serves from a sub-path. The dev
bar reads `?as=alec&today=2026-09-17&offline=1&side=side-nd` from the hash query on any route.

Role letters: A admin, P partner, B builder, S site. `canSee(screen)` on the API is the
source of truth (`SCREEN_ACCESS` in `src/data/api.ts`); navigation is built from it, and a
typed route the role can't see shows "You don't have access to this".

| # | Screen | Route | Screen key | Who | Stage |
| --- | --- | --- | --- | --- | --- |
| 1 | Sign in (stub: the dev bar) | `#/` | — | A P B S | 1 |
| 2 | Monday screen | `#/monday` | `monday` | A P B | 1 |
| 3 | Jobs list | `#/jobs` | `jobs` | A P B S | 1 |
| 4 | Build job: overview (Alec: Today) | `#/jobs/:id` | `job` | A P B S | 2 |
| 5 | Build job: program (Gantt / look-ahead) | `#/jobs/:id/program` | `program` | A P B S | 2 |
| 6 | Step detail | `#/steps/:id` | `step` | A P B S | 2, hold point in 5 |
| 7 | Design job: checklist | `#/jobs/:id` (design kind) | `checklist` | A P B | 5 |
| 8 | Waiting-on list (all jobs or `?job=`) | `#/waiting` | `waiting` | A P B | 4 |
| 9 | Deliveries (Alec) | `#/deliveries` | `deliveries` | S | 3 |
| 10 | Item detail, add and edit (sheet) | `#/items/:id`, `#/items/new` | `item` | A P B | 4 |
| 11 | Call list | `#/calls` | `calls` | A P | 4 |
| 12 | Shipments list | `#/shipments` | `shipments` | A P B | 2 |
| 13 | Shipment detail with ETA impact preview | `#/shipments/:id` | `shipment` | A P B | 2 |
| 14 | Photos: gallery | `#/jobs/:id/photos` | `photos` | A P B S | 3 |
| 15 | Photo upload | `#/jobs/:id/upload` | `upload` | A P B S | 3 |
| 16 | Upload queue | `#/queue` | `queue` | A P B S | 3 |
| 17 | Daily notes | `#/jobs/:id/notes` | `notes` | A P B S | 5 |
| 18 | Notifications and activity feed | `#/notifications` (tabs) | `notifications`, `activity` | A P B S (S: no feed) | 5 |
| 19 | My settings | `#/settings` | `settings` | A P B S | 6 |
| 20 | Program editor | `#/jobs/:id/edit` | `editor` | A P | 6 |
| 21 | Templates and new job | `#/templates` | `templates` | A P | 6 |
| 22 | Trades / People and roles | `#/trades`, `#/people` | `trades`, `people` | A P B / A | 6 |

Not screens, but routes people land on:

- "My items" = `#/waiting?owner=me` (Raff's phone home).
- Today = `#/jobs/:id` as Alec, for the last job he opened; his home is `#/` redirecting there.
- The side switcher is a header control for Dominic and Norm; it sets `session.sideId`.

Each screen lives in `src/screens/<Name>/` with its own CSS file and uses `data-testid` on every
primary control (kebab-case, see docs/CONTRACTS.md).
