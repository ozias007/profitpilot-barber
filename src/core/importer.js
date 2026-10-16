// Reads a sales export into ProfitPilot's months. prd.md > Import Sales.
// Only six fields are ever read: date, time, barber, service, price, minutes.
// Every other column (customer names, phone numbers…) is never touched, so it can't be stored.

import { parseCsv } from "./csv.js";
import { parsePrice, formatR } from "./money.js";
import { daysInMonth } from "./month.js";

/** Heading words that identify each field (case-insensitive). Exact matches win; otherwise "contains". */
export const ALIASES = {
  date: ["date"],
  time: ["time"],
  minutes: ["minutes", "min", "duration"],
  price: ["price", "amount", "total"],
  barber: ["barber", "staff", "stylist"],
  service: ["service", "item", "product"],
};
const REQUIRED = ["date", "service", "price"];

/** A sale above this is still imported, but listed as "please check" (a misread number or a cents column). */
export const CHECK_ABOVE_CENTS = 500000;

/** Find the column index for each field from the heading row. */
export function mapColumns(headings) {
  const h = headings.map((x) => x.toLowerCase().trim());
  const taken = new Set();
  const cols = {};
  const claim = (field, i) => { cols[field] = i; taken.add(i); };
  for (const [field, words] of Object.entries(ALIASES)) {
    const i = h.findIndex((x, k) => !taken.has(k) && words.includes(x));
    if (i >= 0) claim(field, i);
  }
  for (const [field, words] of Object.entries(ALIASES)) {
    if (field in cols) continue;
    const i = h.findIndex((x, k) => !taken.has(k) && words.some((w) => x.includes(w)));
    if (i >= 0) claim(field, i);
  }
  return cols;
}

/** "2026-10-03", "2026/10/03", "03/10/2026", "03-10-2026" or "03.10.2026" (day first) → { year, month, day, rest } or null. */
export function parseDate(text) {
  const s = String(text ?? "").trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(.*)$/);
  let year, month, day;
  if (m) [year, month, day] = [+m[1], +m[2], +m[3]];
  else if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(.*)$/))) [day, month, year] = [+m[1], +m[2], +m[3]];
  else return null;
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day, rest: m[4] };
}

/** "09:30", "9h30", "9:30 PM", "2026-10-03 14:05" → minutes since midnight, or null. */
export function parseTime(text) {
  const m = String(text ?? "").match(/(\d{1,2})[:h.](\d{2})\s*([ap]\.?m\.?)?/i);
  if (!m) return null;
  let hour = +m[1];
  const minute = +m[2];
  const ampm = m[3]?.[0].toLowerCase();
  if (ampm === "p" && hour < 12) hour += 12;
  if (ampm === "a" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

const NOON = 12 * 60;
const keyOf = (year, month) => `${year}-${String(month).padStart(2, "0")}`;
const norm = (name) => name.trim().replace(/\s+/g, " ").toLowerCase();

/** An id that doesn't clash with existing ones: "Dreadlocks retwist" → "dreadlocks-retwist". */
export function makeId(name, existingIds) {
  const base = norm(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
  let id = base, n = 2;
  while (existingIds.has(id)) id = `${base}-${n++}`;
  existingIds.add(id);
  return id;
}

function mostCommon(values, fallback) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  let best = fallback, bestCount = 0;
  for (const [v, c] of counts) if (c > bestCount) { best = v; bestCount = c; }
  return best;
}

/**
 * Read a CSV export.
 * @param text the file's text
 * @param known { services, barbers } already in the app (matched by name, ignoring case)
 * @returns { error } or {
 *   months: { "2026-10": [[day, minuteOfDay, barberId, serviceId, priceCents, minutes], …] },
 *   newServices: [{ id, name, priceCents, minutes, confirmed: false }],
 *   newBarbers:  [{ id, name, ratePct, confirmed: false }],
 *   mismatches:  [{ serviceId, name, fileMinutes, listMinutes }],
 *   summary: { sales, refunds, refundCents, freeCuts, skipped: [{ line, reason, value }], checkPrices: [{ line, priceCents }], perMonth: { key: count } }
 * }
 */
export function importSales(text, known) {
  const { rows } = parseCsv(text);
  if (!rows.length) return { error: "The file is empty." };

  const cols = mapColumns(rows[0].fields);
  const missing = REQUIRED.filter((f) => !(f in cols));
  if (missing.length) {
    const list = missing.length > 1 ? `${missing.slice(0, -1).join(", ")} and ${missing.at(-1)}` : missing[0];
    return { error: `Couldn't find the ${list} column${missing.length > 1 ? "s" : ""}. The first row must be headings, for example: date, time, barber, service, price.` };
  }

  const ids = { svc: new Set(known.services.map((s) => s.id)), barber: new Set(known.barbers.map((b) => b.id)) };
  const services = new Map(known.services.map((s) => [norm(s.name), s]));
  const barbers = new Map(known.barbers.map((b) => [norm(b.name), b]));
  const newServices = [], newBarbers = [];
  const filePrices = new Map(); // new service id → prices seen (for the most common price)
  const fileMinutes = new Map(); // service id → minutes seen in the file
  const shopRate = mostCommon(known.barbers.map((b) => b.ratePct), 10);

  const months = {};
  const summary = { sales: 0, refunds: 0, refundCents: 0, freeCuts: 0, skipped: [], checkPrices: [], perMonth: {} };
  const cell = (fields, field) => (field in cols ? fields[cols[field]] ?? "" : "");

  for (const { line, fields } of rows.slice(1)) {
    const date = parseDate(cell(fields, "date"));
    if (!date) { summary.skipped.push({ line, reason: "date", value: cell(fields, "date").trim() }); continue; }
    const price = parsePrice(cell(fields, "price"));
    if (Number.isNaN(price)) { summary.skipped.push({ line, reason: "price", value: cell(fields, "price").trim() }); continue; }
    const serviceName = cell(fields, "service").trim();
    if (!serviceName) { summary.skipped.push({ line, reason: "service", value: "" }); continue; }

    const time = parseTime(cell(fields, "time")) ?? parseTime(date.rest) ?? NOON;
    const barberName = cell(fields, "barber").trim() || "Unknown";
    const minsInFile = Math.round(Number(String(cell(fields, "minutes")).replace(",", ".")));
    const hasMinutes = Number.isFinite(minsInFile) && minsInFile > 0;

    let service = services.get(norm(serviceName));
    if (!service) {
      service = { id: makeId(serviceName, ids.svc), name: serviceName.replace(/\s+/g, " "), priceCents: 0, minutes: 30, confirmed: false };
      services.set(norm(serviceName), service);
      newServices.push(service);
      filePrices.set(service.id, []);
    }
    let barber = barbers.get(norm(barberName));
    if (!barber) {
      barber = { id: makeId(barberName, ids.barber), name: barberName.replace(/\s+/g, " "), ratePct: shopRate, confirmed: false };
      barbers.set(norm(barberName), barber);
      newBarbers.push(barber);
    }

    if (price > 0 && filePrices.has(service.id)) filePrices.get(service.id).push(price);
    if (hasMinutes && price >= 0) (fileMinutes.get(service.id) ?? fileMinutes.set(service.id, []).get(service.id)).push(minsInFile);

    const key = keyOf(date.year, date.month);
    (months[key] ??= []).push([date.day, time, barber.id, service.id, price, hasMinutes ? minsInFile : null]);
    summary.perMonth[key] = (summary.perMonth[key] || 0) + 1;
    if (price < 0) { summary.refunds++; summary.refundCents += price; }
    else if (price === 0) summary.freeCuts++;
    else summary.sales++;
    if (price > CHECK_ABOVE_CENTS) {
      summary.checkPrices.push({ line, priceCents: price, key, index: months[key].length - 1, service: service.name, barber: barber.name });
    }
  }

  if (!Object.keys(months).length) {
    return { error: "No rows could be read. Check the dates (2026-10-03 or 03/10/2026) and the prices." };
  }

  // New services: most common price in the file; minutes from the file's average, else 30.
  for (const s of newServices) {
    s.priceCents = mostCommon(filePrices.get(s.id), 0);
    const seen = fileMinutes.get(s.id);
    if (seen?.length) s.minutes = Math.round(seen.reduce((a, v) => a + v, 0) / seen.length);
  }
  // Rows without minutes in the file use the service's list minutes.
  const listMinutes = new Map([...services.values()].map((s) => [s.id, s.minutes]));
  for (const sales of Object.values(months)) for (const r of sales) if (r[5] == null) r[5] = listMinutes.get(r[3]);

  // Known services whose average minutes in the file differ from the list.
  const mismatches = [];
  for (const s of known.services) {
    const seen = fileMinutes.get(s.id);
    if (!seen?.length) continue;
    const avg = Math.round(seen.reduce((a, v) => a + v, 0) / seen.length);
    if (avg !== s.minutes) mismatches.push({ serviceId: s.id, name: s.name, fileMinutes: avg, listMinutes: s.minutes });
  }

  // which services had minutes in the file (finalizeImport leaves those rows alone)
  return { months, newServices, newBarbers, mismatches, summary, minutesFromFile: [...fileMinutes.keys()] };
}

/**
 * Put an import into the saved document (returns a new document; the input is not changed).
 *  - The first real import replaces the sample data. Sample services/barbers whose names appear in the file are kept
 *    (with their list settings); the rest are dropped so the made-up shop doesn't linger.
 *  - A month that already exists is replaced, never merged.
 *  - Costs: `exampleCosts[key]` when given (labelled "example"); otherwise copied from the previous real month; else empty.
 */
export function applyImport(doc, result, { exampleCosts } = {}) {
  const next = structuredClone(doc);
  if (next.sample) {
    const used = { svc: new Set(), barber: new Set() };
    for (const sales of Object.values(result.months)) for (const r of sales) { used.barber.add(r[2]); used.svc.add(r[3]); }
    next.months = {};
    next.services = next.services.filter((s) => used.svc.has(s.id));
    next.barbers = next.barbers.filter((b) => used.barber.has(b.id));
    next.sample = false;
  }
  next.services.push(...result.newServices.map((s) => ({ ...s })));
  next.barbers.push(...result.newBarbers.map((b) => ({ ...b })));

  for (const key of Object.keys(result.months).sort()) {
    const earlier = Object.keys(next.months).filter((k) => k < key).sort().at(-1);
    let costs = {}, costsSource = null;
    if (exampleCosts?.[key]) { costs = { ...exampleCosts[key] }; costsSource = "example"; }
    else if (next.months[key]) { costs = next.months[key].costs; costsSource = next.months[key].costsSource; } // re-import keeps that month's costs
    else if (earlier) { costs = { ...next.months[earlier].costs }; costsSource = `copied:${earlier}`; }
    next.months[key] = { sales: result.months[key], costs, costsSource };
  }
  next.ui = { ...next.ui, month: Object.keys(result.months).sort().at(-1) };
  return next;
}

/**
 * Apply the owner's answers from the "New in this file" step to an import result (returns a new result).
 * @param edits {
 *   services: { [id]: { priceCents, minutes, confirmed } },
 *   barbers:  { [id]: { ratePct, confirmed } },
 *   prices:   { [line]: "keep" | "cents" }   // every price over R5 000 must have an answer
 * }
 * "cents" means the file held cents in a rand column: R12 000 becomes R120.00.
 * @returns the finished result, or { error } when a price to check has no answer yet.
 */
export function finalizeImport(result, edits = {}) {
  const next = structuredClone(result);
  for (const s of next.newServices) Object.assign(s, edits.services?.[s.id]);
  for (const b of next.newBarbers) Object.assign(b, edits.barbers?.[b.id]);

  const newMinutes = new Map(next.newServices.map((s) => [s.id, s.minutes]));
  const minutesFromFile = new Set(result.minutesFromFile || []);
  for (const sales of Object.values(next.months)) {
    for (const r of sales) {
      // a new service's sales without file minutes take the minutes the owner confirmed
      if (newMinutes.has(r[3]) && !minutesFromFile.has(r[3])) r[5] = newMinutes.get(r[3]);
    }
  }

  for (const c of next.summary.checkPrices) {
    const answer = edits.prices?.[c.line];
    if (answer !== "keep" && answer !== "cents") return { error: unansweredPrice(c) };
    if (answer === "cents") {
      const cents = Math.round(c.priceCents / 100);
      next.months[c.key][c.index][4] = cents;
      c.priceCents = cents;
    }
    c.answer = answer;
  }
  return next;
}

/**
 * Check what the owner typed in the "New in this file" step.
 * @param items { services: newServices, barbers: newBarbers, prices: checkPrices } from the import result(s)
 * @param draft the raw form values: "min:<id>", "price:<id>", "rate:<id>", "ok:svc:<id>", "ok:barber:<id>", "row:<line>"
 * @returns { edits, errors } — edits for finalizeImport; errors keyed "svc:<id>", "barber:<id>" or "row:<line>",
 *   each naming the item it belongs to, so the screen can show it right next to that item.
 */
export function checkStepAnswers(items, draft) {
  const edits = { services: {}, barbers: {}, prices: {} };
  const errors = {};
  for (const s of items.services) {
    const minutes = Number(String(draft[`min:${s.id}`] ?? s.minutes).trim());
    const priceText = String(draft[`price:${s.id}`] ?? "").trim();
    const priceCents = parsePrice(priceText);
    if (!priceText) errors[`svc:${s.id}`] = `${s.name} needs a list price.`;
    else if (!(priceCents > 0)) errors[`svc:${s.id}`] = `${s.name}'s list price must be above R0.`;
    else if (!(Number.isInteger(minutes) && minutes > 0)) errors[`svc:${s.id}`] = `${s.name} needs its minutes, as a whole number above 0.`;
    edits.services[s.id] = { minutes, priceCents, confirmed: Boolean(draft[`ok:svc:${s.id}`]) };
  }
  for (const b of items.barbers) {
    const ratePct = Number(String(draft[`rate:${b.id}`] ?? b.ratePct).trim().replace(",", "."));
    if (!(ratePct >= 0 && ratePct <= 100)) errors[`barber:${b.id}`] = `${b.name}'s commission must be between 0% and 100%.`;
    edits.barbers[b.id] = { ratePct, confirmed: Boolean(draft[`ok:barber:${b.id}`]) };
  }
  for (const c of items.prices) {
    const answer = draft[`row:${c.line}`];
    if (answer !== "keep" && answer !== "cents") errors[`row:${c.line}`] = unansweredPrice(c);
    else edits.prices[c.line] = answer;
  }
  return { edits, errors };
}

/** "Row 10: choose Keep R12 000 or It's in cents." */
function unansweredPrice(c) {
  return `Row ${c.line}: choose Keep ${formatR(c.priceCents)} or It's in cents.`;
}
