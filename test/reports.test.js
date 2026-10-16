import { test } from "node:test";
import assert from "node:assert/strict";
import { customReport, toCsv, transactionsCsv, serviceRows, barberRows, pctChange } from "../src/core/reports.js";
import { parseCsv } from "../src/core/csv.js";
import { importSales } from "../src/core/importer.js";
import { summarise } from "../src/core/month.js";
import { planPrice } from "../src/core/planner.js";
import { sampleData, exampleOctoberCsv } from "../src/core/sample.js";
import { applyImport } from "../src/core/importer.js";

// The October example sheet, imported, as the app would hold it.
const doc0 = sampleData();
const imported = importSales(exampleOctoberCsv(), doc0);
const doc = applyImport(doc0, imported);
const oct = doc.months["2026-10"];
const s = summarise("2026-10", oct, doc.services, doc.barbers);

test("custom report: Saturdays + Kids Cut gives the same count the Price Planner uses", () => {
  const r = customReport("2026-10", oct.sales, { from: 1, to: 31, barber: "all", service: "kids", day: 6 });
  const kids = s.bySvc.find((x) => x.id === "kids");
  assert.equal(r.cuts, kids.satCount);
  assert.equal(r.cuts, planPrice(kids, { priceCents: 8000, satOnly: true }).n);
});

test("custom report: filters combine, dates clamp to the month, and an empty match is fine", () => {
  const all = customReport("2026-10", oct.sales, { from: 1, to: 99, barber: "all", service: "all", day: "all" });
  assert.equal(all.to, 31);
  assert.equal(all.salesCents, s.salesCents);
  assert.equal(all.cuts, s.cuts);
  const thaboWeek = customReport("2026-10", oct.sales, { from: 5, to: 11, barber: "thabo", service: "all", day: "all" });
  assert.ok(thaboWeek.rows.every((r) => r[0] >= 5 && r[0] <= 11 && r[2] === "thabo"));
  assert.equal(thaboWeek.daily.reduce((a, v) => a + v, 0), thaboWeek.salesCents);
  const none = customReport("2026-10", oct.sales, { from: 1, to: 31, barber: "thabo", service: "dreadlocks-retwist", day: 2 });
  assert.equal(none.cuts, 0);
});

test("CSV export quotes names with commas, quotes and semicolons, and reads back identically", () => {
  const rows = [["Fade, with design", 'He said "sharp"', "a;b", "120.00"], ["Plain", "", "x", "-120.00"]];
  const text = toCsv(["service", "note", "x", "price"], rows);
  assert.deepEqual(parseCsv(text).rows.map((r) => r.fields), [["service", "note", "x", "price"], ...rows]);
});

test("the Transactions CSV round-trips through the importer: same sales, same months", () => {
  const text = transactionsCsv("2026-10", oct.sales, doc.services, doc.barbers);
  const again = importSales(text, doc);
  assert.equal(again.error, undefined);
  assert.deepEqual(again.newServices, []);
  assert.deepEqual(again.newBarbers, []);
  const sort = (rows) => [...rows].map((r) => r.join("|")).sort();
  assert.deepEqual(sort(again.months["2026-10"]), sort(oct.sales));
});

test("report rows: biggest first, with changes vs last month", () => {
  assert.equal(pctChange(110, 100), 10);
  assert.equal(pctChange(5, 0), null);
  const rows = serviceRows(s, null);
  assert.ok(rows.every((r, i) => i === 0 || rows[i - 1].salesCents >= r.salesCents));
  assert.equal(rows[0].salesChange, null);
  const b = barberRows(s, s);
  assert.ok(b.every((r) => r.salesChange === 0));
  assert.ok(b.every((r) => r.busiestDay === null || (r.busiestDay >= 0 && r.busiestDay <= 6)));
});
