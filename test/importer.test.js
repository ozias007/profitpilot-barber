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
  assert.deepEqual(r.summary.checkPrices, [{ line: 9, priceCents: 1200000 }]);
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
