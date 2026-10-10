/**
 * Stage 6a: full-page screenshots of the v1-look screens at 390 and 1280, next to the
 * v1 references (e2e/screenshots/v1-ref-*.png, taken from the prototype). Git-ignored.
 * Fails on sideways page scroll.
 */
import { expect, test } from '@playwright/test';

const WIDTHS = [
  { w: 390, h: 844 },
  { w: 1280, h: 800 },
];
const SCREENS = [
  { name: 'overview', hash: '#/', ready: 'overview-card-park-rd' },
  { name: 'job-park-rd', hash: '#/jobs/park-rd', ready: 'job-progress' },
  { name: 'job-beatty', hash: '#/jobs/beatty', ready: 'job-progress' },
  { name: 'waiting', hash: '#/waiting', ready: 'waiting-row-it-sv-pump' },
  { name: 'shipments-park-rd', hash: '#/jobs/park-rd/shipments', ready: 'shipment-row-sh-pr-windows' },
];

for (const { w, h } of WIDTHS) {
  for (const s of SCREENS) {
    test(`screenshot ${s.name} at ${w}`, async ({ page }, info) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(`./${s.hash}`);
      await page.getByTestId(s.ready).waitFor();
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${s.name} scrolls sideways at ${w}px`).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `e2e/screenshots/${info.project.name}-6a-${s.name}-${w}.png`, fullPage: true });
    });
  }
  test(`screenshot the job switcher open at ${w}`, async ({ page }, info) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('./#/jobs/park-rd');
    await page.getByTestId('job-progress').waitFor();
    await page.getByTestId('job-switcher').click();
    await expect(page.getByRole('listbox', { name: 'Switch job' })).toBeVisible();
    await page.waitForTimeout(400); // the 240ms morph
    await page.screenshot({ path: `e2e/screenshots/${info.project.name}-6a-job-switcher-${w}.png` });
  });
}
