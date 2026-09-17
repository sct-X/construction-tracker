import { expect, test } from '@playwright/test';

/**
 * Screen 20, the program editor (Stage 6). Desktop: Dominic picks Install
 * windows on the Park Rd chart, makes it five working days longer, sees the
 * finish move in words before he saves, saves, and Monday and "Why it moved"
 * agree. A link that would loop is refused in words. A new stage with a step
 * and a required photo set saves and deletes. Raff is refused. The phone
 * gets a sentence and a link to the read-only program. Every test that
 * writes resets at the end.
 */

const EDIT = '#/jobs/park-rd/edit?as=dominic&today=2026-09-17';

test.describe('Program editor: desktop', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 768, 'desktop only');

  test('a longer Install windows moves the finish a week, in words, before Save; Monday and Why it moved agree after', async ({ page }) => {
    await page.goto(EDIT);
    await expect(page.getByTestId('editor')).toHaveAttribute('data-layout', 'desktop');
    await expect(page.getByTestId('gantt')).toBeVisible();
    await expect(page.getByTestId('editor-preview-finish')).toContainText('Fri 26 Feb 2027');
    await expect(page.getByTestId('editor-save')).toBeDisabled();

    // Bars are buttons in the editor, not links.
    const bar = page.getByTestId('gantt-bar-pr-install-windows');
    await expect(bar).not.toHaveAttribute('href', /.+/);
    await bar.click();
    await expect(page.getByTestId('editor-step-pr-install-windows')).toHaveAttribute('data-selected', 'true');
    await expect(page.getByTestId('editor-panel')).toHaveAttribute('data-kind', 'step');
    await expect(page.getByTestId('editor-name')).toHaveValue('Install windows');
    await expect(page.getByTestId('editor-duration')).toHaveValue('10');
    await expect(page.getByTestId('editor-planned-start')).toHaveValue('2026-11-02');
    await expect(page.getByTestId('editor-waits-pr-cladding')).toBeVisible();
    await expect(page.getByTestId('editor-holdpoint')).not.toBeChecked();

    // Five more working days: the preview names both finishes and the delta before anything is saved.
    await page.getByTestId('editor-duration').fill('15');
    await expect(page.getByTestId('editor-derived')).toContainText('Planned Mon 2 Nov to Fri 20 Nov, 15 working days');
    await expect(page.getByTestId('editor-preview-finish')).toContainText('Fri 26 Feb 2027');
    await expect(page.getByTestId('editor-preview-finish')).toContainText('Fri 5 Mar 2027');
    await expect(page.getByTestId('editor-preview-slip')).toContainText('+7 days');
    await expect(page.getByTestId('editor-preview-slip')).toContainText('$4,500');
    await expect(page.getByTestId('editor-changes')).toHaveText('1 unsaved change');
    // The chart already shows the longer bar, but the real forecast has not moved.
    await page.goto('#/jobs/park-rd/program');
    await expect(page.getByTestId('program')).toContainText('Fri 26 Feb 2027');
    await page.goBack();

    await page.getByTestId('gantt-bar-pr-install-windows').click();
    await page.getByTestId('editor-duration').fill('15');
    await page.getByTestId('editor-save').click();
    await expect(page.getByTestId('editor-changes')).toContainText('Saved 1 change');
    await expect(page.getByTestId('editor-preview-finish')).toContainText('Fri 5 Mar 2027');
    await expect(page.getByTestId('editor-save')).toBeDisabled();

    // Monday shows the new finish and the slip against the 14 Sep snapshot; Why it moved names the step.
    await page.goto('#/monday');
    await expect(page.getByTestId('monday-finish-park-rd')).toContainText('Fri 5 Mar 2027');
    await expect(page.getByTestId('monday-slip-park-rd')).toContainText('+7 days');
    await expect(page.getByTestId('monday-slip-park-rd')).toContainText('$4,500');
    await page.getByTestId('monday-slip-park-rd').click();
    await expect(page).toHaveURL(/#\/jobs\/park-rd\/why/);
    await expect(page.getByTestId('why-screen')).toContainText('Install windows ends 20 Nov, not 13 Nov (+7 days)');
    await expect(page.locator('[data-testid^="why-entry-"]').last()).toContainText("Finish 5 Mar, 7 days later than Monday's snapshot (26 Feb)");

    // The edit is in the activity feed in the step's words.
    await page.goto('#/notifications?tab=activity&job=park-rd');
    await expect(page.getByTestId('activity')).toContainText('Install windows: duration 10 to 15 days');

    await page.getByTestId('dev-reset').click();
    await page.goto('#/monday');
    await expect(page.getByTestId('monday-finish-park-rd')).toContainText('Fri 26 Feb 2027');
  });

  test('a link that would loop is refused in words and nothing changes', async ({ page }) => {
    await page.goto(EDIT);
    await page.getByTestId('gantt-bar-pr-cladding').click();
    await expect(page.getByTestId('editor-name')).toHaveValue('External cladding');
    // Install windows already waits for External cladding, so the reverse would loop.
    await page.getByTestId('editor-waits-pick').selectOption('pr-install-windows');
    await page.getByTestId('editor-waits-add').click();
    await expect(page.getByTestId('editor-waits-refusal')).toHaveText(
      "External cladding can't wait for Install windows: Install windows already waits for External cladding. That would loop.",
    );
    await expect(page.getByTestId('editor-waits-pr-install-windows')).toHaveCount(0);
    await expect(page.getByTestId('editor-changes')).toHaveText('No unsaved changes');
    await expect(page.getByTestId('editor-save')).toBeDisabled();

    // Further down the chain the refusal says what it goes through.
    await page.getByTestId('editor-waits-pick').selectOption('pr-handover');
    await page.getByTestId('editor-waits-add').click();
    await expect(page.getByTestId('editor-waits-refusal')).toContainText('through');

    // An honest link is taken and previewed.
    await page.getByTestId('editor-waits-pick').selectOption('pr-site-setup');
    await page.getByTestId('editor-waits-add').click();
    await expect(page.getByTestId('editor-waits-refusal')).toHaveCount(0);
    await expect(page.getByTestId('editor-waits-pr-site-setup')).toBeVisible();
    await expect(page.getByTestId('editor-changes')).toHaveText('1 unsaved change');
    await page.getByTestId('editor-cancel').click();
    await expect(page.getByTestId('editor-changes')).toHaveText('No unsaved changes');
  });

  test('a new stage with one step and a required photo set saves, then deletes with a plain confirm', async ({ page }) => {
    await page.goto(EDIT);
    await expect(page.getByTestId('editor-stages').locator('[data-testid^="editor-stage-"]')).toHaveCount(8);
    await page.getByTestId('editor-add-stage').click();
    await expect(page.getByTestId('editor-panel')).toHaveAttribute('data-kind', 'stage');
    await page.getByTestId('editor-name').fill('Pool');
    await expect(page.getByTestId('editor-stages').locator('[data-testid^="editor-stage-"]').last()).toContainText('Pool');

    await page.getByTestId('editor-add-step').click();
    await expect(page.getByTestId('editor-panel')).toHaveAttribute('data-kind', 'step');
    await page.getByTestId('editor-name').fill('Dig pool');
    await expect(page.getByTestId('editor-duration')).toHaveValue('5');
    // The new step starts after the job's last planned end, so the finish moves with it.
    await expect(page.getByTestId('editor-planned-start')).not.toHaveValue('');
    await expect(page.getByTestId('editor-preview-slip')).toContainText('+');
    await page.getByTestId('editor-holdpoint').check();

    await page.getByTestId('editor-category-add').click();
    const catName = page.locator('[data-testid^="editor-category-name-draft-"]');
    await catName.fill('Pool shell before backfill');
    await page.locator('[data-testid^="editor-category-required-draft-"]').check();
    await expect(page.getByTestId('editor-changes')).toHaveText('3 unsaved changes');
    await page.getByTestId('editor-save').click();
    await expect(page.getByTestId('editor-changes')).toContainText('Saved 3 changes');

    // Saved for real: the program shows the stage, the upload screen offers the set, the feed logged it.
    await expect(page.getByTestId('editor-stages').locator('[data-testid^="editor-stage-"]')).toHaveCount(9);
    await page.goto('#/jobs/park-rd/program');
    await expect(page.getByTestId('gantt')).toContainText('Pool');
    await expect(page.getByTestId('gantt')).toContainText('Dig pool');
    await page.goto('#/notifications?tab=activity&job=park-rd');
    await expect(page.getByTestId('activity')).toContainText('Added stage Pool to 64-66 Park Rd');
    await expect(page.getByTestId('activity')).toContainText('Added step Dig pool');

    // Delete the stage: a plain confirm names what goes with it.
    await page.goto('#/jobs/park-rd/edit');
    await page.getByTestId('editor-stages').locator('[data-testid^="editor-stage-"]').last().click();
    await expect(page.getByTestId('editor-name')).toHaveValue('Pool');
    await page.getByTestId('editor-delete').click();
    await expect(page.getByTestId('editor-delete-confirm-box')).toContainText('Delete Pool and its 1 step? Its photo sets go too.');
    await page.getByTestId('editor-delete-keep').click();
    await expect(page.getByTestId('editor-delete-confirm-box')).toHaveCount(0);
    await page.getByTestId('editor-delete').click();
    await page.getByTestId('editor-delete-confirm').click();
    await expect(page.getByTestId('editor-stages').locator('[data-testid^="editor-stage-"]')).toHaveCount(8);
    await expect(page.getByTestId('editor-changes')).toHaveText('1 unsaved change');
    await page.getByTestId('editor-save').click();
    await expect(page.getByTestId('editor-changes')).toContainText('Saved 1 change');
    await expect(page.getByTestId('editor-preview-finish')).toContainText('Fri 26 Feb 2027');

    await page.getByTestId('dev-reset').click();
    await expect(page.getByTestId('editor-stages').locator('[data-testid^="editor-stage-"]')).toHaveCount(8);
  });

  test('a stage-level job edits its placeholder steps as stages; a design job edits the checklist only', async ({ page }) => {
    await page.goto('#/jobs/seaview/edit?as=dominic&today=2026-09-17');
    await page.getByTestId('gantt-bar-sv-frame').click();
    await expect(page.getByTestId('editor-panel')).toHaveAttribute('data-kind', 'stage-step');
    await expect(page.getByTestId('editor-panel')).toContainText('Whole stage');
    await expect(page.getByTestId('editor-name')).toHaveValue('Frame');
    await expect(page.getByTestId('editor-duration')).toHaveValue('40');
    await page.getByTestId('editor-name').fill('Frame and trusses');
    await expect(page.getByTestId('editor-stage-sv-st-frame')).toContainText('Frame and trusses');
    await page.getByTestId('editor-cancel').click();

    await page.goto('#/jobs/west-st/edit?as=dominic&today=2026-09-17');
    await expect(page.getByTestId('gantt')).toHaveCount(0);
    await expect(page.getByTestId('editor-add-step')).toHaveCount(0);
    await page.getByTestId('editor-stages').locator('[data-testid^="editor-stage-"]').first().click();
    await expect(page.getByTestId('editor-panel')).toHaveAttribute('data-kind', 'stage');
    await expect(page.getByTestId('editor-category-add')).toHaveCount(0);
    await expect(page.getByTestId('editor-move-down')).toBeEnabled();
    await expect(page.getByTestId('editor-preview-finish')).toContainText('A design job has no finish to forecast');
  });

  test('offline the editor is read-only, and Raff is refused', async ({ page }) => {
    await page.goto(`${EDIT}&offline=1`);
    await expect(page.getByTestId('editor-offline')).toBeVisible();
    await page.getByTestId('gantt-bar-pr-install-windows').click();
    await expect(page.getByTestId('editor-duration')).toBeDisabled();
    await expect(page.getByTestId('editor-save')).toHaveText('Needs signal');
    await expect(page.getByTestId('editor-add-stage')).toBeDisabled();

    await page.goto('#/jobs/park-rd/edit?as=raff&today=2026-09-17&offline=0');
    await expect(page.getByTestId('no-access')).toBeVisible();
    await expect(page.getByTestId('editor')).toHaveCount(0);
  });
});

test.describe('Program editor: phone', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 768, 'phone only');

  test('the phone says to use a desktop and links to the read-only program', async ({ page }) => {
    await page.goto(EDIT);
    await expect(page.getByTestId('editor')).toHaveAttribute('data-layout', 'phone');
    await expect(page.getByTestId('editor-phone')).toContainText('Edit the program on a desktop');
    await expect(page.getByTestId('editor-panel')).toHaveCount(0);
    await expect(page.getByTestId('editor-save')).toHaveCount(0);
    await page.getByTestId('editor-program-link').click();
    await expect(page).toHaveURL(/#\/jobs\/park-rd\/program/);
    await expect(page.getByTestId('program')).toBeVisible();
  });
});
