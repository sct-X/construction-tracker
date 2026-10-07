import { describe, expect, it } from 'vitest';
import {
  applyChanges,
  BEATTY,
  buildSeed,
  ChangeConflictError,
  changeHistory,
  DEFAULT_TODAY,
  fixedClock,
  forecastJob,
  InMemoryStore,
  invertChanges,
  jsonEqual,
  latestUndoable,
  LocalDashboardApi,
  PARK_RD,
  PARK_RD_WINDOWS,
  runOperation,
  shipmentsList,
  toChase,
  waitingOn,
  whyItMoved,
  type Change,
  type Proposal,
} from '../src/index.js';

const today = DEFAULT_TODAY;
const ctx = { today, now: new Date('2026-09-17T05:10:00.000Z') };

function etaProposal(ds = buildSeed(), eta = '16 Nov'): Proposal {
  return runOperation(ds, 'set_shipment_eta', { shipment: 'Park Rd windows', eta }, ctx) as Proposal;
}

describe('apply and invert', () => {
  it('round-trips updates, inserts and deletes', () => {
    const ds = buildSeed();
    const changes: Change[] = [
      { kind: 'update', table: 'shipment', rowId: PARK_RD_WINDOWS, field: 'eta', before: '2026-10-26', after: '2026-11-16' },
      { kind: 'insert', table: 'trade', rowId: 'tr-new', row: { id: 'tr-new', sideId: 'side-nd', name: 'New Co', type: 'Painter', phone: null } },
      { kind: 'delete', table: 'daily_note', rowId: 'dn-pr-0910', row: ds.dailyNotes.find((n) => n.id === 'dn-pr-0910') as never },
    ];
    const after = applyChanges(ds, changes);
    expect(after.shipments.find((s) => s.id === PARK_RD_WINDOWS)!.eta).toBe('2026-11-16');
    expect(after.trades.some((t) => t.id === 'tr-new')).toBe(true);
    expect(after.dailyNotes.some((n) => n.id === 'dn-pr-0910')).toBe(false);
    const back = applyChanges(after, invertChanges(changes));
    expect(back.shipments).toEqual(ds.shipments);
    expect(back.trades).toEqual(ds.trades);
    expect(jsonEqual([...back.dailyNotes].sort((a, b) => a.id.localeCompare(b.id)), [...ds.dailyNotes].sort((a, b) => a.id.localeCompare(b.id)))).toBe(true);
  });

  it('a stale before value is a conflict', () => {
    const c: Change = { kind: 'update', table: 'shipment', rowId: PARK_RD_WINDOWS, field: 'eta', before: '2026-10-19', after: '2026-11-16' };
    expect(() => applyChanges(buildSeed(), [c])).toThrow(ChangeConflictError);
  });
});

describe('InMemoryStore', () => {
  it('propose, confirm, undo: Park Rd goes 26 Feb -> 12 Mar -> 26 Feb', () => {
    const store = new InMemoryStore(buildSeed(), { clock: fixedClock(today, '15:10') });
    const msg = store.recordInbound({ channel: 'telegram', sender: '123', rawText: 'Park Rd windows now arriving 16 Nov' });
    const p = etaProposal(store.load());
    const cs = store.proposeChangeSet({ messageId: msg.id, summary: p.summary, opName: p.op, opArgs: p.args, changes: p.changes });
    expect(cs.status).toBe('proposed');
    expect(forecastJob(store.load(), PARK_RD, today).forecastFinish).toBe('2027-02-26'); // not applied yet
    const confirmed = store.confirmChangeSet(cs.id);
    expect(confirmed.status).toBe('confirmed');
    expect(forecastJob(store.load(), PARK_RD, today).forecastFinish).toBe('2027-03-12');
    expect(latestUndoable(store.load())?.id).toBe(cs.id);
    const u = store.undo(cs.id);
    expect(u.ok).toBe(true);
    const ds = store.load();
    expect(forecastJob(ds, PARK_RD, today).forecastFinish).toBe('2027-02-26');
    expect(ds.changeSets.find((c) => c.id === cs.id)!.status).toBe('undone');
    expect(store.undo(cs.id)).toMatchObject({ ok: false });
  });

  it('cancel records without applying; a stale proposal cannot be confirmed', () => {
    const store = new InMemoryStore(buildSeed(), { clock: fixedClock(today) });
    const p1 = etaProposal(store.load(), '16 Nov');
    const p2 = etaProposal(store.load(), '23 Nov');
    const a = store.proposeChangeSet({ summary: p1.summary, changes: p1.changes });
    const b = store.proposeChangeSet({ summary: p2.summary, changes: p2.changes });
    store.confirmChangeSet(a.id);
    expect(() => store.confirmChangeSet(b.id)).toThrow(ChangeConflictError);
    expect(store.cancelChangeSet(b.id).status).toBe('cancelled');
    expect(store.load().shipments.find((s) => s.id === PARK_RD_WINDOWS)!.eta).toBe('2026-11-16');
  });

  it('undo is refused when a later change touched the same field', () => {
    const store = new InMemoryStore(buildSeed(), { clock: fixedClock(today) });
    const p1 = etaProposal(store.load(), '16 Nov');
    const a = store.applyChangeSet({ summary: p1.summary, changes: p1.changes });
    const p2 = etaProposal(store.load(), '23 Nov');
    store.applyChangeSet({ summary: p2.summary, changes: p2.changes });
    const r = store.undo(a.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('Undo that first');
  });

  it('undoes a seeded change set: Beatty back to Fri 27 Nov', () => {
    const store = new InMemoryStore(buildSeed(), { clock: fixedClock(today) });
    expect(store.undo('cs-0915-tiler').ok).toBe(true);
    expect(forecastJob(store.load(), BEATTY, today).forecastFinish).toBe('2026-11-27');
  });

  it('saveSnapshot replaces the same job and Monday', () => {
    const store = new InMemoryStore(buildSeed());
    const before = store.load().snapshots.length;
    const s = store.load().snapshots.find((x) => x.jobId === PARK_RD && x.date === '2026-09-14')!;
    store.saveSnapshot({ ...s, id: 'snap-x', forecastFinish: '2027-03-12' });
    expect(store.load().snapshots.length).toBe(before);
    expect(forecastJob(store.load(), PARK_RD, today).slipDays).toBe(0 - 14);
  });
});

describe('why it moved', () => {
  it('Beatty: the tiler change set explains the slip', () => {
    const w = whyItMoved(buildSeed(), BEATTY, today);
    expect(w.slipDays).toBe(5);
    expect(w.causes).toHaveLength(1);
    const c = w.causes[0]!;
    expect(c.changeSetId).toBe('cs-0915-tiler');
    expect(c.summary).toBe('Book tiler at Beatty St expected Mon 28 Sep to Mon 5 Oct');
    expect(c.sourceText).toBe("Harbour Tiling can't get to Beatty till the 5th of October");
    expect(c.sourceChannel).toBe('telegram');
    expect(c.finishBefore).toBe('2026-11-27');
    expect(c.finishAfter).toBe('2026-12-04');
    expect(c.deltaDays).toBe(7);
    expect(c.movedSteps[0]).toMatchObject({ stepId: 'bt-tiling', from: '2026-09-28', to: '2026-10-05' });
    // The seeded snapshot (Sun 29 Nov) is 2 days later than any calculator finish.
    expect(w.otherDays).toBe(-2);
  });

  it('Park Rd: nothing moved until the ETA change, then it is the cause', () => {
    const store = new InMemoryStore(buildSeed(), { clock: fixedClock(today, '15:10') });
    expect(whyItMoved(store.load(), PARK_RD, today).causes).toEqual([]);
    const msg = store.recordInbound({ channel: 'telegram', sender: '123', rawText: 'Park Rd windows now arriving 16 Nov' });
    const p = etaProposal(store.load());
    const cs = store.applyChangeSet({ messageId: msg.id, summary: p.summary, opName: p.op, opArgs: p.args, changes: p.changes });
    const w = whyItMoved(store.load(), PARK_RD, today);
    expect(w.slipDays).toBe(14);
    expect(w.slipCost).toBe(9000);
    expect(w.otherDays).toBe(0);
    expect(w.causes).toHaveLength(1);
    expect(w.causes[0]).toMatchObject({
      changeSetId: cs.id,
      summary: 'Park Rd windows ETA Mon 26 Oct to Mon 16 Nov',
      sourceText: 'Park Rd windows now arriving 16 Nov',
      finishBefore: '2027-02-26',
      finishAfter: '2027-03-12',
      deltaDays: 14,
      cost: 9000,
    });
    expect(w.causes[0]!.movedSteps[0]).toMatchObject({ name: 'Install windows', from: '2026-11-02', to: '2026-11-16' });
    expect(w.lines[0]).toBe('Park Rd windows ETA Mon 26 Oct to Mon 16 Nov (+14 days on the finish)');
    store.undo(cs.id);
    expect(whyItMoved(store.load(), PARK_RD, today).causes).toEqual([]);
  });
});

describe('read models', () => {
  const ds = buildSeed();

  it('change history: newest first, with the source message and before/after', () => {
    const h = changeHistory(ds);
    expect(h[0]!.changeSetId).toBe('cs-0916-cancel');
    const tiler = h.find((e) => e.changeSetId === 'cs-0915-tiler')!;
    expect(tiler.message?.transcript).toContain('5th of October');
    expect(tiler.jobNames).toEqual(['Beatty St']);
    expect(tiler.changes[0]).toMatchObject({ rowLabel: 'Book tiler', field: 'expectedDate', before: '2026-09-28', after: '2026-10-05' });
    expect(changeHistory(ds, { jobId: PARK_RD }).every((e) => e.jobIds.includes(PARK_RD))).toBe(true);
  });

  it('shipments: the Park Rd windows are on time at 26 Oct', () => {
    const rows = shipmentsList(ds, today);
    const pr = rows.find((r) => r.shipmentId === PARK_RD_WINDOWS)!;
    expect(pr).toMatchObject({ linkedCount: 3, earliestNeededBy: '2026-11-02', isLate: false, statusLabel: 'In production' });
    expect(rows).toHaveLength(2);
  });

  it('to-chase for Raff: act-by within 14 days or past, with phones', () => {
    const v = toChase(ds, today, { owner: 'Raff' });
    const seaview = v.jobs.find((j) => j.jobName === 'Seaview St')!;
    expect(seaview.rows[0]).toMatchObject({ title: 'Book concrete pump', actBy: '2026-09-18', tradePhone: '0491 570 157' });
    expect(v.jobs.find((j) => j.jobName === 'Park Rd')!.rows.map((r) => r.title)).toContain('Book plasterer');
    expect(v.jobs.find((j) => j.jobName === 'West St')).toBeDefined();
  });

  it('waiting-on groups', () => {
    const v = waitingOn(ds, today, { jobId: PARK_RD });
    const overdue = v.groups.find((g) => g.key === 'overdue')!.rows.map((r) => r.title);
    expect(overdue).toContain('Tile choice');
    expect(v.groups.find((g) => g.key === 'this_week')!.rows.map((r) => r.title)).toContain('Book plasterer');
  });

  it('LocalDashboardApi serves the same numbers and refuses non-setup ops', async () => {
    const api = new LocalDashboardApi(new InMemoryStore(ds), fixedClock(today));
    const monday = await api.getMonday();
    expect(monday.builds.find((b) => b.jobId === BEATTY)!.slipCost).toBe(1430);
    const r = await api.applySetup('set_shipment_eta', { shipment: 'Park Rd windows', eta: '16 Nov' });
    expect(r.ok).toBe(false);
    const t = await api.applySetup('add_trade', { name: 'Kerbside Concrete', type: 'Concreter', phone: '0491 579 212' });
    expect(t.ok).toBe(true);
    expect((await api.listTrades()).some((x) => x.name === 'Kerbside Concrete')).toBe(true);
  });
});
