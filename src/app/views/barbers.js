// Barbers: prd.md > Barbers. Set each barber's commission and see what the shop keeps.

import { formatR, pct } from "../../core/money.js";
import { change } from "../../core/month.js";
import { barberTips } from "../../core/tips.js";
import { makeId } from "../../core/importer.js";
import { esc, tile, subtabs, colorAt, changeBadge } from "../ui/dom.js";
import { tipRow } from "./dashboard.js";

export const title = () => ["Barbers", "See how each barber is performing, and set their commission."];

const TABS = [["overview", "Overview", "i-pie"], ["performance", "Performance", "i-trend"], ["commission", "Commission", "i-pct"]];

/** "on 11% commission", or "on 10–12% commission" when rates differ. */
export function rateLabel(barbers) {
  const rates = [...new Set(barbers.map((b) => b.ratePct))].sort((a, b) => a - b);
  if (!rates.length) return "no barbers yet";
  return rates.length === 1 ? `${rates[0]}%` : `${rates[0]}–${rates.at(-1)}%`;
}

/** The shop's usual rate: the most common one (10% when there are no barbers yet). */
function usualRate(barbers) {
  const counts = {};
  for (const b of barbers) counts[b.ratePct] = (counts[b.ratePct] || 0) + 1;
  return Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 10);
}

/** A "please check" badge that confirms the item when tapped (for names that came from an import). */
export const checkBadge = (kind, id) => `<button type="button" class="badge-check" data-confirm="${kind}:${esc(id)}" title="Tap when you've checked this">please check</button>`;

export function render({ data, s, p, sub }) {
  const tab = TABS.some(([k]) => k === sub) ? sub : "overview";
  const colorOf = Object.fromEntries(data.barbers.map((b, i) => [b.id, colorAt(i)]));
  const list = [...s.byBarber].sort((a, b) => b.salesCents - a.salesCents);
  const who = (b) => `<td><span class="who"><span class="face" style="--c:var(${colorOf[b.id]})">${esc(b.name[0] ?? "?")}</span>${esc(b.name)}${b.confirmed === false ? checkBadge("barber", b.id) : ""}</span></td>`;
  const perHour = (b) => (b.cuts ? formatR(b.perHour) : "—");

  const head = `<div class="grid k3">
   <div class="card kpi">${tile("i-barber", "blue")}<div><small>Total Barbers</small><strong>${list.length}</strong><span class="sub">on ${rateLabel(data.barbers)} commission</span></div></div>
   <div class="card kpi">${tile("i-receipt", "blue")}<div><small>Total Sales</small><strong class="n">${formatR(s.salesCents)}</strong>${changeBadge(change(s.salesCents, p?.salesCents))}</div></div>
   <div class="card kpi">${tile("i-pct", "purple")}<div><small>Total Commission</small><strong class="n">${formatR(s.commission)}</strong><span class="sub">${pct(s.commission, s.salesCents).toFixed(0)}% of sales</span></div></div></div>`;

  let table;
  if (tab === "commission") {
    table = `<table class="edit"><thead><tr><th>Barber</th><th>Sales</th><th>Rate</th><th>Commission</th><th>Shop keeps</th></tr></thead><tbody>${list.map((b) => `<tr>${who(b)}
      <td class="n">${formatR(b.salesCents)}</td>
      <td><span class="money-in pctin"><input data-rate="${esc(b.id)}" inputmode="decimal" value="${b.ratePct}" aria-label="${esc(b.name)} commission percent">%</span></td>
      <td class="n">${formatR(b.commissionCents)}</td><td class="n">${formatR(b.salesCents - b.commissionCents)}</td></tr>`).join("")}</tbody></table>
     <form id="addBarber" class="addrow"><b>Add a barber</b><input name="name" placeholder="Name" aria-label="Barber name"><span class="money-in pctin"><input name="rate" inputmode="decimal" placeholder="${usualRate(data.barbers)}" aria-label="Commission percent">%</span><button class="btn primary">Add barber</button></form>`;
  } else if (tab === "performance") {
    table = `<table><thead><tr><th>Barber</th><th>Cuts</th><th>Chair hours</th><th>Avg. per Cut</th><th>Avg. per Hour</th></tr></thead><tbody>${list.map((b) => `<tr>${who(b)}
      <td class="n">${b.cuts}</td><td class="n">${Math.round(b.mins / 60)} h</td><td class="n">${b.cuts ? formatR(b.salesCents / b.cuts) : "—"}</td><td class="n">${perHour(b)}</td></tr>`).join("")}</tbody></table>`;
  } else {
    table = `<table><thead><tr><th>Barber</th><th>Sales</th><th>Commission</th><th>% of Total</th><th>Avg. per Hour</th></tr></thead><tbody>${list.map((b) => `<tr>${who(b)}
      <td class="n">${formatR(b.salesCents)}</td><td class="n">${formatR(b.commissionCents)}</td><td class="n">${pct(b.salesCents, s.salesCents).toFixed(0)}%</td><td class="n">${perHour(b)}</td></tr>`).join("")}</tbody></table>`;
  }

  const tips = barberTips(s);
  return subtabs("barbers", TABS, tab) + head + `<div class="grid c2 mt">
   <section class="card"><h2>Barber Performance ${tab !== "commission" ? `<button class="linkbtn" data-goto="barbers/commission">Set commission →</button>` : ""}</h2><div class="tw">${table}</div></section>
   <section class="card"><h2>Performance Insights</h2><div class="ins">${tips.length ? tips.map(tipRow).join("") : `<span class="sub">No sales yet this month.</span>`}</div></section></div>`;
}

const readRate = (text) => Number(String(text).trim().replace(",", "."));

export function bind(el, ctx) {
  el.querySelectorAll("[data-rate]").forEach((input) => input.addEventListener("change", () => {
    const ratePct = readRate(input.value);
    const barber = ctx.data.barbers.find((b) => b.id === input.dataset.rate);
    if (!(input.value.trim() && ratePct >= 0 && ratePct <= 100)) { input.setAttribute("aria-invalid", "true"); ctx.toast(`${barber.name}'s commission must be between 0% and 100%`); return; }
    ctx.update((d) => { const b = d.barbers.find((x) => x.id === barber.id); b.ratePct = ratePct; b.confirmed = true; });
    ctx.toast(`${barber.name}'s commission is now ${ratePct}%`);
  }));

  el.querySelector("#addBarber")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    const name = form.name.value.trim().replace(/\s+/g, " ");
    const ratePct = readRate(form.rate.value || form.rate.placeholder);
    if (!name || !(ratePct >= 0 && ratePct <= 100)) { ctx.toast("Fill in a name and a commission between 0% and 100%"); return; }
    const existing = ctx.data.barbers.find((b) => b.name.toLowerCase() === name.toLowerCase());
    if (existing) { ctx.toast(`${existing.name} is already on the team`); return; }
    const id = makeId(name, new Set(ctx.data.barbers.map((b) => b.id)));
    ctx.update((d) => { d.barbers.push({ id, name, ratePct, confirmed: true }); });
    ctx.toast(`${name} added to the team`);
  });
}
