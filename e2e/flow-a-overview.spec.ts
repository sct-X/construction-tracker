import { expect, test } from '@playwright/test';

// UI_PLAN flow a, reworked: Dom and Norm open the overview. Today is Thu 17 Sep 2026.
// No forecast finish, no slip, no money anywhere: each job's stage bar and its overdue count.
// Runs at both projects (phone column, desktop grid of the same cards).

test.describe('Flow a: the overview', () => {
  test('Dom sees every job as a card: its name, a stage bar with the current stage named, and the overdue count, never a side name', async ({ page }) => {
    await page.goto('#/overview?as=dom&today=2026-09-17');

    // Park Rd: in Lock-up, stage 5 of its 8 on the bar, and 4 overdue in red.
    const park = page.getByTestId('job-row-park-rd');
    await expect(park).toBeVisible();
    await expect(page.getByTestId('overview-stage-park-rd')).toHaveText('Lock-up');
    const bar = page.getByTestId('overview-bar-park-rd');
    await expect(bar).toHaveAttribute('aria-label', 'Stage 5 of 8, Lock-up');
    await expect(bar.locator('[data-state]')).toHaveCount(8);
    await expect(bar.locator('[data-state="current"]')).toHaveCount(1);
    await expect(bar.locator('[data-state="done"]')).toHaveCount(4);

    // The card carries nothing else: no items, next steps or freshness.
    await expect(park).not.toContainText('Last confirmed');
    await expect(park).not.toContainText('Tile choice');

    // The red cue: only a job with something past its date carries "N overdue".
    // Park Rd: the tile choice and glazing certificate (act-by gone, still to do), and the cladder and
    // cladding (needed and expected by 16 Sep, still not ticked off). Every booking carries an expected
    // date, so a booked plumber, council request or timber order is never overdue.
    await expect(page.getByTestId('overview-overdue-park-rd')).toHaveText('!4 overdue');
    await expect(page.getByTestId('overview-overdue-park-rd')).toHaveAttribute('data-tone', 'late');
    await expect(park).toHaveAttribute('data-overdue', '4');
    // Seaview and Beatty (the tiler is expected after it is needed: a future clash) are quiet.
    await expect(page.getByTestId('overview-overdue-seaview')).toHaveCount(0);
    await expect(page.getByTestId('overview-clear-seaview')).toHaveText('Nothing overdue');
    await expect(page.getByTestId('overview-overdue-beatty')).toHaveCount(0);
    await expect(page.getByTestId('job-row-beatty')).not.toHaveAttribute('data-overdue', /.*/);
    // Design jobs have nothing past its date, and nothing is amber.
    await expect(page.locator('[data-testid^="overview-overdue-"]')).toHaveCount(1);
    await expect(page.locator('#root [data-tone="amber"]')).toHaveCount(0);

    await expect(page.getByTestId('overview-stage-seaview')).toHaveText('Slab');
    await expect(page.getByTestId('overview-stage-beatty')).toHaveText('Rough-in');

    // Design jobs: their own stages on the bar, in a Design group below the builds.
    await expect(page.getByTestId('overview-stage-west-st')).toContainText('Pending approval');
    await expect(page.getByTestId('overview-bar-west-st').locator('[data-state]')).toHaveCount(4);
    await expect(page.getByRole('heading', { name: 'Design', exact: true })).toBeVisible();
    for (const id of ['west-st', 'tollbar', 'lower-beach', 'john-st']) await expect(page.getByTestId(`overview-clear-${id}`)).toBeVisible();

    // Nothing on the page is a finish date, a slip or a dollar, and Dom never sees which side he is on.
    const text = await page.locator('#root').innerText();
    expect(text).not.toContain('$');
    expect(text).not.toMatch(/Forecast|Slip|26 Feb 2027|4 Dec 2026/);
    expect(text).not.toContain('Norm and Dom');
    // No all-caps labels.
    const upper = (await page.evaluate(
      "[...document.querySelectorAll('#root *')].filter((e) => getComputedStyle(e).textTransform === 'uppercase').length",
    )) as number;
    expect(upper).toBe(0);
    await expect(page.getByTestId('side-switcher')).toHaveCount(0);

    // The cards fit the viewport with no horizontal scroll.
    const overflow = (await page.evaluate('document.documentElement.scrollWidth - window.innerWidth')) as number;
    expect(overflow).toBeLessThanOrEqual(0);

    // Builds keep the side's order: Park Rd, Seaview, Beatty.
    const rows = page.locator('[data-testid^="job-row-"]');
    await expect(rows.nth(0)).toHaveAttribute('data-testid', 'job-row-park-rd');
    await expect(rows.nth(2)).toHaveAttribute('data-testid', 'job-row-beatty');

    // The whole card opens the job, whose Overdue list holds the same 4.
    await page.getByTestId('job-row-seaview').click();
    await expect(page).toHaveURL(/#\/jobs\/seaview$/);
    await page.goBack();
    await park.click();
    await expect(page).toHaveURL(/#\/jobs\/park-rd$/);
    await expect(page.locator('[data-testid^="job-overdue-it-"]')).toHaveCount(4);
  });

  test("Norm switches sides: the Norm side lists his Eastwood jobs with Pino's items", async ({ page }) => {
    await page.goto('#/overview?as=norm&today=2026-09-17&side=side-nd');
    await expect(page.getByTestId('side-switcher')).toBeVisible();
    await expect(page.getByTestId('overview-stage-park-rd')).toHaveText('Lock-up');

    await page.goto('#/overview?as=norm&today=2026-09-17&side=side-norm');
    await expect(page.getByTestId('overview-stage-hunts-12')).toHaveText('Lock-up');
    await expect(page.getByTestId('overview-stage-north-rd')).toHaveText('First floor');
    await expect(page.getByTestId('overview-bar-hunts-12')).toHaveAttribute('aria-label', /, Lock-up$/);
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
