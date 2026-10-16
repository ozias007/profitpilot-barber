// Price Planner: try a new price before changing it. prd.md > Price Planner.
// "Now" is what those cuts actually brought in (discounts included), the same basis as earnings per minute.
// Assumes customers pay the new price.

/**
 * @param svc a service from the month summary (bySvc): count, satCount, chargedCents, satChargedCents, perMin, minutes
 * @param plan { priceCents, lostPct (0–100), satOnly }
 */
export function planPrice(svc, { priceCents, lostPct = 0, satOnly = false }) {
  const n = satOnly ? svc.satCount : svc.count;
  const kept = Math.round(n * (1 - lostPct / 100));
  const nowCents = satOnly ? svc.satChargedCents : svc.chargedCents;
  const afterCents = kept * priceCents;
  return {
    n,
    kept,
    nowCents,
    afterCents,
    diffCents: afterCents - nowCents,
    perMinNow: svc.perMin,
    perMinNew: priceCents / svc.minutes,
    freedMinutes: (n - kept) * svc.minutes,
  };
}

/** Slider range for a service: 50%–160% of its list price, in R5 steps (never below R5). Values in cents. */
export function priceRange(listCents) {
  const r5 = (cents) => Math.round(cents / 500) * 500;
  return { min: Math.max(500, r5(listCents * 0.5)), max: Math.max(1000, r5(listCents * 1.6)), step: 500 };
}
