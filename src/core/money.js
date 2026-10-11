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
