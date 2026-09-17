import { describe, expect, it } from 'vitest';
import { createMemoryPhotoQueue, type QueuedPhoto } from './photoQueue';

const input = (n: number) => ({
  sideId: 'side-nd',
  jobId: 'park-rd',
  stageId: 'pr-st-lockup',
  categoryId: 'pr-pc-lockup-windows',
  dataUrl: `data:,${n}`,
  takenOn: '2026-09-17',
  uploadedById: 'alec',
  queuedAt: `2026-09-17T10:0${n}`,
});

describe('photo queue', () => {
  it('skips a photo removed while an earlier one was sending', async () => {
    const q = createMemoryPhotoQueue();
    const a = await q.enqueue(input(1));
    const b = await q.enqueue(input(2));
    const sent: string[] = [];
    await q.flush(async (p: QueuedPhoto) => {
      sent.push(p.dataUrl);
      if (p.id === a.id) await q.remove(b.id); // Remove tapped on the second row mid-flush
    }, () => true);
    expect(sent).toEqual(['data:,1']);
    expect(await q.list()).toHaveLength(0);
  });

  it('stops when signal drops, carries on past a photo that fails for its own reason, and counts attempts', async () => {
    const q = createMemoryPhotoQueue();
    await q.enqueue(input(1));
    const bad = await q.enqueue(input(2));
    await q.enqueue(input(3));
    let signal = true;
    const sent = await q.flush((p) => {
      if (!signal) throw new Error('No signal');
      if (p.id === bad.id) throw new Error('No job park-rd');
    }, () => signal);
    expect(sent).toBe(2);
    const left = await q.list();
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ id: bad.id, state: 'failed', error: 'No job park-rd', attempts: 1 });

    await q.enqueue(input(4));
    signal = false;
    expect(await q.flush(() => undefined, () => signal)).toBe(0);
    signal = true;
    let calls = 0;
    expect(
      await q.flush(() => {
        calls++;
        signal = false; // drops after the first send
        throw new Error('No signal');
      }, () => signal),
    ).toBe(0);
    expect(calls).toBe(1);
    expect((await q.list()).find((p) => p.id === bad.id)?.attempts).toBe(2);
  });

  it('shares a flush already running and tells subscribers about every change', async () => {
    const q = createMemoryPhotoQueue();
    let changes = 0;
    const off = q.subscribe(() => changes++);
    await q.enqueue(input(1));
    await q.enqueue(input(2));
    let uploads = 0;
    const slow = () => new Promise<void>((r) => setTimeout(() => (uploads++, r()), 5));
    const first = q.flush(slow, () => true);
    const second = q.flush(slow, () => true);
    expect(second).toBe(first);
    expect(await first).toBe(2);
    expect(uploads).toBe(2);
    expect(changes).toBeGreaterThanOrEqual(6); // 2 enqueues, 2 sending, 2 removes
    off();
    await q.clear();
    expect(changes).toBeGreaterThanOrEqual(6);
  });
});
