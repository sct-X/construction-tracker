import { describe, expect, it } from 'vitest';
import {
  isSafePhotoPath,
  buildSeed,
  DEFAULT_TODAY,
  dryRun,
  forecastJob,
  fuzzyMatch,
  operationCatalogue,
  OPERATIONS,
  PARK_RD,
  PARK_RD_WINDOWS,
  runOperation,
  SEAVIEW,
  SEAVIEW_WINDOWS,
  type Proposal,
} from '../src/index.js';

const today = DEFAULT_TODAY;
let n = 0;
const ctx = { today, now: new Date('2026-09-17T05:10:00.000Z'), newId: (p: string) => `${p}-t${++n}` };

describe('fuzzy matching', () => {
  const ds = buildSeed();
  const shipments = ds.shipments.map((s) => ({ id: s.id, name: s.name }));

  it('"the windows" is ambiguous between the two shipments', () => {
    const r = fuzzyMatch('the windows', shipments);
    expect(r.kind).toBe('ambiguous');
    if (r.kind === 'ambiguous') expect(r.candidates.map((c) => c.id).sort()).toEqual([PARK_RD_WINDOWS, SEAVIEW_WINDOWS].sort());
  });

  it('"park rd windows" is unique', () => {
    expect(fuzzyMatch('park rd windows', shipments)).toMatchObject({ kind: 'unique', match: { id: PARK_RD_WINDOWS } });
  });

  it('jobs: abbreviations, partials and typos', () => {
    const jobs = ds.jobs.filter((j) => !j.isTemplate).map((j) => ({ id: j.id, name: j.name }));
    expect(fuzzyMatch('Park Road', jobs)).toMatchObject({ kind: 'unique', match: { id: PARK_RD } });
    expect(fuzzyMatch('seaview', jobs)).toMatchObject({ kind: 'unique', match: { id: SEAVIEW } });
    expect(fuzzyMatch('Seavew St', jobs)).toMatchObject({ kind: 'unique', match: { id: SEAVIEW } });
    expect(fuzzyMatch('beaty', jobs)).toMatchObject({ kind: 'unique', match: { id: 'beatty' } });
    expect(fuzzyMatch('lower beach', jobs)).toMatchObject({ kind: 'unique', match: { id: 'lower-beach' } });
    expect(fuzzyMatch('Smith St', jobs)).toEqual({ kind: 'none' });
  });

  it('trades by type, items by title, categories', () => {
    const trades = ds.trades.map((t) => ({ id: t.id, name: t.name, aliases: [t.type] }));
    expect(fuzzyMatch('the sparky', trades)).toMatchObject({ kind: 'unique', match: { name: 'Brightline Electrical' } });
    expect(fuzzyMatch('tiler', trades)).toMatchObject({ kind: 'unique', match: { name: 'Harbour Tiling' } });
    const items = ds.items.filter((i) => i.jobId === PARK_RD && i.status !== 'done').map((i) => ({ id: i.id, name: i.title }));
    expect(fuzzyMatch('windows', items)).toMatchObject({ kind: 'unique', match: { id: 'it-pr-windows' } });
    const cats = ds.photoCategories.filter((c) => c.jobId === SEAVIEW).map((c) => ({ id: c.id, name: c.name }));
    expect(fuzzyMatch('plumbing under the slab', cats)).toMatchObject({ kind: 'unique', match: { id: 'sv-pc-slab-plumbing' } });
    expect(fuzzyMatch('membrane', cats)).toMatchObject({ kind: 'unique', match: { id: 'sv-pc-slab-membrane' } });
  });
});

describe('operations', () => {
  it('"the windows are late" with no job: a question, nothing proposed', () => {
    const r = runOperation(buildSeed(), 'set_shipment_eta', { shipment: 'the windows', eta: '16 Nov' }, ctx);
    expect(r.kind).toBe('question');
    if (r.kind !== 'question') return;
    expect(r.field).toBe('shipment');
    expect(r.options?.map((o) => o.value).sort()).toEqual([PARK_RD_WINDOWS, SEAVIEW_WINDOWS].sort());
    // Answering re-runs with the chosen id.
    const again = runOperation(buildSeed(), 'set_shipment_eta', { ...r.args, shipment: PARK_RD_WINDOWS }, ctx);
    expect(again.kind).toBe('proposal');
  });

  it('a missing required detail becomes a question', () => {
    const r = runOperation(buildSeed(), 'set_shipment_eta', { shipment: 'Park Rd windows' }, ctx);
    expect(r).toMatchObject({ kind: 'question', field: 'eta', question: 'What is the new ETA?' });
  });

  it('names are resolved before a missing detail is asked', () => {
    // "the windows are late": ambiguous shipment and no ETA -> which windows first, without the ETA in the args.
    const r = runOperation(buildSeed(), 'set_shipment_eta', { shipment: 'the windows' }, ctx);
    expect(r).toMatchObject({ kind: 'question', field: 'shipment' });
    if (r.kind !== 'question') return;
    expect(r.options?.map((o) => o.value).sort()).toEqual([PARK_RD_WINDOWS, SEAVIEW_WINDOWS].sort());
    expect(r.args).toEqual({ shipment: 'the windows' });
    // Answering it then asks for the missing ETA.
    const next = runOperation(buildSeed(), 'set_shipment_eta', { ...r.args, shipment: PARK_RD_WINDOWS }, ctx);
    expect(next).toMatchObject({ kind: 'question', field: 'eta', question: 'What is the new ETA?' });
    // An unknown name is refused rather than asking for a detail it can't use.
    expect(runOperation(buildSeed(), 'set_shipment_eta', { shipment: 'the bricks' }, ctx)).toMatchObject({ kind: 'refusal' });
    expect(runOperation(buildSeed(), 'set_item_status', { item: 'Book tiler', job: 'Smith St' }, ctx)).toMatchObject({ kind: 'refusal' });
  });

  it('a bad date or an unknown job is refused', () => {
    expect(runOperation(buildSeed(), 'set_shipment_eta', { shipment: 'Park Rd windows', eta: 'soonish' }, ctx).kind).toBe('refusal');
    expect(runOperation(buildSeed(), 'confirm_job', { job: 'Smith St' }, ctx)).toMatchObject({ kind: 'refusal' });
    expect(runOperation(buildSeed(), 'no_such_op', {}, ctx).kind).toBe('refusal');
  });

  it('set_item_expected_date refuses shipment items and moves Beatty from the tiler', () => {
    const ds = buildSeed();
    expect(runOperation(ds, 'set_item_expected_date', { item: 'windows', job: 'Park Rd', date: '1 Nov' }, ctx)).toMatchObject({ kind: 'refusal' });
    const r = runOperation(ds, 'set_item_expected_date', { item: 'tiler', job: 'Beatty', date: 'the 12th of October' }, ctx) as Proposal;
    expect(r.kind).toBe('proposal');
    const impact = dryRun(ds, r, today).impacts[0]!;
    expect(impact).toMatchObject({ finishBefore: '2026-12-04', finishAfter: '2026-12-11', finishDeltaDays: 7, slipAfter: 12 });
  });

  it('set_item_status, override_lead_time, confirm_job, add_daily_note', () => {
    const ds = buildSeed();
    const s = runOperation(ds, 'set_item_status', { item: 'concrete pump', job: 'Seaview', status: 'ordered_or_booked' }, ctx) as Proposal;
    expect(s.kind).toBe('proposal');
    expect(s.summary).toBe('Book concrete pump at Seaview St: To do to Ordered or booked');
    const lt = runOperation(ds, 'override_lead_time', { item: 'order tiles', job: 'Park Rd', weeks: 10 }, ctx) as Proposal;
    const f = forecastJob(dryRun(ds, lt, today).after, PARK_RD, today);
    expect(f.items['it-pr-tiles']!.leadTimeWeeks).toBe(10);
    const cj = runOperation(ds, 'confirm_job', { job: 'beatty' }, ctx) as Proposal;
    const impact = dryRun(ds, cj, today).impacts[0]!;
    expect(impact).toMatchObject({ amberBefore: true, amberAfter: false });
    const note = runOperation(ds, 'add_daily_note', { job: 'Park Rd', text: 'Windows crew on site' }, ctx) as Proposal;
    expect(note.changes[0]).toMatchObject({ kind: 'insert', table: 'daily_note' });
  });

  it('add_item needs a step or a date on a build job, and inserts a row', () => {
    const ds = buildSeed();
    const q = runOperation(ds, 'add_item', { job: 'Park Rd', type: 'material', title: 'Order skylights' }, ctx);
    expect(q).toMatchObject({ kind: 'question', field: 'step' });
    const p = runOperation(ds, 'add_item', { job: 'Park Rd', type: 'material', title: 'Order skylights', step: 'install windows', leadTimeWeeks: 6 }, ctx) as Proposal;
    expect(p.kind).toBe('proposal');
    const row = (p.changes[0] as unknown as { row: { stepId: string } }).row;
    expect(row.stepId).toBe('pr-install-windows');
    const f = forecastJob(dryRun(ds, p, today).after, PARK_RD, today);
    const added = Object.values(f.items).find((i) => i.itemId === (p.changes[0] as { rowId: string }).rowId)!;
    expect(added.actBy).toBe('2026-09-21');
  });

  it('attach_photo refuses a file path outside the photos folder', () => {
    const ds = buildSeed();
    for (const filePath of ['../../../.env', 'seaview/../../x.jpg', '/etc/passwd', 'C:/x.jpg', 'seaview\\x.jpg', 'file:///x.jpg', 'seaview//x.jpg', './x.jpg']) {
      const r = runOperation(ds, 'attach_photo', { job: 'Seaview', category: 'plumbing under slab', filePath }, ctx);
      expect(r, filePath).toMatchObject({ kind: 'refusal', reason: expect.stringContaining("isn't inside the photos folder") });
    }
    expect(isSafePhotoPath('seaview/2026-09-17-photo-1.jpg')).toBe(true);
    expect(isSafePhotoPath('placeholder/p1.jpg')).toBe(true);
  });

  it('attach_photo files by caption, asks when the category is unclear', () => {
    const ds = buildSeed();
    const p = runOperation(ds, 'attach_photo', { job: 'Seaview', category: 'plumbing under slab', filePath: 'seaview/a.jpg' }, ctx) as Proposal;
    expect(p.kind).toBe('proposal');
    expect(p.summary).toBe('Photo filed: Seaview St, Slab, Plumbing under slab');
    const q = runOperation(ds, 'attach_photo', { job: 'Seaview', stage: 'slab', filePath: 'seaview/b.jpg' }, ctx);
    expect(q).toMatchObject({ kind: 'question', field: 'category' });
  });

  it('attach_photo with no job (an uncaptioned photo) asks with a button per live job', () => {
    const ds = buildSeed();
    const q = runOperation(ds, 'attach_photo', { filePath: 'telegram/a.jpg' }, ctx);
    expect(q).toMatchObject({ kind: 'question', field: 'job', question: 'Which job is this photo for?' });
    if (q.kind !== 'question') return;
    expect(q.options!.map((o) => o.label)).toContain('Seaview St');
    expect(q.options!.some((o) => o.value === 'tpl-duplex')).toBe(false);
  });

  it('three photos make the hold point pass', () => {
    let ds = buildSeed();
    for (const category of ['plumbing under slab', 'membrane and termite barrier']) {
      const p = runOperation(ds, 'attach_photo', { job: 'Seaview', category, filePath: `seaview/${category}.jpg` }, ctx) as Proposal;
      ds = dryRun(ds, p, today).after;
    }
    const done = runOperation(ds, 'mark_step_done', { step: 'slab inspection', job: 'Seaview' }, ctx) as Proposal;
    expect(done.kind).toBe('proposal');
    expect(done.changes.map((c) => (c.kind === 'update' ? c.field : ''))).toEqual(['status', 'actualEnd', 'actualStart']);
  });

  it('set_stage_status ticks a design checklist and refuses builds', () => {
    const ds = buildSeed();
    expect(runOperation(ds, 'set_stage_status', { job: 'John St', stage: 'design', status: 'done' }, ctx).kind).toBe('proposal');
    expect(runOperation(ds, 'set_stage_status', { job: 'Park Rd', stage: 'lock-up', status: 'done' }, ctx).kind).toBe('refusal');
  });
});

describe('catalogue', () => {
  it('every operation has a JSON schema with its properties', () => {
    const cat = operationCatalogue();
    expect(cat).toHaveLength(OPERATIONS.length);
    const names = cat.map((c) => c.name);
    for (const required of [
      'set_shipment_eta', 'set_shipment_status', 'mark_step_done', 'set_item_status', 'set_item_expected_date', 'add_item',
      'override_lead_time', 'add_daily_note', 'attach_photo', 'confirm_job', 'copy_template',
      'create_job', 'edit_job', 'add_stage', 'edit_stage', 'add_step', 'edit_step', 'add_link', 'add_trade', 'edit_trade',
    ]) expect(names).toContain(required);
    const eta = cat.find((c) => c.name === 'set_shipment_eta')!;
    expect(eta.parameters).toMatchObject({ type: 'object', required: ['shipment', 'eta'] });
    expect(Object.keys(eta.parameters.properties as object)).toEqual(['shipment', 'job', 'eta']);
    expect(operationCatalogue('daily').every((c) => c.group === 'daily')).toBe(true);
    expect(JSON.parse(JSON.stringify(cat))).toEqual(cat);
  });
});
