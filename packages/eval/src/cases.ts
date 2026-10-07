/**
 * The eval cases: messages Dominic would send the bot, each with the outcome the bot should reach.
 *
 * Graded against the seed (buildSeed) with a FIXED clock: Thu 17 Sep 2026. Expected op args are the
 * values AFTER core resolves them: ids for names (job 'park-rd', shipment 'sh-pr-windows', item
 * 'it-sv-pump', category 'sv-pc-slab-plumbing'), ISO dates for dates. Only the keys listed are checked.
 *
 * `modelCalls` is one right answer as a model would give it (names and dates as said). `--dry` feeds it
 * to a FakeLlm, so the dry run proves both the grader and that core resolves those phrasings.
 * Adding a case: see packages/eval/README.md.
 */

/** A JSON value to compare exactly, or a looser matcher. */
export type Matcher =
  | string
  | number
  | boolean
  | null
  | { includes: string } // case-insensitive substring (free text: titles, notes)
  | { oneOf: (string | number | boolean | null)[] }; // any of these

export interface ExpectedOp {
  op: string;
  /** Resolved args to check (op arg names; ids and ISO dates). */
  args: Record<string, Matcher>;
}

export type Expectation =
  /** These ops, in any order, nothing else proposed. */
  | { kind: 'ops'; ops: ExpectedOp[] }
  /** The parser (ask_question) or core (ambiguous name, missing detail) asks; nothing proposed. */
  | { kind: 'question' }
  /** A read-only tool; no op. `tools` limits which ones count (any read tool when left out). */
  | { kind: 'read'; tools?: string[] }
  /** The right op is called and core refuses it (e.g. the hold-point photo rule). */
  | { kind: 'refusal'; op: string; reasonIncludes?: string };

export interface ModelCall {
  name: string;
  args: Record<string, unknown>;
}

export interface EvalCase {
  id: string;
  /** What Dominic sends. For a photo case, the caption. */
  text: string;
  /** Sent as a captioned photo: the parser sees "Photo caption: <text>" and attach_photo gets a file, as in the bot. */
  photo?: boolean;
  /** One line: what the case tests. */
  why: string;
  /** The outcome to reach; a list means any one of them passes. */
  expect: Expectation | Expectation[];
  /** A right answer in model terms, for --dry. */
  modelCalls: ModelCall[];
}

const TODAY = '2026-09-17';
const YESTERDAY = '2026-09-16';

export const CASES: EvalCase[] = [
  // --- set_shipment_eta ---------------------------------------------------------------------------
  {
    id: 'eta-park-windows',
    text: 'Park Rd windows now arriving 16 Nov',
    why: 'SPEC flow a, the headline change: shipment named by job, plain date.',
    expect: { kind: 'ops', ops: [{ op: 'set_shipment_eta', args: { shipment: 'sh-pr-windows', eta: '2026-11-16' } }] },
    modelCalls: [{ name: 'set_shipment_eta', args: { shipment: 'windows', job: 'Park Rd', eta: '16 Nov' } }],
  },
  {
    id: 'eta-seaview-windows-typo',
    text: 'jade coast emailed, seaview windoes pushed out to 11 jan',
    why: 'Typo in the shipment, supplier named, a date that rolls into next year (Mon 11 Jan 2027).',
    expect: { kind: 'ops', ops: [{ op: 'set_shipment_eta', args: { shipment: 'sh-sv-windows', eta: '2027-01-11' } }] },
    modelCalls: [{ name: 'set_shipment_eta', args: { shipment: 'windoes', job: 'seaview', eta: '11 jan' } }],
  },

  // --- set_shipment_status ------------------------------------------------------------------------
  {
    id: 'shipment-seaview-production-voice',
    text: "yeah so the seaview windows um jade coast rang this morning and they've gone into production now so thats moving",
    why: 'Voice-transcript run-on with fillers; status in_production.',
    expect: { kind: 'ops', ops: [{ op: 'set_shipment_status', args: { shipment: 'sh-sv-windows', status: 'in_production' } }] },
    modelCalls: [{ name: 'set_shipment_status', args: { shipment: 'windows', job: 'Seaview', status: 'in_production' } }],
  },

  // --- mark_step_done -----------------------------------------------------------------------------
  {
    id: 'step-done-park-roof-plumbing',
    text: 'roof plumbing at park rd is finished',
    why: 'Plain step done, defaults to today.',
    expect: { kind: 'ops', ops: [{ op: 'mark_step_done', args: { step: 'pr-roof-plumbing', date: TODAY } }] },
    modelCalls: [{ name: 'mark_step_done', args: { step: 'roof plumbing', job: 'Park Rd' } }],
  },
  {
    id: 'step-done-beatty-roughin-yesterday',
    text: 'rough in at beatty is all done, sparky finished up yesterday',
    why: 'Stage-level job step, "yesterday" as the done date; "sparky" must not become an item change.',
    expect: { kind: 'ops', ops: [{ op: 'mark_step_done', args: { step: 'bt-roughin', date: YESTERDAY } }] },
    modelCalls: [{ name: 'mark_step_done', args: { step: 'rough in', job: 'Beatty', date: 'yesterday' } }],
  },
  {
    id: 'step-done-seaview-slab-insp-refused',
    text: 'slab inspection at Seaview is done',
    why: 'SPEC flow b: the right call is made and core refuses it (hold point, 2 photo categories empty).',
    expect: { kind: 'refusal', op: 'mark_step_done', reasonIncludes: 'No photos for' },
    modelCalls: [{ name: 'mark_step_done', args: { step: 'slab inspection', job: 'Seaview' } }],
  },

  // --- set_item_status ----------------------------------------------------------------------------
  {
    id: 'item-booked-seaview-pump',
    text: 'booked the pump for seaview',
    why: 'Short, past tense; "the pump" is the Book concrete pump item; booked = ordered_or_booked.',
    expect: { kind: 'ops', ops: [{ op: 'set_item_status', args: { item: 'it-sv-pump', status: 'ordered_or_booked' } }] },
    modelCalls: [{ name: 'set_item_status', args: { item: 'pump', job: 'Seaview', status: 'ordered_or_booked' } }],
  },
  {
    id: 'item-confirmed-park-plasterer',
    text: 'smooth wall locked in for the park rd plaster, confirmed',
    why: 'Trade named by company, "locked in ... confirmed" = confirmed (sets the confirmed date to today).',
    expect: {
      kind: 'ops',
      ops: [{ op: 'set_item_status', args: { item: 'it-pr-plasterer', status: 'confirmed', date: TODAY } }],
    },
    modelCalls: [{ name: 'set_item_status', args: { item: 'plasterer', job: 'Park Rd', status: 'confirmed' } }],
  },

  // --- set_item_expected_date ---------------------------------------------------------------------
  {
    id: 'item-expected-beatty-tiler',
    text: 'tiler cant start beatty till the 12th',
    why: '"the 12th" is the next 12th on or after today: Mon 12 Oct. No apostrophes.',
    expect: { kind: 'ops', ops: [{ op: 'set_item_expected_date', args: { item: 'it-bt-tiler', date: '2026-10-12' } }] },
    modelCalls: [{ name: 'set_item_expected_date', args: { item: 'tiler', job: 'Beatty', date: 'the 12th' } }],
  },
  {
    id: 'item-expected-park-sw-plumber',
    text: 'clearflow pushed the stormwater job at park rd to next wednesday',
    why: '"next Wednesday" = Wednesday of next week (Wed 23 Sep); item named by trade company and task.',
    expect: {
      kind: 'ops',
      ops: [{ op: 'set_item_expected_date', args: { item: 'it-pr-sw-plumber', date: '2026-09-23' } }],
    },
    modelCalls: [{ name: 'set_item_expected_date', args: { item: 'plumber for stormwater', job: 'Park Rd', date: 'next wednesday' } }],
  },

  // --- add_item -----------------------------------------------------------------------------------
  {
    id: 'add-item-park-defect',
    text: 'add a defect at park rd, scratched glass on the laundry slider, solid frame to sort it',
    why: 'New defect (no step needed); free-text title.',
    expect: {
      kind: 'ops',
      ops: [{ op: 'add_item', args: { job: 'park-rd', type: 'defect', title: { includes: 'glass' } } }],
    },
    modelCalls: [
      {
        name: 'add_item',
        args: { job: 'Park Rd', type: 'defect', title: 'Scratched glass on the laundry slider', trade: 'Solid Frame' },
      },
    ],
  },
  {
    id: 'add-item-seaview-reminder',
    text: 'remind me to renew the scaffold licence for seaview',
    why: '"remind me" = a manual reminder item, which needs no step or date.',
    expect: {
      kind: 'ops',
      ops: [{ op: 'add_item', args: { job: 'seaview', type: 'manual_reminder', title: { includes: 'scaffold' } } }],
    },
    modelCalls: [{ name: 'add_item', args: { job: 'Seaview', type: 'manual_reminder', title: 'Renew scaffold licence' } }],
  },
  {
    id: 'add-item-park-material-step',
    text: 'need to order shower screens for park rd, needed for the tiling',
    why: 'Material to order, tied to a program step (Tiling) so it gets a needed-by.',
    expect: {
      kind: 'ops',
      ops: [
        {
          op: 'add_item',
          args: { job: 'park-rd', type: 'material', title: { includes: 'shower screen' }, step: 'pr-tiling' },
        },
      ],
    },
    modelCalls: [{ name: 'add_item', args: { job: 'Park Rd', type: 'material', title: 'Order shower screens', step: 'tiling' } }],
  },

  // --- override_lead_time -------------------------------------------------------------------------
  {
    id: 'lead-park-tiles',
    text: 'tile warehouse says the park rd tiles are 10 weeks lead time now',
    why: 'Lead time in weeks on the tile order; "tiles" also matches the tiler, tile choice and cracked roof tiles, so a question is fine too.',
    expect: [
      { kind: 'ops', ops: [{ op: 'override_lead_time', args: { item: 'it-pr-tiles', weeks: 10 } }] },
      { kind: 'question' },
    ],
    modelCalls: [{ name: 'override_lead_time', args: { item: 'Order tiles', job: 'Park Rd', weeks: 10 } }],
  },
  {
    id: 'lead-park-kitchen',
    text: 'oakline quoting 8 wks lead on the park rd kitchen order now',
    why: '"wks" shorthand; the message says "kitchen order", so it must be the order, not the design sign-off (no question needed).',
    expect: { kind: 'ops', ops: [{ op: 'override_lead_time', args: { item: 'it-pr-kitchen', weeks: 8 } }] },
    modelCalls: [{ name: 'override_lead_time', args: { item: 'kitchen order', job: 'Park Rd', weeks: 8 } }],
  },

  // --- add_daily_note -----------------------------------------------------------------------------
  {
    id: 'note-park-rain',
    text: 'note for park rd: rained out this arvo, cladders packed up at 1',
    why: 'Explicit note, "arvo" slang, dated today.',
    expect: {
      kind: 'ops',
      ops: [{ op: 'add_daily_note', args: { job: 'park-rd', date: TODAY, text: { includes: 'rain' } } }],
    },
    modelCalls: [{ name: 'add_daily_note', args: { job: 'Park Rd', text: 'Rained out this arvo, cladders packed up at 1' } }],
  },
  {
    id: 'note-beatty-voice-yesterday',
    text: 'beatty yesterday the sparky was there all day and um the plumbo came in the afternoon and the skip got swapped over',
    why: 'Voice-style site diary for yesterday; a note, not step or item changes.',
    expect: {
      kind: 'ops',
      ops: [{ op: 'add_daily_note', args: { job: 'beatty', date: YESTERDAY, text: { includes: 'skip' } } }],
    },
    modelCalls: [
      {
        name: 'add_daily_note',
        args: { job: 'Beatty', date: 'yesterday', text: 'Sparky on all day, plumber in the afternoon, skip swapped over' },
      },
    ],
  },

  // --- attach_photo -------------------------------------------------------------------------------
  {
    id: 'photo-seaview-plumbing',
    text: 'seaview plumbing under slab',
    photo: true,
    why: 'SPEC flow c: a captioned photo filed to a required hold-point category.',
    expect: {
      kind: 'ops',
      ops: [{ op: 'attach_photo', args: { job: 'seaview', category: 'sv-pc-slab-plumbing' } }],
    },
    modelCalls: [{ name: 'attach_photo', args: { job: 'Seaview', category: 'plumbing under slab' } }],
  },
  {
    id: 'photo-park-cladding',
    text: 'park rd cladding nearly there',
    photo: true,
    why: 'Casual caption; the category is External cladding (Lock-up).',
    expect: {
      kind: 'ops',
      ops: [{ op: 'attach_photo', args: { job: 'park-rd', category: 'pr-pc-lockup-cladding' } }],
    },
    modelCalls: [{ name: 'attach_photo', args: { job: 'Park Rd', category: 'cladding' } }],
  },

  // --- confirm_job --------------------------------------------------------------------------------
  {
    id: 'confirm-beatty',
    text: 'went thru beatty with the builder, numbers all good',
    why: 'Confirming without the word "confirm"; clears Beatty\'s amber.',
    expect: { kind: 'ops', ops: [{ op: 'confirm_job', args: { job: 'beatty', date: TODAY } }] },
    modelCalls: [{ name: 'confirm_job', args: { job: 'Beatty' } }],
  },
  {
    id: 'confirm-park-and-seaview',
    text: 'confirmed park rd and seaview with the boys this morning',
    why: 'Two jobs in one message: two calls, one card.',
    expect: {
      kind: 'ops',
      ops: [
        { op: 'confirm_job', args: { job: 'park-rd', date: TODAY } },
        { op: 'confirm_job', args: { job: 'seaview', date: TODAY } },
      ],
    },
    modelCalls: [
      { name: 'confirm_job', args: { job: 'Park Rd' } },
      { name: 'confirm_job', args: { job: 'Seaview' } },
    ],
  },

  // --- several ops ---------------------------------------------------------------------------------
  {
    id: 'combo-seaview-pump-steel',
    text: 'pumps booked for seaview and the slab steel got delivered today',
    why: 'Two item changes in one breath: pump booked, slab steel done.',
    expect: {
      kind: 'ops',
      ops: [
        { op: 'set_item_status', args: { item: 'it-sv-pump', status: 'ordered_or_booked' } },
        { op: 'set_item_status', args: { item: 'it-sv-slab-steel', status: 'done' } },
      ],
    },
    modelCalls: [
      { name: 'set_item_status', args: { item: 'pump', job: 'Seaview', status: 'ordered_or_booked' } },
      { name: 'set_item_status', args: { item: 'slab steel', job: 'Seaview', status: 'done' } },
    ],
  },
  {
    id: 'combo-park-council-and-note',
    text: 'council finally came back on the park rd stormwater connection, approved. put a note in too, plumber can start monday',
    why: 'An approval (item done or confirmed) plus an explicit note in the same message.',
    expect: {
      kind: 'ops',
      ops: [
        { op: 'set_item_status', args: { item: 'it-pr-sw-council', status: { oneOf: ['done', 'confirmed'] } } },
        { op: 'add_daily_note', args: { job: 'park-rd', text: { includes: 'plumber' } } },
      ],
    },
    modelCalls: [
      { name: 'set_item_status', args: { item: 'stormwater connection approval', job: 'Park Rd', status: 'done' } },
      { name: 'add_daily_note', args: { job: 'Park Rd', text: 'Council approved the stormwater connection. Plumber can start Monday.' } },
    ],
  },

  // --- questions ----------------------------------------------------------------------------------
  {
    id: 'q-windows-late',
    text: 'the windows are late',
    why: 'SPEC flow d: two windows shipments and no date, so it must ask, never guess.',
    expect: { kind: 'question' },
    modelCalls: [{ name: 'set_shipment_eta', args: { shipment: 'the windows' } }],
  },
  {
    id: 'q-sparky-back-a-week',
    text: 'push the sparky back a week',
    why: 'No job named: a question, or the only open sparky item (Park Rd rough-in electrician) moved a week out (Thu 24 Sep), since the card shows the job.',
    expect: [
      { kind: 'question' },
      { kind: 'ops', ops: [{ op: 'set_item_expected_date', args: { item: 'it-pr-ri-electrician', date: '2026-09-24' } }] },
    ],
    modelCalls: [{ name: 'ask_question', args: { question: 'Which job is the sparky on, and back to what date?' } }],
  },
  {
    id: 'q-note-no-job',
    text: 'note: concrete truck turned up an hour late again',
    why: 'A note with no job named: ask which job.',
    expect: { kind: 'question' },
    modelCalls: [{ name: 'add_daily_note', args: { text: 'Concrete truck turned up an hour late again' } }],
  },
  {
    id: 'q-photo-no-job',
    text: 'plumbing under slab',
    photo: true,
    why: 'Photo caption with a category both Park Rd and Seaview have: ask which job (buttons).',
    expect: { kind: 'question' },
    modelCalls: [{ name: 'attach_photo', args: { category: 'plumbing under slab' } }],
  },

  // --- reads --------------------------------------------------------------------------------------
  {
    id: 'read-park-finish',
    text: "what's Park Rd looking like for finish",
    why: 'A question about the finish is a read, never a change.',
    expect: { kind: 'read', tools: ['get_job_finish'] },
    modelCalls: [{ name: 'get_job_finish', args: { job: 'Park Rd' } }],
  },
  {
    id: 'read-beatty-whos-on',
    text: 'whos on at beatty this wk',
    why: 'Loose question with "wk"; any read tool is fine, a change is not.',
    expect: { kind: 'read' },
    modelCalls: [{ name: 'get_waiting_on', args: { job: 'Beatty' } }],
  },
  {
    id: 'read-seaview-waiting',
    text: 'what are we still waiting on at seaview',
    why: 'Waiting-on read for one job.',
    expect: { kind: 'read', tools: ['get_waiting_on', 'get_to_chase'] },
    modelCalls: [{ name: 'get_waiting_on', args: { job: 'Seaview' } }],
  },
];

/** The day-to-day ops SPEC names; every one must appear in at least one case. */
export const REQUIRED_OPS = [
  'set_shipment_eta',
  'set_shipment_status',
  'mark_step_done',
  'set_item_status',
  'set_item_expected_date',
  'add_item',
  'override_lead_time',
  'add_daily_note',
  'attach_photo',
  'confirm_job',
] as const;
