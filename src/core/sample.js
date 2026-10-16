// Sample data for the first visit: a made-up shop, "The Fade Room", with two months of sales.
// Generated from a fixed seed, so every device sees exactly the same numbers.

import { daysInMonth, weekday } from "./month.js";

export const SAMPLE_SERVICES = [
  { id: "chiskop", name: "Chiskop", priceCents: 8000, minutes: 15, confirmed: true },
  { id: "fade", name: "Fade", priceCents: 12000, minutes: 40, confirmed: true },
  { id: "beard", name: "Beard Trim", priceCents: 7000, minutes: 20, confirmed: true },
  { id: "design", name: "Hair Design", priceCents: 15000, minutes: 50, confirmed: true },
  { id: "kids", name: "Kids Cut", priceCents: 7000, minutes: 25, confirmed: true },
  { id: "other", name: "Other", priceCents: 10000, minutes: 30, confirmed: true },
];

export const SAMPLE_BARBERS = [
  { id: "thabo", name: "Thabo", ratePct: 11, confirmed: true },
  { id: "sizwe", name: "Sizwe", ratePct: 11, confirmed: true },
  { id: "lerato", name: "Lerato", ratePct: 11, confirmed: true },
  { id: "jason", name: "Jason", ratePct: 11, confirmed: true },
  { id: "nathi", name: "Nathi", ratePct: 11, confirmed: true },
];

// How often each service and barber comes up (weights add up to 1).
const SERVICE_MIX = { chiskop: 0.3, fade: 0.26, beard: 0.13, design: 0.06, kids: 0.15, other: 0.1 };
const BARBER_MIX = { thabo: 0.25, sizwe: 0.21, lerato: 0.19, jason: 0.2, nathi: 0.15 };

// Expected cuts per hour from 08:00 to 19:00, by weekday (0 = Sunday … 6 = Saturday).
// Saturday mornings queue; Friday evenings are busy; weekday lunchtimes are quiet.
const DEMAND = {
  0: [0.8, 1.4, 1.8, 1.9, 1.7, 1.3, 1, 0.8, 0.6, 0.5, 0.4, 0.3],
  1: [0.4, 0.5, 0.6, 0.7, 0.8, 0.7, 0.8, 1, 1.3, 1.4, 1.1, 0.7],
  2: [0.5, 0.6, 0.8, 0.9, 1, 0.9, 1, 1.3, 1.6, 1.7, 1.3, 0.8],
  3: [0.5, 0.6, 0.8, 0.9, 1.1, 1, 1.1, 1.4, 1.7, 1.8, 1.4, 0.9],
  4: [0.6, 0.7, 0.9, 1, 1.2, 1.1, 1.3, 1.6, 2, 2.1, 1.6, 1],
  5: [0.9, 1.1, 1.3, 1.5, 1.8, 1.9, 2.2, 2.6, 3, 3.2, 2.8, 2],
  6: [2.6, 3.4, 3.8, 3.9, 3.6, 3.1, 2.8, 2.4, 2.1, 1.8, 1.4, 1],
};

/** Small seeded random generator (mulberry32): same seed, same sequence, values in [0, 1). */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rand, weights) {
  const x = rand();
  let sum = 0;
  for (const [id, w] of Object.entries(weights)) {
    sum += w;
    if (x < sum) return id;
  }
  return Object.keys(weights).at(-1);
}

/**
 * One month of sales as compact rows: [day, minuteOfDay, barberId, serviceId, priceCents, minutes].
 * `busy` scales the whole month; the last week of the month (payday) runs 35% busier.
 */
export function generateSales(year, month, { seed, busy = 1, services = SAMPLE_SERVICES }) {
  const rand = seededRandom(seed);
  const byId = Object.fromEntries(services.map((s) => [s.id, s]));
  const sales = [];
  for (let day = 1; day <= daysInMonth(year, month); day++) {
    const payday = day >= 25 ? 1.35 : 1;
    DEMAND[weekday(year, month, day)].forEach((perHour, i) => {
      const n = Math.max(0, Math.round(perHour * payday * busy + (rand() - 0.5) * 1.1));
      for (let k = 0; k < n; k++) {
        const s = byId[pickWeighted(rand, SERVICE_MIX)];
        const minuteOfDay = (8 + i) * 60 + (rand() < 0.5 ? 0 : 30);
        sales.push([day, minuteOfDay, pickWeighted(rand, BARBER_MIX), s.id, s.priceCents, s.minutes]);
      }
    });
  }
  return sales;
}

const rand = (r) => r * 100; // whole rand → cents, for readable cost tables

/** The full saved-data document for a first visit (or after Clear All Data). */
export function sampleData() {
  return {
    version: 1,
    sample: true,
    shop: { name: "The Fade Room", location: "Johannesburg, Gauteng", hours: "Mon – Sun 08:00 – 20:00" },
    profile: { name: "", role: "Owner", email: "", phone: "", greet: "Boss" },
    prefs: {
      theme: "system",
      showCommission: true,
      weeklySummary: true,
      notify: { importReminder: true, costJump: true, satFull: true, monday: true, restock: true },
    },
    dismissed: {},
    services: SAMPLE_SERVICES.map((s) => ({ ...s })),
    barbers: SAMPLE_BARBERS.map((b) => ({ ...b })),
    months: {
      "2026-08": {
        sales: generateSales(2026, 8, { seed: 8, busy: 1.08 }),
        costs: { Rent: rand(10000), Products: rand(3050), Electricity: rand(2000), "Water & Other": rand(800), "Internet / Phone": rand(650), "Repairs & Misc.": rand(610) },
        costsSource: null,
      },
      "2026-09": {
        sales: generateSales(2026, 9, { seed: 9, busy: 1.25 }),
        costs: { Rent: rand(10000), Products: rand(3150), Electricity: rand(2760), "Water & Other": rand(820), "Internet / Phone": rand(650), "Repairs & Misc.": rand(780) },
        costsSource: null,
      },
    },
    ui: { view: "dash", sub: {}, month: "2026-09" },
  };
}

// ---------- example sheets: what a real export might look like (September and October 2026) ----------

/** Example costs that go with the example sheets, labelled "example costs" in the app. Electricity is R2 000 both months. */
export const EXAMPLE_COSTS = {
  "2026-09": { Rent: rand(10000), Products: rand(3100), Electricity: rand(2000), "Water & Other": rand(800), "Internet / Phone": rand(650), "Repairs & Misc.": rand(700) },
  "2026-10": { Rent: rand(10000), Products: rand(3200), Electricity: rand(2000), "Water & Other": rand(810), "Internet / Phone": rand(650), "Repairs & Misc.": rand(740) },
};

const pad = (n) => String(n).padStart(2, "0");
const hhmm = (minuteOfDay) => `${pad(Math.floor(minuteOfDay / 60))}:${pad(minuteOfDay % 60)}`;
const CUSTOMERS = ["T. Nkosi", "L. Mokoena", "B. Khumalo", "S. Ndlovu", "K. Molefe", "P. Zulu", "A. van Wyk", "N. Dube"];

/**
 * September 2026: a tidy comma file from a card machine (ISO dates, whole-rand prices, no minutes column).
 */
export function exampleSeptemberCsv() {
  const names = Object.fromEntries([...SAMPLE_BARBERS, ...SAMPLE_SERVICES].map((x) => [x.id, x.name]));
  const lines = ["date,time,barber,service,price"];
  for (const [d, t, b, s, p] of generateSales(2026, 9, { seed: 21, busy: 1.15 })) {
    lines.push(`2026-09-${pad(d)},${hhmm(t)},${names[b]},${names[s]},${p / 100}`);
  }
  return lines.join("\r\n") + "\r\n";
}

/**
 * October 2026: a messier booking-app export — semicolons, day-first dates, "R 120,00" prices, a minutes column,
 * a customer column (which ProfitPilot must ignore), discounted fades that take ~35 minutes, a new service,
 * two refunds and three free kids' cuts.
 */
export function exampleOctoberCsv() {
  const r = seededRandom(2210);
  const names = Object.fromEntries([...SAMPLE_BARBERS, ...SAMPLE_SERVICES].map((x) => [x.id, x.name]));
  const money = (cents) => (cents < 0 ? "-" : "") + "R " + (Math.abs(cents) / 100).toFixed(2).replace(".", ",");
  const lines = ["Date;Time;Staff;Service;Amount;Minutes;Customer"];
  const row = (d, t, b, service, cents, mins) =>
    lines.push(`${pad(d)}/10/2026;${hhmm(t)};${b};${service};${money(cents)};${mins};${CUSTOMERS[Math.floor(r() * CUSTOMERS.length)]}`);

  for (const [d, t, b, s, p, m] of generateSales(2026, 10, { seed: 22, busy: 1.2 })) {
    if (s === "fade") row(d, t, names[b], "Fade", r() < 0.4 ? 9000 : 12000, r() < 0.5 ? 35 : 36); // discounts and quicker fades
    else row(d, t, names[b], names[s], p, m);
  }
  [[7, 15 * 60, "Lerato"], [14, 16 * 60, "Jason"], [21, 15 * 60 + 30, "Sizwe"]].forEach(([d, t, b]) => row(d, t, b, "Kids Cut", 0, 25)); // free cuts
  [[9, 11 * 60, "Thabo"], [23, 17 * 60, "Sizwe"]].forEach(([d, t, b]) => row(d, t, b, "Fade", -12000, 35)); // refunds
  [[10, 9 * 60, "Lerato"], [17, 9 * 60, "Lerato"], [24, 10 * 60, "Lerato"], [31, 9 * 60, "Lerato"]].forEach(([d, t, b]) => row(d, t, b, "Dreadlocks retwist", 25000, 90));
  return lines.join("\r\n") + "\r\n";
}
