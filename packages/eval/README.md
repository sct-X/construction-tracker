# @ct/eval: the parser eval

`npm run eval` sends 30 realistic messages from Dominic (Australian phrasing, site jargon, typos,
relative dates, voice-transcript run-ons, ambiguous ones) through the real parser (`createParser` from
`@ct/llm`) and each LLM provider you have a key for. Each answer then goes through core operations
the way the bot runs it, against the seed data with the clock fixed at Thu 17 Sep 2026. It is a dry
run on an in-memory copy, so nothing is written anywhere. Not part of `npm test`.

## Running it

```sh
npm run eval                      # every provider with a key; the others show "skipped (no key)"
npm run eval -- --dry             # no keys, no network: a fake model gives each case's right answer (expect 30/30)
npm run eval -- --verbose         # also print what each case produced
npm run eval -- --only q-windows-late,eta-park-windows
EVAL_MODELS=gpt-5-nano,claude-sonnet-4-5 npm run eval   # pick the models (comma list)
```

Keys come from the shell or from `.env` at the repo root: `OPENAI_API_KEY` (runs gpt-5-mini),
`GEMINI_API_KEY` or `GOOGLE_API_KEY` (gemini-2.5-flash), `ANTHROPIC_API_KEY` (claude-haiku-4-5).
`LLM_PROVIDER` and `LLM_BASE_URL` are ignored here so the bot's setting can't redirect every provider.
Other `LLM_*` tuning (`LLM_TIMEOUT_MS`, `LLM_REASONING_EFFORT`, `LLM_THINKING_BUDGET`) still applies.
Up to 4 cases run at once (`EVAL_CONCURRENCY`), each with a 90 s limit (`EVAL_TIMEOUT_MS`).
One run is one model call per case (the system prompt and tool list are a few thousand tokens each
time), so expect a few cents per provider, more for Claude Haiku.

## Reading the output

For each provider (numbers here are made up):

```
gpt-5-mini (openai)
  pass 27/30 (90%)
  tokens 152,310 (148,200 in, 4,110 out)
  cost $0.045 (estimate from @ct/llm MODEL_PRICES)
  median latency 2.4 s
  failed:
    q-sparky-back-a-week  want a question; proposed set_item_expected_date
    lead-park-kitchen     want override_lead_time; asked (core): "Which item do you mean by "kitchen"?"
```

Then a summary table, one row per model. Costs are estimates from the price table in
`packages/llm/src/pricing.ts`, not what the vendor bills. A real run always exits 0, even with failures;
`--dry` exits 1 unless every case passes.

What the failure reasons mean:

- `want a question; proposed X`: the model guessed where it should have asked.
- `X: item it-pr-tiler (want it-pr-tiles)`: right op, wrong thing or date after core resolved it.
- `asked (core): ...`: the model's names were too loose for core's fuzzy matcher, or a detail was
  missing. The bot would then ask Dominic, so this is a slower answer rather than a wrong one. If many
  models fail this way on the same case, look at the fuzzy matcher, not the model.
- `asked (parser): ...`: the model used `ask_question` where the message was clear enough.
- `X refused: ...`: core turned the call down (bad date, unknown name, already set).
- `replied: ...`: the model answered in text with no tool call.

## How a case is graded

- `ops`: the same op names in any order, nothing extra, and every listed arg equal after core resolves
  names and dates: ids for names (`sh-pr-windows`, `it-sv-pump`), ISO dates.
- `question`: the parser asked (`ask_question`) or core asked (ambiguous name, missing detail), and
  nothing was proposed.
- `read`: a read tool was chosen and no op (optionally only the listed tools count).
- `refusal`: the right op was called and core refused it (the hold-point photo rule).
- `expect` can be a list: any one of them passes (e.g. "push the sparky back a week" passes on a
  question or on the Park Rd electrician moved to Thu 24 Sep). A failure then lists each reason, joined by "| or".

Photo cases are sent the way the bot sends them: the parser sees `Photo caption: <caption>`, and
attach_photo runs first with a file path the bot would set.

## Adding a case

Add an entry to `CASES` in `src/cases.ts`:

```ts
{
  id: 'item-expected-beatty-vanity',              // unique, kebab-case
  text: 'vanity for beatty wont land till the 30th',
  why: 'Material named loosely, "the 30th" = Wed 30 Sep.',   // one line
  expect: { kind: 'ops', ops: [{ op: 'set_item_expected_date', args: { item: 'it-bt-vanity', date: '2026-09-30' } }] },
  modelCalls: [{ name: 'set_item_expected_date', args: { item: 'vanity', job: 'Beatty', date: 'the 30th' } }],
},
```

- `expect.ops[].args` uses the op's own arg names with resolved values. Only the keys you list are
  checked. Free text takes `{ includes: 'word' }`; several right answers take `{ oneOf: ['done', 'confirmed'] }`.
- Ids are in `packages/core/src/seed` (`npm run eval -- --dry --verbose` prints the resolved args of
  every case, a quick way to find them). Relative dates count from Thu 17 Sep 2026.
- `modelCalls` is one right answer as a model would give it (names and dates as said). `--dry` uses it,
  so the dry run also checks that core resolves those words. A question case can give a call that makes
  core ask (`{ shipment: 'the windows' }`) or an `ask_question` call.
- `photo: true` makes `text` a photo caption.
- The test (`packages/eval/test/eval.test.ts`) expects exactly 30 cases: change the count there when
  you add one.
