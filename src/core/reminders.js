// In-app reminders: which banners and cards to show today. prd.md > Settings (Notifications).
// Everything is worked out from today's date and the stored months; nothing is sent anywhere.

import { DAY, TIME, SERVICE, PRICE, MONTH_NAMES, SLOTS } from "./month.js";

const DAY_MS = 86400000;
const dayNumber = (y, m, d) => Date.UTC(y, m - 1, d) / DAY_MS; // whole days since 1970, no timezones
const fromDayNumber = (n) => { const t = new Date(n * DAY_MS); return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() }; };
const keyOf = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
const weekdayOf = (n) => new Date(n * DAY_MS).getUTCDay(); // 0 = Sunday
const label = (n) => { const d = fromDayNumber(n); return `${d.day} ${MONTH_NAMES[d.month - 1].slice(0, 3)}`; };

/** Every stored sale with its absolute day number. */
function allSales(months) {
  const out = [];
  for (const [key, m] of Object.entries(months)) {
    const [y, mo] = key.split("-").map(Number);
    for (const r of m.sales) out.push({ n: dayNumber(y, mo, r[DAY]), r });
  }
  return out;
}

/** Is every day from start to end inside a stored month? */
const covered = (months, start, end) => {
  for (let n = start; n <= end; n++) { const d = fromDayNumber(n); if (!months[keyOf(d.year, d.month)]) return false; }
  return true;
};

/**
 * The most recent full Monday–Sunday weeks in the data that ended before today, newest first.
 * @returns [{ start, end }] as day numbers
 */
export function fullWeeks(months, today, count = 1) {
  const keys = Object.keys(months).sort();
  if (!keys.length) return [];
  const [fy, fm] = keys[0].split("-").map(Number);
  const earliest = dayNumber(fy, fm, 1);
  const t = dayNumber(today.year, today.month, today.day);
  const wd = weekdayOf(t);
  let end = t - (wd === 0 ? 7 : wd); // the last Sunday before today
  const weeks = [];
  while (end - 6 >= earliest && weeks.length < count) {
    if (covered(months, end - 6, end)) weeks.push({ start: end - 6, end });
    end -= 7;
  }
  return weeks;
}

/** Monday card: last full week vs the week before, its top service and busiest slot. */
export function weeklySummary(months, services, today) {
  const [week] = fullWeeks(months, today, 1);
  if (!week) return null;
  const sales = allSales(months);
  const inWeek = (w) => sales.filter((x) => x.n >= w.start && x.n <= w.end);
  const sum = (list) => ({ salesCents: list.reduce((a, x) => a + x.r[PRICE], 0), cuts: list.filter((x) => x.r[PRICE] >= 0).length });
  const now = sum(inWeek(week));
  const before = { start: week.start - 7, end: week.end - 7 };
  const prev = covered(months, before.start, before.end) ? sum(inWeek(before)) : null;

  const bySvc = {};
  for (const x of inWeek(week)) bySvc[x.r[SERVICE]] = (bySvc[x.r[SERVICE]] || 0) + x.r[PRICE];
  const topId = Object.entries(bySvc).sort((a, b) => b[1] - a[1])[0]?.[0];
  const slots = {};
  for (const x of inWeek(week)) {
    if (x.r[PRICE] < 0) continue;
    const slot = Math.floor((Math.floor(x.r[TIME] / 60) - 8) / 2);
    if (slot < 0 || slot >= SLOTS.length) continue;
    const k = `${weekdayOf(x.n)}:${slot}`;
    slots[k] = (slots[k] || 0) + 1;
  }
  const busy = Object.entries(slots).sort((a, b) => b[1] - a[1])[0];
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return {
    from: label(week.start), to: label(week.end),
    ...now,
    salesChange: prev?.salesCents ? Math.round(((now.salesCents - prev.salesCents) / prev.salesCents) * 100) : null,
    cutsChange: prev?.cuts ? Math.round(((now.cuts - prev.cuts) / prev.cuts) * 100) : null,
    topService: services.find((s) => s.id === topId)?.name ?? null,
    busiestSlot: busy ? `${DAYS[Number(busy[0].split(":")[0])]} ${SLOTS[Number(busy[0].split(":")[1])].replace(/ /g, "")}` : null,
  };
}

/** Saturday mornings full: 08:00–12:00 averaged 3+ cuts an hour on the Saturday of each of the last 3 full weeks. */
export function saturdaysFull(months, today) {
  const weeks = fullWeeks(months, today, 3);
  if (weeks.length < 3) return false;
  const sales = allSales(months);
  return weeks.every((w) => {
    const saturday = w.end - 1;
    const morning = sales.filter((x) => x.n === saturday && x.r[PRICE] >= 0 && x.r[TIME] >= 8 * 60 && x.r[TIME] < 12 * 60).length;
    return morning / 4 >= 3;
  });
}

/**
 * Which reminders to show today.
 * @param doc the saved document (months, prefs.notify, dismissed, sample)
 * @param today { year, month, day } from the device clock
 * @returns [{ id, dismissKey, text, … }]
 */
export function reminders(doc, today) {
  const on = (name) => doc.prefs?.notify?.[name] !== false;
  const dismissed = doc.dismissed ?? {};
  const thisMonth = keyOf(today.year, today.month);
  const t = dayNumber(today.year, today.month, today.day);
  const iso = `${thisMonth}-${String(today.day).padStart(2, "0")}`;
  const out = [];

  const last = fromDayNumber(dayNumber(today.year, today.month, 1) - 1);
  const lastKey = keyOf(last.year, last.month);
  if (on("importReminder") && today.day <= 7 && (doc.sample || !doc.months[lastKey]) && dismissed.importBanner !== thisMonth) {
    out.push({ id: "importReminder", dismissKey: thisMonth, text: `Import last month's sales (${MONTH_NAMES[last.month - 1]} ${last.year}) to see how it went.` });
  }
  if (on("monday") && weekdayOf(t) === 1 && dismissed.monday !== iso) {
    out.push({ id: "monday", dismissKey: iso, week: doc.sample ? null : weeklySummary(doc.months, doc.services, today) });
  }
  if (on("satFull") && !doc.sample && saturdaysFull(doc.months, today)) {
    const [w] = fullWeeks(doc.months, today, 1);
    const key = String(w.end);
    if (dismissed.satFull !== key) out.push({ id: "satFull", dismissKey: key, text: "Saturday mornings have been full three weeks in a row. Consider taking bookings, or an extra barber on Saturdays." });
  }
  if (on("restock") && today.day >= 20 && today.day <= 25 && dismissed.restock !== thisMonth) {
    out.push({ id: "restock", dismissKey: thisMonth, text: "Month-end is your busiest week. Restock blades and products." });
  }
  return out;
}
