/**
 * Stage 4a smoke, in both data layers: job overview, program (Gantt on a desktop,
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

    test(`job overview: Park Rd and Beatty St (${w})`, async ({ page }, info) => {
      await page.goto('./#/jobs/beatty');
      await expect(page.getByTestId('ov-slip')).toHaveText('+5 days');
      await expect(page.getByTestId('ov-slip-cost')).toHaveText('$1,430');
      await expect(page.getByTestId('ov-freshness')).toHaveText('Not confirmed for 9 days');
      await page.goto('./#/jobs/park-rd');
      await expect(page.getByTestId('ov-finish')).toHaveText('Fri 26 Feb 2027');
      await expect(page.getByTestId('ov-slip')).toHaveText('On track');
      await expect(page.getByTestId('ov-hold')).toContainText('Stormwater inspection');
      await expect(page.getByTestId('ov-waiting-row')).toHaveCount(5);
      await shoot(page, info, 'overview', w);
    });

    test(`program: Gantt on a desktop, look-ahead on a phone (${w})`, async ({ page }, info) => {
      await page.goto('./#/jobs/beatty/program');
      await expect(page.getByTestId('program-sub')).toContainText('Fri 4 Dec 2026');
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
      await expect(hold).toContainText('1 of 3 categories have a photo');
      await expect(hold).toContainText('Plumbing under slab; Membrane and termite barrier');
      await expect(page.getByTestId('job-bar').getByRole('link', { name: 'Program' })).toHaveAttribute('aria-current', 'page');
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

    test(`nav: job tabs, job switcher and More fit at ${w}`, async ({ page }) => {
      await page.goto('./#/jobs/park-rd/program');
      const tabs = page.getByRole('navigation', { name: 'Park Rd pages' }).getByRole('link');
      await expect(tabs).toHaveText(['Overview', 'Program', 'Waiting on', 'Photos', 'Notes']);
      // Every tab is fully inside the viewport (no cut-off "Notes" on a phone).
      for (const t of await tabs.all()) {
        const box = (await t.boundingBox())!;
        expect(box.x + box.width).toBeLessThanOrEqual(w);
      }
      if (w < 761) {
        await page.getByTestId('job-switcher').selectOption('beatty');
        await expect(page).toHaveURL(/#\/jobs\/beatty\/program$/);
        const nav = page.getByRole('navigation', { name: 'Main' });
        await nav.getByRole('button', { name: 'More' }).click();
        await nav.getByRole('link', { name: 'Changes' }).click();
        await expect(page).toHaveURL(/#\/history$/);
      } else {
        await page.getByRole('list', { name: 'Jobs on this side' }).getByRole('link', { name: 'Beatty St' }).click();
        await expect(page).toHaveURL(/#\/jobs\/beatty\/program$/);
        await page.getByRole('list', { name: 'Jobs on this side' }).getByRole('link', { name: /West St/ }).click();
        await expect(page).toHaveURL(/#\/jobs\/west-st\/checklist$/);
      }
    });
  });
}

test('side switcher away from a job goes back to the jobs list', async ({ page }) => {
  await page.goto('./#/jobs/park-rd');
  await expect(page.getByTestId('ov-finish')).toHaveText('Fri 26 Feb 2027');
  await page.getByTestId('side-switcher').selectOption({ label: 'Norm' });
  await expect(page).toHaveURL(/#\/jobs$/);
  await page.getByTestId('side-switcher').selectOption({ label: 'Norm and Dom' });
});
