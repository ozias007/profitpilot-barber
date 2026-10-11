import { test } from "node:test";
import assert from "node:assert/strict";
import { formatR, formatR2, formatNum, pct } from "../src/core/money.js";

const S = " ";

test("formatR shows whole rand with grouped thousands", () => {
  assert.equal(formatR(1234500), `R12${S}345`);
  assert.equal(formatR(12000), "R120");
  assert.equal(formatR(0), "R0");
  assert.equal(formatR(100000000), `R1${S}000${S}000`);
});

test("formatR rounds to the nearest rand and uses a real minus sign", () => {
  assert.equal(formatR(-24000), "−R240");
  assert.equal(formatR(12050), "R121");
  assert.equal(formatR(-40), "R0"); // rounds to nothing, so no minus sign
});

test("formatR2 keeps cents for small rates", () => {
  assert.equal(formatR2(280), "R2.80");
  assert.equal(formatR2(533.333), "R5.33");
  assert.equal(formatR2(-150), "−R1.50");
});

test("formatNum and pct", () => {
  assert.equal(formatNum(12345), `12${S}345`);
  assert.equal(pct(25, 200), 12.5);
  assert.equal(pct(5, 0), 0);
});
