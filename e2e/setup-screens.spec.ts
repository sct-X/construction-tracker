import { expect, test, type Page } from '@playwright/test';

/**
 * Stage 6, part C: trades, people and roles, my settings (UI_PLAN 3.19 and
 * 3.22). Today is Thu 17 Sep 2026. Runs in both projects; each test gets a
 * fresh browser context, so a test only has to reset what it changed.
 */

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;

async function reset(page: Page) {
  await page.getByTestId('dev-reset').click();
}

test.describe('Trades as Dominic', () => {
  test('adds a trade with a phone, sees it in the list, and the Norm side is empty', async ({ page }) => {
    await page.goto('#/trades?as=dominic&side=side-nd&today=2026-09-17');
    await expect(page.getByTestId('trades')).toBeVisible();
    await expect(page.getByTestId('placeholder')).toHaveCount(0);
    expect(await page.locator('[data-testid^="trade-tr-"]').count()).toBeGreaterThanOrEqual(16);
    // The seeded plumber rings from the list and is on Park Rd's program.
    await expect(page.getByTestId('trade-ring-tr-plumber')).toHaveAttribute('href', 'tel:0411200308');
    await expect(page.getByTestId('trade-jobs-tr-plumber')).toContainText('Park Rd');

    await page.getByTestId('trade-add').click();
    await page.getByTestId('trade-name').fill('Scaff City');
    await page.getByTestId('trade-type-other').click();
    await page.getByTestId('trade-type-other-text').fill('Scaffolder');
    await page.getByTestId('trade-phone').fill('0411 200 399');
    await page.getByTestId('trade-save').click();
    await expect(page.getByTestId('trade-add-form')).toHaveCount(0);
    const row = page.locator('[data-testid^="trade-tr-"]', { hasText: 'Scaff City' });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Scaffolder');
    await expect(row.locator('a[href="tel:0411200399"]')).toBeVisible();
    await expect(row).toContainText('Not on a job yet');
    if (isPhone(page)) await expect(row.locator('a[href="tel:0411200399"]')).toContainText('Ring');

    // Survives a reload.
    await page.reload();
    await expect(page.locator('[data-testid^="trade-tr-"]', { hasText: 'Scaff City' })).toHaveCount(1);

    // One trade's page: the number, the jobs, and the items waiting on them.
    await page.getByTestId('trade-open-tr-plumber').click();
    await expect(page).toHaveURL(/#\/trades\/tr-plumber$/);
    await expect(page.getByTestId('trade-detail')).toBeVisible();
    await expect(page.getByTestId('trade-ring-tr-plumber')).toHaveAttribute('href', 'tel:0411200308');
    await expect(page.getByTestId('trade-jobs-tr-plumber')).toContainText('Park Rd');
    expect(await page.locator('[data-testid^="trade-detail-item-"]').count()).toBeGreaterThanOrEqual(1);
    await expect(page.getByTestId('trade-edit-tr-plumber')).toBeVisible();

    // Offline: reading and ringing work, writing waits.
    await page.goto('#/trades?as=dominic&side=side-nd&today=2026-09-17&offline=1');
    await expect(page.getByTestId('trades-offline')).toContainText('Needs signal');
    await expect(page.getByTestId('trade-add')).toBeDisabled();
    await expect(page.getByTestId('trade-ring-tr-plumber')).toBeVisible();
    await page.goto('#/trades?as=dominic&side=side-nd&today=2026-09-17&offline=0');

    // The Norm side has nothing yet, in words.
    await page.goto('#/trades?as=dominic&side=side-norm&today=2026-09-17');
    await expect(page.getByTestId('trades-empty')).toContainText('No trades yet. Add them as you book them.');
    await expect(page.locator('[data-testid^="trade-tr-"]')).toHaveCount(0);

    // Add, then delete, on that side.
    await page.getByTestId('trade-add').click();
    await page.getByTestId('trade-name').fill('Norm Side Sparky');
    await page.getByTestId('trade-type-electrician').click();
    await page.getByTestId('trade-save').click();
    const norm = page.locator('[data-testid^="trade-tr-"]', { hasText: 'Norm Side Sparky' });
    await expect(norm).toHaveCount(1);
    await norm.locator('[data-testid^="trade-edit-"]').click();
    await page.locator('[data-testid^="trade-delete-tr-"]').click();
    await expect(page.locator('[data-testid^="trade-delete-words-"]')).toContainText('Delete Norm Side Sparky?');
    await page.locator('[data-testid^="trade-delete-confirm-"]').click();
    await expect(page.getByTestId('trades-empty')).toBeVisible();

    await reset(page);
    await page.goto('#/trades?as=dominic&side=side-nd&today=2026-09-17');
    await expect(page.locator('[data-testid^="trade-tr-"]', { hasText: 'Scaff City' })).toHaveCount(0);
  });
});

test.describe('People and roles as Dominic', () => {
  test("changes Raff's role, sees it in the dev bar and nav, and cannot demote himself", async ({ page }) => {
    await page.goto('#/people?as=dominic&side=side-nd&today=2026-09-17');
    await expect(page.getByTestId('people')).toBeVisible();
    for (const id of ['dominic', 'dom', 'norm', 'raff', 'alec']) await expect(page.getByTestId(`person-${id}`)).toBeVisible();
    await expect(page.getByTestId('person-raff')).toHaveAttribute('data-role', 'builder');
    await expect(page.getByTestId('person-role-raff-builder')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('people-role-words')).toContainText('Never sees prices');
    await expect(page.getByTestId('dev-person').locator('option[value="raff"]')).toHaveText('Raff (builder)');

    await page.getByTestId('person-role-raff-partner').click();
    await expect(page.getByTestId('person-raff')).toHaveAttribute('data-role', 'partner');
    await expect(page.getByTestId('person-role-raff-partner')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('dev-person').locator('option[value="raff"]')).toHaveText('Raff (partner)');

    // Dominic cannot take admin off himself.
    await page.getByTestId('person-role-dominic-partner').click();
    await expect(page.getByTestId('people-refusal')).toContainText("You can't take admin off yourself");
    await expect(page.getByTestId('person-role-dominic-admin')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('person-dominic')).toHaveAttribute('data-role', 'admin');
    await page.getByTestId('person-remove-dominic').click();
    await expect(page.getByTestId('people-refusal')).toContainText("can't remove yourself");
    await expect(page.getByTestId('person-dominic')).toBeVisible();

    // Offline: roles read but do not change.
    await page.goto('#/people?as=dominic&side=side-nd&today=2026-09-17&offline=1');
    await expect(page.getByTestId('people-offline')).toContainText('Needs signal');
    await expect(page.getByTestId('person-role-raff-builder')).toBeDisabled();
    await expect(page.getByTestId('person-add')).toBeDisabled();
    await page.goto('#/people?as=dominic&side=side-nd&today=2026-09-17&offline=0');

    // Raff now gets a partner's navigation.
    await page.goto('#/?as=raff');
    await expect(page).toHaveURL(/#\/monday$/);
    if (isPhone(page)) {
      await expect(page.getByTestId('nav-upload')).toHaveCount(0);
      await expect(page.getByTestId('nav-monday')).toBeVisible();
    } else {
      await expect(page.getByTestId('nav-calls')).toBeVisible();
    }

    await reset(page);
    await page.goto('#/people?as=dominic&side=side-nd&today=2026-09-17');
    await expect(page.getByTestId('person-raff')).toHaveAttribute('data-role', 'builder');
  });

  test('adds a person with a role and a side', async ({ page }) => {
    await page.goto('#/people?as=dominic&side=side-nd&today=2026-09-17');
    await page.getByTestId('person-add').click();
    await page.getByTestId('person-add-name').fill('Jo Nguyen');
    await page.getByTestId('person-add-role-site').click();
    await page.getByTestId('person-add-side-side-nd').click();
    await page.getByTestId('person-add-save').click();
    await expect(page.getByTestId('person-added')).toContainText('Added Jo as site on Norm and Dom');
    const jo = page.locator('[data-testid^="person-person-"]', { hasText: 'Jo Nguyen' });
    await expect(jo).toHaveCount(1);
    await expect(jo).toHaveAttribute('data-role', 'site');
    await expect(page.getByTestId('dev-person')).toContainText('Jo (site)');
    // Remove the membership and Jo leaves this side.
    await jo.locator('[data-testid^="person-remove-"]').click();
    await expect(jo).toHaveCount(0);
    await reset(page);
  });
});

test.describe('My settings', () => {
  test('shows Dominic, keeps a preference across a reload, has the install steps and the permission words', async ({ page }) => {
    await page.goto('#/settings?as=dominic&side=side-nd&today=2026-09-17');
    await expect(page.getByTestId('settings')).toBeVisible();
    await expect(page.getByTestId('placeholder')).toHaveCount(0);
    await expect(page.getByTestId('settings-who')).toContainText('Dominic Barone');
    await expect(page.getByTestId('settings-who')).toContainText('Admin on Norm and Dom');
    await expect(page.getByTestId('settings-who')).toContainText('Also on Norm');

    // A preference toggles and persists.
    const pref = page.getByTestId('settings-pref-eta_changes');
    await expect(pref).toHaveAttribute('aria-checked', 'true');
    await expect(pref).toHaveText('On');
    await pref.click();
    await expect(pref).toHaveAttribute('aria-checked', 'false');
    await expect(pref).toHaveText('Off');
    await page.reload();
    await expect(page.getByTestId('settings-pref-eta_changes')).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('settings-pref-reminders')).toHaveAttribute('aria-checked', 'true');

    // Install steps, in words, for both phones; not installed in a browser tab.
    const install = page.getByTestId('settings-install');
    await expect(install).toHaveAttribute('data-installed', 'false');
    await page.getByTestId('settings-install-iphone').click();
    await expect(page.getByTestId('settings-install-steps')).toContainText('Add to Home Screen');
    await page.getByTestId('settings-install-android').click();
    await expect(page.getByTestId('settings-install-steps')).toContainText('three dots');
    await expect(page.getByTestId('settings-install-steps').locator('li')).toHaveCount(4);

    // Both projects run a desktop browser, so the words say so and the ask is off.
    const state = page.getByTestId('settings-permission-state');
    await expect(state).toContainText("Notifications aren't set up on a desktop browser in this prototype");
    await expect(page.getByTestId('settings-allow-notifications')).toBeDisabled();
    await expect(page.getByTestId('settings-push-note')).toContainText('no push server');

    // Last sync is the last write through the API.
    await expect(page.getByTestId('settings-last-sync')).toContainText('Last change saved');

    // The test buzz lands in the app's own list.
    await page.getByTestId('settings-test-buzz').click();
    await expect(page.getByTestId('settings-step-buzz')).toContainText('Sent');
    await expect(page.getByTestId('bell-badge')).toBeVisible();

    // Reset this phone from the settings screen.
    await page.getByTestId('settings-reset').click();
    await expect(page.getByTestId('settings-reset-words')).toContainText('sample data back');
    await page.getByTestId('settings-reset-confirm').click();
    await expect(page.getByTestId('settings-reset-done')).toContainText('Reset done');
    await expect(page.getByTestId('settings-pref-eta_changes')).toHaveAttribute('aria-checked', 'true');

    // Sign out drops to the sign-in page, which explains the dev bar.
    await page.goto('#/settings?as=alec&today=2026-09-17');
    await page.getByTestId('settings-sign-out').click();
    await expect(page).toHaveURL(/#\/sign-in$/);
    await expect(page.getByTestId('sign-in')).toBeVisible();
    await expect(page.getByTestId('dev-person')).toHaveValue('dominic');
  });

  test.describe('on an iPhone', () => {
    test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });

    test('blocked shows the unblock words with the ask off', async ({ page }) => {
      // Headless Chromium starts denied.
      await page.goto('#/settings?as=dominic&side=side-nd&today=2026-09-17');
      const state = page.getByTestId('settings-permission-state');
      await expect(state).toContainText(/Blocked on this phone|Not asked yet/);
      if ((await state.innerText()).startsWith('Blocked')) {
        await expect(state).toContainText('To unblock');
        await expect(page.getByTestId('settings-allow-notifications')).toBeDisabled();
      }
      await expect(page.getByTestId('settings-install-steps')).toContainText('Add to Home Screen');
    });

    test('allowed records the phone against the person', async ({ page, context, baseURL }) => {
      await context.grantPermissions(['notifications'], { origin: new URL(baseURL ?? 'http://localhost').origin });
      await page.goto('#/settings?as=dominic&side=side-nd&today=2026-09-17');
      const state = page.getByTestId('settings-permission-state');
      await expect(state).toContainText(/Allowed on this phone|Not asked yet/);
      // The tap asks (or, already allowed, records this phone), then goes quiet.
      await page.getByTestId('settings-allow-notifications').click();
      await expect(state).toHaveText('Allowed on this phone.');
      await expect(page.getByTestId('settings-push-note')).toContainText('recorded against your name');
      await expect(page.getByTestId('settings-allow-notifications')).toBeDisabled();
      await expect(page.getByTestId('settings-allow-notifications')).toHaveText('Notifications are allowed');
      await page.getByTestId('dev-reset').click();
    });
  });

  test('Alec sees no money and no admin screens; Raff keeps trades too; partners have no people screen', async ({ page }) => {
    await page.goto('#/settings?as=alec&today=2026-09-17');
    await expect(page.getByTestId('settings')).toBeVisible();
    await expect(page.getByTestId('settings-who')).toContainText('Alec Ferris');
    await expect(page.getByTestId('settings-who')).toContainText('Site on Norm and Dom');
    expect(await page.locator('body').innerText()).not.toContain('$');
    await expect(page.getByTestId('settings-pref-unconfirmed_jobs')).toHaveCount(0);
    await expect(page.getByTestId('settings-pref-reminders')).toBeVisible();
    await expect(page.getByTestId('settings-install')).toBeVisible();
    await expect(page.getByTestId('settings-reset')).toBeVisible();

    await page.goto('#/people?as=alec&today=2026-09-17');
    await expect(page.getByTestId('no-access')).toBeVisible();
    await page.goto('#/trades?as=alec&today=2026-09-17');
    await expect(page.getByTestId('no-access')).toBeVisible();

    await page.goto('#/trades?as=raff&today=2026-09-17');
    await expect(page.getByTestId('trades')).toBeVisible();
    await expect(page.getByTestId('trade-add')).toBeVisible();
    await expect(page.getByTestId('trade-edit-tr-plumber')).toBeVisible();
    await page.goto('#/trades/tr-plumber?as=raff&today=2026-09-17');
    await expect(page.getByTestId('trade-detail')).toBeVisible();
    await expect(page.getByTestId('trade-edit-tr-plumber')).toBeVisible();
    await page.goto('#/trades/tr-plumber?as=alec&today=2026-09-17');
    await expect(page.getByTestId('no-access')).toBeVisible();

    await page.goto('#/people?as=dom&today=2026-09-17');
    await expect(page.getByTestId('no-access')).toBeVisible();
    await page.goto('#/trades?as=dom&today=2026-09-17');
    await expect(page.getByTestId('trade-edit-tr-plumber')).toBeVisible();
  });
});
