import { expect, test } from '@playwright/test';

// UI_PLAN flow a, reworked: Dom and Norm open the overview. Today is Thu 17 Sep 2026.
// No forecast finish, no slip, no money anywhere: stage, next steps, waiting on, freshness.
// Runs at both projects (phone cards, desktop table).

test.describe('Flow a: the overview', () => {
  test('Dom sees every job with stage, next steps, waiting-on and freshness, and never a side name', async ({ page }) => {
    await page.goto('#/overview?as=dom&today=2026-09-17');

    // Park Rd: in Lock-up, the next steps with their dates, three waiting-on lines, fresh.
    const park = page.getByTestId('job-row-park-rd');
    await expect(park).toBeVisible();
    await expect(page.getByTestId('overview-stage-park-rd')).toHaveText('Lock-up');
    const next = page.getByTestId('overview-next-park-rd');
    await expect(next.locator('li')).toHaveCount(3);
    await expect(next.locator('li').first()).toContainText('under way');
    await expect(page.getByTestId('overview-step-pr-stormwater')).toContainText('Mon 21 Sep');
    await expect(page.getByTestId('overview-waiting-park-rd').locator('li')).toHaveCount(3);
    await expect(page.getByTestId('overview-item-it-pr-tile-choice')).toContainText('With you');
    await expect(page.getByTestId('overview-fresh-park-rd')).toHaveText('Last confirmed 2 days ago');

    // Beatty St: the tiler is the top waiting-on line with its lateness in words; freshness is quiet words, never amber.
    await expect(page.getByTestId('overview-stage-beatty')).toHaveText('Rough-in');
    await expect(page.getByTestId('overview-item-it-bt-tiler')).toContainText('expected 5 Oct, in 2 weeks, 7 days after needed');
    await expect(page.getByTestId('overview-fresh-beatty')).toContainText('Last confirmed 9 days ago');
    await expect(page.getByTestId('overview-fresh-beatty')).toHaveAttribute('data-tone', 'muted');

    // The red cue: only a job with something past its date carries "N overdue", as a late chip.
    // Park Rd (tile choice needed 14 Sep, glazing certificate act-by gone, both still to do) is the only one:
    // every booking carries an expected date, so a booked plumber, council request or timber order is never overdue.
    await expect(page.getByTestId('overview-overdue-park-rd')).toHaveText('!2 overdue');
    await expect(page.getByTestId('overview-overdue-park-rd')).toHaveAttribute('data-tone', 'late');
    await expect(park).toHaveAttribute('data-overdue', '2');
    await expect(page.getByTestId('overview-overdue-seaview')).toHaveCount(0);
    // Beatty's tiler is expected after it is needed (a future clash), not past its date: no cue, no red line.
    await expect(page.getByTestId('overview-overdue-beatty')).toHaveCount(0);
    await expect(page.getByTestId('job-row-beatty')).not.toHaveAttribute('data-overdue', /.*/);
    await expect(page.locator('[data-testid="overview-waiting-beatty"] .overview__item--late')).toHaveCount(0);
    // The overdue line itself is red and says so.
    const tile = page.locator('.overview__item--late', { has: page.getByTestId('overview-item-it-pr-tile-choice') });
    await expect(tile).toContainText('overdue by 3 days');
    // Design jobs have nothing past its date and no amber: the oldest item is plain words.
    await expect(page.locator('[data-testid^="overview-overdue-"]')).toHaveCount(1);
    await expect(page.locator('#root [data-tone="amber"]')).toHaveCount(0);

    // Seaview St: the slab inspection is a hold point with empty photo sets.
    await expect(page.getByTestId('overview-stage-seaview')).toHaveText('Slab');
    await expect(page.getByTestId('overview-step-sv-slab-insp')).toContainText('Mon 28 Sep, in 11 days, 2 photo sets empty');

    // Design jobs: stage and outstanding items (step 8).
    await expect(page.getByTestId('overview-stage-west-st')).toContainText('Pending approval');
    await expect(page.getByTestId('overview-outstanding-west-st')).toContainText('2 outstanding, oldest 23 days');
    await expect(page.getByTestId('overview-outstanding-tollbar')).toContainText('1 outstanding, oldest 8 days');
    await expect(page.getByTestId('overview-outstanding-lower-beach')).toHaveText('Nothing outstanding');
    await expect(page.getByTestId('overview-outstanding-john-st')).toContainText('1 outstanding, oldest 4 days');

    // Nothing on the page is a finish date, a slip or a dollar, and Dom never sees which side he is on.
    const text = await page.locator('#root').innerText();
    expect(text).not.toContain('$');
    expect(text).not.toMatch(/Forecast|Slip|26 Feb 2027|4 Dec 2026/);
    expect(text).not.toContain('Norm and Dom');
    await expect(page.getByTestId('side-switcher')).toHaveCount(0);

    // The table fits the desktop viewport with no horizontal scroll.
    const overflow = (await page.evaluate('document.documentElement.scrollWidth - window.innerWidth')) as number;
    expect(overflow).toBeLessThanOrEqual(0);

    // Builds keep the side's order: Park Rd, Seaview, Beatty.
    const rows = page.locator('[data-testid^="job-row-"]');
    await expect(rows.nth(0)).toHaveAttribute('data-testid', 'job-row-park-rd');
    await expect(rows.nth(2)).toHaveAttribute('data-testid', 'job-row-beatty');

    // Tap a row (not a link inside it) to open the job; a step link opens the step.
    await page.getByTestId('job-row-seaview').click({ position: { x: 5, y: 5 } });
    await expect(page).toHaveURL(/#\/jobs\/seaview$/);
    await page.goBack();
    await page.getByTestId('overview-step-pr-stormwater').click();
    await expect(page).toHaveURL(/#\/steps\/pr-stormwater$/);
  });

  test("Norm switches sides: the Norm side lists his Eastwood jobs with Pino's items", async ({ page }) => {
    await page.goto('#/overview?as=norm&today=2026-09-17&side=side-nd');
    await expect(page.getByTestId('side-switcher')).toBeVisible();
    await expect(page.getByTestId('overview-stage-park-rd')).toHaveText('Lock-up');

    await page.goto('#/overview?as=norm&today=2026-09-17&side=side-norm');
    await expect(page.getByTestId('overview-stage-hunts-12')).toHaveText('Lock-up');
    await expect(page.getByTestId('overview-stage-north-rd')).toHaveText('First floor');
    await expect(page.getByTestId('overview-item-it-h12-windows')).toContainText('expected 28 Sep, in 11 days, 7 days after needed');
    await expect(page.getByTestId('job-row-park-rd')).toHaveCount(0);
    // Back to the main side so the persisted session does not leak.
    await page.goto('#/overview?as=norm&today=2026-09-17&side=side-nd');
    await expect(page.getByTestId('job-row-park-rd')).toBeVisible();
  });

  test('Alec reaches the overview, sees builds only and no money', async ({ page }) => {
    await page.goto('#/overview?as=alec&today=2026-09-17');
    await expect(page.getByTestId('job-row-park-rd')).toBeVisible();
    await expect(page.locator('[data-testid^="job-row-"]')).toHaveCount(3);
    await expect(page.locator('body')).not.toContainText('$');
  });
});
