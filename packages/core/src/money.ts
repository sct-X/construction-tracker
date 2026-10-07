/** Slip cost = slip days / 7 x weekly holding cost, rounded to the nearest $10 (rule 4). */
export function slipCost(slipDays: number, weeklyHoldingCost: number | null): number | null {
  if (weeklyHoldingCost === null) return null;
  const raw = (slipDays / 7) * weeklyHoldingCost;
  // Round half away from zero so +$1,425 and -$1,425 are mirror images.
  const tens = Math.sign(raw) * Math.round(Math.abs(raw) / 10);
  return tens * 10 || 0;
}

/** "$9,000", "-$1,430". Whole dollars. */
export function formatMoney(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const digits = String(Math.abs(Math.round(amount))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}$${digits}`;
}
