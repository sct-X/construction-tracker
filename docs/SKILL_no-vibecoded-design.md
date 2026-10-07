---
name: no-vibecoded-design
description: Design and review web pages so they don't look AI-generated. A checklist of 30 visual, copy, and credibility tells that mark a site as "vibecoded" — harsh gradients, purple-and-black, bento grids, three feature cards in a row, sparkle icons, Inter/Geist/Space Grotesk, fake testimonials, "it's not X, it's Y" copy, missing legal pages — each paired with what to do instead. Use this skill whenever building, styling, or reviewing ANY landing page, marketing site, hero section, pricing page, dashboard, portfolio, or web UI, even when the user says nothing about design, aesthetics, or looking AI-generated. Also use on request, when the user says "does this look AI", "de-vibecode this", "make this look human", "review my landing page", "why does my site look generic".
---

# Don't ship a site that looks vibecoded

Default AI output converges. Every model reaches for the same purple gradient, the
same three cards, the same Inter. The result is legible at a glance as machine-made
— which reads as low-effort, and on a commercial site, as untrustworthy.

This skill is a checklist of 30 tells, grouped, each with the fix.

## How to use it

**When building:** read the tells, then design *away* from them from the start.
Do not build the default and then patch it — the patched version still has the
default's bones.

**When reviewing:** walk the checklist, name each tell you find with its number,
and give the specific fix. End with the 3 changes with the highest impact.

## The one rule behind all 30

**Every visual decision should be traceable to something true about the product.**
Vibecoded design is decoration applied uniformly because it's available. Real design
is decision-making under constraint: this color because the product is about X, this
type because the audience is Y, this layout because the content has an actual shape.

If you can swap the logo and the copy and the page still works for a different
company, it isn't designed. It's a template with the serial number filed off.

## Reading the verdicts

Not all 30 are equally guilty. Each is marked:

- **TELL** — genuinely reads as AI-generated. Avoid.
- **DOSE** — fine, standard, sometimes correct. Only a tell at default intensity
  or when applied uniformly. Use judgment, don't ban it.

Do not strip a **DOSE** item out of a design just to satisfy the checklist. Removing
hover states or rounding to make a page "less AI" makes it worse. The failure mode of
this skill is over-correction.

---

## A. Color

| # | Tell | Verdict | Do instead |
|---|------|---------|------------|
| 1 | Harsh gradients | TELL | Flat color. If you need a gradient, keep it within one hue and under ~15% lightness travel, or use it once as a texture, never as the hero background. |
| 4 | Rainbow coloring | TELL | One accent. A second only if it earns a job (destructive, success). Multi-hue belongs in data viz, where hue means something. |
| 20 | Purple and black | TELL | Purple-on-near-black is the single most recognizable AI default. Pick a hue with a reason: ink blue, oxblood, moss, ochre, slate. Anything but #7C3AED. |
| 29 | Neon colors | TELL | Saturated glow reads as a template. Desaturate 20–40% and let contrast, not luminance, do the work. |
| 30 | Basic pastel colors | TELL | The overcorrection from neon lands in default Tailwind pastels. Mix your own: shift hue off the primaries, drop saturation, warm or cool the whole set consistently. |
| 3 | Pure white background | TELL | `#FFFFFF` is a non-choice. Warm it (`#FBFAF7`), cool it (`#F7F8FA`), or go properly dark. Off-white also makes hairlines and cards readable without shadows. |
| 22 | Radial orbs | TELL | The blurred glowing blob behind the hero. Delete it. Whitespace, a rule, or a real product image instead. |

**Color method:** pick one hue, build a 5-step ramp from it, add one warm-or-cool
neutral ramp, and stop. Two ramps beat a palette generator.

## B. Surface and depth

| # | Tell | Verdict | Do instead |
|---|------|---------|------------|
| 5 | Drop shadows | DOSE | Shadow is real; `0 25px 50px rgba(0,0,0,.25)` on every card is not. Prefer 1px hairline borders for separation, reserve shadow for things that genuinely float (menus, modals, toasts). |
| 8 | Liquid glass | TELL | Frosted translucent panels over a gradient. Almost never justified. Solid surface, hairline border. |
| 19 | Soft corner radius | DOSE | Radius isn't the problem, *uniform 16px on everything* is. Pick a scale (0 / 3 / 8) and assign by element size. Small controls get small radius. |
| 23 | Dot grids | TELL | Background dot or grid pattern as "tech texture". Remove. If you need texture, use a real one: paper grain, a photo, a subtle rule system. |

## C. Typography

| # | Tell | Verdict | Do instead |
|---|------|---------|------------|
| 10 | Inter / Geist / Space Grotesk | TELL | The three defaults. Reach past them: a serif for display (Charter, Iowan Old Style, Source Serif, Instrument Serif, Fraunces), a grotesque with personality for UI (Söhne, Basis, Untitled, or the system stack), or a mono used deliberately. A serif headline alone kills half the vibecoded read. |
| 9 | Em dashes | TELL | In *body copy* this is a text tell, not a design one, but it's on the list for a reason. Rewrite the sentence: full stop, comma, or parentheses. Also avoid "delve", "seamless", "unlock", "elevate", "leverage". |

**Type method:** two families for prose, maximum. A mono is a legitimate third when it
labels data, IDs, or code, not when it is used as decoration. Set a display size that is genuinely large
(48–72px) with tight leading and negative tracking, keep body at 16–18px with a
measure of 60–75 characters. Most AI pages fail on measure — text runs full width.

## D. Icons and ornament

| # | Tell | Verdict | Do instead |
|---|------|---------|------------|
| 2 | Lucide icons | DOSE | Lucide is a good library. The tell is Lucide *everywhere*, one per feature, at default stroke. Use fewer icons, or draw the two or three you actually need. |
| 24 | Sparkle icons | TELL | The four-point sparkle as shorthand for "AI". Retired. Say what the feature does. |
| 7 | Emojis | TELL | Emoji as section bullets or feature icons. Remove entirely from marketing surfaces. |
| 25 | Animated arrows | TELL | The bouncing scroll-down chevron and the arrow that slides on hover. Both are filler motion. |
| 11 | Colored left stripe | TELL | The 4px accent bar down the left of a card or callout. Extremely templated. Use a hairline box or a hanging label. |

## E. Layout

| # | Tell | Verdict | Do instead |
|---|------|---------|------------|
| 6 | Three feature cards in a row | TELL | The single most recognizable AI layout. Break it: two features at different weights, a numbered editorial list with hairline rules, or one feature shown properly with a real screenshot. Content rarely comes in three equal parts. |
| 13 | Bento grids | TELL | Asymmetric rounded tiles as a "features at a glance" section. Overused since 2023. Use a real grid with real hierarchy. |
| 16 | Checkmark bullets | DOSE | Fine on a pricing plan where you're literally listing what's included. A tell when every list on the page is green ticks. Plain bullets or no marker in prose. |
| 14 | Terminal window | TELL | The fake macOS window with three traffic-light dots, showing a command nobody will run. Only include a terminal if the product is a CLI and the command is real. |
| 17 | Three pricing tiers | DOSE | Three tiers with "Most Popular" on the middle one is a real pricing pattern, but the *default* three. Charge what you charge: one price, or two, or a table. If you use three, drop the badge and the middle-column scale-up. |

## F. Copy

| # | Tell | Verdict | Do instead |
|---|------|---------|------------|
| 15 | "It's not X, it's Y" | TELL | "It's not a to-do list. It's a second brain." Antithesis as a headline formula. Also on the list: "Everything, everywhere", "Built different", "X, reimagined", one-word sentences for. emphasis. Write a headline that states what the product does in plain language, then a subhead with a real specific. |

**Copy method:** the headline should survive the question "could a competitor use
this?" If yes, it's not saying anything. Specificity is the whole trick — a number,
a named integration, a real constraint.

## G. Proof and substance

| # | Tell | Verdict | Do instead |
|---|------|---------|------------|
| 12 | Fake testimonials | TELL | Invented quotes from invented people with generated avatars. Beyond looking fake, publishing fabricated endorsements as genuine is deceptive and in most markets illegal. Ship with no testimonial section until you have real ones, or show a clearly-labeled placeholder in the mockup. |
| 18 | No real product demos | TELL | Abstract glowing rectangle where the screenshot should be. If the product exists, show it: a real screen, honest resolution, real data. If it doesn't exist yet, show a precise wireframe and label it as one. This is the highest-impact fix on the list. |

## H. Engineering polish

| # | Tell | Verdict | Do instead |
|---|------|---------|------------|
| 21 | No skeleton loaders | DOSE-as-written | The complaint is that vibecoded sites have no loading states at all — content pops in or a spinner sits there. Add real loading states. Skeletons are one option; a spinner in the right place is fine. Don't add skeletons to a static page that has nothing to load. |
| 28 | Hover animations | DOSE | Hover feedback is table stakes and removing it makes a site *worse*. The tell is the specific default: `translateY(-8px)` plus a shadow bloom plus 300ms on every card. Keep hover, make it quiet — 100–150ms, a border or background shift, no lift. |

## I. Legal and trust

| # | Tell | Verdict | Do instead |
|---|------|---------|------------|
| 26 | No terms of service | TELL | A site collecting emails or payment with no ToS is unfinished, and in the EU/UK/AU it's a compliance problem. |
| 27 | No privacy policy | TELL | Same. If you set a cookie or take an email address you need one. |

Also missing from most generated sites and worth adding: a real contact route, a
company entity name in the footer, and a working link on every nav item.

---

## Ordered checklist for a review

Work top-down; the first four carry most of the improvement.

1. **Is there a real product view?** (#18) — the biggest single lever.
2. **Kill the hero background.** (#1, #22, #20) — flat color, no orb, not purple.
3. **Change the typeface.** (#10) — a serif display headline alone transforms it.
4. **Break the three-card row.** (#6, #13) — reshape to fit the actual content.
5. Palette down to one accent (#4, #29, #30) on an off-white or true dark (#3).
6. Shadows → hairlines (#5, #8); radius to a scale (#19); remove dot grid (#23).
7. Strip ornament: sparkles, emoji, animated arrows, left stripes (#24, #7, #25, #11).
8. Rewrite the headline out of the "not X, it's Y" mold (#15); remove em dashes (#9).
9. Remove invented testimonials (#12); simplify pricing (#17).
10. Quiet the hover states (#28); add loading states if anything loads (#21).
11. Add Terms, Privacy, contact, entity name (#26, #27).

## Self-check before delivering any page

Answer these honestly. If the answer to any is no, fix it before shipping.

- Could I swap in a competitor's name and this page still works? (If yes → #15, #18)
- How many hues are on the page? (More than one accent → #4)
- What is the display typeface, and why that one? ("It's the default" → #10)
- Is any section three equal boxes in a row? (→ #6)
- Is every claim on the page something the product actually does? (→ #12)
- Does the footer link to Terms and Privacy? (→ #26, #27)

---

*Source: the checklist originates from a list circulated by @aj.on.ai
("30 reasons your site looks vibecoded"). Verdicts, groupings, fixes, and methods
are added here; the DOSE markings note where the original list flags normal good
practice as a fault.*
