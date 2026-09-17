import { expect, test } from '@playwright/test';

/**
 * SPEC (locked): the app installs to a phone and opens offline. The service
 * worker precaches the shell and its hashed assets on the first online open;
 * this loads once, cuts the connection at the browser level (not the dev
 * bar), reloads, and expects the app to render from the cache. Playwright's
 * server is `vite preview` over the built output, so the worker is
 * registered exactly as on Pages.
 */
test.describe('Opens offline', () => {
  test('after one online open, a reload with no connection still renders the app', async ({ page, context }) => {
    await page.goto('#/jobs?as=alec&today=2026-09-17');
    await expect(page.getByTestId('dev-bar')).toBeVisible();

    // Wait for the worker to be active and its precache to hold the shell and every asset on this page.
    // (As a string: the e2e tsconfig has no DOM lib.)
    await page.waitForFunction(
      `(async () => {
        if (!('serviceWorker' in navigator)) return false;
        const reg = await navigator.serviceWorker.ready;
        if (!reg.active) return false;
        const urls = new Set();
        for (const k of await caches.keys()) for (const req of await (await caches.open(k)).keys()) urls.add(req.url);
        const wanted = [location.origin + location.pathname];
        for (const el of document.querySelectorAll('script[src], link[rel=stylesheet]')) wanted.push(el.src || el.href);
        return wanted.every((u) => urls.has(u));
      })()`,
      undefined,
      { timeout: 20_000 },
    );

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId('dev-bar')).toBeVisible();
    await expect(page.getByTestId('primary-nav')).toBeVisible();
    await expect(page.getByTestId('jobs-list').or(page.locator('main'))).toBeVisible();
    await context.setOffline(false);
  });
});
