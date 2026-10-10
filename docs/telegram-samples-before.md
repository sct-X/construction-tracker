# Telegram samples, before

What the bot and the scheduler sent before the formatting change (plain text, no parse mode), from the fake Telegram harness on the seed, clock fixed at Thu 17 Sep 2026.

## Confirm card (flow a: "Park Rd windows now arriving 16 Nov")

```
Park Rd windows ETA Mon 26 Oct to Mon 16 Nov.

- Park Rd windows, ETA: Mon 26 Oct → Mon 16 Nov

Park Rd:
- Install windows starts Mon 16 Nov (was Mon 2 Nov)
- External doors starts Mon 30 Nov (was Mon 16 Nov)
- Rough-in plumbing and electrical starts Mon 7 Dec (was Mon 23 Nov)
- Insulation starts Mon 11 Jan 2027 (was Mon 7 Dec)
- and 8 more steps move
- Finish Fri 12 Mar 2027 (was Fri 26 Feb 2027)
- Slip +14 days, $9,000 since last Monday

Save this?
```

Buttons: [Confirm] [Edit] [Cancel]

## Saved (the card after Confirm)

```
Saved. Park Rd windows ETA Mon 26 Oct to Mon 16 Nov.
Park Rd finishes Fri 12 Mar 2027, +14 days, $9,000 since last Monday.
```

Buttons: [Undo]

## Undo (/undo reply)

```
Undone: Park Rd windows ETA Mon 26 Oct to Mon 16 Nov.
Park Rd finishes Fri 26 Feb 2027, on track.
```

## Undone (the card after undo)

```
Undone: Park Rd windows ETA Mon 26 Oct to Mon 16 Nov.
```

## Cancelled (the card after Cancel)

```
Cancelled, nothing saved: Park Rd windows ETA Mon 26 Oct to Mon 16 Nov.
```

## Edit (the card after Edit)

```
Changing this one (not saved): Park Rd windows ETA Mon 26 Oct to Mon 9 Nov.
```

## Edit (the follow-up question)

```
What should it be instead? Send the correction and I'll make a new card.
```

## Multi-field card ("pump booked at seaview for fri 2 oct")

```
Book concrete pump at Seaview St: To do to Ordered or booked, expected Fri 2 Oct.

- Book concrete pump, status: To do → Ordered or booked
- Book concrete pump, expected date: none → Fri 2 Oct

Seaview St:
- No change to the forecast (finish Fri 29 Oct 2027)

Save this?
```

Buttons: [Confirm] [Edit] [Cancel]

## Confirm card, job confirmed again ("beatty all checked")

```
Beatty St confirmed Thu 17 Sep.

- Beatty St, last confirmed: Tue 8 Sep → Thu 17 Sep

Beatty St:
- No change to the forecast (finish Fri 4 Dec)
- Confirmed again: it hadn't been confirmed for 9 days

Save this?
```

Buttons: [Confirm] [Edit] [Cancel]

## Photo tip (first compressed photo only)

```
Tip: to keep a photo at full resolution, send it as a file (paperclip, then File) instead of as a photo. Telegram shrinks normal photos. This one is filed either way.
```

## Photo card (caption "Seaview plumbing under slab")

```
Photo filed: Seaview St, Slab, Plumbing under slab.

- New photo: Plumbing under slab (Seaview St)

Seaview St:
- No change to the forecast (finish Fri 29 Oct 2027)

Slab inspection before pour photos: 2 of 3. Still needed: Membrane and termite barrier.

Save this?
```

Buttons: [Confirm] [Edit] [Cancel]

## Photo saved (the card after Confirm)

```
Saved. Photo filed: Seaview St, Slab, Plumbing under slab.
Seaview St finishes Fri 29 Oct 2027, on track.
Slab inspection before pour photos: 2 of 3. Still needed: Membrane and termite barrier.
```

Buttons: [Undo]

## Ambiguity question ("the windows are late")

```
Which shipment do you mean by "the windows"?
```

Buttons: [Park Rd windows (Park Rd)] [Seaview St windows (Seaview St)]

## Question after a button is pressed (edited)

```
Which shipment do you mean by "the windows"?
→ Park Rd windows (Park Rd)
```

## Next question (no buttons)

```
What is the new ETA?
```

## Hold-point refusal (flow b, voice note "slab inspection at Seaview is done")

```
Heard: "slab inspection at Seaview is done"

Can't sign off Slab inspection before pour yet. No photos for: Plumbing under slab, Membrane and termite barrier. Nothing saved.
```

## Voice note card ("beatty all checked", spoken)

```
Heard: "beatty all checked"

Beatty St confirmed Thu 17 Sep.

- Beatty St, last confirmed: Tue 8 Sep → Thu 17 Sep

Beatty St:
- No change to the forecast (finish Fri 4 Dec)
- Confirmed again: it hadn't been confirmed for 9 days

Save this?
```

Buttons: [Confirm] [Edit] [Cancel]

## Finish answer ("what's Park Rd's finish?")

```
Park Rd finishes Fri 26 Feb 2027, on track.
```

## Waiting-on answer ("what are we waiting on at Park Rd?")

```
Park Rd, 27 outstanding:
- Tile choice (Dominic): needed Mon 14 Sep, overdue by 3 days
- Book cladders (Solid Frame Carpentry): needed Wed 16 Sep, expected Wed 16 Sep, overdue by 1 day
- Order cladding (Cladding supplier): needed Wed 16 Sep, expected Tue 15 Sep, overdue by 1 day
- Glazing energy compliance certificate (Jade Coast Windows): act by Mon 10 Aug (passed)
- Sliding doors (Jade Coast Windows): expected Mon 26 Oct
- Windows (Jade Coast Windows): expected Mon 26 Oct
- Stormwater connection approval (Council): expected Fri 18 Sep
- Book plumber for stormwater (Clearflow Plumbing): expected Mon 21 Sep
…and 19 more.
```

## Waiting-on answer ("what are we waiting on at Beatty?")

```
Beatty St, 7 outstanding:
- Book tiler (Harbour Tiling): expected Mon 5 Oct, 7 days late (needed Mon 28 Sep)
- Order joinery (Oakline Joinery): expected Fri 9 Oct
- Book painter (Fresh Coat Painting): expected Mon 12 Oct
- Order tiles (Tile warehouse): act by Mon 28 Sep
- Order vanity and tapware (Bathroom supplier): act by Mon 5 Oct
- Leaking window flashing, bedroom 2 (Solid Frame Carpentry): expected Thu 24 Sep
- Driveway kerb and layback detail (Dominic): act by Fri 16 Oct
```

## Waiting-on answer, all jobs ("what are we waiting on?")

```
All jobs, 47 outstanding:
- Park Rd: Tile choice (Dominic): needed Mon 14 Sep, overdue by 3 days
- Seaview St: Order slab steel (Steel supplier): needed Mon 14 Sep, expected Wed 16 Sep, overdue by 3 days
- Park Rd: Book cladders (Solid Frame Carpentry): needed Wed 16 Sep, expected Wed 16 Sep, overdue by 1 day
- Park Rd: Order cladding (Cladding supplier): needed Wed 16 Sep, expected Tue 15 Sep, overdue by 1 day
- Beatty St: Book tiler (Harbour Tiling): expected Mon 5 Oct, 7 days late (needed Mon 28 Sep)
- Park Rd: Glazing energy compliance certificate (Jade Coast Windows): act by Mon 10 Aug (passed)
- Park Rd: Sliding doors (Jade Coast Windows): expected Mon 26 Oct
- Park Rd: Windows (Jade Coast Windows): expected Mon 26 Oct
…and 39 more.
```

## Shipments answer ("where are the shipments at?")

```
- Park Rd windows: Mon 26 Oct, in production
- Seaview St windows: Mon 14 Dec, design
```

## Why it moved ("why did Beatty slip?")

```
Beatty St finishes Fri 4 Dec, +5 days, $1,430 since Mon 14 Sep.
- Book tiler at Beatty St expected Mon 28 Sep to Mon 5 Oct: +7 days
- 2 days earlier for reasons not in the change log
```

## Next hold point ("are we right for the slab inspection at Seaview?")

```
Seaview St: Slab inspection before pour, Mon 28 Sep. 1 of 3 photo categories filled. Still need: Plumbing under slab; Membrane and termite barrier.
```

## To chase ("what do I need to chase?")

```
To chase (19):
- Park Rd: Tile choice (Dominic): needed Mon 14 Sep, overdue by 3 days
- Beatty St: Book tiler (Harbour Tiling): expected Mon 5 Oct, 7 days late (needed Mon 28 Sep)
- Park Rd: Glazing energy compliance certificate (Jade Coast Windows): act by Mon 10 Aug (passed)
- Park Rd: Book plasterer (Smooth Wall Plastering): act by Fri 18 Sep
- Park Rd: Cracked roof tiles above garage (Solid Frame Carpentry): act by Fri 25 Sep
- Park Rd: Renew site insurance (Dominic): act by Thu 1 Oct
- Park Rd: Sliding doors (Jade Coast Windows): expected Mon 26 Oct
- Park Rd: Windows (Jade Coast Windows): expected Mon 26 Oct
…and 11 more.
```

## Design job finish ("what's West St's finish?")

```
West St is a design job, so it has no finish date. It's at the Pending approval stage.
```

## Daily reminder digest (scheduler, Thu 17 Sep)

```
Reminders, Thu 17 Sep:
Park Rd:
- Glazing energy compliance certificate. Act by Mon 10 Aug (overdue by 5 weeks).
- Tile choice. Act by Mon 14 Sep (overdue by 3 days).
- Book plasterer. Act by Fri 18 Sep (tomorrow).
Seaview St:
- Book concrete pump. Act by Fri 18 Sep (tomorrow).
Beatty St: not confirmed for 9 days. Check it and confirm the job.
```

## Daily reminder digest (scheduler, Sat 10 Oct, seed unchanged: a long one)

```
Reminders, Sat 10 Oct:
Beatty St: not confirmed for 32 days. Check it and confirm the job.
- Order tiles. Act by Mon 28 Sep (overdue by 12 days).
- Order vanity and tapware. Act by Mon 5 Oct (overdue by 5 days).
Park Rd: not confirmed for 25 days. Check it and confirm the job.
- Glazing energy compliance certificate. Act by Mon 10 Aug (overdue by 8 weeks).
- Tile choice. Act by Mon 14 Sep (overdue by 3 weeks).
- Book plasterer. Act by Fri 18 Sep (overdue by 3 weeks).
- Cracked roof tiles above garage. Act by Fri 25 Sep (overdue by 2 weeks).
- Renew site insurance. Act by Thu 1 Oct (overdue by 9 days).
- Order external doors. Act by Mon 5 Oct (overdue by 5 days).
- Stormwater inspection. Act by Mon 5 Oct (overdue by 5 days).
Seaview St: not confirmed for 24 days. Check it and confirm the job.
- Book concrete pump. Act by Fri 18 Sep (overdue by 3 weeks).
- Termite barrier certificate before pour. Act by Fri 25 Sep (overdue by 2 weeks).
+6 more: /reminders for the full list
```

## /reminders

```
Reminders due now, Thu 17 Sep (you asked, so this includes any already sent today):
Park Rd:
- Glazing energy compliance certificate. Act by Mon 10 Aug (overdue by 5 weeks).
- Tile choice. Act by Mon 14 Sep (overdue by 3 days).
- Book plasterer. Act by Fri 18 Sep (tomorrow).
Seaview St:
- Book concrete pump. Act by Fri 18 Sep (tomorrow).
Beatty St: not confirmed for 9 days. Check it and confirm the job.
```

## Error: the language model did not answer

```
I couldn't read that just now (the language model didn't answer). Try again in a minute. Nothing saved.
```

## Error: something went wrong on our side

```
Something went wrong on my side, so nothing was saved. Try again in a minute.
```

## Error: no model key

```
I can't read messages yet: add a model key to .env.
```

## Error: no such job

```
I can't find a job called "Nowhere Rd".
```

## /undo with no card to reply to (the seed: undoes the seeded voice-note change)

```
Undone: Seaview St confirmed Wed 16 Sep.
Seaview St finishes Fri 29 Oct 2027, on track.
```

## Error: not a photo

```
That file isn't a photo I can keep: I take JPEG, PNG, WebP or HEIC. Nothing saved.
```

## /help

```
Tell me a change in plain words or a voice note, e.g. "Park Rd windows now arriving 16 Nov", and I'll show a card to confirm. Send site photos with a caption like "Seaview plumbing under slab" (as a file keeps full resolution). Ask things like "what's Park Rd's finish?". /reminders shows what's due. /undo reverses the last saved change.
```
