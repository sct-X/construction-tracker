/**
 * Flow a through the REAL bot, for Playwright's api-change project: Dominic
 * texts "Park Rd windows now arriving 16 Nov", the bot (grammY, fake Telegram
 * transport, real parser over a scripted FakeLlm) shows the confirm card, and
 * Confirm is pressed. The change lands in DATA_DIR's database exactly as it
 * would from Telegram, so the web app's Why it moved quotes the message.
 *
 *   DATA_DIR=<dir> CT_TODAY=2026-09-17 tsx --tsconfig packages/server/tsconfig.json packages/server/scripts/bot-change.ts
 *
 * Prints the card and the saved text as JSON (as Dominic reads them, markup stripped; `cardHtml` is the
 * Telegram HTML sent). Exit code 1 if no card came or Confirm didn't save.
 */
import { clockFromOverride, fixedClock, isISODate } from '@ct/core';
import { createParser, FakeLlm, toolCall } from '@ct/llm';
import { createHarness } from '@ct/bot';
import { dataPaths, loadEnvFile, resolveDataDir, SqliteStore, todayOverrideFromEnv } from '../src/index.js';

const FLOW_A_TEXT = 'Park Rd windows now arriving 16 Nov';

loadEnvFile();
const today = todayOverrideFromEnv();
if (today && !isISODate(today)) throw new Error(`CT_TODAY must be YYYY-MM-DD, got ${today}`);
// A fixed time of day keeps the message's received-at stable; without CT_TODAY, the real clock.
const clock = today ? fixedClock(today, '10:00') : clockFromOverride(null);
const paths = dataPaths(resolveDataDir(process.env));
const store = new SqliteStore(paths.dbFile, { clock });

try {
  // What a model would answer for this message (the eval's eta-park-windows case).
  const llm = new FakeLlm([toolCall('set_shipment_eta', { shipment: 'windows', job: 'Park Rd', eta: '16 Nov' })]);
  const h = createHarness({ store, clock, parser: createParser(llm) });
  await h.text(FLOW_A_TEXT);
  const card = h.lastWithButton('Confirm');
  const cardText = card.text;
  const cardHtml = card.html;
  await h.press(card.messageId, 'Confirm');
  const saved = h.messages.get(card.messageId)!.text;
  const ok = saved.startsWith('Saved ✓');
  console.log(JSON.stringify({ ok, card: cardText, cardHtml, saved }, null, 2));
  if (!ok) {
    console.error(h.log.lines.join('\n'));
    process.exitCode = 1;
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
} finally {
  store.close();
}
