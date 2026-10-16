// Money is kept in integer cents everywhere; these helpers format it for the screen.

const GROUP = " "; // no-break space: R12 345
const MINUS = "−"; // real minus sign: −R240

function group(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, GROUP);
}

/** Whole rand, e.g. 1234500 → "R12 345", -24000 → "−R240". */
export function formatR(cents) {
  const rand = Math.round(Math.abs(cents) / 100);
  return (cents < 0 && rand ? MINUS : "") + "R" + group(rand);
}

/** Rand with cents, for small rates such as R/min: 280 → "R2.80". */
export function formatR2(cents) {
  return (cents < 0 ? MINUS : "") + "R" + (Math.abs(cents) / 100).toFixed(2);
}

/** Plain number with thousands grouping: 12345 → "12 345". */
export function formatNum(n) {
  return group(Math.round(n));
}

/** Percentage of a in b, 0 when b is 0. */
export function pct(a, b) {
  return b ? (a / b) * 100 : 0;
}

/**
 * Read a messy price from a sales export into cents. Returns NaN when it can't be read.
 *  - A leading "R" and any spaces (normal, no-break, thin) are ignored: "R 1 200,00".
 *  - Decimal rule: the last "," or "." followed by exactly 1–2 digits is the decimal mark;
 *    every other "," or "." is a thousands separator. "1,200" → 1200, "120,5" → 120.50, "1.200,00" → 1200.
 *  - Negatives are refunds: "-120", "−120" (Unicode minus) and "(120.00)" all mean −120.
 */
export function parsePrice(text) {
  let s = String(text ?? "").replace(/\s/g, ""); // \s also covers no-break and thin spaces
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  if (/^[-−]/.test(s)) { negative = true; s = s.slice(1); }
  s = s.replace(/^R/i, "");
  if (/^[-−]/.test(s)) { negative = true; s = s.slice(1); } // "R-120"
  if (!/^[\d.,]*\d[\d.,]*$/.test(s)) return NaN;

  let whole = s, fraction = "";
  const last = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
  if (last >= 0 && /^\d{1,2}$/.test(s.slice(last + 1))) {
    whole = s.slice(0, last);
    fraction = s.slice(last + 1);
  }
  whole = whole.replace(/[.,]/g, "");
  const cents = Number(whole || "0") * 100 + Number(fraction.padEnd(2, "0") || "0");
  return negative ? -cents : cents;
}
