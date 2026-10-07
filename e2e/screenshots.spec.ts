/** Full-page screenshots of each screen at phone and desktop width, for a human look. Git-ignored. */
import { test } from '@playwright/test';
import { skipIfPending } from './helpers';

const WIDTHS = [
  { w: 390, h: 844 },
  { w: 1280, h: 900 },
];
const SCREENS = [
  { name: 'monday', hash: '#/', ready: 'build-row-park-rd' },
  { name: 'jobs', hash: '#/jobs', ready: 'job-row-park-rd' },
];

for (const { w, h } of WIDTHS) {
  for (const s of SCREENS) {
    test(`screenshot ${s.name} at ${w}`, async ({ page }, info) => {
      skipIfPending(info);
      await page.setViewportSize({ width: w, height: h });
      await page.goto(`./${s.hash}`);
      await page.getByTestId(s.ready).waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `e2e/screenshots/${info.project.name}-${s.name}-${w}.png`, fullPage: true });
    });
  }
}
