// Writes the two example sales sheets into examples/ from core/sample.js, so the files and the in-app example match.
// Run: node scripts/make-examples.mjs
import { writeFileSync } from "node:fs";
import { exampleSeptemberCsv, exampleOctoberCsv } from "../src/core/sample.js";

writeFileSync(new URL("../examples/sales-2026-09.csv", import.meta.url), exampleSeptemberCsv());
writeFileSync(new URL("../examples/sales-2026-10.csv", import.meta.url), exampleOctoberCsv());
console.log("Wrote examples/sales-2026-09.csv and examples/sales-2026-10.csv");
