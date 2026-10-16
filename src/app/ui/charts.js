// Charts drawn as HTML/SVG strings. Each part carries a data-tip for hover, touch and focus.

import { SLOTS } from "../../core/month.js";
import { formatR, pct } from "../../core/money.js";
import { esc, tipAttr } from "./dom.js";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Heatmap colour band for cuts an hour (prd.md > How the Numbers Work). */
export const heatColor = (v) => (v < 1.2 ? "--heat-q" : v < 2 ? "--heat-m" : v < 3 ? "--heat-b" : "--heat-f");

/** Busy Hours grid: rows are time slots, columns Mon–Sun. heat is [weekday][slot]. */
export function heatmap(heat) {
  const head = `<span></span>${DAY_LABELS.map((d) => `<span class="h"><span class="dl">${d}</span><span class="ds" aria-hidden="true">${d.slice(0, 2)}</span></span>`).join("")}`;
  const rows = SLOTS.map((slot, si) =>
    `<span style="align-self:center;white-space:nowrap">${slot}</span>` +
    DAY_LABELS.map((d, di) => {
      const v = heat[di][si];
      return `<span class="c" tabindex="0" style="--hc:var(${heatColor(v)})" ${tipAttr(`<b>${d} ${slot}</b>${v.toFixed(1)} cuts an hour`)} aria-label="${d} ${slot}: ${v.toFixed(1)} cuts an hour"></span>`;
    }).join("")
  ).join("");
  return `<div class="heat">${head}${rows}</div>
    <div class="hlegend"><span style="--c:var(--heat-q)"><i></i>Quiet</span><span style="--c:var(--heat-m)"><i></i>Busy</span><span style="--c:var(--heat-f)"><i></i>Full / Queue</span></div>`;
}

/** Stacked "where the money went" bar. items: [{ name, cents, color }] */
export function moneyBar(items, total) {
  return `<div class="segs">${items
    .filter((it) => it.cents > 0)
    .map((it) => {
      const share = pct(it.cents, total);
      return `<span style="--f:${Math.max(it.cents, total * 0.08)};--c:var(${it.color})" tabindex="0" ${tipAttr(`<b>${esc(it.name)}</b>${formatR(it.cents)} · ${share.toFixed(0)}%`)}>${esc(it.name)}<b>${share.toFixed(0)}%</b></span>`;
    })
    .join("")}</div>`;
}
