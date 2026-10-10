/**
 * Stage 4a smoke, in both data layers (job first page and job header updated in Stage 6a): job overview, program (Gantt on a desktop,
 * look-ahead on a phone), step detail, design checklist, the job bar and nav.
 * Saves e2e/screenshots/<project>-4a-<screen>-<width>.png and fails on sideways page scroll.
 */
import { expect, test, type Page, type TestInfo } from '@playwright/test';

const SIZES = [
  { w: 390, h: 844 },
  { w: 1280, h: 800 },
];

async function shoot(page: Page, info: TestInfo, name: string, w: number): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name} scrolls sideways at ${w}px`).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `e2e/screenshots/${info.project.name}-4a-${name}-${w}.png`, fullPage: true });
}

for (const { w, h } of SIZES) {
  test.describe(`at ${w}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
    });

    test(`job first page: Park Rd and Beatty St, timing first (${w})`, async ({ page }, info) => {
      await page.goto('./#/jobs/beatty');
      await expect(page.getByTestId('job-stage')).toHaveText('Rough-in');
      await expect(page.getByTestId('job-overdue-none')).toHaveText('Nothing overdue');
      await expect(page.getByTestId('job-fresh')).toHaveText('Not confirmed for 9 days');
      await page.goto('./#/jobs/park-rd');
      await expect(page.getByTestId('job-next-hold')).toContainText('Stormwater inspection');
      await expect(page.getByTestId('job-next-hold')).toContainText('0 of 1 required photo set');
      await expect(page.locator('[data-testid^="job-overdue-it-"]')).toHaveCount(4);
      await expect(page.getByTestId('job-trades').locator('[data-testid^="job-trade-"]')).toHaveCount(3);
      await expect(page.locator('main')).not.toContainText('$');
      await shoot(page, info, 'overview', w);
    });

    test(`program: Gantt on a desktop, look-ahead on a phone (${w})`, async ({ page }, info) => {
      await page.goto('./#/jobs/beatty/program');
      await expect(page.getByTestId('program-sub')).toHaveText('Rough-in. 3 steps later than planned.');
      if (w >= 1000) {
        const gantt = page.getByTestId('gantt');
        await expect(gantt.getByTestId('g-step-bt-tiling')).toContainText('7 days late');
        await expect(page.getByRole('button', { name: 'Gantt' })).toHaveAttribute('aria-pressed', 'true');
        await shoot(page, info, 'program-beatty', w);
        await page.goto('./#/jobs/park-rd/program');
        await expect(page.getByTestId('g-step-pr-install-windows')).toBeVisible();
        await expect(page.getByTestId('g-step-pr-stormwater-insp')).toContainText('Hold point');
        await expect(page.getByTestId('gantt')).toContainText('Today 17 Sep');
        await page.getByRole('button', { name: 'Whole program' }).click();
        await expect(page.getByTestId('gantt')).toContainText('Shutdown');
        await shoot(page, info, 'program', w);
      } else {
        await expect(page.getByRole('button', { name: 'Gantt' })).toBeHidden();
        await expect(page.getByTestId('lookahead')).toBeVisible();
        await shoot(page, info, 'program-beatty', w);
        await page.goto('./#/jobs/park-rd/program');
        const la = page.getByTestId('lookahead');
        await expect(la.getByTestId('la-step-pr-roof-plumbing')).toContainText('Under way');
        await expect(la.getByTestId('la-step-pr-stormwater')).toContainText('Stormwater connection approval: ordered or booked');
        await shoot(page, info, 'program', w);
        await page.getByRole('button', { name: 'Stages' }).click();
        await expect(page.getByTestId('stages-strip')).toContainText('Lock-up');
        await shoot(page, info, 'program-stages', w);
      }
    });

    test(`step detail: Seaview slab inspection hold point (${w})`, async ({ page }, info) => {
      await page.goto('./#/jobs/park-rd/steps/pr-install-windows');
      await expect(page.getByTestId('step-forecast')).toHaveText('Mon 2 Nov to Fri 13 Nov');
      await expect(page.getByTestId('need-it-pr-windows')).toContainText('Mon 26 Oct');
      await shoot(page, info, 'step-windows', w);
      await page.goto('./#/jobs/seaview/steps/sv-slab-insp');
      const hold = page.getByTestId('hold-point');
      await expect(hold).toContainText('1 of 3 required categories have photos');
      await expect(hold).toContainText('Plumbing under slab; Membrane and termite barrier');
      await expect(page.getByTestId('job-tabs').getByRole('link', { name: 'Program' })).toHaveAttribute('aria-current', 'page');
      await expect(page.getByTestId('job-bar').getByTestId('back')).toHaveText('Program');
      await shoot(page, info, 'step', w);
    });

    test(`design checklist: West St (${w})`, async ({ page }, info) => {
      await page.goto('./#/jobs/west-st');
      await expect(page).toHaveURL(/#\/jobs\/west-st\/checklist$/);
      await expect(page.getByTestId('ck-outstanding')).toHaveText('2 items');
      await expect(page.getByTestId('ck-oldest')).toHaveText('23 days');
      await expect(page.getByTestId('ck-stage-2')).toContainText('Current stage');
      await expect(page.getByTestId('ck-item').first()).toContainText('23 days');
      await shoot(page, info, 'checklist', w);
    });

    test(`nav: job tabs fit and the job switcher keeps the tab at ${w}`, async ({ page }) => {
      await page.goto('./#/jobs/park-rd/program');
      const tabs = page.getByRole('navigation', { name: 'Park Rd pages' }).getByRole('link');
      await expect(tabs).toHaveText(['Overview', 'Program', 'Waiting on', 'Shipments', 'Photos', 'Notes']);
      if (w >= 768) {
        // Every tab is fully inside the viewport on a desktop; on a phone the glass capsule scrolls sideways.
        for (const t of await tabs.all()) {
          const box = (await t.boundingBox())!;
          expect(box.x + box.width).toBeLessThanOrEqual(w);
        }
      } else {
        await expect(page.getByTestId('job-tabs')).toHaveClass(/glass/);
      }
      // The job switcher: the title opens a menu of every job on the side, overdue counts in words.
      await page.getByTestId('job-switcher').click();
      const menu = page.getByRole('listbox', { name: 'Switch job' });
      await expect(menu.getByRole('option', { name: /Park Rd/ })).toHaveAttribute('aria-selected', 'true');
      await expect(menu.getByRole('option', { name: /Park Rd/ })).toContainText('(4 overdue)');
      await menu.getByRole('option', { name: 'Beatty St' }).click();
      await expect(page).toHaveURL(/#\/jobs\/beatty\/program$/);
      await expect(page.getByTestId('job-switcher')).toHaveText(/Beatty St/);
      // A design job has no Program: switching lands on its checklist. Keyboard: Escape closes and refocuses.
      await page.getByTestId('job-switcher').click();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('listbox', { name: 'Switch job' })).toHaveCount(0);
      await expect(page.getByTestId('job-switcher')).toBeFocused();
      await page.getByTestId('job-switcher').click();
      await page.getByRole('listbox', { name: 'Switch job' }).getByRole('option', { name: 'West St' }).click();
      await expect(page).toHaveURL(/#\/jobs\/west-st\/checklist$/);
    });
  });
}

test('side switcher away from a job goes back to the jobs list, and the new side sticks', async ({ page }) => {
  await page.goto('./#/jobs/park-rd');
  // The job bar is drawn once the jobs list has arrived: only then is the race (job arriving after the switch) over.
  await expect(page.getByTestId('job-bar')).toContainText('Park Rd');
  await page.getByTestId('side-switcher').selectOption({ label: 'Norm' });
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByText('No jobs on this side yet.')).toBeVisible();
  await expect(page.getByTestId('side-switcher').locator('option:checked')).toHaveText('Norm');
  // Still Norm after anything in flight has landed.
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('side-switcher').locator('option:checked')).toHaveText('Norm');
  await expect(page.getByTestId('overview-card-park-rd')).toHaveCount(0);
});

test('a link to a job on the other side switches to its side', async ({ page }) => {
  await page.goto('./#/');
  await page.getByTestId('side-switcher').selectOption({ label: 'Norm' });
  await expect(page.getByText('No jobs on this side yet.')).toBeVisible();
  await page.goto('./#/jobs/beatty/program');
  await expect(page.getByTestId('job-bar')).toContainText('Beatty St');
  await expect(page.getByTestId('side-switcher').locator('option:checked')).toHaveText('Norm and Dom');
  await expect(page).toHaveURL(/#\/jobs\/beatty\/program$/);
});
