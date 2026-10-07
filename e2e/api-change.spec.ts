/**
 * api-change project only (runs after the api project, against the same server):
 * apply the Park Rd windows ETA change the way the bot will after Confirm, then
 * the Monday screen must show the new finish, slip, cost and why it moved.
 * Stage 2 swaps the apply-op call for a real bot flow.
 */
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { buildRow, openMonday, skipIfPending } from './helpers';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DATA_DIR = process.env.E2E_DATA_DIR || join(tmpdir(), 'ct-e2e-4310');

test('windows ETA moved to 16 Nov: Park Rd +14 days, $9,000, and why it moved names the ETA', async ({ page }, info) => {
  skipIfPending(info);
  await openMonday(page);
  await expect(buildRow(page, 'park-rd').getByTestId('slip')).toHaveText('On track');

  execFileSync('npm', ['run', 'apply-op', '--', 'set_shipment_eta', JSON.stringify({ shipment: 'windows', job: 'Park Rd', eta: '16 Nov' })], {
    cwd: ROOT,
    env: { ...process.env, DATA_DIR, CT_TODAY: '2026-09-17' },
    stdio: 'pipe',
  });

  await page.reload();
  const park = buildRow(page, 'park-rd');
  await expect(park.getByTestId('finish')).toHaveText('Fri 12 Mar 2027');
  await expect(park.getByTestId('slip')).toHaveText('+14 days');
  await expect(park.getByTestId('slip-cost')).toHaveText('$9,000');
  const cause = park.getByTestId('why-it-moved').getByTestId('why-cause');
  await expect(cause).toHaveCount(1);
  await expect(cause).toContainText('+14 days');
  await expect(cause).toContainText('ETA');
  await expect(cause).toContainText('Mon 26 Oct → Mon 16 Nov');
  // Park Rd now costs the most this week, so it leads the builds.
  await expect(page.locator('[data-testid^="build-row-"]').first()).toHaveAttribute('data-testid', 'build-row-park-rd');
});
