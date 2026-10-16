import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore, KEY } from "../src/app/store.js";
import { sampleData } from "../src/core/sample.js";

function fakeStorage({ full = false } = {}) {
  const data = new Map();
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { if (full) throw new DOMException("quota", "QuotaExceededError"); data.set(k, v); },
    removeItem: (k) => data.delete(k),
  };
}

test("first visit gives the sample data", () => {
  const store = createStore(() => fakeStorage());
  const doc = store.load();
  assert.equal(doc.sample, true);
  assert.deepEqual(Object.keys(doc.months), ["2026-08", "2026-09"]);
});

test("saved data comes back after a reload, under the namespaced key", () => {
  const storage = fakeStorage();
  const doc = { ...sampleData(), sample: false, months: { "2026-10": { sales: [[3, 540, "thabo", "fade", 12000, 40]], costs: { Rent: 1000000 }, costsSource: null } } };
  createStore(() => storage).save(doc);
  assert.ok(storage.data.has("profitpilot-barber.v1"));
  assert.equal(KEY, "profitpilot-barber.v1");
  assert.deepEqual(createStore(() => storage).load(), doc);
});

test("sample months are never stored; they are regenerated on load", () => {
  const storage = fakeStorage();
  const doc = sampleData();
  doc.shop.name = "Sipho's";
  createStore(() => storage).save(doc);
  assert.deepEqual(JSON.parse(storage.data.get(KEY)).months, {});
  const back = createStore(() => storage).load();
  assert.equal(back.shop.name, "Sipho's");
  assert.deepEqual(back.months, sampleData().months);
});

test("storage full: save reports failure and the app carries on", () => {
  const store = createStore(() => fakeStorage({ full: true }));
  assert.equal(store.save(sampleData()), false);
  assert.equal(store.ok, false);
});

test("storage blocked (accessing localStorage throws)", () => {
  const store = createStore(() => { throw new DOMException("denied", "SecurityError"); });
  assert.equal(store.ok, false);
  assert.equal(store.load().sample, true);
  assert.equal(store.save(sampleData()), false);
});

test("unreadable saved data: sample shown, the bad copy untouched until a real save", () => {
  const storage = fakeStorage();
  storage.data.set(KEY, "{not json");
  const store = createStore(() => storage);
  assert.equal(store.load().sample, true);
  assert.equal(store.unreadable, true);
  assert.equal(storage.data.get(KEY), "{not json");
  storage.data.set(KEY, JSON.stringify({ version: 99 }));
  const s2 = createStore(() => storage);
  s2.load();
  assert.equal(s2.unreadable, true);
});

test("clear brings the sample back", () => {
  const storage = fakeStorage();
  const store = createStore(() => storage);
  store.save({ ...sampleData(), sample: false, months: {} });
  const doc = store.clear();
  assert.equal(doc.sample, true);
  assert.equal(storage.data.has(KEY), false);
});
