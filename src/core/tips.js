// Plain-language tips from simple, testable rules. No AI. prd.md > Tips.
// Each rule takes this month's summary (and last month's, or null) and returns a tip or null.
// A tip: { id, impactCents (rand impact per month, or null), icon, color, title, text, action, link, page }

import { formatR, formatR2 } from "./money.js";
import { SLOTS } from "./month.js";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]; // heat rows run Mon → Sun
const slotName = (row, slot) => `${DAY_NAMES[row]} ${SLOTS[slot].replace(/ /g, "")}`;
const pctText = (x) => `${Math.round(x)}%`;
const plural = (word) => (/s$/i.test(word) ? word : word + "s"); // "Kids Cut" → "Kids Cuts", "Fades" stays

/** Thresholds, in one place so the tests and the rules can't drift apart. */
export const RULES = {
  busiestPerHour: 3, // a slot averaging 3+ cuts an hour
  costJumpPct: 15, // a cost up MORE than 15%…
  costJumpMinCents: 20000, // …and at least R200
  minSales: 10, // a service needs 10+ sales for the per-minute and discount rules
  lowestBelowAvg: 0.2, // at least 20% below the shop's average R/min
  discountPct: 10, // average charged 10%+ below the list price
  keptFellPct: 10, // money kept down more than 10%
  quietPerHour: 0.5, // a weekday slot under 0.5 cuts an hour
  lowShareOfAvg: 0.6, // a barber below 60% of the team average
};

/** Busiest slot: fires when the busiest weekday-slot averages 3+ cuts an hour. */
export function busiestSlot(s) {
  let best = null;
  s.heat.forEach((row, r) => row.forEach((v, k) => { if (!best || v > best.v) best = { v, r, k }; }));
  if (!best || best.v < RULES.busiestPerHour) return null;
  const name = slotName(best.r, best.k);
  return {
    id: "busiest", impactCents: null, icon: "i-arrow-up", color: "green", page: "dash",
    title: `${name} averages ${best.v.toFixed(1)} cuts an hour`,
    text: "Take bookings so walk-ins don't leave.",
    action: `Take bookings for ${name}, so walk-ins don't leave.`,
    slot: { row: best.r, slot: best.k, perHour: best.v },
  };
}

/** Cost jump: each cost up more than 15% AND at least R200 against last month. One tip per cost. */
export function costJumps(s, p) {
  if (!p) return [];
  const tips = [];
  for (const [name, now] of Object.entries(s.costs)) {
    const before = p.costs[name];
    if (!(before > 0)) continue;
    const up = now - before;
    const pct = (up / before) * 100;
    if (pct > RULES.costJumpPct && up >= RULES.costJumpMinCents) {
      tips.push({
        id: `cost:${name}`, impactCents: up, icon: "i-excl", color: "orange", page: "costs", cost: name,
        title: `${name} up ${pctText(pct)}`,
        text: `${formatR(before)} → ${formatR(now)} compared with last month.`,
        action: `Check your ${name.toLowerCase()} bill: it's up ${formatR(up)} on last month.`,
        link: { goto: "costs/edit", label: "See your costs →" },
      });
    }
  }
  return tips;
}

/** The shop's average earnings per chair-minute (cents a minute). */
const shopPerMin = (s) => (s.mins ? s.salesCents / s.mins : 0);

/** Lowest earner per minute: lowest R/min among services with 10+ sales, at least 20% below the shop average. */
export function lowestEarner(s) {
  const avg = shopPerMin(s);
  const candidates = s.bySvc.filter((x) => x.count >= RULES.minSales).sort((a, b) => a.perMin - b.perMin);
  const low = candidates[0];
  if (!low || !avg || low.perMin > avg * (1 - RULES.lowestBelowAvg)) return null;
  return {
    id: "lowest", impactCents: Math.round((avg - low.perMin) * low.mins), icon: "i-child", color: "blue", page: "dash", service: low.id,
    title: `${plural(low.name)} earn the least per minute`,
    text: `${formatR2(low.perMin)} a minute, against your average of ${formatR2(avg)}.`,
    action: `Try a new price for ${plural(low.name)} in the Price Planner.`,
    link: { goto: "sales/planner", label: "See what a price change would do →" },
  };
}

/** Discount gap: a service with 10+ sales whose average charged price is 10%+ below its list price. Biggest gap wins. */
export function discountGap(s) {
  const gaps = s.bySvc
    .filter((x) => x.count >= RULES.minSales && x.priceCents > 0 && x.avgCents <= x.priceCents * (1 - RULES.discountPct / 100))
    .map((x) => ({ x, lost: Math.round((x.priceCents - x.avgCents) * x.count) }))
    .sort((a, b) => b.lost - a.lost);
  if (!gaps.length) return null;
  const { x, lost } = gaps[0];
  return {
    id: "discount", impactCents: lost, icon: "i-tag", color: "orange", page: "dash", service: x.id,
    title: `${plural(x.name)} sold for ${formatR(x.avgCents)} on average, not ${formatR(x.priceCents)}`,
    text: `Discounts and specials cost ${formatR(lost)} this month.`,
    action: `Check why ${plural(x.name)} sell below ${formatR(x.priceCents)}: that gap cost ${formatR(lost)}.`,
    link: { goto: "sales/services", label: "See your services →" },
  };
}

/** Money kept fell more than 10%: name the biggest cause (one cost, fewer sales, or higher commission). */
export function keptFell(s, p) {
  if (!p || s.kept == null || p.kept == null || !(p.kept > 0)) return null;
  const drop = p.kept - s.kept;
  if (drop <= (p.kept * RULES.keptFellPct) / 100) return null;
  const causes = [
    ...Object.entries(s.costs).map(([name, v]) => ({ kind: "cost", name, cents: v - (p.costs[name] ?? 0) })),
    { kind: "sales", cents: p.salesCents - s.salesCents },
    { kind: "commission", cents: s.commission - p.commission },
  ].sort((a, b) => b.cents - a.cents);
  const cause = causes[0];
  const why =
    cause.kind === "cost" ? `${cause.name} went up ${formatR(cause.cents)}`
    : cause.kind === "sales" ? `sales came in ${formatR(cause.cents)} lower, with ${Math.abs(p.cuts - s.cuts)} ${s.cuts < p.cuts ? "fewer" : "more"} cuts`
    : `commission went up ${formatR(cause.cents)}`;
  return {
    id: "keptFell", impactCents: drop, icon: "i-alert", color: "red", page: "dash",
    cause: cause.kind === "cost" ? cause.name : cause.kind,
    title: `Money kept fell ${pctText((drop / p.kept) * 100)} (${formatR(drop)})`,
    text: `The biggest reason: ${why}.`,
    action: `Start with the biggest reason money kept fell: ${why}.`,
    link: cause.kind === "cost" ? { goto: "costs/edit", label: "See your costs →" } : cause.kind === "commission" ? { goto: "barbers/commission", label: "See commission →" } : null,
  };
}

/** Quiet slot: the quietest weekday (Mon–Fri) slot, when it averages under 0.5 cuts an hour. */
export function quietSlot(s) {
  let low = null;
  s.heat.slice(0, 5).forEach((row, r) => row.forEach((v, k) => { if (!low || v < low.v) low = { v, r, k }; }));
  if (!low || low.v >= RULES.quietPerHour) return null;
  const name = slotName(low.r, low.k);
  return {
    id: "quiet", impactCents: null, icon: "i-clock", color: "purple", page: "dash",
    title: `${name} is quiet`,
    text: `${low.v.toFixed(1)} cuts an hour. Try a weekday special.`,
    action: `Try a weekday special for ${name}.`,
  };
}

// ---------- Barbers page only; supportive, never blaming ----------

export function barberTips(s) {
  const active = s.byBarber.filter((b) => b.cuts > 0);
  if (!active.length) return [];
  const tips = [];
  const top = [...active].sort((a, b) => b.salesCents - a.salesCents)[0];
  tips.push({ id: "topEarner", impactCents: null, icon: "i-barber", color: "green", page: "barbers",
    title: `${top.name} is your top earner`, text: `${pctText((top.salesCents / s.salesCents) * 100)} of this month's sales.` });
  const best = [...active].sort((a, b) => b.perHour - a.perHour)[0];
  tips.push({ id: "bestPerHour", impactCents: null, icon: "i-clock", color: "blue", page: "barbers",
    title: `${best.name} earns the most per chair-hour`, text: `${formatR(best.perHour)} an hour on average.` });
  const teamAvg = active.reduce((a, b) => a + b.salesCents, 0) / active.length;
  const low = [...active].sort((a, b) => a.salesCents - b.salesCents)[0];
  if (active.length > 1 && low.salesCents < teamAvg * RULES.lowShareOfAvg) {
    tips.push({ id: "lowShare", impactCents: null, icon: "i-excl", color: "orange", page: "barbers",
      title: `Give ${low.name} the Saturday overflow`,
      text: `${low.name} brought in ${pctText((low.salesCents / s.salesCents) * 100)} of sales. Sending walk-ins ${low.name}'s way when the others are full helps the whole shop.` });
  }
  return tips;
}

// ---------- choosing what the Dashboard shows ----------

/** Every Quick Insights tip that fires this month, before choosing. Cost jumps are not tips: they are alerts (below). */
export function allTips(s, p) {
  return [busiestSlot(s), lowestEarner(s), discountGap(s), keptFell(s, p), quietSlot(s)].filter(Boolean);
}

/**
 * Everything the Dashboard shows from the rules:
 *  - alerts: every cost jump, biggest first, as a red strip above everything, whatever the tips' ranking;
 *  - the Quick Insights tips chosen by pickDashboardTips.
 */
export function dashboardTips(s, p) {
  return { alerts: costJumps(s, p).sort((a, b) => b.impactCents - a.impactCents), ...pickDashboardTips(allTips(s, p)) };
}

const NO_AMOUNT_ORDER = ["busiest", "quiet"]; // tips without a rand amount rank after those with one, in this order

/**
 * The Dashboard's Quick Insights (at most 3), plus the rest for their own pages.
 *  1. The top 2 by rand impact.
 *  2. The busiest slot takes 3rd place when it fires (Saturday's queue must never be pushed off); otherwise the next by impact.
 * @returns { dashboard: tip[], rest: tip[], steady: boolean }
 */
export function pickDashboardTips(tips) {
  const list = tips;
  const ranked = [...list].sort((a, b) => {
    if (a.impactCents != null && b.impactCents != null) return b.impactCents - a.impactCents;
    if (a.impactCents != null) return -1;
    if (b.impactCents != null) return 1;
    return NO_AMOUNT_ORDER.indexOf(a.id) - NO_AMOUNT_ORDER.indexOf(b.id);
  });
  const busiest = ranked.find((t) => t.id === "busiest");
  const top = ranked.filter((t) => t !== busiest).slice(0, 2);
  const third = busiest ?? ranked.find((t) => !top.includes(t));
  const dashboard = third ? [...top, third] : top;
  return { dashboard, rest: list.filter((t) => !dashboard.includes(t)), steady: list.length === 0 };
}

/** What the "What to do next" card says. */
export function nextStep(picked) {
  return picked.dashboard[0]?.action ?? "Nothing needs your attention this month. Import next month's sales on the 1st to keep comparing.";
}
