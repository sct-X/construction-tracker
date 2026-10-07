/**
 * api-change project only (runs after the api project, against the same server):
 * SPEC flow a through the real bot (packages/server/scripts/bot-change.ts: grammY
 * with a fake Telegram transport and a scripted model) on the e2e DATA_DIR, then
 * the Monday screen must show the new finish, slip, cost and why it moved.
 * Retry-safe: the bot step only runs if the ETA is not already 16 Nov.
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

/**
 * Dominic texts "Park Rd windows now arriving 16 Nov" and presses Confirm on the card.
 * node runs tsx directly, so it works on Windows too (no npm.cmd spawn). Returns the card text.
 */
function botFlowA(): string {
  const tsx = join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const out = execFileSync(
    process.execPath,
    [tsx, '--tsconfig', join(ROOT, 'packages', 'server', 'tsconfig.json'), join(ROOT, 'packages', 'server', 'scripts', 'bot-change.ts')],
    { cwd: ROOT, env: { ...process.env, DATA_DIR, CT_TODAY: '2026-09-17' }, stdio: 'pipe', encoding: 'utf8' },
  );
  const r = JSON.parse(out) as { ok: boolean; card: string; saved: string };
  expect(r.ok, r.saved).toBe(true);
  return r.card;
}

test('windows ETA moved to 16 Nov: Park Rd +14 days, $9,000, and why it moved names the ETA', async ({ page, request }) => {
  const eta = await parkRdWindowsEta(request);
  if (eta !== '2026-11-16') {
    expect(eta).toBe('2026-10-26');
    await openMonday(page);
    await expect(buildRow(page, 'park-rd').getByTestId('slip')).toHaveText('On track');
    const card = botFlowA();
    expect(card).toContain('Install windows starts Mon 16 Nov (was Mon 2 Nov)');
    expect(card).toContain('Finish Fri 12 Mar 2027 (was Fri 26 Feb 2027)');
    expect(card).toContain('Slip +14 days, $9,000');
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
  // The source is Dominic's Telegram message, quoted.
  await expect(cause).toContainText('Park Rd windows now arriving 16 Nov');
  // Park Rd now costs the most this week, so it leads the builds.
  await expect(page.locator('[data-testid^="build-row-"]').first()).toHaveAttribute('data-testid', 'build-row-park-rd');
});
