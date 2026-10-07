import { expect, test } from '@playwright/test';
import { shootBoth } from './stage4b-helpers';

test('Daily notes lists Park Rd notes newest first', async ({ page }) => {
  await page.goto('./#/jobs/park-rd/notes');
  await expect(page.getByRole('heading', { level: 1, name: /Daily notes/ })).toBeVisible();
  const dates = page.getByTestId('note-date');
  await expect(dates).toHaveCount(6);
  await expect(dates.first()).toHaveText('Thu 17 Sep');
  await expect(page.getByTestId('note-dn-pr-0917')).toContainText('Rain till 10');
});

test('screenshots: daily notes', async ({ page }, info) => {
  await shootBoth(page, info, 'notes', '#/jobs/park-rd/notes', 'note-dn-pr-0917');
});
