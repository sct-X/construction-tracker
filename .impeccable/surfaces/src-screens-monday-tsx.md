---
version: 1
slug: "src-screens-monday-tsx"
primary_target: "src/screens/Monday.tsx"
related_targets: ["src/screens/monday.css","src/styles/tokens.css","src/shell/AppShell.tsx"]
---

# Surface brief: Monday screen (reference screen for the dark-mode redesign)

Scope: replacement visual world for the whole app; Monday is the exemplar. Mode: Operate.
Audience and job: Dom and Norm, desktop, Monday 9am: which job moved, how many days, what it costs, why. Raff reads the same rows on a phone. Alec is refused here.
Proof/content: seed data (Beatty +5 days $1,430; Seaview 0; Park Rd 0; four design jobs). Every data-testid and every e2e-asserted word stays.
Constraints: hi-vis orange the single accent; colour never alone; numbers largest; money via <Money> only; no eyebrows, gradients, stock imagery.

## Grounded candidates (ordered by resonance; the roll assigned 4)
1. Roadworks VMS board: amber LED numerals on black. 2. Departures split-flap board. 3. Night chart-plotter instrument panel. 4. The surveyor's setout: total-station readout and field book, orange-flagged pegs. 5. Hi-vis PPE and AS 1319 site signage. 6. CAD viewport on dark with white linework. 7. The certifier's inspection stamp ledger.
Rut kept out: the SaaS dark dashboard of cards and rings; its opposite, the cream broadsheet ledger (the incumbent).

## Challenger verdicts (seed 4cab3465)
Cracktro queue: declined (void, no enclosure, breaks table scanning). Raise kept: hierarchy by a three-step brightness ladder, not chip colour.
Darkroom safelight: declined (amber as ground conflicts with amber-as-warning). Raise kept: preview before commit is a system rule.
TDR sleeve: declined (noise). Raise kept: the one big figure never shrinks below 40px.
PC98 field: declined. Raise kept: chrome regions are fixed; navigation swaps content, never layout.
Miura sheet: declined. Raise kept: phone cards deploy figures first, detail below, always the same order.
Gravity garden: declined (no product truth). Raise kept: one held-level reference: the today line on the program.

## Direction contract
THESIS: The forecast is measured, not typed. The screen is a surveyor's night readout: a graphite instrument face where the finish date and the slip are the readout digits, and everything else is the quiet engraving around them. It refuses the card dashboard and the prose ledger.
OWN-WORLD: tonal graphite (ground, well, plate, raised) separated by tone not borders; one hairline scale; text in a three-step brightness ladder; Barlow Semi Condensed for every figure and title, Atkinson Hyperlegible Next for words; hi-vis orange only where a thumb lands, plus the focus ring and the today line; late/amber/ok as words with a tinted wash. Radius 4/8/12; shadow only on floating things.
STORY: Dom sees three dates and one orange-free red figure in a second, knows Beatty moved 5 days and cost $1,430, taps the figure for why.
FIRST VIEWPORT (1280): "Monday" small at top left, week and the since-toggle on one line right. A readout table: job name (plate row), finish date 34px, slip 34px coloured, holding, three waiting-on lines, confirmed words. No in-cell labels, no sentences. Phone: one plate per job, date and slip stacked as the hero row, three lines under, confirmed last.
FORM: grounded candidate 4 of 7 (surveyor's setout); seed key 4cab3465; code-led (no image generation).
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
