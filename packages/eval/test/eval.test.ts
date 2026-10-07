import { FakeLlm, toolCall } from '@ct/llm';
import { describe, expect, it } from 'vitest';
import { CASES, REQUIRED_OPS, type EvalCase } from '../src/cases.js';
import { fakeProviderFor, planProviders, runCase, runDry, runProvider } from '../src/run.js';
import { summaryTable } from '../src/report.js';

describe('eval cases', () => {
  it('has 30 cases with unique ids and a one-line why', () => {
    expect(CASES).toHaveLength(30);
    expect(new Set(CASES.map((c) => c.id)).size).toBe(30);
    for (const c of CASES) expect(c.why.trim().length, c.id).toBeGreaterThan(10);
  });

  it('covers every day-to-day op, questions and reads', () => {
    const first = (c: (typeof CASES)[number]) => (Array.isArray(c.expect) ? c.expect[0]! : c.expect);
    const ops = new Set(CASES.flatMap((c) => [c.expect].flat().flatMap((e) => (e.kind === 'ops' ? e.ops.map((o) => o.op) : []))));
    for (const op of REQUIRED_OPS) expect(ops.has(op), op).toBe(true);
    expect(CASES.filter((c) => first(c).kind === 'question').length).toBeGreaterThanOrEqual(3);
    expect(CASES.filter((c) => first(c).kind === 'read').length).toBeGreaterThanOrEqual(2);
  });
});

describe('dry run (FakeLlm returns each case\'s expected calls)', () => {
  it('passes 30/30', async () => {
    const run = await runDry();
    const failed = run.results.filter((r) => !r.grade.pass).map((r) => `${r.id}: ${r.grade.reason}`);
    expect(failed).toEqual([]);
    expect(run.passed).toBe(30);
    expect(run.total).toBe(30);
  });

  it('fails a case when the model answers with another case\'s calls', async () => {
    const byId = (id: string) => CASES.find((c) => c.id === id)!;
    const swapped = async (target: string, donor: string) => (await runCase(byId(target), fakeProviderFor(byId(donor)))).grade;
    // Wrong shipment / date: same op, different resolved args.
    const g1 = await swapped('eta-park-windows', 'eta-seaview-windows-typo');
    expect(g1.pass).toBe(false);
    expect(g1.reason).toContain('shipment sh-sv-windows (want sh-pr-windows)');
    // A change where a question was wanted.
    const g2 = await swapped('q-windows-late', 'eta-park-windows');
    expect(g2).toMatchObject({ pass: false });
    expect(g2.reason).toContain('want a question');
    // A question where a change was wanted.
    expect((await swapped('item-booked-seaview-pump', 'q-sparky-back-a-week')).pass).toBe(false);
    // One op of two is not enough.
    expect((await swapped('confirm-park-and-seaview', 'confirm-beatty')).pass).toBe(false);
    // A read where a change was wanted, and a change where a read was wanted.
    expect((await swapped('confirm-beatty', 'read-park-finish')).pass).toBe(false);
    expect((await swapped('read-park-finish', 'confirm-beatty')).pass).toBe(false);
  });

  it('takes any of several acceptable outcomes', async () => {
    const byId = (id: string) => CASES.find((c) => c.id === id)!;
    const sparky = byId('q-sparky-back-a-week');
    const moved = new FakeLlm([toolCall('set_item_expected_date', { item: 'sparky', date: 'in a week' })]);
    expect((await runCase(sparky, moved)).grade.pass).toBe(true);
    const wrongDate = new FakeLlm([toolCall('set_item_expected_date', { item: 'sparky', date: 'in 2 weeks' })]);
    const g = (await runCase(sparky, wrongDate)).grade;
    expect(g.pass).toBe(false);
    expect(g.reason).toContain('date 2026-10-01 (want 2026-09-24)');
    const tiles = byId('lead-park-tiles');
    expect((await runCase(tiles, new FakeLlm([toolCall('override_lead_time', { item: 'tiles', job: 'Park Rd', weeks: 10 })]))).grade.pass).toBe(true);
    const kitchen = byId('lead-park-kitchen');
    expect((await runCase(kitchen, new FakeLlm([toolCall('override_lead_time', { item: 'kitchen', job: 'Park Rd', weeks: 8 })]))).grade.pass).toBe(false);
  });

  it('files a photo case through attach_photo like the bot, asking when the caption gives no job', async () => {
    const photo: EvalCase = { ...CASES.find((c) => c.id === 'photo-seaview-plumbing')! };
    const r = await runCase(photo, fakeProviderFor(photo));
    expect(r.outcome).toMatchObject({ kind: 'ops', ops: [{ op: 'attach_photo', args: { caption: 'seaview plumbing under slab' } }] });
    // Without a job in the caption the bot (and so the eval) asks, with the caption still attached.
    const noJob = await runCase(photo, new FakeLlm([toolCall('ask_question', { question: 'Which job?' })]));
    expect(noJob.outcome).toMatchObject({ kind: 'question', by: 'core' });
  });
});

describe('providers', () => {
  it('skips every provider when no key is set', () => {
    const plans = planProviders({});
    expect(plans.map((p) => [p.model, p.status])).toEqual([
      ['gpt-5-mini', 'skipped'],
      ['gemini-2.5-flash', 'skipped'],
      ['claude-haiku-4-5', 'skipped'],
    ]);
    expect(summaryTable(plans, new Map())).toContain('skipped (no key)');
  });

  it('runs the models with a key; EVAL_MODELS overrides the list', () => {
    const plans = planProviders({ OPENAI_API_KEY: 'sk-test', LLM_PROVIDER: 'anthropic', LLM_BASE_URL: 'http://x' });
    expect(plans.map((p) => p.status)).toEqual(['run', 'skipped', 'skipped']);
    const first = plans[0]!;
    expect(first.status === 'run' && first.provider.model).toBe('gpt-5-mini');
    const custom = planProviders({ EVAL_MODELS: 'gpt-5-nano, claude-sonnet-4-5, mystery-1', ANTHROPIC_API_KEY: 'k' });
    expect(custom.map((p) => [p.model, p.status])).toEqual([
      ['gpt-5-nano', 'skipped'],
      ['claude-sonnet-4-5', 'run'],
      ['mystery-1', 'skipped'],
    ]);
  });

  it('runs a real provider (OpenAI over an injected fetch) and counts tokens, cost and latency', async () => {
    const bodies: { tools: unknown[]; messages: { content: string }[] }[] = [];
    const fetch = async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      bodies.push(body);
      const user = body.messages.at(-1).content as string;
      const call = user.includes('16 Nov')
        ? { name: 'set_shipment_eta', arguments: JSON.stringify({ shipment: 'windows', job: 'Park Rd', eta: '16 Nov' }) }
        : { name: 'confirm_job', arguments: JSON.stringify({ job: 'Park Rd' }) }; // wrong for "the windows are late"
      const res = { choices: [{ message: { tool_calls: [{ type: 'function', function: call }] } }], usage: { prompt_tokens: 1000, completion_tokens: 100 } };
      return new Response(JSON.stringify(res), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const [plan] = planProviders({ OPENAI_API_KEY: 'sk-test' }, { fetch });
    if (plan?.status !== 'run') throw new Error('expected openai to run');
    const cases = CASES.filter((c) => c.id === 'eta-park-windows' || c.id === 'q-windows-late');
    const run = await runProvider('gpt-5-mini (openai)', () => plan.provider, cases);
    expect(run.passed).toBe(1);
    expect(run.results.find((r) => !r.grade.pass)?.id).toBe('q-windows-late');
    expect(run.inputTokens + run.outputTokens).toBe(2200);
    expect(run.costUsd).toBeCloseTo((2000 * 0.25 + 200 * 2) / 1e6, 10); // @ct/llm price table
    expect(bodies[0]!.tools.length).toBeGreaterThan(10); // the parser's real tool list
  });
});
