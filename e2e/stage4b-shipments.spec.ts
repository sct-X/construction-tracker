import { expect, test } from '@playwright/test';
import { shootBoth } from './stage4b-helpers';

test('Shipments shows both windows shipments with their jobs, status, ETA and linked items', async ({ page }) => {
  await page.goto('./#/shipments');
  await expect(page.getByRole('heading', { level: 1, name: 'Shipments' })).toBeVisible();
  const park = page.getByTestId('shipment-row-sh-pr-windows');
  await expect(park.getByTestId('ship-job')).toHaveText('Park Rd');
  await expect(park.getByTestId('ship-status')).toHaveText('In production');
  await expect(park.getByTestId('eta')).toHaveText('Mon 26 Oct');
  await expect(park.getByTestId('timing')).toHaveText('7 days to spare');
  await expect(park.getByTestId('linked-items').getByRole('listitem')).toHaveCount(3);
  const sea = page.getByTestId('shipment-row-sh-sv-windows');
  await expect(sea.getByTestId('ship-job')).toHaveText('Seaview St');
  await expect(sea.getByTestId('eta')).toHaveText('Mon 14 Dec');
  await expect(sea.getByTestId('ship-status')).toHaveText('Design');
});

test('screenshots: shipments', async ({ page }, info) => {
  await shootBoth(page, info, 'shipments', '#/shipments', 'shipment-row-sh-pr-windows');
});
