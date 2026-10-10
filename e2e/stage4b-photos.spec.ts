import { expect, test } from '@playwright/test';
import { shootBoth } from './stage4b-helpers';

test('Photos shows Seaview St slab hold point at 1 of 3 and opens a photo', async ({ page }) => {
  await page.goto('./#/jobs/seaview/photos');
  const slab = page.getByTestId('photo-stage-sv-st-slab');
  // v1 gallery words: the stage's count and required sets, the hold point with its date, each required set marked.
  await expect(slab.getByTestId('hold-progress')).toHaveText('4 photos, 1 of 3 required sets');
  await expect(slab.getByTestId('hold-step')).toContainText('Slab inspection before pour, Mon 28 Sep');
  await expect(slab.getByTestId('cat-needed')).toHaveText([
    'needed for inspection',
    '!Needed before the slab inspection before pour',
    '!Needed before the slab inspection before pour',
  ]);
  await expect(page.locator('main')).not.toContainText('$');
  await slab.getByRole('button', { name: /^Open photo/ }).first().click();
  await expect(page.getByTestId('lightbox')).toBeVisible();
  await expect(page.getByTestId('lightbox').getByTestId('view-category')).toHaveText('Slab, Steel reinforcement in place');
  // Focus is trapped in the dialog, and goes back to the photo that opened it.
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('lightbox').getByRole('button', { name: 'Close' })).toBeFocused();
  }
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('lightbox')).toHaveCount(0);
  await expect(slab.getByRole('button', { name: /^Open photo/ }).first()).toBeFocused();
});

test('screenshots: photos', async ({ page }, info) => {
  await shootBoth(page, info, 'photos', '#/jobs/seaview/photos', 'hold-progress');
  await shootBoth(page, info, 'photos-park', '#/jobs/park-rd/photos', 'hold-progress');
});
