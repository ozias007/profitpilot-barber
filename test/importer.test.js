import { test } from "node:test";
import assert from "node:assert/strict";
import { importSales, applyImport, mapColumns, parseDate, parseTime, makeId } from "../src/core/importer.js";
import { sampleData } from "../src/core/sample.js";

const known = {
  services: [
    { id: "fade", name: "Fade", priceCents: 12000, minutes: 40, confirmed: true },
    { id: "kids", name: "Kids Cut", priceCents: 7000, minutes: 25, confirmed: true },
  ],
  barbers: [
    { id: "thabo", name: "Thabo", ratePct: 11, confirmed: true },
    { id: "nathi", name: "Nathi", ratePct: 11, confirmed: true },
    { id: "musa", name: "Musa", ratePct: 12, confirmed: true },
  ],
};

test("headings: aliases, any case, exact match before 'contains'", () => {
  assert.deepEqual(mapColumns(["Date", "Staff", "Item", "Amount", "Customer"]), { date: 0, barber: 1, service: 2, price: 3 });
  assert.deepEqual(mapColumns(["date", "time", "barber", "service", "price", "minutes"]), { date: 0, time: 1, minutes: 5, price: 4, barber: 2, service: 3 });
  // "Service minutes" is minutes, not the service; "Stylist Name" is the barber
  assert.deepEqual(mapColumns(["Sale Date", "Stylist Name", "Service", "Service minutes", "Total (R)"]), { date: 0, minutes: 3, price: 4, barber: 1, service: 2 });
});

test("dates: year first, or day first with / - or .", () => {
  assert.deepEqual(parseDate("2026-10-03"), { year: 2026, month: 10, day: 3, rest: "" });
  assert.deepEqual(parseDate("03/10/2026"), { year: 2026, month: 10, day: 3, rest: "" });
  assert.deepEqual(parseDate("3-10-2026"), { year: 2026, month: 10, day: 3, rest: "" });
  assert.deepEqual(parseDate("03.10.2026 14:05"), { year: 2026, month: 10, day: 3, rest: " 14:05" });
  assert.equal(parseDate("31/09/2026"), null); // September has 30 days
  assert.equal(parseDate("10/13/2026"), null); // month 13: US order is not guessed
  assert.equal(parseDate("yesterday"), null);
});

test("times: 24-hour, h-notation, AM/PM", () => {
  assert.equal(parseTime("09:30"), 570);
  assert.equal(parseTime("9h30"), 570);
  assert.equal(parseTime("2:15 PM"), 855);
  assert.equal(parseTime("12:00 am"), 0);
  assert.equal(parseTime(""), null);
  assert.equal(parseTime("25:00"), null);
});

test("ids never clash", () => {
  const ids = new Set(["fade"]);
  assert.equal(makeId("Fade", ids), "fade-2");
  assert.equal(makeId("Dreadlocks  Retwist", ids), "dreadlocks-retwist");
});

test("a semicolon export with extra columns: only the six fields are kept", () => {
  const text = [
    "Date;Staff;Item;Amount;Customer;Phone",
    "03/10/2026;Thabo;Fade;R 120,00;Sipho Dlamini;082 555 0101",
    '04/10/2026;Nathi;"Kids Cut";70;"Lindiwe; Mthembu";083 555 0202',
  ].join("\r\n");
  const r = importSales(text, known);
  assert.equal(r.error, undefined);
  assert.deepEqual(r.months, { "2026-10": [[3, 720, "thabo", "fade", 12000, 40], [4, 720, "nathi", "kids", 7000, 25]] });
  const everything = JSON.stringify(r);
  for (const secret of ["Sipho", "Dlamini", "Lindiwe", "Mthembu", "082", "083"]) assert.ok(!everything.includes(secret), secret);
});

test("refunds, free cuts, skipped rows and prices to check are counted", () => {
  const text = [
    "date,time,barber,service,price",
    "2026-10-03,09:00,Thabo,Fade,120", // line 2
    "2026-10-03,09:30,Thabo,Fade,-120", // refund
    "2026-10-03,10:00,Nathi,Kids Cut,(120.00)", // refund
    "2026-10-03,10:30,Nathi,Kids Cut,0", // free cut
    "not a date,11:00,Nathi,Kids Cut,70", // skipped: date (line 6)
    "2026-10-03,11:30,Nathi,Kids Cut,free", // skipped: price (line 7)
    "2026-10-03,12:00,Nathi,,70", // skipped: service (line 8)
    "2026-10-04,12:30,Thabo,Fade,12000.00", // R12 000: imported but flagged (line 9)
  ].join("\n");
  const r = importSales(text, known);
  assert.equal(r.summary.sales, 2);
  assert.equal(r.summary.refunds, 2);
  assert.equal(r.summary.refundCents, -24000);
  assert.equal(r.summary.freeCuts, 1);
  assert.deepEqual(r.summary.skipped, [
    { line: 6, reason: "date", value: "not a date" },
    { line: 7, reason: "price", value: "free" },
    { line: 8, reason: "service", value: "" },
  ]);
  assert.deepEqual(r.summary.checkPrices, [{ line: 9, priceCents: 1200000, key: "2026-10", index: 4, service: "Fade", barber: "Thabo" }]);
  assert.equal(r.months["2026-10"].length, 5);
});

test("an impossible date is skipped with the value that was in the file", () => {
  const r = importSales("date,service,price\n31/02/2026,Fade,120\n2026-10-03,Fade,\n2026-10-03,Fade,120", known);
  assert.deepEqual(r.summary.skipped, [{ line: 2, reason: "date", value: "31/02/2026" }, { line: 3, reason: "price", value: "" }]);
});

test("a missing required column gives a plain error and no data", () => {
  const r = importSales("date,barber,amount\n2026-10-03,Thabo,120", known);
  assert.deepEqual(Object.keys(r), ["error"]);
  assert.match(r.error, /service column/);
  assert.match(importSales("", known).error, /empty/);
  assert.match(importSales("date,service,price\nnope,Fade,abc", known).error, /No rows could be read/);
});

test("rows are split into months; a missing time counts at 12:00; time inside the date cell is used", () => {
  const r = importSales("date,service,price\n2026-09-30 17:30,Fade,120\n2026-10-01,Fade,120", known);
  assert.deepEqual(Object.keys(r.months).sort(), ["2026-09", "2026-10"]);
  assert.equal(r.months["2026-09"][0][1], 17 * 60 + 30);
  assert.equal(r.months["2026-10"][0][1], 720);
  assert.deepEqual(r.summary.perMonth, { "2026-09": 1, "2026-10": 1 });
});

test("new names get suggested defaults marked 'please check', never silent guesses", () => {
  const text = [
    "date,barber,service,price,minutes",
    "2026-10-03,Thabo,Dreadlocks retwist,250,90",
    "2026-10-03,Thabo,Dreadlocks retwist,250,80",
    "2026-10-04,Thabo,Dreadlocks retwist,300,85",
    "2026-10-04,Zola,Fade,120,40",
  ].join("\n");
  const r = importSales(text, known);
  assert.deepEqual(r.newServices, [{ id: "dreadlocks-retwist", name: "Dreadlocks retwist", priceCents: 25000, minutes: 85, confirmed: false }]);
  assert.deepEqual(r.newBarbers, [{ id: "zola", name: "Zola", ratePct: 11, confirmed: false }]); // shop's most common rate
});

test("names match existing ones regardless of case and spacing", () => {
  const r = importSales("date,barber,service,price\n2026-10-03, THABO ,kids  cut,70", known);
  assert.deepEqual(r.newServices, []);
  assert.deepEqual(r.newBarbers, []);
  assert.deepEqual(r.months["2026-10"][0].slice(2, 4), ["thabo", "kids"]);
});

test("file minutes are kept per sale and differences from the list are reported", () => {
  const text = "date,barber,service,price,minutes\n2026-10-03,Thabo,Fade,120,35\n2026-10-03,Thabo,Fade,120,36\n2026-10-03,Thabo,Kids Cut,70,25";
  const r = importSales(text, known);
  assert.deepEqual(r.months["2026-10"].map((x) => x[5]), [35, 36, 25]);
  assert.deepEqual(r.mismatches, [{ serviceId: "fade", name: "Fade", fileMinutes: 36, listMinutes: 40 }]); // 35.5 rounds to 36
});

test("applyImport: first real import drops the sample months and unused sample names", () => {
  const doc = sampleData();
  const r = importSales("date,barber,service,price\n2026-10-03,Thabo,Fade,120\n2026-10-03,Zola,Fade,120", doc);
  const next = applyImport(doc, r);
  assert.equal(next.sample, false);
  assert.deepEqual(Object.keys(next.months), ["2026-10"]);
  assert.deepEqual(next.services.map((s) => s.id), ["fade"]);
  assert.deepEqual(next.barbers.map((b) => b.id), ["thabo", "zola"]);
  assert.deepEqual(next.months["2026-10"].costs, {}); // very first import: empty costs
  assert.equal(next.ui.month, "2026-10");
  assert.equal(doc.sample, true); // input untouched
});

test("applyImport: later months copy costs; example costs are labelled; re-import replaces", () => {
  let doc = { ...sampleData(), sample: false, months: { "2026-09": { sales: [], costs: { Rent: 1000000 }, costsSource: null } } };
  const oct = importSales("date,service,price\n2026-10-03,Fade,120\n2026-10-04,Fade,120", doc);
  doc = applyImport(doc, oct);
  assert.deepEqual(doc.months["2026-10"].costs, { Rent: 1000000 });
  assert.equal(doc.months["2026-10"].costsSource, "copied:2026-09");

  doc.months["2026-10"].costs.Rent = 1100000; // he edits October's rent
  const again = importSales("date,service,price\n2026-10-03,Fade,120", doc);
  doc = applyImport(doc, again);
  assert.equal(doc.months["2026-10"].sales.length, 1); // replaced, not 3
  assert.equal(doc.months["2026-10"].costs.Rent, 1100000); // his October costs survive a re-import

  const ex = applyImport(sampleData(), importSales("date,service,price\n2026-10-03,Fade,120", sampleData()), { exampleCosts: { "2026-10": { Electricity: 200000 } } });
  assert.deepEqual(ex.months["2026-10"].costs, { Electricity: 200000 });
  assert.equal(ex.months["2026-10"].costsSource, "example");
});

import { finalizeImport } from "../src/core/importer.js";

test("prices over R5 000 must be answered: keep, or read as cents", () => {
  const text = "date,barber,service,price\n2026-10-03,Thabo,Fade,12000\n2026-10-03,Thabo,Fade,120\n2026-10-04,Thabo,Fade,9000";
  const r = importSales(text, known);
  assert.deepEqual(r.summary.checkPrices.map((c) => c.line), [2, 4]);
  assert.match(finalizeImport(r, { prices: { 2: "keep" } }).error, /Row 4: choose Keep R9.000 or It's in cents./); // one still unanswered
  const done = finalizeImport(r, { prices: { 2: "cents", 4: "keep" } });
  assert.deepEqual(done.months["2026-10"].map((x) => x[4]), [12000, 12000, 900000]); // R12 000 → R120.00
  assert.equal(r.months["2026-10"][0][4], 1200000); // the original result is untouched
});

test("the owner's answers for new names are used, and new-service minutes reach their sales", () => {
  const text = "date,barber,service,price\n2026-10-03,Zola,Dreadlocks retwist,250\n2026-10-04,Zola,Dreadlocks retwist,250";
  const r = importSales(text, known);
  assert.deepEqual(r.months["2026-10"].map((x) => x[5]), [30, 30]); // default until confirmed
  const done = finalizeImport(r, {
    services: { "dreadlocks-retwist": { minutes: 90, priceCents: 26000, confirmed: true } },
    barbers: { zola: { ratePct: 12, confirmed: false } },
  });
  assert.deepEqual(done.newServices[0], { id: "dreadlocks-retwist", name: "Dreadlocks retwist", priceCents: 26000, minutes: 90, confirmed: true });
  assert.deepEqual(done.newBarbers[0], { id: "zola", name: "Zola", ratePct: 12, confirmed: false });
  assert.deepEqual(done.months["2026-10"].map((x) => x[5]), [90, 90]);
});

test("rows that had minutes in the file keep them even when the owner changes the list minutes", () => {
  const r = importSales("date,service,price,minutes\n2026-10-03,Dreadlocks retwist,250,85", known);
  const done = finalizeImport(r, { services: { "dreadlocks-retwist": { minutes: 90 } } });
  assert.equal(done.months["2026-10"][0][5], 85);
});

import { checkStepAnswers } from "../src/core/importer.js";

test("a new service whose only sales were free cuts can still be imported", () => {
  const text = "date,barber,service,price\n2026-10-03,Thabo,Shape-up,0\n2026-10-03,Thabo,Fade,120";
  const r = importSales(text, known);
  assert.equal(r.newServices[0].name, "Shape-up");
  assert.equal(r.newServices[0].priceCents, 0); // no paid sale to suggest a price from: the field starts empty

  const items = { services: r.newServices, barbers: r.newBarbers, prices: r.summary.checkPrices };
  assert.deepEqual(checkStepAnswers(items, { "price:shape-up": "" }).errors, { "svc:shape-up": "Shape-up needs a list price." });

  const { edits, errors } = checkStepAnswers(items, { "price:shape-up": "60", "min:shape-up": "15", "ok:svc:shape-up": true });
  assert.deepEqual(errors, {});
  const done = finalizeImport(r, edits);
  assert.equal(done.error, undefined);
  assert.deepEqual(done.newServices[0], { id: "shape-up", name: "Shape-up", priceCents: 6000, minutes: 15, confirmed: true });
  const doc = applyImport({ ...known, sample: false, months: {}, ui: {} }, done);
  assert.deepEqual(doc.months["2026-10"].sales[0], [3, 720, "thabo", "shape-up", 0, 15]); // still a free cut, with confirmed minutes
});

test("the list price pre-fill is the most common PAID price", () => {
  const r = importSales("date,service,price\n2026-10-03,Shape-up,0\n2026-10-03,Shape-up,0\n2026-10-04,Shape-up,60", known);
  assert.equal(r.newServices[0].priceCents, 6000);
});

test("step errors name the item they belong to", () => {
  const r = importSales("date,barber,service,price\n2026-10-03,Zola,Shape-up,60\n2026-10-03,Thabo,Fade,12000", known);
  const items = { services: r.newServices, barbers: r.newBarbers, prices: r.summary.checkPrices };
  const { errors } = checkStepAnswers(items, { "price:shape-up": "abc", "min:shape-up": "15", "rate:zola": "120" });
  assert.deepEqual(errors, {
    "svc:shape-up": "Shape-up's list price must be above R0.",
    "barber:zola": "Zola's commission must be between 0% and 100%.",
    "row:3": "Row 3: choose Keep R12 000 or It's in cents.",
  });
  assert.equal(checkStepAnswers(items, { "price:shape-up": "60", "min:shape-up": "1.5" }).errors["svc:shape-up"], "Shape-up needs its minutes, as a whole number above 0.");
});
