// Turns one month of sales plus its costs into every number the screens show.
// Formulas: prd.md > How the Numbers Work. Money in cents; dates as plain numbers (no timezones).

export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Heatmap slots: six two-hour blocks from 08:00 to 20:00. */
export const SLOTS = ["08:00 – 10:00", "10:00 – 12:00", "12:00 – 14:00", "14:00 – 16:00", "16:00 – 18:00", "18:00 – 20:00"];
/** Heatmap rows run Monday → Sunday; values are JS weekday numbers. */
export const HEAT_DAYS = [1, 2, 3, 4, 5, 6, 0];

// sale row fields: [day, minuteOfDay, barberId, serviceId, priceCents, minutes]
export const DAY = 0, TIME = 1, BARBER = 2, SERVICE = 3, PRICE = 4, MINS = 5;

/** month is 1–12 */
export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function parseKey(key) {
  const [y, m] = key.split("-").map(Number);
  return { year: y, month: m };
}

export function monthLabel(key) {
  const { year, month } = parseKey(key);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** The most frequent value (first one wins a tie), or null for an empty list. */
function mostCommon(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  let best = null, n = 0;
  for (const [v, c] of counts) if (c > n) { best = v; n = c; }
  return best;
}

/** Commission for a barber's sales, rounded to the whole rand. */
export function commissionCents(salesCents, ratePct) {
  return Math.round((salesCents * ratePct) / 100 / 100) * 100;
}

/**
 * Summarise one month.
 * @param key "YYYY-MM"
 * @param monthData { sales, costs }
 * @param services [{ id, name, priceCents, minutes }]
 * @param barbers [{ id, name, ratePct }]
 */
export function summarise(key, monthData, services, barbers) {
  const { year, month } = parseKey(key);
  const days = daysInMonth(year, month);
  const sales = monthData.sales;
  const isCut = (r) => r[PRICE] >= 0; // refunds reduce sales but are not cuts and use no chair time

  let salesCents = 0, cuts = 0, mins = 0;
  const daily = new Array(days).fill(0);
  for (const r of sales) {
    salesCents += r[PRICE];
    daily[r[DAY] - 1] += r[PRICE];
    if (isCut(r)) { cuts++; mins += r[MINS]; }
  }

  const bySvc = services.map((s) => {
    const rows = sales.filter((r) => r[SERVICE] === s.id);
    const cutRows = rows.filter(isCut);
    const svcSales = rows.reduce((a, r) => a + r[PRICE], 0);
    const svcMins = cutRows.reduce((a, r) => a + r[MINS], 0);
    const listPerMin = s.priceCents / s.minutes;
    return {
      ...s,
      count: cutRows.length,
      salesCents: svcSales,
      mins: svcMins,
      // average actually charged per cut (free cuts count at R0; refunds are not a price, so they're left out)
      avgCents: cutRows.length ? cutRows.reduce((a, r) => a + r[PRICE], 0) / cutRows.length : s.priceCents,
      listPerMin,
      // actual charged ÷ actual minutes; list price ÷ list minutes when nothing sold
      perMin: svcMins ? svcSales / svcMins : listPerMin,
      satCount: cutRows.filter((r) => weekday(year, month, r[DAY]) === 6).length,
      // what the cuts actually brought in (no refunds), for the Price Planner's "now"
      chargedCents: cutRows.reduce((a, r) => a + r[PRICE], 0),
      satChargedCents: cutRows.filter((r) => weekday(year, month, r[DAY]) === 6).reduce((a, r) => a + r[PRICE], 0),
    };
  });

  const byBarber = barbers.map((b) => {
    const rows = sales.filter((r) => r[BARBER] === b.id);
    const cutRows = rows.filter(isCut);
    const bSales = rows.reduce((a, r) => a + r[PRICE], 0);
    const bMins = cutRows.reduce((a, r) => a + r[MINS], 0);
    return {
      ...b,
      cuts: cutRows.length,
      salesCents: bSales,
      mins: bMins,
      commissionCents: commissionCents(bSales, b.ratePct),
      perHour: bMins ? bSales / (bMins / 60) : 0,
      busiestDay: mostCommon(cutRows.map((r) => weekday(year, month, r[DAY]))), // 0 = Sunday … 6 = Saturday, or null
      topService: mostCommon(cutRows.map((r) => r[SERVICE])), // service id they do most, or null
    };
  });

  const commission = byBarber.reduce((a, b) => a + b.commissionCents, 0);
  const entered = monthData.costs || {};
  const hasCosts = Object.keys(entered).length > 0;
  const enteredTotal = Object.values(entered).reduce((a, v) => a + v, 0);
  const costTotal = enteredTotal + commission;

  // daily cost line: entered costs spread evenly, plus commission at the month's average rate
  const avgRate = salesCents ? commission / salesCents : 0;
  const dailyCost = daily.map((v) => Math.round(enteredTotal / days + v * avgRate));

  // busy hours: cuts per hour for each weekday × two-hour slot
  const occurrences = {};
  for (let d = 1; d <= days; d++) {
    const wd = weekday(year, month, d);
    occurrences[wd] = (occurrences[wd] || 0) + 1;
  }
  const counts = HEAT_DAYS.map(() => SLOTS.map(() => 0));
  for (const r of sales) {
    if (!isCut(r)) continue;
    const slot = Math.floor((Math.floor(r[TIME] / 60) - 8) / 2);
    if (slot < 0 || slot >= SLOTS.length) continue; // outside 08:00–20:00: counted in totals, not in the heatmap
    counts[HEAT_DAYS.indexOf(weekday(year, month, r[DAY]))][slot]++;
  }
  const heat = counts.map((row, i) => row.map((c) => (occurrences[HEAT_DAYS[i]] ? c / occurrences[HEAT_DAYS[i]] / 2 : 0)));

  return {
    key, year, month, days,
    salesCents, cuts, mins,
    bySvc, byBarber,
    commission,
    costs: entered,
    hasCosts,
    enteredTotal,
    costTotal,
    kept: hasCosts ? salesCents - costTotal : null,
    daily, dailyCost, heat,
  };
}

/** Cost items for donuts and the "where the money went" bar: entered costs plus commission, biggest first. */
export function costItems(summary) {
  return Object.entries({ Commission: summary.commission, ...summary.costs })
    .map(([name, cents]) => ({ name, cents }))
    .sort((a, b) => b.cents - a.cents);
}

/** Percent change from previous to current; null when there is no earlier figure to compare with. */
export function change(current, previous) {
  if (previous == null || current == null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** The key of the month before `key` among the stored keys, or null. */
export function previousKey(keys, key) {
  const sorted = [...keys].sort();
  const i = sorted.indexOf(key);
  return i > 0 ? sorted[i - 1] : null;
}
