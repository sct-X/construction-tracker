import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * SPEC (locked): the site role never sees a price. This visits every route in
 * the registry as Alec and asserts no "$" on the page, none of the money
 * words, and no element anywhere in the DOM whose text contains "$" (hidden
 * money is forbidden too). The route list is read from src/shell/routes.tsx,
 * so a screen added there is covered without touching this spec.
 */

const here = dirname(fileURLToPath(import.meta.url));
const registry = readFileSync(resolve(here, '../src/shell/routes.tsx'), 'utf8');
const PATHS = [...registry.matchAll(/^\s*\{ path: '(\/[^']*)'/gm)].map((m) => m[1]);

/** Real seed ids in place of route params. */
const IDS: Record<string, string> = {
  '/jobs/:id': 'park-rd',
  '/steps/:id': 'pr-install-windows',
  '/items/:id': 'it-pr-windows',
  '/shipments/:id': 'sh-park-windows',
  '/templates/:id': 'tpl-duplex',
  '/trades/:id': 'tr-firstcall',
};

function concrete(path: string): string {
  for (const [prefix, id] of Object.entries(IDS)) {
    if (path.startsWith(prefix)) return path.replace(':id', id);
  }
  if (path.includes(':')) throw new Error(`no seed id for ${path}`);
  return path;
}

test.describe('No money for the site role', () => {
  test('the registry has routes', () => {
    expect(PATHS.length).toBeGreaterThan(20);
    expect(PATHS).toContain('/jobs');
  });

  for (const path of ['/', '/sign-in', ...PATHS]) {
    const url = concrete(path);
    test(`Alec at ${url}`, async ({ page }) => {
      await page.goto(`#${url}?as=alec&side=side-nd&today=2026-09-17`);
      await expect(page.getByTestId('dev-person')).toHaveValue('alec');
      await expect(page.locator('main')).toBeVisible();

      const text = await page.locator('body').innerText();
      expect(text).not.toContain('$');
      expect(text.toLowerCase()).not.toContain('holding');
      expect(text.toLowerCase()).not.toContain('slip cost');

      // Nothing in the DOM, visible or hidden, may carry a dollar sign (the dev bar included).
      const leaves = await page.locator('body *:not(:has(*))').allTextContents();
      const hidden = leaves.filter((t) => t.includes('$'));
      expect(hidden).toEqual([]);
    });
  }
});
