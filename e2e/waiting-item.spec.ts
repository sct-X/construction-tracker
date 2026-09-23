import { expect, test, type Page } from '@playwright/test';

// Stage 4, part A: the waiting-on list (UI_PLAN 3.8) and the item sheet (3.10).
// Today is Thu 17 Sep 2026. Runs at both projects (phone and desktop).

async function reset(page: Page) {
  await page.getByTestId('dev-reset').click();
}

test.describe('Waiting-on list as Raff', () => {
  test('groups render; the windows, ordered on time, wait under Later by their expected date', async ({ page }) => {
    await page.goto('#/waiting?owner=me&as=raff&today=2026-09-17');
    await expect(page.getByTestId('waiting-on')).toBeVisible();
    await expect(page.getByTestId('waiting-filter-owner')).toHaveValue('me');

    for (const key of ['this-week', 'next-week', 'later', 'done']) {
      await expect(page.getByTestId(`waiting-group-${key}`)).toHaveCount(1);
    }
    // Nothing of Raff's is past its date: every booking carries its expected date, so no Overdue group.
    await expect(page.getByTestId('waiting-group-overdue')).toHaveCount(0);
    // Windows: ordered, expected from the shipment on Mon 26 Oct, so grouped by that date.
    const later = page.getByTestId('waiting-group-later');
    const windows = later.getByTestId('item-row-it-pr-windows');
    await expect(windows).toContainText('Mon 26 Oct');
    await expect(windows).toContainText('Ordered or booked');
    await expect(windows).not.toContainText('overdue');
    await expect(later.getByTestId('item-row-it-pr-sliding-doors')).toHaveCount(1);

    // Every row's button is a real tap target on the phone.
    const box = await page.getByTestId('item-advance-it-pr-plasterer').boundingBox();
    expect(box).not.toBeNull();
    if (test.info().project.name === 'phone') expect(box!.height).toBeGreaterThanOrEqual(56);

    // Raff's list holds only his items: Dominic's glazing certificate is not here.
    await expect(page.getByTestId('item-row-it-pr-glazing-cert')).toHaveCount(0);
    await expect(page.getByTestId('waiting-add')).toHaveAttribute('href', '#/items/new');
  });

  test('advancing an item changes its status word and moves it between groups', async ({ page }) => {
    await page.goto('#/waiting?owner=me&as=raff&today=2026-09-17');
    // On the phone, Later starts folded; open it to reach the row.
    const later = page.getByTestId('waiting-group-later');
    if ((await later.locator('summary').count()) > 0) await later.locator('summary').click();
    const button = page.getByTestId('item-advance-it-pr-windows');
    await expect(button).toHaveText('Mark confirmed');
    await button.click();

    // Confirmed: still grouped by when it is expected (Mon 26 Oct): Later.
    await expect(later.getByTestId('item-row-it-pr-windows')).toContainText('Confirmed');

    await expect(button).toHaveText('Mark done');
    await button.click();
    await expect(page.getByTestId('item-advance-it-pr-windows')).toHaveCount(0);
    const done = page.getByTestId('waiting-group-done');
    await expect(done).toContainText('Done');
    await done.locator('summary').click();
    await expect(done.getByTestId('item-row-it-pr-windows')).toBeVisible();
    await expect(done.getByTestId('item-row-it-pr-windows')).toContainText('Done');

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
    await expect(page.getByTestId('item-row-it-pr-plasterer')).toContainText('To do');
    await page.getByTestId('item-date-save-it-pr-plasterer').click();
    await expect(page.getByTestId('item-row-it-pr-plasterer')).toContainText('To do');
    await page.getByTestId('item-date-input-it-pr-plasterer').fill('2026-09-23');
    await expect(page.getByTestId('item-date-save-it-pr-plasterer')).toHaveText('Mark booked');
    await page.getByTestId('item-date-save-it-pr-plasterer').click();
    await expect(page.getByTestId('item-row-it-pr-plasterer')).toContainText('Ordered or booked');
    await expect(page.getByTestId('item-row-it-pr-plasterer')).toContainText('Wed 23 Sep');
    await reset(page);
  });

  test('Call rings the trade, Set date saves an expected date inline, and reports say requested and received', async ({ page }) => {
    await page.goto('#/waiting?as=dominic&today=2026-09-17');
    // CJ Linea has a number; the council has none.
    await expect(page.getByTestId('item-call-it-pr-plasterer')).toHaveAttribute('href', /^tel:0491/);
    await expect(page.getByTestId('item-call-it-pr-sw-council')).toHaveCount(0);
    // A shipment sets the expected date, so those rows offer no Set date.
    await expect(page.getByTestId('item-set-date-it-pr-windows')).toHaveCount(0);

    await page.getByTestId('item-set-date-it-pr-plasterer').click();
    await page.getByTestId('item-date-input-it-pr-plasterer').fill('2026-09-23');
    await page.getByTestId('item-date-save-it-pr-plasterer').click();
    await expect(page.getByTestId('item-date-input-it-pr-plasterer')).toHaveCount(0);
    await page.goto('#/items/it-pr-plasterer?as=dominic&today=2026-09-17');
    await expect(page.getByTestId('item-expected')).toHaveValue('2026-09-23');
    await expect(page.getByTestId('item-history')).toContainText('expected date set to 23 Sep');

    // The one flow, shared with the call list: a report is requested, then received.
    await page.goto('#/waiting?as=dominic&today=2026-09-17');
    await expect(page.getByTestId('item-advance-it-pr-glazing-cert')).toHaveText('Mark requested');
    await expect(page.getByTestId('item-advance-it-pr-sw-council')).toHaveText('Mark received');
    await reset(page);
  });

  test('offline, Set date needs signal but the status button still works', async ({ page }) => {
    await page.goto('#/waiting?as=raff&owner=me&today=2026-09-17&offline=1');
    await expect(page.getByTestId('item-set-date-it-pr-plasterer')).toHaveCount(0);
    await expect(page.getByTestId('waiting-group-this-week')).toContainText('Date needs signal');
    // Booking needs a date, and a date needs signal: the plasterer stays to do.
    await page.getByTestId('item-advance-it-pr-plasterer').click();
    await expect(page.getByTestId('item-date-input-it-pr-plasterer')).toBeDisabled();
    await expect(page.getByTestId('item-date-problem-it-pr-plasterer')).toContainText('Needs signal');
    await page.getByTestId('item-date-cancel-it-pr-plasterer').click();
    // A tick that needs no date still saves offline: the booked stormwater plumber is confirmed.
    await page.getByTestId('item-advance-it-pr-sw-plumber').click();
    await expect(page.getByTestId('item-row-it-pr-sw-plumber')).toContainText('Confirmed');
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
    // The windows wait under Later, folded on the phone.
    const later = page.getByTestId('waiting-group-later');
    if ((await later.locator('summary').count()) > 0) await later.locator('summary').click();
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
    const nextWeek = page.getByTestId('waiting-group-next-week');
    await expect(nextWeek).toContainText('Ring the certifier about the OC paperwork');
    const row = nextWeek.locator('[data-testid^="item-row-"]', { hasText: 'Ring the certifier' });
    await expect(row).toContainText('Reminder');
    await expect(row).toContainText(/with you|you/);
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

test.describe('Desktop table', () => {
  test('Dominic gets the extra columns and no sideways page scroll', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'desktop layout only');
    await page.goto('#/waiting?as=dominic&today=2026-09-17');
    const table = page.locator('.waiting__table').first();
    await expect(table).toBeVisible();
    // Seven columns: act-by leads; job, type, owner and lead time sit inside the item, waiting-on and act-by cells (asserted on the row below).
    for (const col of ['Act by', 'Item', 'Waiting on', 'Needed by', 'Expected', 'Status']) {
      await expect(table.locator('thead')).toContainText(col);
    }
    const row = page.getByTestId('item-row-it-pr-windows');
    await expect(row).toContainText('64-66 Park Rd');
    await expect(row).toContainText('Material');
    await expect(row).toContainText('HiHaus');
    await expect(row).toContainText('Raff');
    await expect(row).toContainText('Mon 2 Nov');
    await expect(row).toContainText('Mon 10 Aug');
    await expect(row).toContainText('12 wk');
    await expect(row).toContainText('Mon 26 Oct');
    await expect(row).toContainText('Ordered or booked');
    await expect(page.getByTestId('waiting-group-overdue')).toContainText('Overdue');
    // Overdue holds exactly what the Overview counts: the glazing certificate and the tile choice.
    await expect(page.getByTestId('waiting-group-overdue').locator('[data-testid^="item-row-"]')).toHaveCount(2);
    const fits = await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth');
    expect(fits).toBe(true);
    // Filters are dropdowns: owner, job, type; Dominic can pick any person.
    await expect(page.getByTestId('waiting-filters').locator('select')).toHaveCount(3);
    await expect(page.getByTestId('waiting-filter-owner-raff')).toHaveText('Raff');
    await page.getByTestId('waiting-filter-owner').selectOption('raff');
    await expect(page).toHaveURL(/owner=raff/);
    await expect(page.getByTestId('item-row-it-pr-tile-choice')).toHaveCount(0);
  });

  test('the phone gets rows, not a table', async ({ page }) => {
    test.skip(test.info().project.name !== 'phone', 'phone layout only');
    await page.goto('#/waiting?as=dominic&today=2026-09-17');
    await expect(page.locator('.waiting__table')).toHaveCount(0);
    await expect(page.getByTestId('item-row-it-pr-glazing-cert')).toContainText('Act by Mon 10 Aug, overdue by 5 weeks');
    // The strip under the row holds only controls: the button is a tap target and so is Call.
    const call = await page.getByTestId('item-call-it-pr-plasterer').boundingBox();
    expect(call!.height).toBeGreaterThanOrEqual(56);
  });
});
