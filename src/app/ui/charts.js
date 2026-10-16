// Charts drawn as HTML/SVG strings. Each part carries a data-tip for hover, touch and focus.

import { SLOTS, MONTH_NAMES } from "../../core/month.js";
import { formatR, pct } from "../../core/money.js";
import { esc, tipAttr } from "./dom.js";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Heatmap colour band for cuts an hour (prd.md > How the Numbers Work). */
export const heatColor = (v) => (v < 1.2 ? "--heat-q" : v < 2 ? "--heat-m" : v < 3 ? "--heat-b" : "--heat-f");

/** Busy Hours grid: rows are time slots, columns Mon–Sun. heat is [weekday][slot]. */
export function heatmap(heat) {
  const head = `<span></span>${DAY_LABELS.map((d) => `<span class="h"><span class="dl">${d}</span><span class="ds" aria-hidden="true">${d.slice(0, 2)}</span></span>`).join("")}`;
  const rows = SLOTS.map((slot, si) =>
    `<span style="align-self:center;white-space:nowrap"><span class="slf">${slot}</span><span class="sls">${slot.slice(0, 2)}–${slot.slice(8, 10)}</span></span>` +
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

/** Donut of shares. items: [{ name, cents, color }]; total in the middle. fmt formats amounts (rand by default). */
export function donut(items, total, label, fmt = formatR) {
  const r = 72, c = 2 * Math.PI * r;
  let offset = 0;
  const segs = items.filter((it) => it.cents > 0 && total > 0).map((it) => {
    const len = (it.cents / total) * c;
    const seg = `<circle r="${r}" cx="100" cy="100" stroke="var(${it.color})" stroke-width="30" stroke-dasharray="${Math.max(len - 2, 0)} ${c}" stroke-dashoffset="${-offset}" transform="rotate(-90 100 100)" tabindex="0" ${tipAttr(`<b>${esc(it.name)}</b>${fmt(it.cents)} · ${pct(it.cents, total).toFixed(1)}%`)}></circle>`;
    offset += len;
    return seg;
  }).join("");
  return `<svg viewBox="0 0 200 200" role="img" aria-label="${esc(label)}">${segs}<text x="100" y="98" text-anchor="middle" font-size="21" font-weight="800" fill="var(--ink)" stroke="none">${fmt(total)}</text><text x="100" y="119" text-anchor="middle" font-size="11.5" fill="var(--muted)" stroke="none">${esc(label)}</text></svg>`;
}

/** Y axis gridlines labelled R0 … R8k. Returns the grid markup and a value → y function. */
function axes(W, H, pad, max) {
  const y = (v) => H - pad.b - (v / max) * (H - pad.t - pad.b);
  let g = "";
  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i;
    g += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${pad.l - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)" stroke="none">${v ? "R" + +(v / 100000).toFixed(1) + "k" : "R0"}</text>`;
  }
  return { g, y };
}
const niceMax = (values) => Math.ceil(Math.max(100, ...values) / 200000) * 200000; // round up to R2k steps (values in cents)
const short = (s) => MONTH_NAMES[s.month - 1].slice(0, 3);

/** Cost Trend: daily costs and daily sales as two lines across the month. */
export function trendLines(s, W) {
  const H = 230, pad = { l: 46, r: 12, t: 12, b: 26 }, n = s.days;
  const max = niceMax([...s.daily, ...s.dailyCost]);
  const { g: grid, y } = axes(W, H, pad, max);
  const x = (i) => pad.l + (i / (n - 1)) * (W - pad.l - pad.r);
  let g = grid;
  [1, 7, 14, 21, 28].forEach((d) => (g += `<text x="${x(d - 1)}" y="${H - 7}" text-anchor="middle" font-size="11" fill="var(--muted)" stroke="none">${short(s)} ${d}</text>`));
  [[s.dailyCost, "--s1"], [s.daily, "--green"]].forEach(([values, color]) => {
    g += `<path d="${values.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(Math.max(0, v)).toFixed(1)).join("")}" stroke="var(${color})" stroke-width="2"/>`;
    values.forEach((v, i) => { if (i % 3 === 0) g += `<circle cx="${x(i)}" cy="${y(Math.max(0, v))}" r="4" fill="var(${color})" stroke="var(--surface)" stroke-width="2"/>`; });
  });
  const step = (W - pad.l - pad.r) / (n - 1);
  for (let i = 0; i < n; i++) {
    g += `<rect x="${x(i) - step / 2}" y="${pad.t}" width="${step}" height="${H - pad.t - pad.b}" fill="transparent" stroke="none" ${tipAttr(`<b>${i + 1} ${short(s)}</b>Sales: ${formatR(s.daily[i])}<br>Costs: ${formatR(s.dailyCost[i])}`)}/>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Daily sales and costs">${g}</svg>`;
}

/**
 * Sales vs Costs per day as paired bars. `series` overrides the month's own lines
 * (the Custom Report passes its filtered sales, with no costs).
 */
export function dailyBars(s, W, series = null) {
  const daily = series?.daily ?? s.daily, dailyCost = series?.dailyCost ?? s.dailyCost;
  const H = 200, pad = { l: 46, r: 8, t: 12, b: 26 }, n = s.days;
  const max = niceMax([...daily, ...dailyCost]);
  const { g: grid, y } = axes(W, H, pad, max);
  const gw = (W - pad.l - pad.r) / n, bw = Math.max(2, Math.min(9, gw / 2 - 2));
  let g = grid;
  for (let i = 0; i < n; i++) {
    const cx = pad.l + gw * i + gw / 2;
    [[daily[i], "--s2", -1], [dailyCost[i], "--s1", 1]].forEach(([v, color, side]) => {
      if (!(v > 0)) return;
      const bx = side < 0 ? cx - bw - 1 : cx + 1, top = y(v), r = Math.min(3, bw / 2);
      g += `<path d="M${bx} ${y(0)} V${top + r} q0 -${r} ${r} -${r} h${bw - 2 * r} q${r} 0 ${r} ${r} V${y(0)}z" fill="var(${color})" stroke="none"/>`;
    });
    const tipText = `<b>${i + 1} ${short(s)}</b>Sales: ${formatR(daily[i])}${series?.salesOnly ? "" : `<br>Costs: ${formatR(dailyCost[i])}`}`;
    g += `<rect x="${cx - gw / 2}" y="${pad.t}" width="${gw}" height="${H - pad.t - pad.b}" fill="transparent" stroke="none" ${tipAttr(tipText)}/>`;
    if ([0, 6, 13, 20, 27].includes(i)) g += `<text x="${cx}" y="${H - 7}" text-anchor="middle" font-size="11" fill="var(--muted)" stroke="none">${short(s)} ${i + 1}</text>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${series?.salesOnly ? "Sales per day for this selection" : "Sales and costs per day"}">${g}</svg>`;
}

/**
 * Charts that need the card's real width are drawn after the page is on screen: <div class="chart" data-chart="trend">.
 * A data-series attribute (JSON) can supply the numbers instead of the month summary.
 */
export const WIDTH_CHARTS = { trend: trendLines, bars: dailyBars };
