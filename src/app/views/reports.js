// Reports: prd.md > Reports. Monthly Summary (with the Import card), Service and Barber Reports, and a Custom Report.
// Export PDF uses the browser's own print-to-PDF with print.css; CSV downloads open in Excel.

import { formatR, formatR2, formatNum, pct } from "../../core/money.js";
import { change, costItems, monthLabel, MONTH_NAMES } from "../../core/month.js";
import { customReport, serviceRows, barberRows, toCsv, transactionsCsv, pctChange } from "../../core/reports.js";
import { dashboardTips } from "../../core/tips.js";
import { esc, icon, tile, downloadCsv, subtabs, colorAt, foldOther, changeBadge } from "../ui/dom.js";
import { donut } from "../ui/charts.js";
import { importCard, bindImport } from "./import.js";

export const title = () => ["Reports", "Import your sales, view detailed reports and track your shop's performance over time."];

const TABS = [["month", "Monthly Summary", "i-cal"], ["service", "Service Report", "i-scissors"], ["barber", "Barber Report", "i-barber"], ["custom", "Custom Report", "i-list"]];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_OPTIONS = [["all", "Every day"], [1, "Mondays"], [2, "Tuesdays"], [3, "Wednesdays"], [4, "Thursdays"], [5, "Fridays"], [6, "Saturdays"], [0, "Sundays"]];

let filters = { from: 1, to: 31, barber: "all", service: "all", day: "all" };

const changeCell = (x) => (x == null ? `<span class="mut">new</span>` : `<span class="${x >= 0 ? "up" : "dn"}">${x >= 0 ? "+" : ""}${x}%</span>`);
const option = (value, label, current) => `<option value="${esc(value)}" ${String(value) === String(current) ? "selected" : ""}>${esc(label)}</option>`;

function header() {
  return `<div class="report-head" style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-end">
    <div style="flex:1;min-width:0">%TABS%</div>
    <div class="report-actions" style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
     <button class="btn" data-goto="reports/custom">${icon("i-cal")}Select date</button>
     <button class="btn" id="goImport">${icon("i-up")}Import sales</button>
     <button class="btn primary" id="printReport">${icon("i-dl")}Export PDF</button></div></div>`;
}

function monthTab(ctx) {
  const { s, p } = ctx;
  const { dashboard } = dashboardTips(s, p);
  const tip = dashboard[0]?.action ?? "Import each month's sales on the 1st, then export the report for your records or your accountant.";
  const cards = [["Monthly Summary", "i-report", "blue", "month"], ["Service Report", "i-scissors", "orange", "service"], ["Barber Report", "i-barber", "blue", "barber"], ["Transactions", "i-receipt", "purple", "tx"]];
  return `<div class="grid c2r">
   <div class="mini">
    <div class="card kpi">${tile("i-receipt", "green")}<div><small>Total Sales</small><strong class="n">${formatR(s.salesCents)}</strong>${changeBadge(change(s.salesCents, p?.salesCents))}</div></div>
    <div class="card kpi">${tile("i-coins", "orange")}<div><small>Total Costs</small><strong class="n">${formatR(s.costTotal)}</strong>${changeBadge(change(s.costTotal, p?.costTotal), false)}</div></div>
    <div class="card kpi">${tile("i-wallet", "green")}<div><small>Money Kept</small><strong class="n">${s.kept == null ? "—" : formatR(s.kept)}</strong>${s.kept == null ? `<span class="sub">add your costs</span>` : changeBadge(change(s.kept, p?.kept))}</div></div>
    <div class="card kpi">${tile("i-scissors", "blue")}<div><small>Total Cuts</small><strong class="n">${s.cuts}</strong>${changeBadge(change(s.cuts, p?.cuts))}</div></div>
   </div>
   <section class="card"><h2>Sales vs Costs <span class="ckey"><span style="--c:var(--s2)"><i></i>Sales</span><span style="--c:var(--s1)"><i></i>Costs</span></span></h2><div class="chart" data-chart="bars"></div></section>
  </div>
  <div class="mt no-print">${importCard(ctx)}</div>
  <div class="grid c2w mt no-print">
   <section class="card"><h2>Download Reports</h2><div class="dl">
    ${cards.map(([name, ic, color, k]) => `<div class="dlcard">${tile(ic, color)}<span><b>${name}</b><span class="dlacts">
      <button class="linkbtn" ${k === "tx" ? `data-goto="sales/tx"` : `data-goto="reports/${k}"`}>Open</button> ·
      <button class="linkbtn" data-print="${k === "tx" ? "custom" : k}">PDF</button> ·
      <button class="linkbtn" data-csv="${k}">CSV</button></span></span></div>`).join("")}
   </div></section>
   <section class="card" style="background:var(--blue-wash);border-color:transparent"><h2 style="justify-content:flex-start;gap:8px">${icon("i-shield", 'style="width:17px;height:17px;color:var(--brand)"')}Tip</h2><p style="margin:0;color:var(--muted);font-size:.84rem">${esc(tip)}</p></section>
  </div>`;
}

function serviceTab({ s, p, data }) {
  const colorOf = Object.fromEntries(data.services.map((x, i) => [x.id, colorAt(i)]));
  const rows = serviceRows(s, p);
  const sold = rows.filter((x) => x.count);
  const best = [...sold].sort((a, b) => b.perMin - a.perMin)[0];
  const mostTime = [...rows].sort((a, b) => b.chairMins - a.chairMins)[0];
  const dot = (id) => `<span class="dot" style="--c:var(${colorOf[id]})"></span>`;
  const slices = (key) => foldOther(rows.map((x) => ({ name: x.name, cents: x[key], color: colorOf[x.id] })));
  const legend = (items, total) => items.filter((x) => x.cents > 0).map((x) => `<div style="--c:var(${x.color})"><i></i><span>${esc(x.name)}</span><span></span><b class="n">${pct(x.cents, total).toFixed(1)}%</b></div>`).join("");
  const sales = slices("salesCents"), chair = slices("chairMins");
  return `<div class="grid k3">
    <div class="card kpi">${tile("i-scissors", "blue")}<div><small>Services sold</small><strong class="n">${s.cuts}</strong>${changeBadge(change(s.cuts, p?.cuts))}</div></div>
    <div class="card kpi">${tile("i-tag", "green")}<div><small>Best earner per minute</small><b style="display:block;font-size:1rem">${esc(best?.name ?? "—")}</b><strong class="n">${best ? formatR2(best.perMin) : "—"}</strong></div></div>
    <div class="card kpi">${tile("i-clock", "purple")}<div><small>Uses the most chair time</small><b style="display:block;font-size:1rem">${esc(mostTime?.name ?? "—")}</b><strong class="n">${formatNum(mostTime?.chairMins ?? 0)} min</strong><span class="sub">${pct(mostTime?.chairMins ?? 0, s.mins).toFixed(0)}% of all chair time</span></div></div></div>
   <section class="card mt"><h2>Service Report <small>${monthLabel(s.key)} compared with ${p ? monthLabel(p.key) : "no earlier month"}</small></h2><div class="tw"><table><thead><tr><th>Service</th><th>Sold</th><th>Change</th><th>Sales</th><th>Change</th><th>% of sales</th><th>Chair time</th><th>Per minute</th></tr></thead><tbody>
    ${rows.map((x) => `<tr><td>${dot(x.id)}${esc(x.name)}</td><td class="n">${x.count}</td><td class="n">${p ? changeCell(x.countChange) : "—"}</td><td class="n">${formatR(x.salesCents)}</td><td class="n">${p ? changeCell(x.salesChange) : "—"}</td><td class="n">${pct(x.salesCents, s.salesCents).toFixed(1)}%</td><td class="n">${formatNum(x.chairMins)} min</td><td class="n"><b>${formatR2(x.perMin)}</b></td></tr>`).join("")}
    <tr class="tot"><td><b>Total</b></td><td class="n"><b>${s.cuts}</b></td><td class="n">${p ? changeCell(pctChange(s.cuts, p.cuts)) : "—"}</td><td class="n"><b>${formatR(s.salesCents)}</b></td><td class="n">${p ? changeCell(pctChange(s.salesCents, p.salesCents)) : "—"}</td><td class="n">100%</td><td class="n">${formatNum(s.mins)} min</td><td class="n">${formatR2(s.mins ? s.salesCents / s.mins : 0)}</td></tr>
   </tbody></table></div></section>
   <div class="grid c2e mt">
    <section class="card"><h2>Share of sales</h2><div class="donut">${donut(sales, s.salesCents, "Total Sales")}<div class="legend">${legend(sales, s.salesCents)}</div></div></section>
    <section class="card"><h2>Share of chair time</h2><div class="donut">${donut(chair, s.mins, "Chair minutes", (v) => `${formatNum(v)} min`)}<div class="legend">${legend(chair, s.mins)}</div></div>
     <div class="protip">${tile("i-sparkle", "purple")}<div><b>Read it together</b>A service that takes a bigger share of chair time than of sales earns less per minute than your average.</div></div></section>
   </div>`;
}

function barberTab({ s, p, data }) {
  const colorOf = Object.fromEntries(data.barbers.map((b, i) => [b.id, colorAt(i)]));
  const svcName = Object.fromEntries(data.services.map((x) => [x.id, x.name]));
  const showCommission = data.prefs.showCommission !== false;
  const rows = barberRows(s, p);
  const active = rows.filter((b) => b.cuts);
  const who = (b) => `<td><span class="who"><span class="face" style="--c:var(${colorOf[b.id]})">${esc(b.name[0] ?? "?")}</span>${esc(b.name)}</span></td>`;
  return `<div class="grid k3">
    <div class="card kpi">${tile("i-barber", "blue")}<div><small>Barbers</small><strong>${rows.length}</strong><span class="sub">${active.length} with sales this month</span></div></div>
    <div class="card kpi">${tile("i-receipt", "green")}<div><small>Average sales per barber</small><strong class="n">${formatR(s.salesCents / Math.max(1, active.length))}</strong>${changeBadge(change(s.salesCents, p?.salesCents))}</div></div>
    <div class="card kpi">${tile("i-pct", "purple")}<div><small>Commission paid</small><strong class="n">${showCommission ? formatR(s.commission) : "hidden"}</strong><span class="sub">${showCommission ? `${pct(s.commission, s.salesCents).toFixed(0)}% of sales` : "turned off in Settings"}</span></div></div></div>
   <section class="card mt"><h2>Barber Report <small>${monthLabel(s.key)} compared with ${p ? monthLabel(p.key) : "no earlier month"}</small></h2><div class="tw"><table class="tl2"><thead><tr><th>Barber</th><th>Cuts</th><th>Sales</th><th>Change</th>${showCommission ? "<th>Commission</th>" : ""}<th>Avg. per Cut</th><th>Per chair-hour</th><th>Busiest day</th><th>Does most</th></tr></thead><tbody>
    ${rows.map((b) => `<tr>${who(b)}<td class="n">${b.cuts}</td><td class="n">${formatR(b.salesCents)}</td><td class="n">${p ? changeCell(b.salesChange) : "—"}</td>${showCommission ? `<td class="n">${formatR(b.commissionCents)} <span class="mut">(${b.ratePct}%)</span></td>` : ""}<td class="n">${b.cuts ? formatR(b.salesCents / b.cuts) : "—"}</td><td class="n">${b.cuts ? formatR(b.perHour) : "—"}</td><td>${b.busiestDay == null ? "—" : DAY_NAMES[b.busiestDay].slice(0, 3)}</td><td>${esc(svcName[b.topService] ?? "—")}</td></tr>`).join("")}
   </tbody></table></div></section>
   <section class="card mt"><h2>Sales by barber</h2><div class="hbars">${rows.map((b) => `<div class="hb" tabindex="0"><span class="who"><span class="face" style="--c:var(${colorOf[b.id]})">${esc(b.name[0] ?? "?")}</span>${esc(b.name)}</span><span class="track"><i style="width:${pct(b.salesCents, rows[0].salesCents || 1)}%;background:var(${colorOf[b.id]})"></i></span><b class="n">${formatR(b.salesCents)}</b></div>`).join("")}</div></section>`;
}

function customTab(ctx) {
  const { s, data } = ctx;
  const r = customReport(ctx.key, data.months[ctx.key].sales, filters);
  const mon = MONTH_NAMES[s.month - 1].slice(0, 3);
  const svcName = Object.fromEntries(data.services.map((x) => [x.id, x.name]));
  const barberName = Object.fromEntries(data.barbers.map((b) => [b.id, b.name]));
  const days = Array.from({ length: s.days }, (_, i) => i + 1);
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const latest = [...r.rows].sort((a, b) => b[0] - a[0] || b[1] - a[1]).slice(0, 40);
  const weekdayOf = (d) => new Date(Date.UTC(s.year, s.month - 1, d)).getUTCDay();
  const series = esc(JSON.stringify({ daily: r.daily, dailyCost: r.daily.map(() => 0), salesOnly: true }));
  return `<section class="card no-print-controls"><h2>Custom Report <small>pick the dates and filters you want</small></h2>
    <form id="customForm" class="customf" onsubmit="return false">
     <label>From<select name="from">${days.map((d) => option(d, `${d} ${mon}`, r.from)).join("")}</select></label>
     <label>To<select name="to">${days.map((d) => option(d, `${d} ${mon}`, r.to)).join("")}</select></label>
     <label>Barber<select name="barber">${[["all", "All barbers"], ...data.barbers.map((b) => [b.id, b.name])].map(([v, l]) => option(v, l, filters.barber)).join("")}</select></label>
     <label>Service<select name="service">${[["all", "All services"], ...data.services.map((x) => [x.id, x.name])].map(([v, l]) => option(v, l, filters.service)).join("")}</select></label>
     <label>Day of the week<select name="day">${DAY_OPTIONS.map(([v, l]) => option(v, l, filters.day)).join("")}</select></label>
     <button class="btn" id="customReset" type="button">Reset</button>
    </form></section>
   <div class="grid k3 mt">
    <div class="card kpi">${tile("i-receipt", "green")}<div><small>Sales</small><strong class="n">${formatR(r.salesCents)}</strong><span class="sub">${pct(r.salesCents, s.salesCents).toFixed(0)}% of the month</span></div></div>
    <div class="card kpi">${tile("i-scissors", "blue")}<div><small>Cuts</small><strong class="n">${r.cuts}</strong><span class="sub">${r.cuts ? `${formatR(r.salesCents / r.cuts)} per cut` : "none in this selection"}</span></div></div>
    <div class="card kpi">${tile("i-clock", "purple")}<div><small>Chair time</small><strong class="n">${formatNum(r.mins)} min</strong><span class="sub">${r.mins ? `${formatR2(r.salesCents / r.mins)} per minute` : "—"}</span></div></div></div>
   <section class="card mt"><h2>Sales per day <small>${r.from} – ${r.to} ${mon} ${s.year}</small></h2><div class="chart" data-chart="bars" data-series="${series}"></div></section>
   <section class="card mt"><h2>Matching sales <small>${r.rows.length} found${r.rows.length > 40 ? ", showing the latest 40" : ""}</small></h2>${latest.length ? `<div class="tw"><table class="tl"><thead><tr><th>Date</th><th>Time</th><th>Barber</th><th>Service</th><th>Amount</th></tr></thead><tbody>${latest.map((x) => `<tr><td>${DAY_NAMES[weekdayOf(x[0])].slice(0, 3)} ${x[0]} ${mon}</td><td class="n">${hhmm(x[1])}</td><td>${esc(barberName[x[2]] ?? "")}</td><td>${esc(svcName[x[3]] ?? "")}</td><td class="n">${formatR(x[4])}</td></tr>`).join("")}</tbody></table></div>` : `<p class="sub" style="margin:0">No sales match these filters. Try a wider date range.</p>`}</section>`;
}

export function render(ctx) {
  const tab = TABS.some(([k]) => k === ctx.sub) ? ctx.sub : "month";
  const body = { month: monthTab, service: serviceTab, barber: barberTab, custom: customTab }[tab](ctx);
  const printHead = `<div class="print-head"><b>${esc(ctx.data.shop.name)}</b> · ${esc(TABS.find(([k]) => k === tab)[1])} · ${esc(ctx.label)}</div>`;
  return printHead + header().replace("%TABS%", subtabs("reports", TABS, tab, "margin-bottom:18px")) + body;
}

// ---------- downloads ----------


const rand = (cents) => (cents / 100).toFixed(2);

function csvFor(kind, ctx) {
  const { s, p, data, key } = ctx;
  if (kind === "tx") return transactionsCsv(key, data.months[key].sales, data.services, data.barbers);
  if (kind === "service") {
    return toCsv(["service", "sold", "sales (R)", "% of sales", "chair minutes", "R per minute", "list price (R)"],
      serviceRows(s, p).map((x) => [x.name, x.count, rand(x.salesCents), pct(x.salesCents, s.salesCents).toFixed(1), x.chairMins, (x.perMin / 100).toFixed(2), rand(x.priceCents)]));
  }
  if (kind === "barber") {
    const svcName = Object.fromEntries(data.services.map((x) => [x.id, x.name]));
    const withCommission = data.prefs.showCommission !== false;
    return toCsv(["barber", "cuts", "sales (R)", ...(withCommission ? ["commission rate (%)", "commission (R)"] : []), "per chair-hour (R)", "busiest day", "does most"],
      barberRows(s, p).map((b) => [b.name, b.cuts, rand(b.salesCents), ...(withCommission ? [b.ratePct, rand(b.commissionCents)] : []), rand(b.perHour), b.busiestDay == null ? "" : DAY_NAMES[b.busiestDay], svcName[b.topService] ?? ""]));
  }
  return toCsv(["item", "amount (R)"], [
    ["Sales", rand(s.salesCents)], ...costItems(s).map((c) => [c.name, rand(c.cents)]), ["Total costs", rand(s.costTotal)],
    ["Money kept", s.kept == null ? "add your costs" : rand(s.kept)], ["Cuts", s.cuts], ["Chair minutes", s.mins],
  ]);
}

export function bind(el, ctx) {
  bindImport(el, ctx);
  el.querySelector("#goImport")?.addEventListener("click", () => {
    if (ctx.sub && ctx.sub !== "month") ctx.go("reports", "month");
    setTimeout(() => document.getElementById("importCard")?.scrollIntoView({ behavior: "smooth" }), 50);
  });
  el.querySelector("#printReport")?.addEventListener("click", () => window.print());
  el.querySelectorAll("[data-print]").forEach((b) => b.addEventListener("click", () => {
    ctx.go("reports", b.dataset.print);
    setTimeout(() => window.print(), 300); // let the report draw (charts included) before the print dialog opens
  }));
  el.querySelectorAll("[data-csv]").forEach((b) => b.addEventListener("click", () => {
    const kind = b.dataset.csv;
    const names = { month: "monthly-summary", service: "service-report", barber: "barber-report", tx: "transactions" };
    downloadCsv(`profitpilot-${names[kind]}-${ctx.key}.csv`, csvFor(kind, ctx));
    ctx.toast("Downloaded. It opens in Excel.");
  }));
  const form = el.querySelector("#customForm");
  form?.addEventListener("change", () => {
    const from = Number(form.from.value), to = Number(form.to.value);
    filters = { from: Math.min(from, to), to: Math.max(from, to), barber: form.barber.value, service: form.service.value, day: form.day.value === "all" ? "all" : Number(form.day.value) };
    ctx.update(() => {}, { uiOnly: true });
  });
  el.querySelector("#customReset")?.addEventListener("click", () => { filters = { from: 1, to: 31, barber: "all", service: "all", day: "all" }; ctx.update(() => {}, { uiOnly: true }); });
}

