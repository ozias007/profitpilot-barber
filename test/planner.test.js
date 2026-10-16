import { test } from "node:test";
import assert from "node:assert/strict";
import { planPrice, priceRange } from "../src/core/planner.js";
import { summarise } from "../src/core/month.js";

// A hand-made October 2026 with 33 Saturday kids' cuts at R70 (Saturdays are the 3rd, 10th, 17th, 24th, 31st)
// plus 10 weekday kids' cuts, a free kids' cut and a refund.
const services = [{ id: "kids", name: "Kids Cut", priceCents: 7000, minutes: 25 }];
const barbers = [{ id: "nathi", name: "Nathi", ratePct: 10 }];
const saturdays = [3, 10, 17, 24, 31];
const sales = [
  ...Array.from({ length: 33 }, (_, i) => [saturdays[i % 5], 600, "nathi", "kids", 7000, 25]),
  ...Array.from({ length: 10 }, () => [6, 600, "nathi", "kids", 7000, 25]),
  [7, 600, "nathi", "kids", 0, 25], // free cut
  [8, 600, "nathi", "kids", -7000, 25], // refund: not a cut, not in "now"
];
const kids = summarise("2026-10", { sales, costs: {} }, services, barbers).bySvc[0];

test("the demo: 33 Saturday kids' cuts at R70 → R80, nobody lost = +R330 a month", () => {
  const r = planPrice(kids, { priceCents: 8000, lostPct: 0, satOnly: true });
  assert.equal(r.n, 33);
  assert.equal(r.kept, 33);
  assert.equal(r.nowCents, 33 * 7000);
  assert.equal(r.diffCents, 33000);
});

test("customers lost are rounded to whole cuts, and their chair-minutes are freed", () => {
  const r = planPrice(kids, { priceCents: 8000, lostPct: 15, satOnly: true }); // 33 × 0.85 = 28.05 → 28
  assert.equal(r.kept, 28);
  assert.equal(r.diffCents, 28 * 8000 - 33 * 7000); // −R70
  assert.equal(r.freedMinutes, 5 * 25);
});

test("the baseline is what the cuts actually brought in: free cuts count at R0, refunds are left out", () => {
  const r = planPrice(kids, { priceCents: 7000, satOnly: false });
  assert.equal(r.n, 44); // 33 + 10 + 1 free
  assert.equal(r.nowCents, 43 * 7000);
  assert.equal(r.diffCents, 7000); // charging the free cut too
});

test("R/min: actual now, new price ÷ list minutes after", () => {
  const r = planPrice(kids, { priceCents: 8000, satOnly: true });
  assert.equal(r.perMinNow, kids.perMin);
  assert.equal(r.perMinNew, 8000 / 25);
});

test("changing a list price never re-prices past sales", () => {
  const before = summarise("2026-10", { sales, costs: {} }, services, barbers);
  const after = summarise("2026-10", { sales, costs: {} }, [{ ...services[0], priceCents: 9000 }], barbers);
  assert.equal(after.salesCents, before.salesCents);
  assert.equal(after.bySvc[0].chargedCents, before.bySvc[0].chargedCents);
  assert.equal(after.bySvc[0].perMin, before.bySvc[0].perMin); // actual R/min doesn't move
  assert.equal(after.bySvc[0].listPerMin, 9000 / 25); // only the list figures do
});

test("slider range: 50%–160% of the list price in R5 steps", () => {
  assert.deepEqual(priceRange(7000), { min: 3500, max: 11000, step: 500 });
  assert.deepEqual(priceRange(800), { min: 500, max: 1500, step: 500 }); // R8: never below R5; R12.80 rounds to R15
});
