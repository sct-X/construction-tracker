import { expect, test } from '@playwright/test';

/**
 * Screen 5, the build job program. Desktop: the Gantt with a bar per step,
 * the planned outline behind it, the today line, no sideways page scroll,
 * a bar opens step detail. Phone: the stages strip and the three-week
 * look-ahead. Alec sees no money anywhere on it.
 */

const PARK_STEPS = [
  'pr-site-setup',
  'pr-excavation',
  'pr-underslab',
  'pr-formwork',
  'pr-slab-insp',
  'pr-pour-slab',
  'pr-frame',
  'pr-frame-insp',
  'pr-trusses',
  'pr-roof-cover',
  'pr-fascia',
  'pr-brickwork',
  'pr-roof-plumbing',
  'pr-cladding',
  'pr-install-windows',
  'pr-external-doors',
  'pr-stormwater',
  'pr-stormwater-insp',
  'pr-landscaping',
  'pr-rough-in',
  'pr-insulation',
  'pr-plasterboard',
  'pr-waterproofing',
  'pr-tiling',
  'pr-kitchen',
  'pr-painting',
  'pr-fit-off',
  'pr-final-insp',
  'pr-handover',
];

test.describe('Program: desktop Gantt', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 768, 'desktop only');

  test('Park Rd renders every step as a bar with its planned outline and the today line', async ({ page }) => {
    await page.goto('#/jobs/park-rd/program?as=dominic&today=2026-09-17');
    await expect(page.getByTestId('gantt')).toBeVisible();

    // One bar per step, one planned outline per step (attached, some scrolled out of view).
    await expect(page.locator('[data-testid^="gantt-bar-"]')).toHaveCount(PARK_STEPS.length);
    for (const id of PARK_STEPS) {
      await expect(page.getByTestId(`gantt-bar-${id}`)).toHaveCount(1);
      await expect(page.getByTestId(`gantt-planned-${id}`)).toHaveCount(1);
    }
    await expect(page.getByTestId('gantt-bar-pr-install-windows')).toBeVisible();
    await expect(page.getByTestId('gantt-bar-pr-install-windows')).toHaveAttribute('href', '#/steps/pr-install-windows');
    await expect(page.getByTestId('gantt-planned-pr-install-windows')).toBeAttached();
    await expect(page.getByTestId('gantt-today')).toBeVisible();

    // Hold points carry a glyph and the words, not colour alone.
    await expect(page.getByTestId('gantt-row-pr-slab-insp')).toContainText('hold point');

    // Stage rows group the steps.
    await expect(page.getByTestId('gantt-stage-pr-st-lockup')).toContainText('Lock-up');

    // The chart scrolls sideways; the page does not.
    const overflow = (await page.evaluate('document.documentElement.scrollWidth - window.innerWidth')) as number;
    expect(overflow).toBeLessThanOrEqual(0);
    const chartScrolls = (await page.evaluate(
      "(() => { const el = document.querySelector('.gantt__scroll'); return el.scrollWidth > el.clientWidth; })()",
    )) as boolean;
    expect(chartScrolls).toBe(true);

    // Pointing at a bar names what it waits for.
    await page.getByTestId('gantt-bar-pr-install-windows').hover();
    await expect(page.getByTestId('gantt-caption')).toContainText('Waits for External cladding');

    // Clicking a bar opens step detail.
    await page.getByTestId('gantt-bar-pr-install-windows').click();
    await expect(page).toHaveURL(/#\/steps\/pr-install-windows$/);
  });

  test('a late step says how late in words beside its bar', async ({ page }) => {
    // Move the windows ETA to 16 Nov (flow d) through the shipment screen, then look at the program.
    // The save button's id is Part A's; accept either spelling while Stage 2 lands.
    await page.goto('#/shipments/sh-park-windows?as=dominic&today=2026-09-17');
    await page.getByTestId('dev-reset').click();
    const eta = page.getByTestId('shipment-eta-input');
    test.skip((await eta.count()) === 0, 'shipment detail not built in this build');
    await eta.fill('2026-11-16');
    await page.getByTestId('shipment-save-eta').or(page.getByTestId('eta-save')).click();
    await page.goto('#/jobs/park-rd/program?as=dominic&today=2026-09-17');
    await expect(page.getByTestId('gantt-late-pr-install-windows')).toContainText('14 days late');
    await expect(page.getByTestId('gantt-planned-pr-install-windows')).toHaveAttribute('data-moved', 'true');
    // Late only shows just the moved chain.
    await page.getByTestId('program-view-late').click();
    await expect(page.getByTestId('gantt-bar-pr-install-windows')).toBeVisible();
    await expect(page.getByTestId('gantt-bar-pr-roof-plumbing')).toHaveCount(0);
    await page.getByTestId('dev-reset').click();
  });

  test('stage-level jobs draw their placeholder steps as stage bars; design jobs get a note', async ({ page }) => {
    await page.goto('#/jobs/seaview/program?as=dominic&today=2026-09-17');
    await expect(page.getByTestId('gantt-bar-sv-frame')).toBeAttached();
    await expect(page.getByTestId('gantt-row-sv-frame')).toContainText('Frame');
    await expect(page.getByTestId('gantt-bar-sv-slab-insp')).toBeAttached();

    await page.goto('#/jobs/west-st/program?as=dominic&today=2026-09-17');
    await expect(page.getByTestId('program-design-note')).toContainText('design job');
    await expect(page.getByTestId('program-checklist-link')).toHaveAttribute('href', '#/jobs/west-st');
    await expect(page.getByTestId('gantt')).toHaveCount(0);
  });
});

test.describe('Program: phone look-ahead', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 768, 'phone only');

  test('Raff sees the stages strip and three weeks of look-ahead', async ({ page }) => {
    await page.goto('#/jobs/park-rd/program?as=raff&today=2026-09-17');
    await expect(page.getByTestId('stages-strip')).toBeVisible();
    await expect(page.getByTestId('stage-chip-pr-st-lockup')).toHaveAttribute('aria-current', 'true');
    await expect(page.getByTestId('lookahead')).toBeVisible();
    await expect(page.getByTestId('lookahead-week-1')).toContainText('This week');
    await expect(page.getByTestId('lookahead-week-1')).toContainText('14-18 Sep');
    await expect(page.getByTestId('lookahead-week-2')).toContainText('21-25 Sep');
    await expect(page.getByTestId('lookahead-week-3')).toContainText('28 Sep-2 Oct');
    await expect(page.locator('[data-testid^="lookahead-week-"]')).toHaveCount(3);

    // This week: roof plumbing and cladding; next week: stormwater with its unconfirmed plumber.
    await expect(page.getByTestId('lookahead-step-pr-roof-plumbing')).toContainText('Mon to Thu');
    await expect(page.getByTestId('lookahead-step-pr-cladding')).toContainText('from Wed, 3 wks');
    await expect(page.getByTestId('lookahead-step-pr-stormwater')).toContainText('not confirmed');

    // No Gantt on the phone by default; the whole row is a 56px target.
    await expect(page.getByTestId('gantt')).toHaveCount(0);
    const box = await page.getByTestId('lookahead-step-pr-roof-plumbing').boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(56);

    // Tapping a chip jumps to the stage band; tapping a row opens the step.
    await page.getByTestId('stage-chip-pr-st-fitout').click();
    await expect(page.getByTestId('stage-band-pr-st-fitout')).toBeInViewport();
    await page.getByTestId('lookahead-step-pr-roof-plumbing').click();
    await expect(page).toHaveURL(/#\/steps\/pr-roof-plumbing$/);
  });

  test('Alec sees the program with no money on it', async ({ page }) => {
    await page.goto('#/jobs/park-rd/program?as=alec&today=2026-09-17');
    await expect(page.getByTestId('lookahead')).toBeVisible();
    await expect(page.getByTestId('stages-strip')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('$');
    const overflow = (await page.evaluate('document.documentElement.scrollWidth - window.innerWidth')) as number;
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
