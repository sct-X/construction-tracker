import { expect, test } from '@playwright/test';

/**
 * Dom's brief, change 1: once in a job, a dropdown at the top of every job
 * page lists every job, so a partner switches straight to another without
 * going back to Overview. The current job's name is the title and the
 * selected value. Partners, admin and the builder; site job pages keep a
 * plain title. Today is Thu 17 Sep 2026.
 */

type Page = import('@playwright/test').Page;
const switcher = (page: Page) => page.getByTestId('job-switcher');
const menu = (page: Page) => page.getByTestId('job-switcher-menu');
/** The title is a button that opens a glass listbox; the current job is its data-value and the aria-selected option. */
const expectCurrent = (page: Page, id: string) => expect(switcher(page)).toHaveAttribute('data-value', id);
async function pick(page: Page, id: string) {
  await switcher(page).click();
  await expect(menu(page)).toBeVisible();
  await page.getByTestId(`job-switcher-${id}`).click();
}

test.describe('Job switcher', () => {
  test('Dom switches Park Rd to Seaview from the Program page and lands on Seaview\'s Program', async ({ page }) => {
    await page.goto('#/jobs/park-rd/program?as=dom&side=side-nd&today=2026-09-17');
    await expect(page.locator('h1')).toHaveText('64-66 Park Rd');
    await expectCurrent(page, 'park-rd');
    // The heading still reads as the job's name; the button says what it does.
    await expect(switcher(page)).toHaveAccessibleName('64-66 Park Rd');
    await expect(switcher(page)).toHaveAccessibleDescription('Switch job');
    await expect(switcher(page)).toHaveAttribute('aria-haspopup', 'listbox');
    await expect(switcher(page)).toHaveAttribute('aria-expanded', 'false');

    await pick(page, 'seaview');
    await expect(page).toHaveURL(/#\/jobs\/seaview\/program$/);
    await expect(page.getByTestId('program')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('31 Seaview St');
    await expectCurrent(page, 'seaview');
  });

  test('the list is every job on the side, builds first then design jobs', async ({ page }) => {
    await page.goto('#/jobs/park-rd?as=dom&side=side-nd&today=2026-09-17');
    await switcher(page).click();
    await expect(switcher(page)).toHaveAttribute('aria-expanded', 'true');
    const ids = await menu(page).getByRole('option').evaluateAll((os) => os.map((o) => o.getAttribute('data-value')));
    expect(ids.slice(0, 2)).toEqual(['park-rd', 'seaview']);
    expect(ids).toContain('west-st');
    const groups = await menu(page).getByRole('group').evaluateAll((gs) => gs.map((g) => g.getAttribute('data-group')));
    expect(groups).toEqual(['Builds', 'Design']);
    // The current job is selected (with a checkmark); overdue counts are words.
    await expect(menu(page).getByRole('option', { selected: true })).toHaveAttribute('data-value', 'park-rd');
    await expect(page.getByTestId('job-switcher-park-rd').locator('.job-menu__check')).toHaveCount(1);
    await expect(menu(page).getByRole('option', { name: /\(\d+ overdue\)$/ }).first()).toBeVisible();
  });

  test('switching from Shipments to a design job opens its checklist', async ({ page }) => {
    await page.goto('#/jobs/park-rd/shipments?as=dominic&side=side-nd&today=2026-09-17');
    await expectCurrent(page, 'park-rd');
    await pick(page, 'west-st');
    await expect(page).toHaveURL(/#\/jobs\/west-st$/);
    await expect(page.getByTestId('checklist')).toBeVisible();
    await expectCurrent(page, 'west-st');
  });

  test('every job page carries it: overview, program, shipments, photos, notes', async ({ page }) => {
    for (const path of ['', '/program', '/shipments', '/photos', '/notes']) {
      await page.goto(`#/jobs/park-rd${path}?as=norm&side=side-nd&today=2026-09-17`);
      await expectCurrent(page, 'park-rd');
    }
    // A shipment's own page keeps its back link to the job's Shipments tab.
    await page.goto('#/jobs/park-rd/shipments/sh-park-windows?as=norm&side=side-nd&today=2026-09-17');
    await expect(page.locator('.page-header__back')).toHaveAttribute('href', '#/jobs/park-rd/shipments');
  });

  test('Raff gets the switcher too, and it keeps him on the same page', async ({ page }) => {
    await page.goto('#/jobs/park-rd/program?as=raff&today=2026-09-17');
    await expect(page.getByTestId('program')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('64-66 Park Rd');
    await expectCurrent(page, 'park-rd');
    await pick(page, 'beatty');
    await expect(page).toHaveURL(/#\/jobs\/beatty\/program$/);
    await expectCurrent(page, 'beatty');
    await page.goto('#/jobs/park-rd/shipments?as=raff&today=2026-09-17');
    await expectCurrent(page, 'park-rd');
  });

  test('keyboard: the title opens the menu, arrows and Enter switch, Escape closes and gives focus back', async ({ page }) => {
    await page.goto('#/jobs/park-rd/program?as=dom&side=side-nd&today=2026-09-17');
    await expect(page.getByTestId('program')).toBeVisible();
    await switcher(page).focus();
    await page.keyboard.press('Enter');
    await expect(menu(page)).toBeVisible();
    await expect(switcher(page)).toHaveAttribute('aria-expanded', 'true');
    // Focus lands on the current job.
    await expect(page.getByTestId('job-switcher-park-rd')).toBeFocused();

    // Escape closes and focus returns to the title.
    await page.keyboard.press('Escape');
    await expect(menu(page)).toHaveCount(0);
    await expect(switcher(page)).toBeFocused();
    await expect(switcher(page)).toHaveAttribute('aria-expanded', 'false');

    // Arrow down opens it too; End, Home, type-ahead move; Enter picks.
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('job-switcher-park-rd')).toBeFocused();
    await page.keyboard.press('End');
    await expect(menu(page).getByRole('option').last()).toBeFocused();
    await page.keyboard.press('Home');
    await expect(menu(page).getByRole('option').first()).toBeFocused();
    await page.keyboard.type('bea');
    await expect(page.getByTestId('job-switcher-beatty')).toBeFocused();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('job-switcher-seaview')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/jobs\/seaview\/program$/);
    await expect(page.locator('h1')).toHaveText('31 Seaview St');
    await expectCurrent(page, 'seaview');
    // The new page's title takes focus back.
    await expect(switcher(page)).toBeFocused();
  });

  test('a tap outside closes the menu without switching', async ({ page }) => {
    await page.goto('#/jobs/park-rd?as=dom&side=side-nd&today=2026-09-17');
    await switcher(page).click();
    await expect(menu(page)).toBeVisible();
    // The page's own gutter: nothing there takes focus, so focus goes back to the title.
    await page.mouse.click(4, 600);
    await expect(menu(page)).toHaveCount(0);
    await expectCurrent(page, 'park-rd');
    await expect(page).toHaveURL(/#\/jobs\/park-rd/);
    await expect(switcher(page)).toBeFocused();
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
