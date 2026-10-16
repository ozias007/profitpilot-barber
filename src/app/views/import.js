// The Import card: choose a CSV or try the example sheets, then confirm anything new, then show what was read.
// prd.md > Import Sales. Reading and the rules live in core/importer.js; this file is only the screen and the steps:
//   1. "Replace them with this file?" when a month is already there (never merge)
//   2. "New in this file": minutes and list price for new services, commission for new barbers,
//      and an answer for every sale over R5 000 ("Keep R12 000" / "It's in cents: R120.00")
//   3. the summary, with a one-tap Update when the file's minutes differ from the list

import { importSales, applyImport, finalizeImport, checkStepAnswers } from "../../core/importer.js";
import { exampleSeptemberCsv, exampleOctoberCsv, EXAMPLE_COSTS } from "../../core/sample.js";
import { monthLabel } from "../../core/month.js";
import { formatR, formatR2 } from "../../core/money.js";
import { esc, icon } from "../ui/dom.js";

let pending = null; // an import waiting for the owner's answers: { results, options, collisions, stage, error }
let last = null; // the finished import (or an error), shown under the card until the next import

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const redraw = (ctx) => ctx.update(() => {}, { uiOnly: true });

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
  if (Object.keys(data.months[key]?.costs || {}).length) return `${monthLabel(key)} keeps the costs you entered before.`;
  return `${monthLabel(key)} has no costs yet. <button class="linkbtn" data-goto="costs/edit">Add your costs →</button>`;
}

// ---------- the summary after an import ----------

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
  for (const c of s.checkPrices) {
    lines.push(c.answer === "cents" ? `Row ${c.line} was read as cents: ${formatR2(c.priceCents)}.` : `Row ${c.line}: kept ${formatR(c.priceCents)} as you confirmed.`);
  }
  const added = [...newServices, ...newBarbers];
  if (added.length) {
    const unchecked = added.filter((x) => !x.confirmed).map((x) => esc(x.name));
    lines.push(`Added ${added.map((x) => esc(x.name)).join(", ")}.${unchecked.length ? ` Still to check: ${unchecked.join(", ")}.` : ""}`);
  }
  for (const m of mismatches) {
    lines.push(`${esc(m.name)}s took ${m.fileMinutes} min on average in your file, but your list says ${m.listMinutes}. <button class="linkbtn" data-minutes="${esc(m.serviceId)}:${m.fileMinutes}">Update the list to ${m.fileMinutes} min →</button>`);
  }
  for (const k of keys) lines.push(costNote(data, k));
  return `<div class="okmsg">${icon("i-shield")}<div><b>Imported ${plural(s.sales, "sale")} for ${keys.map(monthLabel).join(", ")}</b>${lines.map((l) => `<span style="display:block">${l}</span>`).join("")}</div></div>`;
}

// ---------- the steps before an import is saved ----------

function replaceStep(data) {
  const lines = pending.collisions.map((k) => `${monthLabel(k)} already has ${plural(data.months[k].sales.length, "sale")}.`).join(" ");
  return `<div class="step" role="group" aria-label="Replace a month">
    <h3>${lines} Replace them with this file?</h3>
    <p class="empty-note">The old sales for ${pending.collisions.length > 1 ? "those months" : "that month"} are removed, never added twice. Costs you entered stay.</p>
    <div class="actions"><button type="button" class="btn primary" id="impReplace">Replace</button><button type="button" class="btn" id="impCancel">Cancel</button></div>
  </div>`;
}

function namesStep() {
  const services = pending.results.flatMap((r) => r.newServices);
  const barbers = pending.results.flatMap((r) => r.newBarbers);
  const prices = pending.results.flatMap((r) => r.summary.checkPrices);
  const draft = pending.draft ?? {}; // what the owner typed, kept when the step redraws with an error
  const errors = pending.errors ?? {};
  const badge = `<span class="badge-check">please check</span>`;
  const checked = (key) => `<label><input type="checkbox" data-ok="${esc(key)}" ${draft[key] ? "checked" : ""}> Checked</label>`;
  const val = (key, fallback) => esc(draft[key] ?? fallback);
  const err = (key) => (errors[key] ? `<div class="alert" style="flex-basis:100%;margin-top:4px">${icon("i-alert")}<div>${esc(errors[key])}</div></div>` : "");
  return `<form class="step" id="namesStep" aria-label="New in this file" onsubmit="return false">
    <h3>New in this file</h3>
    <p class="empty-note">Nothing is guessed silently. Check these before the import is saved. Anything you don't tick stays marked “please check”.</p>
    ${services.map((s) => `<div class="row"><b>${esc(s.name)}${badge}</b>
      <label>Minutes <input class="in-n" data-field="min:${esc(s.id)}" inputmode="numeric" value="${val(`min:${s.id}`, s.minutes)}" aria-label="${esc(s.name)} minutes"></label>
      <label>List price <span class="money-in">R<input data-field="price:${esc(s.id)}" inputmode="decimal" value="${val(`price:${s.id}`, s.priceCents ? s.priceCents / 100 : "")}" placeholder="${s.priceCents ? "" : "no paid sale"}" aria-label="${esc(s.name)} list price"></span></label>
      ${checked(`ok:svc:${s.id}`)}${err(`svc:${s.id}`)}</div>`).join("")}
    ${barbers.map((b) => `<div class="row"><b>${esc(b.name)}${badge}</b>
      <label>Commission <span class="money-in pctin"><input data-field="rate:${esc(b.id)}" inputmode="decimal" value="${val(`rate:${b.id}`, b.ratePct)}" aria-label="${esc(b.name)} commission percent">%</span></label>
      ${checked(`ok:barber:${b.id}`)}${err(`barber:${b.id}`)}</div>`).join("")}
    ${prices.map((c) => `<div class="row"><b>Row ${c.line}: ${formatR(c.priceCents)}</b><span class="sub">${esc(c.service)} by ${esc(c.barber)}. Over R5 000 is unusual for one cut.</span>
      <label><input type="radio" name="price-${c.line}" value="keep" ${draft[`row:${c.line}`] === "keep" ? "checked" : ""}> Keep ${formatR(c.priceCents)}</label>
      <label><input type="radio" name="price-${c.line}" value="cents" ${draft[`row:${c.line}`] === "cents" ? "checked" : ""}> It's in cents: ${formatR2(Math.round(c.priceCents / 100))}</label>
      ${err(`row:${c.line}`)}</div>`).join("")}
    ${errors.general ? `<div class="alert">${icon("i-alert")}<div>${esc(errors.general)}</div></div>` : ""}
    <div class="actions"><button type="button" class="btn primary" id="impFinish">Finish import</button><button type="button" class="btn" id="impCancel">Cancel</button></div>
  </form>`;
}

const needsNames = () => pending.results.some((r) => r.newServices.length || r.newBarbers.length || r.summary.checkPrices.length);

export function importCard(ctx) {
  const step = pending ? (pending.stage === "replace" ? replaceStep(ctx.data) : namesStep()) : summaryHtml(ctx.data);
  return `<section class="card" id="importCard"><h2>Import a sales sheet <small>CSV from your card machine, booking app or Excel</small></h2>
   <div class="grid c2e" style="gap:18px;align-items:start">
    <div><label class="drop">${icon("i-up")}<b>Choose a CSV file</b><span class="sub">In Excel: File → Save As → CSV. The file stays on this device.</span><input type="file" id="csvFile" accept=".csv,text/csv,text/plain"></label>
     <button class="btn soft mt" id="exampleCsv" style="width:100%;justify-content:center">${icon("i-receipt")}Try with an example sheet (Sept + Oct 2026)</button></div>
    <div><b style="font-size:.86rem">Your sheet needs these columns</b><pre class="csv">date,time,barber,service,price
2026-10-03,09:00,Thabo,Fade,120
2026-10-03,09:30,Sizwe,Chiskop,80</pre>
     <span class="sub">Minutes are optional. Dates can be 2026-10-03 or 03/10/2026, semicolons work too, and other columns (like customer names) are ignored and never saved.
      Download the examples: <a href="examples/sales-2026-09.csv" download>September</a> · <a href="examples/sales-2026-10.csv" download>October</a>.</span></div>
   </div>
   ${step}
  </section>`;
}

// ---------- actions ----------

function begin(ctx, texts, options = {}) {
  const results = [];
  let preview = ctx.data;
  for (const text of texts) {
    const result = importSales(text, preview);
    if (result.error) { pending = null; last = result; redraw(ctx); return; }
    results.push(result);
    preview = applyImport(preview, result, options); // so a later file in the same import knows the earlier one's names
  }
  const keys = [...new Set(results.flatMap((r) => Object.keys(r.months)))].sort();
  const collisions = ctx.data.sample ? [] : keys.filter((k) => ctx.data.months[k]);
  last = null;
  pending = { results, options, collisions, stage: collisions.length ? "replace" : "names" };
  if (pending.stage === "names" && !needsNames()) finish(ctx, {});
  else redraw(ctx);
}

/** Collect every value in the step, so a redraw (e.g. to show an error) keeps what the owner typed. */
function readDraft(form) {
  const draft = {};
  for (const input of form.querySelectorAll("[data-field]")) draft[input.dataset.field] = input.value;
  for (const box of form.querySelectorAll("[data-ok]")) draft[box.dataset.ok] = box.checked;
  for (const radio of form.querySelectorAll("input[type=radio]:checked")) draft[`row:${radio.name.slice(6)}`] = radio.value;
  return draft;
}

function finish(ctx, edits) {
  const finished = [];
  for (const r of pending.results) {
    const f = finalizeImport(r, edits);
    if (f.error) { pending.errors = { general: f.error }; redraw(ctx); return; }
    finished.push(f);
  }
  const { options } = pending;
  let doc = ctx.data;
  for (const r of finished) doc = applyImport(doc, r, options);
  last = combine(finished);
  pending = null;
  ctx.update(() => doc);
  ctx.toast(`Imported ${plural(last.summary.sales, "sale")}`);
}

/** One summary for an import of several files (the example sheets are two). */
function combine(results) {
  const s = { sales: 0, refunds: 0, refundCents: 0, freeCuts: 0, skipped: [], checkPrices: [] };
  for (const r of results) {
    for (const k of ["sales", "refunds", "refundCents", "freeCuts"]) s[k] += r.summary[k];
    s.skipped.push(...r.summary.skipped);
    s.checkPrices.push(...r.summary.checkPrices);
  }
  return {
    summary: s,
    newServices: results.flatMap((r) => r.newServices),
    newBarbers: results.flatMap((r) => r.newBarbers),
    mismatches: results.flatMap((r) => r.mismatches).filter((m, i, all) => all.findIndex((x) => x.serviceId === m.serviceId) === i),
    keys: [...new Set(results.flatMap((r) => Object.keys(r.months)))].sort(),
  };
}

export function bindImport(el, ctx) {
  const file = el.querySelector("#csvFile");
  file?.addEventListener("change", async () => {
    const f = file.files[0];
    if (!f) return;
    if (!/\.(csv|txt)$/i.test(f.name) && !/csv|text\/plain/i.test(f.type)) {
      pending = null;
      last = { error: "Please choose a .csv file. In Excel, use File → Save As → CSV." };
      redraw(ctx);
      return;
    }
    begin(ctx, [await f.text()]);
  });
  el.querySelector("#exampleCsv")?.addEventListener("click", () => begin(ctx, [exampleSeptemberCsv(), exampleOctoberCsv()], { exampleCosts: EXAMPLE_COSTS }));

  el.querySelector("#impCancel")?.addEventListener("click", () => { pending = null; redraw(ctx); ctx.toast("Import cancelled. Nothing changed."); });
  el.querySelector("#impReplace")?.addEventListener("click", () => {
    pending.stage = "names";
    if (needsNames()) redraw(ctx);
    else finish(ctx, {});
  });
  el.querySelector("#impFinish")?.addEventListener("click", () => {
    pending.draft = readDraft(el.querySelector("#namesStep"));
    const items = {
      services: pending.results.flatMap((r) => r.newServices),
      barbers: pending.results.flatMap((r) => r.newBarbers),
      prices: pending.results.flatMap((r) => r.summary.checkPrices),
    };
    const { edits, errors } = checkStepAnswers(items, pending.draft);
    pending.errors = errors;
    if (Object.keys(errors).length) { redraw(ctx); el.ownerDocument.querySelector("#namesStep .alert")?.scrollIntoView({ block: "center" }); return; }
    finish(ctx, edits);
  });
  el.querySelectorAll("[data-minutes]").forEach((b) => b.addEventListener("click", () => {
    const [id, minutes] = b.dataset.minutes.split(":");
    last.mismatches = last.mismatches.filter((m) => m.serviceId !== id);
    ctx.update((d) => { const s = d.services.find((x) => x.id === id); if (s) s.minutes = Number(minutes); });
    ctx.toast(`List updated to ${minutes} min`);
  }));
}
