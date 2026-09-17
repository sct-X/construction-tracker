import { expect, test, type Page } from '@playwright/test';
import { deflateSync } from 'node:zlib';

/**
 * UI_PLAN flow e: Raff tries to tick off a hold point with photos missing.
 * Seaview St's slab inspection is on Mon 28 Sep 2026, so today is set there
 * (a step cannot be marked done before its forecast start, PROGRESS decision E).
 * Raff opens the step, taps Mark done, is refused in words naming the two
 * empty sets, follows the row's own "Add photos" link for one set, uploads a
 * photo, comes back, is refused again naming the last set, uploads for it,
 * and Mark done goes through: the step reads Done and the overview's next
 * hold point moves on. Both projects. Reset at the end.
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
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 3)] = 0;
    for (let x = 0; x < size; x++) {
      const i = y * (1 + size * 3) + 1 + x * 3;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const STEP = 'sv-slab-insp';
const STAGE = 'sv-st-slab';
const PLUMBING = 'sv-pc-slab-plumbing';
const MEMBRANE = 'sv-pc-slab-membrane';
const TODAY = '2026-09-28';
const STEP_URL = `#/steps/${STEP}?as=raff&today=${TODAY}`;

/** Follows a row's Add photos link, uploads one photo to the preset category, and returns to the step. */
async function uploadFor(page: Page, categoryId: string, file: { name: string; buffer: Buffer }) {
  const link = page.getByTestId(`holdpoint-add-${categoryId}`);
  await expect(link).toHaveAttribute('href', `#/jobs/seaview/upload?stage=${STAGE}&category=${categoryId}&return=/steps/${STEP}`);
  await link.click();
  await expect(page.getByTestId('photo-upload')).toBeVisible();
  // Job, stage and category are already set (flow e step 5).
  await expect(page.getByTestId(`upload-stage-${STAGE}`)).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId(`upload-category-${categoryId}`)).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('upload-file-input').setInputFiles({ ...file, mimeType: 'image/png' });
  await expect(page.getByTestId('upload-submit')).toHaveText('Upload 1 photo');
  await page.getByTestId('upload-submit').click();
  await expect(page.getByTestId('upload-done')).toContainText('All 1 photo uploaded');
  // Done comes back to the step, not the job.
  await page.getByTestId('upload-finish').click();
  await expect(page).toHaveURL(new RegExp(`#/steps/${STEP}`));
  await expect(page.getByTestId('step-detail')).toBeVisible();
}

test.describe('Flow e: Raff tries to tick off a hold point with photos missing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(STEP_URL);
    await page.getByTestId('dev-reset').click();
    // Reset returns today to 17 Sep; the flow needs the inspection to have started (the URL sets it again on load).
    await page.reload();
    await expect(page.getByTestId('dev-today')).toHaveValue(TODAY);
  });

  test('Mark done is refused until every required set has an uploaded photo, then goes through', async ({ page }) => {
    // 1, 2. The step sheet lists the required sets with their counts.
    await expect(page.getByTestId('step-detail')).toBeVisible();
    await expect(page.getByTestId('holdpoint-readiness')).toContainText('1 of 3 required photo sets uploaded');
    await expect(page.getByTestId('holdpoint-category-sv-pc-slab-steel')).toContainText('4 photos');
    await expect(page.getByTestId(`holdpoint-category-${PLUMBING}`)).toContainText('none yet');
    await expect(page.getByTestId(`holdpoint-category-${MEMBRANE}`)).toContainText('none yet');
    await expect(page.getByTestId('holdpoint-refusal')).toHaveCount(0);
    await expect(page.getByTestId('holdpoint-ready')).toHaveCount(0);

    // 3, 4. Mark done is live, and refuses in words naming the two empty sets.
    const markDone = page.getByTestId('step-mark-done');
    await expect(markDone).toBeEnabled();
    await markDone.click();
    await expect(page.getByTestId('holdpoint-refusal')).toHaveText(
      "Can't tick this off yet. The certifier needs before-cover photos and 2 categories are empty: Plumbing under slab; Membrane and termite barrier.",
    );
    await expect(page.getByTestId('step-status')).toHaveText('Not started');
    // No dialog, no red: an amber sentence beside the list.
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // 5. Each empty set offers its own Add photos, straight into upload with the category set.
    await expect(page.getByTestId(`holdpoint-add-${PLUMBING}`)).toHaveText(/Add photos/);
    await expect(page.getByTestId(`holdpoint-add-${MEMBRANE}`)).toHaveText(/Add photos/);
    await expect(page.getByTestId('holdpoint-add-sv-pc-slab-steel')).toHaveCount(0);

    // 6a. One set filled: still refused, naming only the one left.
    await uploadFor(page, PLUMBING, { name: 'plumbing.png', buffer: png(60, 110, 160) });
    await expect(page.getByTestId(`holdpoint-category-${PLUMBING}`)).toContainText('1 photo');
    await expect(page.getByTestId('holdpoint-readiness')).toContainText('2 of 3 required photo sets uploaded');
    await expect(page.getByTestId(`holdpoint-add-${PLUMBING}`)).toHaveCount(0);
    await page.getByTestId('step-mark-done').click();
    await expect(page.getByTestId('holdpoint-refusal')).toHaveText(
      "Can't tick this off yet. The certifier needs before-cover photos and 1 category is empty: Membrane and termite barrier.",
    );
    await expect(page.getByTestId('step-status')).toHaveText('Not started');

    // 6b. The last set filled: every row has a photo and the sheet says it can be ticked.
    await uploadFor(page, MEMBRANE, { name: 'membrane.png', buffer: png(150, 120, 60) });
    await expect(page.getByTestId(`holdpoint-category-${MEMBRANE}`)).toContainText('1 photo');
    await expect(page.getByTestId('holdpoint-readiness')).toContainText('3 of 3 required photo sets uploaded');
    await expect(page.getByTestId('holdpoint-ready')).toContainText('You can tick this off');
    await expect(page.getByTestId('holdpoint-refusal')).toHaveCount(0);
    await expect(page.getByTestId('holdpoint-add-photos')).toHaveCount(0);

    // Mark done now works and the step closes.
    await page.getByTestId('step-mark-done').click();
    await expect(page.getByTestId('step-status')).toHaveText('Done');
    await expect(page.getByTestId('holdpoint-refusal')).toHaveCount(0);
    await expect(page.getByTestId('step-mark-done')).toHaveCount(0);
    await expect(page.getByTestId('step-reopen')).toBeVisible();

    // The overview's next hold point moves on (Seaview has only the one).
    await page.goto(`#/jobs/seaview?as=raff&today=${TODAY}`);
    const next = page.getByTestId('job-next-holdpoint');
    await expect(next).toBeVisible();
    await expect(next).not.toContainText('Slab inspection before pour');
    await expect(next).toContainText('No hold points left');

    // Reset for the next spec.
    await page.getByTestId('dev-reset').click();
    await page.goto(STEP_URL);
    await expect(page.getByTestId('holdpoint-readiness')).toContainText('1 of 3 required photo sets uploaded');
    await expect(page.getByTestId('step-status')).toHaveText('Not started');
  });

  test('queued photos are named per set and do not count', async ({ page }) => {
    // Without signal, an upload waits on the phone: the row says so and Mark done needs signal.
    await page.getByTestId(`holdpoint-add-${PLUMBING}`).click();
    await expect(page.getByTestId('photo-upload')).toBeVisible();
    await page.getByTestId('dev-offline').check();
    await page.getByTestId('upload-file-input').setInputFiles([
      { name: 'p1.png', mimeType: 'image/png', buffer: png(10, 20, 30) },
      { name: 'p2.png', mimeType: 'image/png', buffer: png(30, 20, 10) },
    ]);
    await page.getByTestId('upload-submit').click();
    await expect(page.getByTestId('upload-offline-note')).toContainText('2 photos saved on this phone');
    await page.getByTestId('upload-finish').click();
    await expect(page.getByTestId('step-detail')).toBeVisible();

    await expect(page.getByTestId(`holdpoint-queued-${PLUMBING}`)).toHaveText("2 waiting to send, they don't count yet");
    await expect(page.getByTestId(`holdpoint-category-${PLUMBING}`)).toContainText('none yet');
    await expect(page.getByTestId('holdpoint-queued')).toContainText("2 photos are waiting to upload. You can tick this off once they've sent.");
    await expect(page.getByTestId('holdpoint-readiness')).toContainText('1 of 3 required photo sets uploaded');
    await expect(page.getByTestId('step-mark-done')).toBeDisabled();

    // Signal back: they send, and the count moves.
    await page.getByTestId('dev-offline').uncheck();
    await expect(page.getByTestId(`holdpoint-category-${PLUMBING}`)).toContainText('2 photos');
    await expect(page.getByTestId(`holdpoint-queued-${PLUMBING}`)).toHaveCount(0);
    await expect(page.getByTestId('holdpoint-readiness')).toContainText('2 of 3 required photo sets uploaded');

    await page.getByTestId('dev-reset').click();
  });
});
