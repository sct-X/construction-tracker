/**
 * The Overview (home, timing first) in mock and api mode: v1's final card per
 * seeded job (name, stage bar, stage, "! N overdue"; Dom's D8/D9); no finish,
 * slip or money anywhere; the job first page holds the detail; the shell (sidebar,
 * phone tab bar, side switcher, dev bar in mock mode only).
 */
import { expect, test } from '@playwright/test';
import { card, isMock, openOverview } from './helpers';

test("the Overview shows v1's final card for each seeded job: name, stage bar, stage, overdue cue", async ({ page }) => {
  await openOverview(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();

  const park = card(page, 'park-rd');
  await expect(park.getByTestId('card-stage')).toHaveText('Lock-up');
  await expect(park.getByTestId('card-overdue')).toHaveText('!4 overdue');
  await expect(park.getByTestId('card-bar')).toHaveAttribute('aria-label', 'Stage 5 of 8, Lock-up');
  // Nothing else on the card (Dom's D9): the job page holds next steps, waiting-on and freshness.
  await expect(park).toHaveText('Park RdLock-up!4 overdue');

  await expect(card(page, 'seaview').getByTestId('card-stage')).toHaveText('Slab');
  await expect(card(page, 'seaview').getByTestId('card-overdue')).toHaveText('!1 overdue');
  await expect(card(page, 'beatty').getByTestId('card-stage')).toHaveText('Rough-in');
  await expect(card(page, 'beatty').getByTestId('card-overdue')).toHaveText('Nothing overdue');

  // Timing first: no forecast finish, slip, money or Why it moved on the home screen.
  const all = page.getByTestId('overview-screen');
  for (const banned of ['$', 'Forecast finish', 'Why it moved', 'Fri 26 Feb 2027', 'slip']) await expect(all).not.toContainText(banned);
});

test('design jobs sit below by oldest outstanding; With council reads Pending approval', async ({ page }) => {
  await openOverview(page);
  const cards = page.getByTestId('overview-design').locator('[data-testid^="overview-card-"]');
  await expect(cards).toHaveCount(4);
  const ids = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
  expect(ids).toEqual(['overview-card-west-st', 'overview-card-tollbar', 'overview-card-john-st', 'overview-card-lower-beach']);
  await expect(card(page, 'west-st').getByTestId('card-stage')).toHaveText('Pending approval');
  await expect(card(page, 'john-st').getByTestId('card-stage')).toHaveText('Design');
});

test('a card opens its job; the job first page is timing first', async ({ page }) => {
  await openOverview(page);
  await card(page, 'park-rd').click();
  await expect(page).toHaveURL(/#\/jobs\/park-rd$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Park Rd' })).toBeVisible();
  await expect(page.getByTestId('job-stage')).toHaveText('Lock-up');
  await expect(page.getByTestId('job-stage-of')).toHaveText('Stage 5 of 8');
  await expect(page.getByTestId('job-next-hold')).toContainText('Stormwater inspection');
  await expect(page.getByTestId('job-overdue-count')).toHaveText('4');
  await expect(page.getByTestId('job-trades')).toContainText('Mon 21 Sep, in 4 days');
  await expect(page.locator('main')).not.toContainText('$');
});

test('desktop sidebar: the main links and Setup from the route table, the current one marked', async ({ page }) => {
  await openOverview(page);
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link')).toHaveText(['Overview', 'Waiting on', 'Shipments', 'Changes']);
  await expect(page.getByRole('navigation', { name: 'Setup' }).getByRole('link')).toHaveText(['New job', 'Programs', 'Templates', 'Trades']);
  await expect(nav.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('link', { name: 'Waiting on' }).click();
  await expect(page).toHaveURL(/#\/waiting$/);
  await expect(nav.getByRole('link', { name: 'Waiting on' })).toHaveAttribute('aria-current', 'page');
  // Old links land on their new homes.
  await page.goto('./#/jobs');
  await expect(page).toHaveURL(/#\/$/);
  await page.goto('./#/chase');
  await expect(page).toHaveURL(/#\/waiting$/);
});

test('phone: a floating glass tab bar (Overview, Waiting on) that minimises on scroll, and Changes in the nav bar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openOverview(page);
  const bar = page.getByRole('navigation', { name: 'Main' });
  await expect(bar.getByRole('link')).toHaveText(['Overview', 'Waiting on']);
  await expect(bar).toHaveClass(/glass/);
  await expect(page.getByTestId('topbar').getByRole('link', { name: 'Changes' })).toBeVisible();
  // A long page (Waiting on with Later open), so scrolling down stops short of the foot.
  await bar.getByRole('link', { name: 'Waiting on' }).click();
  await page.getByTestId('waiting-group-later').locator('summary').click();
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, 250);
  await expect(bar).toHaveAttribute('data-minimised', 'true');
  for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -120);
  await expect(bar).not.toHaveAttribute('data-minimised', 'true');
});

test('side switcher: the Norm side has no jobs', async ({ page }) => {
  await openOverview(page);
  await page.getByTestId('side-switcher').selectOption({ label: 'Norm' });
  await expect(page.getByText('No jobs on this side yet.')).toBeVisible();
  await page.getByTestId('side-switcher').selectOption({ label: 'Norm and Dom' });
  await expect(card(page, 'park-rd')).toBeVisible();
});

test('dev bar appears only in mock mode; Today is moves the dates and Reset puts them back', async ({ page }, info) => {
  await page.goto('./#/jobs/park-rd');
  const trades = page.getByTestId('job-trades');
  await expect(trades).toContainText('Mon 21 Sep, in 4 days');
  if (!isMock(info)) {
    await expect(page.getByRole('region', { name: 'Demo controls' })).toHaveCount(0);
    return;
  }
  const bar = page.getByRole('region', { name: 'Demo controls' });
  await expect(bar.getByLabel('Today is')).toHaveValue('2026-09-17');
  await bar.getByLabel('Today is').fill('2026-09-18');
  await expect(trades).toContainText('Mon 21 Sep, in 3 days');
  await page.reload();
  await expect(page.getByTestId('job-trades')).toContainText('Mon 21 Sep, in 3 days');
  await bar.getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByTestId('job-trades')).toContainText('Mon 21 Sep, in 4 days');
  await expect(page.getByTestId('job-fresh')).toHaveText('Last confirmed 2 days ago');
});
