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
    home: /#\/monday$/,
    nav: {
      phone: ['Monday', 'Waiting on', 'Call list', 'Jobs'],
      desktop: ['Monday', 'Waiting on', 'Call list', 'Jobs', 'Shipments', 'Activity', 'Templates and new job', 'Trades', 'People and roles'],
    },
  },
  {
    as: 'dom',
    role: 'partner',
    home: /#\/monday$/,
    nav: {
      phone: ['Monday', 'Waiting on', 'Jobs'],
      desktop: ['Monday', 'Waiting on', 'Call list', 'Jobs', 'Shipments', 'Activity', 'Templates and new job', 'Trades'],
    },
  },
  {
    as: 'norm',
    role: 'partner',
    home: /#\/monday$/,
    nav: {
      phone: ['Monday', 'Waiting on', 'Jobs'],
      desktop: ['Monday', 'Waiting on', 'Call list', 'Jobs', 'Shipments', 'Activity', 'Templates and new job', 'Trades'],
    },
  },
  {
    as: 'raff',
    role: 'builder',
    home: /#\/waiting\?owner=me$/,
    nav: {
      phone: ['My items', 'Jobs', '+ Photos', 'Monday'],
      desktop: ['Monday', 'Waiting on', 'Jobs', 'Shipments', 'Activity', 'Trades'],
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

/** Labels of every nav-* link in the primary nav and, on desktop, the setup group; job sub-links excluded. */
async function navLabels(page: Page): Promise<string[]> {
  const links = page.locator('[data-testid="primary-nav"] [data-testid^="nav-"], [data-testid="setup-nav"] [data-testid^="nav-"]');
  const ids = await links.evaluateAll((els) => els.map((el) => el.getAttribute('data-testid') ?? ''));
  const texts = await links.allTextContents();
  return texts.filter((_, i) => !ids[i].startsWith('nav-job-')).map((t) => t.trim());
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

  test('the side switcher shows for Dominic and Norm only', async ({ page }) => {
    for (const as of ['dominic', 'norm']) {
      await page.goto(`#/jobs?as=${as}&side=side-nd`);
      await expect(page.getByTestId('side-switcher')).toBeVisible();
    }
    for (const as of ['dom', 'raff', 'alec']) {
      await page.goto(`#/jobs?as=${as}&side=side-nd`);
      await expect(page.getByTestId('side-switcher')).toHaveCount(0);
      await expect(page.getByTestId('side-name')).toHaveText('Norm and Dom');
    }
  });

  test('the Norm side is empty and invites action', async ({ page }) => {
    await page.goto('#/jobs?as=norm&side=side-nd');
    await expect(page.getByTestId('job-row-park-rd')).toBeVisible();
    await page.getByTestId('side-switcher').selectOption('side-norm');
    await expect(page.getByTestId('jobs-empty')).toContainText('No jobs on this side yet.');
    await expect(page.getByTestId('jobs-new')).toBeVisible();
    await expect(page.getByTestId('job-row-park-rd')).toHaveCount(0);
    // Back, so the persisted session does not leak into other tests.
    await page.getByTestId('side-switcher').selectOption('side-nd');
    await expect(page.getByTestId('job-row-park-rd')).toBeVisible();
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

  test('a typed route the role cannot see is refused; Monday does not exist for Alec', async ({ page }) => {
    await page.goto('#/calls?as=raff');
    await expect(page.getByTestId('no-access')).toContainText("You don't have access to this");
    await page.goto('#/monday?as=alec');
    await expect(page.getByTestId('not-found')).toBeVisible();
    await page.goto('#/nowhere?as=dominic');
    await expect(page.getByTestId('not-found')).toBeVisible();
  });

  test('every route in the plan resolves to a screen or a placeholder', async ({ page }) => {
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

test.describe('Jobs list', () => {
  test('Dominic sees builds and design jobs with finish, slip, money and freshness words', async ({ page }) => {
    await page.goto('#/jobs?as=dominic&side=side-nd&today=2026-09-17');
    for (const id of ['park-rd', 'seaview', 'beatty', 'west-st', 'tollbar', 'lower-beach', 'john-st']) {
      await expect(page.getByTestId(`job-row-${id}`)).toBeVisible();
    }
    const park = page.getByTestId('job-row-park-rd');
    await expect(park).toContainText('26 Feb 2027');
    await expect(park).toContainText('$4,500/wk');
    await expect(park).toContainText('Last confirmed 2 days ago');
    const beatty = page.getByTestId('job-row-beatty');
    await expect(beatty).toContainText('4 Dec 2026');
    await expect(beatty).toContainText('7 days late');
    await expect(beatty).toContainText('+5 days this week');
    await expect(beatty).toContainText('Unconfirmed 9 days');
    await expect(page.getByTestId('job-row-west-st')).toContainText('2 outstanding, oldest 23 days');
    await expect(page.getByTestId('jobs-new')).toBeVisible();
  });

  test('Alec sees builds only and no money anywhere on the page', async ({ page }) => {
    await page.goto('#/jobs?as=alec&side=side-nd');
    await expect(page.getByTestId('job-row-park-rd')).toBeVisible();
    await expect(page.getByTestId('job-row-west-st')).toHaveCount(0);
    await expect(page.getByTestId('jobs-new')).toHaveCount(0);
    const text = await page.locator('#root').innerText();
    expect(text).not.toContain('$');
    expect(text).not.toContain('Holding cost');
  });

  test('tapping a row opens the job', async ({ page }) => {
    await page.goto('#/jobs?as=raff&side=side-nd');
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
