# Telegram samples, after

What the bot and the scheduler send after the formatting change (Telegram HTML parse mode), from the fake Telegram harness on the seed, clock fixed at Thu 17 Sep 2026 (the long digest: Sat 10 Oct). Each sample shows the raw HTML sent, then the same text with the markup stripped (Telegram shows the `<b>` parts bold and the `<i>` parts in italics). Before: docs/telegram-samples-before.md.

Vocabulary: a bold first line saying what it is about; "before → **after**" on its own line; blank lines between blocks; "•" bullets; the transcript as "Heard: *...*"; two marks only, "⚠️ Overdue by ..." and "Saved ✓".

Regenerate: `npx tsx --tsconfig packages/bot/tsconfig.json packages/bot/test/telegramSamples.ts docs/telegram-samples-after.md`

## Confirm card (flow a: "Park Rd windows now arriving 16 Nov")

Raw (parse_mode HTML):

```
<b>Park Rd · Windows ETA</b>

Mon 26 Oct → <b>Mon 16 Nov</b>

• Install windows: Mon 2 Nov → <b>Mon 16 Nov</b>
• External doors: Mon 16 Nov → <b>Mon 30 Nov</b>
• Rough-in plumbing and electrical: Mon 23 Nov → <b>Mon 7 Dec</b>
• Insulation: Mon 7 Dec → <b>Mon 11 Jan 2027</b>
• and 8 more steps move
Finish Fri 26 Feb 2027 → <b>Fri 12 Mar 2027</b>
+14 days · $9,000 holding cost since last Monday

Save this?
```

As Dominic reads it (markup stripped):

```
Park Rd · Windows ETA

Mon 26 Oct → Mon 16 Nov

• Install windows: Mon 2 Nov → Mon 16 Nov
• External doors: Mon 16 Nov → Mon 30 Nov
• Rough-in plumbing and electrical: Mon 23 Nov → Mon 7 Dec
• Insulation: Mon 7 Dec → Mon 11 Jan 2027
• and 8 more steps move
Finish Fri 26 Feb 2027 → Fri 12 Mar 2027
+14 days · $9,000 holding cost since last Monday

Save this?
```

Buttons: [Confirm] [Edit] [Cancel]

## Saved (the card after Confirm)

Raw (parse_mode HTML):

```
<b>Saved ✓</b>
Park Rd windows ETA Mon 26 Oct to Mon 16 Nov.

Park Rd finishes <b>Fri 12 Mar 2027</b>: +14 days · $9,000 holding cost since last Monday
```

As Dominic reads it (markup stripped):

```
Saved ✓
Park Rd windows ETA Mon 26 Oct to Mon 16 Nov.

Park Rd finishes Fri 12 Mar 2027: +14 days · $9,000 holding cost since last Monday
```

Buttons: [Undo]

## Undo (/undo reply)

Raw (parse_mode HTML):

```
<b>Undone</b>
Park Rd windows ETA Mon 26 Oct to Mon 16 Nov.

Park Rd finishes <b>Fri 26 Feb 2027</b>, on track
```

As Dominic reads it (markup stripped):

```
Undone
Park Rd windows ETA Mon 26 Oct to Mon 16 Nov.

Park Rd finishes Fri 26 Feb 2027, on track
```

## Undone (the card after undo)

Raw (parse_mode HTML):

```
<b>Undone</b>
Park Rd windows ETA Mon 26 Oct to Mon 16 Nov.
```

As Dominic reads it (markup stripped):

```
Undone
Park Rd windows ETA Mon 26 Oct to Mon 16 Nov.
```

## Cancelled (the card after Cancel)

Raw (parse_mode HTML):

```
<b>Cancelled</b> · nothing saved
Park Rd windows ETA Mon 26 Oct to Mon 16 Nov.
```

As Dominic reads it (markup stripped):

```
Cancelled · nothing saved
Park Rd windows ETA Mon 26 Oct to Mon 16 Nov.
```

## Edit (the card after Edit)

Raw (parse_mode HTML):

```
<b>Changing this one</b> · not saved
Park Rd windows ETA Mon 26 Oct to Mon 9 Nov.
```

As Dominic reads it (markup stripped):

```
Changing this one · not saved
Park Rd windows ETA Mon 26 Oct to Mon 9 Nov.
```

## Edit (the follow-up question)

Raw (parse_mode HTML):

```
What should it be instead? Send the correction and I'll make a new card.
```

As Dominic reads it (markup stripped):

```
What should it be instead? Send the correction and I'll make a new card.
```

## Multi-field card ("pump booked at seaview for fri 2 oct")

Raw (parse_mode HTML):

```
<b>Seaview St · Book concrete pump</b>

Status: To do → <b>Ordered or booked</b>
Expected date: none → <b>Fri 2 Oct</b>

No change to the finish (Fri 29 Oct 2027)

Save this?
```

As Dominic reads it (markup stripped):

```
Seaview St · Book concrete pump

Status: To do → Ordered or booked
Expected date: none → Fri 2 Oct

No change to the finish (Fri 29 Oct 2027)

Save this?
```

Buttons: [Confirm] [Edit] [Cancel]

## Confirm card, job confirmed again ("beatty all checked")

Raw (parse_mode HTML):

```
<b>Beatty St · Last confirmed</b>

Tue 8 Sep → <b>Thu 17 Sep</b>

No change to the finish (Fri 4 Dec)
Confirmed again: it hadn't been confirmed for 9 days

Save this?
```

As Dominic reads it (markup stripped):

```
Beatty St · Last confirmed

Tue 8 Sep → Thu 17 Sep

No change to the finish (Fri 4 Dec)
Confirmed again: it hadn't been confirmed for 9 days

Save this?
```

Buttons: [Confirm] [Edit] [Cancel]

## Photo tip (first compressed photo only)

Raw (parse_mode HTML):

```
Tip: to keep a photo at full resolution, send it as a file (paperclip, then File) instead of as a photo. Telegram shrinks normal photos. This one is filed either way.
```

As Dominic reads it (markup stripped):

```
Tip: to keep a photo at full resolution, send it as a file (paperclip, then File) instead of as a photo. Telegram shrinks normal photos. This one is filed either way.
```

## Photo card (caption "Seaview plumbing under slab")

Raw (parse_mode HTML):

```
<b>Seaview St · New photo</b>

Photo filed: Seaview St, Slab, Plumbing under slab.

No change to the finish (Fri 29 Oct 2027)

Slab inspection before pour photos: 2 of 3. Still needed: Membrane and termite barrier.

Save this?
```

As Dominic reads it (markup stripped):

```
Seaview St · New photo

Photo filed: Seaview St, Slab, Plumbing under slab.

No change to the finish (Fri 29 Oct 2027)

Slab inspection before pour photos: 2 of 3. Still needed: Membrane and termite barrier.

Save this?
```

Buttons: [Confirm] [Edit] [Cancel]

## Photo saved (the card after Confirm)

Raw (parse_mode HTML):

```
<b>Saved ✓</b>
Photo filed: Seaview St, Slab, Plumbing under slab.

Seaview St finishes <b>Fri 29 Oct 2027</b>, on track
Slab inspection before pour photos: 2 of 3. Still needed: Membrane and termite barrier.
```

As Dominic reads it (markup stripped):

```
Saved ✓
Photo filed: Seaview St, Slab, Plumbing under slab.

Seaview St finishes Fri 29 Oct 2027, on track
Slab inspection before pour photos: 2 of 3. Still needed: Membrane and termite barrier.
```

Buttons: [Undo]

## Ambiguity question ("the windows are late")

Raw (parse_mode HTML):

```
Which shipment do you mean by "the windows"?
```

As Dominic reads it (markup stripped):

```
Which shipment do you mean by "the windows"?
```

Buttons: [Park Rd windows (Park Rd)] [Seaview St windows (Seaview St)]

## Question after a button is pressed (edited)

Raw (parse_mode HTML):

```
Which shipment do you mean by "the windows"?
→ <b>Park Rd windows (Park Rd)</b>
```

As Dominic reads it (markup stripped):

```
Which shipment do you mean by "the windows"?
→ Park Rd windows (Park Rd)
```

## Next question (no buttons)

Raw (parse_mode HTML):

```
What is the new ETA?
```

As Dominic reads it (markup stripped):

```
What is the new ETA?
```

## Hold-point refusal (flow b, voice note "slab inspection at Seaview is done")

Raw (parse_mode HTML):

```
<b>Seaview St · Slab inspection before pour</b>

Heard: <i>slab inspection at Seaview is done</i>

Can't sign it off yet. No photos for:
• Plumbing under slab
• Membrane and termite barrier

Nothing saved.
```

As Dominic reads it (markup stripped):

```
Seaview St · Slab inspection before pour

Heard: slab inspection at Seaview is done

Can't sign it off yet. No photos for:
• Plumbing under slab
• Membrane and termite barrier

Nothing saved.
```

## Voice note card ("beatty all checked", spoken)

Raw (parse_mode HTML):

```
<b>Beatty St · Last confirmed</b>

Heard: <i>beatty all checked</i>

Tue 8 Sep → <b>Thu 17 Sep</b>

No change to the finish (Fri 4 Dec)
Confirmed again: it hadn't been confirmed for 9 days

Save this?
```

As Dominic reads it (markup stripped):

```
Beatty St · Last confirmed

Heard: beatty all checked

Tue 8 Sep → Thu 17 Sep

No change to the finish (Fri 4 Dec)
Confirmed again: it hadn't been confirmed for 9 days

Save this?
```

Buttons: [Confirm] [Edit] [Cancel]

## Finish answer ("what's Park Rd's finish?")

Raw (parse_mode HTML):

```
<b>Park Rd · Finish</b>
<b>Fri 26 Feb 2027</b>, on track
```

As Dominic reads it (markup stripped):

```
Park Rd · Finish
Fri 26 Feb 2027, on track
```

## Waiting-on answer ("what are we waiting on at Park Rd?")

Raw (parse_mode HTML):

```
<b>Park Rd · Waiting on</b>
27 outstanding, 3 overdue

• ⚠️ Overdue by 3 days: Tile choice (Dominic), needed Mon 14 Sep
• ⚠️ Overdue by 1 day: Book cladders (Solid Frame Carpentry), needed Wed 16 Sep, expected Wed 16 Sep
• ⚠️ Overdue by 1 day: Order cladding (Cladding supplier), needed Wed 16 Sep, expected Tue 15 Sep
• Glazing energy compliance certificate (Jade Coast Windows): act by Mon 10 Aug (passed)
• Sliding doors (Jade Coast Windows): expected Mon 26 Oct
• Windows (Jade Coast Windows): expected Mon 26 Oct
• Stormwater connection approval (Council): expected Fri 18 Sep
• Book plumber for stormwater (Clearflow Plumbing): expected Mon 21 Sep

…and 19 more.
```

As Dominic reads it (markup stripped):

```
Park Rd · Waiting on
27 outstanding, 3 overdue

• ⚠️ Overdue by 3 days: Tile choice (Dominic), needed Mon 14 Sep
• ⚠️ Overdue by 1 day: Book cladders (Solid Frame Carpentry), needed Wed 16 Sep, expected Wed 16 Sep
• ⚠️ Overdue by 1 day: Order cladding (Cladding supplier), needed Wed 16 Sep, expected Tue 15 Sep
• Glazing energy compliance certificate (Jade Coast Windows): act by Mon 10 Aug (passed)
• Sliding doors (Jade Coast Windows): expected Mon 26 Oct
• Windows (Jade Coast Windows): expected Mon 26 Oct
• Stormwater connection approval (Council): expected Fri 18 Sep
• Book plumber for stormwater (Clearflow Plumbing): expected Mon 21 Sep

…and 19 more.
```

## Waiting-on answer ("what are we waiting on at Beatty?")

Raw (parse_mode HTML):

```
<b>Beatty St · Waiting on</b>
7 outstanding

• Book tiler (Harbour Tiling): expected Mon 5 Oct, 7 days late (needed Mon 28 Sep)
• Order joinery (Oakline Joinery): expected Fri 9 Oct
• Book painter (Fresh Coat Painting): expected Mon 12 Oct
• Order tiles (Tile warehouse): act by Mon 28 Sep
• Order vanity and tapware (Bathroom supplier): act by Mon 5 Oct
• Leaking window flashing, bedroom 2 (Solid Frame Carpentry): expected Thu 24 Sep
• Driveway kerb and layback detail (Dominic): act by Fri 16 Oct
```

As Dominic reads it (markup stripped):

```
Beatty St · Waiting on
7 outstanding

• Book tiler (Harbour Tiling): expected Mon 5 Oct, 7 days late (needed Mon 28 Sep)
• Order joinery (Oakline Joinery): expected Fri 9 Oct
• Book painter (Fresh Coat Painting): expected Mon 12 Oct
• Order tiles (Tile warehouse): act by Mon 28 Sep
• Order vanity and tapware (Bathroom supplier): act by Mon 5 Oct
• Leaking window flashing, bedroom 2 (Solid Frame Carpentry): expected Thu 24 Sep
• Driveway kerb and layback detail (Dominic): act by Fri 16 Oct
```

## Waiting-on answer, all jobs ("what are we waiting on?")

Raw (parse_mode HTML):

```
<b>All jobs · Waiting on</b>
47 outstanding, 4 overdue

<b>Park Rd</b>
• ⚠️ Overdue by 3 days: Tile choice (Dominic), needed Mon 14 Sep
• ⚠️ Overdue by 1 day: Book cladders (Solid Frame Carpentry), needed Wed 16 Sep, expected Wed 16 Sep
• ⚠️ Overdue by 1 day: Order cladding (Cladding supplier), needed Wed 16 Sep, expected Tue 15 Sep
• Glazing energy compliance certificate (Jade Coast Windows): act by Mon 10 Aug (passed)
• Sliding doors (Jade Coast Windows): expected Mon 26 Oct
• Windows (Jade Coast Windows): expected Mon 26 Oct

<b>Seaview St</b>
• ⚠️ Overdue by 3 days: Order slab steel (Steel supplier), needed Mon 14 Sep, expected Wed 16 Sep

<b>Beatty St</b>
• Book tiler (Harbour Tiling): expected Mon 5 Oct, 7 days late (needed Mon 28 Sep)

…and 39 more.
```

As Dominic reads it (markup stripped):

```
All jobs · Waiting on
47 outstanding, 4 overdue

Park Rd
• ⚠️ Overdue by 3 days: Tile choice (Dominic), needed Mon 14 Sep
• ⚠️ Overdue by 1 day: Book cladders (Solid Frame Carpentry), needed Wed 16 Sep, expected Wed 16 Sep
• ⚠️ Overdue by 1 day: Order cladding (Cladding supplier), needed Wed 16 Sep, expected Tue 15 Sep
• Glazing energy compliance certificate (Jade Coast Windows): act by Mon 10 Aug (passed)
• Sliding doors (Jade Coast Windows): expected Mon 26 Oct
• Windows (Jade Coast Windows): expected Mon 26 Oct

Seaview St
• ⚠️ Overdue by 3 days: Order slab steel (Steel supplier), needed Mon 14 Sep, expected Wed 16 Sep

Beatty St
• Book tiler (Harbour Tiling): expected Mon 5 Oct, 7 days late (needed Mon 28 Sep)

…and 39 more.
```

## Shipments answer ("where are the shipments at?")

Raw (parse_mode HTML):

```
<b>Shipments</b>

• Park Rd windows: ETA Mon 26 Oct, in production
• Seaview St windows: ETA Mon 14 Dec, design
```

As Dominic reads it (markup stripped):

```
Shipments

• Park Rd windows: ETA Mon 26 Oct, in production
• Seaview St windows: ETA Mon 14 Dec, design
```

## Why it moved ("why did Beatty slip?")

Raw (parse_mode HTML):

```
<b>Beatty St · Why it moved</b>
Finishes <b>Fri 4 Dec</b>: +5 days · $1,430 holding cost since Mon 14 Sep

• Book tiler at Beatty St expected Mon 28 Sep to Mon 5 Oct: +7 days
• 2 days earlier for reasons not in the change log
```

As Dominic reads it (markup stripped):

```
Beatty St · Why it moved
Finishes Fri 4 Dec: +5 days · $1,430 holding cost since Mon 14 Sep

• Book tiler at Beatty St expected Mon 28 Sep to Mon 5 Oct: +7 days
• 2 days earlier for reasons not in the change log
```

## Next hold point ("are we right for the slab inspection at Seaview?")

Raw (parse_mode HTML):

```
<b>Seaview St · Next hold point</b>
Slab inspection before pour, Mon 28 Sep

1 of 3 photo categories filled. Still need:
• Plumbing under slab
• Membrane and termite barrier
```

As Dominic reads it (markup stripped):

```
Seaview St · Next hold point
Slab inspection before pour, Mon 28 Sep

1 of 3 photo categories filled. Still need:
• Plumbing under slab
• Membrane and termite barrier
```

## To chase ("what do I need to chase?")

Raw (parse_mode HTML):

```
<b>To chase</b>
19 items in the next two weeks, 1 overdue

<b>Park Rd</b>
• ⚠️ Overdue by 3 days: Tile choice (Dominic), needed Mon 14 Sep
• Glazing energy compliance certificate (Jade Coast Windows): act by Mon 10 Aug (passed)
• Book plasterer (Smooth Wall Plastering): act by Fri 18 Sep
• Cracked roof tiles above garage (Solid Frame Carpentry): act by Fri 25 Sep
• Renew site insurance (Dominic): act by Thu 1 Oct
• Sliding doors (Jade Coast Windows): expected Mon 26 Oct
• Windows (Jade Coast Windows): expected Mon 26 Oct

<b>Beatty St</b>
• Book tiler (Harbour Tiling): expected Mon 5 Oct, 7 days late (needed Mon 28 Sep)

…and 11 more.
```

As Dominic reads it (markup stripped):

```
To chase
19 items in the next two weeks, 1 overdue

Park Rd
• ⚠️ Overdue by 3 days: Tile choice (Dominic), needed Mon 14 Sep
• Glazing energy compliance certificate (Jade Coast Windows): act by Mon 10 Aug (passed)
• Book plasterer (Smooth Wall Plastering): act by Fri 18 Sep
• Cracked roof tiles above garage (Solid Frame Carpentry): act by Fri 25 Sep
• Renew site insurance (Dominic): act by Thu 1 Oct
• Sliding doors (Jade Coast Windows): expected Mon 26 Oct
• Windows (Jade Coast Windows): expected Mon 26 Oct

Beatty St
• Book tiler (Harbour Tiling): expected Mon 5 Oct, 7 days late (needed Mon 28 Sep)

…and 11 more.
```

## Design job finish ("what's West St's finish?")

Raw (parse_mode HTML):

```
<b>West St · Finish</b>
West St is a design job, so it has no finish date. It's at the Pending approval stage.
```

As Dominic reads it (markup stripped):

```
West St · Finish
West St is a design job, so it has no finish date. It's at the Pending approval stage.
```

## Daily reminder digest (scheduler, Thu 17 Sep)

Raw (parse_mode HTML):

```
<b>Reminders · Thu 17 Sep</b>

<b>Park Rd</b>
• ⚠️ Overdue by 5 weeks: Glazing energy compliance certificate, act by Mon 10 Aug
• ⚠️ Overdue by 3 days: Tile choice, act by Mon 14 Sep
• Book plasterer: act by Fri 18 Sep (tomorrow)

<b>Seaview St</b>
• Book concrete pump: act by Fri 18 Sep (tomorrow)

<b>Beatty St</b> · not confirmed for 9 days. Check it and confirm the job.
```

As Dominic reads it (markup stripped):

```
Reminders · Thu 17 Sep

Park Rd
• ⚠️ Overdue by 5 weeks: Glazing energy compliance certificate, act by Mon 10 Aug
• ⚠️ Overdue by 3 days: Tile choice, act by Mon 14 Sep
• Book plasterer: act by Fri 18 Sep (tomorrow)

Seaview St
• Book concrete pump: act by Fri 18 Sep (tomorrow)

Beatty St · not confirmed for 9 days. Check it and confirm the job.
```

## Daily reminder digest (scheduler, Sat 10 Oct, seed unchanged: a long one)

Raw (parse_mode HTML):

```
<b>Reminders · Sat 10 Oct</b>

<b>Beatty St</b> · not confirmed for 32 days. Check it and confirm the job.
• ⚠️ Overdue by 12 days: Order tiles, act by Mon 28 Sep
• ⚠️ Overdue by 5 days: Order vanity and tapware, act by Mon 5 Oct

<b>Park Rd</b> · not confirmed for 25 days. Check it and confirm the job.
• ⚠️ Overdue by 8 weeks: Glazing energy compliance certificate, act by Mon 10 Aug
• ⚠️ Overdue by 3 weeks: Tile choice, act by Mon 14 Sep
• ⚠️ Overdue by 3 weeks: Book plasterer, act by Fri 18 Sep
• ⚠️ Overdue by 2 weeks: Cracked roof tiles above garage, act by Fri 25 Sep
• ⚠️ Overdue by 9 days: Renew site insurance, act by Thu 1 Oct
• ⚠️ Overdue by 5 days: Order external doors, act by Mon 5 Oct
• ⚠️ Overdue by 5 days: Stormwater inspection, act by Mon 5 Oct

<b>Seaview St</b> · not confirmed for 24 days. Check it and confirm the job.
• ⚠️ Overdue by 3 weeks: Book concrete pump, act by Fri 18 Sep
• ⚠️ Overdue by 2 weeks: Termite barrier certificate before pour, act by Fri 25 Sep

+6 more. Send /reminders for the full list.
```

As Dominic reads it (markup stripped):

```
Reminders · Sat 10 Oct

Beatty St · not confirmed for 32 days. Check it and confirm the job.
• ⚠️ Overdue by 12 days: Order tiles, act by Mon 28 Sep
• ⚠️ Overdue by 5 days: Order vanity and tapware, act by Mon 5 Oct

Park Rd · not confirmed for 25 days. Check it and confirm the job.
• ⚠️ Overdue by 8 weeks: Glazing energy compliance certificate, act by Mon 10 Aug
• ⚠️ Overdue by 3 weeks: Tile choice, act by Mon 14 Sep
• ⚠️ Overdue by 3 weeks: Book plasterer, act by Fri 18 Sep
• ⚠️ Overdue by 2 weeks: Cracked roof tiles above garage, act by Fri 25 Sep
• ⚠️ Overdue by 9 days: Renew site insurance, act by Thu 1 Oct
• ⚠️ Overdue by 5 days: Order external doors, act by Mon 5 Oct
• ⚠️ Overdue by 5 days: Stormwater inspection, act by Mon 5 Oct

Seaview St · not confirmed for 24 days. Check it and confirm the job.
• ⚠️ Overdue by 3 weeks: Book concrete pump, act by Fri 18 Sep
• ⚠️ Overdue by 2 weeks: Termite barrier certificate before pour, act by Fri 25 Sep

+6 more. Send /reminders for the full list.
```

## /reminders

Raw (parse_mode HTML):

```
<b>Reminders due now · Thu 17 Sep</b>
You asked, so this includes any already sent today.

<b>Park Rd</b>
• ⚠️ Overdue by 5 weeks: Glazing energy compliance certificate, act by Mon 10 Aug
• ⚠️ Overdue by 3 days: Tile choice, act by Mon 14 Sep
• Book plasterer: act by Fri 18 Sep (tomorrow)

<b>Seaview St</b>
• Book concrete pump: act by Fri 18 Sep (tomorrow)

<b>Beatty St</b> · not confirmed for 9 days. Check it and confirm the job.
```

As Dominic reads it (markup stripped):

```
Reminders due now · Thu 17 Sep
You asked, so this includes any already sent today.

Park Rd
• ⚠️ Overdue by 5 weeks: Glazing energy compliance certificate, act by Mon 10 Aug
• ⚠️ Overdue by 3 days: Tile choice, act by Mon 14 Sep
• Book plasterer: act by Fri 18 Sep (tomorrow)

Seaview St
• Book concrete pump: act by Fri 18 Sep (tomorrow)

Beatty St · not confirmed for 9 days. Check it and confirm the job.
```

## Error: the language model did not answer

Raw (parse_mode HTML):

```
I couldn't read that just now (the language model didn't answer). Try again in a minute. Nothing saved.
```

As Dominic reads it (markup stripped):

```
I couldn't read that just now (the language model didn't answer). Try again in a minute. Nothing saved.
```

## Error: something went wrong on our side

Raw (parse_mode HTML):

```
Something went wrong on my side, so nothing was saved. Try again in a minute.
```

As Dominic reads it (markup stripped):

```
Something went wrong on my side, so nothing was saved. Try again in a minute.
```

## Error: no model key

Raw (parse_mode HTML):

```
I can't read messages yet: add a model key to .env.
```

As Dominic reads it (markup stripped):

```
I can't read messages yet: add a model key to .env.
```

## Error: no such job

Raw (parse_mode HTML):

```
I can't find a job called "Nowhere Rd".
```

As Dominic reads it (markup stripped):

```
I can't find a job called "Nowhere Rd".
```

## /undo with no card to reply to (the seed: undoes the seeded voice-note change)

Raw (parse_mode HTML):

```
<b>Undone</b>
Seaview St confirmed Wed 16 Sep.

Seaview St finishes <b>Fri 29 Oct 2027</b>, on track
```

As Dominic reads it (markup stripped):

```
Undone
Seaview St confirmed Wed 16 Sep.

Seaview St finishes Fri 29 Oct 2027, on track
```

## Error: not a photo

Raw (parse_mode HTML):

```
That file isn't a photo I can keep: I take JPEG, PNG, WebP or HEIC. Nothing saved.
```

As Dominic reads it (markup stripped):

```
That file isn't a photo I can keep: I take JPEG, PNG, WebP or HEIC. Nothing saved.
```

## /help

Raw (parse_mode HTML):

```
<b>How this works</b>
• Tell me a change in plain words or a voice note, e.g. "Park Rd windows now arriving 16 Nov". I'll show a card to confirm.
• Send site photos with a caption like "Seaview plumbing under slab". Sent as a file keeps full resolution.
• Ask things like "what's Park Rd's finish?" or "what are we waiting on at Beatty?"
• /reminders shows what's due. /undo reverses the last saved change.
```

As Dominic reads it (markup stripped):

```
How this works
• Tell me a change in plain words or a voice note, e.g. "Park Rd windows now arriving 16 Nov". I'll show a card to confirm.
• Send site photos with a caption like "Seaview plumbing under slab". Sent as a file keeps full resolution.
• Ask things like "what's Park Rd's finish?" or "what are we waiting on at Beatty?"
• /reminders shows what's due. /undo reverses the last saved change.
```
