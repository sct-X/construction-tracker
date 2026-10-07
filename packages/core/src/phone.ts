/**
 * Australian phone numbers for the trade directory. Setup validates with
 * these, so every saved number makes a working tel: link.
 */

/** What to tell someone whose number doesn't parse. */
export const AU_PHONE_HELP =
  'That doesn\'t look like an Australian phone number. Use a mobile like 0491 570 006, a landline with its area code like 02 5550 1234, or a 13, 1300 or 1800 number.';

/**
 * "0491570006", "+61 491 570 006", "(02) 5550-1234", "1300 975 707", "13 12 34"
 * -> the number written the usual way ("0491 570 006", "02 5550 1234",
 * "1300 975 707", "13 12 34"). Null when it isn't an Australian number.
 */
export function formatAuPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!/^[+\d\s()\-.]+$/.test(raw)) return null;
  let d = raw.replace(/\D/g, '');
  if (raw.startsWith('+')) {
    if (!d.startsWith('61')) return null;
    d = `0${d.slice(2)}`;
  } else if (d.startsWith('61') && d.length === 11) {
    d = `0${d.slice(2)}`;
  }
  // +61 (0)4... written with the trunk zero kept.
  if (d.startsWith('00') && d.length === 11) d = d.slice(1);
  if (/^04\d{8}$/.test(d) || /^05\d{8}$/.test(d)) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  if (/^0[2378]\d{8}$/.test(d)) return `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}`;
  if (/^1[38]00\d{6}$/.test(d)) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  if (/^13\d{4}$/.test(d)) return `${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4)}`;
  return null;
}

export function isAuPhone(input: string | null | undefined): boolean {
  return formatAuPhone(input) !== null;
}
