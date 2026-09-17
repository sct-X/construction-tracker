---
name: Construction Tracker
description: A surveyor's night readout for a builder's Monday, a builder's phone and a site hand's gloves.
colors:
  ground: "#131517"
  well: "#0f1113"
  plate: "#1a1d20"
  raised: "#212529"
  lifted: "#2a2f34"
  line: "#2a3035"
  line-strong: "#3f474f"
  text: "#eef0f2"
  text-secondary: "#b9c0c7"
  text-muted: "#8b939c"
  ink: "#0d0f11"
  hivis: "#ff8c26"
  hivis-strong: "#ffa14d"
  hivis-ink: "#ffb069"
  hivis-wash: "#3a2612"
  hivis-contrast: "#16110a"
  steel-fill: "#3a4653"
  steel-outline: "#364049"
  timber: "#b48f60"
  timber-paper: "#26221d"
  late-ink: "#ff8a80"
  late-bg: "#3b1f1d"
  amber-ink: "#f3b94c"
  amber-bg: "#362a10"
  ok-ink: "#7fd6a4"
  ok-bg: "#17311f"
typography:
  display:
    fontFamily: "Barlow Semi Condensed, Avenir Next Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "clamp(2.75rem, 5vw, 3.75rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  figure:
    fontFamily: "Barlow Semi Condensed, Avenir Next Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Barlow Semi Condensed, Avenir Next Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  label:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
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
  button-primary:
    backgroundColor: "{colors.hivis}"
    textColor: "{colors.hivis-contrast}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "56px"
  button-primary-hover:
    backgroundColor: "{colors.hivis-strong}"
    textColor: "{colors.hivis-contrast}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "56px"
  button-secondary-hover:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
  button-fill:
    backgroundColor: "{colors.steel-fill}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "0 20px"
  input:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "56px"
  plate:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "16px"
  status-late:
    backgroundColor: "{colors.late-bg}"
    textColor: "{colors.late-ink}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  status-amber:
    backgroundColor: "{colors.amber-bg}"
    textColor: "{colors.amber-ink}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  status-ok:
    backgroundColor: "{colors.ok-bg}"
    textColor: "{colors.ok-ink}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
---

# Design System: Construction Tracker

## Overview

**Creative North Star: "The surveyor's night readout"**

Every site starts with the surveyor: a graphite instrument on a tripod, orange-flagged pegs, a readout of precise figures that were measured rather than typed. This app is that instrument for the money side of a build. The screen is a dark instrument face on which the forecast finish and the slip are the readout digits, and everything else (job names, holding costs, the three things a job is waiting on, when it was last confirmed) is the quiet engraving around them. Nothing is decorated; the hierarchy is carried by size and by a three-step brightness ladder of text, and surfaces separate by tone rather than by borders.

It is dark because of the scene: a partner reading figures on a desk at 7am, a builder in the ute between calls, a site hand in the sun with the brightness turned up. Dark ground with bright figures survives all three. The single accent is the hi-vis orange of a vest and a peg flag, and it appears only where a thumb should land: the one primary action on a screen, the focus ring, the today line on the program, the chosen row of a picker. It is never a heading, never a status, never "you are here".

The redesign replaced a cream ledger with a condensed system face and sentences everywhere. Confirmed rejections: gradient cards, eyebrow labels, stock imagery, sentences that restate what the figure already says, a dev bar that dominates the phone.

**Key Characteristics:**
- Numbers are the largest type on partner screens; a title is smaller than the figures beneath it.
- Tonal surfaces (ground, plate, raised, lifted), never #000, never a white box, hairlines only inside a table.
- Words carry every status; the wash only agrees with them. The Monday screen reads printed in greyscale.
- Two faces: a signage grotesque for figures and titles, a legibility face for words; both self-hosted.
- One accent with a short job list; 56px targets on the site role's screens.

## Colors

A graphite ladder with one hi-vis accent and three status inks that read as words first.

### Primary
- **Hi-vis** (#ff8c26): the single accent, tuned up from the vest's #e8730c so it holds 8:1 as text on the ground. Fills the one primary button per screen (dark ink #16110a on it, 9:1), draws the focus ring, the today line on the program and the ring on a chosen picker row. **Hi-vis strong** (#ffa14d) is its hover; **hi-vis ink** (#ffb069) is orange as text on the **hi-vis wash** (#3a2612), used for the today label on the program only.

### Neutral
- **Ground** (#131517): the page. **Well** (#0f1113): sunk regions (the dev bar, the desktop frame behind the site role's phone column).
- **Plate** (#1a1d20): the sidebar, the phone chrome, a card on the phone, a hovered table row. **Raised** (#212529): inputs, chips, pressed toggles, a hovered plate. **Lifted** (#2a2f34): menus, sheets, the floating buzz, always with a shadow.
- **Line** (#2a3035) hairlines inside tables and between list rows; **line strong** (#3f474f) input and button outlines.
- **Text** (#eef0f2, 14:1), **secondary** (#b9c0c7, 9:1), **muted** (#8b939c, 5.4:1): the brightness ladder. **Ink** (#0d0f11): dark text on the orange button, and the count badge's text.
- **Steel fill** (#3a4653): a mid fill that takes light text (pressed segmented buttons, "you are here" on the desktop, forecast bars). **Steel outline** (#364049): band edges.
- **Timber** (#b48f60) and **timber paper** (#26221d): the planned-position outline on the program and note paper. A warm neutral, never a second accent.

### Status (always beside words)
- **Late** #ff8a80 on #3b1f1d. **Amber** #f3b94c on #362a10. **Ok** #7fd6a4 on #17311f. Chip contrast is at least 5.5:1; as plain text on the ground the inks are 8:1 or better.

### Named Rules
**The Thumb Rule.** Orange goes where a thumb lands and nowhere else: one primary action per screen, the focus ring, the today line, the chosen picker row. If a screen has no primary action it has no orange.
**The Words First Rule.** Late, amber and ok never appear as colour alone; the wash sits behind "14 days late", "Unconfirmed 9 days", "On plan". Late and amber words carry a leading "!" so they read in greyscale.
**The Tone Not Border Rule.** Regions separate by stepping the ladder (ground to plate to raised), not by outlining. Hairlines live inside tables and lists only.

## Typography

**Display Font:** Barlow Semi Condensed (with Avenir Next Condensed, Arial Narrow, system-ui)
**Body Font:** Atkinson Hyperlegible Next (with system-ui)

**Character:** Barlow comes from the world of road and site signage: a low-contrast grotesque, semi condensed here so "Fri 26 Feb 2027" leads a five-column table without crowding it, with tabular figures. Atkinson Hyperlegible Next was drawn for legibility at a distance and in bad light, which is a phone in the sun in gloves; its unmistakable glyphs (the slashed zero, the tailed l) are a deliberate trait of the readout, not a flaw. Both are self-hosted under `public/fonts` as latin-only WOFF2 (68 KB together), loaded with `font-display: swap` and precached by the service worker so the app reads the same offline. Neither is Inter, Geist, Space Grotesk or Roboto.

### Hierarchy
- **Display** (700, 44px phone / 60px desktop, 1.05): the screen's one hero figure (a job's forecast finish, a shipment's ETA). `.display` in base.css, `<BigNumber size="hero">`.
- **Figure** (600, 30px phone / 32px desktop, 1.05): a row's readout (Monday's finish and slip). `<BigNumber size="row">`.
- **Title** (600, 22px on a readout screen, up to 30/32px on a screen with a hero figure, 1.05): the page title. Always a step below the figures beneath it.
- **Body** (400, 16px, 1.45): words; measure 64ch.
- **Label** (500, 14px, 1.4): column headers, chip words, secondary lines. Sentence case; never tracked, never uppercase.
- **Small** (400, 12px): counts and the dev bar.

### Named Rules
**The Figures Lead Rule.** On a partner screen the largest type is a number or a date, never a heading.
**The Two Words Rule.** A label is one or two words. A sentence on a screen must be a fact the UI cannot show otherwise (see docs/COPY_RULES.md).

## Layout

Desktop: a 236px plate sidebar beside the ground; content up to 1200px with a 32px gutter, tables with 20px row padding and hairlines. Phone (below 768px, and always for the site role): a 56px plate top bar, content with a 16px gutter, a 56px plate tab bar; lists become plates with 16px padding stacked 8px apart. Spacing is a 4px scale (4, 8, 12, 16, 20, 24, 32, 40, 48, 64). More space above a heading than below it: groups are 48px apart, a group title sits 12px above its table. The site role on a wide window gets the phone column at 480px on the well.

## Elevation & Depth

Tonal layering, with one exception. Depth is conveyed by stepping the ladder: ground, plate, raised, lifted. Nothing at rest has a shadow. The floating buzz (the in-app stand-in for a phone notification) and future menus and sheets sit on lifted with the one shadow in the system.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.35)`): menus, sheets, toasts, the buzz. Nothing else.

### Named Rules
**The Flat-At-Rest Rule.** Surfaces are flat; hover steps one rung up the ladder; only floating things cast a shadow.

## Shapes

Radius by element size: 4px for chips, inputs and small controls; 8px for buttons and plates on the desktop; 12px for phone plates, sheets and the buzz; pill for counts. Borders are 1px hairlines and appear on outlined buttons and inputs only. No coloured edges thicker than 1px on rows, cards or callouts; a callout is a wash with a radius. Icons are hand-drawn inline SVG at 1.6px stroke, 20px, no icon library.

## Components

### Buttons
- **Shape:** 8px radius, 56px tall on the phone and on every primary action, 40px for desktop-only secondary controls (`.btn--desktop`).
- **Primary (`.btn--primary`):** hi-vis fill, dark ink text (#16110a), bold. One per screen.
- **Secondary (`.btn`):** transparent with a line-strong outline, text colour; hover fills raised.
- **Fill (`.btn--fill`):** steel fill with light text, for the pressed half of a pair or a quiet confirm.
- **Ghost (`.btn--ghost`):** text only, secondary colour, for links that need a tap target.
- **Segmented (`.seg` / `.seg__btn`):** a raised trough with a steel-filled pressed segment (`aria-pressed`), 34px on the desktop, 44px on the phone.
- **Focus:** the focus ring everywhere (`0 0 0 2px ground, 0 0 0 4px hi-vis`); inset on full-width rows.

### Chips
- **Style (`<StatusText>`):** words on a wash, 14px medium, 4px radius, 2px 8px padding. Tones late, amber, ok; muted and plain drop the wash.
- **State:** never interactive; a chip is a fact.

### Cards / Containers
- **Corner Style:** 12px on the phone (`.plate`), 8px on the desktop.
- **Background:** plate; raised on hover or press.
- **Shadow Strategy:** none.
- **Border:** none.
- **Internal Padding:** 16px, 20px below the last line.

### Inputs / Fields
- **Style:** raised fill, line-strong 1px outline, 4px radius for native controls and 8px for `.input`, 56px tall on the phone (40px with `.input--desktop`). Selects draw their own chevron.
- **Focus:** the outline turns hi-vis; no glow.
- **Disabled:** 50% opacity, not-allowed cursor; the words beside it say why ("Needs signal").

### Navigation
- **Desktop sidebar:** plate, "Tracker" wordmark in Barlow 700, links 38px with an 8px radius; hover and current both step to raised, current in the text colour. Jobs nest under Jobs with a 1px line-strong rule. Setup group under a hairline. Bell and person at the foot.
- **Phone:** plate top bar (side name in Barlow 700, bell, person), plate tab bar with 56px text tabs; the current tab is the text colour with a 2px top rule in the same colour. Never orange.

### Tables
- **Style (`.table`):** 14px, hairline rows, 20px row padding on Monday, header words muted and regular. Rows are pointer targets (`.table--rows`) and step to plate on hover. Figures in a table are `<BigNumber size="row">` with their in-cell label hidden because the column header names it.

### The Readout (signature)
`<BigNumber>`: a figure in Barlow with a two-word label under it in muted 14px. At `size="row"` it is the unit of the Monday table and of every phone card's first line; at `size="hero"` it is the one big figure on a job or shipment screen. Tone (late, amber, ok, muted) colours the figure only when its words say so.

### The Dev Bar
A 36px well strip above the shell, 12px muted text, controls at 26px, an orange dot beside "dev". It collapses to a 24px tag (remembered per browser) and scrolls sideways on a phone rather than wrapping.

### The Offline Bar
A 32px amber wash with a dot and one short line: "No signal. Showing what loaded at 1:09pm. Changes queue until it returns." Never a modal, never red.

## Motion

One authored moment: the buzz slides up 12px over 220ms with `cubic-bezier(0.2, 0, 0, 1)` when a notification arrives. Everything else is a 120ms background or colour step answering hover or press. No entrance animations on sections. `prefers-reduced-motion: reduce` collapses every animation and transition to 0.01ms.

## Theming

Every token lives on `:root` and is overridden under `:root[data-theme='light']` (a cool light ground, not the old cream), so a theme switch is one attribute on `<html>`. Dark is the default; `color-scheme` is set per theme so native controls follow.

## Do's and Don'ts

### Do:
- **Do** set the figure larger than the title on any screen that has a figure; `--text-3xl` (32px) for rows, `--text-display` for the hero.
- **Do** step the ladder for regions (ground, plate, raised) and reserve hairlines for table and list rows.
- **Do** put every status in words with the chip behind them; add "!" for late and amber.
- **Do** keep one hi-vis control per screen, 56px tall, dark ink on orange.
- **Do** use `.btn`, `.seg`, `.input`, `.table`, `.plate` from base.css before writing screen CSS.
- **Do** keep labels to one or two words and delete sentences that restate the UI (docs/COPY_RULES.md).
- **Do** render nothing (label included) when money is absent; `<Money>` already does.

### Don't:
- **Don't** use orange for headings, "you are here", status or decoration.
- **Don't** use a white or near-white box on the dark ground, a gradient anywhere, or a shadow on anything that does not float.
- **Don't** add eyebrow labels, uppercase tracking, middle-dot meta strings, or an arrow after a link.
- **Don't** hard-code a colour in screen CSS; every colour is a token from tokens.css.
- **Don't** put a coloured edge thicker than 1px on a row, card or callout.
- **Don't** fall back to a system display face; Barlow Semi Condensed is self-hosted and precached.
