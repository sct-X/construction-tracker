import { expect, test } from '@playwright/test';

/**
 * Dom's brief, change 2: Shipments moves inside the job for partners and
 * admin. Each job page gets a Shipments tab with only that job's shipments,
 * a shipment opened there keeps the job around it, and the ETA change that
 * moves the later steps works from there. Builder and site are unchanged.
 * Today is Thu 17 Sep 2026.
 */

const tabLabels = (page: import('@playwright/test').Page) => page.getByTestId('job-tabs').locator('a').allTextContents();

test.describe('Shipments inside the job', () => {
  test('Norm opens a job\'s Shipments tab and sees only that job\'s shipments', async ({ page }) => {
    await page.goto('#/jobs/hunts-12?as=norm&side=side-norm&today=2026-09-17');
    expect((await tabLabels(page)).map((t) => t.trim())).toEqual(['Overview', 'Program', 'Waiting on', 'Shipments', 'Photos', 'Notes']);
    await page.getByTestId('job-tab-shipments').click();
    await expect(page).toHaveURL(/#\/jobs\/hunts-12\/shipments$/);
    await expect(page.getByTestId('shipments-list')).toBeVisible();
    await expect(page.locator('[data-testid^="shipment-row-"]')).toHaveCount(1);
    await expect(page.getByTestId('shipment-row-sh-hunts12-windows')).toBeVisible();
    await expect(page.getByTestId('shipment-row-sh-hunts14-windows')).toHaveCount(0);
    await expect(page.getByTestId('shipment-row-sh-north-windows')).toHaveCount(0);
    // The side's global list still has all three.
    await page.goto('#/shipments');
    await expect(page.locator('[data-testid^="shipment-row-"]')).toHaveCount(3);
  });

  test('Dominic changes the windows ETA from inside Park Rd and the later steps move', async ({ page }) => {
    await page.goto('#/jobs/park-rd?as=dominic&today=2026-09-17');
    await page.getByTestId('dev-reset').click();
    await page.getByTestId('job-tab-shipments').click();
    await expect(page).toHaveURL(/#\/jobs\/park-rd\/shipments$/);
    await page.getByTestId('shipment-row-sh-park-windows').click({ position: { x: 5, y: 5 } });
    await expect(page).toHaveURL(/#\/jobs\/park-rd\/shipments\/sh-park-windows$/);
    await expect(page.getByTestId('shipment-eta')).toContainText('Mon 26 Oct 2026');

    await page.getByTestId('shipment-eta-input').fill('2026-11-16');
    await expect(page.getByTestId('shipment-eta-preview')).toContainText('Install windows would start Mon 16 Nov, not Mon 2 Nov');
    await page.getByTestId('shipment-save-eta').click();
    await expect(page.getByTestId('shipment-eta')).toContainText('Mon 16 Nov 2026');
    await expect(page.getByTestId('shipment-item-status-it-pr-windows')).toContainText('14 days late');

    // Back goes to the job's Shipments tab, which shows the new ETA.
    await page.locator('.page-header__back').click();
    await expect(page).toHaveURL(/#\/jobs\/park-rd\/shipments$/);
    await expect(page.getByTestId('shipment-eta-sh-park-windows')).toHaveText('16 Nov 2026');
    await expect(page.getByTestId('shipment-timing-sh-park-windows')).toContainText('ETA 2 weeks after needed');

    // The step after it moved.
    await page.goto('#/steps/pr-install-windows');
    await expect(page.getByTestId('step-forecast')).toContainText('Mon 16 Nov 2026');
    await expect(page.getByTestId('step-reason')).toContainText('because the Park Rd windows shipment is expected 16 Nov');

    await page.getByTestId('dev-reset').click();
  });

  test('an old shipment link opens inside its job for a partner', async ({ page }) => {
    await page.goto('#/shipments/sh-park-windows?as=dom&today=2026-09-17');
    await expect(page).toHaveURL(/#\/jobs\/park-rd\/shipments\/sh-park-windows/);
    await expect(page.getByTestId('shipment-detail')).toBeVisible();
    await expect(page.locator('.page-header__back')).toHaveAttribute('href', '#/jobs/park-rd/shipments');
  });

  test('a shipment added on the job\'s tab belongs to that job', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop is enough for the add form');
    await page.goto('#/jobs/park-rd/shipments?as=dominic&today=2026-09-17');
    await page.getByTestId('shipment-add').click();
    await expect(page.locator('[data-testid^="shipment-add-job-"]')).toHaveCount(0);
    await page.getByTestId('shipment-add-name').fill('Park Rd external doors');
    await page.getByTestId('shipment-add-eta').fill('2026-11-20');
    await page.getByTestId('shipment-add-save').click();
    await expect(page).toHaveURL(/#\/jobs\/park-rd\/shipments\/sh-/);
    await expect(page.getByTestId('shipment-job-link')).toHaveText('64-66 Park Rd');
    await page.locator('.page-header__back').click();
    await expect(page.locator('[data-testid^="shipment-row-"]')).toHaveCount(2);
    await page.getByTestId('dev-reset').click();
  });

  test('builder and site job pages have no Shipments tab, and the builder keeps the global detail', async ({ page }) => {
    await page.goto('#/jobs/park-rd?as=raff&today=2026-09-17');
    expect((await tabLabels(page)).map((t) => t.trim())).toEqual(['Overview', 'Program', 'Waiting on', 'Photos', 'Notes']);
    await page.goto('#/shipments/sh-park-windows?as=raff&today=2026-09-17');
    await expect(page).toHaveURL(/#\/shipments\/sh-park-windows/);
    await expect(page.locator('.page-header__back')).toHaveAttribute('href', '#/shipments');

    await page.goto('#/jobs/park-rd?as=alec&today=2026-09-17');
    expect((await tabLabels(page)).map((t) => t.trim())).toEqual(['Today', 'Program', 'Photos', 'Deliveries']);
  });
});
