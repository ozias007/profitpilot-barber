// Dashboard: prd.md > Dashboard. Tips (Quick Insights, What to do next) arrive with core/tips.js.

import { formatR, formatR2, formatNum, pct } from "../../core/money.js";
import { change, costItems } from "../../core/month.js";
import { esc, tile, icon, tipAttr, changeBadge, colorAt, serviceIcon } from "../ui/dom.js";
import { heatmap, moneyBar } from "../ui/charts.js";

export const title = (ctx) => [`${greeting()}, ${ctx.data.profile.greet || "Boss"}! 👋`, `Here's how your shop performed in ${ctx.label}.`];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function render({ s, p }) {
  const kept = s.kept == null
    ? `<span class="hint">Add your costs to see money kept</span><button class="linkbtn" data-goto="costs/edit">Add costs →</button>`
    : `<strong class="n">${formatR(s.kept)}</strong><span class="sub">out of ${formatR(s.salesCents)} taken in</span>
       <div class="prog"><span><i style="width:${Math.max(0, Math.min(100, pct(s.kept, s.salesCents)))}%"></i></span><b>${pct(s.kept, s.salesCents).toFixed(1)}%</b></div>`;

  const services = s.bySvc.filter((x) => x.count).sort((a, b) => b.perMin - a.perMin);
  const maxPerMin = Math.max(1, ...services.map((x) => x.perMin));
  const items = costItems(s).map((it, i) => ({ ...it, color: colorAt(i) }));

  return `
  <div class="grid k4">
   <div class="card kpi">${tile("i-wallet", "green")}<div style="flex:1;min-width:0"><small>Money Kept</small>${kept}</div></div>
   <div class="card kpi">${tile("i-scissors", "blue")}<div><small>Total Sales</small><strong class="n">${formatR(s.salesCents)}</strong>${changeBadge(change(s.salesCents, p?.salesCents))}</div></div>
   <div class="card kpi">${tile("i-clock", "purple")}<div><small>Total Chair Time</small><strong class="n">${formatNum(s.mins)} min</strong>${changeBadge(change(s.mins, p?.mins))}</div></div>
   <div class="card kpi">${tile("i-coins", "orange")}<div><small>Total Costs</small><strong class="n">${formatR(s.costTotal)}</strong><span class="sub">${s.hasCosts ? `${pct(s.costTotal, s.salesCents).toFixed(1)}% of sales` : "commission only, until you add costs"}</span></div></div>
  </div>
  <div class="grid c3 mt">
   <section class="card"><h2>Top Services by Profitability <button class="linkbtn" data-goto="sales/planner">Plan prices →</button></h2>
    ${services.length ? `<div class="plist">${services.map((x) => `
     <div class="prow" tabindex="0" ${tipAttr(`<b>${esc(x.name)}</b>${formatR2(x.perMin)}/min actual · list ${formatR(x.priceCents)} for ${x.minutes} min · ${x.count} this month`)}>
      ${icon(serviceIcon(x.id))}<span style="font-weight:600">${esc(x.name)}</span>
      <span class="bar"><small>${formatR2(x.perMin)}/min · list ${formatR(x.priceCents)}</small><span><i style="width:${(x.perMin / maxPerMin) * 100}%"></i></span></span>
     </div>`).join("")}</div>` : `<p class="empty-note">No sales this month yet.</p>`}
   </section>
   <section class="card"><h2>Busy Hours <small>average cuts an hour, by weekday</small></h2>${heatmap(s.heat)}</section>
   <section class="card" style="background:color-mix(in oklab,var(--green-wash) 55%,var(--surface))"><h2 style="justify-content:flex-start;gap:10px">${icon("i-bulb", 'style="width:18px;height:18px;color:var(--green)"')}Quick Insights</h2>
    <p class="empty-note">Tips are worked out from your numbers. They appear here in the next build step.</p></section>
  </div>
  <div class="grid c2 mt">
   <section class="card money">${tile("i-bulb", "blue")}<div class="mbar"><b>Where the money went <button class="linkbtn" data-goto="costs/edit">Edit costs →</button></b>${moneyBar(items, s.costTotal)}</div></section>
   <section class="card next">${tile("i-shield", "orange")}<div><b>What to do next</b><p>Your most useful next step will show here once tips are switched on.</p></div></section>
  </div>`;
}
