import { expect, test } from '@playwright/test';
import { shootBoth } from './stage4b-helpers';

test('Photos shows Seaview St slab hold point at 1 of 3 and opens a photo', async ({ page }) => {
  await page.goto('./#/jobs/seaview/photos');
  const slab = page.getByTestId('photo-stage-sv-st-slab');
  await expect(slab.getByTestId('hold-progress')).toContainText('1 of 3');
  await expect(slab.getByTestId('hold-progress')).toContainText('Plumbing under slab, Membrane and termite barrier');
  await expect(slab.getByText('Needed for the hold point')).toHaveCount(3);
  await slab.getByRole('button', { name: /^Open photo/ }).first().click();
  await expect(page.getByTestId('lightbox')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('lightbox')).toHaveCount(0);
});

test('screenshots: photos', async ({ page }, info) => {
  await shootBoth(page, info, 'photos', '#/jobs/seaview/photos', 'hold-progress');
  await shootBoth(page, info, 'photos-park', '#/jobs/park-rd/photos', 'hold-progress');
});
