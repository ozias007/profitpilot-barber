import { test } from "node:test";
import assert from "node:assert/strict";
import { summarise, commissionCents, change, previousKey, daysInMonth, weekday, costItems } from "../src/core/month.js";

const services = [
  { id: "fade", name: "Fade", priceCents: 12000, minutes: 40 },
  { id: "kids", name: "Kids Cut", priceCents: 7000, minutes: 25 },
  { id: "design", name: "Hair Design", priceCents: 15000, minutes: 50 },
];
const barbers = [
  { id: "thabo", name: "Thabo", ratePct: 11 },
  { id: "nathi", name: "Nathi", ratePct: 10 },
];
// October 2026: the 3rd is a Saturday, the 5th a Monday.
const sales = [
  [3, 9 * 60, "thabo", "fade", 12000, 40],
  [3, 9 * 60 + 30, "thabo", "fade", 10000, 35], // discounted and quicker
  [3, 10 * 60, "nathi", "kids", 7000, 25],
  [5, 13 * 60, "nathi", "kids", 0, 25], // free cut
  [5, 14 * 60, "thabo", "fade", -12000, 40], // refund
  [6, 21 * 60, "nathi", "kids", 7000, 25], // after 20:00
];
const costs = { Rent: 1000000, Electricity: 200000 };
const s = summarise("2026-10", { sales, costs }, services, barbers);

test("calendar helpers", () => {
  assert.equal(daysInMonth(2026, 2), 28);
  assert.equal(daysInMonth(2028, 2), 29);
  assert.equal(daysInMonth(2026, 10), 31);
  assert.equal(weekday(2026, 10, 3), 6);
  assert.equal(weekday(2026, 10, 5), 1);
});

test("sales include refunds; cuts and chair time exclude them; free cuts count", () => {
  assert.equal(s.salesCents, 12000 + 10000 + 7000 + 0 - 12000 + 7000);
  assert.equal(s.cuts, 5);
  assert.equal(s.mins, 40 + 35 + 25 + 25 + 25);
});

test("commission per barber is rounded to the rand", () => {
  assert.equal(commissionCents(10000, 11), 1100);
  assert.equal(commissionCents(12345, 11), 1400); // R13.58 → R14
  assert.equal(commissionCents(12249, 11), 1300); // R13.47 → R13
  const thabo = s.byBarber.find((b) => b.id === "thabo");
  assert.equal(thabo.salesCents, 10000);
  assert.equal(thabo.commissionCents, 1100);
  const nathi = s.byBarber.find((b) => b.id === "nathi");
  assert.equal(nathi.commissionCents, 1400);
  assert.equal(s.commission, 2500);
});

test("money kept = sales − entered costs − commission", () => {
  assert.equal(s.costTotal, 1200000 + 2500);
  assert.equal(s.kept, s.salesCents - 1200000 - 2500);
});

test("changing a cost changes money kept by exactly that amount", () => {
  const more = summarise("2026-10", { sales, costs: { ...costs, Electricity: 276000 } }, services, barbers);
  assert.equal(s.kept - more.kept, 76000);
});

test("no costs entered: money kept is null, commission still worked out", () => {
  const none = summarise("2026-10", { sales, costs: {} }, services, barbers);
  assert.equal(none.kept, null);
  assert.equal(none.hasCosts, false);
  assert.equal(none.commission, 2500);
});

test("R/min uses actual charged ÷ actual minutes, falling back to the list", () => {
  const fade = s.bySvc.find((x) => x.id === "fade");
  // net fade sales 12000+10000−12000 = 10000 over 75 minutes (refund uses no time)
  assert.equal(fade.perMin, 10000 / 75);
  assert.equal(fade.listPerMin, 12000 / 40);
  const design = s.bySvc.find((x) => x.id === "design");
  assert.equal(design.count, 0);
  assert.equal(design.perMin, 15000 / 50);
  const kids = s.bySvc.find((x) => x.id === "kids");
  assert.equal(kids.satCount, 1);
});

test("heatmap = cuts in that weekday-slot ÷ times that weekday occurs ÷ 2 hours", () => {
  // Saturday is row 5; October 2026 has 5 Saturdays. 08–10 slot: 2 cuts; 10–12 slot: 1 cut.
  assert.equal(s.heat[5][0], 2 / 5 / 2);
  assert.equal(s.heat[5][1], 1 / 5 / 2);
  // Monday 12–14: the free cut counts. Monday 14–16: the refund doesn't.
  assert.equal(s.heat[0][2], 1 / 4 / 2);
  assert.equal(s.heat[0][3], 0);
  // The 21:00 sale is outside the grid.
  assert.equal(s.heat.flat().reduce((a, v) => a + v, 0), 2 / 10 + 1 / 10 + 1 / 8);
});

test("daily lines", () => {
  assert.equal(s.daily.length, 31);
  assert.equal(s.daily[2], 29000);
  assert.equal(s.daily[4], -12000);
  assert.equal(s.dailyCost[0], Math.round(1200000 / 31));
});

test("cost items include commission, biggest first", () => {
  assert.deepEqual(costItems(s).map((c) => c.name), ["Rent", "Electricity", "Commission"]);
});

test("change and previousKey", () => {
  assert.equal(change(110, 100), 10);
  assert.equal(change(90, 100), -10);
  assert.equal(change(100, null), null);
  assert.equal(change(100, 0), null);
  assert.equal(previousKey(["2026-10", "2026-09"], "2026-10"), "2026-09");
  assert.equal(previousKey(["2026-10"], "2026-10"), null);
});

test("average charged leaves refunds out but counts free cuts at R0", () => {
  const fade = s.bySvc.find((x) => x.id === "fade");
  assert.equal(fade.avgCents, (12000 + 10000) / 2); // the −R120 refund is not a price
  const kids = s.bySvc.find((x) => x.id === "kids");
  assert.equal(kids.avgCents, (7000 + 0 + 7000) / 3);
});

test("costs: +R760 electricity lowers kept by exactly R760; adding then removing Security R450 restores it", () => {
  const base = summarise("2026-10", { sales, costs: { Rent: 1000000, Electricity: 200000 } }, services, barbers);
  const up = summarise("2026-10", { sales, costs: { Rent: 1000000, Electricity: 276000 } }, services, barbers);
  assert.equal(base.kept - up.kept, 76000);
  const withSecurity = summarise("2026-10", { sales, costs: { Rent: 1000000, Electricity: 276000, Security: 45000 } }, services, barbers);
  assert.equal(up.kept - withSecurity.kept, 45000);
  const removed = summarise("2026-10", { sales, costs: { Rent: 1000000, Electricity: 276000 } }, services, barbers);
  assert.equal(removed.kept, up.kept);
  assert.equal(withSecurity.costTotal - up.costTotal, 45000); // the total moves with it; commission doesn't
  assert.equal(withSecurity.commission, up.commission);
});
