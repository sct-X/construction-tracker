/**
 * Setup form checks in plain words, run before anything goes to the data
 * layer (core's own refusals are plain too, but its type errors are not).
 * Each returns the message to show, or null when the value is fine.
 */
import { AU_PHONE_HELP, formatAuPhone, isISODate } from '@ct/core';

export function checkName(v: string, what: string): string | null {
  if (!v.trim()) return `Give the ${what} a name.`;
  if (v.trim().length > 120) return `Keep the ${what} name under 120 characters.`;
  return null;
}

/** "10" -> 10; anything else -> null. */
export function wholeNumber(v: string): number | null {
  const t = v.trim();
  return /^\d+$/.test(t) ? Number(t) : null;
}

export function checkDays(v: string): string | null {
  const n = wholeNumber(v);
  if (n === null || n < 1 || n > 1000) return 'Working days must be a whole number from 1 to 1000.';
  return null;
}

/** Lead times are calendar weeks; halves are fine ("1.5"). */
export function weeksValue(v: string): number | null {
  const t = v.trim();
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

export function checkWeeks(v: string): string | null {
  const n = weeksValue(v);
  if (n === null || n > 104) return 'Lead time is in weeks: a number from 0 to 104.';
  return null;
}

/** "$4,500", "4500" -> 4500; blank -> null (no holding cost). */
export function moneyValue(v: string): number | null {
  const t = v.replace(/[$,\s]/g, '');
  return /^\d+(\.\d{1,2})?$/.test(t) ? Number(t) : null;
}

export function checkMoney(v: string): string | null {
  if (!v.trim()) return null;
  return moneyValue(v) === null ? 'Weekly holding cost is dollars a week, like 4500. Leave it blank if there is none.' : null;
}

export function checkDate(v: string, what: string): string | null {
  return isISODate(v) ? null : `Pick the ${what}.`;
}

export function checkPhone(v: string): string | null {
  if (!v.trim()) return null;
  return formatAuPhone(v) ? null : AU_PHONE_HELP;
}
