/**
 * Stage 5: the desktop Setup area. Runs in the mock project and in its own
 * api-setup project, which runs after api and api-change on the same server,
 * so nothing here can move the seeded Overview other specs assert. Every test
 * makes its own job (unique names) so retries and parallel tests don't collide.
 */
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { isMock } from './helpers';

test.use({ viewport: { width: 1280, height: 800 } });

function unique(info: TestInfo, base: string): string {
  return `${base} ${info.project.name === 'mock' ? 'M' : 'A'}${Date.now().toString(36).slice(-5)}${info.retry}`;
}

/** Creates a build from the Duplex template through the New job form; returns its id and planned finish text. */
async function createJob(page: Page, name: string, opts: { cost?: string } = {}): Promise<{ jobId: string; finish: string }> {
  await page.goto('./#/setup');
  await page.getByLabel('Job name').fill(name);
  if (opts.cost) await page.getByLabel('Weekly holding cost').fill(opts.cost);
  const finish = page.getByTestId('nj-finish');
  await expect(finish).toHaveText(/^(Mon|Tue|Wed|Thu|Fri) \d{1,2} \w{3} \d{4}$/);
  await expect(page.getByTestId('nj-stages').getByRole('listitem')).toHaveCount(8);
  const finishText = (await finish.textContent())!;
  await page.getByTestId('nj-create').click();
  await expect(page).toHaveURL(/#\/jobs\/job-[a-z0-9]+$/);
  const jobId = decodeURIComponent(page.url().split('#/jobs/')[1]!);
  return { jobId, finish: finishText };
}

test('new job from the duplex template: preview, create, then it is on the Overview with a program', async ({ page }, info) => {
  const name = unique(info, 'Smith St');
  const { jobId } = await createJob(page, name, { cost: '3200' });
  // The new job's first page: timing first, its first stage.
  await expect(page.getByTestId('job-bar')).toContainText(name);
  await expect(page.getByTestId('job-stage-of')).toHaveText('Stage 1 of 8');

  await page.goto('./#/');
  const card = page.getByTestId(`overview-card-${jobId}`);
  await expect(page.getByTestId('overview-builds').getByTestId(`overview-card-${jobId}`)).toBeVisible();
  await expect(card.getByTestId('card-next').getByRole('listitem')).toHaveCount(3);

  await page.goto(`./#/jobs/${jobId}/program`);
  await page.getByRole('button', { name: 'Whole program' }).click();
  await expect(page.getByTestId('gantt').locator('[data-testid^="g-step-"]')).toHaveCount(29);
  await expect(page.getByTestId('program-sub')).toContainText('Every step on plan.');
});

test('a design job gets its checklist', async ({ page }, info) => {
  const name = unique(info, 'Design Rd');
  await page.goto('./#/setup');
  await page.getByRole('button', { name: 'Design, approval checklist' }).click();
  await page.getByLabel('Job name').fill(name);
  await page.getByLabel('Approval path').selectOption('CDC');
  await expect(page.getByTestId('nj-preview')).toContainText('With certifier');
  await page.getByTestId('nj-create').click();
  await expect(page).toHaveURL(/#\/jobs\/job-[a-z0-9]+\/checklist$/);
  await expect(page.getByTestId('ck-stages')).toContainText('With certifier');
});

test('the form says what is wrong in plain words', async ({ page }) => {
  await page.goto('./#/setup');
  await page.getByTestId('nj-create').click();
  await expect(page.getByText('Give the job a name.')).toBeVisible();
  await page.getByLabel('Job name').fill('Park Rd');
  await expect(page.getByTestId('nj-problem')).toHaveText('There is already a job called Park Rd.');
  await page.getByLabel('Weekly holding cost').fill('lots');
  await expect(page.getByText('Weekly holding cost is dollars a week, like 4500.', { exact: false })).toBeVisible();
});

test('program editor: a longer step shows what moves before Save, then Program shows it late against the plan', async ({ page }, info) => {
  const name = unique(info, 'Duration St');
  const { jobId } = await createJob(page, name, { cost: '7000' });

  await page.goto(`./#/setup/programs/${jobId}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Program: ${name}`);
  const tiling = page.locator('[data-step-name="Tiling"]');
  await expect(tiling.getByTestId('ed-days')).toHaveValue('10');

  // A bad value is explained, not sent.
  await tiling.getByTestId('ed-days').fill('ten');
  await expect(page.getByTestId('bar-problem')).toHaveText('Working days must be a whole number from 1 to 1000.');
  await expect(page.getByTestId('bar-save')).toBeDisabled();

  await tiling.getByTestId('ed-days').fill('15');
  const bar = page.getByTestId('change-bar');
  await expect(bar.getByTestId('preview-moved')).toContainText('steps move');
  // Timing first: no finish and no money on the web.
  await expect(bar).not.toContainText('Forecast finish');
  await expect(bar).not.toContainText('$');
  await expect(bar.getByTestId('bar-note')).toContainText("Planned dates don't change");
  // Nothing saved yet: one change at a time, everything else is locked.
  await expect(page.locator('[data-step-name="Painting"]').getByTestId('ed-days')).toBeDisabled();

  await bar.getByTestId('bar-save').click();
  await expect(page.getByTestId('ed-saved')).toContainText(`Saved: Edited step Tiling at ${name}`);
  await expect(page.getByTestId('change-bar')).toHaveCount(0);
  await expect(tiling.getByTestId('ed-days')).toHaveValue('15');

  await page.goto(`./#/jobs/${jobId}/program`);
  await expect(page.getByTestId('program-sub')).toContainText('later than planned');

  // Change history records it as a Setup change.
  await page.goto(`./#/history/${jobId}`);
  const entry = page.locator('[data-testid^="history-"]').filter({ hasText: 'Edited step Tiling' });
  await expect(entry.getByTestId('source-setup')).toContainText('Changed in Setup on the computer');
  await expect(entry.getByTestId('fields')).toContainText('Tiling, working days');
});

test('program editor: add a step and a need, discard a change, and a template has no dates', async ({ page }, info) => {
  const name = unique(info, 'Add St');
  const { jobId } = await createJob(page, name);
  await page.goto(`./#/setup/programs/${jobId}`);
  const frameStage = page.locator('[data-testid^="ed-stage-"]').filter({ has: page.locator('[data-step-name="Frame inspection"]') });
  await frameStage.getByRole('button', { name: 'Add a step to Frame' }).click();
  const form = frameStage.locator('[data-testid^="ed-newstep-"]');
  await form.getByLabel('Name').fill('Frame check');
  await form.getByLabel('Working days').fill('2');
  const bar = page.getByTestId('change-bar');
  await expect(bar).toContainText('New step at');
  await expect(bar).not.toContainText('Forecast finish');
  await bar.getByTestId('bar-save').click();
  await expect(page.locator('[data-step-name="Frame check"]')).toBeVisible();

  // A need with its lead time.
  const check = page.locator('[data-step-name="Frame check"]');
  await check.getByTestId('ed-more').click();
  await page.getByLabel('What it needs').fill('Bracing straps');
  await page.getByLabel('Lead time in weeks').last().fill('3');
  await expect(bar).toContainText('Frame check needs Bracing straps (3 weeks)');
  await bar.getByTestId('bar-save').click();
  await expect(check).toContainText('Bracing straps, 3 weeks');

  // Discard puts the value back.
  await check.getByTestId('ed-days').fill('9');
  await expect(bar).toBeVisible();
  await bar.getByTestId('bar-discard').click();
  await expect(check.getByTestId('ed-days')).toHaveValue('2');

  // The Duplex template: same editor, no dates, the change measured in working days. Previewed only.
  await page.goto('./#/setup/templates/tpl-duplex');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Template: Duplex');
  await expect(page.locator('.su-step-dates')).toHaveCount(0);
  await page.locator('[data-step-name="Frame"]').getByTestId('ed-days').fill('20');
  await expect(page.getByTestId('template-impact')).toContainText('working days. Templates have no dates.');
  await page.getByTestId('bar-discard').click();
});

test('templates: list, and make one from a job', async ({ page }, info) => {
  await page.goto('./#/setup/templates');
  await expect(page.getByTestId('template-tpl-duplex')).toContainText('Duplex');
  await expect(page.getByTestId('template-tpl-duplex')).toContainText('29');
  const name = unique(info, 'Park Rd copy');
  await page.getByLabel('Copy the program of').selectOption({ label: 'Park Rd' });
  await page.getByLabel('Template name').fill(name);
  await expect(page.getByTestId('fromjob-preview')).toContainText('No dates.');
  await page.getByTestId('fromjob-create').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Template: ${name}`);
  await expect(page.locator('.su-step-dates')).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Setup pages' }).getByRole('link', { name: 'Templates', exact: true }).click();
  await expect(page.getByRole('row', { name: new RegExp(name) })).toBeVisible();
});

test('trades: add one with a checked AU number; a changed number rings from Waiting on', async ({ page }, info) => {
  await page.goto('./#/setup/trades');
  const name = unique(info, 'Kerbside Concrete');
  const add = page.getByTestId('add-trade');
  await add.getByLabel('Name').fill(name);
  await add.getByLabel('What they do').fill('Concreter');
  await add.getByLabel('Phone').fill('555 1234');
  await add.getByTestId('add-trade-save').click();
  await expect(add.getByText("That doesn't look like an Australian phone number.", { exact: false })).toBeVisible();
  await add.getByLabel('Phone').fill('0491579212');
  await expect(add.getByText('Saved as 0491 579 212')).toBeVisible();
  await add.getByTestId('add-trade-save').click();
  await expect(page.getByTestId('trade-saved')).toContainText(`New trade: ${name} (Concreter)`);
  const row = page.getByRole('row', { name: new RegExp(name) });
  await expect(row.getByTestId('trade-phone')).toHaveAttribute('href', 'tel:0491579212');
  await expect(row.getByTestId('trade-phone')).toHaveText('0491 579 212');

  // Change Northern Concrete Pumping's number; Waiting on (To chase merged in) rings the new one.
  await page.getByTestId('trade-tr-northern-pump').getByRole('button', { name: /Change/ }).click();
  const edit = page.getByTestId('trade-edit-tr-northern-pump');
  await edit.getByLabel('Phone').fill('0491 570 737');
  await edit.getByTestId('trade-edit-save').click();
  await expect(page.getByTestId('trade-tr-northern-pump').getByTestId('trade-phone')).toHaveText('0491 570 737');
  await page.goto('./#/chase');
  await expect(page).toHaveURL(/#\/waiting$/);
  const call = page.getByTestId('waiting-row-it-sv-pump').getByTestId('call');
  await expect(call).toHaveAttribute('href', 'tel:0491570737');
  await expect(call).toContainText('Northern Concrete Pumping');
});

test('mock: the dev bar Reset puts Setup changes back', async ({ page }, info) => {
  test.skip(!isMock(info), 'The dev bar is the demo only');
  const name = unique(info, 'Reset St');
  const { jobId } = await createJob(page, name);
  await page.goto('./#/');
  await expect(page.getByTestId(`overview-card-${jobId}`)).toBeVisible();
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByTestId(`overview-card-${jobId}`)).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('overview-card-park-rd')).toBeVisible();
  await expect(page.getByTestId(`overview-card-${jobId}`)).toHaveCount(0);
});

test('Setup is hidden on a 390px phone, and each Setup page says to use a computer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./#/');
  await page.getByTestId('overview-card-park-rd').waitFor();
  // The phone tab bar is Overview and Waiting on; Changes is a glyph in the nav bar; Setup is nowhere.
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link')).toHaveText(['Overview', 'Waiting on']);
  await expect(page.getByRole('link', { name: 'Changes' })).toBeVisible();
  await expect(page.getByRole('link', { name: /New job|Setup/ })).toHaveCount(0);
  for (const path of ['/setup', '/setup/programs', '/setup/programs/park-rd', '/setup/templates', '/setup/templates/tpl-duplex', '/setup/trades']) {
    await page.goto(`./#${path}`);
    await expect(page.getByTestId('setup-phone')).toHaveText(/Setup works on a computer\. Open this page on a desktop\./);
    await expect(page.locator('form, table')).toHaveCount(0);
  }
});

test('screenshots: every Setup screen at 1280x800, and the phone message at 390', async ({ page }, info) => {
  const shot = async (name: string) => {
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${name} scrolls sideways`).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `e2e/screenshots/${info.project.name}-setup-${name}.png` });
  };
  await page.goto('./#/setup');
  await page.getByLabel('Job name').fill('Smith St');
  await page.getByLabel('Weekly holding cost').fill('3200');
  await expect(page.getByTestId('nj-finish')).toBeVisible();
  await shot('newjob-1280');

  await page.goto('./#/setup/programs');
  await page.getByTestId('setup-programs').waitFor();
  await shot('programs-1280');

  await page.goto('./#/setup/programs/park-rd');
  await page.getByTestId('editor').waitFor();
  await shot('editor-1280');
  const tiling = page.getByTestId('ed-step-pr-tiling');
  await tiling.scrollIntoViewIfNeeded();
  await tiling.getByTestId('ed-days').fill('15');
  await expect(page.getByTestId('preview-moved')).toBeVisible();
  await shot('editor-change-1280');
  await tiling.getByTestId('ed-more').click();
  await page.getByTestId('bar-discard').click();
  await page.getByTestId('ed-detail-pr-tiling').scrollIntoViewIfNeeded();
  await shot('editor-detail-1280');

  await page.goto('./#/setup/templates');
  await page.getByTestId('templates').waitFor();
  await shot('templates-1280');

  await page.goto('./#/setup/templates/tpl-duplex');
  await page.getByTestId('editor').waitFor();
  await page.locator('[data-step-name="Frame"]').getByTestId('ed-days').fill('20');
  await expect(page.getByTestId('template-impact')).toBeVisible();
  await shot('template-editor-1280');

  await page.goto('./#/setup/trades');
  await page.getByTestId('trades').waitFor();
  await shot('trades-1280');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./#/setup');
  await page.getByTestId('setup-phone').waitFor();
  await shot('phone-390');
});
