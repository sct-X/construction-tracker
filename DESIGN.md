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
  bar: "rgba(249, 249, 251, 0.8)"
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
- Translucent, blurred nav bar and tab bar; a macOS source list on the desktop.
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

Flat at rest. Grouping is tonal: white cells on the grey ground (in dark, #1c1c1e on black). The bars are material, not shadow: translucent fill, `backdrop-filter: saturate(180%) blur(20px)`, a 0.5px hairline edge; without backdrop-filter they fall back to a solid bar colour.

### Shadow Vocabulary
- **Float** (`0 10px 30px rgba(0,0,0,.12), 0 1px 3px rgba(0,0,0,.08)`; deeper in dark): the notification banner (the buzz), menus. Nothing else.
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
- **Phone nav bar (`.topbar`)**: translucent material, 52px, the Cruise mark at left, the side switcher (a gray pop-up button) for Dominic and Norm, then the bell and the person as 44px label-coloured glyphs; the bell's count is a tint badge.
- **Phone tab bar (`.tabbar`)**: translucent material, a 26px glyph over an 11px label; the selected tab is tint with its glyph filled, the rest tertiary label. Glyphs: Overview `square.grid.2x2`, Waiting on `clock`, My items `checklist`, Jobs `house`, Today `calendar`, + Photos `camera`.
- **Desktop sidebar (`.sidebar`)**: a macOS source list, #f5f5f7 (#1c1c1e dark) with a hairline right edge; 34px rows with a 20px glyph, a rounded neutral selection fill and a tint glyph on the current row; "Setup" as a caption header; bell and person at the foot.
- **Large title (`.page-header`)**: an iOS back button (a `chevron.left` and the previous page's name in tint) above the Large Title and a subhead meta line.
- **Job switcher (`JobHeader`)**: the job's name as the Large Title with a `chevron.down` in a small filled disc, the platform's own native menu laid over it. Hover tints the disc; press dims the whole title.

### Banner (the buzz)
A lifted card with the float shadow and a 16px radius at the foot of the screen, a filled tint button and a gray dismiss. It slides up 12px over 280ms with an ease-out curve.

### Offline bar
A thin neutral fill under the nav bar, a grey dot and one footnote line. Never red, never amber, never a modal.

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
