# Construction Tracker: a guide for Dom (video script)

Spoken to Dom in plain Australian English at a relaxed pace, with a pause after every sentence and a longer
one between scenes. Each scene lists its on-screen title and key words (so it works with the sound off on
site), the narration, and what is on screen. The narration here is the exact text the voice reads. It is
copied into `scenes.mjs`, one string per sentence, and `scripts/voice.mjs` speaks it.

Build, from `video/`: `npm run shots` (the web app in mock mode, see `scripts/shoot.mjs`), `npm run voice`,
`npm run build`, `npm run render`. Output: `out/dom-tracker-guide.mp4` (1920x1080) and
`out/dom-tracker-guide-phone.mp4` (1080x1920, built from `portrait/index.html`, which uses the 390 px
screenshots where the app has them).

## 1. Your Construction Tracker

On screen: the title, then the Overview. Key words: "Your own dashboard. Changes go in by Telegram."

> G'day Dom. This is a quick guide to your new Construction Tracker.
> It's your own dashboard for every job.
> When something changes on site, you message the tracker bot on Telegram, and the dashboard updates.

## 2. Sending an update

On screen: three cards, one at a time: Text, Voice note, Photo as a file. Key words: "Type it. Say it.
Photo it."

> You can send an update three ways.
> Type it, like a text to a site manager.
> Send a voice note.
> Or send a photo, as a file, with a caption.

## 3. The confirm card

On screen: the chat. Dom's text "Park Rd windows now arriving 16 Nov", then the confirm card; a highlight on
the dates before and after, then on the finish, then on Confirm. Key words: "Nothing saves until you tap
Confirm."

> Every update comes back to you as a card.
> It shows each date before and after, and what it does to the finish.
> Nothing is saved until you tap Confirm.

## 4. Confirm, Edit, Cancel, Undo

On screen: Confirm is tapped and the card turns into "Saved ✓"; then Dom sends /undo and the bot replies
"Undone". Key words: Confirm saves it. Edit: send the correction. Cancel: nothing saved. /undo takes it back.

> Tap Confirm, and it says Saved.
> If it's not quite right, tap Edit and send the correction. Cancel saves nothing.
> Changed your mind later? Send slash undo, and the last change comes off.

## 5. When the bot isn't sure

On screen: "the windows are late"; the bot asks which shipment, with two buttons; Park Rd is tapped; the bot
asks for the new ETA. Then "booked the pump for seaview" and the bot asks when it's expected. Key words: "It
asks. It doesn't guess."

> If the bot isn't sure, it asks instead of guessing.
> The windows are late? There are windows on two jobs, so it asks which one.
> Book a trade, and it asks when they're coming.

## 6. Ask it questions

On screen: "what are we waiting on at Beatty?" and the bot's list. Key words: "Ask away. Questions never
change anything."

> You can ask it questions too, like, what are we waiting on at Beatty?
> Questions never change anything.

## 7. Hold points need photos

On screen: a voice note "slab inspection at Seaview is done", then the refusal naming the two empty photo
categories. Key words: "No sign-off until the photos are in."

> Some steps are hold points, like the slab inspection at Seaview.
> Say it's done with photos missing, and it won't save. It names the photos it needs.

## 8. Sending photos

On screen: a photo sent as a file with the caption "Seaview plumbing under slab", the photo card, Confirm,
Saved. Key words: "Paperclip, File, pick the photo. Add a caption."

> To send a photo, tap the paperclip, then File. That keeps it full size.
> Add a caption, like, Seaview plumbing under slab.
> The bot files it in the right job and category, and tells you what's still missing.

## 9. Morning reminders

On screen: the 7 am reminder digest, then "beatty all checked" and its card. Key words: "Every morning at 7."

> Every morning at seven, the bot sends a reminder: what's overdue, what's coming due, and any job not confirmed for a week.
> Checked a job? Send, Beatty all checked, and confirm the card.

## 10. The dashboard: Overview

On screen: the Overview, a slow zoom to Park Rd's card and "4 overdue". Key words: "One card per job. Red
means overdue."

> Now, the dashboard.
> The Overview has one card per job: its stage, and how many things are overdue.
> Red only ever means overdue. Tap a card to open the job.

## 11. A job's first page

On screen: Park Rd's first page, panning down: next hold point, Overdue, Trades on this week; then the tabs.
Key words: "Next hold point, overdue, trades on site."

> A job's first page shows the next hold point, everything overdue, and the trades on site this week.
> The tabs take you to the rest.

## 12. Waiting on

On screen: Waiting on, a highlight on the Call button, then the phone view. Key words: "Overdue, This week,
Later. Tap Call."

> Waiting on is one list for every job: overdue, this week, and later.
> Where a trade has a number, tap Call to ring them.

## 13. Shipments

On screen: Park Rd's Shipments, a zoom on the ETA and "ETA 1 week before needed". Key words: "Status, ETA,
and whether it lands in time."

> Shipments shows each delivery's status and ETA, and whether it lands in time.
> When a supplier gives you a new date, just tell the bot.

## 14. The program

On screen: the Gantt (the legend, the today line), then the phone look-ahead, then a step's detail. Key
words: "Dark bar: forecast. Outline: plan. Orange line: today."

> Program is the Gantt chart. Dark bars are the forecast, outlines are the plan, and the orange line is today.
> On a phone, it shows a look-ahead. Tap any step for its details.

## 15. Photos, Notes, Changes

On screen: Seaview's Photos, Park Rd's Daily notes, then Changes. Key words: "Photos by stage. Daily notes.
Every change, with its message."

> Photos are sorted by stage, and show which hold point photos are missing.
> Notes keeps your daily site notes.
> And Changes lists every saved change, with the message that made it.

## 16. Setup, on the computer

On screen: Setup, New job; then Programs; then Trades. Key words: "New job, Programs, Templates, Trades."

> New jobs are set up on the computer, under Setup.
> Pick New job, give it a name, choose the template, and set the start date.
> Programs and Trades are there too.

## 17. Five quick tips

On screen: the five tips, one at a time.

> Five quick tips.
> Say the job name in every message.
> Send photos as files, with a caption.
> Read the card before you tap Confirm.
> Made a mistake? Slash undo.
> And confirm each job once a week.

## 18. That's it

On screen: "Message the bot. Check the card. Tap Confirm."

> That's it, Dom. Message the bot, check the card, tap Confirm.
