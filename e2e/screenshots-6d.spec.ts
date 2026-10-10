/**
 * Stage 6d: full-page screenshots of Photos, Daily notes and Changes in the v1 look at 390 and
 * 1280, next to the v1 references (e2e/screenshots/v1-ref-{photos-park-rd,notes-park-rd,activity}-*.png,
 * taken from the prototype). The Setup screens are shot by stage5-setup.spec.ts
 * (<project>-setup-*-1280.png and the phone message at 390). Git-ignored. Fails on sideways page scroll.
 */
import { expect, test } from '@playwright/test';

const WIDTHS = [
  { w: 390, h: 844 },
  { w: 1280, h: 800 },
];
const SCREENS = [
  { name: 'photos-park-rd', hash: '#/jobs/park-rd/photos', ready: 'photo-stage-pr-st-slab' },
  { name: 'photos-seaview', hash: '#/jobs/seaview/photos', ready: 'hold-progress' },
  { name: 'notes-park-rd', hash: '#/jobs/park-rd/notes', ready: 'note-dn-pr-0917' },
  { name: 'history', hash: '#/history', ready: 'history-cs-0915-tiler' },
];

for (const { w, h } of WIDTHS) {
  for (const s of SCREENS) {
    test(`screenshot ${s.name} at ${w}`, async ({ page }, info) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(`./${s.hash}`);
      await page.getByTestId(s.ready).first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${s.name} scrolls sideways at ${w}px`).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `e2e/screenshots/${info.project.name}-6d-${s.name}-${w}.png`, fullPage: true });
    });
  }
  test(`screenshot a photo full size at ${w}`, async ({ page }, info) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('./#/jobs/park-rd/photos');
    await page.getByTestId('photo-stage-pr-st-slab').getByRole('button', { name: /^Open photo/ }).first().click();
    await expect(page.getByTestId('lightbox')).toBeVisible();
    await expect(page.getByTestId('lightbox').getByTestId('view-received')).toBeVisible();
    await page.screenshot({ path: `e2e/screenshots/${info.project.name}-6d-photo-view-${w}.png` });
  });
}
