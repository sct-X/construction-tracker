import { expect, test } from '@playwright/test';
import { shootBoth } from './stage4b-helpers';

test('Changes shows the source, each field before and after, and the steps it moved (no finish or money)', async ({ page }) => {
  await page.goto('./#/history');
  await expect(page.getByRole('heading', { level: 1, name: 'Changes' })).toBeVisible();
  const tiler = page.getByTestId('history-cs-0915-tiler');
  await expect(tiler.getByTestId('status')).toHaveText('Saved');
  await expect(tiler.getByTestId('fields')).toContainText('Book tiler, expected date');
  await expect(tiler.getByTestId('fields')).toContainText('Mon 28 Sep → Mon 5 Oct');
  await expect(tiler.getByTestId('source')).toContainText("Harbour Tiling can't get to Beatty");
  await expect(tiler.getByTestId('forecast')).toHaveText(/^Moved \d+ steps? at Beatty St$/);
  await expect(page.locator('main')).not.toContainText('$');
  await expect(page.getByTestId('history-cs-0916-cancel').getByTestId('status')).toHaveText('Cancelled, nothing saved');
});

test('Changes filters by job', async ({ page }) => {
  await page.goto('./#/history');
  await page.getByTestId('job-picker').selectOption('beatty');
  await expect(page).toHaveURL(/#\/history\/beatty$/);
  await expect(page.getByTestId(/^history-cs-/)).toHaveCount(2);
});

test('screenshots: changes', async ({ page }, info) => {
  await shootBoth(page, info, 'history', '#/history', 'history-cs-0915-tiler');
});
