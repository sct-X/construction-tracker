import { expect, test } from '@playwright/test';

// Stage 2, part C: the build job overview (UI_PLAN 3.4) and step detail (3.6).
// Today is Thu 17 Sep 2026. Runs at both projects (phone and desktop).

test.describe('Build job overview', () => {
  test('Dominic sees Park Rd finish and freshness, and confirms the program', async ({ page }) => {
    await page.goto('#/jobs/park-rd?as=dominic&today=2026-09-17');
    await expect(page.getByTestId('job-finish')).toContainText('Fri 26 Feb 2027');
    await expect(page.getByTestId('job-late')).toHaveText('On plan');
    await expect(page.getByTestId('job-slip')).toContainText('0');
    await expect(page.getByTestId('job-slip')).toContainText('Nothing moved');
    await expect(page.getByTestId('job-holding')).toHaveText('$4,500/wk');
    await expect(page.getByTestId('job-fresh')).toHaveText('Last confirmed 2 days ago');

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

  test('Beatty St shows slip, cost and late against the plan in words', async ({ page }) => {
    await page.goto('#/jobs/beatty?as=dominic&today=2026-09-17');
    await expect(page.getByTestId('job-finish')).toContainText('Fri 4 Dec 2026');
    await expect(page.getByTestId('job-slip')).toContainText('+5 days');
    await expect(page.getByTestId('job-slip')).toContainText('$1,430');
    await expect(page.getByTestId('job-slip')).toContainText('Why it moved');
    await expect(page.getByTestId('job-late')).toContainText('7 days late');
    await expect(page.getByTestId('job-late')).toContainText('planned Fri 27 Nov');
    await expect(page.getByTestId('job-fresh')).toHaveAttribute('data-tone', 'amber');
    await expect(page.getByTestId('job-fresh')).toContainText('9 days ago');
  });

  test('Alec gets the Today layout with no money anywhere', async ({ page }) => {
    await page.goto('#/jobs/park-rd?as=alec&today=2026-09-17');
    await expect(page.getByTestId('job-today-placeholder')).toBeVisible();
    await expect(page.getByTestId('job-finish')).toContainText('Fri 26 Feb 2027');
    await expect(page.getByTestId('job-slip')).toHaveCount(0);
    await expect(page.getByTestId('job-confirm')).toHaveCount(0);
    await expect(page.getByTestId('job-next-holdpoint')).toBeVisible();
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
    await expect(page.getByTestId('item-row-it-pr-windows')).toContainText('Ordered');
    await expect(page.getByTestId('item-row-it-pr-window-installer')).toContainText('Act by');
    await expect(page.getByTestId('step-mark-done')).toBeVisible();
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
