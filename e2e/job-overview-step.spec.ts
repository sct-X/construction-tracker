import { expect, test } from '@playwright/test';

// Stage 2, part C: the build job overview (UI_PLAN 3.4) and step detail (3.6).
// Today is Thu 17 Sep 2026. Runs at both projects (phone and desktop).

test.describe('Build job overview', () => {
  test('Dominic sees Park Rd stage and freshness, and confirms the program', async ({ page }) => {
    await page.goto('#/jobs/park-rd?as=dominic&today=2026-09-17');
    await expect(page.getByTestId('job-stage')).toContainText('Lock-up');
    await expect(page.getByTestId('job-fresh')).toHaveText('Last confirmed 2 days ago');
    // No finish date, slip, why-it-moved or money on the page.
    await expect(page.getByTestId('job-finish')).toHaveCount(0);
    await expect(page.getByTestId('job-slip')).toHaveCount(0);
    await expect(page.getByTestId('job-holding')).toHaveCount(0);
    const text = await page.locator('#root').innerText();
    expect(text).not.toContain('$');
    expect(text).not.toContain('26 Feb 2027');

    // Next hold point with its photo-set readiness in words.
    await expect(page.getByTestId('job-next-holdpoint')).toContainText('required photo set');

    // Top waiting-on items, each a row, and a link to the full list for this job.
    await expect(page.getByTestId('job-waiting-list').locator('li')).toHaveCount(5);
    await expect(page.getByTestId('job-waiting-all')).toHaveAttribute('href', '#/waiting?job=park-rd');

    // Confirm program stamps today and the words change.
    await page.getByTestId('job-confirm').click();
    await expect(page.getByTestId('job-fresh')).toHaveText('Last confirmed today');
    await expect(page.getByTestId('job-fresh')).toHaveAttribute('data-tone', 'muted');
  });

  test('Beatty St shows its stage, the tiler moving the tiling stage, and amber freshness', async ({ page }) => {
    await page.goto('#/jobs/beatty?as=dominic&today=2026-09-17');
    await expect(page.getByTestId('job-stage')).toContainText('Rough-in');
    await expect(page.getByTestId('job-stage-bt-st-tiling')).toContainText('5 Oct to 16 Oct');
    await expect(page.getByTestId('job-stage-bt-st-tiling')).toContainText('planned 28 Sep to 9 Oct');
    await expect(page.getByTestId('job-fresh')).toHaveAttribute('data-tone', 'amber');
    await expect(page.getByTestId('job-fresh')).toContainText('9 days ago');
    expect(await page.locator('#root').innerText()).not.toContain('$');
  });

  test('Alec gets the Today layout with no money anywhere', async ({ page }) => {
    await page.goto('#/jobs/park-rd?as=alec&today=2026-09-17');
    await expect(page.getByTestId('today')).toBeVisible();
    await expect(page.getByTestId('job-stage')).toContainText('Lock-up');
    await expect(page.getByTestId('job-slip')).toHaveCount(0);
    await expect(page.getByTestId('job-confirm')).toHaveCount(0);
    await expect(page.getByTestId('today-holdpoint')).toBeVisible();
    const text = await page.locator('body').innerText();
    expect(text).not.toContain('$');
  });
});

test.describe('Step detail', () => {
  test('Install windows shows planned and forecast dates and its items', async ({ page }) => {
    await page.goto('#/steps/pr-install-windows?as=dominic&today=2026-09-17');
    await expect(page.getByTestId('step-planned')).toContainText('Mon 2 Nov 2026');
    await expect(page.getByTestId('step-forecast')).toContainText('Mon 2 Nov 2026');
    await expect(page.getByTestId('step-late')).toHaveText('on plan');
    await expect(page.getByTestId('step-duration')).toHaveText('10 working days');
    await expect(page.getByTestId('step-items').locator('li')).toHaveCount(4);
    await expect(page.getByTestId('item-row-it-pr-windows')).toContainText('Windows');
    await expect(page.getByTestId('item-row-it-pr-windows')).toContainText('Expected Mon 26 Oct');
    await expect(page.getByTestId('item-row-it-pr-windows')).toContainText('Ordered or booked');
    await expect(page.getByTestId('item-row-it-pr-window-installer')).toContainText('Act by');
    await expect(page.getByTestId('step-mark-done')).toBeVisible();

    // It starts in November, so "Mark done" today is refused in words (locked decision).
    await page.getByTestId('step-mark-done').click();
    await expect(page.getByTestId('step-refusal')).toHaveText("This step hasn't started yet; it starts Mon 2 Nov, in 6 weeks.");
    await expect(page.getByTestId('step-status')).toHaveText('Not started');
  });

  test('Beatty overview lists stages with planned and forecast spans in words', async ({ page }) => {
    await page.goto('#/jobs/beatty?as=dominic&today=2026-09-17');
    await expect(page.getByTestId('job-stage-bt-st-tiling')).toContainText('7 days late');
    await expect(page.getByTestId('job-stage-bt-st-tiling')).toContainText('planned');
  });

  test('Seaview slab inspection refuses Mark done and names the two empty categories', async ({ page }) => {
    await page.goto('#/steps/sv-slab-insp?as=raff&today=2026-09-17');
    await expect(page.getByTestId('holdpoint-readiness')).toContainText('1 of 3 required photo sets uploaded');
    await expect(page.getByTestId('holdpoint-category-sv-pc-slab-steel')).toContainText('4 photos');
    await expect(page.getByTestId('holdpoint-category-sv-pc-slab-plumbing')).toContainText('none yet');
    await expect(page.getByTestId('holdpoint-category-sv-pc-slab-membrane')).toContainText('none yet');
    await expect(page.getByTestId('holdpoint-refusal')).toHaveCount(0);

    await page.getByTestId('step-mark-done').click();
    await expect(page.getByTestId('holdpoint-refusal')).toHaveText(
      "Can't tick this off yet. The certifier needs before-cover photos and 2 categories are empty: Plumbing under slab; Membrane and termite barrier.",
    );
    await expect(page.getByTestId('step-status')).toHaveText('Not started');
    await expect(page.getByTestId('holdpoint-add-photos')).toHaveAttribute('href', '#/jobs/seaview/upload?stage=sv-st-slab');
  });
});
