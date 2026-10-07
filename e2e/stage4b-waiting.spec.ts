import { expect, test } from '@playwright/test';
import { shootBoth } from './stage4b-helpers';

test('Waiting on groups all jobs into Overdue, This week and Later, in words', async ({ page }) => {
  await page.goto('./#/waiting');
  await expect(page.getByRole('heading', { level: 1, name: 'Waiting on' })).toBeVisible();
  await expect(page.getByTestId('waiting-group-overdue')).toHaveAttribute('data-count', '5');
  await expect(page.getByTestId('waiting-group-this_week')).toHaveAttribute('data-count', '11');
  await expect(page.getByTestId('waiting-group-later')).toHaveAttribute('data-count', '31');
  const steel = page.getByTestId('waiting-row-it-sv-slab-steel');
  await expect(steel.getByTestId('urgency')).toHaveText('3 days overdue');
  await expect(steel.getByTestId('needed-by')).toHaveText('Mon 14 Sep');
  const pump = page.getByTestId('waiting-row-it-sv-pump');
  await expect(pump.getByTestId('act-by')).toHaveText('Fri 18 Sep');
  await expect(pump.getByTestId('call')).toHaveAttribute('href', 'tel:0491570157');
});

test('Waiting on narrows to one job from the picker', async ({ page }) => {
  await page.goto('./#/waiting');
  await page.getByTestId('job-picker').selectOption('beatty');
  await expect(page).toHaveURL(/#\/jobs\/beatty\/waiting$/);
  await expect(page.getByTestId('waiting-row-it-bt-tiler')).toBeVisible();
  await expect(page.getByTestId('waiting-row-it-sv-pump')).toHaveCount(0);
});

test('screenshots: waiting on', async ({ page }, info) => {
  await shootBoth(page, info, 'waiting', '#/waiting', 'waiting-row-it-sv-pump');
  await shootBoth(page, info, 'waiting-job', '#/jobs/seaview/waiting', 'waiting-row-it-sv-pump');
});
