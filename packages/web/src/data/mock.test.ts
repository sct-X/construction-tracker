// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createBrowserMock } from './mock';

beforeEach(() => localStorage.clear());

describe('browser mock', () => {
  it('keeps "today is" across reloads and Reset goes back to the seed day', async () => {
    const a = createBrowserMock();
    await a.dev.setToday('2026-09-24');
    const b = createBrowserMock();
    expect(await b.api.getToday()).toBe('2026-09-24');
    await b.dev.reset();
    expect(await b.api.getToday()).toBe('2026-09-17');
    expect(await createBrowserMock().api.getToday()).toBe('2026-09-17');
  });

  it('keeps working when storage throws', async () => {
    const orig = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error('blocked');
    };
    try {
      const m = createBrowserMock();
      expect((await m.api.getMonday()).builds).toHaveLength(3);
    } finally {
      Storage.prototype.getItem = orig;
    }
  });
});
