// Costs: prd.md > Costs. Edit the month's costs and see money kept move by exactly that amount.
// Commission is never typed in: it's worked out from each barber's rate (core/month.js).

import { formatR, pct, parsePrice } from "../../core/money.js";
import { costItems, monthLabel, MONTH_NAMES } from "../../core/month.js";
import { costJumps } from "../../core/tips.js";
import { esc, icon, tile, subtabs, colorAt } from "../ui/dom.js";
import { donut } from "../ui/charts.js";

export const title = () => ["Costs", "Track and update your monthly costs, and spot any unusual increases."];

const TABS = [["overview", "Overview", "i-pie"], ["edit", "Edit Costs", "i-pen"], ["breakdown", "Cost Breakdown", "i-list"], ["trends", "Trends", "i-trend"]];
const shortMonth = (s) => MONTH_NAMES[s.month - 1].slice(0, 3);

/** "Unusual increase" alerts: the same cost-jump rule as the Dashboard strip (prd.md > Tips). */
function alertsHtml(jumps) {
  return jumps.map((j) => `<div class="alert">${icon("i-alert")}<div><b>Unusual increase: ${esc(j.title)}</b>${esc(j.text)} Check for leaks, old equipment or a billing mistake.</div></div>`).join("");
}

function sourceNote(ctx) {
  const src = ctx.data.months[ctx.key]?.costsSource;
  if (src === "example") return `<span class="badge-check" style="margin:0">example costs</span>`;
  if (src?.startsWith("copied:")) return `<small>copied from ${monthLabel(src.slice(7))}, so check they're still right</small>`;
  return "";
}

export function render(ctx) {
  const { s, p, sub } = ctx;
  const tab = TABS.some(([k]) => k === sub) ? sub : "overview";
  const items = costItems(s).map((it, i) => ({ ...it, color: colorAt(i) }));
  const jumps = ctx.data.prefs.notify?.costJump === false ? [] : costJumps(s, p); // the warning can be turned off in Settings
  const flagged = new Set(jumps.map((j) => j.cost));
  const increases = Object.entries(s.costs)
    .filter(([name]) => p?.costs[name] > 0)
    .map(([name, v]) => ({ name, pc: ((v - p.costs[name]) / p.costs[name]) * 100 }))
    .sort((a, b) => b.pc - a.pc);
  const biggest = increases[0]?.pc > 0 ? increases[0] : null;
  const highest = items[0];

  const head = `<div class="grid k3">
   <div class="card kpi">${tile("i-coins", "orange")}<div><small>Total Costs</small><strong class="n">${formatR(s.costTotal)}</strong><span class="sub">${s.hasCosts ? `${pct(s.costTotal, s.salesCents).toFixed(1)}% of sales` : "commission only, until you add costs"}</span></div></div>
   <div class="card kpi">${tile("i-shop", "red")}<div><small>Highest Cost</small><b style="display:block;font-size:1rem">${esc(highest?.name ?? "—")}</b><strong class="n">${formatR(highest?.cents ?? 0)}</strong><span class="sub">${pct(highest?.cents ?? 0, s.costTotal).toFixed(0)}% of total</span></div></div>
   <div class="card kpi">${tile("i-alert", "red")}<div><small>Biggest Increase</small><b style="display:block;font-size:1rem">${biggest ? esc(biggest.name) : "None"}</b><strong class="${biggest ? "dn" : "mut"}">${biggest ? `+${biggest.pc.toFixed(0)}%` : "—"}</strong><span class="sub">${p ? "vs last month" : "no earlier month"}</span></div></div></div>`;

  const legend = items.filter((it) => it.cents > 0).map((it) => `<div style="--c:var(${it.color})"><i></i><span>${esc(it.name)}</span><span class="w">${flagged.has(it.name) ? icon("i-alert") : ""}</span><b class="n">${pct(it.cents, s.costTotal).toFixed(0)}% · ${formatR(it.cents)}</b></div>`).join("");
  const breakdownCard = `<section class="card"><h2>Costs Breakdown</h2><div class="donut">${donut(items, s.costTotal, "Total Costs")}<div class="legend">${legend}</div></div></section>`;
  const trendCard = `<section class="card"><h2>Cost Trend <span class="ckey"><span style="--c:var(--s1)"><i></i>Total Costs</span><span style="--c:var(--green)"><i></i>Sales</span></span></h2><div class="chart" data-chart="trend"></div>${alertsHtml(jumps)}</section>`;

  let body;
  if (tab === "edit") {
    const rows = Object.entries(ctx.data.months[ctx.key].costs).map(([name, cents]) => `<div class="cerow">
      <label for="cost-${esc(name)}">${esc(name)}${flagged.has(name) ? ` <span class="badge-check" style="color:var(--red);background:var(--red-wash)">up a lot</span>` : ""}</label>
      <span class="money-in">R<input id="cost-${esc(name)}" data-cost="${esc(name)}" inputmode="decimal" value="${cents / 100}"></span>
      <span class="mut n" style="font-size:.78rem">${p ? `last month ${formatR(p.costs[name] ?? 0)}` : ""}</span>
      <button class="iconx" data-delcost="${esc(name)}" aria-label="Remove ${esc(name)}">${icon("i-trash")}</button></div>`).join("");
    body = `<section class="card mt"><h2>${esc(ctx.label)} costs ${sourceNote(ctx) || "<small>type an amount and press Enter or Tab</small>"}</h2>
      <div class="costedit">${rows || `<p class="empty-note" style="padding:8px 0">No costs yet for ${esc(ctx.label)}. Add your rent, products, electricity and anything else you pay each month.</p>`}
       <div class="cerow"><span>Commission</span><b class="n">${formatR(s.commission)}</b><span class="mut" style="font-size:.78rem">worked out from each barber's rate · <button class="linkbtn" data-goto="barbers/commission">Change rates →</button></span><span></span></div></div>
      <form id="addCost" class="addrow"><b>Add a cost</b><input name="name" placeholder="e.g. Security" aria-label="Cost name"><span class="money-in">R<input name="amount" inputmode="decimal" placeholder="450" aria-label="Amount"></span><button class="btn primary">Add cost</button></form>
      ${alertsHtml(jumps)}</section>`;
  } else if (tab === "breakdown") {
    const names = [...new Set(["Commission", ...Object.keys(s.costs), ...Object.keys(p?.costs ?? {})])];
    const rows = names.map((name) => {
      const now = name === "Commission" ? s.commission : s.costs[name] ?? 0;
      const before = name === "Commission" ? p?.commission ?? 0 : p?.costs[name] ?? 0;
      const d = now - before;
      const color = items.find((it) => it.name === name)?.color ?? "--muted";
      return `<tr><td><span class="dot" style="--c:var(${color})"></span>${esc(name)}</td><td class="n">${p ? formatR(before) : "—"}</td><td class="n">${formatR(now)}</td><td class="n ${!p ? "mut" : d > 0 ? "dn" : d < 0 ? "up" : "mut"}">${!p ? "—" : (d > 0 ? "+" : "") + formatR(d)}</td></tr>`;
    }).join("");
    body = `<section class="card mt"><h2>Compared with last month</h2><div class="tw"><table><thead><tr><th>Cost</th><th>${p ? shortMonth(p) : "—"}</th><th>${shortMonth(s)}</th><th>Change</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  } else if (tab === "trends") {
    body = `<div class="mt">${trendCard}</div>`;
  } else {
    body = `<div class="grid c2e mt">${breakdownCard}${trendCard}</div>`;
  }
  return subtabs("costs", TABS, tab) + head + body;
}

/** Amounts for costs: R0 or more, read with the same rules as the CSV import ("R2 760", "2760,00"). */
const readAmount = (text) => parsePrice(text);

export function bind(el, ctx) {
  const setCost = (name, cents) => ctx.update((d) => { d.months[ctx.key].costs[name] = cents; });

  el.querySelectorAll("[data-cost]").forEach((input) => input.addEventListener("change", () => {
    const name = input.dataset.cost;
    const cents = readAmount(input.value);
    if (!(cents >= 0)) { input.setAttribute("aria-invalid", "true"); ctx.toast(`Enter an amount of R0 or more for ${name}`); return; }
    setCost(name, cents);
    ctx.toast(`${name} updated`);
  }));

  el.querySelectorAll("[data-delcost]").forEach((b) => b.addEventListener("click", () => {
    const name = b.dataset.delcost;
    ctx.update((d) => { delete d.months[ctx.key].costs[name]; });
    ctx.toast(`${name} removed`);
  }));

  el.querySelector("#addCost")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    const name = form.name.value.trim().replace(/\s+/g, " ");
    const cents = readAmount(form.amount.value);
    if (!name || !(cents >= 0)) { ctx.toast("Give the cost a name and an amount of R0 or more"); return; }
    if (name.toLowerCase() === "commission") { ctx.toast("Commission is worked out from each barber's rate"); return; }
    const existing = Object.keys(ctx.data.months[ctx.key].costs).find((n) => n.toLowerCase() === name.toLowerCase());
    if (existing) { ctx.toast(`${existing} is already on the list. Change its amount above.`); return; }
    setCost(name, cents);
    ctx.toast(`${name} added`);
  });
}
