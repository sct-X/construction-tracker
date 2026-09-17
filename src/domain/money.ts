/**
 * Money fields, by name, across every record and every calculator result.
 *
 * Rule (locked): the data layer deletes each of these keys, recursively, from
 * everything the site role reads. Deleted, never set to 0. The UI's money
 * component renders nothing (label included) when a field is absent.
 *
 * Naming convention: every money field ends in `Cost` and is typed
 * `number | undefined`. Add new ones here first.
 */
export const MONEY_FIELDS: readonly string[] = [
  'weeklyHoldingCost', // Job
  'slipCost', // JobForecast, MondayRow (vs last Monday's snapshot)
  'slipSincePlanCost', // JobForecast (vs the original plan)
  'costDelta', // EtaPreview
  'slipCostAfter', // EtaPreview
] as const;

export type MoneyField = (typeof MONEY_FIELDS)[number];

const MONEY_SET = new Set<string>(MONEY_FIELDS);

export function isMoneyField(key: string): boolean {
  return MONEY_SET.has(key);
}

/**
 * Deep-copies `value` with every MONEY_FIELD key removed at every depth.
 * Arrays, plain objects and primitives only (records are JSON-shaped).
 */
export function stripMoney<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripMoney(v)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (MONEY_SET.has(k)) continue;
      out[k] = stripMoney(v);
    }
    return out as T;
  }
  return value;
}

/** Slip cost: slip days / 7 x weekly holding cost, rounded to the nearest $10 (rule 4). */
export function slipCostFor(slipDays: number, weeklyHoldingCost: number | undefined): number | undefined {
  if (weeklyHoldingCost === undefined) return undefined;
  return Math.round((slipDays / 7) * weeklyHoldingCost / 10) * 10;
}

/** "$9,000", "-$1,430". No decimals: holding costs are whole dollars. */
export function formatMoney(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(amount)).toLocaleString('en-AU')}`;
}
