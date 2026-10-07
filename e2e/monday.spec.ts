import { expect, test } from '@playwright/test';
import { buildRow, isMock, openMonday, skipIfPending } from './helpers';

test.beforeEach(({}, info) => skipIfPending(info));

test('Monday shows the seeded forecasts, slip, cost and freshness', async ({ page }) => {
  await openMonday(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Monday' })).toBeVisible();
  await expect(page.getByTestId('monday-sub')).toContainText('Thu 17 Sep 2026');

  const park = buildRow(page, 'park-rd');
  await expect(park.getByTestId('finish')).toHaveText('Fri 26 Feb 2027');
  await expect(park.getByTestId('slip')).toHaveText('On track');
  await expect(park.getByTestId('why-it-moved')).toHaveCount(0);

  const seaview = buildRow(page, 'seaview');
  await expect(seaview.getByTestId('finish')).toHaveText('Fri 29 Oct 2027');
  await expect(seaview.getByTestId('slip')).toHaveText('On track');
  await expect(seaview.getByTestId('act-by')).toContainText('Book concrete pump');
  await expect(seaview.getByTestId('act-by')).toContainText('Act by Fri 18 Sep, tomorrow');

  const beatty = buildRow(page, 'beatty');
  await expect(beatty.getByTestId('finish')).toHaveText('Fri 4 Dec 2026');
  await expect(beatty.getByTestId('slip')).toHaveText('+5 days');
  await expect(beatty).toContainText('Later than Mon 14 Sep');
  await expect(beatty.getByTestId('slip-cost')).toHaveText('$1,430');
  const fresh = beatty.getByTestId('freshness');
  await expect(fresh).toHaveText('Not confirmed for 9 days');
  await expect(fresh).toHaveAttribute('data-amber', 'true');
  await expect(park.getByTestId('freshness')).toHaveAttribute('data-amber', 'false');
});

test('Why it moved traces Beatty St to the tiler change and the leftover line', async ({ page }) => {
  await openMonday(page);
  const why = buildRow(page, 'beatty').getByTestId('why-it-moved');
  await expect(why.getByRole('heading', { name: 'Why it moved' })).toBeVisible();
  const cause = why.getByTestId('why-cause');
  await expect(cause).toHaveCount(1);
  await expect(cause).toContainText('+7 days');
  await expect(cause).toContainText('Book tiler, expected date');
  await expect(cause).toContainText('Mon 28 Sep → Mon 5 Oct');
  await expect(cause).toContainText("Harbour Tiling can't get to Beatty till the 5th of October");
  await expect(why.getByTestId('why-leftover')).toHaveText(/2 days earlier for reasons not in the change log/);
});

test('design jobs sit below, grouped by stage', async ({ page }) => {
  await openMonday(page);
  const design = page.getByRole('region', { name: 'Design' });
  await expect(design.getByRole('columnheader', { name: /With council/ })).toBeVisible();
  const west = page.getByTestId('design-row-west-st');
  await expect(west.getByTestId('outstanding')).toHaveText('2 items');
  await expect(west.getByTestId('oldest')).toHaveText('23 days');
  await expect(page.getByTestId('design-row-tollbar').getByTestId('oldest')).toHaveText('8 days');
  await expect(page.getByTestId('design-row-lower-beach').getByTestId('outstanding')).toHaveText('Nothing');
  await expect(page.getByTestId('design-row-john-st').getByTestId('oldest')).toHaveText('4 days');
});

test('Jobs lists every job with kind, stage, finish and freshness', async ({ page }) => {
  await page.goto('./#/jobs');
  await expect(page.getByRole('heading', { level: 1, name: 'Jobs' })).toBeVisible();
  const rows = page.locator('[data-testid^="job-row-"]');
  await expect(rows).toHaveCount(7);
  const beatty = page.getByTestId('job-row-beatty');
  await expect(beatty.getByTestId('kind')).toHaveText('Build');
  await expect(beatty.getByTestId('finish')).toHaveText('Fri 4 Dec 2026');
  await expect(beatty.getByTestId('freshness')).toHaveText('Not confirmed for 9 days');
  await expect(page.getByTestId('job-row-west-st').getByTestId('kind')).toHaveText('Design');
  await expect(page.getByTestId('job-row-park-rd')).toContainText('Lock-up');
});

test('nav links only the screens that exist and marks the current one', async ({ page }) => {
  await openMonday(page);
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link')).toHaveText(['Monday', 'Jobs']);
  await expect(nav.getByRole('link', { name: 'Monday' })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('link', { name: 'Jobs' }).click();
  await expect(page).toHaveURL(/#\/jobs$/);
  await expect(nav.getByRole('link', { name: 'Jobs' })).toHaveAttribute('aria-current', 'page');
});

test('side switcher: the Norm side has no jobs', async ({ page }) => {
  await openMonday(page);
  await page.getByTestId('side-switcher').selectOption({ label: 'Norm' });
  await expect(page.getByText('No jobs on this side yet.')).toBeVisible();
  await page.getByTestId('side-switcher').selectOption({ label: 'Norm and Dom' });
  await expect(buildRow(page, 'park-rd')).toBeVisible();
});

test('dev bar appears only in mock mode; Today is moves the screen and Reset puts it back', async ({ page }, info) => {
  await openMonday(page);
  if (!isMock(info)) {
    await expect(page.getByRole('region', { name: 'Demo controls' })).toHaveCount(0);
    return;
  }
  const bar = page.getByRole('region', { name: 'Demo controls' });
  await expect(bar.getByLabel('Today is')).toHaveValue('2026-09-17');
  await bar.getByLabel('Today is').fill('2026-09-24');
  await expect(page.getByTestId('monday-sub')).toContainText('Thu 24 Sep 2026');
  await page.reload();
  await expect(page.getByTestId('monday-sub')).toContainText('Thu 24 Sep 2026');
  await bar.getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByTestId('monday-sub')).toContainText('Thu 17 Sep 2026');
  await expect(buildRow(page, 'beatty').getByTestId('slip')).toHaveText('+5 days');
});
