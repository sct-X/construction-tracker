---
name: Construction Tracker
description: A surveyor's readout for a builder's Monday, a builder's phone and a site hand's gloves. Light by default, dark as the alternate.
colors:
  ground: "#f4f2ee"
  well: "#e8e5df"
  plate: "#fbfaf8"
  raised: "#ffffff"
  lifted: "#ffffff"
  wash: "#e9e6e0"
  line: "#dcd8d1"
  line-strong: "#aaa69e"
  text: "#1b1a17"
  text-secondary: "#46443f"
  text-muted: "#66635d"
  ink: "#14130f"
  hivis: "#e8730c"
  hivis-strong: "#d9680a"
  hivis-ink: "#8a4200"
  hivis-wash: "#fde9d6"
  hivis-contrast: "#16110a"
  steel-fill: "#2f3a44"
  steel-outline: "#c6cfd7"
  timber: "#9c7a4b"
  timber-paper: "#f1e8d8"
  late-ink: "#8f1d1d"
  late-bg: "#f8e1de"
  amber-ink: "#7a4c00"
  amber-bg: "#fbeccb"
  ok-ink: "#23532c"
  ok-bg: "#dcebd9"
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
  nested: "6px"
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

**Creative North Star: "The surveyor's readout"**

Every site starts with the surveyor: a graphite instrument on a tripod, orange-flagged pegs, a readout of precise figures that were measured rather than typed. This app is that instrument for the money side of a build. The screen is an instrument face on which the forecast finish and the slip are the readout digits, and everything else (job names, holding costs, the three things a job is waiting on, when it was last confirmed) is the quiet engraving around them. Nothing is decorated; the hierarchy is carried by size and by a three-step ladder of text, and surfaces separate by tone rather than by borders.

It ships light by the client's decision: a warm off-white ground (never pure white for the page), plates a step lighter, the well a step darker, dark ink figures. The same roles map onto a graphite ladder as the dark alternate (My settings: Light, Dark, Match device), so every screen is drawn once from tokens and reads in either. The single accent is the hi-vis orange of a vest and a peg flag, and it appears only where a thumb should land: the one primary action on a screen, the focus ring, the today line on the program, the chosen row of a picker. It is never a heading, never a status, never "you are here".

The redesign replaced a cream ledger with a condensed system face and sentences everywhere. Confirmed rejections: gradient cards, eyebrow labels, stock imagery, sentences that restate what the figure already says, a dev bar that dominates the phone.

**Key Characteristics:**
- Numbers are the largest type on partner screens; a title is smaller than the figures beneath it.
- Tonal surfaces (well, ground, plate, raised, lifted): never pure white for the page, never #000; hairlines only inside a table.
- Words carry every status; the wash only agrees with them. The Monday screen reads printed in greyscale.
- Two faces: a signage grotesque for figures and titles, a legibility face for words; both self-hosted.
- One accent with a short job list; 56px targets on the site role's screens.

## Colors

A warm off-white ladder (graphite in the dark alternate) with one hi-vis accent and three status inks that read as words first. Light values below; dark values in tokens.css under `[data-theme='dark']`.

### Primary
- **Hi-vis** (#e8730c, the vest; #ff8c26 in dark): the single accent. Fills the one primary button per screen (dark ink #16110a on it, 6.9:1), draws the focus ring (#d9680a in light so it holds on the off-white), the today line on the program and the ring on a chosen picker row. **Hi-vis strong** (#d9680a) is its hover; **hi-vis ink** (#8a4200) is orange as text on the **hi-vis wash** (#fde9d6), used for the today label on the program only. Orange is never small text on the light ground (3.2:1).

### Neutral
- **Ground** (#f4f2ee): the page, a warm off-white. **Well** (#e8e5df): sunk regions (the dev bar, the chart ground, the desktop frame behind the site role's phone column).
- **Plate** (#fbfaf8): the sidebar, the phone chrome, a card on the phone, a hovered table row. **Raised** (#ffffff): inputs, chips, a hovered plate. **Lifted** (#ffffff): menus, sheets, the floating buzz, always with a shadow. **Wash** (#e9e6e0): the segmented trough, row bands, hover on the ground.
- **Line** (#dcd8d1) hairlines inside tables and between list rows; **line strong** (#aaa69e) input and button outlines.
- **Text** (#1b1a17, 15:1), **secondary** (#46443f, 9:1), **muted** (#66635d, 5.6:1): the ladder. **Ink** (#14130f): dark text on the orange button.
- **Steel fill** (#2f3a44): a dark fill that takes light text (`--text-on-dark`, #f4f2ee) for pressed segments, chosen pickers, "you are here" and forecast bars. Anything drawn on a steel fill uses `--text-on-dark`, never the text ladder, so it reads in both themes.
- **Timber** (#9c7a4b) and **timber paper** (#f1e8d8): the planned-position outline on the program and note paper. A warm neutral, never a second accent.

### Status (always beside words)
- **Late** #8f1d1d on #f8e1de. **Amber** #7a4c00 on #fbeccb. **Ok** #23532c on #dcebd9. Dark ink on a light wash, 7:1 or better; in the dark alternate the pairs invert to light ink on a dark wash.
- **Late is overdue, and only overdue**: something actually past its date, worded "overdue". It is rare on purpose. On the Overview a job with anything overdue carries one late chip beside its name, "! 2 overdue". **Amber is never a date or urgency cue** (no "coming soon", no "unconfirmed for a week"); it is kept for can't-do-this-yet states: no signal, a failed upload, a hold point's empty photo sets, form problems.

### Named Rules
**The Thumb Rule.** Orange goes where a thumb lands and nowhere else: one primary action per screen, the focus ring, the today line, the chosen picker row. If a screen has no primary action it has no orange.
**The Words First Rule.** Late, amber and ok never appear as colour alone; the wash sits behind "overdue by 3 days", "Didn't send", "On plan". Late and amber words carry a leading "!" so they read in greyscale.
**The Tone Not Border Rule.** Regions separate by stepping the ladder (well, ground, plate, raised), not by outlining. Hairlines live inside tables and lists only.
**The On-Fill Rule.** Text on a steel fill is `--text-on-dark` (dimmed with opacity for a secondary line), never a colour from the text ladder; the ladder flips with the theme, the fill does not.

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

Tonal layering, with one exception. Depth is conveyed by stepping the ladder: well, ground, plate, raised, lifted. Nothing at rest has a shadow. The floating buzz (the in-app stand-in for a phone notification) and future menus and sheets sit on lifted with the one shadow in the system.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 12px 32px rgba(20, 19, 15, 0.16), 0 2px 6px rgba(20, 19, 15, 0.1)`; deeper in dark): menus, sheets, toasts, the buzz. Nothing else.

### Named Rules
**The Flat-At-Rest Rule.** Surfaces are flat; hover steps one rung up the ladder; only floating things cast a shadow.

## Shapes

Radius by element size: 4px for chips, inputs and small controls; 8px for buttons and plates on the desktop; 12px for phone plates, sheets and the buzz; 6px for a control nested inside an 8px trough (a segment inside `.seg`); pill for counts. Borders are 1px hairlines and appear on outlined buttons and inputs only. No coloured edges thicker than 1px on rows, cards or callouts; a callout is a wash with a radius. Icons are hand-drawn inline SVG at 1.6px stroke, 20px, no icon library.

## Components

### Buttons
- **Shape:** 8px radius, 56px tall on the phone and on every primary action, 40px for desktop-only secondary controls (`.btn--desktop`).
- **Primary (`.btn--primary`):** hi-vis fill, dark ink text (#16110a), bold. One per screen.
- **Secondary (`.btn`):** transparent with a line-strong outline, text colour; hover fills raised.
- **Fill (`.btn--fill`):** steel fill with light text, for the pressed half of a pair or a quiet confirm.
- **Ghost (`.btn--ghost`):** text only, secondary colour, for links that need a tap target.
- **Segmented (`.seg` / `.seg__btn`):** a wash trough with a steel-filled pressed segment (`aria-pressed`, light text), 34px on the desktop, 56px on the phone.
- **Focus:** the focus ring everywhere (`0 0 0 2px ground, 0 0 0 4px --focus`, the darker orange in light); inset on full-width rows.

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
- **Desktop sidebar:** plate, "Tracker" wordmark in Barlow 700, links 38px with an 8px radius; hover and current both step to raised, current in the text colour. No per-job list: the job switcher at the top of each job page moves between jobs. Setup group under a hairline. Bell and person at the foot.
- **Phone:** plate top bar (side name in Barlow 700, bell, person), plate tab bar with 56px text tabs; the current tab is the text colour with a 2px top rule in the same colour. Never orange.

### Tables
- **Style (`.table`):** 14px, hairline rows, 20px row padding on Monday, header words muted and regular. Rows are pointer targets (`.table--rows`) and step to plate on hover. Figures in a table are `<BigNumber size="row">` with their in-cell label hidden because the column header names it.

### The Readout (signature)
`<BigNumber>`: a figure in Barlow with a two-word label under it in muted 14px. At `size="row"` it is the unit of the Monday table and of every phone card's first line; at `size="hero"` it is the one big figure on a job or shipment screen. Tone (late, amber, ok, muted) colours the figure only when its words say so.

### The Dev Bar
A 36px well strip above the shell, 12px muted text, controls at 26px, an orange dot beside "dev"; the same in both themes. It collapses to a 24px tag (remembered per browser) and scrolls sideways on a phone rather than wrapping.

### The Offline Bar
A 32px amber wash with a dot and one short line: "No signal. Showing what loaded at 1:09pm. Changes queue until it returns." Never a modal, never red.

## Motion

One authored moment: the buzz slides up 12px over 220ms with `cubic-bezier(0.2, 0, 0, 1)` when a notification arrives. Everything else is a 120ms background or colour step answering hover or press. No entrance animations on sections. `prefers-reduced-motion: reduce` collapses every animation and transition to 0.01ms.

## Theming

Light is the default on `:root`; the dark alternate lives under `:root[data-theme='dark']` with the same role names. The shell sets `data-theme` on `<html>` from the session (`theme: light | dark | system`, My settings "Look", `?theme=` in the hash for tests); "system" follows `prefers-color-scheme`. `color-scheme` is set per theme so native controls follow. Screens never branch on the theme: they use roles.

## Do's and Don'ts

### Do:
- **Do** set the figure larger than the title on any screen that has a figure; `--text-3xl` (32px) for rows, `--text-display` for the hero.
- **Do** step the ladder for regions (well, ground, plate, raised) and reserve hairlines for table and list rows.
- **Do** draw text on a steel fill with `--text-on-dark` so it survives both themes.
- **Do** put every status in words with the chip behind them; add "!" for late and amber.
- **Do** keep one hi-vis control per screen, 56px tall, dark ink on orange.
- **Do** use `.btn`, `.seg`, `.input`, `.table`, `.plate` from base.css before writing screen CSS.
- **Do** keep labels to one or two words and delete sentences that restate the UI (docs/COPY_RULES.md).
- **Do** render nothing (label included) when money is absent; `<Money>` already does.

### Don't:
- **Don't** use orange for headings, "you are here", status or decoration.
- **Don't** use pure white for the page, a gradient anywhere, or a shadow on anything that does not float.
- **Don't** add eyebrow labels, uppercase tracking, middle-dot meta strings, or an arrow after a link.
- **Don't** hard-code a colour in screen CSS or branch on the theme; every colour is a role from tokens.css.
- **Don't** put a coloured edge thicker than 1px on a row, card or callout.
- **Don't** fall back to a system display face; Barlow Semi Condensed is self-hosted and precached.
