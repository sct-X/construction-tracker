import { expect, test, type Page } from '@playwright/test';
import { deflateSync } from 'node:zlib';

/**
 * UI_PLAN flow b: Alec uploads photos and reception drops. As Alec on Park
 * Rd: pick a stage and a category (buttons), choose 3 photos, lose signal
 * before pressing upload, see the calm note and the badge of 3, reload and
 * find them still there, open the queue, get signal back and watch them
 * send by themselves. No "$" on any of it. Both projects.
 */

// ---- a tiny PNG, made here so the spec has no fixture files ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
/** An 8x8 RGB PNG in one flat colour. */
function png(r: number, g: number, b: number): Buffer {
  const size = 8;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 3)] = 0; // filter none
    for (let x = 0; x < size; x++) {
      const i = y * (1 + size * 3) + 1 + x * 3;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const FILES = [
  { name: 'window-1.png', mimeType: 'image/png', buffer: png(180, 60, 20) },
  { name: 'window-2.png', mimeType: 'image/png', buffer: png(40, 90, 140) },
  { name: 'window-3.png', mimeType: 'image/png', buffer: png(90, 140, 60) },
];

const JOB = 'park-rd';
const STAGE = 'pr-st-lockup';
const CATEGORY = 'pr-pc-lockup-windows';
const DATA_KEY = 'construction-tracker.data.v1';

async function noMoney(page: Page) {
  const text = await page.locator('body').innerText();
  expect(text).not.toContain('$');
}

/** Uploaded Park Rd photos in the mock's records, read straight from localStorage so the count does not depend on another screen. */
async function uploadedInCategory(page: Page): Promise<number> {
  return page.evaluate(
    ([key, cat]) => {
      const raw = localStorage.getItem(key);
      if (!raw) return -1;
      const data = JSON.parse(raw) as { photos?: { categoryId: string }[] } | { data?: { photos?: { categoryId: string }[] } };
      const photos = ('photos' in data ? data.photos : (data as { data?: { photos?: { categoryId: string }[] } }).data?.photos) ?? [];
      return photos.filter((p) => p.categoryId === cat).length;
    },
    [DATA_KEY, CATEGORY] as const,
  );
}

test.describe('Flow b: Alec uploads photos and reception drops', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`#/jobs/${JOB}?as=alec&today=2026-09-17`);
    await page.getByTestId('dev-reset').click();
    await expect(page.getByTestId('dev-offline')).not.toBeChecked();
  });

  test('photos wait on the phone without signal, survive a reload, and send by themselves', async ({ page }) => {
    const before = await uploadedInCategory(page);
    expect(before).toBeGreaterThanOrEqual(0);

    // 1. From Today, the Upload photos button (or the route straight away).
    const todayButton = page.getByTestId('today-add-photos');
    if (await todayButton.count()) await todayButton.click();
    else await page.goto(`#/jobs/${JOB}/upload?as=alec&today=2026-09-17`);
    await expect(page.getByTestId('photo-upload')).toBeVisible();
    await noMoney(page);

    // 2, 3. Stage and category are buttons, at least 56px tall; the required ones say so in words.
    const stage = page.getByTestId(`upload-stage-${STAGE}`);
    await expect(stage).toBeVisible();
    expect((await stage.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(56);
    await stage.click();
    await expect(stage).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('photo-upload').locator('select')).toHaveCount(0);

    const category = page.getByTestId(`upload-category-${CATEGORY}`);
    await expect(category).toContainText('Windows installed');
    await expect(category).toContainText('none yet');
    expect((await category.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(56);
    await expect(page.getByTestId('upload-category-pr-pc-general')).toBeVisible();
    await category.click();
    await expect(category).toHaveAttribute('aria-checked', 'true');

    // 4, 5. Three photos from the "camera roll"; thumbnails appear; the button counts them.
    await page.getByTestId('upload-file-input').setInputFiles(FILES);
    await expect(page.getByTestId('upload-preview-3')).toBeVisible();
    await expect(page.getByTestId('upload-submit')).toHaveText('Upload 3 photos');
    await expect(page.getByTestId('upload-submit')).toBeEnabled();

    // 8. Reception drops before he presses upload.
    await page.getByTestId('dev-offline').check();
    await expect(page.getByTestId('offline-bar')).toBeVisible();
    await page.getByTestId('upload-submit').click();

    // A calm note, no red, no dialog; the badge carries 3.
    const note = page.getByTestId('upload-offline-note');
    await expect(note).toBeVisible();
    await expect(note).toContainText('No signal: 3 photos saved on this phone');
    await expect(note).toContainText("they'll send when you're back in range");
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByTestId('upload-problem')).toHaveCount(0);
    await expect(page.getByTestId('queue-badge')).toContainText('3');
    await expect(page.getByTestId('queue-badge')).toHaveAttribute('href', '#/queue');
    await expect(page.getByTestId('queue-badge')).toContainText('waiting to send');
    await noMoney(page);
    expect(await uploadedInCategory(page)).toBe(before);

    // 11. The app is closed and reopened: the queue is still on the phone.
    await page.reload();
    await expect(page.getByTestId('photo-upload')).toBeVisible();
    await expect(page.getByTestId('offline-bar')).toBeVisible();
    await expect(page.getByTestId('queue-badge')).toContainText('3');
    await expect(page.getByTestId(`upload-category-${CATEGORY}`)).toContainText('3 waiting to send');

    // The queue screen lists them under the job and category, with words for the state.
    await page.getByTestId('queue-badge').click();
    await expect(page.getByTestId('upload-queue')).toBeVisible();
    const items = page.locator('[data-testid^="queue-item-"]');
    await expect(items).toHaveCount(3);
    await expect(page.getByTestId('upload-queue')).toContainText('64-66 Park Rd');
    await expect(page.getByTestId('upload-queue')).toContainText('Lock-up: Windows installed');
    await expect(page.getByTestId('upload-queue')).toContainText('3 photos waiting to send');
    await expect(page.getByTestId('upload-queue')).toContainText('only while the app is open');
    await expect(page.getByTestId('queue-send-now')).toBeDisabled();
    await expect(page.getByTestId('queue-offline-note')).toContainText('No signal');
    await expect(page.locator('[data-testid^="queue-remove-"]')).toHaveCount(3);
    await expect(page.getByTestId('queue-empty')).toHaveCount(0);
    await noMoney(page);

    // 10. Signal returns: everything sends without a tap.
    await page.getByTestId('dev-offline').uncheck();
    await expect(page.getByTestId('queue-empty')).toBeVisible();
    await expect(page.getByTestId('queue-empty')).toContainText("Everything's uploaded");
    await expect(items).toHaveCount(0);
    await expect(page.getByTestId('queue-badge')).toHaveCount(0);
    await noMoney(page);

    // Each photo landed once, under Lock-up, Windows installed.
    await expect.poll(() => uploadedInCategory(page)).toBe(before + 3);
    await page.goto(`#/jobs/${JOB}/photos?as=alec&today=2026-09-17`);
    if (await page.getByTestId('gallery').count()) {
      await expect(page.getByTestId(`gallery-category-${CATEGORY}`)).toContainText('3 photos');
      await noMoney(page);
    }
    await page.goto(`#/jobs/${JOB}?as=alec&today=2026-09-17`);
    await expect(page.getByTestId('queue-badge')).toHaveCount(0);
    await noMoney(page);
  });

  test('with signal the same path sends at once and says where the photos went', async ({ page }) => {
    const before = await uploadedInCategory(page);
    await page.goto(`#/jobs/${JOB}/upload?as=alec&today=2026-09-17&stage=${STAGE}&category=${CATEGORY}`);
    await expect(page.getByTestId(`upload-stage-${STAGE}`)).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId(`upload-category-${CATEGORY}`)).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('upload-file-input').setInputFiles(FILES);
    // Remove one blurry shot: the button follows the count.
    await page.getByTestId('upload-remove-2').click();
    await expect(page.getByTestId('upload-submit')).toHaveText('Upload 2 photos');
    await page.getByTestId('upload-submit').click();
    await expect(page.getByTestId('upload-done')).toContainText('All 2 photos uploaded to Lock-up, Windows installed.');
    await expect(page.getByTestId('queue-badge')).toHaveCount(0);
    await expect(page.getByTestId('upload-finish')).toHaveAttribute('href', `#/jobs/${JOB}`);
    await expect.poll(() => uploadedInCategory(page)).toBe(before + 2);
    await noMoney(page);
  });

  test('Remove takes a photo out of the queue and the badge follows', async ({ page }) => {
    await page.goto(`#/jobs/${JOB}/upload?as=alec&today=2026-09-17&stage=${STAGE}&category=${CATEGORY}&offline=1`);
    await page.getByTestId('upload-file-input').setInputFiles(FILES.slice(0, 2));
    await page.getByTestId('upload-submit').click();
    await expect(page.getByTestId('queue-badge')).toContainText('2');
    await page.goto('#/queue?as=alec');
    const first = page.locator('[data-testid^="queue-remove-"]').first();
    expect((await first.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(56);
    await first.click();
    await expect(page.locator('[data-testid^="queue-item-"]')).toHaveCount(1);
    await expect(page.getByTestId('upload-queue')).toContainText('1 photo waiting to send');
    await page.getByTestId('dev-offline').uncheck();
    await expect(page.getByTestId('queue-empty')).toBeVisible();
    await page.getByTestId('dev-reset').click();
  });

  test('a stage with no categories offers General, and Raff can upload too', async ({ page }) => {
    await page.goto(`#/jobs/${JOB}/upload?as=raff&today=2026-09-17`);
    await page.getByTestId('upload-stage-pr-st-external').click();
    await expect(page.getByTestId('upload-category-pr-pc-sw-before-backfill')).toContainText('Needed for the');
    await page.getByTestId('upload-stage-pr-st-site').click();
    await expect(page.getByTestId('upload-no-categories')).toContainText("hasn't set up photo categories");
    await expect(page.getByTestId('upload-category-pr-pc-general')).toBeVisible();
    await expect(page.getByTestId('photo-upload').locator('select')).toHaveCount(0);
  });
});
