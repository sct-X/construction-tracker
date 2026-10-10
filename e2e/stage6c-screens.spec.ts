/**
 * Stage 6c, in both data layers (seed, today Thu 17 Sep 2026): Program (desktop Gantt, phone
 * look-ahead, stages strip and list, Full program), Step detail and the Design checklist in the
 * v1 look. Timing only: no finish, slip or $; red only for overdue, with the words.
 * Saves e2e/screenshots/<project>-6c-<screen>-<width>.png next to the v1-ref-* shots and fails on
 * sideways page scroll.
 */
import { expect, test, type Page, type TestInfo } from '@playwright/test';

const SIZES = [
  { w: 390, h: 844 },
  { w: 1280, h: 800 },
];
const BANNED = ['$', 'Forecast finish', 'Slip', 'Why it moved'];

async function shoot(page: Page, info: TestInfo, name: string, w: number, fullPage = true): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name} scrolls sideways at ${w}px`).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `e2e/screenshots/${info.project.name}-6c-${name}-${w}.png`, fullPage });
}

async function oneH1(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
}

for (const { w, h } of SIZES) {
  const phone = w < 768;
  test.describe(`at ${w}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
    });

    test(`program: Park Rd and Beatty St (${w})`, async ({ page }, info) => {
      await page.goto('./#/jobs/park-rd/program');
      await expect(page.getByTestId('program-sub')).toHaveText('Lock-up. Every step on plan.');
      await oneH1(page);
      for (const b of BANNED) await expect(page.getByTestId('program')).not.toContainText(b);
      if (!phone) {
        const gantt = page.getByTestId('gantt');
        await expect(gantt.getByTestId('gantt-stage-pr-st-lockup')).toHaveText('Lock-up');
        await expect(gantt.getByTestId('g-step-pr-install-windows')).toContainText('Mon 2 Nov to Fri 13 Nov, starts in 6 weeks');
        await expect(gantt.getByTestId('g-step-pr-stormwater-insp')).toContainText('hold point');
        await expect(page.getByTestId('gantt-caption')).toHaveText('ForecastPlannedHold pointToday');
        await page.getByTestId('gantt-bar-pr-install-windows').hover();
        await expect(page.getByTestId('gantt-caption')).toContainText('Install windows. Mon 2 Nov to Fri 13 Nov');
        await page.mouse.move(0, 0);
        await expect(page.getByTestId('program-edit')).toHaveAttribute('href', '#/setup/programs/park-rd');
        // The chart scrolls inside itself, never the page.
        const scroll = await gantt.locator('.gantt__scroll').evaluate((el) => el.scrollWidth > el.clientWidth);
        expect(scroll).toBe(true);
        await shoot(page, info, 'program-park-rd', w, false);
        await page.getByTestId('gantt-bar-pr-install-windows').click();
        await expect(page).toHaveURL(/#\/jobs\/park-rd\/steps\/pr-install-windows$/);
      } else {
        await expect(page.getByTestId('gantt')).toHaveCount(0);
        const la = page.getByTestId('lookahead');
        await expect(la.getByTestId('lookahead-week-1')).toHaveText('This week14-18 Sep');
        await expect(la.getByTestId('la-step-pr-roof-plumbing')).toContainText('Mon to Thu, Roof plumber, started');
        await expect(la.getByTestId('la-step-pr-stormwater')).toContainText('needs stormwater connection approval, ordered or booked, not confirmed');
        await expect(page.getByTestId('stage-chip-pr-st-lockup')).toHaveAttribute('aria-current', 'true');
        await expect(page.getByTestId('stage-band-pr-st-lockup')).toContainText('In progress, week 3 of 12');
        await expect(page.getByTestId('job-tabs')).toHaveClass(/glass/);
        await shoot(page, info, 'program-park-rd', w);
        await page.getByRole('button', { name: 'Full program' }).click();
        await expect(page.getByTestId('gantt')).toHaveClass(/gantt--dense/);
        await shoot(page, info, 'program-park-rd-full', w, false);
      }

      await page.goto('./#/jobs/beatty/program');
      await expect(page.getByTestId('program-sub')).toHaveText('Rough-in. 3 steps later than planned.');
      if (!phone) {
        const tiling = page.getByTestId('g-step-bt-tiling');
        await expect(tiling.getByTestId('gantt-late-bt-tiling')).toHaveText('7 days late');
        // Both dates still ahead: plain words, not the red overdue cue.
        await expect(tiling).toHaveAttribute('data-overdue', 'false');
        await expect(tiling.locator('.status--late')).toHaveCount(0);
        await shoot(page, info, 'program-beatty', w, false);
        await page.getByRole('button', { name: 'Late only' }).click();
        await expect(page.getByTestId('g-step-bt-roughin')).toHaveCount(0);
        await expect(page.getByTestId('g-step-bt-finishes')).toBeVisible();
      } else {
        await expect(page.getByTestId('la-step-bt-tiling')).toContainText('moved to Mon 5 Oct, in 2 weeks, 7 days late');
        await shoot(page, info, 'program-beatty', w);
      }
    });

    test(`step detail: Park Rd install windows and Seaview slab inspection (${w})`, async ({ page }, info) => {
      await page.goto('./#/jobs/park-rd/steps/pr-install-windows');
      await expect(page.getByTestId('step-forecast')).toHaveText('Mon 2 Nov to Fri 13 Nov');
      await expect(page.getByText('Forecast, starts in 6 weeks')).toBeVisible();
      await expect(page.getByTestId('step-late')).toHaveText('on plan');
      await expect(page.getByTestId('step-planned')).toHaveText('Mon 2 Nov to Fri 13 Nov');
      await expect(page.getByTestId('step-duration')).toHaveText('10 working days');
      await expect(page.getByTestId('waits-for')).toContainText('External cladding ends Tue 6 Oct');
      await expect(page.getByTestId('need-it-pr-windows')).toContainText('Expected Mon 26 Oct, in 5 weeks');
      const cert = page.getByTestId('need-it-pr-glazing-cert');
      await expect(cert).toHaveAttribute('data-overdue', 'true');
      await expect(cert.getByTestId('when')).toContainText('Act by Mon 10 Aug, overdue by');
      await expect(page.getByTestId('need-it-pr-window-installer').getByTestId('call')).toHaveAttribute('href', 'tel:0491575789');
      await expect(page.getByTestId('job-tabs').getByRole('link', { name: 'Program' })).toHaveAttribute('aria-current', 'page');
      await expect(page.getByTestId('job-bar').getByTestId('back')).toHaveText('Program');
      await expect(page.getByTestId('step-detail').getByRole('button')).toHaveCount(0);
      await oneH1(page);
      for (const b of BANNED) await expect(page.getByTestId('step-detail')).not.toContainText(b);
      await shoot(page, info, 'step-windows', w);

      await page.goto('./#/jobs/seaview/steps/sv-slab-insp');
      const hold = page.getByTestId('hold-point');
      await expect(hold.getByTestId('hold-readiness')).toHaveText('!1 of 3 required photo sets uploaded');
      await expect(hold.getByTestId('hold-category')).toHaveText(['Steel reinforcement in place4 photos', 'Plumbing under slab!none yet', 'Membrane and termite barrier!none yet']);
      await expect(hold.getByTestId('hold-photos')).toHaveAttribute('href', '#/jobs/seaview/photos');
      await shoot(page, info, 'step-slab-insp', w);
    });

    test(`design checklist: West St (${w})`, async ({ page }, info) => {
      await page.goto('./#/jobs/west-st');
      await expect(page).toHaveURL(/#\/jobs\/west-st\/checklist$/);
      await expect(page.getByTestId('ck-outstanding')).toHaveText('2 outstanding, oldest 23 days');
      await expect(page.getByTestId('ck-freshness')).toHaveText('Last confirmed 3 days ago');
      const current = page.getByTestId('ck-stage-2');
      await expect(current).toHaveAttribute('aria-current', 'step');
      await expect(current).toContainText('Pending approval');
      await expect(current.getByTestId('ck-stage-words-2')).toHaveText('Under way');
      await expect(current.getByRole('listitem')).toHaveCount(2);
      await expect(current.getByRole('listitem').first()).toContainText('outstanding 23 days');
      await expect(page.getByTestId('ck-done')).toContainText('Done (3)');
      await expect(page.getByTestId('checklist').getByRole('button')).toHaveCount(0);
      await oneH1(page);
      await shoot(page, info, 'checklist-west', w);
    });
  });
}
