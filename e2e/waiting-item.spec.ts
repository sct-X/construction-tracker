import { expect, test, type Page } from '@playwright/test';

// Stage 4, part A: the waiting-on list (UI_PLAN 3.8) and the item sheet (3.10).
// Today is Thu 17 Sep 2026. Runs at both projects (phone and desktop).

async function reset(page: Page) {
  await page.getByTestId('dev-reset').click();
}

test.describe('Waiting-on list as Raff', () => {
  test('one list in three groups; the windows, ordered on time, wait under Later by their expected date', async ({ page }) => {
    await page.goto('#/waiting?owner=me&as=raff&today=2026-09-17');
    await expect(page.getByTestId('waiting-on')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('My items');
    await expect(page.getByTestId('waiting-owner-me')).toHaveAttribute('aria-pressed', 'true');

    // Overdue, This week, Later, in that order, and nothing else.
    const groups = page.locator('[data-testid^="waiting-group-"]');
    await expect(groups).toHaveCount(3);
    expect(await groups.evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')))).toEqual([
      'waiting-group-overdue',
      'waiting-group-this-week',
      'waiting-group-later',
    ]);
    await expect(page.getByTestId('waiting-group-overdue').getByRole('heading')).toContainText('Overdue');
    // Raff's two overdue: the cladding order and the cladders, both needed yesterday with nothing expected.
    await expect(page.getByTestId('waiting-count-overdue')).toHaveText('2');
    await expect(page.getByTestId('item-when-it-pr-cladding')).toHaveAttribute('data-tone', 'late');
    await expect(page.getByTestId('item-when-it-pr-cladding')).toContainText('overdue by 1 day');

    // Windows: ordered, expected from the shipment on Mon 26 Oct, so under Later, in plain words.
    const later = page.getByTestId('waiting-group-later');
    const windows = later.getByTestId('item-row-it-pr-windows');
    await expect(windows).toContainText('Expected Mon 26 Oct, in 5 weeks');
    await expect(page.getByTestId('item-when-it-pr-windows')).toHaveAttribute('data-tone', 'plain');
    await expect(windows).not.toContainText('overdue');
    await expect(later.getByTestId('item-row-it-pr-sliding-doors')).toHaveCount(1);

    // Every row's button is a real tap target on the phone.
    const box = await page.getByTestId('item-advance-it-pr-plasterer').boundingBox();
    expect(box).not.toBeNull();
    if (test.info().project.name === 'phone') expect(box!.height).toBeGreaterThanOrEqual(44);

    // Raff's list holds only his items: Dominic's glazing certificate is not here.
    await expect(page.getByTestId('item-row-it-pr-glazing-cert')).toHaveCount(0);
    await expect(page.getByTestId('waiting-add')).toHaveAttribute('href', '#/items/new');
    // No mode switch and no table, on either width.
    await expect(page.getByTestId('waiting-mode')).toHaveCount(0);
    await expect(page.locator('table')).toHaveCount(0);
  });

  test('advancing an item changes its button, and done takes it off the list', async ({ page }) => {
    await page.goto('#/waiting?owner=me&as=raff&today=2026-09-17');
    const button = page.getByTestId('item-advance-it-pr-windows');
    await expect(button).toHaveText('Mark confirmed');
    await button.click();
    // Confirmed: still grouped by when it is expected (Mon 26 Oct): Later.
    await expect(page.getByTestId('waiting-group-later').getByTestId('item-row-it-pr-windows')).toHaveCount(1);
    await expect(button).toHaveText('Mark done');
    await button.click();
    await expect(page.getByTestId('item-row-it-pr-windows')).toHaveCount(0);

    await reset(page);
    await expect(page.getByTestId('waiting-group-later').getByTestId('item-row-it-pr-windows')).toHaveCount(1);
  });

  test('Mark booked asks for the expected date first, then books with it', async ({ page }) => {
    await page.goto('#/waiting?owner=me&as=raff&today=2026-09-17');
    const button = page.getByTestId('item-advance-it-pr-plasterer');
    await expect(button).toHaveText('Mark booked');
    await button.click();
    // Not booked yet: the date field opens with the reason in words.
    await expect(page.getByTestId('item-date-problem-it-pr-plasterer')).toHaveText('!Ordered or booked needs an expected date.');
    await page.getByTestId('item-date-save-it-pr-plasterer').click();
    // Still to do: saving without a date is refused.
    await expect(page.getByTestId('item-date-input-it-pr-plasterer')).toBeVisible();
    await expect(page.getByTestId('item-row-it-pr-plasterer')).toContainText('Act by Fri 18 Sep');
    await page.getByTestId('item-date-input-it-pr-plasterer').fill('2026-09-23');
    await expect(page.getByTestId('item-date-save-it-pr-plasterer')).toHaveText('Mark booked');
    await page.getByTestId('item-date-save-it-pr-plasterer').click();
    await expect(page.getByTestId('item-row-it-pr-plasterer')).toContainText('Expected Wed 23 Sep, in 6 days');
    await expect(page.getByTestId('item-advance-it-pr-plasterer')).toHaveText('Mark confirmed');
    await reset(page);
  });

  test('Call rings the trade, Set date saves an expected date inline, and reports say requested and received', async ({ page }) => {
    await page.goto('#/waiting?as=dominic&today=2026-09-17');
    // CJ Linea has a number: Call is a tel: link that names who it rings; the council has none.
    const call = page.getByTestId('item-call-it-pr-plasterer');
    await expect(call).toHaveAttribute('href', /^tel:0491\d+$/);
    await expect(call).toHaveText('Call CJ Linea');
    await expect(call).toHaveAttribute('aria-label', /^Call CJ Linea, /);
    await expect(page.getByTestId('item-call-it-pr-sw-council')).toHaveCount(0);
    if (test.info().project.name === 'phone') expect((await call.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    // The shared item flow: a report is requested, then received.
    await expect(page.getByTestId('item-advance-it-pr-glazing-cert')).toHaveText('Mark requested');
    await expect(page.getByTestId('item-advance-it-pr-sw-council')).toHaveText('Mark received');

    // The phone keeps each row to Call and the status step; Set date is on the item sheet there.
    if (test.info().project.name === 'phone') {
      await expect(page.locator('[data-testid^="item-set-date-"]')).toHaveCount(0);
      return;
    }
    // A shipment sets the expected date, so those rows offer no Set date.
    await expect(page.getByTestId('item-set-date-it-pr-windows')).toHaveCount(0);

    await page.getByTestId('item-set-date-it-pr-plasterer').click();
    await page.getByTestId('item-date-input-it-pr-plasterer').fill('2026-09-23');
    await page.getByTestId('item-date-save-it-pr-plasterer').click();
    await expect(page.getByTestId('item-date-input-it-pr-plasterer')).toHaveCount(0);
    await page.goto('#/items/it-pr-plasterer?as=dominic&today=2026-09-17');
    await expect(page.getByTestId('item-expected')).toHaveValue('2026-09-23');
    await expect(page.getByTestId('item-history')).toContainText('expected date set to 23 Sep');
    await reset(page);
  });

  test('offline, Set date needs signal but the status button still works', async ({ page }) => {
    await page.goto('#/waiting?as=raff&owner=me&today=2026-09-17&offline=1');
    await expect(page.getByTestId('item-set-date-it-pr-plasterer')).toHaveCount(0);
    if (test.info().project.name === 'desktop') await expect(page.getByTestId('waiting-group-this-week')).toContainText('Date needs signal');
    // Booking needs a date, and a date needs signal: the plasterer stays to do.
    await page.getByTestId('item-advance-it-pr-plasterer').click();
    await expect(page.getByTestId('item-date-input-it-pr-plasterer')).toBeDisabled();
    await expect(page.getByTestId('item-date-problem-it-pr-plasterer')).toContainText('Needs signal');
    await page.getByTestId('item-date-cancel-it-pr-plasterer').click();
    // A tick that needs no date still saves offline: the booked stormwater plumber is confirmed.
    await expect(page.getByTestId('item-advance-it-pr-sw-plumber')).toHaveText('Mark confirmed');
    await page.getByTestId('item-advance-it-pr-sw-plumber').click();
    await expect(page.getByTestId('item-advance-it-pr-sw-plumber')).toHaveText('Mark done');
    await page.goto('#/waiting?as=raff&owner=me&today=2026-09-17&offline=0');
    await reset(page);
  });

  test('a decision goes straight to done, and the job filter narrows the list', async ({ page }) => {
    await page.goto('#/waiting?as=dom&today=2026-09-17');
    await expect(page.getByTestId('item-advance-it-pr-tile-choice')).toHaveText('Mark done');
    await page.getByTestId('waiting-filter-job').selectOption('seaview');
    await expect(page).toHaveURL(/job=seaview/);
    await expect(page.getByTestId('item-row-it-pr-tile-choice')).toHaveCount(0);
    await expect(page.getByTestId('waiting-add')).toHaveAttribute('href', '#/items/new?job=seaview');
    await page.getByTestId('waiting-filter-job').selectOption('');
    await expect(page.getByTestId('item-row-it-pr-tile-choice')).toBeVisible();
  });
});

test.describe('Item sheet', () => {
  test('editing the lead time moves the act-by date in words', async ({ page }) => {
    await page.goto('#/waiting?owner=me&as=raff&today=2026-09-17');
    // The whole row opens the item sheet.
    await page.getByTestId('item-open-it-pr-windows').click();
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
    // Ordered: the act-by is spent, not overdue.
    await expect(page.getByTestId('item-act-by')).toContainText('5 weeks ago');
    await expect(page.getByTestId('item-act-by')).not.toContainText('overdue');
    await expect(page.getByTestId('item-act-by')).toContainText('minus 12 weeks');
    await expect(page.getByTestId('item-save')).toBeDisabled();

    await page.getByTestId('item-lead-time').fill('10');
    await expect(page.getByTestId('item-act-by')).toContainText('Act by Mon 24 Aug');
    await expect(page.getByTestId('item-act-by')).toContainText('minus 10 weeks');
    await page.getByTestId('item-save').click();
    await expect(page.getByTestId('item-saved')).toHaveText('Saved');
    await expect(page.getByTestId('item-history')).toContainText('Edited Windows');

    // The calculator reads the saved figure back.
    await page.goto('#/items/it-pr-windows?as=raff&today=2026-09-17');
    await expect(page.getByTestId('item-act-by')).toContainText('Act by Mon 24 Aug');
    await reset(page);
  });

  test('Ordered or booked is refused without an expected date, in words, and saves once it has one', async ({ page }) => {
    await page.goto('#/items/it-pr-plasterer?as=dominic&today=2026-09-17');
    await expect(page.getByTestId('item-status-to_do')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('item-status-booked').click();
    await page.getByTestId('item-save').click();
    await expect(page.getByTestId('item-problems')).toHaveText('Ordered or booked needs an expected date.');
    await expect(page.getByTestId('item-saved')).toHaveCount(0);
    await page.getByTestId('item-expected').fill('2026-09-23');
    await page.getByTestId('item-save').click();
    await expect(page.getByTestId('item-saved')).toHaveText('Saved');
    await page.goto('#/items/it-pr-plasterer?as=dominic&today=2026-09-17');
    await expect(page.getByTestId('item-status-booked')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('item-expected')).toHaveValue('2026-09-23');
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
    // Act by Fri 25 Sep is next week: under Later.
    const later = page.getByTestId('waiting-group-later');
    await expect(later).toContainText('Ring the certifier about the OC paperwork');
    const row = later.locator('[data-testid^="item-row-"]', { hasText: 'Ring the certifier' });
    await expect(row).toContainText('Act by Fri 25 Sep, in 8 days');
    await expect(row).toContainText('with you');
    await reset(page);
    await expect(page.getByText('Ring the certifier about the OC paperwork')).toHaveCount(0);
  });

  test('an item with its own late expected date says so on the sheet, and a defect offers a photo', async ({ page }) => {
    await page.goto('#/items/it-bt-tiler?as=dominic&today=2026-09-17');
    await expect(page.getByTestId('item-late')).toContainText('Expected Mon 5 Oct');
    await expect(page.getByTestId('item-late')).toContainText('Expected Mon 5 Oct, in 2 weeks, 7 days after needed');
    // Expected after needed, both dates ahead: plain words, never the late red.
    await expect(page.getByTestId('item-late')).toHaveAttribute('data-tone', 'plain');

    await page.goto('#/items/it-pr-defect-tile?as=dominic&today=2026-09-17');
    await expect(page.getByTestId('item-photo-link')).toBeVisible();
    await page.getByTestId('item-photo-clear').click();
    await expect(page.getByTestId('item-photo-take')).toHaveAttribute('href', '#/jobs/park-rd/upload?item=it-pr-defect-tile');
    await expect(page.locator('[data-testid^="item-photo-pick-"]').first()).toBeVisible();
    await page.locator('[data-testid^="item-photo-pick-"]').first().click();
    await expect(page.getByTestId('item-photo-link')).toBeVisible();
    await page.getByTestId('item-cancel').click();
  });

  test('Dominic and Dom can delete an item; Raff cannot', async ({ page }) => {
    await page.goto('#/items/it-pr-insurance?as=raff&today=2026-09-17');
    await expect(page.getByTestId('item-delete')).toHaveCount(0);
    await page.goto('#/items/it-pr-insurance?as=dom&today=2026-09-17');
    await expect(page.getByTestId('item-delete')).toBeVisible();
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

test.describe('One list for everyone', () => {
  test('the Overdue group holds exactly what the Overview counts', async ({ page }) => {
    await page.goto('#/overview?as=dominic&today=2026-09-17');
    await expect(page.getByTestId('overview-overdue-park-rd')).toHaveText('!4 overdue');
    const counts = await page.locator('[data-testid^="overview-overdue-"]').allInnerTexts();
    const total = counts.reduce((n, t) => n + Number(t.match(/\d+/)![0]), 0);
    await page.goto('#/waiting?as=dominic&today=2026-09-17');
    await expect(page.getByTestId('waiting-count-overdue')).toHaveText(String(total));
    await expect(page.getByTestId('waiting-group-overdue').locator('[data-testid^="item-row-"]')).toHaveCount(total);
    // Every overdue row is red and says overdue; no row outside the group is red.
    await expect(page.getByTestId('waiting-group-overdue').locator('[data-tone="late"]')).toHaveCount(total);
    await expect(page.locator('[data-tone="late"]')).toHaveCount(total);
    await expect(page.getByTestId('item-row-it-pr-glazing-cert')).toContainText('Act by Mon 10 Aug, overdue by 5 weeks');
  });

  test('the same rows on both widths, no sideways scroll, and minimal filters', async ({ page }) => {
    await page.goto('#/waiting?as=dominic&today=2026-09-17');
    await expect(page.locator('table')).toHaveCount(0);
    const row = page.getByTestId('item-row-it-pr-windows');
    await expect(row).toContainText('Windows');
    await expect(row).toContainText('64-66 Park Rd');
    await expect(row).toContainText('waiting on HiHaus');
    await expect(row).toContainText('with Raff');
    await expect(row).toContainText('Expected Mon 26 Oct');
    const fits = await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth');
    expect(fits).toBe(true);
    // Filters: whose (a segmented control) and one job menu.
    await expect(page.getByTestId('waiting-filters').locator('select')).toHaveCount(1);
    await expect(page.getByTestId('waiting-owner-all')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('waiting-owner-me').click();
    await expect(page).toHaveURL(/owner=me/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('My items');
    await expect(page.getByTestId('item-row-it-pr-windows')).toHaveCount(0);
    await page.getByTestId('waiting-owner-all').click();
    await expect(page).not.toHaveURL(/owner=/);
    await expect(page.getByTestId('item-row-it-pr-windows')).toHaveCount(1);
  });

  test('an old Call mode link shows the list', async ({ page }) => {
    await page.goto('#/waiting?mode=call&as=dominic&today=2026-09-17');
    await expect(page.getByTestId('waiting-on')).toBeVisible();
    await expect(page.getByTestId('waiting-group-overdue')).toBeVisible();
    await expect(page.getByTestId('waiting-mode')).toHaveCount(0);
    await expect(page.locator('[data-testid^="call-item-"]')).toHaveCount(0);
    await page.goto('#/calls?as=dom&today=2026-09-17');
    await expect(page).toHaveURL(/#\/waiting/);
    await expect(page).not.toHaveURL(/mode=call/);
    await expect(page.getByTestId('waiting-group-overdue')).toBeVisible();
  });
});
