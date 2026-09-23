import { expect, test } from '@playwright/test';

// UI_PLAN flow d: changing the windows shipment ETA moves Park Rd's finish.
// Dominic, today Thu 17 Sep 2026. Runs at both projects (phone list/cards, desktop table).
// Each test gets a fresh browser context (fresh localStorage), and the test still
// resets through the dev bar at the end so nothing leaks if that ever changes.

test.describe('Flow d: the ETA moves the finish', () => {
  test('Dominic changes the windows ETA and the linked items, the step and the overview follow', async ({ page }) => {
    // 1. Shipments, then "Park Rd windows": In production, ETA 26 Oct, 3 linked items.
    await page.goto('#/shipments?as=dominic&today=2026-09-17');
    await expect(page.getByTestId('shipment-status-text-sh-park-windows')).toHaveText('In production');
    await expect(page.getByTestId('shipment-eta-sh-park-windows')).toHaveText('26 Oct 2026');
    await expect(page.getByTestId('shipment-items-sh-park-windows')).toContainText('3 items');
    await expect(page.getByTestId('shipment-timing-sh-park-windows')).toContainText('ETA 1 week before needed');
    await page.getByTestId('shipment-row-sh-park-windows').click({ position: { x: 5, y: 5 } });
    // Partners and admin open a shipment inside its job (Dom's brief, change 2).
    await expect(page).toHaveURL(/#\/jobs\/park-rd\/shipments\/sh-park-windows$/);

    await expect(page.getByTestId('shipment-eta')).toContainText('Mon 26 Oct 2026');
    await expect(page.getByTestId('shipment-status-in_production')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('shipment-needed-by')).toHaveText('Needed by Mon 2 Nov, in 6 weeks');
    await expect(page.locator('[data-testid^="shipment-item-it-"]')).toHaveCount(3);
    await expect(page.getByTestId('shipment-item-expected-it-pr-windows')).toContainText('Mon 26 Oct');
    await expect(page.getByTestId('shipment-eta-preview')).toHaveCount(0);

    // 2. He picks 16 Nov. 3. The impact panel appears before anything is saved.
    await page.getByTestId('shipment-eta-input').fill('2026-11-16');
    const preview = page.getByTestId('shipment-eta-preview');
    await expect(preview).toContainText('3 linked items would be expected Mon 16 Nov');
    await expect(preview).toContainText('Install windows would start Mon 16 Nov, not Mon 2 Nov');
    // No finish date and no money in the panel.
    await expect(page.getByTestId('shipment-eta-preview-finish')).toHaveCount(0);
    expect(await preview.innerText()).not.toMatch(/Mar 2027|\$/);
    // Nothing saved yet: the hero still says 26 Oct.
    await expect(page.getByTestId('shipment-eta')).toContainText('Mon 26 Oct 2026');

    // 4. Save new ETA. 5. The linked items now read 14 days after needed, expected 16 Nov.
    await page.getByTestId('shipment-save-eta').click();
    await expect(page.getByTestId('shipment-eta')).toContainText('Mon 16 Nov 2026');
    await expect(page.getByTestId('shipment-timing')).toContainText('ETA 2 weeks after needed');
    await expect(page.getByTestId('shipment-eta-preview')).toHaveCount(0);
    for (const id of ['it-pr-windows', 'it-pr-sliding-doors', 'it-pr-glazing-cert']) {
      await expect(page.getByTestId(`shipment-item-expected-${id}`)).toContainText('Mon 16 Nov');
      await expect(page.getByTestId(`shipment-item-status-${id}`)).toContainText('14 days after needed');
    }
    // Expected after needed is a clash between two future dates: plain words, never red.
    await expect(page.getByTestId('shipment-timing')).not.toHaveAttribute('data-tone', 'late');
    await expect(page.getByTestId('shipment-item-status-it-pr-windows').locator('[data-tone]')).toHaveAttribute('data-tone', 'plain');
    // 8. The activity feed records who changed it, from what, to what.
    await expect(page.getByTestId('shipment-history').locator('li').first()).toContainText('Park Rd windows ETA changed 26 Oct to 16 Nov (Dominic)');

    // 6. The waiting-on list carries the lateness in plain words (a future clash is not overdue); the step detail says why it starts 16 Nov.
    await page.goto('#/overview');
    await expect(page.getByTestId('overview-overdue-park-rd')).toHaveText('!4 overdue');
    expect(await page.locator('#root').innerText()).not.toMatch(/Mar 2027|\$/);
    await page.goto('#/steps/pr-install-windows');
    await expect(page.getByTestId('step-forecast')).toContainText('Mon 16 Nov 2026');
    await expect(page.getByTestId('step-reason')).toContainText('because the Park Rd windows shipment is expected 16 Nov');

    // Reset through the dev bar so the seed is back for anyone sharing this storage.
    await page.getByTestId('dev-reset').click();
    await page.goto('#/shipments/sh-park-windows');
    await expect(page.getByTestId('shipment-eta')).toContainText('Mon 26 Oct 2026');
  });

  test('a status change is a button press and Delivered offers to close the items', async ({ page }) => {
    await page.goto('#/shipments/sh-park-windows?as=raff&today=2026-09-17');
    await page.getByTestId('shipment-status-shipped').click();
    await expect(page.getByTestId('shipment-status-shipped')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('shipment-history').locator('li').first()).toContainText('Park Rd windows moved to Shipped');
    await page.getByTestId('shipment-status-delivered').click();
    await expect(page.getByTestId('shipment-offer-done')).toContainText('Mark the 3 linked items done?');
    await page.getByTestId('shipment-mark-items-done').click();
    await expect(page.getByTestId('shipment-offer-done')).toHaveCount(0);
    await expect(page.getByTestId('shipment-item-status-it-pr-windows')).toHaveText('Done');
    await page.getByTestId('dev-reset').click();
  });

  test('Dominic adds a shipment and links and unlinks an item', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop is enough for the add form');
    await page.goto('#/shipments?as=dominic&today=2026-09-17');
    await page.getByTestId('shipment-add').click();
    await page.getByTestId('shipment-add-name').fill('Park Rd external doors');
    await page.getByTestId('shipment-add-supplier').fill('Door supplier');
    await page.getByTestId('shipment-add-job-park-rd').click();
    await page.getByTestId('shipment-add-status-in_production').click();
    await page.getByTestId('shipment-add-eta').fill('2026-11-20');
    await page.getByTestId('shipment-add-save').click();
    await expect(page).toHaveURL(/#\/jobs\/park-rd\/shipments\/sh-/);
    await expect(page.getByTestId('shipment-eta')).toContainText('Fri 20 Nov 2026');
    await expect(page.getByTestId('shipment-status-in_production')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('shipment-timing')).toHaveText('Nothing waiting on it');

    // Link "Order external doors": its expected date now follows the ETA.
    await page.getByTestId('shipment-link-item-it-pr-external-doors').click();
    await expect(page.getByTestId('shipment-item-it-pr-external-doors')).toBeVisible();
    await expect(page.getByTestId('shipment-item-expected-it-pr-external-doors')).toContainText('Fri 20 Nov');
    await expect(page.getByTestId('shipment-link-item-it-pr-external-doors')).toHaveCount(0);
    await expect(page.getByTestId('shipment-timing')).not.toHaveText('Nothing waiting on it');

    // Unlink it again: it goes back to the candidates.
    await page.getByTestId('shipment-unlink-item-it-pr-external-doors').click();
    await expect(page.getByTestId('shipment-item-it-pr-external-doors')).toHaveCount(0);
    await expect(page.getByTestId('shipment-link-item-it-pr-external-doors')).toBeVisible();

    // The list now has two shipments.
    await page.goto('#/shipments');
    await expect(page.locator('[data-testid^="shipment-row-"]')).toHaveCount(2);
    await page.getByTestId('dev-reset').click();
    await expect(page.locator('[data-testid^="shipment-row-"]')).toHaveCount(1);
  });

  test('offline, the ETA and status are read-only', async ({ page }) => {
    await page.goto('#/shipments/sh-park-windows?as=dominic&today=2026-09-17&offline=1');
    await expect(page.getByTestId('shipment-eta-input')).toBeDisabled();
    await expect(page.getByTestId('shipment-status-shipped')).toBeDisabled();
    await expect(page.locator('body')).toContainText('Needs signal');
  });
});
