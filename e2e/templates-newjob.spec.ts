import { expect, test, type Page } from '@playwright/test';

// Stage 6 part B: templates and new job (UI_PLAN 3.21, rule 8). Dominic, today Thu 17 Sep 2026.
// Both projects. Specs never touch window/document directly; page.evaluate takes strings.

const AS = '?as=dominic&side=side-nd&today=2026-09-17';

async function reset(page: Page) {
  await page.getByTestId('dev-reset').click();
  await expect(page.getByTestId('dev-today')).toHaveValue('2026-09-17');
}

test.describe('Templates and new job', () => {
  test('the list shows the duplex template with its stage and step counts', async ({ page }) => {
    await page.goto(`#/templates${AS}`);
    await expect(page.getByTestId('templates')).toBeVisible();
    const row = page.getByTestId('template-tpl-duplex');
    await expect(row).toBeVisible();
    await expect(row).toContainText('Duplex');
    await expect(page.getByTestId('template-counts-tpl-duplex')).toHaveText('8 stages, 29 steps, 25 needs, 13 photo sets');
    await expect(row).toContainText('Site establishment');
    await expect(row).toContainText('Handover');
    await expect(page.getByTestId('template-new')).toBeVisible();
    await expect(page.getByTestId('template-save-from-job')).toBeVisible();
    // No dates anywhere on a template.
    const text = await page.getByTestId('templates').innerText();
    expect(text).not.toMatch(/\b20\d\d\b/);

    // The detail opens the sequence out: durations, waits-for, needs, hold points, photo sets.
    await page.getByTestId('template-open-tpl-duplex').click();
    await expect(page).toHaveURL(/#\/templates\/tpl-duplex$/);
    await expect(page.getByTestId('template')).toBeVisible();
    await expect(page.getByTestId('template-stage-name-tpl-st-lockup')).toHaveValue('Lock-up');
    await expect(page.getByTestId('template-step-tpl-install-windows')).toBeVisible();
    await expect(page.getByTestId('template-step-days-tpl-install-windows').locator('input')).toHaveValue('10');
    await expect(page.getByTestId('template-step-waits-tpl-install-windows')).toContainText('External cladding');
    await expect(page.getByTestId('template-step-needs-tpl-install-windows')).toContainText('Windows, 12 wk');
    await expect(page.getByTestId('template-step-hold-tpl-slab-insp')).toBeChecked();
    await expect(page.getByTestId('template-cats-tpl-st-slab')).toContainText('Steel reinforcement in place');
    const detail = await page.getByTestId('template').innerText();
    expect(detail).not.toMatch(/\b20\d\d\b/);
  });

  test('the jobs list New job button opens the new job screen', async ({ page }) => {
    await page.goto(`#/jobs${AS}`);
    await page.getByTestId('jobs-new').click();
    await expect(page).toHaveURL(/#\/jobs\/new$/);
    await expect(page.getByTestId('newjob')).toBeVisible();
  });

  test('Dominic creates a build job from the duplex template starting Mon 5 Oct 2026', async ({ page }) => {
    await page.goto(`#/jobs/new?template=tpl-duplex&${AS.slice(1)}`);
    await expect(page.getByTestId('newjob')).toBeVisible();
    await expect(page.getByTestId('newjob-kind-build')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('newjob-template-tpl-duplex')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('newjob-create')).toBeDisabled();
    await expect(page.getByTestId('newjob-problems')).toContainText('Give it a name');

    await page.getByTestId('newjob-name').fill('12 Smith St');
    await page.getByTestId('newjob-path-CDC').click();
    await page.getByTestId('newjob-holding').fill('3000');
    await page.getByTestId('newjob-start').fill('2026-10-05');

    // The planned finish is shown in words before anything is created.
    const finish = page.getByTestId('newjob-planned-finish');
    await expect(finish).toContainText('Fri 4 Jun 2027');
    await expect(finish).toContainText('Planned finish');
    await expect(finish).toContainText('29 steps');
    await expect(finish).toContainText('from Mon 5 Oct 2026');
    await expect(finish).toContainText('Slip appears after the first Monday');
    await expect(page.getByTestId('newjob-from-stage-tpl-st-site')).toHaveAttribute('aria-pressed', 'true');

    // Starting from Lock-up marks four stages done and brings the finish forward; back to the start restores it.
    await page.getByTestId('newjob-from-stage-tpl-st-lockup').click();
    await expect(finish).toContainText('Tue 2 Mar 2027');
    await expect(finish).toContainText('4 stages before Lock-up marked done');
    await expect(page.getByTestId('newjob-from-stage-tpl-st-slab')).toHaveAttribute('data-done', 'true');
    await page.getByTestId('newjob-from-stage-tpl-st-site').click();
    await expect(finish).toContainText('Fri 4 Jun 2027');

    // Create: the overview opens on the new job.
    await expect(page.getByTestId('newjob-create')).toHaveText('Create 12 Smith St');
    await expect(page.getByTestId('newjob-create')).toBeEnabled();
    await page.getByTestId('newjob-create').click();
    await expect(page).toHaveURL(/#\/jobs\/job-[a-z0-9]+$/);
    const jobId = ((await page.evaluate('location.hash')) as string).replace('#/jobs/', '');
    await expect(page.getByTestId('job-overview')).toContainText('12 Smith St');
    await expect(page.getByTestId('job-overview')).toContainText('Fri 4 Jun 2027');

    // Jobs list: forecast = planned, no slip yet.
    await page.goto('#/jobs');
    const row = page.getByTestId(`job-row-${jobId}`);
    await expect(row).toBeVisible();
    await expect(row).toContainText('12 Smith St');
    await expect(row).toContainText('4 Jun 2027');
    await expect(row).toContainText('On plan');
    await expect(row).toContainText('Slip appears after the first Monday');
    await expect(row).toContainText('$3,000/wk');
    await expect(row).toContainText('Last confirmed today');

    // Monday: the same.
    await page.goto('#/monday');
    await expect(page.getByTestId(`monday-row-${jobId}`)).toBeVisible();
    await expect(page.getByTestId(`monday-finish-${jobId}`)).toContainText('Fri 4 Jun 2027');
    await expect(page.getByTestId(`monday-slip-${jobId}`)).toContainText('Slip appears after the first Monday');

    // The program has the template's steps, dated from 5 Oct.
    await page.goto(`#/jobs/${jobId}/program`);
    const program = page.locator('main');
    await expect(program).toContainText('Site setup and fencing');
    await expect(program).toContainText('Install windows');
    await expect(program).toContainText('Handover and clean');
    const stepCount = await page.locator('[data-testid^="gantt-bar-"], [data-testid^="lookahead-step-"], [data-testid^="stage-band-"]').count();
    expect(stepCount).toBeGreaterThan(0);

    await reset(page);
    await page.goto('#/jobs');
    await expect(page.getByTestId(`job-row-${jobId}`)).toHaveCount(0);
  });

  test('a design job with no template gets the checklist stages only', async ({ page }) => {
    await page.goto(`#/jobs/new${AS}`);
    await page.getByTestId('newjob-kind-design').click();
    await expect(page.getByTestId('newjob-template-blank')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('newjob-planned-finish')).toContainText('no program and no finish date');
    await page.getByTestId('newjob-name').fill('7 Plan Ave');
    await page.getByTestId('newjob-create').click();
    await expect(page).toHaveURL(/#\/jobs\/job-[a-z0-9]+$/);
    await expect(page.getByTestId('checklist')).toBeVisible();
    await expect(page.getByTestId('checklist')).toContainText('With council');
    await expect(page.getByTestId('checklist')).toContainText('Construction certificate');
    await reset(page);
  });

  test('Park Rd saved as a template shows in the list with no dates', async ({ page }) => {
    await page.goto(`#/templates${AS}`);
    await page.getByTestId('template-save-from-job').click();
    await page.getByTestId('template-from-job-park-rd').click();
    await page.getByTestId('template-from-job-name').fill('Park Rd program');
    await page.getByTestId('template-from-job-save').click();
    const rows = page.locator('[data-testid^="template-tpl-"]');
    await expect(rows).toHaveCount(2);
    const saved = page.locator('.templates__row', { hasText: 'Park Rd program' });
    await expect(saved).toBeVisible();
    await expect(saved).toContainText('8 stages, 29 steps, 25 needs, 13 photo sets');
    const text = await page.getByTestId('templates').innerText();
    expect(text).not.toMatch(/\b20\d\d\b/);
    // Not a job: the jobs list and Monday do not list it.
    await page.goto('#/jobs');
    await expect(page.locator('main')).not.toContainText('Park Rd program');
    await page.goto('#/monday');
    await expect(page.locator('main')).not.toContainText('Park Rd program');
    // Open it: every step is undated and not started.
    await page.goto('#/templates');
    await saved.getByRole('link', { name: 'Park Rd program' }).click();
    await expect(page.getByTestId('template')).toBeVisible();
    await expect(page.locator('li.template__step')).toHaveCount(29);
    const detail = await page.getByTestId('template').innerText();
    expect(detail).not.toMatch(/\b20\d\d\b/);
    await page.getByTestId('dev-reset').click();
    await page.goto('#/templates');
    await expect(rows).toHaveCount(1);
  });

  test('template edits stick: a duration, a new step and a photo set', async ({ page }) => {
    await page.goto(`#/templates/tpl-duplex${AS}`);
    const days = page.getByTestId('template-step-days-tpl-install-windows').locator('input');
    await days.fill('12');
    await days.press('Enter');
    await expect(page.getByTestId('template-stage-tpl-st-lockup')).toContainText('43 working days');
    await page.getByTestId('template-add-step-name-tpl-st-handover').fill('Final clean');
    await page.getByTestId('template-add-step-days-tpl-st-handover').fill('2');
    await page.getByTestId('template-add-step-save-tpl-st-handover').click();
    await expect(page.getByTestId('template-stage-tpl-st-handover')).toContainText('Final clean');
    await expect(page.getByTestId('template-stage-tpl-st-handover')).toContainText('3 steps');
    await page.getByTestId('template-add-cat-tpl-st-roof').fill('Sarking');
    await page.getByTestId('template-add-cat-tpl-st-roof').press('Enter');
    await expect(page.getByTestId('template-cats-tpl-st-roof')).toContainText('Sarking');
    // A job made from it now carries the change.
    await page.goto('#/jobs/new?template=tpl-duplex');
    await expect(page.getByTestId('newjob-template-tpl-duplex')).toContainText('30 steps');
    await page.getByTestId('newjob-start').fill('2026-10-05');
    await expect(page.getByTestId('newjob-planned-finish')).not.toContainText('Fri 4 Jun 2027');
    await page.getByTestId('dev-reset').click();
    await page.goto('#/templates/tpl-duplex');
    await expect(page.getByTestId('template-step-days-tpl-install-windows').locator('input')).toHaveValue('10');
  });

  test('offline, the template is read-only and Create needs signal', async ({ page }) => {
    await page.goto(`#/templates/tpl-duplex${AS}&offline=1`);
    await expect(page.getByTestId('template-offline')).toContainText('No signal');
    await expect(page.getByTestId('template-step-days-tpl-install-windows').locator('input')).toHaveCount(0);
    await page.goto('#/jobs/new?template=tpl-duplex&offline=1');
    await page.getByTestId('newjob-name').fill('Nowhere');
    await expect(page.getByTestId('newjob-create')).toBeDisabled();
    await expect(page.getByTestId('newjob')).toContainText('Needs signal');
    await page.getByTestId('dev-reset').click();
  });

  test('Alec is refused on every template route', async ({ page }) => {
    for (const r of ['/templates', '/templates/tpl-duplex', '/jobs/new']) {
      await page.goto(`#${r}?as=alec&side=side-nd&today=2026-09-17`);
      await expect(page.getByTestId('dev-person')).toHaveValue('alec');
      await expect(page.getByTestId('no-access')).toBeVisible();
      await expect(page.getByTestId('templates')).toHaveCount(0);
      await expect(page.getByTestId('newjob')).toHaveCount(0);
      const text = await page.locator('body').innerText();
      expect(text).not.toContain('$');
    }
    // Raff too: templates are admin and partner screens.
    await page.goto('#/jobs/new?as=raff');
    await expect(page.getByTestId('no-access')).toBeVisible();
  });
});
