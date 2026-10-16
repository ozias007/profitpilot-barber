import { test } from "node:test";
import assert from "node:assert/strict";
import { reminders, fullWeeks, weeklySummary, saturdaysFull } from "../src/core/reminders.js";

const services = [{ id: "fade", name: "Fade" }, { id: "kids", name: "Kids Cut" }];
const month = (sales = []) => ({ sales, costs: {}, costsSource: null });
const doc = (months, extra = {}) => ({ sample: false, months, services, prefs: { notify: {} }, dismissed: {}, ...extra });
const ids = (list) => list.map((r) => r.id);
// October 2026: Monday 5, 12, 19, 26; Saturday 3, 10, 17, 24, 31. November 2: a Monday.

test("import reminder: 1st–7th only, when last month is missing, gone once imported, dismissed for the month", () => {
  const aug = doc({ "2026-08": month() }); // September not imported yet
  assert.deepEqual(ids(reminders(aug, { year: 2026, month: 10, day: 1 })), ["importReminder"]);
  assert.match(reminders(aug, { year: 2026, month: 10, day: 7 })[0].text, /September 2026/);
  assert.deepEqual(ids(reminders(aug, { year: 2026, month: 10, day: 8 })), []);
  assert.deepEqual(ids(reminders(doc({ "2026-09": month() }), { year: 2026, month: 10, day: 1 })), []); // September is in
  const imported = doc({ "2026-09": month(), "2026-10": month() });
  assert.deepEqual(ids(reminders(imported, { year: 2026, month: 11, day: 3 })).includes("importReminder"), false);
  const dismissed = doc({ "2026-08": month() }, { dismissed: { importBanner: "2026-10" } });
  assert.deepEqual(ids(reminders(dismissed, { year: 2026, month: 10, day: 2 })), []);
  const off = doc({ "2026-08": month() }, { prefs: { notify: { importReminder: false } } });
  assert.deepEqual(ids(reminders(off, { year: 2026, month: 10, day: 2 })), []);
});

test("restock: the 20th to the 25th", () => {
  const d = doc({});
  const restock = (day) => ids(reminders(d, { year: 2026, month: 10, day })).includes("restock");
  assert.equal(restock(19), false);
  assert.equal(restock(20), true);
  assert.equal(restock(25), true);
  assert.equal(restock(26), false);
});

test("full weeks: Monday–Sunday, entirely inside stored months, ended before today", () => {
  const months = { "2026-10": month() };
  // on Monday 2 Nov, the latest finished week (26 Oct – 1 Nov) runs into November, which isn't stored
  const [w] = fullWeeks(months, { year: 2026, month: 11, day: 2 });
  assert.deepEqual(w, { start: Date.UTC(2026, 9, 19) / 864e5, end: Date.UTC(2026, 9, 25) / 864e5 });
  assert.equal(fullWeeks(months, { year: 2026, month: 10, day: 25 }).length, 1); // Sunday 25th: that week isn't over yet
  assert.equal(fullWeeks(months, { year: 2026, month: 10, day: 25 })[0].end, Date.UTC(2026, 9, 18) / 864e5);
  assert.deepEqual(fullWeeks({}, { year: 2026, month: 11, day: 2 }), []);
});

test("Monday card: the latest full week vs the week before, top service and busiest slot", () => {
  const sales = [
    [19, 9 * 60, "thabo", "fade", 12000, 40], [24, 9 * 60, "thabo", "fade", 12000, 40], [24, 9 * 60 + 30, "thabo", "kids", 7000, 25], // week of 19–25
    [12, 9 * 60, "thabo", "kids", 7000, 25], // week of 12–18
  ];
  const w = weeklySummary({ "2026-10": month(sales) }, services, { year: 2026, month: 11, day: 2 });
  assert.equal(w.from, "19 Oct");
  assert.equal(w.to, "25 Oct");
  assert.equal(w.salesCents, 31000);
  assert.equal(w.cuts, 3);
  assert.equal(w.salesChange, Math.round(((31000 - 7000) / 7000) * 100));
  assert.equal(w.topService, "Fade");
  assert.equal(w.busiestSlot, "Saturday 08:00–10:00");
  const card = reminders(doc({ "2026-10": month(sales) }), { year: 2026, month: 11, day: 2 }).find((r) => r.id === "monday");
  assert.equal(card.week.topService, "Fade");
});

test("Monday card without a full week in the data shows the 'import this month so far' message", () => {
  const card = reminders(doc({}), { year: 2026, month: 11, day: 2 }).find((r) => r.id === "monday");
  assert.equal(card.week, null);
  assert.ok(!ids(reminders(doc({}), { year: 2026, month: 11, day: 3 })).includes("monday")); // Tuesday: no card
});

test("Saturday mornings full: 3 full weeks in a row fires, 2 doesn't", () => {
  const busySaturday = (day) => Array.from({ length: 12 }, (_, i) => [day, 8 * 60 + i * 20, "thabo", "fade", 12000, 40]); // 12 cuts in 4 hours = 3 an hour
  const three = { "2026-10": month([...busySaturday(10), ...busySaturday(17), ...busySaturday(24)]) };
  assert.equal(saturdaysFull(three, { year: 2026, month: 10, day: 26 }), true);
  const two = { "2026-10": month([...busySaturday(17), ...busySaturday(24)]) };
  assert.equal(saturdaysFull(two, { year: 2026, month: 10, day: 26 }), false);
  const eleven = { "2026-10": month([...busySaturday(10), ...busySaturday(17), ...busySaturday(24).slice(1)]) };
  assert.equal(saturdaysFull(eleven, { year: 2026, month: 10, day: 26 }), false); // 2.75 an hour on the last one
  assert.ok(ids(reminders(doc(three), { year: 2026, month: 10, day: 27 })).includes("satFull"));
});
