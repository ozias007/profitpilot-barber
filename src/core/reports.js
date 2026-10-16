// Report rows, the custom filter and CSV export. prd.md > Reports.

import { DAY, TIME, BARBER, SERVICE, PRICE, MINS, weekday, daysInMonth, parseKey } from "./month.js";

/**
 * Custom Report: the month's sales that match every filter.
 * @param filters { from, to (days of the month), barber ("all" or id), service ("all" or id), day ("all" or 0–6) }
 */
export function customReport(key, sales, filters) {
  const { year, month } = parseKey(key);
  const days = daysInMonth(year, month);
  const from = Math.max(1, Math.min(filters.from, days)), to = Math.max(from, Math.min(filters.to, days));
  const rows = sales.filter((r) =>
    r[DAY] >= from && r[DAY] <= to &&
    (filters.barber === "all" || r[BARBER] === filters.barber) &&
    (filters.service === "all" || r[SERVICE] === filters.service) &&
    (filters.day === "all" || weekday(year, month, r[DAY]) === Number(filters.day)));
  const cuts = rows.filter((r) => r[PRICE] >= 0);
  const daily = new Array(days).fill(0);
  for (const r of rows) daily[r[DAY] - 1] += r[PRICE];
  return {
    from, to, rows,
    salesCents: rows.reduce((a, r) => a + r[PRICE], 0),
    cuts: cuts.length,
    mins: cuts.reduce((a, r) => a + r[MINS], 0),
    daily,
  };
}

/** One CSV field: quoted when it holds a comma, quote, semicolon or line break. */
const field = (v) => (/[",;\r\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

/** Rows (arrays) → CSV text with a header row, Windows line endings (what Excel expects). */
export function toCsv(header, rows) {
  return [header, ...rows].map((r) => r.map(field).join(",")).join("\r\n") + "\r\n";
}

const pad = (n) => String(n).padStart(2, "0");
const rand = (cents) => (cents / 100).toFixed(2);

/** The month's sales in the same shape the importer reads, so an export can be imported again unchanged. */
export function transactionsCsv(key, sales, services, barbers) {
  const svc = Object.fromEntries(services.map((s) => [s.id, s.name]));
  const bar = Object.fromEntries(barbers.map((b) => [b.id, b.name]));
  const rows = [...sales].sort((a, b) => a[DAY] - b[DAY] || a[TIME] - b[TIME]).map((r) =>
    [`${key}-${pad(r[DAY])}`, `${pad(Math.floor(r[TIME] / 60))}:${pad(r[TIME] % 60)}`, bar[r[BARBER]] ?? "", svc[r[SERVICE]] ?? "", rand(r[PRICE]), r[MINS]]);
  return toCsv(["date", "time", "barber", "service", "price", "minutes"], rows);
}

/** Change between two figures as a whole percent, or null when there's nothing to compare with. */
export function pctChange(now, before) {
  return before ? Math.round(((now - before) / Math.abs(before)) * 100) : null;
}

/** Service Report rows, biggest sales first, with month-on-month changes. */
export function serviceRows(s, p) {
  return [...s.bySvc].sort((a, b) => b.salesCents - a.salesCents).map((x) => {
    const q = p?.bySvc.find((y) => y.id === x.id);
    return { ...x, countChange: pctChange(x.count, q?.count), salesChange: pctChange(x.salesCents, q?.salesCents), chairMins: x.mins };
  });
}

/** Barber Report rows, biggest sales first. */
export function barberRows(s, p) {
  return [...s.byBarber].sort((a, b) => b.salesCents - a.salesCents).map((b) => {
    const q = p?.byBarber.find((y) => y.id === b.id);
    return { ...b, salesChange: pctChange(b.salesCents, q?.salesCents) };
  });
}
