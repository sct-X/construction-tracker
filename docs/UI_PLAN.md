# Construction Tracker UI Plan

2026-09-17 · @Someone

## Read this first

The app is one list of dated actions (waiting-on items) viewed about twenty different ways, plus a calculator that turns late items into a later finish date. Build the calculator and the list first and most screens become filters.

**The core idea, using the Park Rd windows.** The numbers below are made up for the mock data; the brief doesn't give them.

1. The step "Install windows" is planned to start Mon 2 Nov. The windows come from China and take 12 weeks to arrive, so someone had to order them by Mon 10 Aug. That dated action is the waiting-on item "Order windows", and 10 Aug is its act-by date, when the reminder fires.
2. The shipment's ETA is 26 Oct, a week early, so nothing moves. Then the factory says 16 Nov. The windows are now expected two weeks after they're needed.
3. "Install windows" can't start until 16 Nov. Every step waiting on it moves two weeks, and so does the job's forecast finish: Fri 26 Feb becomes Fri 12 Mar.
4. Last Monday's saved forecast said 26 Feb. Slip is 14 days. At a holding cost of $4,500 a week, that is $9,000. This is what Dom and Norm open the Monday screen to see.

**Words you'll meet**

| Word | Plain English |
| --- | --- |
| Subbie, trade | A subcontractor: the plumber, the bricklayer. They have to be booked weeks ahead |
| Lead time | How far ahead you must book or order. Windows from China: months. A concreter: a couple of weeks |
| Lock-up | The stage where the building can be locked: roof, windows and external doors in |
| Hold point | A legally required inspection. Work can't continue past it until the certifier has looked |
| Certifier | The private inspector who signs off each hold point and, at the end, the OC |
| Before-cover photo | A photo of work that's about to be hidden forever, like steel in a slab before the concrete goes on |
| OC | Occupation certificate. Nobody can move in or settle a sale without it |
| DA, CDC | Two ways to get approval. A DA goes to council and is slow. A CDC is a faster tick-box approval by a certifier |
| CC | Construction certificate. After a DA is approved, this is the permission to start building |
| Look-ahead | A builder's short-range plan: what's happening over the next three weeks and what must be ready for it |
| Defect | Finished work that isn't right and a trade has to come back and fix |
| Holding cost | Interest, rates and other costs of owning the site, paid every week until the job is finished |

**Assumptions this plan makes.** Nothing in the brief was unclear enough to stop on. Tell me if any of these are wrong.

- Every item belongs to a job directly. The model only links items to a step, which design jobs and manual reminders don't have. See Model gaps 1.
- An item's needed-by date is when its step could start if the item were on time. Read literally, rules 1 and 2 chase each other, and a late item stops looking late. See Rule gaps 1.
- "Due in the next fortnight" on the call list means the act-by date is within 14 days or already past.
- Slip and its cost use calendar days: slip days divided by 7, times the weekly holding cost.
- Builds entered "at stage level" (Seaview St, Beatty St) get one placeholder step per stage, such as "Frame, whole stage, 30 days". That gives them a forecast finish with no model change.
- Alec sees build jobs only. Design jobs have no site, so they're hidden from him. His "deliveries" are material items and shipments, read-only.
- Confirming a job is a button that stamps the last confirmed date. The call list offers it at the end of each call.
- The GitHub Pages prototype has no login. A dev bar replaces it with a role switcher, a "today is" date, an offline toggle and a reset button. Alec's mock data file contains no money fields at all, which copies how the server will behave.
- Nothing here blocks version two. Job pages use tabs, so Quotes, Invoices and Documents are later tabs. Money is drawn by one component that shows nothing when the field is missing.

## 1. Screen list

There are 22 screens. Alec can reach 12, and the last 3 are setup screens that only need to work on a desktop.

Roles: A = admin (Dominic), P = partner (Dom, Norm), B = builder (Raff), S = site (Alec). "Edit" means the role can change things; everyone else listed can only look.

| # | Screen | Who sees it | Who edits | Device |
| --- | --- | --- | --- | --- |
| 1 | Sign in | A P B S |  | Both |
| 2 | Monday screen | A P B |  | Both. Table on desktop, cards on phone |
| 3 | Jobs list | A P B S (S: builds only, no money) | A P add jobs | Both |
| 4 | Build job: overview | A P B S (S: no money) | A P B confirm the job | Both |
| 5 | Build job: program (Gantt and look-ahead) | A P B S |  | Both. Gantt on desktop, look-ahead on phone |
| 6 | Step detail | A P B S | B ticks status; A P edit dates and needs | Both |
| 7 | Design job: checklist | A P B | A P B tick stages and items | Both |
| 8 | Waiting-on list (all jobs or one job) | A P B | A P B | Both |
| 9 | Deliveries (Alec's cut of the waiting-on list: material items and shipments, rows expand in place) | S |  | Phone |
| 10 | Item detail, add and edit | A P B | A P B | Both |
| 11 | Call list | A P | A P | Desktop first, works on phone |
| 12 | Shipments list | A P B |  | Both |
| 13 | Shipment detail | A P B | A P B change status and ETA | Both |
| 14 | Photos: gallery by stage and category | A P B S |  | Both |
| 15 | Photo upload | A P B S | A P B S | Phone |
| 16 | Upload queue | A P B S | A P B S retry or remove | Phone |
| 17 | Daily notes | A P B S | B S add | Phone |
| 18 | Notifications and activity feed | A P B S (S: own reminders, no feed) |  | Both |
| 19 | My settings: notifications, install help, sign out | A P B S | own settings | Both |
| 20 | Program editor: stages, steps, links, needs, photo categories | A P | A P | Desktop |
| 21 | Templates and new job | A P | A (templates); A P (new job, job settings) | Desktop |
| 22 | Trades, and people and roles | A P B (trades); A (people) | A P B (trades); A (people) | Desktop |

Three things that look like screens but aren't:

- **"My items"** is the waiting-on list with the owner filter set to me. It is Raff's phone home screen.
- **Today** is Alec's home: the overview of whichever build job he last opened, trimmed to four things. It's described under screen 4.
- **The side switcher** is a control in the header, shown only to Dominic and Norm. Switching side reloads every screen; no screen ever mixes the two sides.

## 2. Navigation

Phones get a bottom tab bar sized to the role, and desktops get one left sidebar with items hidden by role. Each role lands on the screen it opens the app for.

**Phone: bottom tab bar.** The bell (notifications) and the person icon (settings) sit in the top bar for everyone.

| Role | Lands on | Tabs, left to right |
| --- | --- | --- |
| Site (Alec) | Today | Today · Jobs |
| Builder (Raff) | My items | My items · Jobs · + Photos · Monday |
| Partner (Dom, Norm) | Monday | Monday · Waiting on · Jobs |
| Admin (Dominic) | Monday | Monday · Waiting on · Call list · Jobs |

Alec's whole app is two tabs. Today holds everything he does daily for one job: a large "Upload photos" button, the one-line daily note, deliveries due this fortnight, and links to the program and photo gallery. Jobs only exists so he can switch site; with one build running he never touches it. His upload queue appears as a badge on the Upload button, not as a tab.

Raff's "+ Photos" tab opens the upload screen directly because he uploads from site too. Partners don't get it; they reach upload from a job's Photos tab.

**Inside a job**, phone and desktop share the same tabs across the top of the job page:

| Job kind | Tabs |
| --- | --- |
| Build | Overview · Program · Waiting on · Photos · Notes |
| Build, as Alec sees it | Today · Program · Photos · Deliveries |
| Design | Checklist · Waiting on |

Version two adds Quotes, Invoices and Documents as further tabs here, hidden from Alec.

**Desktop: left sidebar**

```
[ Norm and Dom  v ]      <- side switcher, Dominic and Norm only

Monday
Waiting on
Call list                 <- admin, partner
Jobs
   64-66 Park Rd
   31 Seaview St
   26a Beatty St
   33 Lower Beach St  (design)
   ...
Shipments
Activity
-----------
Setup                     <- admin; partners see Templates and Trades
   Templates and new job
   Trades
   People and roles
-----------
(bell)  (me)
```

If Alec opens the app on a desktop he gets the phone layout centred in the window. It isn't worth building him a second layout.

**Two rules that keep navigation safe**

- The menu is built from what the server says the role can do, not by hiding links with CSS. A typed URL for a screen the role can't see shows "You don't have access to this", and for Alec the Monday route doesn't exist at all.
- Every list row that mentions an item, step, shipment or photo opens the same detail sheet wherever it's tapped. On a phone the sheet slides up from the bottom; on a desktop it's a panel on the right. One component, used everywhere.

## 3. Screen specs

Every screen follows the same loading and offline behaviour, set out once here; each screen below only lists what's different. All lists are limited to the current side and exclude templates.

**Shared states**

- **Loading:** if a saved copy exists, show it straight away and refresh quietly. If not, show grey placeholder rows in the shape of the content. Never a spinner on a blank page.
- **Offline reading:** a thin bar under the header says "No signal. Showing what loaded at 10:42am." Every screen the person has opened before still opens.
- **Offline writing:** three things work with no signal and wait in a queue: photo uploads, daily notes, and status ticks on items and steps. A queued change shows a small clock until it's sent.
- **Offline, not allowed:** anything that changes a date (expected date, ETA, durations, links). Those controls go grey with "Needs signal". The server recalculates the forecast, and two people changing dates blind would surprise each other.
- **Failed save:** keep what was typed and show Retry. Never clear a form on error.
- **Money:** drawn by one component. When the field is missing, as it always is for Alec, the component and its label draw nothing and the layout closes up.

### 1. Sign in

Gets a person into the side and role they belong to.

- **Fed by:** person, membership. Someone on two sides lands on the side they used last.
- **Actions:** sign in, reset password.
- **Offline:** already signed in, the app opens from its saved copy. Not signed in: "You need signal to sign in the first time."
- **Prototype:** replaced by the dev bar's role switcher.

### 2. Monday screen

Shows the partners every job's forecast finish, how far it moved this week, what that costs and what's holding it up.

- **Fed by:** job; the calculated forecast finish; the latest forecast\_snapshot; job weekly holding cost and last confirmed date; item where status isn't done. "Waiting on" shows the top three per job: overdue first, then the soonest act-by within 14 days. Design jobs show their current stage (the first stage not done), a count of outstanding items and the age of the oldest.
- **Sort:** builds by slip cost, largest first; then design jobs by oldest outstanding item.
- **Actions:** tap a row to open the job. Tap the slip figure for "Why it moved", the chain from cause to finish date. Tap an item to open it. A toggle switches slip between "this week" and "since the original plan".
- **Empty:** "No jobs on this side yet." In the first week, before any Monday snapshot exists, slip shows a dash and "Slip appears after the first Monday".
- **Offline:** saved copy with its time.

### 3. Jobs list

Lets anyone find a job.

- **Fed by:** job, grouped into Build and Design. Each row has the name, current stage, forecast finish and a freshness dot: grey, or amber after 7 days unconfirmed. Alec gets builds only.
- **Actions:** open a job. Admin and partners get "New job".
- **Empty:** "No jobs yet", plus "New job" for admin and partners.

### 4. Build job: overview, and Alec's Today

Answers "how is this job going?" in one screen.

- **Fed by:** job, stage, step, item, shipment, photo, daily\_note for one job.
- **Header:** name, current stages, forecast finish against planned finish, slip this week, weekly holding cost and slip cost, last confirmed, and a "Confirm today" button for admin, partners and builder.
- **Body:** a stage-level mini Gantt; the next hold point with any missing photo categories; the top five waiting-on items; this week's daily notes; the latest photos.
- **Alec's Today version:** "Upload photos" button with a queue badge, today's note box, deliveries due this fortnight, the next hold point with its missing photos, and links to Program and Photos. No header figures except forecast finish.
- **Empty:** "No program yet. Dominic sets this up in the program editor."
- **Offline:** "Confirm today" needs signal; the rest follows the shared rules.

### 5. Build job: program

Shows when every step happens, what it waits for and what is late. Wireframes and the phone decision are in section 5.

- **Fed by:** stage, step, step\_link, requirement and step-linked items for one job.
- **Filters:** desktop has All, Look-ahead (next 3 weeks) and Late only. Phone has Look-ahead and Stages.
- **Actions:** tap a step for step detail. Admin and partners get "Edit program". Bars are read-only; nobody drags them. Dates come from durations, links and expected dates, so those are what people edit.
- **Empty:** same as the overview.

### 6. Step detail

Explains one step: its dates, what it needs, and why it's late if it is.

- **Fed by:** step; its requirements and items; step\_link in both directions ("waits for" and "holds up"); for a hold point, the stage's required photo categories and their photo counts.
- **Shows:** planned against forecast dates, and one plain sentence naming whatever sets the forecast start. Example: "Starts 16 Nov, not 2 Nov, because the windows are expected 16 Nov."
- **Actions:** builder and above mark it Started or Done, and a hold point runs the photo check first. Admin and partners edit duration, planned start and needs. Alec reads only.
- **Offline:** Started and Done queue, except Done on a hold point. That needs signal because the server has to count the photos.

### 7. Design job: checklist

Shows where an approval is up to and who owes what.

- **Fed by:** the job's stages in order, DA path or CDC path; items for that job of type consultant report, council request, decision and, once approved, condition of consent.
- **Shows:** each stage with a tick. Under the current stage, each outstanding item with who owes it and how many days it has been sitting.
- **Actions:** mark a stage in progress or done; add an item; open an item.
- **Empty:** "Nothing outstanding at this stage."

### 8. Waiting-on list

The one list of everything that can hold a job up, for one job or all of them.

- **Fed by:** item joined to job, step, trade and shipment; status isn't done unless "Show done" is on.
- **Filters:** job, type, owner (me or anyone), waiting on, status, and time (overdue, this week, fortnight, all).
- **Groups, sorted by act-by:** Overdue · Act this week · Act next week · Later.
- **Colour:** red when the expected date is after needed-by, or needed-by has passed and it isn't done. Amber when act-by has passed and it's still "to do". Colour always comes with words, such as "14 days late".
- **Actions:** move status forward one step; set the expected date; ring the trade (a phone link); open; add an item.
- **Empty:** "Nothing waiting." If the job has no requirements yet, add "This job's steps have no lead times, so nothing is being counted back."

### 9. Deliveries (Alec)

Tells Alec what is turning up on site and when.

- **Fed by:** items of type "material to order" for one job that are ordered or confirmed, expected within 14 days or late; plus that job's shipments. Read-only, no owner column, no money.
- **Actions:** tap a row to expand it in place. Nothing to edit; he reports arrivals in the daily note.
- **Empty:** "No deliveries expected in the next fortnight."

### 10. Item detail, add and edit

One sheet for reading, adding and changing any item.

- **Fields:** type, title, job, step (optional), waiting on (pick a trade or type free text), owner, needed-by, lead time, act-by, expected date, status, confirmed date, photo.
- **Calculated, so read-only:** act-by always. Needed-by when the item is linked to a step. Expected date when it's linked to a shipment, shown as "Comes from shipment: Park Rd windows".
- **The add form adapts to the type.** A defect asks for a photo, the trade responsible and a due date. A decision asks for an owner and a needed-by date. A manual reminder asks for a title and a date.
- **Also shows:** this item's history from the activity log.
- **Actions:** save, move status forward, ring the trade. Admin and partners can delete.

### 11. Call list

Gives Dominic a script for his call with Raff, so every unconfirmed item due soon gets asked about.

- **Fed by:** item where owner is the chosen person (Raff by default), status is "to do" or "ordered or booked", and act-by is within 14 days or already past. Grouped by job. Jobs with nothing to chase are still listed so they can be confirmed.
- **Actions per row:** Booked · Confirmed (asks for the date) · Move expected date · Note · Skip. On desktop each has a keyboard shortcut.
- **End of call:** "Finish call" lists each job with a tick box, "Confirmed today", which stamps its last confirmed date.
- **Empty:** "Nothing to chase with Raff this fortnight. Still worth confirming each job."
- **Offline:** ticks queue; date changes need signal.

### 12. Shipments list

Lists everything coming from overseas and whether it will arrive in time.

- **Fed by:** shipment with a count of its linked items and the earliest needed-by among them. A shipment is late when its ETA is after that date.
- **Actions:** open a shipment; admin, partners and builder can add one.
- **Empty:** "No shipments being tracked."

### 13. Shipment detail

The one place an ETA is changed, showing what the change does before it's saved.

- **Fed by:** shipment, its linked items, their steps and job, and the activity log for past ETA changes.
- **Shows:** status as four dots (Design, In production, Shipped, Delivered), the ETA, linked items with needed-by against expected, and the ETA history.
- **Actions:** change status; change the ETA, with an impact preview before saving (flow d); link or unlink items. Marking it Delivered offers "Mark the 3 linked items done?"
- **Offline:** read-only.

### 14. Photos: gallery

Shows a job's photos the way they were filed: by stage, then category.

- **Fed by:** photo, photo\_category and stage for one job. Each category header shows its count. Categories needed for an inspection carry a tag, and empty ones are flagged "Needed before the slab inspection".
- **Filters:** stage, uploader, date.
- **Actions:** open a photo full screen; "Upload here" opens the upload screen with stage and category filled in. Admin and partners can move a photo to another category or delete it.
- **Empty:** per category, "No photos yet" with an upload button.
- **Offline:** thumbnails already seen still show; others are grey tiles.

### 15. Photo upload

Files photos from the camera roll under job, stage and category in as few taps as possible. Flow b and its wireframe cover it in full.

- **Fed by:** job, stage and photo\_category for the pickers; writes photo. Job defaults to the last one used, stage to the job's current stage.
- **Actions:** pick a category, choose photos (the phone's own picker, many at once), remove any, upload.
- **Empty:** a stage with no categories says "Dominic hasn't set up photo categories for this stage yet" and offers a single "General" bucket so Alec is never blocked.
- **Offline:** works fully. Photos are saved on the phone and sent when signal returns.

### 16. Upload queue

Shows what hasn't been sent yet, so nobody wonders whether their photos made it.

- **Fed by:** the phone's own storage, not the server. Each entry has a thumbnail, its category and a state: waiting, sending, failed.
- **Actions:** retry now, remove.
- **Empty:** "Everything's uploaded."

### 17. Daily notes

A dated one-line diary per job: who was on site, deliveries, delays.

- **Fed by:** daily\_note for one job, newest first.
- **Actions:** builder and site add today's note, and can edit their own note until the end of that day.
- **Empty:** "No notes yet. One line a day is plenty."
- **Offline:** queues.

### 18. Notifications and activity feed

Holds everything that didn't buzz a phone, and the record of who changed what.

- **Fed by:** the Notifications tab reads the notifications table for me. The Activity tab reads the activity log for the side, filtered by job or person.
- **What raises a notification:** an item I own reaches its act-by date; an item I own goes overdue; a shipment ETA moves an item I own; a hold point is a week away with photos missing; one of my uploads failed.
- **Alec:** Notifications tab only. The server strips money from activity entries, but leaving the feed out is simpler and he doesn't need it.
- **Actions:** tap to go to the thing; mark all read.
- **Empty:** "Nothing new."

### 19. My settings

Doubles as Dominic's phone setup checklist when he hands someone the app.

- **Shows three steps with ticks:** 1. Added to the home screen. 2. Notifications allowed. 3. Test buzz received.
- **Actions:** "Turn on notifications". This must be a real button, because iPhones only show the permission prompt after a tap. Also "Send me a test buzz", notifications on or off, sign out.
- **States:** opened in the browser instead of from the home screen, it shows how to install with pictures (Share, then Add to Home Screen). If notifications were blocked, it says how to unblock them in phone settings.
- **Also shows:** app version and last sync time, for support calls.

### 20. Program editor

Where Dominic builds and changes a job's program, or a template's.

- **Fed by:** stage, step, step\_link, requirement and photo\_category for one job or template.
- **Layout:** a spreadsheet-like tree. Stages are group rows. Steps are rows with columns for name, duration in working days, waits for, needs (trade or material with its lead time), hold point, and planned start. A side panel holds the stage's photo categories, each with a "required for hold point" tick.
- **Overlap:** stages overlap naturally because a stage's dates come from its steps. External works overlaps Fit-out when its first step waits on a Lock-up step and not on Fit-out.
- **Actions:** add, reorder, delete. On a live job, a footer shows the forecast finish updating as he edits: "Finish moves 12 Mar to 19 Mar".
- **Templates:** the same editor with the date columns hidden.
- **Offline:** read-only.

### 21. Templates and new job

Turns a template into a dated job.

- **Fed by:** job where is\_template is ticked. Creating a job copies its stages, steps, links and requirements.
- **New job form:** name, side, kind, path (design jobs), template, start date, weekly holding cost, and "Starts from stage". A live job starts from where it is now: earlier stages are marked done and planned dates run forward from the start date.
- **Empty:** "No templates yet. Build the duplex template first."

### 22. Trades, and people and roles

Two plain setup lists.

- **Trades:** trade for the current side, with name, type and a tap-to-call phone number. A trade's page lists the items waiting on it. Version two's "what's owed" will sit on the same page.
- **People:** person and membership. Admin adds a person, picks their side and role, and sees each person's phone setup state from screen 19.
- **Empty:** "No trades yet. Add them as you book them."

## 4. The five flows

Each flow below is written so it can be clicked through on mock data and ticked off as an acceptance test. Dates use the mock numbers from the top of this doc, with today as Thu 17 Sep 2026.

### a. Dom and Norm open the Monday screen

1. Dom taps the home screen icon. He's a partner, so the app opens on Monday. The saved copy shows at once and refreshes underneath.
2. The header reads "Week of Mon 14 Sep. Compared with Monday's forecast."
3. Park Rd is the top row because it cost the most this week: forecast finish 12 Mar 2027, slip +14 days, $9,000, last confirmed 2 days ago.
4. Its "waiting on" cell lists three items. The first is red: "Windows, expected 16 Nov, needed 2 Nov." One is a decision tagged "With you", because Dom owns it.
5. He taps "+14 days". A sheet opens titled "Why it moved": Windows ETA changed 26 Oct to 16 Nov (Dominic, Tue 3:10pm), then Install windows +14, then Lock-up ends +14, then Handover +14.
6. He taps the decision item. The item sheet opens and he sets its status to done. The row updates.
7. Beatty St shows an amber "Last confirmed 9 days ago". Nothing else is wrong with it; the amber says the figures may be stale.
8. The four design jobs sit below with stage and outstanding items in place of dates: "West St. With council. 2 outstanding, oldest 23 days."
9. Norm does the same, with one difference. His header has the side switcher, because he belongs to both sides.

Pass when: every job shows forecast finish, slip and waiting-on items; slip equals today's forecast minus the 14 Sep snapshot; the cost equals slip days divided by 7, times the weekly cost.

### b. Alec uploads photos and reception drops halfway

1. Alec opens the app on Today for Park Rd and taps "Upload photos".
2. Job is already Park Rd and stage is already Lock-up, the job's current stage. He can change either.
3. Categories show as large buttons with counts: "Windows installed (0)", "Roof complete (6)". Categories needed for an inspection have a tag. He taps one.
4. He taps "Choose from camera roll". The phone's own photo picker opens and he selects 12.
5. The 12 thumbnails appear. He removes one blurry shot and taps "Upload 11 photos".
6. Before sending, the app shrinks each photo to about 2,000 pixels wide and saves all 11 on the phone. From this moment they can't be lost.
7. Photos send one at a time with a count: "Sending 6 of 11".
8. Reception drops. The count stops and a calm message replaces it: "No signal. 5 photos are saved and will send by themselves. You can carry on." No error, no red.
9. He goes back to Today. The Upload button carries a badge: 5.
10. Signal returns. The app notices, sends the remaining 5 and clears the badge. A small message confirms: "All 11 photos uploaded to Lock-up, Windows installed."
11. If he closed the app while offline, the queue sends the next time he opens it. iPhones don't let a home screen web app upload in the background, so the badge and screen 16 exist to make that visible.
12. At no point did a price appear. His data never contained one.

Pass when: killing the connection mid-upload loses nothing; restoring it finishes the job without a tap; each photo lands once, not twice; the gallery shows all 11 under the right stage and category.

### c. Dominic rings Raff and works through the call list

1. On his desktop Dominic opens Call list. It's set to Raff and shows "9 items across 3 jobs".
2. Items are grouped by job and sorted by act-by date, so the most urgent question is first: "Seaview St. Book concrete pump. Act by Fri 18 Sep. For: Pour ground floor slab, 28 Sep."
3. Raff says it's booked. Dominic presses B. The status becomes "ordered or booked" and the row folds into a "Done this call" strip.
4. Next: "Park Rd. Book plasterer." Raff says the plasterer has confirmed for the 23rd. Dominic presses C, enters the date, and the status becomes "confirmed".
5. Next: the tiler can't start until a week later than needed. Dominic presses M and moves the expected date. A message appears: "Beatty St finish moves +5 days." He sees the cost of that sentence while Raff is still on the phone.
6. For an item Raff hasn't got to, Dominic presses S to skip. It stays on the list for next call.
7. At the end he presses "Finish call". A short list appears: Park Rd, Seaview St, Beatty St, each with a "Confirmed today" tick. He ticks all three.
8. Each job's last confirmed date becomes today. The amber flag on Beatty St clears on the Monday screen.

Pass when: the list holds exactly Raff's unconfirmed items with act-by inside 14 days; each action writes the right status; finishing the call resets the 7-day freshness clock.

### d. Changing the windows shipment ETA moves Park Rd's finish

1. Dominic opens Shipments, then "Park Rd windows". Status: In production. ETA: 26 Oct. Linked items: 3.
2. He taps the ETA and picks 16 Nov.
3. Before anything is saved, an impact panel appears:
   - "3 linked items will be expected 16 Nov."
   - "Install windows moves 2 Nov to 16 Nov."
   - "Park Rd forecast finish moves 26 Feb to 12 Mar (+14 days)."
   - "About $9,000 in holding costs."
4. He taps "Save new ETA". One change, made once.
5. The three linked items now show expected 16 Nov in red, "14 days late". On the program the Install windows bar and everything after it have shifted right, with the planned position left behind as an outline.
6. The job header and the Monday row show 12 Mar and "+14 days".
7. Raff owns two of those items, so his phone buzzes: "Park Rd windows now expected 16 Nov. 2 of your items moved."
8. The activity feed records who changed the ETA, from what, to what, and when. That entry is what feeds "Why it moved" in flow a.

Pass when: one edit to the ETA changes the linked items, the step, every step after it and the forecast finish, with no other input.

### e. Raff tries to tick off a hold point with photos missing

Seaview St is the example, because its ground floor slab is about to be poured. The inspection before the pour is a hold point. Once the concrete is on, nobody can ever photograph the steel again.

1. Raff opens Seaview St, Program, and taps the step "Slab inspection before pour". It carries a lock icon, which marks a hold point.
2. The step sheet lists its required photos: "Steel reinforcement in place: 4 photos", "Plumbing under slab: none yet", "Membrane and termite barrier: none yet".
3. He taps "Mark done" anyway. The button is never greyed out in silence, because a dead button teaches nothing.
4. The app refuses and says why: "Can't tick this off yet. The certifier needs before-cover photos and 2 categories are empty: Plumbing under slab; Membrane and termite barrier."
5. The sheet offers "Add photos now". It opens the upload screen with job, stage and category already set.
6. He uploads to both categories and returns. All three categories show a tick. "Mark done" now works, and the step closes.
7. One variation. If his photos are still in the upload queue, the sheet says "3 photos are waiting to upload. You can tick this off once they've sent." Only photos that reached the server count.

Pass when: "done" is refused while any required category is empty, the message names the missing categories, and it succeeds the moment each has one uploaded photo.

## 5. Wireframes

Four screens, drawn as text so they can be read on a phone and copied into a ticket. Boxes are components. The Gantt decision comes last.

### Monday screen, desktop

```
 Monday                       Week of Mon 14 Sep   [Slip: this week | since plan]

 BUILDS
 Job              Forecast   Slip        Holding cost        Waiting on                 Last confirmed
 ---------------  ---------  ----------  ------------------  -------------------------  --------------
 64-66 Park Rd    12 Mar 27  +14 days >  $4,500/wk  $9,000   ! Windows  exp 16 Nov      2 days ago
                                                             ! Plasterer  act by 18 Sep
                                                               Tile choice  With you
 31 Seaview St    30 Oct 27   0                $3,800/wk   ! Concrete pump  act by 18 Sep  1 day ago
                                                               Slab inspection  28 Sep
 26a Beatty St     4 Dec 26  +5 days  >  $2,000/wk  $1,430    Tiler  exp 5 Oct           9 days ago  (amber)

 DESIGN
 Job              Stage             Outstanding
 ---------------  ----------------  ------------------------------------------
 59-61 West St    With council      2 items, oldest 23 days: Traffic report (consultant)
 18 Tollbar Ave   With council      1 item, 8 days: RFI response (Dominic)
 33 Lower Beach   Design            0
 13 John St       Design            1 item, 4 days: Heritage report (consultant)
```

Red items carry a "!" as well as colour. The "+14 days >" opens "Why it moved". On a phone the same data becomes one card per job: name and forecast on the top line, slip and cost on the second, waiting-on items as three lines under it.

### Photo upload, phone

```
 +----------------------------------+
 | <  Upload photos                 |
 |                                  |
 |  Job    [ 64-66 Park Rd     v ]  |
 |  Stage  [ Lock-up           v ]  |
 |                                  |
 |  Category                        |
 |  +----------------------------+  |
 |  | Windows installed      (0) |  |
 |  | * needed for inspection    |  |
 |  +----------------------------+  |
 |  | Roof complete          (6) |  |
 |  +----------------------------+  |
 |  | External cladding      (2) |  |
 |  +----------------------------+  |
 |                                  |
 |  [ Choose from camera roll ]     |
 |                                  |
 |  [img] [img] [img] [img]  x each |
 |  [img] [img] [img] ...           |
 |                                  |
 |  Sending 6 of 11 ########....    |
 |                                  |
 |  ============================    |
 |  |   Upload 11 photos       |    |
 |  ============================    |
 +----------------------------------+
```

After reception drops, the progress line becomes: "No signal. 5 saved, will send by themselves." The Upload button becomes "Done". Categories are large buttons, not a dropdown, because Alec is wearing gloves half the time.

### Waiting-on list, phone

```
 +----------------------------------+
 | Waiting on         [+]  [filter] |
 | [All jobs v] [Mine] [Overdue]    |
 |                                  |
 | OVERDUE                          |
 | ! Windows              Park Rd   |
 |   exp 16 Nov, needed 2 Nov       |
 |   14 days late . China . Raff    |
 |   [Ordered] [Set date] [Call]    |
 |                                  |
 | ! Tile choice          Park Rd   |
 |   needed 21 Sep . decision . Dom |
 |   [Done]                         |
 |                                  |
 | ACT THIS WEEK                    |
 |   Book concrete pump   Seaview   |
 |   act by Fri 18 Sep . Raff       |
 |   [Booked] [Call]                |
 |   Book plasterer       Park Rd   |
 |   act by Fri 18 Sep . Raff       |
 |                                  |
 | ACT NEXT WEEK                    |
 |   Order tiles          Beatty    |
 |   act by Tue 22 Sep . Raff       |
 |                                  |
 | LATER (12)              show v   |
 +----------------------------------+
```

One primary action per row, which is always "move status forward one step", plus Call when a trade has a phone number. Everything else is inside the item sheet. Desktop shows the same rows as a table with the filters across the top.

### Build job program, desktop Gantt

```
 64-66 Park Rd . Program          [All] [Look-ahead] [Late only]    [Edit program]

                         Sep         Oct              Nov              Dec
                         14 21 28  5  12 19 26  2  9  16 23 30  7  14
                         |today
                         [ look-ahead ]
 LOCK-UP                 ============================================
   Roof plumbing         ####
   External cladding         ############
   Install windows                              ........########
                                                ! windows 14d late
   External doors                                       ....    ####
 EXTERNAL WORKS                      ================
   Stormwater drainage               ############
   <> Stormwater insp.                           <>
 FIT-OUT                                                 ....    ========>
   Rough-in plumb + elec                                 ........########
```

"####" is the forecast bar. "...." is where the planned bar was, left behind as an outline so slip is visible at a glance. "<>" is a hold point. Stage rows are bands, and bands can overlap, which is how External works sits alongside Fit-out. Nothing drags; tapping a row opens step detail.

### How the Gantt works on a phone

The phone doesn't get a Gantt. It gets the three-week look-ahead as a list, and the stages as a vertical strip, because that's what Raff and Alec use a program for on site: what's on this week and what comes next.

```
 +----------------------------------+
 | Park Rd . Program                |
 | [Look-ahead]  [Stages]           |
 |                                  |
 | THIS WEEK  14-18 Sep             |
 | o Roof plumbing        Lock-up   |
 |   Mon-Thu . Roof plumber         |
 | o External cladding    Lock-up   |
 |   from Wed . 3 wks . Cladder     |
 |   needs: cladding (ordered)      |
 |                                  |
 | NEXT WEEK  21-25 Sep             |
 | o Stormwater drainage  Ext works |
 |   from Mon . 3 wks . Plumber     |
 |   ! plumber not confirmed        |
 |                                  |
 | WEEK AFTER  28 Sep-2 Oct         |
 |   (nothing starts)               |
 |                                  |
 | LATER                    show v  |
 | ! Install windows moved to 16 Nov|
 +----------------------------------+
```

- Each step in the look-ahead shows its dates, trade, and any item it needs that isn't confirmed. That is the "what must be ready" half of a look-ahead.
- The Stages tab is a vertical strip: one band per stage with its dates and a thin progress bar, and any late step listed under its stage in red. It's a Gantt rotated ninety degrees and simplified.
- A "Full program" link opens the desktop Gantt in landscape, scrolling sideways, for anyone who insists.
- One component draws both. On desktop it lays rows across time; on phone it groups them by week. The data behind them is identical.

## 6. Prototype build order

The forecast calculator comes first and the mock data is built around Park Rd, so three of the four "version one is working when" checks can be demonstrated by the end of stage 3. The fourth, reminders that buzz a phone, needs the real server and is faked on GitHub Pages.

| Stage | Build | Demonstrates |
| --- | --- | --- |
| 0. Mock data and calculator | One JSON file shaped like the model: Park Rd in full (stages, steps, links, requirements, the windows shipment, 30 items, photo categories, a 14 Sep snapshot), Seaview and Beatty at stage level, four design jobs on checklists. A pure function: data in, forecast dates, needed-by, act-by, slip and cost out. Unit tests against the Park Rd numbers at the top of this doc. Dev bar with role, "today is", offline toggle and reset | The rules, before any screen exists |
| 1. Shell and Monday | App shell with role-based navigation, sign-in stub, jobs list, Monday screen, "Why it moved" | Check 1: Monday screen |
| 2. Shipment to finish | Shipment list and detail with the impact preview, program view (desktop Gantt, phone look-ahead), step detail read-only, build job overview header | Check 4: ETA change moves Park Rd's finish |
| 3. Photos | Photo upload with the local queue, upload queue screen, gallery, Alec's Today; the dev bar's offline toggle proves the queue | Check 3: Alec uploads by stage and category with no price |
| 4. Waiting-on and calls | Waiting-on list, item sheet with add and edit, call list with Finish call, freshness flag | Flow c |
| 5. Hold points and notes | Hold-point photo check on step detail, daily notes, design checklist, notifications and activity screens with a fake "buzz" toast | Flow e; a stand-in for check 2 |
| 6. Setup screens | Program editor, templates and new job, trades, people, my settings with the install and permission steps | Dominic can set up a job himself |

Two notes on the order:

- Stage 0 decides whether everything else is easy. If the calculator is a pure function over the mock data, every screen is a filter and a renderer, and the same function moves to the server unchanged later.
- Check 2, the phone buzz, can't be shown on GitHub Pages: push needs a server to send it. The prototype shows the notification arriving in the app's own list, and the dev bar has a "fire reminders due today" button so the demo can be run on any date. The real buzz comes when the server lands, alongside screen 19's permission button.

On the queue, one thing to know before stage 3: iPhones don't run web app uploads in the background and Safari has no Background Sync API ([web-features](https://web-platform-dx.github.io/web-features-explorer/features/background-sync), [MobiLoud](https://www.mobiloud.com/blog/progressive-web-apps-ios/)). So the queue lives in the phone's IndexedDB and sends while the app is open. The badge and the upload queue screen exist so that is never a surprise. Android will send in the background, which is a bonus, not a design assumption.

## 7. Model gaps and rule gaps

Six fields the screens need that the model doesn't have, and three rules that need a decision. None change the shape of the model; all are columns or a clarification.

**Model gaps**

1. **item.job.** Items link to a step, but manual reminders, decisions and every design-job item have no step. Without a job column the Monday screen can't group them and Alec's filter can't exclude design jobs. Suggest a required job column on item, filled from the step when there is one.
2. **job.planned\_finish.** Rule 3 calls late "forecast against planned", and the Monday toggle "since the original plan" needs a fixed baseline. The latest planned end of any step works for full-program jobs, but stage-level jobs need the field on job.
3. **job.start\_date and job.starts\_from\_stage.** New job needs a start date to run the template forward from, and "live jobs start from the stage they're at now" needs to record which stage. Start date could be derived from the first step's planned start; the stage can't be.
4. **stage.planned\_start and planned\_end.** Stage-level jobs (Seaview, Beatty) have stages but no steps, so the Monday screen has nothing to forecast from. Either give stage its own dates and duration, or create one placeholder step per stage as this plan assumes. The placeholder is the smaller change.
5. **photo\_category.stage should allow a job-wide category**, or the model needs a job-level "General" category, so Alec can always upload even when Dominic hasn't set up a stage's categories yet.
6. **person.push\_subscription and notification settings.** Push needs a subscription blob per device, and "anyone can switch them off" needs a flag. Probably a small table: person, device, subscription, enabled, last test sent.

Two smaller ones: **item.notes** (the call list's Note action needs somewhere to go; the activity log could hold it) and **trade.email** for version two's invoices, which can wait.

**Rule gaps**

1. **Rules 1 and 2 chase each other.** Needed-by equals the step's forecast start, and forecast start is the latest of the items' expected dates. So once the windows are late, the step moves to 16 Nov, needed-by becomes 16 Nov, and the item no longer looks late. Suggested reading, used throughout this plan: needed-by is the step's forecast start calculated without this item's own expected date. Then the windows stay "14 days late" and the step still moves.
2. **Working days.** Step durations are in working days, but slip is in calendar days and holding cost is per week. This plan uses calendar days for slip and cost. Also, which days are working days: Mon to Fri, and what about NSW public holidays and the builders' Christmas shutdown? The calculator needs a calendar, even if version one's is just "weekdays".
3. **When a hold point counts as done.** Rule 5 checks photos. Does the certifier's actual sign-off get recorded, and does a failed inspection reopen the step? Version one could treat "done" as "inspection passed" and leave it there, but it should be a decision, not a default.

**Not gaps, just confirming.** Stage status is set by hand on design jobs and derived from steps on build jobs. Item act-by is always calculated, never typed. Templates carry requirements and photo categories, so "copying one copies its stages, steps, links and requirements" should include photo categories too.
