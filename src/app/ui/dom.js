// Small shared UI helpers: escaping, icons, tiles, tabs, toasts and tooltips.

/** Escape anything that came from the user or a CSV before it goes into HTML. */
export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export const COLORS = ["--s1", "--s2", "--s3", "--s4", "--s5", "--s6"];
export const colorAt = (i) => COLORS[i % COLORS.length];

const SERVICE_ICONS = { chiskop: "i-razor", fade: "i-scissors", beard: "i-beard", design: "i-sparkle", kids: "i-child" };
export const serviceIcon = (id) => SERVICE_ICONS[id] || "i-comb";

export const icon = (id, attrs = "") => `<svg ${attrs}><use href="#${id}"/></svg>`;

/** Round icon tile, e.g. tile("i-wallet", "green"). */
export function tile(id, color) {
  return `<span class="tile" style="--c:var(--${color});--w:var(--${color}-wash)">${icon(id)}</span>`;
}

/** Tab bar for a section; tabs are [key, label, icon]. Clicking goes to #view/key. */
export function subtabs(view, tabs, current, style = "") {
  return `<div class="subtabs" role="tablist" style="${style}">${tabs
    .map(([k, label, ic]) => `<button role="tab" data-goto="${view}/${k}" aria-selected="${k === current}">${icon(ic)}${esc(label)}</button>`)
    .join("")}</div>`;
}

export function toast(message) {
  const t = document.createElement("div");
  t.className = "toast";
  t.setAttribute("role", "status");
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

/** data-tip attribute holding tooltip HTML; the HTML is escaped again so it survives the attribute safely. */
export const tipAttr = (html) => `data-tip="${esc(html)}"`;

const tipEl = () => document.getElementById("tip");

/** Tooltips for every [data-tip] inside el: hover, touch and keyboard focus. data-tip holds escaped HTML. */
export function bindTips(el) {
  el.querySelectorAll("[data-tip]").forEach((n) => {
    const show = (x, y) => {
      const tip = tipEl();
      tip.innerHTML = n.dataset.tip;
      tip.hidden = false;
      tip.style.left = Math.max(8, Math.min(x + 14, innerWidth - tip.offsetWidth - 8)) + "px";
      tip.style.top = Math.max(8, y - tip.offsetHeight - 12) + "px";
    };
    const hide = () => (tipEl().hidden = true);
    n.addEventListener("mousemove", (e) => show(e.clientX, e.clientY));
    n.addEventListener("mouseleave", hide);
    n.addEventListener("touchstart", (e) => show(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    n.addEventListener("focus", () => {
      const r = n.getBoundingClientRect();
      show(r.left + r.width / 2, r.top);
    });
    n.addEventListener("blur", hide);
  });
}

/** "+12% vs last month" badge; green when the change is good. Shows "no earlier month" without a comparison. */
export function changeBadge(pctChange, goodUp = true) {
  if (pctChange == null) return `<span class="sub">no earlier month</span>`;
  const good = goodUp ? pctChange >= 0 : pctChange <= 0;
  return `<span class="d ${good ? "up" : "dn"}">${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(0)}% vs last month ${icon("i-trend")}</span>`;
}
