import { expect, test, type Page } from '@playwright/test';

// Stage 4, part A: the waiting-on list (UI_PLAN 3.8) and the item sheet (3.10).
// Today is Thu 17 Sep 2026. Runs at both projects (phone and desktop).

async function reset(page: Page) {
  await page.getByTestId('dev-reset').click();
}

test.describe('Waiting-on list as Raff', () => {
  test('groups render and the windows items are overdue in words', async ({ page }) => {
    await page.goto('#/waiting?owner=me&as=raff&today=2026-09-17');
    await expect(page.getByTestId('waiting-on')).toBeVisible();
    await expect(page.getByTestId('waiting-filter-mine')).toHaveAttribute('aria-pressed', 'true');

    for (const key of ['overdue', 'this-week', 'next-week', 'later', 'done']) {
      await expect(page.getByTestId(`waiting-group-${key}`)).toHaveCount(1);
    }
    // Windows: act by Mon 10 Aug (2 Nov minus 12 weeks), ordered but not confirmed, so overdue.
    const overdue = page.getByTestId('waiting-group-overdue');
    await expect(overdue).toContainText('Overdue');
    const windows = overdue.getByTestId('item-row-it-pr-windows');
    await expect(windows).toBeVisible();
    await expect(overdue).toContainText('10 Aug');
    await expect(overdue).toContainText('5 weeks ago');
    await expect(windows).toContainText('Ordered or booked');
    await expect(overdue.getByTestId('item-row-it-pr-sliding-doors')).toBeVisible();

    // Every row's button is a real tap target on the phone.
    const box = await page.getByTestId('item-advance-it-pr-windows').boundingBox();
    expect(box).not.toBeNull();
    if (test.info().project.name === 'phone') expect(box!.height).toBeGreaterThanOrEqual(56);

    // Raff's list holds only his items: Dominic's glazing certificate is not here.
    await expect(page.getByTestId('item-row-it-pr-glazing-cert')).toHaveCount(0);
    await expect(page.getByTestId('waiting-add')).toHaveAttribute('href', '#/items/new');
  });

  test('advancing an item changes its status word and moves it between groups', async ({ page }) => {
    await page.goto('#/waiting?owner=me&as=raff&today=2026-09-17');
    const button = page.getByTestId('item-advance-it-pr-windows');
    await expect(button).toHaveText('Mark confirmed');
    await button.click();

    // Confirmed: the acting is done, so it is grouped by when it is expected (Mon 26 Oct): Later.
    const later = page.getByTestId('waiting-group-later');
    await expect(later.getByTestId('item-row-it-pr-windows')).toContainText('Confirmed');
    await expect(page.getByTestId('waiting-group-overdue').getByTestId('item-row-it-pr-windows')).toHaveCount(0);

    await expect(button).toHaveText('Mark done');
    await button.click();
    await expect(page.getByTestId('item-advance-it-pr-windows')).toHaveCount(0);
    const done = page.getByTestId('waiting-group-done');
    await expect(done).toContainText('Done');
    await done.locator('summary').click();
    await expect(done.getByTestId('item-row-it-pr-windows')).toBeVisible();
    await expect(done.getByTestId('item-row-it-pr-windows')).toContainText('Done');

    await reset(page);
    await expect(page.getByTestId('waiting-group-overdue').getByTestId('item-row-it-pr-windows')).toBeVisible();
  });

  test('a decision goes straight to done, and the job filter narrows the list', async ({ page }) => {
    await page.goto('#/waiting?as=dom&today=2026-09-17');
    await expect(page.getByTestId('item-advance-it-pr-tile-choice')).toHaveText('Mark done');
    await page.getByTestId('waiting-filter-job-seaview').click();
    await expect(page).toHaveURL(/job=seaview/);
    await expect(page.getByTestId('item-row-it-pr-tile-choice')).toHaveCount(0);
    await expect(page.getByTestId('waiting-add')).toHaveAttribute('href', '#/items/new?job=seaview');
    await page.getByTestId('waiting-filter-all-jobs').click();
    await expect(page.getByTestId('item-row-it-pr-tile-choice')).toBeVisible();
  });
});

test.describe('Item sheet', () => {
  test('editing the lead time moves the act-by date in words', async ({ page }) => {
    await page.goto('#/waiting?owner=me&as=raff&today=2026-09-17');
    await page.getByTestId('item-row-it-pr-windows').click();
    await expect(page).toHaveURL(/#\/items\/it-pr-windows/);
    await expect(page.getByTestId('item-sheet')).toBeVisible();
    await expect(page.getByTestId('item-title')).toHaveValue('Windows');
    await expect(page.getByTestId('item-type-material')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('item-owner-raff')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('item-status-booked')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('item-needed-by')).toContainText('Mon 2 Nov 2026');
    await expect(page.getByTestId('item-needed-by')).toContainText('from step Install windows');
    await expect(page.getByTestId('item-expected')).toContainText('Comes from shipment');
    await expect(page.getByTestId('item-act-by')).toContainText('Act by Mon 10 Aug');
    await expect(page.getByTestId('item-act-by')).toContainText('5 weeks ago');
    await expect(page.getByTestId('item-act-by')).toContainText('minus 12 weeks');
    await expect(page.getByTestId('item-save')).toBeDisabled();

    await page.getByTestId('item-lead-time').fill('10');
    await expect(page.getByTestId('item-act-by')).toContainText('Act by Mon 24 Aug');
    await expect(page.getByTestId('item-act-by')).toContainText('minus 10 weeks');
    await page.getByTestId('item-save').click();
    await expect(page.getByTestId('item-saved')).toHaveText('Saved');
    await expect(page.getByTestId('item-history')).toContainText('Edited Windows');

    // The list reads the saved figure through the calculator.
    await page.goto('#/waiting?owner=me&as=raff&today=2026-09-17');
    await expect(page.getByTestId('waiting-group-overdue')).toContainText('24 Aug');
    await reset(page);
  });

  test('a new manual reminder on Park Rd lands in the list', async ({ page }) => {
    await page.goto('#/items/new?job=park-rd&as=raff&today=2026-09-17');
    await expect(page.getByTestId('item-sheet')).toBeVisible();
    await expect(page.getByTestId('item-job-park-rd')).toHaveAttribute('aria-pressed', 'true');

    // Validation is words, and nothing is saved.
    await page.getByTestId('item-save').click();
    await expect(page.getByTestId('item-problems')).toContainText('Give it a title.');
    await expect(page.getByTestId('item-problems')).toContainText('Pick a step, or set a needed-by date.');

    await page.getByTestId('item-type-manual_reminder').click();
    await page.getByTestId('item-title').fill('Ring the certifier about the OC paperwork');
    await page.getByTestId('item-needed-by').fill('2026-09-25');
    await expect(page.getByTestId('item-act-by')).toContainText('Act by Fri 25 Sep');
    await expect(page.getByTestId('item-act-by')).toContainText('in 8 days');
    await page.getByTestId('item-save').click();

    await expect(page).toHaveURL(/#\/waiting\?job=park-rd/);
    const nextWeek = page.getByTestId('waiting-group-next-week');
    await expect(nextWeek).toContainText('Ring the certifier about the OC paperwork');
    const row = nextWeek.locator('[data-testid^="item-row-"]', { hasText: 'Ring the certifier' });
    await expect(row).toContainText('Reminder');
    await expect(row).toContainText(/with you|you/);
    await reset(page);
    await expect(page.getByText('Ring the certifier about the OC paperwork')).toHaveCount(0);
  });

  test('Dominic can delete an item; Raff cannot', async ({ page }) => {
    await page.goto('#/items/it-pr-insurance?as=raff&today=2026-09-17');
    await expect(page.getByTestId('item-delete')).toHaveCount(0);
    await page.goto('#/items/it-pr-insurance?as=dominic&today=2026-09-17');
    await page.getByTestId('item-delete').click();
    await page.getByTestId('item-delete-confirm').click();
    await expect(page).toHaveURL(/#\/waiting\?job=park-rd/);
    await expect(page.getByTestId('item-row-it-pr-insurance')).toHaveCount(0);
    await reset(page);
    await expect(page.getByTestId('item-row-it-pr-insurance')).toHaveCount(1);
  });

  test('offline, the dates need signal but status still saves', async ({ page }) => {
    await page.goto('#/items/it-pr-insurance?as=raff&today=2026-09-17&offline=1');
    await expect(page.getByTestId('item-needed-by')).toBeDisabled();
    await expect(page.getByTestId('item-expected')).toBeDisabled();
    await expect(page.getByTestId('item-sheet')).toContainText('Needs signal');
    await page.getByTestId('item-status-done').click();
    await page.getByTestId('item-save').click();
    await expect(page.getByTestId('item-saved')).toHaveText('Saved');
    await page.goto('#/items/it-pr-insurance?as=raff&today=2026-09-17&offline=0');
    await reset(page);
  });
});

test.describe('Alec', () => {
  test('never sees a price or a design job on the waiting or item routes', async ({ page }) => {
    for (const route of [
      '#/waiting?as=alec&today=2026-09-17',
      '#/waiting?owner=me&as=alec&today=2026-09-17',
      '#/items/it-pr-windows?as=alec&today=2026-09-17',
      '#/items/new?job=park-rd&as=alec&today=2026-09-17',
    ]) {
      await page.goto(route);
      await expect(page.getByTestId('dev-person')).toBeVisible();
      const text = await page.locator('body').innerText();
      expect(text).not.toContain('$');
      expect(text).not.toContain('West St');
      expect(text).not.toContain('Tollbar');
      // The API scopes him to build jobs' material items; the guard keeps him off this screen entirely.
      await expect(page.getByTestId('item-row-it-pr-tile-choice')).toHaveCount(0);
      await expect(page.getByTestId('item-row-it-pr-insurance')).toHaveCount(0);
    }
  });
});

test.describe('Desktop table', () => {
  test('Dominic gets the extra columns and no sideways page scroll', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'desktop layout only');
    await page.goto('#/waiting?as=dominic&today=2026-09-17');
    const table = page.locator('.waiting__table').first();
    await expect(table).toBeVisible();
    for (const col of ['Item', 'Job', 'Type', 'Waiting on', 'Owner', 'Needed by', 'Act by', 'Lead', 'Expected', 'Status']) {
      await expect(table.locator('thead')).toContainText(col);
    }
    const row = page.getByTestId('item-row-it-pr-windows');
    await expect(row).toContainText('64-66 Park Rd');
    await expect(row).toContainText('Material');
    await expect(row).toContainText('Hangzhou Glazing Co');
    await expect(row).toContainText('Raff');
    await expect(row).toContainText('Mon 2 Nov');
    await expect(row).toContainText('Mon 10 Aug');
    await expect(row).toContainText('12 wk');
    await expect(row).toContainText('Mon 26 Oct');
    await expect(row).toContainText('Ordered or booked');
    await expect(page.getByTestId('waiting-group-overdue')).toContainText('Overdue');
    const fits = await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth');
    expect(fits).toBe(true);
    // Filters are buttons, not selects.
    await expect(page.getByTestId('waiting-filters').locator('select')).toHaveCount(0);
    await expect(page.getByTestId('waiting-filter-owner-raff')).toBeVisible();
  });

  test('the phone gets rows, not a table', async ({ page }) => {
    test.skip(test.info().project.name !== 'phone', 'phone layout only');
    await page.goto('#/waiting?as=dominic&today=2026-09-17');
    await expect(page.locator('.waiting__table')).toHaveCount(0);
    await expect(page.getByTestId('waiting-actby-it-pr-windows')).toContainText('Act by 10 Aug, 5 weeks ago');
  });
});
