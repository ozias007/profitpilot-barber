// The Import card: choose a CSV or try the example sheets, then show what was read.
// prd.md > Import Sales. The reading itself is core/importer.js; this file is only the screen.

import { importSales, applyImport } from "../../core/importer.js";
import { exampleSeptemberCsv, exampleOctoberCsv, EXAMPLE_COSTS } from "../../core/sample.js";
import { monthLabel } from "../../core/month.js";
import { formatR } from "../../core/money.js";
import { esc, icon } from "../ui/dom.js";

let last = null; // the most recent import result, shown under the card until the next import

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
/** "Row 9: 31/02/2026 isn't a real date." — one plain reason per skipped row. */
function skipReason({ line, reason, value }) {
  if (reason === "date") return value ? `Row ${line}: “${esc(value)}” isn't a real date.` : `Row ${line} has no date.`;
  if (reason === "price") return value ? `Row ${line}: the price “${esc(value)}” isn't a number.` : `Row ${line} has no price.`;
  return `Row ${line} has no service.`;
}

function costNote(data, key) {
  const src = data.months[key]?.costsSource;
  if (src === "example") return `${monthLabel(key)} uses <strong>example costs</strong>.`;
  if (src?.startsWith("copied:")) return `Costs for ${monthLabel(key)} were copied from ${monthLabel(src.slice(7))}. <button class="linkbtn" data-goto="costs/edit">Update them →</button>`;
  return `${monthLabel(key)} has no costs yet. <button class="linkbtn" data-goto="costs/edit">Add your costs →</button>`;
}

function summaryHtml(data) {
  if (!last) return "";
  if (last.error) return `<div class="alert">${icon("i-alert")}<div><b>Couldn't import that file</b>${esc(last.error)}</div></div>`;
  const { summary: s, newServices, newBarbers, mismatches, keys } = last;
  const lines = [];
  const read = s.sales + s.refunds + s.freeCuts;
  const parts = [plural(s.sales, "sale"), s.refunds && plural(s.refunds, "refund"), s.freeCuts && plural(s.freeCuts, "free cut")].filter(Boolean);
  lines.push(`Read ${plural(read, "row")}: ${parts.join(", ")}.${s.skipped.length ? ` ${plural(s.skipped.length, "row")} skipped.` : ""}`);
  if (s.refunds) lines.push(`Refunds took ${formatR(s.refundCents)} off your sales.`);
  for (const x of s.skipped.slice(0, 8)) lines.push(skipReason(x));
  if (s.skipped.length > 8) lines.push(`…and ${s.skipped.length - 8} more skipped rows.`);
  if (s.checkPrices.length) lines.push(`<strong>Please check:</strong> ${s.checkPrices.map((x) => `row ${x.line} is ${formatR(x.priceCents)}`).slice(0, 5).join(", ")}. A cut over R5 000 is usually a misread number.`);
  if (newServices.length || newBarbers.length) {
    const names = [...newServices.map((x) => x.name), ...newBarbers.map((x) => x.name)].map(esc).join(", ");
    lines.push(`New in this file: ${names}. Their settings are marked “please check”.`);
  }
  for (const m of mismatches) lines.push(`${esc(m.name)}s took ${m.fileMinutes} min on average in your file, but your list says ${m.listMinutes}.`);
  for (const k of keys) lines.push(costNote(data, k));
  return `<div class="okmsg">${icon("i-shield")}<div><b>Imported ${plural(s.sales, "sale")} for ${keys.map(monthLabel).join(", ")}</b>${lines.map((l) => `<span style="display:block">${l}</span>`).join("")}</div></div>`;
}

export function importCard(ctx) {
  return `<section class="card mt" id="importCard"><h2>Import a sales sheet <small>CSV from your card machine, booking app or Excel</small></h2>
   <div class="grid c2e" style="gap:18px;align-items:start">
    <div><label class="drop">${icon("i-up")}<b>Choose a CSV file</b><span class="sub">In Excel: File → Save As → CSV. The file stays on this device.</span><input type="file" id="csvFile" accept=".csv,text/csv,text/plain"></label>
     <button class="btn soft mt" id="exampleCsv" style="width:100%;justify-content:center">${icon("i-receipt")}Try with an example sheet (Sept + Oct 2026)</button></div>
    <div><b style="font-size:.86rem">Your sheet needs these columns</b><pre class="csv">date,time,barber,service,price
2026-10-03,09:00,Thabo,Fade,120
2026-10-03,09:30,Sizwe,Chiskop,80</pre>
     <span class="sub">Minutes are optional. Dates can be 2026-10-03 or 03/10/2026, semicolons work too, and other columns (like customer names) are ignored and never saved.
      Download the examples: <a href="examples/sales-2026-09.csv" download>September</a> · <a href="examples/sales-2026-10.csv" download>October</a>.</span></div>
   </div>
   ${summaryHtml(ctx.data)}
  </section>`;
}

function run(ctx, texts, options) {
  let doc = ctx.data, keys = [], merged = null;
  for (const text of texts) {
    const result = importSales(text, doc);
    if (result.error) { last = result; ctx.update(() => {}); return; }
    doc = applyImport(doc, result, options);
    keys.push(...Object.keys(result.months));
    merged = merged ? mergeResults(merged, result) : result;
  }
  last = { ...merged, keys: [...new Set(keys)].sort() };
  ctx.update((d) => Object.assign(d, doc));
  ctx.toast(`Imported ${plural(last.summary.sales, "sale")}`);
}

function mergeResults(a, b) {
  const s = { ...a.summary };
  for (const k of ["sales", "refunds", "refundCents", "freeCuts"]) s[k] += b.summary[k];
  for (const k of ["skipped", "checkPrices"]) s[k] = [...a.summary[k], ...b.summary[k]];
  return { ...b, summary: s, newServices: [...a.newServices, ...b.newServices], newBarbers: [...a.newBarbers, ...b.newBarbers], mismatches: [...a.mismatches, ...b.mismatches] };
}

export function bindImport(el, ctx) {
  const file = el.querySelector("#csvFile");
  if (file) file.addEventListener("change", async () => {
    const f = file.files[0];
    if (!f) return;
    if (!/\.(csv|txt)$/i.test(f.name) && !/csv|text\/plain/i.test(f.type)) {
      last = { error: "Please choose a .csv file. In Excel, use File → Save As → CSV." };
      ctx.update(() => {});
      return;
    }
    run(ctx, [await f.text()]);
  });
  el.querySelector("#exampleCsv")?.addEventListener("click", () => run(ctx, [exampleSeptemberCsv(), exampleOctoberCsv()], { exampleCosts: EXAMPLE_COSTS }));
}
