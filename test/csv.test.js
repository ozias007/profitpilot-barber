import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, detectDelimiter } from "../src/core/csv.js";

const fields = (text) => parseCsv(text).rows.map((r) => r.fields);

test("delimiter detection: semicolons win when there are more of them", () => {
  assert.equal(detectDelimiter("date,time,barber,service,price"), ",");
  assert.equal(detectDelimiter("Date;Staff;Item;Amount;Customer"), ";");
  assert.equal(detectDelimiter('"Date, local";Barber;Service'), ";"); // a comma inside quotes doesn't count
  assert.equal(detectDelimiter("price"), ","); // tie → comma
});

test("simple comma file with Windows line endings and a byte-order mark", () => {
  const text = "\uFEFFdate,service,price\r\n2026-10-03,Fade,120\r\n2026-10-03,Chiskop,80\r\n";
  const { delimiter, rows } = parseCsv(text);
  assert.equal(delimiter, ",");
  assert.deepEqual(rows.map((r) => r.fields), [["date", "service", "price"], ["2026-10-03", "Fade", "120"], ["2026-10-03", "Chiskop", "80"]]);
  assert.deepEqual(rows.map((r) => r.line), [1, 2, 3]);
});

test("semicolon file keeps decimal commas inside fields", () => {
  assert.deepEqual(fields("Date;Amount\n03/10/2026;120,00\n"), [["Date", "Amount"], ["03/10/2026", "120,00"]]);
});

test("quoted fields can contain the separator, quotes and line breaks", () => {
  const text = 'service,price,note\n"Fade, with design","1,200.00","He said ""sharp"""\n"Beard\nTrim",70,x\n';
  assert.deepEqual(fields(text), [
    ["service", "price", "note"],
    ["Fade, with design", "1,200.00", 'He said "sharp"'],
    ["Beard\nTrim", "70", "x"],
  ]);
});

test("blank lines are skipped but line numbers stay true to the file", () => {
  const { rows } = parseCsv("date,price\n\n2026-10-03,120\n , \n2026-10-04,80");
  assert.deepEqual(rows.map((r) => r.line), [1, 3, 5]);
  assert.deepEqual(rows.at(-1).fields, ["2026-10-04", "80"]); // last line without a newline
});

test("spaces around fields are trimmed; empty fields are kept", () => {
  assert.deepEqual(fields(" a , b ,, c \n1,,3,4"), [["a", "b", "", "c"], ["1", "", "3", "4"]]);
});

test("empty input gives no rows", () => {
  assert.deepEqual(parseCsv("").rows, []);
  assert.deepEqual(parseCsv("\n\n").rows, []);
});
