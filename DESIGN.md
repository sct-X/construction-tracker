---
name: Cruise
description: An Apple app for keeping a build on time. iOS grouped surfaces, the system face, one orange tint, red only for overdue. Light by default, dark as the alternate.
colors:
  ground: "#f2f2f7"
  plate: "#ffffff"
  raised: "#e9e9ee"
  lifted: "#ffffff"
  well: "#e5e5ea"
  fill: "#e4e4e9"
  line: "#c6c6c8"
  line-strong: "#aeaeb2"
  text: "#1d1d1f"
  text-secondary: "#48484d"
  text-muted: "#636366"
  tint: "#b0501a"
  tint-fill: "#b0501a"
  tint-wash: "#fbeee5"
  on-tint: "#ffffff"
  logo-accent: "#c1652e"
  steel-fill: "#3a3a3c"
  bar: "rgba(250, 250, 252, 0.52)"
  glass-thick: "rgba(255, 255, 255, 0.78)"
  sidebar: "#f5f5f7"
  late-ink: "#d70015"
  late-bg: "#fdecee"
  ok-ink: "#1e7b34"
  ok-bg: "#e8f5ea"
typography:
  large-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Display, SF Pro Text, system-ui, Segoe UI, sans-serif"
    fontSize: "2.125rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.012em"
  title-1:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Display, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.012em"
  title-2:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Display, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
  title-3:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Display, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "normal"
  callout:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "normal"
  subhead:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "normal"
  footnote:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "normal"
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "10px"
  row: "8px"
  segment: "9px"
  thumb: "7px"
  button: "12px"
  lg: "14px"
  sheet: "16px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
  "12": "48px"
  "16": "64px"
components:
  button-filled:
    backgroundColor: "{colors.tint-fill}"
    textColor: "{colors.on-tint}"
    rounded: "{rounded.button}"
    padding: "0 20px"
    height: "56px"
  button-gray:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.text}"
    rounded: "{rounded.button}"
    padding: "0 20px"
    height: "56px"
  button-tinted:
    backgroundColor: "{colors.tint-wash}"
    textColor: "{colors.tint}"
    rounded: "{rounded.button}"
    padding: "0 20px"
    height: "56px"
  button-plain:
    backgroundColor: "transparent"
    textColor: "{colors.tint}"
    rounded: "{rounded.button}"
    padding: "0 20px"
  segmented:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.text}"
    rounded: "{rounded.segment}"
    padding: "2px"
    height: "32px"
  input:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "56px"
  cell:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "11px 16px"
    height: "44px"
  card:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "16px"
  status-late:
    backgroundColor: "{colors.late-bg}"
    textColor: "{colors.late-ink}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  status-neutral:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  status-ok:
    backgroundColor: "{colors.ok-bg}"
    textColor: "{colors.ok-ink}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
---

# Design System: Cruise

## Overview

**Creative North Star: "If Apple made it"**

Cruise should feel like an app Apple would ship: the Human Interface Guidelines translated honestly to the web. The ground is iOS's grouped grey, content sits in white cells and cards with continuous-feeling corners, the type is the system face in Apple's text styles, and the chrome is translucent material that lets the content scroll under it behind a hairline. One tint colour, the Cruise orange, marks what you can act on and where you are; red is kept for things that are actually overdue. Nothing is decorated, nothing at rest casts a shadow, and motion is short and eases out without bounce.

It is calm on purpose. Dom scans; he doesn't read. So hierarchy comes from Apple's type ramp (a large title, headlines, secondary and tertiary labels), grouping comes from white cells on the grey ground, and colour is so rare that the red of an overdue item is the first thing the eye finds.

Light is the default; dark uses iOS's true-black ground with elevated greys (My settings: Light, Dark, Match device). Every screen is drawn from tokens and never branches on the theme.

Replaced (23 Sep 2026): the "surveyor's readout" world (Barlow Semi Condensed and Atkinson Hyperlegible Next, a warm off-white ladder, hi-vis orange buttons with dark ink, amber for can't-do-yet states). Its fonts are no longer loaded.

**Key Characteristics:**
- iOS grouped surfaces: grey ground, white cells and cards; dark mode is true black with #1c1c1e cells.
- The system face (SF Pro on Apple devices) in Apple's text styles; no web font ships.
- One tint, the Cruise orange deepened to #b0501a so it reads as text; the logo dot keeps its own #c1652e.
- Red is overdue and only overdue. No amber anywhere.
- Liquid Glass on the floating layer only: the phone nav bar and a floating tab-bar capsule (Regular), the buzz and the program editor footer (Thick). Content stays solid. A solid macOS source list on the desktop.
- 44px minimum targets, 56px on the site role's screens and every primary control on the phone.

## Colors

Light values below; dark values live in tokens.css under `[data-theme='dark']`.

### Tint
- **Tint** (#b0501a; #ff9a52 in dark): the Cruise orange as an iOS tint colour. Plain buttons and back buttons, the selected tab's glyph and label, the current row's glyph in the sidebar, the focus ring, the bell count, the today line on the program. 4.7:1 on the ground, 5.2:1 on white.
- **Tint fill** (#b0501a; #b8541c in dark) under **on-tint** white (5.2:1 / 4.9:1): the filled button, one per screen. **Tint wash** (#fbeee5; #3a2414): tinted buttons and text selection.
- **Logo accent** (#c1652e; #eb6a2e): the dot in the Cruise mark only. It is too light for text, so it never is.

### Neutral (iOS system colours, made solid for AA)
- **Ground** (#f2f2f7; #000): systemGroupedBackground, the page.
- **Plate** (#fff; #1c1c1e): secondarySystemGroupedBackground, cells, cards, fields.
- **Raised** (#e9e9ee; #2c2c2e): a pressed or hovered cell, a chip. **Lifted** (#fff; #2c2c2e): banners, menus, with the one shadow. **Well** (#e5e5ea; #0e0e10): sunk regions (the dev bar, the chart ground, the frame round the site role's phone column).
- **Fill** (#e4e4e9; #26262a): tertiarySystemFill, the segmented trough, gray buttons, neutral chips.
- **Separator** (#c6c6c8; #38383a) at 0.5px, inset to the text; **line strong** (#aeaeb2; #545458) for scrollbars and field hover.
- **Label** (#1d1d1f; #f5f5f7), **secondary label** (#48484d; #c7c7cc), **tertiary label** (#636366; #98989f). Every pair is 4.5:1 or better on ground, plate and raised in its theme.
- **Steel fill** (#3a3a3c; #636366) with white text: the chosen half of a pair or picker. Text on it is always `--text-on-dark` (#fff).

### Status (always beside words)
- **Late** #d70015 on #fdecee (#ff6961 on #3a1d1d in dark): overdue, and only overdue, worded "overdue" and led by "!".
- **Ok** #1e7b34 on #e8f5ea (#30d158 on #17311f): done, on plan, received. Always with the words.
- **No amber.** Can't-do-yet states (no signal, a failed upload, a hold point's empty photo sets, form problems) are label text on the neutral fill with a leading "!". The `--amber-*` token names survive only so older screen CSS resolves to that neutral.

### Named Rules
**The Tint Rule.** Orange means "you can act here" or "you are here": the filled button, plain buttons, the selected tab, the current sidebar glyph, focus. One filled button per screen. Never a heading, never a status, never decoration.
**The Red Rule.** Red is overdue. If it isn't past its date, it isn't red.
**The Words First Rule.** Colour agrees with words, never replaces them; late and neutral warnings carry a "!" so they read in greyscale.
**The On-Fill Rule.** Text on the steel fill or the tint fill is white from a token, never the label ladder.

## Typography

**Face:** the system stack, `-apple-system, BlinkMacSystemFont, "SF Pro Text"/"SF Pro Display", system-ui, sans-serif`. On an iPhone, iPad or Mac that is SF Pro with its optical sizes; elsewhere it is the platform's own UI face. Nothing is downloaded, so there is no flash of fallback text and nothing to precache.

### Text styles (iOS Dynamic Type at the Large default)
- **Large Title** (34, bold): the page title (`.page-header__title`), the job switcher's name.
- **Title 1** (28, bold): row figures on the phone (`<BigNumber size="row">`). **Title 2** (22), **Title 3** (20, semibold): section titles and card titles.
- **Headline** (17, semibold): a cell's title, the side name in the nav bar.
- **Body** (17): words, buttons. **Callout** (16). **Subhead** (15): secondary lines, chips, sidebar rows, tables.
- **Footnote** (13): group headers, field labels, table headers, segment labels on the desktop. **Caption** (12) and **Caption 2** (11): counts and tab bar labels.
- The one hero figure on a job or shipment screen stays larger than any title: 44px on the phone, 56px on the desktop (`.display`, `<BigNumber size="hero">`).

Legacy size tokens map onto these: `--text-xs` caption, `--text-sm` subhead, `--text-md` body, `--text-lg` title 3, `--text-xl` title 2, `--text-2xl` title 1, `--text-3xl` large title.

### Named Rules
**The Two Words Rule.** A label is one or two words; a sentence on a screen is a fact the UI cannot show otherwise (docs/COPY_RULES.md).
**The Sentence Case Rule.** Group headers and labels are sentence case footnotes. Never uppercase, never tracked.

## Layout

Spacing on a 4px grid, with 8, 16 and 20 doing most of the work. Phone (below 768px, and always for the site role): a 52px translucent nav bar, a 16px gutter, a large title, inset grouped content with 16px inside cells, a 56px translucent tab bar. Desktop: a 240px source list beside the grouped ground, content to 1200px with a 32px gutter. More space above a group than inside it. The site role on a wide window gets the phone column at 480px on the well.

## Elevation & Depth

Flat at rest. Grouping is tonal: white cells on the grey ground (in dark, #1c1c1e on black). What floats is Liquid Glass (see Material below), never shadowed content.

### Shadow Vocabulary
- **Glass shadow** (`--lg-shadow`, `--lg-shadow-thick`, from the label ink, never pure black): the tab-bar capsule, the phone job tabs and Waiting on filter, the buzz, the editor footer. Nothing else.
- **Float** (`--shadow-float`): kept for the few lifted things that are not glass.
- **Segment thumb** (`0 3px 8px rgba(0,0,0,.12), 0 1px 1px rgba(0,0,0,.04)`): the chosen segment's thumb, as on iOS.

## Shapes

Radius by element size: 6px chips; 7px a segment thumb inside its 9px trough; 8px source-list rows and pop-up buttons; 10px cells, fields, inset grouped lists and desktop plates; 12px buttons; 14px cards on the phone; 16px banners and sheets; pill for counts. Where the browser supports `corner-shape`, buttons, plates, fields, segments, chips and grouped lists draw as superellipses (continuous corners); elsewhere they are plain radii. Separators are 0.5px and inset to the text. Glyphs are SF-Symbols-like inline SVG on a 24px grid at a 1.7 stroke with round caps (`src/shell/icons.tsx`); the tab bar fills a glyph's solid parts when its tab is selected.

## Components

### Buttons (`.btn`)
- **Gray (`.btn`)**: fill with label text; the everyday secondary action.
- **Filled (`.btn--primary`)**: tint fill, white semibold. One per screen. Disabled is gray with tertiary text, not dim orange.
- **Tinted (`.btn--tinted`)**: tint wash with tint text, a quieter call to action.
- **Chosen (`.btn--fill`)**: steel fill, white text: the pressed half of a pair.
- **Plain (`.btn--ghost`)**: tint text, no fill.
- 56px on the phone, 12px radius; `.btn--desktop` is 36px, 10px radius, subhead size, on wide screens. Pressed dims to 80% opacity; no scale, no bounce.

### Segmented control (`.seg`, `.seg__btn`)
A fill trough with 2px padding, 9px radius (12px on the phone, with a 10px thumb); the chosen segment (`aria-pressed="true"`) is a thumb (white in light, #636366 in dark) with the segment shadow and semibold label. 32px with footnote labels on the desktop, 56px with subhead labels on the phone.

### Lists and cells (`.group`, `.group__list`, `.cell`, `.cell--link`, `.chevron`)
Inset grouped: a footnote header 16px in, a white list with a 10px radius, 44px cells with 11/16px padding, separators inset 16px, a disclosure `chevron.right` in the separator grey on `.cell--link`. `ItemRow` lists use the same hairline and switch from stacked to one line only when the list itself is at least 560px wide (a container query).

### Chips (`<StatusText>`)
Subhead medium on a wash, 6px radius, 2px 8px padding. Tones: late (red, "overdue"), amber (now neutral fill, label text), ok (green), muted and plain (no wash). A chip is a fact, never a control.

### Fields (`.input`, `.field`, native controls)
White field (#1c1c1e in dark), a 1px separator border, 10px radius, 56px on the phone and 36px with `.input--desktop`. Labels are footnotes in tertiary label above the field. Focus turns the border tint and adds the focus ring. A `<select>` draws SF's `chevron.up.chevron.down` like a pop-up button.

### Navigation
- **Phone nav bar (`.topbar`)**: Regular glass, edge-attached, 52px, a 0.5px hairline foot with the caustic line above it, no scroll edge fade (the content shows through), the Cruise mark at left, the side switcher (a gray pop-up button) for Dominic and Norm, then the bell and the person as 44px label-coloured glyphs; the bell's count is a tint badge.
- **Phone tab bar (`.tabbar`)**: a floating Regular glass capsule, inset 12px from the sides and 8px (or the safe area) from the foot, 4px inside, so 56px tabs sit in a 64px pill. A 26px glyph over an 11px semibold label; the selected tab sits on a glass pill (`--lg-selected`, white 72% in light, black 26% in dark, with a hairline) in `--lg-tint-ink` bold with its glyph filled, the rest secondary label. A press scales the tab to 0.96 and lights it from the touch point. Glyphs: Overview `square.grid.2x2`, Waiting on `clock`, My items `checklist`, Jobs `house`, Today `calendar`, + Photos `camera`.
- **Phone job tabs (`.job__tabs`)**: on the phone, the job page's section tabs stick 8px under the nav bar as a floating Regular glass capsule (44px tabs, 56px on Alec's screens), scrolling sideways inside it; the current section is the same glass pill in label colour. Desktop keeps the underlined strip in flow.
- **Desktop sidebar (`.sidebar`)**: a macOS source list, #f5f5f7 (#1c1c1e dark) with a hairline right edge; 34px rows with a 20px glyph, a rounded neutral selection fill and a tint glyph on the current row; "Setup" as a caption header; bell and person at the foot.
- **Large title (`.page-header`)**: an iOS back button (a `chevron.left` and the previous page's name in tint) above the Large Title and a subhead meta line.
- **Job switcher (`JobHeader`)**: the job's name as the Large Title with a `chevron.down` in a small filled disc, the platform's own native menu laid over it. Hover tints the disc; press dims the whole title.

### Banner (the buzz)
Thick glass with a 16px radius at the foot of the screen (static on the phone, see Material), the tinted primary (`.glass__primary`) and a gray dismiss on `--lg-control-fill`. It slides up 12px over 280ms with an ease-out curve.

### Offline bar
A thin neutral fill under the nav bar, a grey dot and one footnote line. Never red, never amber, never a modal.

## Material (Liquid Glass)

Added 24 Sep 2026 with the Liquid Glass skill (`.claude/skills/liquid-glass-claude-skill`) in autonomous mode: no proposal round, so the layer map, values, measurements and overrides live here and in the commits. Retuned the same day (second pass) because Scott wanted "that translucent Apple feel": at 88% with a scroll-edge fade behind them the bars read as solid white. Glass is a material for the floating, functional layer; it is never used on content. Tokens: `--lg-*` in tokens.css (both themes). Classes: `.glass` + `.glass--regular | --thick`, `.glass--float` (specular, caustic, rim, shadow), `.glass--static` (same look, no blur), `.glass__primary` (the one tinted action inside a glass group), `.lg-press` (interactive illumination on an item inside glass), in base.css; `lightFromTouch` (src/shell/glassPress.ts) is the one delegated pointerdown listener that feeds it.

### Layer map
| Element | Layer | Glass | Tier | Why |
|---|---|---|---|---|
| Phone nav bar `.topbar` | floating | yes | Regular | sticky over scrolling content |
| Phone tab bar `.tabbar` | floating | yes | Regular, floating capsule | must stay reachable while content moves under it |
| Phone job tabs `.job__tabs` | floating (sticky) | phone yes; desktop solid, in flow | Regular, floating capsule | the job page is long; the section switcher should stay in reach, and it floats over the list |
| Phone Waiting on filter `.waiting__filters` | floating (sticky) | phone yes; desktop solid, in flow | Regular, floating bar | the list runs to 8,000px; whose items and which job stay in reach |
| Buzz `.buzz` | floating, transient | desktop yes; phone static | Thick | contextual, over content; the phone's budget is spent on the bars |
| Program editor footer `.editor__foot` | floating (sticky) | yes (desktop only screen) | Thick | text-dense action group over the scrolling program |
| Job switcher menu | OS | no (native) | n/a | a native `<select>`: the platform draws its own menu (on iOS 26 that is system Liquid Glass) |
| Filter dropdowns, side switcher, segmented controls | control | no | n/a | inside a glass bar they are solid fills, never a second glass |
| Offline bar, upload queue strip | structural, in flow | no | solid | they scroll with the page; nothing passes under them |
| Design checklist tabs, Photos and Notifications filters | structural, in flow | no | solid | short pages; they do not stick |
| Desktop sidebar | structural column | no | solid | a grid column beside the content, it floats over nothing |
| Item sheet | content (a page, a form) | no | solid | a route, not a modal sheet; forms stay solid |
| Photo full view | content | no | solid | full-screen photo; media is content |
| Overview cards, job sections, rows, forms | content | no | solid plates | content stays dominant |

No scrim ships: nothing in the app is a modal sheet yet. `--lg-scrim` is in the contract for when one is. The plain grey ground at the top of a page gives the glass little to show; that is accepted (content under the bars is enough), and no decorative blobs are added.

### Tiers (light / dark)
- **Regular**: `--lg-surface` #fafafc / #1c1c1e at **52% / 66%**, `blur(20px) saturate(175%)`. The fill is inside the skill's 0.50-0.65 range so the content is really there under the bars: blurred, with its colour lifted (the orange Call buttons, the red overdue chips and the tint badge glow through as colour). Dark sits higher, as the skill says dark glass needs.
- **Thick**: `--lifted` #fff / #2c2c2e at **78% / 82%**, `blur(30px) saturate(175%)`, `--lg-shadow-thick`.
- **The edge** (all box-shadow and background layers on the glass element itself, no pseudo-elements, so it holds still on the sideways-scrolling job tabs and never makes a backdrop root): a specular line along the top curve (`--lg-highlight`, white 95% / 24%), a fainter caustic along the foot (`--lg-highlight-low`, white 50% / 7%), a 0.5px rim (`--lg-edge`, label ink 10% / white 12%), a top-lit sheen in the fill (`--lg-sheen`, white 18% / 7% fading out by 55%), and a soft shadow in the label ink (`0 10px 30px` 12%, `0 2px 6px` 6%). The edge-attached nav bar takes only the caustic above its hairline (`--lg-hairline`, rgba(60,60,67,.2) / rgba(84,84,88,.5)).
- **Selected pill** (`--lg-selected` + `--lg-selected-shadow`): white 72% with an ink hairline and a 4px lift in light, black 26% with a white hairline in dark. A fill inside the glass, never a second glass.
- **Interactive illumination** (skill 17.3): on press a radial glow (`--lg-press-glow`, white 85% / 22%) spreads from the touch point to 90% over 150ms and fades over 280ms (a registered `--lg-press-r`), with a 0.96 scale. On the tab bar and the phone job tabs.
- **Solid fallbacks**: the same surfaces opaque (`--lg-regular-solid`, `--lg-thick-solid`), used without backdrop-filter and under `prefers-reduced-transparency`, `prefers-contrast: more` (plus a 1px label-colour outline) and `forced-colors` (Canvas with a CanvasText outline).
- **Tinted primary**: `--lg-tint-fill`, the tint opaque in light, 86% in dark.
- **No scroll edge fade.** The first pass painted a ground-coloured fade (75% to 60%) behind both bars; with the bars at 88% on top of it, nothing showed through. It is gone: the 20px blur already turns text under a bar into a smear, and the labels hold contrast on their own (below).
- No SVG refraction: it is Chromium-only in `backdrop-filter` and the main target is Safari on iPhone.

### Overrides of the skill's defaults (and why)
- **Saturation 175%, above the skill's 110-150% "restrained" band** (under its 180% candy line), at Scott's request for colour to glow through. It lifts the orange, the reds and the stage bars; the neutral glass itself does not tint.
- **Glass text a step deeper and heavier**: unselected tab labels are secondary label at semibold (medium thinned out over a moving backdrop); the selected tab is `--lg-tint-ink` (#9a4516, the tint's pressed shade) bold in light, `--tint` #ff9a52 in dark. The job tabs are 15px semibold, secondary label, the current one label colour.
- **The selected pill doubles as the local scrim.** At the lower fill the only labels that failed were the selected tab's over photos (2.7:1 light, 3.2:1 dark with a neutral pill). Following the skill's order (weight first, then a small scrim behind the label only, then the fill), the pill was made brighter than the glass in light and deeper in dark, which fixed it without raising the bar.
- **Opaque tint for the primary inside glass in light** (the skill suggests ~84%): white on #b0501a is 5.2:1 solid and any translucency drops it under 4.5:1. Dark uses 86%.
- **Bars kept edge-to-edge at the top**, the tab bar made a floating capsule: the nav bar holds the side switcher and tools across the width; the tab bar, the job tabs and the Waiting on filter are floating control groups.

### Budget and measurements (24 Sep 2026, second pass, headless Chromium with SwiftShader GL, built app)
- **Measure with GPU rasterisation.** Chromium's default software compositor at device scale 2 draws text under a `backdrop-filter` sharp and faded instead of blurred, so the first pass's screenshots made the blur look weak. Launch with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`; at scale 1 both paths agree.
- **Layers**: phone, most screens: 2 (nav bar, tab bar); the job page, the Waiting on list and My items: 3 (plus the job tabs or the filter), the buzz static there. Desktop: 0 at rest, 1 with the editor footer or the buzz.
- **Contrast over glass** (text-hidden method, 15 points per text box, swept through each page's full scroll in both themes: Overview for Dom and Dominic, Waiting on (all, one job, My items with the buzz), the job page for Dom and for Alec, Program, the item sheet, photos, Today, the editor, desktop Waiting on with the buzz): tab labels 7.2:1 light, 7.1:1 dark; selected tab label 5.3:1 light (photos under the bar), 6.3:1 dark; job tabs 5.0:1 light (Alec's orange Add photo button passing under), 7.0:1 dark; Waiting on filter 5.5:1 or better (its controls are solid); nav bar badge 5.2 / 4.9 (its own fill); buzz primary 5.2 / 5.6; editor footer 5.5 / 4.7. Nothing on glass under 4.5:1 (the disabled Save is 4.7:1).
- **Blur on/off pixel diff** (max channel difference): nav bar 25-104/255, tab bar 28-102, job tabs 65-99, Waiting on filter 60-91, desktop buzz 45-46, editor footer 34-39: all visible, so all keep the blur. The phone buzz is static by budget. On Today (nothing scrolls under the bars) the diff is 0-7; the bars keep one treatment.

## Motion

150ms colour and opacity steps answer hover and press; the banner's 280ms slide-up is the one authored moment. Curves ease out (`cubic-bezier(0.22, 1, 0.36, 1)` for arrivals, `cubic-bezier(0.25, 0.1, 0.25, 1)` for state changes); nothing bounces or overshoots. `prefers-reduced-motion: reduce` collapses every animation and transition to 0.01ms.

## Theming

Light is the default on `:root`; the dark alternate lives under `:root[data-theme='dark']` with the same role names. The shell sets `data-theme` on `<html>` from the session (`theme: light | dark | system`, My settings "Look", `?theme=` in the hash for tests); "system" follows `prefers-color-scheme`. `color-scheme` is set per theme so native controls follow.

## Do's and Don'ts

### Do:
- **Do** start from `.btn`, `.seg`, `.input`, `.field`, `.group`/`.cell`, `.table`, `.plate` and the text-style tokens before writing screen CSS.
- **Do** put content in white cells or cards on the grouped ground, with inset hairline separators.
- **Do** keep one filled tint button per screen; use gray or plain buttons for everything else.
- **Do** pair every status colour with words, and keep red for overdue.
- **Do** give every date its relative time ("Mon 28 Sep, in 5 days").
- **Do** keep targets at 44px, 56px on the site role's screens.

### Don't:
- **Don't** load a web font or name one; the system face is the type.
- **Don't** use amber, a second accent, a gradient, or a shadow on anything that doesn't float.
- **Don't** use orange for headings, status or decoration.
- **Don't** add eyebrow labels, uppercase tracking, or a coloured edge thicker than 1px on a row or card.
- **Don't** hard-code a colour in screen CSS or branch on the theme; every colour is a role from tokens.css.
- **Don't** add bounce, spring overshoot or entrance animations on sections.
