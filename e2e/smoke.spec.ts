import { expect, test } from '@playwright/test';

test.describe('Stage 0 smoke', () => {
  test('loads the shell with the heading and the dev bar', async ({ page }) => {
    await page.goto('#/');
    await expect(page.getByRole('heading', { name: 'Construction Tracker: Stage 0' })).toBeVisible();
    await expect(page.getByTestId('dev-bar')).toBeVisible();
    for (const id of ['dev-person', 'dev-today', 'dev-offline', 'dev-reset', 'dev-fire-reminders']) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
    await expect(page.getByTestId('dev-today')).toHaveValue('2026-09-17');
    await expect(page.getByTestId('dev-today-label')).toHaveText('Thu 17 Sep 2026');
  });

  test('?as=alec selects Alec and the date param sets today', async ({ page }) => {
    await page.goto('#/?as=alec&today=2026-09-21');
    await expect(page.getByTestId('dev-person')).toHaveValue('alec');
    await expect(page.getByTestId('stage0-person')).toHaveText('Alec');
    await expect(page.getByTestId('dev-today')).toHaveValue('2026-09-21');
    // Alec is the site role and belongs to one side, so no side switcher.
    await expect(page.getByTestId('dev-side')).toHaveCount(0);
  });

  test('offline toggle and reset work from the dev bar', async ({ page }) => {
    await page.goto('#/?as=dominic');
    await expect(page.getByTestId('dev-side')).toBeVisible(); // Dominic is on both sides
    await page.getByTestId('dev-offline').check();
    await expect(page.getByTestId('stage0-home')).toContainText('offline');
    await page.getByTestId('dev-fire-reminders').click();
    await expect(page.getByTestId('dev-fire-result')).toContainText('raised');
    await page.getByTestId('dev-today').fill('2026-10-05');
    await expect(page.getByTestId('dev-today-label')).toHaveText('Mon 5 Oct 2026');
    await page.getByTestId('dev-reset').click();
    await expect(page.getByTestId('dev-fire-result')).toHaveCount(0);
    // Reset returns today and offline to defaults and keeps the person.
    await expect(page.getByTestId('dev-today')).toHaveValue('2026-09-17');
    await expect(page.getByTestId('dev-offline')).not.toBeChecked();
    await expect(page.getByTestId('dev-person')).toHaveValue('dominic');
  });
});
