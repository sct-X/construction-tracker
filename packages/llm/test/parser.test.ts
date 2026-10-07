import { OPERATION_NAMES, operationCatalogue } from '@ct/core';
import { describe, expect, it } from 'vitest';
import {
  ASK_QUESTION_TOOL,
  BOT_SET_ARGS,
  FakeLlm,
  READ_TOOL_NAMES,
  REPHRASE_QUESTION,
  FALLBACK_REPLY,
  buildSystemPrompt,
  createParser,
  mapResponse,
  normalizeMessages,
  opToolNames,
  parserTools,
  textReply,
  toolCall,
  type LlmResponse,
  type ParseContext,
} from '../src/index.js';

const ctx: ParseContext = {
  today: '2026-09-17',
  jobs: ['Park Rd', 'Seaview St', 'Beatty St'],
  trades: ['Sparky Sam (electrician)', 'Tiler Tom'],
  shipments: ['Park Rd windows', 'Seaview St windows'],
};

const usage = { inputTokens: 10, outputTokens: 5 };
function calls(...c: { name: string; args: Record<string, unknown>; malformed?: boolean }[]): LlmResponse {
  return { toolCalls: c, usage };
}

describe('tools', () => {
  it('offers every daily op, the read tools and ask_question, and no setup op', () => {
    const names = parserTools().map((t) => t.name);
    const daily = operationCatalogue('daily').map((o) => o.name);
    const setup = operationCatalogue('setup').map((o) => o.name);
    for (const n of [
      'set_shipment_eta', 'set_shipment_status', 'mark_step_done', 'set_item_status', 'set_item_expected_date',
      'add_item', 'override_lead_time', 'add_daily_note', 'attach_photo', 'confirm_job',
    ]) expect(names).toContain(n);
    for (const n of daily) expect(names).toContain(n);
    for (const n of setup) expect(names).not.toContain(n);
    for (const n of READ_TOOL_NAMES) expect(names).toContain(n);
    expect(names).toContain('ask_question');
    expect(new Set(names).size).toBe(names.length);
  });

  it('keeps read tools, op tools and ask_question disjoint, and read tools are not core ops', () => {
    const ops = new Set(opToolNames());
    for (const r of READ_TOOL_NAMES) {
      expect(ops.has(r)).toBe(false);
      expect(OPERATION_NAMES).not.toContain(r);
    }
    expect(ops.has(ASK_QUESTION_TOOL.name)).toBe(false);
  });

  it('hides bot-set args (filePath, messageId) from the model', () => {
    const photo = parserTools().find((t) => t.name === 'attach_photo')!.parameters as {
      properties: Record<string, unknown>;
      required: string[];
      $schema?: string;
    };
    for (const k of BOT_SET_ARGS) {
      expect(photo.properties[k]).toBeUndefined();
      expect(photo.required).not.toContain(k);
    }
    expect(photo.required).toContain('job');
    expect(photo.$schema).toBeUndefined();
  });
});

describe('system prompt', () => {
  it('has today with weekday, the names, the jargon and the rules', () => {
    const p = buildSystemPrompt(ctx);
    expect(p).toContain('Today is Thursday 17 September 2026 (2026-09-17');
    for (const n of [...ctx.jobs, ...ctx.trades, ...ctx.shipments]) expect(p).toContain(`- ${n}`);
    for (const w of ['lock-up', 'hold point', 'before-cover', 'OC', 'PC items', 'sparky', 'chippy', 'plumbo']) expect(p).toContain(w);
    expect(p).toMatch(/Never invent ids/);
    expect(p).toMatch(/fuzzy-matches/);
    expect(p).toMatch(/Pass dates exactly as Dominic said them/);
    expect(p).toMatch(/ask_question/);
    expect(p).toMatch(/A question is never a change/);
    expect(p).toContain('A message that starts "Photo caption:" is the caption of a photo Dominic just sent. Call attach_photo');
  });

  it('names the weekday right on other dates', () => {
    expect(buildSystemPrompt({ ...ctx, today: '2026-10-07' })).toContain('Today is Wednesday 7 October 2026');
  });
});

describe('createParser with FakeLlm', () => {
  it('sends system, tools and the message (after history), and maps one op', async () => {
    const llm = new FakeLlm([toolCall('set_shipment_eta', { shipment: 'the windows', job: 'Park Rd', eta: '16 Nov' })]);
    const parser = createParser(llm);
    const history = [
      { role: 'assistant' as const, content: 'dropped: history must start with the user' },
      { role: 'user' as const, content: 'windows are late' },
      { role: 'assistant' as const, content: 'Which job?' },
    ];
    const r = await parser.parse('Park Rd, landing 16 Nov', { ...ctx, history });
    expect(r).toEqual({ kind: 'ops', calls: [{ op: 'set_shipment_eta', args: { shipment: 'the windows', job: 'Park Rd', eta: '16 Nov' } }] });
    const req = llm.requests[0]!;
    expect(req.system).toContain('Park Rd windows');
    expect(req.tools.map((t) => t.name)).toEqual(parserTools().map((t) => t.name));
    expect(req.messages).toEqual([
      { role: 'user', content: 'windows are late' },
      { role: 'assistant', content: 'Which job?' },
      { role: 'user', content: 'Park Rd, landing 16 Nov' },
    ]);
  });

  it('maps several ops in order', async () => {
    const parser = createParser(
      new FakeLlm([
        calls(
          { name: 'set_item_status', args: { item: 'concrete pump', job: 'Seaview', status: 'ordered_or_booked' } },
          { name: 'add_daily_note', args: { job: 'Seaview', text: 'Rain, no pour' } },
        ),
      ]),
    );
    const r = await parser.parse('pump booked at seaview, rain today no pour', ctx);
    expect(r.kind).toBe('ops');
    if (r.kind === 'ops') expect(r.calls.map((c) => c.op)).toEqual(['set_item_status', 'add_daily_note']);
  });

  it('maps a read-only question to read, never ops', async () => {
    const parser = createParser(new FakeLlm([toolCall('get_job_finish', { job: 'Park Rd' })]));
    expect(await parser.parse("what's Park Rd's finish?", ctx)).toEqual({ kind: 'read', tool: 'get_job_finish', args: { job: 'Park Rd' } });
  });

  it('read + op together: ops only, reads ignored', () => {
    const r = mapResponse(
      calls({ name: 'get_waiting_on', args: { job: 'Beatty' } }, { name: 'confirm_job', args: { job: 'Beatty' } }),
    );
    expect(r).toEqual({ kind: 'ops', calls: [{ op: 'confirm_job', args: { job: 'Beatty' } }] });
  });

  it('two reads: the first one', () => {
    expect(mapResponse(calls({ name: 'get_shipments', args: {} }, { name: 'get_to_chase', args: {} }))).toEqual({
      kind: 'read', tool: 'get_shipments', args: {},
    });
  });

  it('ask_question -> question, and beats ops in the same response', async () => {
    const parser = createParser(new FakeLlm([toolCall('ask_question', { question: 'Which job, Park Rd or Seaview St?' })]));
    expect(await parser.parse('windows moved to the 14th', ctx)).toEqual({ kind: 'question', text: 'Which job, Park Rd or Seaview St?' });
    expect(
      mapResponse(calls({ name: 'confirm_job', args: { job: 'x' } }, { name: 'ask_question', args: { question: 'Which?' } })),
    ).toEqual({ kind: 'question', text: 'Which?' });
    expect(mapResponse(toolCall('ask_question', {}))).toEqual({ kind: 'question', text: REPHRASE_QUESTION });
  });

  it('malformed args -> question asking to rephrase', () => {
    expect(mapResponse(calls({ name: 'confirm_job', args: {}, malformed: true }))).toEqual({ kind: 'question', text: REPHRASE_QUESTION });
    // args that are not an object (a provider passing junk through) count as malformed too
    expect(mapResponse({ toolCalls: [{ name: 'confirm_job', args: [1] as unknown as Record<string, unknown> }], usage })).toEqual({
      kind: 'question', text: REPHRASE_QUESTION,
    });
  });

  it('unknown tools are ignored; only unknown tools -> rephrase question', () => {
    expect(mapResponse(calls({ name: 'drop_table', args: {} }))).toEqual({ kind: 'question', text: REPHRASE_QUESTION });
    expect(mapResponse(calls({ name: 'create_job', args: { name: 'x' } }, { name: 'confirm_job', args: { job: 'Park Rd' } }))).toEqual({
      kind: 'ops', calls: [{ op: 'confirm_job', args: { job: 'Park Rd' } }],
    });
  });

  it('plain text -> reply; empty -> fallback reply', async () => {
    const parser = createParser(new FakeLlm([textReply('No worries.'), { toolCalls: [], usage }]));
    expect(await parser.parse('thanks mate', ctx)).toEqual({ kind: 'reply', text: 'No worries.' });
    expect(await parser.parse('hmm', ctx)).toEqual({ kind: 'reply', text: FALLBACK_REPLY });
  });

  it('FakeLlm accepts functions, reports usage via onResponse, and throws when the script runs out', async () => {
    const seen: LlmResponse[] = [];
    const llm = new FakeLlm([(req) => toolCall('add_daily_note', { job: 'Park Rd', text: req.messages.at(-1)!.content })]);
    const parser = createParser(llm, { onResponse: (r) => seen.push(r) });
    expect(await parser.parse('frame inspection passed', ctx)).toEqual({
      kind: 'ops', calls: [{ op: 'add_daily_note', args: { job: 'Park Rd', text: 'frame inspection passed' } }],
    });
    expect(seen).toHaveLength(1);
    expect(llm.remaining).toBe(0);
    await expect(parser.parse('again', ctx)).rejects.toThrow(/script exhausted/);
  });
});

describe('normalizeMessages', () => {
  it('drops empties and a leading assistant turn, and merges same-role neighbours', () => {
    expect(
      normalizeMessages([
        { role: 'assistant', content: 'hi' },
        { role: 'user', content: 'a' },
        { role: 'user', content: ' ' },
        { role: 'user', content: 'b' },
        { role: 'assistant', content: 'c' },
      ]),
    ).toEqual([
      { role: 'user', content: 'a\nb' },
      { role: 'assistant', content: 'c' },
    ]);
  });
});
