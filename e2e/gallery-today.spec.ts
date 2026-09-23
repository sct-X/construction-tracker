import { expect, test } from '@playwright/test';

// Stage 3, part B: Alec's Today, Deliveries and the photo gallery.
// Today is Thu 17 Sep 2026 unless a test says otherwise. Runs at both projects:
// Alec always gets the phone layout, Dominic gets the desktop one on the wide project.

test.describe("Alec's Today", () => {
  test('shows the day, the current stage, the next hold point and a big Add photos button', async ({ page }) => {
    await page.goto('#/jobs/park-rd?as=alec&today=2026-09-17');
    const today = page.getByTestId('today');
    await expect(today).toBeVisible();
    await expect(page.getByTestId('today-date')).toHaveText('Thursday 17 September');
    await expect(page.getByTestId('today-stage')).toContainText('Lock-up stage');

    const add = page.getByTestId('today-add-photos');
    await expect(add).toHaveText('Add photos');
    await expect(add).toHaveAttribute('href', '#/jobs/park-rd/upload?stage=pr-st-lockup');
    const box = await add.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(56);

    // The next hold point in words, with its photo readiness.
    const hp = page.getByTestId('today-holdpoint');
    await expect(hp).toContainText('Stormwater inspection');
    await expect(hp).toContainText('Mon 12 Oct, in 3 weeks');
    await expect(page.getByTestId('today-holdpoint-readiness')).toContainText('0 of 1 required photo set uploaded');
    await expect(page.getByTestId('holdpoint-add-photos')).toHaveAttribute('href', '#/jobs/park-rd/upload?stage=pr-st-external');

    // What is on site this week, and the deliveries due.
    await expect(page.getByTestId('today-week')).toContainText('External cladding');
    const deliveries = page.getByTestId('today-deliveries');
    await expect(deliveries).toContainText('Cladding');
    await expect(deliveries).toContainText('Tue 15 Sep');
    await expect(page.getByTestId('today-deliveries-link')).toHaveAttribute('href', '#/deliveries');

    // The note line and the day's note.
    await expect(page.getByTestId('today-note')).toHaveAttribute('href', '#/jobs/park-rd/notes');
    await expect(page.getByTestId('today-note')).toContainText('Rain till 10');

    // Every tap target on the section is at least 56px tall.
    const targets = await today.locator('a, button').all();
    for (const t of targets) {
      const b = await t.boundingBox();
      if (b) expect(b.height, await t.innerText()).toBeGreaterThanOrEqual(56);
    }

    // Never a price, and the latest photos strip is there for him too.
    await expect(page.getByTestId('overview-latest-photos').locator('img')).toHaveCount(6);
    expect(await page.locator('body').innerText()).not.toContain('$');
  });

  test('Seaview says the slab inspection is 1 of 3 sets ready', async ({ page }) => {
    await page.goto('#/jobs/seaview?as=alec&today=2026-09-17');
    await expect(page.getByTestId('today-stage')).toContainText('Slab stage');
    await expect(page.getByTestId('today-holdpoint')).toContainText('Slab inspection before pour');
    await expect(page.getByTestId('today-holdpoint-readiness')).toContainText('1 of 3 required photo sets uploaded');
    expect(await page.locator('body').innerText()).not.toContain('$');
  });
});

test.describe('Deliveries', () => {
  test('lists deliveries by week and Mark delivered changes the status word', async ({ page }) => {
    await page.goto('#/deliveries?as=alec&today=2026-09-17');
    const list = page.getByTestId('deliveries');
    await expect(list).toBeVisible();

    // The cladding was expected Tuesday and has not been marked delivered.
    const cladding = page.getByTestId('delivery-it-pr-cladding');
    await expect(cladding).toContainText('Cladding');
    await expect(cladding).toContainText('Expected Tue 15 Sep, 2 days ago, not marked delivered');
    await expect(page.getByTestId('delivery-status-it-pr-cladding')).toHaveText('Confirmed');
    await expect(page.getByTestId('deliveries-group-late')).toContainText('Cladding');

    // Late against the step is words too, and the windows container is under Later.
    await expect(page.getByTestId('delivery-it-sv-slab-steel')).toContainText('Expected Fri 18 Sep, tomorrow, 4 days after needed');
    // Expected after needed is plain words, not the late red.
    await expect(page.getByTestId('delivery-it-sv-slab-steel').locator('[data-tone="late"]')).toHaveCount(0);
    await expect(page.getByTestId('deliveries-group-later').getByTestId('delivery-sh-park-windows')).toContainText('Expected Mon 26 Oct');
    await expect(page.getByTestId('delivery-sh-park-windows')).toContainText('Windows, Sliding doors');

    const mark = page.getByTestId('delivery-mark-it-pr-cladding');
    const box = await mark.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(56);
    await mark.click();
    await expect(page.getByTestId('delivery-status-it-pr-cladding')).toHaveText('Delivered');
    await expect(cladding).toContainText('Delivered Thu 17 Sep');
    await expect(page.getByTestId('deliveries-group-delivered')).toContainText('Cladding');
    await expect(page.getByTestId('delivery-mark-it-pr-cladding')).toHaveCount(0);

    // A shipment takes its material items with it.
    await page.getByTestId('delivery-mark-sh-park-windows').click();
    await expect(page.getByTestId('delivery-status-sh-park-windows')).toHaveText('Delivered');
    expect(await page.locator('body').innerText()).not.toContain('$');

    await page.getByTestId('dev-reset').click();
    await expect(page.getByTestId('delivery-status-it-pr-cladding')).toHaveText('Confirmed');
  });
});

test.describe('Photo gallery', () => {
  test('Alec sees Park Rd grouped by stage with counts, and opens a photo', async ({ page }) => {
    await page.goto('#/jobs/park-rd/photos?as=alec&today=2026-09-17');
    await expect(page.getByTestId('gallery')).toBeVisible();
    await expect(page.getByTestId('gallery-stage-count-pr-st-slab')).toHaveText('6 photos, 3 of 3 required sets');
    await expect(page.getByTestId('gallery-stage-count-pr-st-frame')).toHaveText('2 photos, 1 of 1 required set');
    await expect(page.getByTestId('gallery-stage-count-pr-st-roof')).toHaveText('6 photos');
    await expect(page.getByTestId('gallery-category-pr-pc-slab-steel')).toContainText('needed for inspection');
    await expect(page.getByTestId('gallery-category-pr-pc-slab-steel').locator('img')).toHaveCount(3);
    await expect(page.getByTestId('gallery-category-pr-pc-sw-before-backfill')).toContainText('Needed before the stormwater inspection');
    await expect(page.getByTestId('gallery-upload-pr-pc-lockup-windows')).toHaveAttribute('href', '#/jobs/park-rd/upload?stage=pr-st-lockup&category=pr-pc-lockup-windows');
    await expect(page.getByTestId('gallery-upload')).toHaveAttribute('href', '#/jobs/park-rd/upload?stage=pr-st-lockup');

    // The stage filter is a dropdown, 56px on his phone.
    const stageFilter = page.getByTestId('gallery-filter');
    expect((await stageFilter.boundingBox())!.height).toBeGreaterThanOrEqual(56);
    await stageFilter.selectOption('pr-st-roof');
    await expect(stageFilter).toHaveValue('pr-st-roof');
    await expect(page.getByTestId('gallery-stage-pr-st-roof')).toBeVisible();
    await expect(page.getByTestId('gallery-stage-pr-st-slab')).toHaveCount(0);
    await expect(page).toHaveURL(/stage=pr-st-roof/);

    // Open a photo: when, who, where.
    await page.getByTestId('gallery-photo-ph-pr-roof-1').click();
    const view = page.getByTestId('gallery-view');
    await expect(view).toBeVisible();
    await expect(page.getByTestId('gallery-view-taken')).toHaveText('Wed 19 Aug 2026, 4 weeks ago');
    await expect(page.getByTestId('gallery-view-who')).toContainText('Alec');
    await expect(page.getByTestId('gallery-view-category')).toHaveText('Roof, Roof complete');
    await expect(page.getByTestId('gallery-delete')).toHaveCount(0);
    await page.getByTestId('gallery-view-close').click();
    await expect(view).toHaveCount(0);

    expect(await page.locator('body').innerText()).not.toContain('$');
  });

  test('Dominic sees the seeded photos, sorts, and can move or delete one', async ({ page }, testInfo) => {
    await page.goto('#/jobs/park-rd/photos?as=dominic&today=2026-09-17');
    await expect(page.locator('[data-testid^="gallery-photo-"]')).toHaveCount(20);
    await expect(page.getByTestId('gallery-stage-general')).toContainText('1 photo');
    await expect(page.getByTestId('gallery-filter-by-raff')).toHaveText('Raff');
    await page.getByTestId('gallery-filter-by').selectOption('raff');
    await expect(page.locator('[data-testid^="gallery-photo-"]')).toHaveCount(3);
    await page.getByTestId('gallery-filter-by').selectOption('');

    if (testInfo.project.name === 'desktop') {
      const first = page.getByTestId('gallery-category-pr-pc-roof-complete').locator('[data-testid^="gallery-photo-"]').first();
      await expect(first).toHaveAttribute('data-testid', 'gallery-photo-ph-pr-roof-6');
      await page.getByTestId('gallery-sort').selectOption('oldest');
      await expect(first).toHaveAttribute('data-testid', 'gallery-photo-ph-pr-roof-1');
    }

    await page.getByTestId('gallery-photo-ph-pr-brick-1').click();
    await expect(page.getByTestId('gallery-view-category')).toHaveText('Lock-up, Brickwork');
    await page.getByTestId('gallery-move-pr-pc-lockup-cladding').click();
    await expect(page.getByTestId('gallery-view-category')).toHaveText('Lock-up, External cladding');
    await page.getByTestId('gallery-delete').click();
    await page.getByTestId('gallery-delete-confirm').click();
    await expect(page.getByTestId('gallery-view')).toHaveCount(0);
    await expect(page.locator('[data-testid^="gallery-photo-"]')).toHaveCount(19);
    await expect(page.getByTestId('gallery-category-pr-pc-lockup-cladding')).toContainText('2 photos');

    await page.getByTestId('dev-reset').click();
    await expect(page.locator('[data-testid^="gallery-photo-"]')).toHaveCount(20);
  });

  test("Alec's latest photos strip links into the gallery and opens the photo", async ({ page }) => {
    await page.goto('#/jobs/park-rd?as=alec&today=2026-09-17');
    const strip = page.getByTestId('overview-latest-photos');
    await expect(strip.locator('img')).toHaveCount(6);
    await expect(page.getByTestId('overview-all-photos')).toHaveText('All 20 photos');
    await page.getByTestId('overview-photo-ph-pr-clad-2').click();
    await expect(page).toHaveURL(/#\/jobs\/park-rd\/photos\?photo=ph-pr-clad-2/);
    await expect(page.getByTestId('gallery-view-category')).toHaveText('Lock-up, External cladding');
  });
});
