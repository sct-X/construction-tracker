import { expect, test, type Page } from '@playwright/test';

/**
 * Shell: per-role navigation, the landing redirect, the side switcher, the
 * offline bar, and the jobs list. Runs in both projects (phone 390px, desktop
 * 1280px); the expected nav differs per layout, and Alec always gets the
 * phone layout.
 */

type Layout = 'phone' | 'desktop';

const PEOPLE: { as: string; role: string; home: RegExp; nav: Record<Layout, string[]> }[] = [
  {
    as: 'dominic',
    role: 'admin',
    home: /#\/overview$/,
    nav: {
      phone: ['Overview', 'Waiting on'],
      desktop: ['Overview', 'Waiting on', 'Shipments', 'Notifications', 'Templates and new job', 'Trades', 'People and roles'],
    },
  },
  {
    as: 'dom',
    role: 'partner',
    home: /#\/overview$/,
    nav: {
      phone: ['Overview', 'Waiting on'],
      desktop: ['Overview', 'Waiting on', 'Shipments', 'Notifications', 'Templates and new job', 'Trades'],
    },
  },
  {
    as: 'norm',
    role: 'partner',
    home: /#\/overview$/,
    nav: {
      phone: ['Overview', 'Waiting on'],
      desktop: ['Overview', 'Waiting on', 'Shipments', 'Notifications', 'Templates and new job', 'Trades'],
    },
  },
  {
    as: 'raff',
    role: 'builder',
    home: /#\/waiting\?owner=me$/,
    nav: {
      phone: ['My items', 'Jobs', '+ Photos'],
      desktop: ['Overview', 'Waiting on', 'Shipments', 'Notifications', 'Trades'],
    },
  },
  {
    // Alec gets the phone layout on every viewport.
    as: 'alec',
    role: 'site',
    home: /#\/jobs\/park-rd$/,
    nav: { phone: ['Today', 'Jobs'], desktop: ['Today', 'Jobs'] },
  },
];

function layoutFor(page: Page, as: string): Layout {
  if (as === 'alec') return 'phone';
  return (page.viewportSize()?.width ?? 1280) < 768 ? 'phone' : 'desktop';
}

/** Labels of every nav-* link in the primary nav and, on desktop, the setup group. */
async function navLabels(page: Page): Promise<string[]> {
  const links = page.locator('[data-testid="primary-nav"] [data-testid^="nav-"], [data-testid="setup-nav"] [data-testid^="nav-"]');
  return (await links.allTextContents()).map((t) => t.trim());
}

test.describe('Shell: navigation and landing per role', () => {
  for (const person of PEOPLE) {
    test(`${person.as} (${person.role}) sees their nav and lands on their home`, async ({ page }) => {
      await page.goto(`#/?as=${person.as}`);
      await expect(page).toHaveURL(person.home);
      await expect(page.getByTestId('dev-person')).toHaveValue(person.as);
      const layout = layoutFor(page, person.as);
      await expect(page.locator('.shell')).toHaveAttribute('data-layout', layout);
      expect(await navLabels(page)).toEqual(person.nav[layout]);
      // The bell and the person are in the chrome for everyone.
      await expect(page.getByTestId('nav-notifications')).toBeVisible();
      await expect(page.getByTestId('nav-settings')).toBeVisible();
    });
  }

  test('the desktop sidebar lists no jobs: the job switcher moves between them', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the sidebar is desktop only');
    await page.goto('#/jobs/park-rd?as=dom&side=side-nd&today=2026-09-17');
    await expect(page.getByTestId('sidebar')).toBeVisible();
    await expect(page.getByTestId('sidebar').locator('[data-testid^="nav-job-"]')).toHaveCount(0);
    await expect(page.getByTestId('sidebar')).not.toContainText('31 Seaview St');
    await expect(page.getByTestId('job-switcher')).toHaveValue('park-rd');
  });

  test('the side switcher shows for Dominic and Norm only; nobody else sees a side name at all', async ({ page }) => {
    for (const as of ['dominic', 'norm']) {
      await page.goto(`#/overview?as=${as}&side=side-nd`);
      await expect(page.getByTestId('side-switcher')).toBeVisible();
    }
    for (const as of ['dom', 'raff', 'alec']) {
      await page.goto(`#/overview?as=${as}&side=side-nd`);
      await expect(page.getByTestId('side-switcher')).toHaveCount(0);
      await expect(page.getByTestId('side-name')).toHaveCount(0);
      expect(await page.locator('#root').innerText()).not.toContain('Norm and Dom');
    }
  });

  test("the Norm side holds Norm's Eastwood jobs, and Dom cannot reach them", async ({ page }) => {
    await page.goto('#/overview?as=norm&side=side-nd');
    await expect(page.getByTestId('job-row-park-rd')).toBeVisible();
    await page.getByTestId('side-switcher').selectOption('side-norm');
    for (const id of ['hunts-12', 'hunts-14', 'north-rd']) await expect(page.getByTestId(`job-row-${id}`)).toBeVisible();
    await expect(page.getByTestId('job-row-park-rd')).toHaveCount(0);
    await expect(page.getByTestId('jobs-new')).toBeVisible();
    // Back, so the persisted session does not leak into other tests.
    await page.getByTestId('side-switcher').selectOption('side-nd');
    await expect(page.getByTestId('job-row-park-rd')).toBeVisible();
    // Dom is on one side only: the Norm side's jobs are not found for him.
    await page.goto('#/jobs/hunts-12?as=dom');
    await expect(page.getByTestId('not-found')).toBeVisible();
  });

  test('the offline toggle shows a thin bar, and hides it again', async ({ page }) => {
    await page.goto('#/jobs?as=dominic&side=side-nd');
    await expect(page.getByTestId('offline-bar')).toHaveCount(0);
    await page.getByTestId('dev-offline').check();
    await expect(page.getByTestId('offline-bar')).toBeVisible();
    await expect(page.getByTestId('offline-bar')).toContainText('No signal');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByTestId('dev-offline').uncheck();
    await expect(page.getByTestId('offline-bar')).toHaveCount(0);
    // And from the URL.
    await page.goto('#/jobs?as=dominic&offline=1');
    await expect(page.getByTestId('offline-bar')).toBeVisible();
    await page.goto('#/jobs?as=dominic&offline=0');
    await expect(page.getByTestId('offline-bar')).toHaveCount(0);
  });

  test('a typed route the role cannot see is refused, Waiting on for Alec included; old routes forward', async ({ page }) => {
    await page.goto('#/waiting?as=alec');
    await expect(page.getByTestId('no-access')).toContainText("You don't have access to this");
    await page.goto('#/people?as=raff');
    await expect(page.getByTestId('no-access')).toContainText("You don't have access to this");
    // Raff can open the old call list address, but gets the plain list: only admin and partners ring people.
    await page.goto('#/calls?as=raff');
    await expect(page).toHaveURL(/#\/waiting\?.*mode=call/);
    await expect(page.getByTestId('waiting-on')).toBeVisible();
    await expect(page.getByTestId('waiting-mode')).toHaveCount(0);
    await page.goto('#/monday?as=dominic');
    await expect(page).toHaveURL(/#\/overview/);
    await expect(page.getByTestId('overview-screen')).toBeVisible();
    await page.goto('#/nowhere?as=dominic');
    await expect(page.getByTestId('not-found')).toBeVisible();
  });

  test('every route in the plan resolves to a screen', async ({ page }) => {
    const routes = [
      '/monday',
      '/jobs',
      '/jobs/park-rd',
      '/jobs/west-st',
      '/jobs/park-rd/program',
      '/steps/pr-install-windows',
      '/waiting',
      '/items/new',
      '/items/it-pr-windows',
      '/calls',
      '/shipments',
      '/shipments/sh-park-windows',
      '/jobs/park-rd/shipments',
      '/jobs/park-rd/shipments/sh-park-windows',
      '/jobs/park-rd/photos',
      '/jobs/park-rd/upload',
      '/queue',
      '/jobs/park-rd/notes',
      '/notifications',
      '/settings',
      '/jobs/park-rd/edit',
      '/templates',
      '/trades',
      '/people',
      '/sign-in',
    ];
    for (const r of routes) {
      await page.goto(`#${r}?as=dominic`);
      await expect(page.locator('main')).toBeVisible();
      await expect(page.getByTestId('not-found')).toHaveCount(0);
      await expect(page.getByTestId('no-access')).toHaveCount(0);
    }
    await page.goto('#/deliveries?as=alec');
    await expect(page.getByTestId('deliveries')).toBeVisible();
  });
});

test.describe('Overview', () => {
  test('Dominic sees builds and design jobs with stage and overdue count, and never a date of finish or a dollar', async ({ page }) => {
    await page.goto('#/overview?as=dominic&side=side-nd&today=2026-09-17');
    for (const id of ['park-rd', 'seaview', 'beatty', 'west-st', 'tollbar', 'lower-beach', 'john-st']) {
      await expect(page.getByTestId(`job-row-${id}`)).toBeVisible();
    }
    const park = page.getByTestId('job-row-park-rd');
    await expect(park).toContainText('Lock-up');
    await expect(park).toContainText('4 overdue');
    const text = await page.locator('#root').innerText();
    expect(text).not.toContain('$');
    expect(text).not.toContain('26 Feb 2027');
    expect(text).not.toContain('Slip');
    await expect(page.getByTestId('job-row-west-st')).toContainText('Nothing overdue');
    await expect(page.getByTestId('overview-stage-west-st')).toContainText('Pending approval');
    await expect(page.getByTestId('jobs-new')).toBeVisible();
  });

  test('Alec sees builds only and no money anywhere on the page', async ({ page }) => {
    await page.goto('#/overview?as=alec&side=side-nd');
    await expect(page.getByTestId('job-row-park-rd')).toBeVisible();
    await expect(page.getByTestId('job-row-west-st')).toHaveCount(0);
    await expect(page.getByTestId('jobs-new')).toHaveCount(0);
    const text = await page.locator('#root').innerText();
    expect(text).not.toContain('$');
    expect(text).not.toContain('Holding cost');
  });

  test('tapping a row opens the job', async ({ page }) => {
    await page.goto('#/overview?as=raff&side=side-nd');
    await page.getByTestId('job-row-seaview').click();
    await expect(page).toHaveURL(/#\/jobs\/seaview$/);
    await expect(page.locator('h1')).toContainText('31 Seaview St');
  });
});

test.describe('Dev bar', () => {
  test('date, offline, fire reminders and reset still work through the shell', async ({ page }) => {
    await page.goto('#/jobs?as=dominic');
    await expect(page.getByTestId('dev-side')).toBeVisible();
    await page.getByTestId('dev-fire-reminders').click();
    await expect(page.getByTestId('dev-fire-result')).toContainText('raised');
    await page.getByTestId('dev-today').fill('2026-10-05');
    await expect(page.getByTestId('dev-today-label')).toHaveText('Mon 5 Oct 2026');
    await page.getByTestId('dev-reset').click();
    await expect(page.getByTestId('dev-fire-result')).toHaveCount(0);
    await expect(page.getByTestId('dev-today')).toHaveValue('2026-09-17');
    await expect(page.getByTestId('dev-offline')).not.toBeChecked();
    await expect(page.getByTestId('dev-person')).toHaveValue('dominic');
  });
});
