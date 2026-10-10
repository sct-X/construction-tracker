// The video, scene by scene. One source for the narration (spoken by scripts/voice.mjs), the on-screen
// captions and every visual cue (turned into HyperFrames compositions by scripts/build.mjs).
// SCRIPT.md is the readable version of the same words; keep the two in step.
//
// Cue times are relative to the scene and can name the narration:
//   'n2'      the start of sentence 2      'e2'   the end of sentence 2
//   'n2+1.5'  1.5 s after that             'end'  the end of the last sentence
//   3.2       seconds from the scene start
//
// Bot messages are the real ones from docs/telegram-samples-after.md (Telegram HTML: <b>, <i>).
// <span class="hl" data-k="x"> marks a phrase a cue can highlight.
// A visual's `p` replaces its fields in the phone (portrait) version, usually with the 390 px screenshot;
// `p: { skip: true }` leaves it out there.

const CARD_WINDOWS = `<b>Park Rd · Windows ETA</b>

<span class="hl" data-k="eta">Mon 26 Oct → <b>Mon 16 Nov</b></span>

<span class="hl" data-k="steps">• Install windows: Mon 2 Nov → <b>Mon 16 Nov</b>
• External doors: Mon 16 Nov → <b>Mon 30 Nov</b>
• Rough-in plumbing and electrical: Mon 23 Nov → <b>Mon 7 Dec</b>
• Insulation: Mon 7 Dec → <b>Mon 11 Jan 2027</b>
• and 8 more steps move</span>
<span class="hl" data-k="finish">Finish Fri 26 Feb 2027 → <b>Fri 12 Mar 2027</b>
+14 days · $9,000 holding cost since last Monday</span>

Save this?`;

const SAVED_WINDOWS = `<b>Saved ✓</b>
Park Rd windows ETA Mon 26 Oct to Mon 16 Nov.

Park Rd finishes <b>Fri 12 Mar 2027</b>: +14 days · $9,000 holding cost since last Monday`;

const CONFIRM_ROW = [['Confirm', 'Edit', 'Cancel']];

const chatWindowsStart = [
  { id: 'w1', from: 'dom', time: '7:42', html: 'Park Rd windows now arriving 16 Nov' },
  { id: 'w2', from: 'bot', time: '7:42', html: CARD_WINDOWS, buttons: CONFIRM_ROW },
];

export const scenes = [
  {
    id: 's01',
    say: [
      "G'day Dom. This is a quick guide to your new Construction Tracker.",
      "It's your own dashboard for every job.",
      'When something changes on site, you message the tracker bot on Telegram, and the dashboard updates.',
    ],
    caption: {
      at: 'n2',
      section: 'Welcome',
      title: 'Your own dashboard',
      lines: [
        { at: 'n2', html: 'Every job, in one place.' },
        { at: 'n3', html: 'Changes go in by <b>messaging the bot</b> on Telegram.' },
      ],
    },
    visuals: [
      { type: 'hero', at: 0, title: 'Your Construction Tracker', sub: 'A guide for Dom' },
      { type: 'shot', at: 'n2', img: 'overview', cam: [{ at: 0, x: 640, y: 400, z: 1 }, { at: 'n3', x: 700, y: 330, z: 1.12, d: 6 }], p: { type: 'phone', img: 'phone-overview', cam: undefined } },
    ],
  },
  {
    id: 's02',
    say: [
      'You can send an update three ways.',
      'Type it, like a text to a site manager.',
      'Send a voice note.',
      'Or send a photo, as a file, with a caption.',
    ],
    caption: {
      section: 'Sending updates',
      title: 'Three ways to send an update',
      lines: [
        { at: 'n2', html: '<b>Type it</b>, like a text.' },
        { at: 'n3', html: '<b>Voice note</b>: hold the mic and talk.' },
        { at: 'n4', html: '<b>Photo</b>: send it as a file, with a caption.' },
      ],
    },
    hold: 0.5,
    visuals: [
      {
        type: 'methods',
        at: 0,
        items: [
          { at: 'n2', icon: 'text', title: 'Type it', detail: 'Plain words, like a text', bubble: { kind: 'text', html: 'Park Rd windows now arriving 16 Nov' } },
          { at: 'n3', icon: 'mic', title: 'Voice note', detail: 'Hold the microphone and talk', bubble: { kind: 'voice', len: '0:04' } },
          { at: 'n4', icon: 'clip', title: 'Photo, as a file', detail: 'With a caption: the job and what it shows', bubble: { kind: 'file', name: 'IMG_4127.JPG', size: '3.4 MB', caption: 'Seaview plumbing under slab' } },
        ],
      },
    ],
  },
  {
    id: 's03',
    say: [
      'Every update comes back to you as a card.',
      'It shows each date before and after, and what it does to the finish.',
      'Nothing is saved until you tap Confirm.',
    ],
    caption: {
      section: 'The confirm card',
      title: 'Check the card',
      lines: [
        { at: 'n2', html: 'Each date <b>before → after</b>.' },
        { at: 'n2+2.6', html: 'What it does to the <b>finish</b>.' },
        { at: 'n3', html: 'Nothing saves until you tap <b>Confirm</b>.' },
      ],
    },
    hold: 0,
    visuals: [
      {
        type: 'chat',
        at: 0,
        msgs: [
          { ...chatWindowsStart[0], at: 0.5 },
          {
            ...chatWindowsStart[1],
            at: 'n1+1.2',
            hl: [
              { at: 'n2', until: 'n2+2.6', k: 'eta' },
              { at: 'n2+0.6', until: 'n2+2.6', k: 'steps' },
              { at: 'n2+2.6', until: 'n3', k: 'finish' },
            ],
            ring: { at: 'n3+0.4', label: 'Confirm' },
          },
        ],
      },
    ],
  },
  {
    id: 's04',
    say: [
      'Tap Confirm, and it says Saved.',
      "If it's not quite right, tap Edit and send the correction. Cancel saves nothing.",
      'Changed your mind later? Send slash undo, and the last change comes off.',
    ],
    caption: {
      section: 'Confirm, Edit, Cancel',
      title: 'Saved only when you say so',
      lines: [
        { at: 'n1', html: '<span class="chip chip--tint">Confirm</span> saves it.' },
        { at: 'n2', html: '<span class="chip">Edit</span> send the correction.' },
        { at: 'n2+3.4', html: '<span class="chip">Cancel</span> nothing saved.' },
        { at: 'n3', html: '<b>/undo</b> takes back the last change.' },
      ],
    },
    hold: 1.5,
    visuals: [
      {
        type: 'chat',
        at: 0,
        msgs: [
          { ...chatWindowsStart[0], at: 'pre' },
          {
            ...chatWindowsStart[1],
            at: 'pre',
            tap: { at: 'n1+0.2', label: 'Confirm' },
            edit: { at: 'n1+0.9', html: SAVED_WINDOWS, buttons: [['Undo']] },
          },
          { id: 'u1', from: 'dom', time: '7:44', at: 'n3+1.6', html: '/undo' },
          {
            id: 'u2',
            from: 'bot',
            time: '7:44',
            at: 'n3+2.8',
            html: `<b>Undone</b>
Park Rd windows ETA Mon 26 Oct to Mon 16 Nov.

Park Rd finishes <b>Fri 26 Feb 2027</b>, on track`,
          },
        ],
      },
    ],
  },
  {
    id: 's05',
    say: [
      "If the bot isn't sure, it asks instead of guessing.",
      'The windows are late? There are windows on two jobs, so it asks which one.',
      "Book a trade, and it asks when they're coming.",
    ],
    caption: {
      section: "When it isn't sure",
      title: "It asks. It doesn't guess.",
      lines: [
        { at: 'n2', html: '“the windows are late” → <b>which job?</b>' },
        { at: 'n3', html: 'Booked? It asks <b>when they’re coming</b>.' },
      ],
    },
    hold: 2.5,
    visuals: [
      {
        type: 'chat',
        at: 0,
        msgs: [
          { id: 'a1', from: 'dom', time: '8:15', at: 'n1+1.2', html: 'the windows are late' },
          {
            id: 'a2',
            from: 'bot',
            time: '8:15',
            at: 'n2+1.4',
            html: 'Which shipment do you mean by "the windows"?',
            buttons: [['Park Rd windows (Park Rd)'], ['Seaview St windows (Seaview St)']],
            tap: { at: 'e2+0.1', label: 'Park Rd windows (Park Rd)' },
            edit: { at: 'e2+0.7', html: 'Which shipment do you mean by "the windows"?\n→ Park Rd windows (Park Rd)' },
          },
          { id: 'a3', from: 'bot', time: '8:15', at: 'e2+1.4', html: 'What is the new ETA?' },
          { id: 'b1', from: 'dom', time: '8:20', at: 'n3+2.2', html: 'booked the pump for seaview' },
          {
            id: 'b2',
            from: 'bot',
            time: '8:20',
            at: 'n3+3.6',
            html: 'Book concrete pump at Seaview St needs an expected date to be ordered or booked. <span class="hl" data-k="q">When is it expected?</span>',
            hl: [{ at: 'n3+4.4', until: 'end+3', k: 'q' }],
          },
          { id: 'b3', from: 'dom', time: '8:21', at: 'end+1.4', html: 'fri 2 oct' },
        ],
      },
    ],
  },
  {
    id: 's06',
    say: ['You can ask it questions too, like, what are we waiting on at Beatty?', 'Questions never change anything.'],
    caption: {
      section: 'Questions',
      title: 'Ask it anything',
      lines: [
        { at: 'n1+1.6', html: '“what are we waiting on at Beatty?”' },
        { at: 'n2', html: 'Questions <b>never change anything</b>.' },
        { at: 'end+0.6', html: '“what’s Park Rd’s finish?”' },
      ],
    },
    hold: 3.5,
    visuals: [
      {
        type: 'chat',
        at: 0,
        msgs: [
          { id: 'q1', from: 'dom', time: '12:05', at: 'n1+1.8', html: 'what are we waiting on at Beatty?' },
          {
            id: 'q2',
            from: 'bot',
            time: '12:05',
            at: 'n1+3.2',
            html: `<b>Beatty St · Waiting on</b>
7 outstanding

• Book tiler (Harbour Tiling): expected Mon 5 Oct, 7 days late (needed Mon 28 Sep)
• Order joinery (Oakline Joinery): expected Fri 9 Oct
• Book painter (Fresh Coat Painting): expected Mon 12 Oct
• Order tiles (Tile warehouse): act by Mon 28 Sep
• Order vanity and tapware (Bathroom supplier): act by Mon 5 Oct
• Leaking window flashing, bedroom 2 (Solid Frame Carpentry): expected Thu 24 Sep
• Driveway kerb and layback detail (Dominic): act by Fri 16 Oct`,
          },
          { id: 'q3', from: 'dom', time: '12:06', at: 'end+0.6', html: "what's Park Rd's finish?" },
          { id: 'q4', from: 'bot', time: '12:06', at: 'end+1.6', html: '<b>Park Rd · Finish</b>\nFri 26 Feb 2027, on track' },
        ],
      },
    ],
  },
  {
    id: 's07',
    say: [
      'Some steps are hold points, like the slab inspection at Seaview.',
      "Say it's done with photos missing, and it won't save. It names the photos it needs.",
    ],
    caption: {
      section: 'Hold points',
      title: 'Photos before sign-off',
      lines: [
        { at: 'n1+1', html: 'Hold points need <b>photos</b> first.' },
        { at: 'n2+2', html: 'Missing photos? <b>Nothing saved.</b>' },
        { at: 'n2+4', html: 'It names the photos it still needs.' },
      ],
    },
    hold: 1.5,
    visuals: [
      {
        type: 'chat',
        at: 0,
        msgs: [
          { id: 'h1', from: 'dom', time: '10:31', at: 'n2+0.2', kind: 'voice', len: '0:03' },
          {
            id: 'h2',
            from: 'bot',
            time: '10:31',
            at: 'n2+1.8',
            html: `<b>Seaview St · Slab inspection before pour</b>

Heard: <i>slab inspection at Seaview is done</i>

Can't sign it off yet. No photos for:
<span class="hl" data-k="missing">• Plumbing under slab
• Membrane and termite barrier</span>

<span class="hl" data-k="nothing">Nothing saved.</span>`,
            hl: [
              { at: 'n2+2.2', until: 'n2+4', k: 'nothing' },
              { at: 'n2+4', until: 'end+2.5', k: 'missing' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 's08',
    say: [
      'To send a photo, tap the paperclip, then File. That keeps it full size.',
      'Add a caption, like, Seaview plumbing under slab.',
      "The bot files it in the right job and category, and tells you what's still missing.",
    ],
    caption: {
      section: 'Sending photos',
      title: 'Send photos as files',
      lines: [
        { at: 'n1+0.8', html: '<b>Paperclip → File</b> → pick the photo.' },
        { at: 'n2', html: 'Caption: <b>the job and what it shows</b>.' },
        { at: 'n3', html: 'Filed in the right <b>job and category</b>.' },
      ],
    },
    hold: 2.5,
    visuals: [
      {
        type: 'chat',
        at: 0,
        menu: { at: 'n1+1.2', file: 'n1+2.6', until: 'n1+4.2' },
        msgs: [
          { id: 'p1', from: 'dom', time: '10:40', at: 'n2+0.6', kind: 'file', name: 'IMG_4127.JPG', size: '3.4 MB', html: 'Seaview plumbing under slab' },
          {
            id: 'p2',
            from: 'bot',
            time: '10:40',
            at: 'n3+0.4',
            html: `<b>Seaview St · New photo</b>

<span class="hl" data-k="filed">Photo filed: Seaview St, Slab, Plumbing under slab.</span>

No change to the finish (Fri 29 Oct 2027)

<span class="hl" data-k="still">Slab inspection before pour photos: 2 of 3. Still needed: Membrane and termite barrier.</span>

Save this?`,
            buttons: CONFIRM_ROW,
            hl: [
              { at: 'n3+1.2', until: 'n3+3.4', k: 'filed' },
              { at: 'n3+3.4', until: 'end+0.6', k: 'still' },
            ],
            tap: { at: 'end+0.5', label: 'Confirm' },
            edit: {
              at: 'end+1.1',
              html: `<b>Saved ✓</b>
Photo filed: Seaview St, Slab, Plumbing under slab.

Seaview St finishes <b>Fri 29 Oct 2027</b>, on track
Slab inspection before pour photos: 2 of 3. Still needed: Membrane and termite barrier.`,
              buttons: [['Undo']],
            },
          },
        ],
      },
    ],
  },
  {
    id: 's09',
    say: [
      "Every morning at seven, the bot sends a reminder: what's overdue, what's coming due, and any job not confirmed for a week.",
      'Checked a job? Send, Beatty all checked, and confirm the card.',
    ],
    caption: {
      section: 'Reminders',
      title: 'Every morning at 7',
      lines: [
        { at: 'n1+3.2', html: 'What’s <b>overdue</b> and <b>coming due</b>.' },
        { at: 'n1+5.6', html: 'Jobs <b>not confirmed</b> for a week.' },
        { at: 'n2', html: '“beatty all checked” → <b>Confirm</b>.' },
      ],
    },
    hold: 2,
    visuals: [
      {
        type: 'chat',
        at: 0,
        msgs: [
          {
            id: 'r1',
            from: 'bot',
            time: '7:00',
            at: 0.8,
            html: `<b>Reminders · Thu 17 Sep</b>

<span class="hl" data-k="park"><b>Park Rd</b>
• ⚠️ Overdue by 5 weeks: Glazing energy compliance certificate, act by Mon 10 Aug
• ⚠️ Overdue by 3 days: Tile choice, act by Mon 14 Sep
• Book plasterer: act by Fri 18 Sep (tomorrow)</span>

<b>Seaview St</b>
• Book concrete pump: act by Fri 18 Sep (tomorrow)

<span class="hl" data-k="beatty"><b>Beatty St</b> · not confirmed for 9 days. Check it and confirm the job.</span>`,
            hl: [
              { at: 'n1+3.2', until: 'n1+5.6', k: 'park' },
              { at: 'n1+5.6', until: 'n2+1', k: 'beatty' },
            ],
          },
          { id: 'r2', from: 'dom', time: '7:31', at: 'n2+1.6', html: 'beatty all checked' },
          {
            id: 'r3',
            from: 'bot',
            time: '7:31',
            at: 'n2+2.8',
            html: `<b>Beatty St · Last confirmed</b>

Tue 8 Sep → <b>Thu 17 Sep</b>

No change to the finish (Fri 4 Dec)
Confirmed again: it hadn't been confirmed for 9 days

Save this?`,
            buttons: CONFIRM_ROW,
            ring: { at: 'end+1.6', label: 'Confirm' },
          },
        ],
      },
    ],
  },
  {
    id: 's10',
    say: ['Now, the dashboard.', 'The Overview has one card per job: its stage, and how many things are overdue.', 'Red only ever means overdue. Tap a card to open the job.'],
    caption: {
      section: 'The dashboard',
      title: 'Overview',
      lines: [
        { at: 'n2', html: 'One card per job: its <b>stage</b> and what’s <b>overdue</b>.' },
        { at: 'n3', html: '<b>Red</b> means overdue. Nothing else.' },
      ],
    },
    hold: 0,
    visuals: [
      {
        type: 'shot',
        at: 0,
        img: 'overview',
        cam: [
          { at: 0, x: 640, y: 400, z: 1 },
          { at: 'n2', x: 560, y: 260, z: 1.45, d: 3 },
        ],
        marks: [
          { at: 'n2+1.4', until: 'n3', box: 'parkCard' },
          { at: 'n2+3', until: 'n3', box: 'parkStage' },
          { at: 'n3', box: 'parkOverdue' },
        ],
        p: { type: 'phone', img: 'phone-overview', cam: undefined },
      },
    ],
  },
  {
    id: 's11',
    say: ["A job's first page shows the next hold point, everything overdue, and the trades on site this week.", 'The tabs take you to the rest.'],
    caption: {
      section: 'The dashboard',
      title: 'A job’s first page',
      lines: [
        { at: 'n1+1.2', html: 'The next <b>hold point</b>.' },
        { at: 'n1+2.8', html: 'Everything <b>overdue</b>.' },
        { at: 'n1+4.4', html: '<b>Trades</b> on site this week.' },
        { at: 'n2', html: 'Tabs for the rest of the job.' },
      ],
    },
    hold: 1.5,
    visuals: [
      {
        type: 'shot',
        at: 0,
        img: 'job-park-rd-full',
        cam: [
          { at: 0, x: 640, y: 400, z: 1 },
          { at: 'n1+1', x: 640, y: 380, z: 1.1, d: 1.6 },
          { at: 'n1+2.6', x: 640, y: 640, z: 1.1, d: 1.8 },
          { at: 'n1+4.2', x: 640, y: 1000, z: 1.1, d: 1.8 },
          { at: 'n2-0.2', x: 640, y: 300, z: 1.1, d: 2.2 },
        ],
        marks: [
          { at: 'n1+1.2', until: 'n1+2.8', box: 'hold' },
          { at: 'n1+2.8', until: 'n1+4.4', box: 'overdue' },
          { at: 'n1+4.4', until: 'n2', box: 'trades' },
          { at: 'n2+1.4', rect: [252, 128, 520, 46] },
        ],
        p: {
          type: 'phone',
          img: 'phone-job-park-rd-full',
          cam: [
            { at: 0, x: 195, y: 422, z: 1 },
            { at: 'n1+2.6', x: 195, y: 640, z: 1, d: 1.8 },
            { at: 'n1+4.2', x: 195, y: 1000, z: 1, d: 1.8 },
            { at: 'n2-0.2', x: 195, y: 422, z: 1, d: 2.2 },
          ],
          marks: [
            { at: 'n1+1.2', until: 'n1+2.8', box: 'hold' },
            { at: 'n1+2.8', until: 'n1+4.4', box: 'overdue' },
            { at: 'n1+4.4', until: 'n2', box: 'trades' },
            { at: 'n2+1.4', rect: [8, 180, 374, 48] },
          ],
        },
      },
    ],
  },
  {
    id: 's12',
    say: ['Waiting on is one list for every job: overdue, this week, and later.', 'Where a trade has a number, tap Call to ring them.'],
    caption: {
      section: 'The dashboard',
      title: 'Waiting on',
      lines: [
        { at: 'n1+2', html: '<b>Overdue</b> · <b>This week</b> · <b>Later</b>' },
        { at: 'n2', html: 'Tap <b>Call</b> to ring the trade.' },
      ],
    },
    hold: 2.5,
    visuals: [
      {
        type: 'shot',
        at: 0,
        img: 'waiting',
        cam: [
          { at: 0, x: 640, y: 400, z: 1 },
          { at: 'n2', x: 750, y: 480, z: 1.25, d: 2.4 },
        ],
        marks: [
          { at: 'n1+2', until: 'n2', box: 'overdueHead' },
          { at: 'n2+1.6', box: 'call' },
        ],
        p: {
          type: 'phone',
          img: 'phone-waiting-full',
          cam: [{ at: 0, x: 195, y: 422, z: 1 }, { at: 'n2', x: 195, y: 560, z: 1, d: 2 }],
          marks: [
            { at: 'n1+2', until: 'n2', box: 'overdueHead' },
            { at: 'n2+1.6', box: 'call' },
          ],
        },
      },
      {
        type: 'phone',
        at: 'end+0.6',
        img: 'phone-waiting',
        marks: [{ at: 0.8, box: 'call' }],
        p: { skip: true },
      },
    ],
  },
  {
    id: 's13',
    say: ["Shipments shows each delivery's status and ETA, and whether it lands in time.", 'When a supplier gives you a new date, just tell the bot.'],
    caption: {
      section: 'The dashboard',
      title: 'Shipments',
      lines: [
        { at: 'n1+1', html: '<b>Status</b> and <b>ETA</b> for each delivery.' },
        { at: 'n1+3', html: 'Does it land <b>in time</b>?' },
        { at: 'n2', html: 'New date? <b>Tell the bot.</b>' },
      ],
    },
    hold: 0.5,
    visuals: [
      {
        type: 'shot',
        at: 0,
        img: 'shipments-park-rd',
        cam: [
          { at: 0, x: 640, y: 400, z: 1 },
          { at: 'n1+0.6', x: 760, y: 380, z: 1.25, d: 2.6 },
        ],
        marks: [
          { at: 'n1+1.4', until: 'n1+3', box: 'status' },
          { at: 'n1+1.4', until: 'n1+3', box: 'eta' },
          { at: 'n1+3', box: 'etaNote' },
        ],
        p: { type: 'phone', img: 'phone-shipments-park-rd', cam: undefined },
      },
    ],
  },
  {
    id: 's14',
    say: ['Program is the Gantt chart. Dark bars are the forecast, outlines are the plan, and the orange line is today.', 'On a phone, it shows a look-ahead. Tap any step for its details.'],
    caption: {
      section: 'The dashboard',
      title: 'Program',
      lines: [
        { at: 'n1+1.8', html: '<b>Dark bar</b>: forecast. <b>Outline</b>: plan.' },
        { at: 'n1+4.6', html: '<b>Orange line</b>: today.' },
        { at: 'n2', html: 'On a phone: the <b>look-ahead</b>.' },
        { at: 'n2+2.6', html: 'Tap a step for its <b>details</b>.' },
      ],
    },
    hold: 2.5,
    visuals: [
      {
        type: 'shot',
        at: 0,
        img: 'program-park-rd',
        cam: [
          { at: 0, x: 640, y: 420, z: 1 },
          { at: 'n1+1.4', x: 640, y: 520, z: 1.15, d: 2.4 },
        ],
        marks: [
          { at: 'n1+1.8', until: 'n1+4.6', rect: [266, 722, 384, 32] },
          { at: 'n1+4.6', until: 'end', rect: [664, 294, 58, 426] },
        ],
        p: { cam: [{ at: 0, x: 640, y: 420, z: 0.77 }] },
      },
      {
        type: 'phone',
        at: 'n2',
        img: 'phone-program-park-rd',
        marks: [{ at: 0.8, box: 'week' }],
      },
      {
        type: 'shot',
        at: 'n2+2.6',
        img: 'step-windows',
        cam: [
          { at: 0, x: 640, y: 400, z: 1 },
          { at: 1, x: 760, y: 460, z: 1.2, d: 3 },
        ],
        marks: [
          { at: 0.8, box: 'dates' },
          { at: 2.2, box: 'needs' },
        ],
        p: { type: 'phone', img: 'phone-step-windows', cam: undefined, marks: [{ at: 0.8, box: 'dates' }] },
      },
    ],
  },
  {
    id: 's15',
    say: ['Photos are sorted by stage, and show which hold point photos are missing.', 'Notes keeps your daily site notes.', 'And Changes lists every saved change, with the message that made it.'],
    caption: {
      section: 'The dashboard',
      title: 'Photos, Notes, Changes',
      lines: [
        { at: 'n1', html: '<b>Photos</b> by stage, with what’s missing.' },
        { at: 'n2', html: '<b>Notes</b>: your daily site notes.' },
        { at: 'n3', html: '<b>Changes</b>: every change, with its message.' },
      ],
    },
    hold: 2,
    visuals: [
      {
        type: 'shot',
        at: 0,
        img: 'photos-seaview-full',
        cam: [
          { at: 0, x: 640, y: 400, z: 1 },
          { at: 'n1+1.6', x: 700, y: 520, z: 1.25, d: 2.6 },
        ],
        marks: [{ at: 'n1+3', box: 'missing' }],
        p: { type: 'phone', img: 'phone-photos-seaview-full', cam: [{ at: 0, x: 195, y: 422, z: 1 }, { at: 'n1+1.6', x: 195, y: 700, z: 1, d: 2.6 }] },
      },
      {
        type: 'shot',
        at: 'n2',
        img: 'notes-park-rd',
        cam: [
          { at: 0, x: 640, y: 400, z: 1 },
          { at: 0.6, x: 700, y: 420, z: 1.2, d: 3 },
        ],
        marks: [{ at: 1.2, box: 'first' }],
        p: { type: 'phone', img: 'phone-notes-park-rd', cam: undefined },
      },
      {
        type: 'shot',
        at: 'n3',
        img: 'history-full',
        cam: [
          { at: 0, x: 640, y: 400, z: 1 },
          { at: 0.6, x: 640, y: 380, z: 1.2, d: 3 },
        ],
        marks: [{ at: 1.4, box: 'first' }],
        p: { type: 'phone', img: 'phone-history', cam: undefined },
      },
    ],
  },
  {
    id: 's16',
    say: ['New jobs are set up on the computer, under Setup.', 'Pick New job, give it a name, choose the template, and set the start date.', 'Programs and Trades are there too.'],
    caption: {
      section: 'Setup',
      title: 'Setup, on the computer',
      lines: [
        { at: 'n1+1', html: 'New jobs: <b>Setup → New job</b>.' },
        { at: 'n2+1', html: 'A name, a <b>template</b>, a start date.' },
        { at: 'n3', html: '<b>Programs</b> and <b>Trades</b> are there too.' },
      ],
    },
    hold: 2.5,
    visuals: [
      {
        type: 'shot',
        at: 0,
        img: 'setup-new-job-full',
        cam: [
          { at: 0, x: 640, y: 400, z: 1 },
          { at: 'n2', x: 600, y: 420, z: 1.3, d: 3.4 },
        ],
        marks: [
          { at: 'n2+1', until: 'n2+2.4', rect: [250, 98, 320, 70] },
          { at: 'n2+2.4', until: 'n2+3.6', box: 'template' },
          { at: 'n2+3.6', rect: [250, 545, 200, 74] },
        ],
        p: { cam: [{ at: 0, x: 640, y: 400, z: 0.77 }, { at: 'n2', x: 520, y: 420, z: 1.05, d: 3.4 }] },
      },
      { type: 'shot', at: 'n3', img: 'setup-programs', cam: [{ at: 0, x: 640, y: 400, z: 1 }], p: { cam: [{ at: 0, x: 640, y: 400, z: 0.77 }] } },
      { type: 'shot', at: 'end+0.6', img: 'setup-trades', cam: [{ at: 0, x: 640, y: 400, z: 1 }, { at: 0.4, x: 700, y: 380, z: 1.15, d: 3 }], p: { cam: [{ at: 0, x: 640, y: 400, z: 0.77 }] } },
    ],
  },
  {
    id: 's17',
    say: ['Five quick tips.', 'Say the job name in every message.', 'Send photos as files, with a caption.', 'Read the card before you tap Confirm.', 'Made a mistake? Slash undo.', 'And confirm each job once a week.'],
    caption: { section: 'Tips', title: 'Five quick tips', lines: [] },
    hold: 1.5,
    visuals: [
      {
        type: 'tips',
        at: 0,
        items: [
          { at: 'n2', html: 'Say the <b>job name</b> in every message.' },
          { at: 'n3', html: 'Send photos <b>as files</b>, with a caption.' },
          { at: 'n4', html: '<b>Read the card</b> before you tap Confirm.' },
          { at: 'n5', html: 'Made a mistake? <b>/undo</b>' },
          { at: 'n6', html: '<b>Confirm each job</b> once a week.' },
        ],
      },
    ],
  },
  {
    id: 's18',
    say: ["That's it, Dom. Message the bot, check the card, tap Confirm."],
    hold: 3,
    visuals: [
      {
        type: 'hero',
        at: 0,
        lines: [
          { at: 'n1+1.3', html: 'Message the bot.' },
          { at: 'n1+2.4', html: 'Check the card.' },
          { at: 'n1+3.4', html: 'Tap <span class="tint">Confirm</span>.' },
        ],
        sub: 'Construction Tracker · a guide for Dom',
        subAt: 'end+1',
      },
    ],
  },
];
