import { expect, test, type Page } from '@playwright/test';

/**
 * Daily notes (UI_PLAN 3.17). As Alec on Park Rd: today's note with a weather
 * button, saved with signal. Signal off: a note on Beatty St is saved on the
 * phone and says so in words with the clock; signal back, the words clear.
 * Dominic then reads both in the list (a table with a side panel on the
 * desktop). Partners read only. No "$" anywhere as Alec. Reset at the end.
 */

const TODAY = '2026-09-18';
const PARK_TEXT = 'Cladding finished on the rear wall, scaffold coming down Monday.';
const BEATTY_TEXT = 'Tiler rang, starting 5 Oct as promised.';

async function noMoney(page: Page) {
  const text = await page.locator('body').innerText();
  expect(text).not.toContain('$');
}

test.describe('Daily notes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`#/jobs/park-rd/notes?as=alec&today=${TODAY}`);
    await page.getByTestId('dev-reset').click();
    await page.reload();
    await expect(page.getByTestId('dev-today')).toHaveValue(TODAY);
    await expect(page.getByTestId('dev-offline')).not.toBeChecked();
  });

  test('Alec writes today, one note queues without signal and sends when it returns, Dominic reads both', async ({ page }, testInfo) => {
    const phone = testInfo.project.name === 'phone';

    // Today's entry sits at the top: a text box, weather and on-site as buttons, one Save.
    await expect(page.getByTestId('notes')).toBeVisible();
    const today = page.getByTestId('note-today');
    await expect(today).toBeVisible();
    await expect(today.locator('select')).toHaveCount(0);
    await expect(today).toContainText('Friday 18 September');
    await noMoney(page);

    // The week of seeded notes is there, grouped by week, newest first.
    await expect(page.getByTestId('note-dn-pr-0917')).toContainText('Rain till 10');
    await expect(page.getByTestId('note-dn-pr-0917')).toContainText('Rain. On site: Alec, Carpenter.');
    await expect(page.getByTestId('notes-week-2026-09-14')).toContainText('This week, 14-18 Sep');
    await expect(page.getByTestId('notes-week-2026-09-07')).toContainText('Last week, 7-11 Sep');

    const overcast = page.getByTestId('note-weather-overcast');
    if (phone) {
      expect((await overcast.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(56);
      expect((await page.getByTestId('note-onsite-alec').boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(56);
      expect((await page.getByTestId('note-save').boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(56);
    }

    // An empty save is refused in words, and the draft stays.
    await page.getByTestId('note-save').click();
    await expect(page.getByTestId('note-problem')).toContainText('Write a line first');

    await page.getByTestId('note-text').fill(PARK_TEXT);
    await overcast.click();
    await expect(overcast).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('note-onsite-alec').click();
    await expect(page.getByTestId('note-onsite-alec')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('note-onsite-tr-firstcall').click();
    await page.getByTestId('note-save').click();
    await expect(page.getByTestId('note-saved')).toContainText('Saved');
    await expect(page.getByTestId('note-queued')).toHaveCount(0);
    await expect(page.getByTestId('note-save')).toHaveText('Save changes');
    await noMoney(page);

    // Signal drops. Another job's note is saved on the phone and says so.
    await page.getByTestId('dev-offline').check();
    await expect(page.getByTestId('offline-bar')).toBeVisible();
    await page.goto('#/jobs/beatty/notes');
    await expect(page.getByTestId('notes')).toBeVisible();
    await expect(page.getByTestId('note-dn-bt-0916')).toContainText('Plumber rough-in done');
    await page.getByTestId('note-text').fill(BEATTY_TEXT);
    await page.getByTestId('note-weather-rain').click();
    await page.getByTestId('note-save').click();
    const queued = page.getByTestId('note-queued');
    await expect(queued).toBeVisible();
    await expect(queued).toContainText('waiting to send');
    await expect(queued.locator('svg')).toHaveCount(1);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await noMoney(page);

    // Signal back: the note goes and the words clear by themselves.
    await page.getByTestId('dev-offline').uncheck();
    await expect(page.getByTestId('note-queued')).toHaveCount(0);
    await expect(page.getByTestId('note-saved')).toContainText('Saved');

    // Dominic reads both. On the desktop the list is a table with the entry in a side panel.
    await page.goto(`#/jobs/park-rd/notes?as=dominic&today=${TODAY}`);
    await expect(page.getByTestId('notes')).toBeVisible();
    const parkList = page.getByTestId('notes-list');
    await expect(parkList).toContainText(PARK_TEXT);
    await expect(parkList).toContainText('Overcast');
    await expect(parkList).toContainText('Alec, Plumber');
    if (!phone) {
      await expect(parkList.locator('table')).toHaveCount(1);
      await expect(page.getByTestId('note-today').locator('textarea')).toHaveCount(1);
      await expect(page.getByTestId('note-save')).toHaveText("Save today's note");
    }
    await page.goto(`#/jobs/beatty/notes?as=dominic&today=${TODAY}`);
    await expect(page.getByTestId('notes-list')).toContainText(BEATTY_TEXT);
    await expect(page.getByTestId('notes-list')).toContainText('Rain');
    await expect(page.getByTestId('notes-list')).not.toContainText('waiting to send');

    // Partners read only: no entry, no Save.
    await page.goto(`#/jobs/park-rd/notes?as=dom&today=${TODAY}`);
    await expect(page.getByTestId('notes-list')).toContainText(PARK_TEXT);
    await expect(page.getByTestId('note-today')).toHaveCount(0);
    await expect(page.getByTestId('note-save')).toHaveCount(0);

    await page.getByTestId('dev-reset').click();
  });

  test('a job with no notes invites the first line', async ({ page }) => {
    await page.goto(`#/jobs/west-st/notes?as=dominic&today=${TODAY}`);
    await expect(page.getByTestId('notes-empty')).toHaveText('No notes yet. One line a day is plenty.');
    await expect(page.getByTestId('note-today')).toBeVisible();
  });
});
