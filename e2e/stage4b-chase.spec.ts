import { expect, test } from '@playwright/test';
import { shootBoth } from './stage4b-helpers';

test('To chase lists items by job with tap-to-call trade numbers', async ({ page }) => {
  await page.goto('./#/chase');
  await expect(page.getByRole('heading', { level: 1, name: 'To chase' })).toBeVisible();
  await expect(page.getByTestId('chase-count')).toContainText('19');
  const call = page.getByTestId('chase-row-it-sv-pump').getByTestId('call');
  await expect(call).toHaveAttribute('href', 'tel:0491570157');
  await expect(call).toContainText('Northern Concrete Pumping');
  await expect(call).toContainText('0491 570 157');
  await expect(page.getByTestId('chase-job-beatty')).toContainText('Not confirmed for 9 days');
  await page.getByRole('button', { name: /^Dominic/ }).click();
  await expect(page.getByTestId('chase-row-it-sv-pump')).toHaveCount(0);
  await expect(page.getByTestId('chase-row-it-pr-glazing-cert')).toBeVisible();
});

test('screenshots: to chase', async ({ page }, info) => {
  await shootBoth(page, info, 'chase', '#/chase', 'chase-row-it-sv-pump');
});
