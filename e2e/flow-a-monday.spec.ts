import { expect, test } from '@playwright/test';

// UI_PLAN flow a: Dom and Norm open the Monday screen. Today is Thu 17 Sep 2026,
// so last Monday's snapshot is 14 Sep. Runs at both projects (phone cards, desktop table).

test.describe('Flow a: the Monday screen', () => {
  test('Dom sees every job with forecast, slip, waiting-on and freshness', async ({ page }) => {
    await page.goto('#/monday?as=dom&today=2026-09-17');

    // Header (flow a, step 2).
    await expect(page.getByTestId('monday-week')).toHaveText("Week of Mon 14 Sep. Compared with Monday's forecast.");

    // Park Rd: finish Fri 26 Feb 2027, equal to the 14 Sep snapshot, so slip 0.
    await expect(page.getByTestId('monday-finish-park-rd')).toContainText('Fri 26 Feb 2027');
    await expect(page.getByTestId('monday-slip-park-rd')).toContainText('0');
    await expect(page.getByTestId('monday-slip-park-rd')).not.toContainText('days');
    await expect(page.getByTestId('monday-holding-park-rd')).toContainText('$4,500/wk');
    await expect(page.getByTestId('monday-fresh-park-rd')).toHaveText('Last confirmed 2 days ago');
    // Its waiting-on cell lists three items; the decision is with Dom.
    await expect(page.getByTestId('monday-waiting-park-rd').locator('li')).toHaveCount(3);
    await expect(page.getByTestId('monday-item-it-pr-tile-choice')).toContainText('With you');

    // Beatty St: +5 days, $1,430, amber freshness in words.
    await expect(page.getByTestId('monday-finish-beatty')).toContainText('Fri 4 Dec 2026');
    await expect(page.getByTestId('monday-slip-beatty')).toContainText('+5 days');
    await expect(page.getByTestId('monday-slip-beatty')).toContainText('$1,430');
    await expect(page.getByTestId('monday-fresh-beatty')).toContainText('Last confirmed 9 days ago');
    await expect(page.getByTestId('monday-fresh-beatty')).toHaveAttribute('data-tone', 'amber');
    await expect(page.getByTestId('monday-item-it-bt-tiler')).toContainText('expected 5 Oct, 7 days late');

    // Seaview St: slip 0.
    await expect(page.getByTestId('monday-finish-seaview')).toContainText('Fri 29 Oct 2027');
    await expect(page.getByTestId('monday-slip-seaview')).toContainText('0');
    await expect(page.getByTestId('monday-slip-seaview')).not.toContainText('days');

    // The table fits the desktop viewport with no horizontal scroll.
    // (A string expression: the e2e tsconfig has no DOM lib.)
    const overflow = (await page.evaluate('document.documentElement.scrollWidth - window.innerWidth')) as number;
    expect(overflow).toBeLessThanOrEqual(0);

    // Builds sort by slip cost, so Beatty is first.
    const rows = page.locator('[data-testid^="monday-row-"]');
    await expect(rows.first()).toHaveAttribute('data-testid', 'monday-row-beatty');

    // Design jobs: stage and outstanding items in place of dates (step 8).
    await expect(page.getByTestId('monday-stage-west-st')).toHaveText('With council');
    await expect(page.getByTestId('monday-outstanding-west-st')).toContainText('2 outstanding, oldest 23 days');
    await expect(page.getByTestId('monday-outstanding-tollbar')).toContainText('1 outstanding, 8 days');
    await expect(page.getByTestId('monday-outstanding-lower-beach')).toHaveText('Nothing outstanding');
    await expect(page.getByTestId('monday-outstanding-john-st')).toContainText('1 outstanding, 4 days');

    // Tap a row (not a link inside it) to open the job.
    await page.getByTestId('monday-row-seaview').click({ position: { x: 5, y: 5 } });
    await expect(page).toHaveURL(/#\/jobs\/seaview$/);
    await page.goBack();
    await expect(page.getByTestId('monday-week')).toBeVisible();

    // The toggle reads slip against the original plan.
    await page.getByTestId('monday-since-plan').click();
    await expect(page.getByTestId('monday-week')).toContainText('Compared with the original plan.');
    await expect(page.getByTestId('monday-slip-beatty')).toContainText('+7 days');
    await expect(page.getByTestId('monday-slip-beatty')).toContainText('$2,000');
    await page.getByTestId('monday-since-monday').click();
    await expect(page.getByTestId('monday-slip-beatty')).toContainText('+5 days');

    // Tap the slip figure: "Why it moved" names the tiler first (step 5, on Beatty).
    await page.getByTestId('monday-slip-beatty').click();
    await expect(page).toHaveURL(/#\/jobs\/beatty\/why/);
    await expect(page.getByTestId('why-entry-1')).toContainText('Book tiler expected 5 Oct, needed 28 Sep');
    await expect(page.getByTestId('why-link-it-bt-tiler')).toHaveAttribute('href', '#/items/it-bt-tiler');
    await expect(page.getByTestId('why-entry-2')).toContainText('Tiling, whole stage starts 5 Oct, not 28 Sep (+7 days)');
    await expect(page.getByTestId('why-link-bt-tiling')).toHaveAttribute('href', '#/steps/bt-tiling');
    const entries = page.locator('[data-testid^="why-entry-"]');
    await expect(entries.last()).toContainText("Finish 4 Dec, 5 days later than Monday's snapshot (29 Nov)");
    await expect(page.getByTestId('why-finish')).toContainText('Fri 4 Dec 2026');
    await expect(page.getByTestId('why-slip')).toContainText('+5 days');
    await expect(page.getByTestId('why-slip')).toContainText('$1,430');

    // Against the plan, the last line names the plan.
    await page.getByTestId('why-since-plan').click();
    await expect(entries.last()).toContainText('Finish 4 Dec, 7 days later than planned (27 Nov)');

    // A job with slip 0 says so.
    await page.goto('#/jobs/park-rd/why');
    await expect(page.getByTestId('why-nothing')).toContainText("Nothing moved since Monday's forecast (14 Sep)");
    await expect(page.getByTestId('why-nothing')).toContainText('Fri 26 Feb 2027');
  });

  test('Norm sees the same with a side switcher, and the Norm side is empty', async ({ page }) => {
    await page.goto('#/monday?as=norm&today=2026-09-17&side=side-nd');
    await expect(page.getByTestId('dev-side')).toBeVisible();
    await expect(page.getByTestId('monday-finish-park-rd')).toContainText('Fri 26 Feb 2027');
    await expect(page.getByTestId('monday-slip-beatty')).toContainText('+5 days');

    await page.goto('#/monday?as=norm&today=2026-09-17&side=side-norm');
    await expect(page.getByTestId('monday-empty')).toHaveText('No jobs on this side yet.');
    await expect(page.locator('[data-testid^="monday-row-"]')).toHaveCount(0);
  });

  test('Alec cannot reach the Monday screen and sees no money', async ({ page }) => {
    await page.goto('#/monday?as=alec&today=2026-09-17');
    await expect(page.locator('[data-testid^="monday-row-"]')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('$');
  });
});
