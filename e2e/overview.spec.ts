/**
 * Stage 6a: the Overview (home, timing first) in mock and api mode: each seeded
 * job shows its stage, its next steps with dates and its waiting-on items; no
 * finish, slip or money anywhere; freshness in words; the shell (sidebar,
 * phone tab bar, side switcher, dev bar in mock mode only).
 */
import { expect, test } from '@playwright/test';
import { card, isMock, openOverview } from './helpers';

test('the Overview shows each seeded job: stage, next steps with dates, waiting-on, freshness', async ({ page }) => {
  await openOverview(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();

  const park = card(page, 'park-rd');
  await expect(park.getByTestId('card-stage')).toHaveText('Lock-up');
  await expect(park.getByTestId('card-overdue')).toHaveText('!4 overdue');
  const steps = park.getByTestId('card-next').getByRole('listitem');
  await expect(steps).toHaveCount(3);
  await expect(park.getByTestId('card-step-pr-roof-plumbing')).toContainText('Under way, until Thu 17 Sep');
  await expect(park.getByTestId('card-step-pr-stormwater')).toContainText('Stormwater drainage');
  await expect(park.getByTestId('card-step-pr-stormwater')).toContainText('Mon 21 Sep, in 4 days');
  const waits = park.getByTestId('card-waiting').getByRole('listitem');
  await expect(waits).toHaveCount(3);
  await expect(waits.first()).toContainText('Glazing energy compliance certificate');
  await expect(waits.first()).toContainText('Act by Mon 10 Aug, overdue by 5 weeks');
  await expect(park.getByTestId('card-fresh')).toHaveText('Last confirmed 2 days ago');

  const seaview = card(page, 'seaview');
  await expect(seaview.getByTestId('card-stage')).toHaveText('Slab');
  await expect(seaview.getByTestId('card-step-sv-slab-insp')).toContainText('Mon 28 Sep, in 11 days, hold point, 1 of 3 photo sets');
  await expect(seaview.getByTestId('card-wait-it-sv-pump')).toContainText('Act by Fri 18 Sep, tomorrow');

  const beatty = card(page, 'beatty');
  await expect(beatty.getByTestId('card-stage')).toHaveText('Rough-in');
  await expect(beatty.getByTestId('card-fresh')).toHaveText('Not confirmed for 9 days');
  await expect(beatty.getByTestId('card-overdue')).toHaveText('Nothing overdue');
  await expect(beatty.getByTestId('card-wait-it-bt-tiler')).toContainText('Expected Mon 5 Oct, in 2 weeks, 7 days after needed');

  // Timing first: no forecast finish, slip, money or Why it moved on the home screen.
  const all = page.getByTestId('overview-screen');
  for (const banned of ['$', 'Forecast finish', 'Why it moved', 'Fri 26 Feb 2027', 'slip']) await expect(all).not.toContainText(banned);
});

test('design jobs sit below by oldest outstanding; With council reads Pending approval', async ({ page }) => {
  await openOverview(page);
  const design = page.getByTestId('overview-design');
  await expect(design.locator('[data-testid^="overview-card-"]')).toHaveCount(4);
  await expect(design.locator('[data-testid^="overview-card-"]').first()).toHaveAttribute('data-testid', 'overview-card-west-st');
  const west = card(page, 'west-st');
  await expect(west.getByTestId('card-stage')).toHaveText('Pending approval');
  await expect(west).toContainText('2 outstanding, oldest 23 days');
  await expect(card(page, 'tollbar')).toContainText('1 outstanding, oldest 8 days');
  await expect(card(page, 'lower-beach')).toContainText('Nothing outstanding');
  await expect(card(page, 'john-st')).toContainText('1 outstanding, oldest 4 days');
});

test('a card opens its job; the job first page is timing first', async ({ page }) => {
  await openOverview(page);
  await card(page, 'park-rd').getByRole('link', { name: 'Park Rd' }).click();
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
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 250);
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
  await openOverview(page);
  if (!isMock(info)) {
    await expect(page.getByRole('region', { name: 'Demo controls' })).toHaveCount(0);
    return;
  }
  const bar = page.getByRole('region', { name: 'Demo controls' });
  await expect(bar.getByLabel('Today is')).toHaveValue('2026-09-17');
  await bar.getByLabel('Today is').fill('2026-09-18');
  await expect(card(page, 'park-rd').getByTestId('card-step-pr-stormwater')).toContainText('Mon 21 Sep, in 3 days');
  await page.reload();
  await expect(card(page, 'park-rd').getByTestId('card-step-pr-stormwater')).toContainText('Mon 21 Sep, in 3 days');
  await bar.getByRole('button', { name: 'Reset' }).click();
  await expect(card(page, 'park-rd').getByTestId('card-step-pr-stormwater')).toContainText('Mon 21 Sep, in 4 days');
  await expect(card(page, 'beatty').getByTestId('card-fresh')).toHaveText('Not confirmed for 9 days');
});
