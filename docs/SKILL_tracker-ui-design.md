---
name: tracker-ui-design
description: "Use when building or styling any screen of the Construction Tracker app (Monday screen, waiting-on list, photo upload, program view) so the UI looks deliberate and modern, not templated."
---

# Tracker UI Design

Adapted from Anthropic's `frontend-design` skill (github.com/anthropics/claude-code, plugins/frontend-design), with a section at the end that pins the direction for this app. Read the whole thing before writing the first component.

Approach this as the design lead at a studio known for giving every client a distinct visual identity. This client has already rejected proposals that felt cliché or templated: make deliberate, opinionated choices about palette, typography and layout that are specific to this brief.

## Ground the design in the subject matter

The subject is a construction job tracker for a small Sydney builder-developer. Users are two finance partners on a desktop on Monday morning, a builder on a phone between calls, and a site hand on a phone wearing gloves in patchy reception. The vernacular is site diaries, Gantt bars, certifier hold points and lead times. Distinctive visual choices come from that world, not from SaaS dashboards.

## Design principles

- The first thing on each screen is the most characteristic thing in its world: the forecast finish and slip on the Monday screen, the category buttons on photo upload, the overdue group on the waiting-on list. A big number with a small label and a gradient accent is the default treatment; only use it if it is truly the best option.
- Typography carries the personality. Use one family or two, and if two, make them clearly distinct. Choose typefaces deliberately, not the defaults you would reach for on any project. Set a clear type scale with intentional weights and spacing. Line lengths under 80 characters.
- Avoid the commonest tells of a generated page: accenting a single word in a headline, all-caps labels, unnecessary labels above content.
- Visual structure is information. Borders, numbering, dividers and labels encode something about the content rather than decorate it. Numbered markers only where the content is a sequence.
- Motion only to answer a person's action (opening, expanding, confirming) and to show what changed. No fade-and-slide-up entrances on every section, no hover transitions on every card.
- Copy is design content. Plain verbs, sentence case, active voice. A button says exactly what happens: "Upload 11 photos", not "Submit". The same word follows the action through the flow. Errors say what went wrong and how to fix it; empty screens are an invitation to act.

## Defaults to avoid

AI-generated design currently clusters around these. They are defaults rather than choices; where the brief leaves an axis free, do not spend that freedom on one of them:

1. A warm cream background (near #F4F1EA) with a high-contrast serif display and a terracotta accent (near #D97757).
2. A near-black background with a single acid-green or vermilion accent.
3. A broadsheet layout with hairline rules, zero border-radius and dense columns.
4. The SaaS card kit: identical rounded cards, one border-radius on everything, the same soft grey shadow under each, gradient washes as decoration.
5. Template chrome regardless of subject: tracked-out all-caps eyebrows, meta strings joined with middle dots, tinted near-black (#111) standing in for black, monospace for small data labels, an arrow appended to every link.

## Process: plan, review, build, critique

Work in two passes.

1. Write a compact token plan before any code: 4 to 6 named hex colours; the typefaces and their roles; a one-sentence layout concept with an ASCII wireframe; the principle that makes this screen unique.
2. Review the plan against the brief. If any part reads like what you would produce for any similar page, revise it and say what changed and why. Only then write the code.

When writing CSS, watch selector specificity so section and element rules do not cancel each other, especially padding and margin between sections.

## Restraint

Spend boldness in one place per screen. Let one element be the memorable thing and keep everything around it quiet. Build to a quality floor without announcing it: responsive down to a phone, visible keyboard focus, reduced motion respected, accessible contrast. Take screenshots as you build and critique them. Before finishing, remove one accessory.

## For the Construction Tracker specifically

- **Tap targets are large.** Alec uploads photos in gloves. Category pickers are buttons at least 56px tall, never dropdowns. One primary action per list row.
- **Colour never works alone.** Red and amber always come with words: "14 days late", "unconfirmed 9 days". The Monday screen must read correctly printed in greyscale.
- **Numbers are the hero on partner screens.** Forecast finish, slip and slip cost are the largest type on the Monday screen. Everything else is secondary.
- **Two densities, one system.** Desktop tables for Dominic and the partners; cards and week-grouped lists on the phone. Same tokens, same components, different layout.
- **The program view uses the slip outline.** Forecast bars are solid; the planned position stays behind as an outline so slip is visible without reading a date.
- **Money draws nothing when absent.** The money component renders nothing, label included, when the field is missing. Alec's screens must look finished, not censored.
- **Offline is calm.** "No signal" is a thin bar, not a modal or a red banner. Queued changes show a small clock.
- **No decorative imagery.** The photos users upload are the only images in the app.
- **Ask before choosing a palette** if the client has brand colours; otherwise draw the palette from site materials (concrete, steel, timber, the orange of a hi-vis vest for the one accent) and say so in the token plan.