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

import { parsePrice } from "../src/core/money.js";

test("parsePrice: the separator rule", () => {
  assert.equal(parsePrice("1,200"), 120000); // comma + 3 digits = thousands
  assert.equal(parsePrice("120,5"), 12050); // comma + 1 digit = decimal
  assert.equal(parsePrice("1.200,00"), 120000); // European style
  assert.equal(parsePrice("1,200.00"), 120000); // English style
  assert.equal(parsePrice("120,00"), 12000);
  assert.equal(parsePrice("120"), 12000);
  assert.equal(parsePrice("12000"), 1200000);
});

test("parsePrice: a leading R and every kind of space", () => {
  assert.equal(parsePrice("R 1 200,00"), 120000);
  assert.equal(parsePrice("R1 200.00"), 120000);
  assert.equal(parsePrice("R1 200,00"), 120000); // no-break space, as Excel exports it
  assert.equal(parsePrice("R1 200"), 120000); // narrow no-break space
  assert.equal(parsePrice("  r120 "), 12000);
});

test("parsePrice: negatives are refunds", () => {
  assert.equal(parsePrice("-120"), -12000);
  assert.equal(parsePrice("−120"), -12000); // Unicode minus
  assert.equal(parsePrice("(120.00)"), -12000); // accounting style
  assert.equal(parsePrice("R-120"), -12000);
  assert.equal(parsePrice("-R120"), -12000);
});

test("parsePrice: zero is a free cut, junk is unreadable", () => {
  assert.equal(parsePrice("0"), 0);
  assert.equal(parsePrice("R0,00"), 0);
  assert.ok(Number.isNaN(parsePrice("")));
  assert.ok(Number.isNaN(parsePrice("R")));
  assert.ok(Number.isNaN(parsePrice("free")));
  assert.ok(Number.isNaN(parsePrice("12a")));
  assert.ok(Number.isNaN(parsePrice(undefined)));
});
