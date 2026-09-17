import { expect, test, type Page } from '@playwright/test';

// Stage 5, part B: the design checklist (UI_PLAN 3.7, rule 9), notifications
// and the activity feed (3.18), the in-app buzz and the bell badge.
// Today is Thu 17 Sep 2026. Runs at both projects (phone and desktop).

async function reset(page: Page) {
  await page.getByTestId('dev-reset').click();
}

test.describe('Design checklist as Dominic', () => {
  test('West St shows 2 outstanding, oldest 23 days, matching the jobs list', async ({ page }) => {
    await page.goto('#/jobs?as=dominic&side=side-nd&today=2026-09-17');
    const listWords = (await page.getByTestId('job-row-west-st').innerText()).replace(/\s+/g, ' ');
    expect(listWords).toContain('2 outstanding, oldest 23 days');

    await page.goto('#/jobs/west-st?as=dominic&today=2026-09-17');
    await expect(page.getByTestId('checklist')).toBeVisible();
    await expect(page.getByTestId('placeholder')).toHaveCount(0);
    await expect(page.getByTestId('checklist-outstanding')).toContainText('2 outstanding, oldest 23 days');
    await expect(page.getByTestId('checklist-path')).toContainText('DA');
    await expect(page.getByTestId('checklist-current')).toContainText('with council');

    // Four DA stages, in order, with the tick state in words on the buttons.
    for (const n of [1, 2, 3, 4]) await expect(page.getByTestId(`checklist-stage-west-st-st-${n}`)).toBeVisible();
    await expect(page.getByTestId('checklist-stage-west-st-st-1')).toHaveAttribute('data-status', 'done');
    await expect(page.getByTestId('checklist-stage-status-west-st-st-2-in_progress')).toHaveAttribute('aria-pressed', 'true');

    // The two open items sit under the current stage with their age in words; done ones are folded.
    const traffic = page.getByTestId('checklist-item-it-ws-traffic');
    await expect(traffic).toContainText('Traffic report');
    await expect(traffic).toContainText('outstanding 23 days');
    await expect(traffic).toContainText('with you');
    await expect(page.getByTestId('checklist-item-it-ws-rfi')).toContainText('outstanding 14 days');
    await expect(page.getByTestId('checklist-item-it-ws-lodge')).toBeHidden();
    await page.getByTestId('checklist-done').locator('summary').click();
    await expect(page.getByTestId('checklist-item-it-ws-lodge')).toBeVisible();
    await expect(page.getByTestId('checklist-add')).toHaveAttribute('href', '#/items/new?job=west-st');
  });

  test('the other design jobs match their jobs-list words', async ({ page }) => {
    const expected: Record<string, string> = {
      tollbar: '1 outstanding, oldest 8 days',
      'lower-beach': 'Nothing outstanding',
      'john-st': '1 outstanding, oldest 4 days',
    };
    for (const [id, words] of Object.entries(expected)) {
      await page.goto(`#/jobs/${id}?as=dominic&today=2026-09-17`);
      await expect(page.getByTestId('checklist-outstanding')).toContainText(words);
      if (id === 'lower-beach') await expect(page.getByTestId('checklist-empty')).toHaveText('Nothing outstanding at this stage.');
      else await expect(page.getByTestId('checklist-empty')).toHaveCount(0);
    }
  });

  test('a stage status set with the buttons persists across a reload', async ({ page }) => {
    await page.goto('#/jobs/west-st?as=dominic&today=2026-09-17');
    await page.getByTestId('checklist-stage-status-west-st-st-2-done').click();
    await expect(page.getByTestId('checklist-stage-west-st-st-2')).toHaveAttribute('data-status', 'done');
    // The next stage is now the current one and the open items move under it.
    await expect(page.getByTestId('checklist-current')).toContainText('approved');
    await expect(page.getByTestId('checklist-stage-west-st-st-3').getByTestId('checklist-item-it-ws-traffic')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('checklist-stage-status-west-st-st-2-done')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('checklist-stage-status-west-st-st-2-in_progress').click();
    await expect(page.getByTestId('checklist-current')).toContainText('with council');
    await reset(page);
  });

  test('a partner reads the stage words and gets no status buttons', async ({ page }) => {
    await page.goto('#/jobs/west-st?as=dom&today=2026-09-17');
    await expect(page.getByTestId('checklist-stage-words-west-st-st-2')).toHaveText('Under way');
    await expect(page.getByTestId('checklist-stage-status-west-st-st-2-done')).toHaveCount(0);
    await expect(page.getByTestId('checklist-outstanding')).toContainText('2 outstanding, oldest 23 days');
  });
});

test.describe('Notifications, the buzz and the bell as Raff', () => {
  test('firing reminders buzzes with the words, counts on the bell, and mark all read clears it', async ({ page }) => {
    await page.goto('#/waiting?owner=me&as=raff&today=2026-09-17');
    await reset(page);
    await expect(page.getByTestId('bell-badge')).toHaveCount(0);
    await expect(page.getByTestId('buzz')).toHaveCount(0);

    await page.getByTestId('dev-fire-reminders').click();
    // Raff owns two late items on 17 Sep: the slab steel and the tiler. The tiler is raised last, so it is the buzz.
    const buzz = page.getByTestId('buzz');
    await expect(buzz).toBeVisible();
    await expect(buzz).toContainText('Book tiler at 26a Beatty St is late: expected 5 Oct, needed 28 Sep');
    await expect(buzz).toContainText('and 1 more');
    await expect(page.getByTestId('buzz-link')).toHaveAttribute('href', '#/items/it-bt-tiler');
    await expect(page.getByTestId('bell-badge')).toHaveText(/2/);
    if (test.info().project.name === 'phone') {
      for (const id of ['buzz-link', 'buzz-dismiss']) expect((await page.getByTestId(id).boundingBox())!.height).toBeGreaterThanOrEqual(56);
    }
    await page.getByTestId('buzz-dismiss').click();
    await expect(buzz).toHaveCount(0);

    await page.getByTestId('nav-notifications').click();
    await expect(page.getByTestId('notifications')).toBeVisible();
    const rows = page.locator('[data-testid^="notification-nt-"]');
    await expect(rows).toHaveCount(3); // the two just raised plus the read one from 7 Sep
    await expect(page.locator('[data-testid^="notification-"][data-read="false"]')).toHaveCount(2);
    await expect(page.getByTestId('notifications-unread')).toHaveText('2 new');
    await expect(page.getByTestId('notifications-list')).toContainText('Order slab steel at 31 Seaview St is late');
    await expect(page.getByTestId('notifications-list')).toContainText('New');
    // The New tag never sits on top of the words (390px once put the text across the tag's column).
    const unreadRow = page.locator('[data-testid^="notification-"][data-read="false"]').first();
    const tag = await unreadRow.locator('.notifications__new').boundingBox();
    const words = await unreadRow.locator('.notifications__text').boundingBox();
    expect(tag && words && (tag.x >= words.x + words.width || tag.y + tag.height <= words.y || words.y + words.height <= tag.y)).toBe(true);

    await page.getByTestId('notifications-mark-all').click();
    await expect(page.locator('[data-testid^="notification-"][data-read="false"]')).toHaveCount(0);
    await expect(page.getByTestId('bell-badge')).toHaveCount(0);
    await expect(page.getByTestId('notifications-unread')).toHaveText('Nothing new');
    await expect(page.getByTestId('notifications-mark-all')).toBeDisabled();

    // Firing again on the same day raises nothing new: one reminder per person, item and day.
    await page.getByTestId('dev-fire-reminders').click();
    await expect(page.getByTestId('buzz')).toHaveCount(0);
    await expect(page.getByTestId('bell-badge')).toHaveCount(0);
    await reset(page);
  });

  test('tapping the buzz link opens the item and marks it read', async ({ page }) => {
    await page.goto('#/monday?as=raff&today=2026-09-17');
    await reset(page);
    await page.getByTestId('dev-fire-reminders').click();
    await page.getByTestId('buzz-link').click();
    await expect(page.getByTestId('item-sheet')).toBeVisible();
    await expect(page.getByTestId('bell-badge')).toHaveText(/1/);
    await reset(page);
  });
});

test.describe('Activity feed as Dominic', () => {
  test('lists the seeded events with who, when and the job, and filters by job', async ({ page }) => {
    await page.goto('#/notifications?as=dominic&today=2026-09-17');
    if (test.info().project.name === 'phone') {
      await expect(page.getByTestId('activity')).toHaveCount(0);
      await page.getByTestId('notifications-tab-activity').click();
    }
    const feed = page.getByTestId('activity');
    await expect(feed).toBeVisible();
    await expect(page.getByTestId('activity-act-pr-8')).toContainText('Raff');
    await expect(page.getByTestId('activity-act-pr-8')).toContainText('Roof plumbing started');
    await expect(page.getByTestId('activity-act-pr-8')).toContainText('8:15am');
    await expect(page.getByTestId('activity-act-pr-8')).toContainText('64-66 Park Rd');
    await expect(page.getByTestId('activity-act-pr-2')).toContainText('ETA changed 19 Oct to 26 Oct');
    const all = await page.locator('[data-testid^="activity-act-"]').count();
    expect(all).toBeGreaterThan(8);

    await page.getByTestId('activity-filter-beatty').click();
    await expect(page.getByTestId('activity-filter-beatty')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('activity-act-pr-8')).toHaveCount(0);
    await expect(page.locator('[data-testid^="activity-act-"]')).toHaveCount(await page.locator('[data-testid^="activity-act-bt-"]').count());
    expect(page.url()).toContain('job=beatty');

    await page.getByTestId('activity-filter-all').click();
    await expect(page.locator('[data-testid^="activity-act-"]')).toHaveCount(all);

    // By person: Alec's only seeded entry is the Seaview photos.
    await page.getByTestId('activity-person-alec').click();
    await expect(page.getByTestId('activity-person-alec')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-testid^="activity-act-"]')).toHaveCount(1);
    await expect(page.getByTestId('activity-act-sv-2')).toContainText('Added 4 photos');
    await page.getByTestId('activity-person-all').click();
    await expect(page.locator('[data-testid^="activity-act-"]')).toHaveCount(all);
  });

  test('a stage change on the checklist lands in the feed on that job', async ({ page }) => {
    await page.goto('#/jobs/west-st?as=dominic&today=2026-09-17');
    await page.getByTestId('checklist-stage-status-west-st-st-2-done').click();
    await page.goto('#/notifications?tab=activity&job=west-st&as=dominic&today=2026-09-17');
    await expect(page.getByTestId('activity')).toContainText('With council done on 59-61 West St');
    await expect(page.getByTestId('activity')).toContainText('Dominic');
    await reset(page);
  });
});

test.describe('Alec', () => {
  test('sees only his notifications, no feed, and no money', async ({ page }) => {
    await page.goto('#/notifications?as=alec&today=2026-09-17');
    await expect(page.getByTestId('notifications')).toBeVisible();
    await expect(page.getByTestId('no-access')).toHaveCount(0);
    await expect(page.getByTestId('activity')).toHaveCount(0);
    await expect(page.getByTestId('notifications-tabs')).toHaveCount(0);
    await expect(page.getByTestId('notifications-empty')).toHaveText('Nothing new.');
    // Nobody else's notifications leak into his list.
    await expect(page.locator('[data-testid^="notification-nt-"]')).toHaveCount(0);
    expect(await page.locator('body').innerText()).not.toContain('$');

    // Fired reminders as Alec raise nothing for him on 17 Sep (he owns no items) and nothing with a price.
    await page.getByTestId('dev-fire-reminders').click();
    await expect(page.getByTestId('bell-badge')).toHaveCount(0);
    expect(await page.locator('body').innerText()).not.toContain('$');
    await reset(page);
  });
});

test.describe('Shell', () => {
  test('an in-app route change starts at the top of the page', async ({ page }) => {
    await page.goto('#/waiting?owner=me&as=raff&today=2026-09-17');
    await page.evaluate('window.scrollTo(0, 600)');
    expect(await page.evaluate('window.scrollY')).toBeGreaterThan(300);
    await page.getByTestId('nav-notifications').click();
    await expect(page.getByTestId('notifications')).toBeVisible();
    expect(await page.evaluate('window.scrollY')).toBe(0);
  });
});
