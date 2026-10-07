/**
 * Propose and confirm one operation against DATA_DIR's database, as the bot
 * would after Dominic taps Confirm. For e2e tests and poking at the data.
 *
 *   npm run apply-op -- <op> '<json args>' [--message "text"] [--data-dir DIR] [--today YYYY-MM-DD]
 *   npm run apply-op -- set_shipment_eta '{"shipment":"windows","job":"Park Rd","eta":"16 Nov"}'
 *
 * DATA_DIR and CT_TODAY come from the environment (or .env) unless given as
 * flags. Prints the change set as JSON. Exit code 1 on a refusal or question.
 */
import { clockFromOverride, isISODate } from '@ct/core';
import { applyOperation, dataPaths, loadEnvFile, resolveDataDir, SqliteStore, todayOverrideFromEnv } from '../src/index.js';

function flag(argv: string[], name: string): string | null {
  const i = argv.indexOf(name);
  if (i < 0) return null;
  const v = argv[i + 1];
  if (v === undefined) throw new Error(`${name} needs a value`);
  argv.splice(i, 2);
  return v;
}

const argv = process.argv.slice(2);
loadEnvFile();
const dataDir = flag(argv, '--data-dir');
const today = flag(argv, '--today') ?? todayOverrideFromEnv();
const message = flag(argv, '--message');
const [op, json = '{}'] = argv;
if (!op) {
  console.error("Usage: apply-op <op> '<json args>' [--message text] [--data-dir DIR] [--today YYYY-MM-DD]");
  process.exit(2);
}
if (today && !isISODate(today)) throw new Error(`--today must be YYYY-MM-DD, got ${today}`);

const paths = dataPaths(resolveDataDir(dataDir ? { DATA_DIR: dataDir } : process.env));
const clock = clockFromOverride(today);
const store = new SqliteStore(paths.dbFile, { clock });
try {
  const r = applyOperation(store, clock, op, JSON.parse(json), { message });
  if (!r.ok) {
    console.error(JSON.stringify({ ok: false, reason: r.reason, result: r.result }, null, 2));
    process.exitCode = 1;
  } else {
    const i = r.impacts[0];
    console.log(
      JSON.stringify(
        { ok: true, changeSetId: r.changeSet.id, summary: r.summary, finishAfter: i?.finishAfter ?? null, slipAfter: i?.slipAfter ?? null, slipCostAfter: i?.slipCostAfter ?? null },
        null,
        2,
      ),
    );
  }
} finally {
  store.close();
}
