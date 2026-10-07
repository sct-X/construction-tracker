import { describe, expect, it, vi } from 'vitest';
import { HttpDashboardApi, trimArgs } from './http';

function fakeFetch(body: unknown, status = 200) {
  return vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
}

describe('HttpDashboardApi', () => {
  it('POSTs {args} to api/rpc/:method and returns result', async () => {
    const f = fakeFetch({ result: { today: '2026-09-17', builds: [], design: [], weekOf: '2026-09-14' } });
    const api = new HttpDashboardApi('api', f as unknown as typeof fetch);
    const v = await api.getMonday({ sideId: 'side-nd' });
    expect(v.weekOf).toBe('2026-09-14');
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('api/rpc/getMonday');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ args: [{ sideId: 'side-nd' }] });
  });

  it('drops trailing undefined args so server-side defaults apply', async () => {
    const f = fakeFetch({ result: [] });
    await new HttpDashboardApi('api', f as unknown as typeof fetch).getChangeHistory();
    expect(JSON.parse(String(f.mock.calls[0]![1]?.body))).toEqual({ args: [] });
    expect(trimArgs(['a', undefined, 'b', undefined])).toEqual(['a', null, 'b']);
  });

  it('throws the server error message', async () => {
    const f = fakeFetch({ error: 'Unknown job nope' }, 400);
    await expect(new HttpDashboardApi('api', f as unknown as typeof fetch).getWhyItMoved('nope')).rejects.toThrow('Unknown job nope');
  });

  it('says the server is not answering when fetch fails', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(new HttpDashboardApi('api', f as unknown as typeof fetch).listSides()).rejects.toThrow(/not answering/);
  });

  it('photo URLs: placeholders inline, real photos from the server route', () => {
    const api = new HttpDashboardApi();
    expect(api.photoUrl({ id: 'p1', caption: 'x', isPlaceholder: true })).toMatch(/^data:image\/svg\+xml/);
    expect(api.photoUrl({ id: 'p 2', caption: null, isPlaceholder: false })).toBe('/api/photos/p%202/file');
  });
});
