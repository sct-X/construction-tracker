/**
 * api-change project only (runs after the api project, against the same server):
 * apply the Park Rd windows ETA change the way the bot will after Confirm, then
 * the Monday screen must show the new finish, slip, cost and why it moved.
 * Retry-safe: the change is only applied if the ETA is not already 16 Nov.
 * Stage 2 swaps the apply-op call for a real bot flow.
 */
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { buildRow, openMonday } from './helpers';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.E2E_PORT || 4310);
const DATA_DIR = process.env.E2E_DATA_DIR || join(tmpdir(), `ct-e2e-${PORT}`);

async function parkRdWindowsEta(request: APIRequestContext): Promise<string | null> {
  const res = await request.post('api/rpc/getShipments', { data: { args: [] } });
  expect(res.ok()).toBe(true);
  const { result } = (await res.json()) as { result: { shipmentId: string; eta: string | null }[] };
  return result.find((s) => s.shipmentId === 'sh-pr-windows')?.eta ?? null;
}

/** `npm run apply-op`, minus npm: node runs tsx directly, so it works on Windows too (no npm.cmd spawn). */
function applyOp(op: string, args: unknown): void {
  const tsx = join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  execFileSync(
    process.execPath,
    [tsx, '--tsconfig', join(ROOT, 'packages', 'server', 'tsconfig.json'), join(ROOT, 'packages', 'server', 'scripts', 'apply-op.ts'), op, JSON.stringify(args)],
    { cwd: ROOT, env: { ...process.env, DATA_DIR, CT_TODAY: '2026-09-17' }, stdio: 'pipe' },
  );
}

test('windows ETA moved to 16 Nov: Park Rd +14 days, $9,000, and why it moved names the ETA', async ({ page, request }) => {
  const eta = await parkRdWindowsEta(request);
  if (eta !== '2026-11-16') {
    expect(eta).toBe('2026-10-26');
    await openMonday(page);
    await expect(buildRow(page, 'park-rd').getByTestId('slip')).toHaveText('On track');
    applyOp('set_shipment_eta', { shipment: 'windows', job: 'Park Rd', eta: '16 Nov' });
    await page.reload();
  } else {
    await openMonday(page);
  }

  const park = buildRow(page, 'park-rd');
  await expect(park.getByTestId('finish')).toHaveText('Fri 12 Mar 2027');
  await expect(park.getByTestId('slip')).toHaveText('+14 days');
  await expect(park.getByTestId('slip-cost')).toHaveText('$9,000');
  const cause = park.getByTestId('why-it-moved').getByTestId('why-cause');
  await expect(cause).toHaveCount(1);
  await expect(cause).toContainText('+14 days');
  await expect(cause).toContainText('Park Rd windows, ETA Mon 26 Oct → Mon 16 Nov');
  // Park Rd now costs the most this week, so it leads the builds.
  await expect(page.locator('[data-testid^="build-row-"]').first()).toHaveAttribute('data-testid', 'build-row-park-rd');
});
