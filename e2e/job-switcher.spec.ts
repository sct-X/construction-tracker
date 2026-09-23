import { expect, test } from '@playwright/test';

/**
 * Dom's brief, change 1: once in a job, a dropdown at the top of every job
 * page lists every job, so a partner switches straight to another without
 * going back to Overview. The current job's name is the title and the
 * selected value. Partners, admin and the builder; site job pages keep a
 * plain title. Today is Thu 17 Sep 2026.
 */

const switcher = (page: import('@playwright/test').Page) => page.getByTestId('job-switcher');

test.describe('Job switcher', () => {
  test('Dom switches Park Rd to Seaview from the Program page and lands on Seaview\'s Program', async ({ page }) => {
    await page.goto('#/jobs/park-rd/program?as=dom&side=side-nd&today=2026-09-17');
    await expect(page.locator('h1')).toHaveText('64-66 Park Rd');
    await expect(switcher(page)).toHaveValue('park-rd');
    await expect(switcher(page)).toHaveAccessibleName('Switch job');

    await switcher(page).selectOption('seaview');
    await expect(page).toHaveURL(/#\/jobs\/seaview\/program$/);
    await expect(page.getByTestId('program')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('31 Seaview St');
    await expect(switcher(page)).toHaveValue('seaview');
  });

  test('the list is every job on the side, builds first then design jobs', async ({ page }) => {
    await page.goto('#/jobs/park-rd?as=dom&side=side-nd&today=2026-09-17');
    const ids = await switcher(page).locator('option').evaluateAll((os) => os.map((o) => (o as unknown as { value: string }).value));
    expect(ids.slice(0, 2)).toEqual(['park-rd', 'seaview']);
    expect(ids).toContain('west-st');
    const groups = await switcher(page).locator('optgroup').evaluateAll((gs) => gs.map((g) => (g as unknown as { label: string }).label));
    expect(groups).toEqual(['Builds', 'Design']);
  });

  test('switching from Shipments to a design job opens its checklist', async ({ page }) => {
    await page.goto('#/jobs/park-rd/shipments?as=dominic&side=side-nd&today=2026-09-17');
    await expect(switcher(page)).toHaveValue('park-rd');
    await switcher(page).selectOption('west-st');
    await expect(page).toHaveURL(/#\/jobs\/west-st$/);
    await expect(page.getByTestId('checklist')).toBeVisible();
    await expect(switcher(page)).toHaveValue('west-st');
  });

  test('every job page carries it: overview, program, shipments, photos, notes', async ({ page }) => {
    for (const path of ['', '/program', '/shipments', '/photos', '/notes']) {
      await page.goto(`#/jobs/park-rd${path}?as=norm&side=side-nd&today=2026-09-17`);
      await expect(switcher(page)).toHaveValue('park-rd');
    }
    // A shipment's own page keeps its back link to the job's Shipments tab.
    await page.goto('#/jobs/park-rd/shipments/sh-park-windows?as=norm&side=side-nd&today=2026-09-17');
    await expect(page.locator('.page-header__back')).toHaveAttribute('href', '#/jobs/park-rd/shipments');
  });

  test('Raff gets the switcher too, and it keeps him on the same page', async ({ page }) => {
    await page.goto('#/jobs/park-rd/program?as=raff&today=2026-09-17');
    await expect(page.getByTestId('program')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('64-66 Park Rd');
    await expect(switcher(page)).toHaveValue('park-rd');
    await switcher(page).selectOption('beatty');
    await expect(page).toHaveURL(/#\/jobs\/beatty\/program$/);
    await expect(switcher(page)).toHaveValue('beatty');
    await page.goto('#/jobs/park-rd/shipments?as=raff&today=2026-09-17');
    await expect(switcher(page)).toHaveValue('park-rd');
  });

  test('site job pages have no switcher', async ({ page }) => {
    await page.goto('#/jobs/park-rd?as=alec&today=2026-09-17');
    await expect(page.getByTestId('job-overview')).toBeVisible();
    await expect(switcher(page)).toHaveCount(0);
    await page.goto('#/jobs/park-rd/photos?as=alec&today=2026-09-17');
    await expect(page.getByTestId('gallery')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('Photos');
    await expect(switcher(page)).toHaveCount(0);
  });
});
