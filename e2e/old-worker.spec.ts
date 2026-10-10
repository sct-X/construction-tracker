/**
 * The old prototype on GitHub Pages registered `${BASE_URL}sw.js` (scope
 * /construction-tracker/) and cached the app. This app registers no worker,
 * and packages/web/public/sw.js is a clean-up worker: on activate it deletes
 * every cache, unregisters itself and reloads the tab. Mock (Pages) build only.
 */
import { expect, test, type Page } from '@playwright/test';
import { isMock, openOverview } from './helpers';

async function workerState(page: Page): Promise<{ registrations: number; caches: number } | null> {
  try {
    return await page.evaluate(async () => ({
      registrations: (await navigator.serviceWorker.getRegistrations()).length,
      caches: (await caches.keys()).length,
    }));
  } catch {
    return null; // the worker reloaded the page mid-check
  }
}

test('the app registers no service worker, and the old one at sw.js removes itself and its caches', async ({ page }, info) => {
  test.skip(!isMock(info), 'The old worker only ever lived on the Pages site.');
  await openOverview(page);
  expect(await workerState(page)).toEqual({ registrations: 0, caches: 0 });

  // What the prototype left behind in a returning browser: its worker and its cache.
  await page.evaluate(async () => {
    const cache = await caches.open('ct-shell-v2');
    await cache.put(new Request('./old-shell'), new Response('old app shell'));
    const base = new URL('./', location.href).pathname; // /construction-tracker/
    await navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
  });

  await expect.poll(() => workerState(page), { timeout: 15_000 }).toEqual({ registrations: 0, caches: 0 });
  // The tab came back to the current app.
  await page.getByTestId('overview-card-park-rd').waitFor();
});
