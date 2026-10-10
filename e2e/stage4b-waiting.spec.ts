/**
 * Waiting on (Stage 6a: one list in the v1 look, with To chase merged in):
 * Overdue / This week / Later (Later folded), one date phrase per row, a Call
 * button naming the trade. #/chase forwards here.
 */
import { expect, test } from '@playwright/test';
import { shootBoth } from './stage4b-helpers';

test('Waiting on groups all jobs into Overdue, This week and Later, in words, with Later folded', async ({ page }) => {
  await page.goto('./#/waiting');
  await expect(page.getByRole('heading', { level: 1, name: 'Waiting on' })).toBeVisible();
  await expect(page.getByTestId('waiting-sub')).toHaveText('47 to act on, 5 overdue');
  await expect(page.getByTestId('waiting-group-overdue')).toHaveAttribute('data-count', '5');
  await expect(page.getByTestId('waiting-group-this_week')).toHaveAttribute('data-count', '3');
  const later = page.getByTestId('waiting-group-later');
  await expect(later).toHaveAttribute('data-count', '39');
  await expect(later).not.toHaveAttribute('open');
  await expect(page.getByTestId('waiting-row-it-bt-tiler')).toBeHidden();
  await later.locator('summary').click();
  await expect(page.getByTestId('waiting-row-it-bt-tiler').getByTestId('when')).toHaveText('Expected Mon 5 Oct, in 2 weeks, 7 days after needed');
  const steel = page.getByTestId('waiting-row-it-sv-slab-steel');
  await expect(steel.getByTestId('when')).toHaveText('!Needed Mon 14 Sep, overdue by 3 days');
  await expect(steel).toHaveAttribute('data-overdue', 'true');
});

test('every row with a trade phone has a Call button that names the trade (was To chase)', async ({ page }) => {
  await page.goto('./#/chase');
  await expect(page).toHaveURL(/#\/waiting$/);
  const pump = page.getByTestId('waiting-row-it-sv-pump');
  await expect(pump.getByTestId('when')).toHaveText('Act by Fri 18 Sep, tomorrow');
  const call = pump.getByTestId('call');
  await expect(call).toHaveAttribute('href', 'tel:0491570157');
  await expect(call).toHaveText('Call Northern Concrete Pumping');
  await expect(call).toHaveAccessibleName('Call Northern Concrete Pumping, 0491 570 157');
  // Mine: Dominic's own items.
  await page.getByRole('button', { name: 'Mine' }).click();
  await expect(page.getByTestId('waiting-row-it-sv-pump')).toHaveCount(0);
  await expect(page.getByTestId('waiting-row-it-pr-glazing-cert')).toBeVisible();
});

test('Waiting on narrows to one job from the job menu, inside the job', async ({ page }) => {
  await page.goto('./#/waiting');
  await page.getByTestId('job-picker').selectOption('beatty');
  await expect(page).toHaveURL(/#\/jobs\/beatty\/waiting$/);
  await expect(page.getByTestId('job-tabs').getByRole('link', { name: 'Waiting on' })).toHaveAttribute('aria-current', 'page');
  await page.getByTestId('waiting-group-later').locator('summary').click();
  await expect(page.getByTestId('waiting-row-it-bt-tiler')).toBeVisible();
  await expect(page.getByTestId('waiting-row-it-sv-pump')).toHaveCount(0);
});

test('screenshots: waiting on', async ({ page }, info) => {
  await shootBoth(page, info, 'waiting', '#/waiting', 'waiting-row-it-sv-pump');
  await shootBoth(page, info, 'waiting-job', '#/jobs/seaview/waiting', 'waiting-row-it-sv-pump');
});
