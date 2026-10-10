/**
 * api-change project only (runs after the api project, against the same server):
 * SPEC flow a through the real bot (packages/server/scripts/bot-change.ts: grammY
 * with a fake Telegram transport and a scripted model) on the e2e DATA_DIR. The
 * bot's confirm card keeps the dry-run finish, slip and $ (SPEC revision 2); the
 * web is timing first, so it must show Install windows on Mon 16 Nov (Program,
 * step detail, the job's Shipments tab) and still no finish or money.
 * Retry-safe: the bot step only runs if the ETA is not already 16 Nov.
 */
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { openOverview } from './helpers';

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

test('windows ETA moved to 16 Nov through the bot: Park Rd Install windows shows Mon 16 Nov', async ({ page, request }) => {
  const eta = await parkRdWindowsEta(request);
  if (eta !== '2026-11-16') {
    expect(eta).toBe('2026-10-26');
    await page.goto('./#/jobs/park-rd/steps/pr-install-windows');
    await expect(page.getByTestId('step-forecast')).toHaveText('Mon 2 Nov to Fri 13 Nov');
    const card = botFlowA();
    // The confirm card keeps the dry-run impact (as Dominic reads it; sent as Telegram HTML).
    expect(card).toContain('Install windows: Mon 2 Nov → Mon 16 Nov');
    expect(card).toContain('Finish Fri 26 Feb 2027 → Fri 12 Mar 2027');
    expect(card).toContain('+14 days · $9,000 holding cost');
    await page.reload();
  }

  // The step page and the Gantt row.
  await page.goto('./#/jobs/park-rd/steps/pr-install-windows');
  await expect(page.getByTestId('step-forecast')).toHaveText(/^Mon 16 Nov to /);
  await page.goto('./#/jobs/park-rd/program');
  await expect(page.getByTestId('g-step-pr-install-windows')).toContainText('Mon 16 Nov');

  // The job's Shipments tab: the new ETA, now after it's needed (v1's plain words, two future dates).
  await page.goto('./#/jobs/park-rd/shipments');
  const ship = page.getByTestId('shipment-row-sh-pr-windows');
  await expect(ship.getByTestId('eta')).toHaveText('16 Nov 2026');
  await expect(ship.getByTestId('timing')).toHaveText('ETA 2 weeks after needed');

  // Waiting on: the windows are expected Mon 16 Nov.
  await page.goto('./#/jobs/park-rd/waiting');
  await page.getByTestId('waiting-group-later').locator('summary').click();
  await expect(page.getByTestId('waiting-row-it-pr-windows').getByTestId('when')).toContainText('Expected Mon 16 Nov');

  // The Overview stays timing first: no finish, slip or money even after a slip.
  await openOverview(page);
  for (const banned of ['$', 'Fri 12 Mar 2027', '+14 days', 'Why it moved']) await expect(page.getByTestId('overview-screen')).not.toContainText(banned);
});
