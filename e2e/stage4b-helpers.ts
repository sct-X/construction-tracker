/** Stage 4b e2e helpers: phone and desktop screenshots that also fail on horizontal page scroll. */
import { expect, type Page, type TestInfo } from '@playwright/test';

export const STAGE4B_SIZES = [
  { w: 390, h: 844 },
  { w: 1280, h: 800 },
];

/** Opens `hash` at each size, waits for `ready`, checks for sideways scroll and saves e2e/screenshots/<project>-<name>-<w>.png. */
export async function shootBoth(page: Page, info: TestInfo, name: string, hash: string, ready: string): Promise<void> {
  for (const { w, h } of STAGE4B_SIZES) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`./${hash}`);
    await page.getByTestId(ready).first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${name} scrolls sideways at ${w}px`).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `e2e/screenshots/${info.project.name}-${name}-${w}.png`, fullPage: true });
    // For a human look at the first screen: STAGE4B_REVIEW=<dir> also saves the viewport alone.
    const review = process.env.STAGE4B_REVIEW;
    if (review) await page.screenshot({ path: `${review}/${info.project.name}-${name}-${w}-fold.png` });
  }
}
