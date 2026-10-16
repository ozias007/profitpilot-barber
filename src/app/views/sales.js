// Sales & Services: prd.md > Sales & Services and prd.md > Price Planner.
// Editing a list price never re-prices past sales: imported sales are what was actually charged.

import { formatR, formatR2, pct, parsePrice } from "../../core/money.js";
import { change, MONTH_NAMES, weekday } from "../../core/month.js";
import { planPrice, priceRange } from "../../core/planner.js";
import { lowestEarner } from "../../core/tips.js";
import { makeId } from "../../core/importer.js";
import { esc, tile, subtabs, colorAt, foldOther, changeBadge } from "../ui/dom.js";
import { donut } from "../ui/charts.js";
import { checkBadge } from "./barbers.js";

export const title = () => ["Sales & Services", "See which services bring in the most money, how long they take, and plan your prices."];

const TABS = [["overview", "Overview", "i-pie"], ["services", "Services", "i-scissors"], ["planner", "Price Planner", "i-tag"], ["tx", "Transactions", "i-receipt"]];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const plural = (name) => (/s$/i.test(name) ? name : name + "s");

let plan = null; // { svc, priceCents, lostPct, satOnly }: the planner's sliders; starts on the lowest earner per minute

/** Pro Tip, worked out from the numbers (the reference had a fixed sentence). */
function proTip(services) {
  const sold = services.filter((x) => x.count);
  if (sold.length < 2) return "";
  const bestPerMin = [...sold].sort((a, b) => b.perMin - a.perMin)[0];
  const mostSold = [...sold].sort((a, b) => b.count - a.count)[0];
  const text = bestPerMin.id === mostSold.id
    ? `${plural(bestPerMin.name)} are both your most-sold service and your best earner per minute (${formatR2(bestPerMin.perMin)}). Protect that chair time.`
    : `${plural(bestPerMin.name)} earn the most per chair-minute (${formatR2(bestPerMin.perMin)}), while ${plural(mostSold.name)} are your most-sold service (${formatR2(mostSold.perMin)} a minute). Keep a good mix of both.`;
  return `<div class="protip">${tile("i-sparkle", "purple")}<div><b>Pro Tip</b>${esc(text)}</div></div>`;
}

function planOut(svc, label) {
  const r = planPrice(svc, plan);
  const day = plan.satOnly ? "Saturday " : "";
  return `<div class="grid k3 planout" style="gap:12px">
   <div class="card kpi" style="padding:14px">${tile("i-receipt", "blue")}<div><small>${esc(day + plural(svc.name).toLowerCase())} a month</small><strong class="n">${r.n} → ${r.kept}</strong><span class="sub">${r.n - r.kept ? `${r.n - r.kept} fewer customers` : "same number of customers"}</span></div></div>
   <div class="card kpi" style="padding:14px">${tile("i-wallet", r.diffCents >= 0 ? "green" : "red")}<div><small>Extra money a month</small><strong class="n ${r.diffCents >= 0 ? "up" : "dn"}">${r.diffCents >= 0 ? "+" : ""}${formatR(r.diffCents)}</strong><span class="sub">${formatR(r.nowCents)} → ${formatR(r.afterCents)}</span></div></div>
   <div class="card kpi" style="padding:14px">${tile("i-clock", "purple")}<div><small>Earnings per chair-minute</small><strong class="n">${formatR2(r.perMinNow)} → ${formatR2(r.perMinNew)}</strong><span class="sub">${r.freedMinutes ? `${r.freedMinutes} chair-minutes freed for other cuts` : `at ${svc.minutes} minutes a cut`}</span></div></div></div>
  <p class="sub" style="margin:12px 0 0">Based on ${esc(label)}. Assumes customers pay the new price. A rough guide: real customers may react differently, so try a change for a month and compare.</p>`;
}

export function render(ctx) {
  const { data, s, p, sub, label } = ctx;
  const tab = TABS.some(([k]) => k === sub) ? sub : "overview";
  const colorOf = Object.fromEntries(data.services.map((x, i) => [x.id, colorAt(i)]));
  const sorted = [...s.bySvc].sort((a, b) => b.salesCents - a.salesCents);
  const avg = s.cuts ? s.salesCents / s.cuts : 0;
  const head = `<div class="grid k3">
   <div class="card kpi">${tile("i-scissors", "blue")}<div><small>Total Sales</small><strong class="n">${formatR(s.salesCents)}</strong>${changeBadge(change(s.salesCents, p?.salesCents))}</div></div>
   <div class="card kpi">${tile("i-tag", "purple")}<div><small>Avg. Sale</small><strong class="n">${formatR(avg)}</strong>${changeBadge(change(avg, p?.cuts ? p.salesCents / p.cuts : null))}</div></div>
   <div class="card kpi">${tile("i-receipt", "blue")}<div><small>Total Transactions</small><strong class="n">${s.cuts}</strong>${changeBadge(change(s.cuts, p?.cuts))}</div></div></div>`;
  const tabs = subtabs("sales", TABS, tab);
  const dot = (id) => `<span class="dot" style="--c:var(${colorOf[id]})"></span>`;

  if (tab === "tx") {
    const { year, month } = s;
    const svcName = Object.fromEntries(data.services.map((x) => [x.id, x.name]));
    const barberName = Object.fromEntries(data.barbers.map((b) => [b.id, b.name]));
    const rows = [...data.months[ctx.key].sales].sort((a, b) => b[0] - a[0] || b[1] - a[1]).slice(0, 30);
    const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    return tabs + head + `<section class="card mt"><h2>Transactions <small>latest 30 of ${data.months[ctx.key].sales.length}</small></h2><div class="tw"><table class="tl"><thead><tr><th>Date</th><th>Time</th><th>Barber</th><th>Service</th><th>Amount</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${DAY_SHORT[weekday(year, month, r[0])]} ${r[0]} ${MONTH_NAMES[month - 1].slice(0, 3)}</td><td class="n">${hhmm(r[1])}</td><td>${esc(barberName[r[2]] ?? "")}</td><td>${dot(r[3])}${esc(svcName[r[3]] ?? "")}</td><td class="n ${r[4] < 0 ? "dn" : ""}">${formatR(r[4])}${r[4] < 0 ? " refund" : r[4] === 0 ? " free" : ""}</td></tr>`).join("")}
      </tbody></table></div></section>`;
  }

  if (tab === "services") {
    return tabs + `<section class="card"><h2>Your services <small>change a price or time and press Enter; new prices apply to new cuts, never to sales already made</small></h2><div class="tw"><table class="edit"><thead><tr><th>Service</th><th>List price</th><th>Minutes</th><th>Per minute</th><th>This month</th></tr></thead><tbody>
      ${sorted.map((x) => `<tr><td>${dot(x.id)}<input class="in-t" data-svc="${esc(x.id)}" data-f="name" value="${esc(x.name)}" aria-label="Service name">${x.confirmed === false ? checkBadge("svc", x.id) : ""}</td>
        <td><span class="money-in">R<input data-svc="${esc(x.id)}" data-f="price" inputmode="decimal" value="${x.priceCents / 100}" aria-label="${esc(x.name)} list price"></span></td>
        <td><input class="in-n" data-svc="${esc(x.id)}" data-f="minutes" inputmode="numeric" value="${x.minutes}" aria-label="${esc(x.name)} minutes"></td>
        <td class="n"><b>${formatR2(x.perMin)}</b><br><span class="mut" style="font-size:.78rem">list ${formatR2(x.listPerMin)}</span></td>
        <td class="n">${x.count} · ${formatR(x.salesCents)}</td></tr>`).join("")}
      </tbody></table></div>
      <form id="addSvc" class="addrow"><b>Add a service</b><input name="name" placeholder="e.g. Dreadlocks retwist" aria-label="New service name"><span class="money-in">R<input name="price" inputmode="decimal" placeholder="250" aria-label="Price"></span><input name="minutes" class="in-n" inputmode="numeric" placeholder="90 min" aria-label="Minutes"><button class="btn primary">Add service</button></form></section>`;
  }

  if (tab === "planner") {
    if (!plan || !s.bySvc.some((x) => x.id === plan.svc)) {
      const start = s.bySvc.find((x) => x.id === lowestEarner(s)?.service) ?? s.bySvc.find((x) => x.count) ?? s.bySvc[0];
      plan = { svc: start.id, priceCents: start.priceCents + 1000, lostPct: 0, satOnly: true };
    }
    const svc = s.bySvc.find((x) => x.id === plan.svc);
    const range = priceRange(svc.priceCents);
    plan.priceCents = Math.min(range.max, Math.max(range.min, plan.priceCents));
    return tabs + `<section class="card"><h2>Price Planner <small>try a new price before you change it</small></h2>
      <form id="planner" class="planner" onsubmit="return false">
       <label>Service<select name="svc">${s.bySvc.map((x) => `<option value="${esc(x.id)}" ${x.id === svc.id ? "selected" : ""}>${esc(x.name)} (now ${formatR(x.priceCents)})</option>`).join("")}</select></label>
       <label>New price <b id="planPrice">${formatR(plan.priceCents)}</b><input type="range" name="price" min="${range.min / 100}" max="${range.max / 100}" step="${range.step / 100}" value="${plan.priceCents / 100}"></label>
       <label>Customers you might lose <b id="planLost">${plan.lostPct}%</b><input type="range" name="lost" min="0" max="40" step="5" value="${plan.lostPct}"></label>
       <label class="chk"><input type="checkbox" name="sat" ${plan.satOnly ? "checked" : ""}> Saturdays only (your busiest day)</label>
      </form><div id="planOut" class="mt">${planOut(svc, label)}</div></section>`;
  }

  const slices = foldOther(sorted.map((x) => ({ name: x.name, cents: x.salesCents, color: colorOf[x.id] })));
  const legend = slices.filter((x) => x.cents > 0).map((x) => `<div style="--c:var(${x.color})"><i></i><span>${esc(x.name)}</span><span></span><b class="n">${pct(x.cents, s.salesCents).toFixed(1)}%</b></div>`).join("");
  return tabs + head + `<div class="grid c2 mt">
   <section class="card"><h2>Sales by Service <button class="linkbtn" data-goto="sales/services">Edit services →</button></h2><div class="tw"><table><thead><tr><th>Service</th><th>Sales</th><th>% of Total</th><th>Avg. Price</th></tr></thead><tbody>
    ${sorted.map((x) => `<tr><td>${dot(x.id)}${esc(x.name)}</td><td class="n">${formatR(x.salesCents)}</td><td class="n">${pct(x.salesCents, s.salesCents).toFixed(1)}%</td><td class="n">${formatR(x.avgCents)}</td></tr>`).join("")}
   </tbody></table></div></section>
   <section class="card"><h2>Service Share</h2><div class="donut">${donut(slices, s.salesCents, "Total Sales")}<div class="legend">${legend}</div></div>${proTip(s.bySvc)}</section>
  </div>`;
}

export function bind(el, ctx) {
  // Services: edits go to the list only (sales already made keep the price that was actually charged)
  el.querySelectorAll("[data-svc]").forEach((input) => input.addEventListener("change", () => {
    const { svc: id, f } = input.dataset;
    const current = ctx.data.services.find((x) => x.id === id);
    let value;
    if (f === "name") {
      value = input.value.trim().replace(/\s+/g, " ");
      if (!value) { ctx.toast("A service needs a name"); ctx.update(() => {}, { uiOnly: true }); return; }
      if (ctx.data.services.some((x) => x.id !== id && x.name.toLowerCase() === value.toLowerCase())) { ctx.toast(`There's already a service called ${value}`); ctx.update(() => {}, { uiOnly: true }); return; }
    } else if (f === "price") {
      value = parsePrice(input.value);
      if (!(value > 0)) { ctx.toast(`${current.name}'s list price must be above R0`); ctx.update(() => {}, { uiOnly: true }); return; }
    } else {
      value = Number(input.value.trim());
      if (!(Number.isInteger(value) && value > 0)) { ctx.toast(`${current.name}'s minutes must be a whole number above 0`); ctx.update(() => {}, { uiOnly: true }); return; }
    }
    const key = { name: "name", price: "priceCents", minutes: "minutes" }[f];
    ctx.update((d) => { const x = d.services.find((y) => y.id === id); x[key] = value; x.confirmed = true; });
    ctx.toast(`${f === "name" ? value : current.name} updated`);
  }));

  el.querySelector("#addSvc")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    const name = form.name.value.trim().replace(/\s+/g, " ");
    const priceCents = parsePrice(form.price.value);
    const minutes = Number(form.minutes.value.trim());
    if (!name || !(priceCents > 0) || !(Number.isInteger(minutes) && minutes > 0)) { ctx.toast("Fill in a name, a price and the minutes it takes"); return; }
    const existing = ctx.data.services.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (existing) { ctx.toast(`${existing.name} is already on the list`); return; }
    const id = makeId(name, new Set(ctx.data.services.map((x) => x.id)));
    ctx.update((d) => { d.services.push({ id, name, priceCents, minutes, confirmed: true }); });
    ctx.toast(`${name} added. It will show sales once you import them.`);
  });

  // Price Planner: live, without redrawing the page
  const form = el.querySelector("#planner");
  if (form) {
    form.svc.addEventListener("change", () => {
      const svc = ctx.s.bySvc.find((x) => x.id === form.svc.value);
      plan = { ...plan, svc: svc.id, priceCents: svc.priceCents + 1000 };
      ctx.update(() => {}, { uiOnly: true });
    });
    form.addEventListener("input", (e) => {
      if (e.target.name === "svc") return;
      plan = { ...plan, priceCents: Math.round(Number(form.price.value) * 100), lostPct: Number(form.lost.value), satOnly: form.sat.checked };
      el.querySelector("#planPrice").textContent = formatR(plan.priceCents);
      el.querySelector("#planLost").textContent = `${plan.lostPct}%`;
      el.querySelector("#planOut").innerHTML = planOut(ctx.s.bySvc.find((x) => x.id === plan.svc), ctx.label);
    });
  }
}
