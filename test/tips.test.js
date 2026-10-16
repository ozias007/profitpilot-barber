import { test } from "node:test";
import assert from "node:assert/strict";
import { busiestSlot, costJumps, lowestEarner, discountGap, keptFell, quietSlot, barberTips, allTips, pickDashboardTips, nextStep } from "../src/core/tips.js";

// A hand-made month summary with only the fields the rules read. Heat rows Mon→Sun, 6 slots each.
const flat = (v) => Array.from({ length: 7 }, () => Array(6).fill(v));
function month(over = {}) {
  return {
    heat: flat(1), costs: {}, bySvc: [], byBarber: [],
    salesCents: 100000, mins: 1000, cuts: 100, commission: 10000, kept: 50000,
    ...over,
  };
}
const svc = (id, name, { count = 20, perMin = 100, priceCents = 1000, avgCents = 1000, mins = 500 } = {}) => ({ id, name, count, perMin, priceCents, avgCents, mins });

test("busiest slot fires at 3.0 cuts an hour, not at 2.9, and names the day and time", () => {
  const heat = flat(1);
  heat[5][1] = 2.9; // Saturday 10:00–12:00
  assert.equal(busiestSlot(month({ heat })), null);
  heat[5][1] = 3.0;
  const t = busiestSlot(month({ heat }));
  assert.equal(t.title, "Saturday 10:00–12:00 averages 3.0 cuts an hour");
  assert.equal(t.text, "Take bookings so walk-ins don't leave.");
  assert.equal(t.impactCents, null);
});

test("cost jump: more than 15% AND at least R200", () => {
  const prev = month({ costs: { Electricity: 200000, Water: 100000, Phone: 100000 } });
  const at15 = costJumps(month({ costs: { Electricity: 230000 } }), prev); // +15% exactly: no
  assert.deepEqual(at15, []);
  const at16 = costJumps(month({ costs: { Electricity: 232000 } }), prev); // +16%, +R320: yes
  assert.equal(at16.length, 1);
  assert.equal(at16[0].title, "Electricity up 16%");
  assert.equal(at16[0].impactCents, 32000);
  const small = costJumps(month({ costs: { Water: 115000 } }), month({ costs: { Water: 95000 } })); // +21% but R200 exactly: yes
  assert.equal(small.length, 1);
  const tooSmall = costJumps(month({ costs: { Phone: 18000 } }), month({ costs: { Phone: 15000 } })); // +20% but only R150: no
  assert.deepEqual(tooSmall, []);
  assert.deepEqual(costJumps(month({ costs: { Electricity: 276000 } }), null), []); // no earlier month: nothing to compare
});

test("the demo: electricity R2 000 → R2 760 reads 'Electricity up 38%'", () => {
  const [t] = costJumps(month({ costs: { Electricity: 276000 } }), month({ costs: { Electricity: 200000 } }));
  assert.equal(t.title, "Electricity up 38%");
  assert.equal(t.text.replace(/ /g, " "), "R2 000 → R2 760 compared with last month."); // amounts use no-break spaces
});

test("lowest earner needs 10+ sales and to be at least 20% below the shop average", () => {
  // shop average = 100000 / 1000 = 100 cents a minute
  const at80 = month({ bySvc: [svc("kids", "Kids Cut", { perMin: 80 }), svc("fade", "Fade", { perMin: 120 })] });
  assert.equal(lowestEarner(at80).title, "Kids Cuts earn the least per minute"); // exactly 20% below: fires
  const at81 = month({ bySvc: [svc("kids", "Kids Cut", { perMin: 81 })] });
  assert.equal(lowestEarner(at81), null);
  const nine = month({ bySvc: [svc("kids", "Kids Cut", { perMin: 50, count: 9 })] });
  assert.equal(lowestEarner(nine), null); // too few sales to judge
  // impact per MONTH: (average − its R/min) × its minutes this month
  assert.equal(lowestEarner(at80).impactCents, (100 - 80) * 500);
  assert.equal(lowestEarner(at80).link.goto, "sales/planner");
});

test("discount gap: 10%+ below list with 10+ sales", () => {
  const at10 = month({ bySvc: [svc("fade", "Fade", { priceCents: 12000, avgCents: 10800, count: 50 })] });
  const t = discountGap(at10);
  assert.equal(t.title, "Fades sold for R108 on average, not R120");
  assert.equal(t.impactCents, (12000 - 10800) * 50);
  assert.equal(discountGap(month({ bySvc: [svc("fade", "Fade", { priceCents: 12000, avgCents: 10900, count: 50 })] })), null);
  assert.equal(discountGap(month({ bySvc: [svc("fade", "Fade", { priceCents: 12000, avgCents: 9000, count: 9 })] })), null);
});

test("money kept fell: more than 10%, naming the biggest cause", () => {
  const prev = month({ kept: 100000, costs: { Electricity: 200000 }, salesCents: 500000, commission: 50000, cuts: 400 });
  assert.equal(keptFell(month({ kept: 90000, costs: { Electricity: 210000 }, salesCents: 500000, commission: 50000 }), prev), null); // −10% exactly
  const byCost = keptFell(month({ kept: 89000, costs: { Electricity: 211000 }, salesCents: 500000, commission: 50000, cuts: 400 }), prev);
  assert.equal(byCost.title, "Money kept fell 11% (R110)");
  assert.equal(byCost.cause, "Electricity");
  assert.equal(byCost.text, "The biggest reason: Electricity went up R110.");
  const bySales = keptFell(month({ kept: 60000, costs: { Electricity: 200000 }, salesCents: 460000, commission: 50000, cuts: 370 }), prev);
  assert.equal(bySales.cause, "sales");
  assert.equal(bySales.text, "The biggest reason: sales came in R400 lower, with 30 fewer cuts.");
  assert.equal(keptFell(month({ kept: null }), prev), null); // no costs entered yet
  assert.equal(keptFell(month({ kept: 10 }), null), null);
});

test("quiet slot: a weekday slot under 0.5 cuts an hour; weekends don't count", () => {
  const heat = flat(1);
  heat[6][0] = 0.1; // Sunday early: ignored
  assert.equal(quietSlot(month({ heat })), null);
  heat[1][2] = 0.5; // Tuesday 12–14 at exactly 0.5: not quiet
  assert.equal(quietSlot(month({ heat })), null);
  heat[1][2] = 0.4;
  assert.equal(quietSlot(month({ heat })).title, "Tuesday 12:00–14:00 is quiet");
});

test("barber tips are supportive, and the low-share tip needs < 60% of the team average", () => {
  const b = (id, name, salesCents, perHour = 10000) => ({ id, name, salesCents, perHour, cuts: 10 });
  const s = month({ salesCents: 260000, byBarber: [b("thabo", "Thabo", 100000), b("lerato", "Lerato", 100000, 20000), b("nathi", "Nathi", 60000)] });
  // team average 86 667; 60% of that is 52 000 → Nathi at 60 000 doesn't fire
  assert.deepEqual(barberTips(s).map((t) => t.id), ["topEarner", "bestPerHour"]);
  const s2 = month({ salesCents: 250000, byBarber: [b("thabo", "Thabo", 100000), b("lerato", "Lerato", 100000), b("nathi", "Nathi", 50000)] });
  const low = barberTips(s2).find((t) => t.id === "lowShare"); // average 83 333 × 60% = 50 000 → 50 000 is not below…
  assert.equal(low, undefined);
  const s3 = month({ salesCents: 249000, byBarber: [b("thabo", "Thabo", 100000), b("lerato", "Lerato", 100000), b("nathi", "Nathi", 49000)] });
  const t = barberTips(s3).find((x) => x.id === "lowShare");
  assert.equal(t.title, "Give Nathi the Saturday overflow");
  assert.doesNotMatch(t.text, /poor|bad|worst|lazy/i);
});

const tip = (id, impactCents, extra = {}) => ({ id, impactCents, action: `do ${id}`, ...extra });

test("Dashboard picks the top 2 by rand impact, and the busiest slot always takes 3rd place", () => {
  const tips = [tip("cost:Rent", 50000, { cost: "Rent" }), tip("discount", 40000), tip("lowest", 30000), tip("keptFell", 20000, { cause: "sales" }), tip("busiest", null), tip("quiet", null)];
  const picked = pickDashboardTips(tips);
  assert.deepEqual(picked.dashboard.map((t) => t.id), ["cost:Rent", "discount", "busiest"]);
  assert.deepEqual(picked.rest.map((t) => t.id), ["lowest", "keptFell", "quiet"]);
  assert.equal(nextStep(picked), "do cost:Rent");
});

test("without a busiest slot, 3rd place goes to the next by impact; tips without an amount come last", () => {
  const picked = pickDashboardTips([tip("quiet", null), tip("lowest", 100), tip("discount", 900), tip("keptFell", 500, { cause: "sales" })]);
  assert.deepEqual(picked.dashboard.map((t) => t.id), ["discount", "keptFell", "lowest"]);
  assert.deepEqual(pickDashboardTips([tip("quiet", null), tip("busiest", null)]).dashboard.map((t) => t.id), ["quiet", "busiest"]);
});

test("no double counting: a cost that caused 'money kept fell' isn't shown again as a cost jump", () => {
  const picked = pickDashboardTips([tip("cost:Electricity", 76000, { cost: "Electricity" }), tip("keptFell", 90000, { cause: "Electricity" }), tip("cost:Water", 30000, { cost: "Water" })]);
  assert.deepEqual(picked.dashboard.map((t) => t.id), ["keptFell", "cost:Water"]);
  assert.ok(!picked.rest.some((t) => t.id === "cost:Electricity"));
});

test("a steady month", () => {
  const picked = pickDashboardTips(allTips(month(), month()));
  assert.equal(picked.steady, true);
  assert.deepEqual(picked.dashboard, []);
  assert.equal(nextStep(picked), "Nothing needs your attention this month. Import next month's sales on the 1st to keep comparing.");
});
