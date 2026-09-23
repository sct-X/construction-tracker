import { expect, test, type Page } from '@playwright/test';

// UI_PLAN flow c: Dominic rings Raff and works through the Call mode of Waiting on (the old call list, #/calls forwards here).
// Dominic, today Thu 17 Sep 2026. Runs at both projects (phone cards, desktop rows).
// The phone hides the date, note and skip behind "Date, note, skip"; open() handles both.

async function openMore(page: Page, id: string) {
  const toggle = page.getByTestId(`call-more-toggle-${id}`);
  if (await toggle.isVisible()) await toggle.click();
  await expect(page.getByTestId(`call-more-${id}`)).toBeVisible();
}

test.describe('Flow c: the call list', () => {
  test('Dominic rings Raff, works the list, finishes the call, and the jobs read confirmed today', async ({ page }) => {
    // 1. Waiting on in Call mode opens on Raff with the count; the person is a dropdown with each count.
    await page.goto('#/waiting?mode=call&as=dominic&today=2026-09-17');
    await expect(page.getByTestId('waiting-mode-call')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('calls-person')).toHaveValue('raff');
    await expect(page.getByTestId('calls-count')).toHaveText(/\d+ items across 3 jobs to chase with Raff/);
    await expect(page.getByTestId('calls-person-dom')).toContainText('1 item');
    await expect(page.getByTestId('calls-person-alec')).toContainText('nothing');

    // Grouped by job, the most urgent question first: Seaview's concrete pump, act by Fri 18 Sep, for the pour on Fri 2 Oct.
    const jobs = page.locator('[data-testid^="calls-job-"]');
    await expect(jobs.first()).toHaveAttribute('data-testid', 'calls-job-seaview');
    const pump = page.getByTestId('call-item-it-sv-pump');
    await expect(page.getByTestId('calls-job-seaview').locator('[data-testid^="call-item-"]').first()).toHaveAttribute('data-testid', 'call-item-it-sv-pump');
    await expect(pump).toContainText('Book concrete pump');
    await expect(page.getByTestId('call-actby-it-sv-pump')).toHaveText('Fri 18 Sep');
    await expect(pump).toContainText('act by, tomorrow');
    // Coming up is plain: no amber "soon".
    await expect(page.getByTestId('call-actby-it-sv-pump')).toHaveClass(/callitem__act-date--plain/);
    await expect(pump).toContainText('For Pour ground floor slab, Fri 2 Oct');
    await expect(pump).toContainText('Waiting on IR Formwork Constructions');
    await expect(page.getByTestId('call-phone-it-sv-pump')).toHaveAttribute('href', 'tel:0491570157');
    await expect(page.getByTestId('call-action-it-sv-pump')).toHaveText('Mark booked');

    // The windows items: ordered on time and expected from the shipment, so the act-by is spent, not overdue.
    const windows = page.getByTestId('call-item-it-pr-windows');
    await expect(windows).toContainText('Windows');
    await expect(page.getByTestId('call-actby-it-pr-windows')).toHaveText('Mon 10 Aug');
    await expect(windows).toContainText('act by, 5 weeks ago');
    // A booking carries its expected date: no red "overdue by" on it.
    await expect(page.getByTestId('call-actby-it-pr-windows')).toHaveClass(/callitem__act-date--muted/);
    await expect(windows).not.toContainText('overdue');
    await expect(windows).toContainText('Ordered or booked');
    await expect(windows).toContainText('Expected Mon 26 Oct');
    await expect(page.getByTestId('call-action-it-pr-windows')).toHaveText('Mark confirmed');
    await expect(page.getByTestId('call-item-it-pr-sliding-doors')).toContainText('Sliding doors');
    await openMore(page, 'it-pr-windows');
    await expect(page.getByTestId('call-expected-it-pr-windows')).toBeDisabled();
    await expect(windows).toContainText('Comes from the shipment');

    // Job headers: freshness in quiet words (never amber). No finish date and no money anywhere.
    await expect(page.getByTestId('calls-fresh-beatty')).toContainText('unconfirmed 9 days');
    await expect(page.getByTestId('calls-fresh-seaview')).toContainText('confirmed yesterday');
    await expect(page.getByTestId('calls-finish-park-rd')).toHaveCount(0);
    expect(await page.locator('#root').innerText()).not.toContain('$');

    // 3. Raff says the pump is booked. Booked needs an expected date: Mark booked asks for it first.
    await page.getByTestId('call-action-it-sv-pump').click();
    await expect(page.getByTestId('call-booking-it-sv-pump')).toBeVisible();
    await page.getByTestId('call-book-it-sv-pump').click();
    await expect(page.getByTestId('call-book-problem-it-sv-pump')).toHaveText('!Ordered or booked needs an expected date.');
    await expect(page.getByTestId('call-item-it-sv-pump')).toBeVisible();
    await page.getByTestId('call-book-date-it-sv-pump').fill('2026-10-02');
    await page.getByTestId('call-book-it-sv-pump').click();
    await expect(page.getByTestId('call-item-it-sv-pump')).toHaveCount(0);
    await expect(page.getByTestId('calls-done-seaview')).toContainText('Done this call');
    await expect(page.getByTestId('call-done-it-sv-pump')).toContainText('Book concrete pump');
    await expect(page.getByTestId('call-done-it-sv-pump')).toContainText('booked, expected Fri 2 Oct, in 2 weeks');

    // 4. The plasterer is booked, and has confirmed for the 23rd: Mark confirmed asks for the date.
    await page.getByTestId('call-action-it-pr-plasterer').click(); // to do -> booked, with its expected date
    await page.getByTestId('call-book-date-it-pr-plasterer').fill('2026-09-23');
    await page.getByTestId('call-book-it-pr-plasterer').click();
    await expect(page.getByTestId('call-done-it-pr-plasterer')).toContainText('booked');
    await page.getByTestId('call-reopen-it-pr-plasterer').click();
    await expect(page.getByTestId('call-action-it-pr-plasterer')).toHaveText('Mark confirmed');
    await page.getByTestId('call-action-it-pr-plasterer').click();
    await page.getByTestId('call-confirm-date-it-pr-plasterer').fill('2026-09-23');
    await page.getByTestId('call-confirm-it-pr-plasterer').click();
    await expect(page.getByTestId('call-done-it-pr-plasterer')).toContainText('confirmed for Wed 23 Sep');

    // 5. The tiler can't start until a week later than needed: move the expected date. No finish words follow.
    await openMore(page, 'it-bt-tiler');
    await page.getByTestId('call-expected-it-bt-tiler').fill('2026-10-12');
    const tilerDone = page.getByTestId('call-done-it-bt-tiler');
    await expect(tilerDone).toContainText('expected moved to Mon 12 Oct');
    await expect(page.getByTestId('call-moved-beatty')).toHaveCount(0);

    // A note is kept on the item.
    await openMore(page, 'it-bt-tiles');
    await page.getByTestId('call-note-it-bt-tiles').fill('Raff to order Monday');
    await page.getByTestId('call-note-it-bt-tiles').press('Enter');

    // 6. Skip one: it stays for next call.
    await openMore(page, 'it-sv-slab-insp');
    await page.getByTestId('call-skip-it-sv-slab-insp').click();
    await expect(page.getByTestId('call-done-it-sv-slab-insp')).toContainText('skipped, stays for next call');

    // 7. Finish call: each job with a "Confirmed today" tick; touched jobs are pre-ticked. Tick all three.
    await page.getByTestId('calls-finish').click();
    const panel = page.getByTestId('calls-finish-panel');
    await expect(panel).toContainText('Finish the call with Raff');
    for (const id of ['park-rd', 'seaview', 'beatty']) {
      const box = page.getByTestId(`calls-confirm-${id}`);
      if (!(await box.isChecked())) await box.check();
    }
    await expect(panel).toContainText('26a Beatty St');
    await expect(panel).toContainText('2 items updated');
    await page.getByTestId('calls-finish-confirm').click();

    // The summary says what changed.
    const summary = page.getByTestId('calls-summary');
    await expect(summary).toContainText('Call with Raff finished');
    await expect(page.getByTestId('calls-summary-seaview')).toContainText('Confirmed today. 1 item updated.');
    await expect(page.getByTestId('calls-summary-seaview')).toContainText('Book concrete pump: booked');
    await expect(page.getByTestId('calls-summary-park-rd')).toContainText('Confirmed today. 1 item updated.');
    await expect(page.getByTestId('calls-summary-beatty')).toContainText('Confirmed today. 2 items updated.');
    await expect(page.getByTestId('calls-summary-beatty')).toContainText('Book tiler: expected moved to Mon 12 Oct');
    await expect(page.getByTestId('calls-summary-beatty')).toContainText('Order tiles: note added');

    // 8. Each job's last confirmed date is today; Beatty's "9 days ago" clears on the overview.
    await page.goto('#/overview');
    for (const id of ['park-rd', 'seaview', 'beatty']) {
      await expect(page.getByTestId(`overview-fresh-${id}`)).toHaveText('Last confirmed today');
      await expect(page.getByTestId(`overview-fresh-${id}`)).toHaveAttribute('data-tone', 'muted');
    }

    // The statuses and dates were written (the activity entries per job are unit-tested in mockApi.test.ts).
    await page.goto('#/jobs/beatty');
    await expect(page.getByTestId('job-fresh')).toHaveText('Last confirmed today');
    await page.goto('#/waiting?mode=call');
    await expect(page.getByTestId('calls-fresh-beatty')).toContainText('confirmed today');
    await expect(page.getByTestId('call-item-it-sv-pump')).toContainText('Ordered or booked');
    await expect(page.getByTestId('call-action-it-sv-pump')).toHaveText('Mark confirmed');
    await expect(page.getByTestId('call-item-it-bt-tiler')).toContainText('Expected Mon 12 Oct, in 3 weeks, 14 days after needed');

    // Reset through the dev bar so the seed is back.
    await page.getByTestId('dev-reset').click();
    await page.goto('#/waiting?mode=call');
    await expect(page.getByTestId('calls-fresh-beatty')).toContainText('unconfirmed 9 days');
    await expect(page.getByTestId('call-action-it-sv-pump')).toHaveText('Mark booked');
  });

  test('Mark confirmed asks for the date the trade is coming, and the list reads exactly the fortnight cut', async ({ page }) => {
    await page.goto('#/waiting?mode=call&as=dominic&today=2026-09-17');
    // Exactly Raff's to-do or booked items with act-by inside 14 days or past: 11 in the seed, none later than 1 Oct.
    await expect(page.locator('[data-testid^="call-item-"]')).toHaveCount(11);
    await expect(page.getByTestId('call-item-it-pr-external-doors')).toHaveCount(0); // act by 5 Oct
    await expect(page.getByTestId('call-item-it-pr-roof-plumber')).toHaveCount(0); // confirmed
    await expect(page.getByTestId('call-item-it-pr-tile-choice')).toHaveCount(0); // Dom's

    // The stormwater plumber is pencilled in; Raff says confirmed for Mon 21 Sep.
    await page.getByTestId('call-action-it-pr-sw-plumber').click();
    const dateInput = page.getByTestId('call-confirm-date-it-pr-sw-plumber');
    await expect(dateInput).toBeVisible();
    await dateInput.fill('2026-09-21');
    await page.getByTestId('call-confirm-it-pr-sw-plumber').click();
    await expect(page.getByTestId('call-done-it-pr-sw-plumber')).toContainText('confirmed for Mon 21 Sep');
    // "Back on the list" brings the row back, now confirmed, so it can be marked done in the same call.
    await page.getByTestId('call-reopen-it-pr-sw-plumber').click();
    await expect(page.getByTestId('call-item-it-pr-sw-plumber')).toContainText('Confirmed');
    await expect(page.getByTestId('call-action-it-pr-sw-plumber')).toHaveText('Mark done');

    // Switching person clears the call; Dom's one item is the tile choice.
    await page.getByTestId('calls-person').selectOption('dom');
    await expect(page.getByTestId('calls-count')).toHaveText('1 item across 1 job to chase with Dom');
    await expect(page.getByTestId('call-item-it-pr-tile-choice')).toContainText('Tile choice');
    await expect(page.getByTestId('call-action-it-pr-tile-choice')).toHaveText('Mark done');
    await expect(page.getByTestId('calls-nothing-beatty')).toContainText('Nothing to chase on Beatty St this fortnight.');

    // Alec owns nothing: the empty words, jobs still listed for confirming.
    await page.getByTestId('calls-person').selectOption('alec');
    await expect(page.getByTestId('calls-empty')).toContainText('Nothing to chase with Alec this fortnight. Still worth confirming each job.');
    await expect(page.getByTestId('calls-job-park-rd')).toBeVisible();

    await page.getByTestId('dev-reset').click();
  });

  test('the button words follow the shared item flow: a consultant report reads Mark requested', async ({ page }) => {
    // Dom rings Dominic: the glazing certificate (a consultant report, to do) is on Dominic's list.
    // The old address forwards into the Call mode with its query kept.
    await page.goto('#/calls?as=dom&today=2026-09-17&person=dominic');
    await expect(page).toHaveURL(/#\/waiting\?.*mode=call/);
    await expect(page.getByTestId('calls-person')).toHaveValue('dominic');
    await expect(page.getByTestId('call-action-it-pr-glazing-cert')).toHaveText('Mark requested');
    await expect(page.getByTestId('call-action-it-pr-sw-council')).toHaveText('Mark received'); // council request, already requested
    await page.getByTestId('call-action-it-pr-glazing-cert').click();
    await expect(page.getByTestId('call-done-it-pr-glazing-cert')).toContainText('requested');
    await page.getByTestId('call-reopen-it-pr-glazing-cert').click();
    await expect(page.getByTestId('call-action-it-pr-glazing-cert')).toHaveText('Mark received');
    // Unticked jobs on the finish panel read "Not confirmed".
    await page.getByTestId('calls-finish').click();
    await expect(page.getByTestId('calls-finish-panel')).toContainText('Not confirmed');
    await page.getByTestId('calls-confirm-park-rd').check();
    await expect(page.getByTestId('calls-finish-panel')).toContainText('Confirmed today');
    await expect(page.getByTestId('calls-finish-panel')).toContainText('Not confirmed'); // the other jobs stay unticked
    await page.getByTestId('dev-reset').click();
  });

  test('offline: status ticks still work, date changes need signal', async ({ page }) => {
    await page.goto('#/waiting?mode=call&as=dominic&today=2026-09-17&offline=1');
    await openMore(page, 'it-sv-pump');
    await expect(page.getByTestId('call-expected-it-sv-pump')).toBeDisabled();
    await expect(page.getByTestId('call-item-it-sv-pump')).toContainText('Needs signal');
    // Booking needs an expected date, and a date needs signal: the pump waits.
    await page.getByTestId('call-action-it-sv-pump').click();
    await expect(page.getByTestId('call-book-date-it-sv-pump')).toBeDisabled();
    await expect(page.getByTestId('call-booking-it-sv-pump')).toContainText('Needs signal');
    // A tick that needs no new date still works: the booked plumber is confirmed.
    await page.getByTestId('call-action-it-pr-sw-plumber').click();
    await page.getByTestId('call-confirm-it-pr-sw-plumber').click();
    await expect(page.getByTestId('call-done-it-pr-sw-plumber')).toContainText('confirmed');
    await page.getByTestId('dev-reset').click();
  });

  test('desktop keys: B books the marked row, S skips it', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'keyboard shortcuts are desktop only');
    await page.goto('#/waiting?mode=call&as=dominic&today=2026-09-17');
    await expect(page.getByTestId('calls-keys')).toBeVisible();
    await expect(page.getByTestId('call-item-it-sv-pump')).toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('b');
    // B asks for the expected date the booking needs, then books it.
    await expect(page.getByTestId('call-book-date-it-sv-pump')).toBeFocused();
    await page.getByTestId('call-book-date-it-sv-pump').fill('2026-10-02');
    await page.getByTestId('call-book-it-sv-pump').click();
    await expect(page.getByTestId('call-done-it-sv-pump')).toContainText('booked');
    await expect(page.getByTestId('call-item-it-sv-slab-insp')).toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('s');
    await expect(page.getByTestId('call-done-it-sv-slab-insp')).toContainText('skipped');
    await page.getByTestId('dev-reset').click();
  });

  test('the call mode is not for the site role, and the builder gets the plain list', async ({ page }) => {
    await page.goto('#/waiting?mode=call&as=alec&today=2026-09-17');
    await expect(page.getByTestId('call-list')).toHaveCount(0);
    await expect(page.getByTestId('no-access')).toBeVisible();
    await page.goto('#/waiting?mode=call&as=raff&today=2026-09-17');
    await expect(page.getByTestId('call-list')).toHaveCount(0);
    await expect(page.getByTestId('waiting-on')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('$');
  });
});
