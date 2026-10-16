// Start-up and the one update cycle every change goes through: change the data → save → recalculate → redraw.

import { summarise, previousKey, monthLabel } from "../core/month.js";
import { SECTIONS, currentRoute, go, onRouteChange } from "./router.js";
import { createStore } from "./store.js";
import { esc, icon, bindTips, toast } from "./ui/dom.js";
import { renderBanners, bindBanners } from "./ui/banners.js";
import { WIDTH_CHARTS } from "./ui/charts.js";
import * as dashboard from "./views/dashboard.js";
import * as reports from "./views/reports.js";
import * as costs from "./views/costs.js";
import * as barbers from "./views/barbers.js";
import * as sales from "./views/sales.js";
import * as settings from "./views/settings.js";

const VIEWS = {
  dash: dashboard,
  sales,
  costs,
  barbers,
  reports,
  settings,
};

const root = document.documentElement;
const $ = (id) => document.getElementById(id);

const store = createStore(() => window.localStorage);
let data = store.load();
let summaries = {};

function recalc() {
  summaries = {};
  for (const [key, m] of Object.entries(data.months)) summaries[key] = summarise(key, m, data.services, data.barbers);
}

/**
 * Apply a change, save it, recalculate and redraw. Every edit in the app goes through here.
 * `change` either edits the document in place or returns a whole new document (imports, Clear All Data).
 * { uiOnly: true } marks changes that only move around (month, section): they don't overwrite unreadable saved data.
 */
export function update(change, { uiOnly = false } = {}) {
  data = change(data) ?? data;
  if (!(uiOnly && store.unreadable)) store.save(data);
  recalc();
  render();
}

function monthKeys() {
  return Object.keys(data.months).sort();
}

function applyTheme() {
  if (data.prefs.theme === "system") delete root.dataset.theme;
  else root.dataset.theme = data.prefs.theme;
}

export const isDark = () => (root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches);

function render() {
  applyTheme();
  const { view, sub } = currentRoute();
  const keys = monthKeys();
  if (!keys.includes(data.ui.month)) data.ui.month = keys.at(-1);
  const key = data.ui.month;
  const prev = previousKey(keys, key);
  const ctx = { data, key, label: monthLabel(key), s: summaries[key], p: prev ? summaries[prev] : null, view, sub, update, go, toast, store };
  lastCtx = ctx;

  $("menu").querySelectorAll("button").forEach((b) => b.setAttribute("aria-current", b.dataset.v === view ? "page" : "false"));
  $("month").innerHTML = keys.slice().reverse().map((k) => `<option value="${k}">${monthLabel(k)}</option>`).join("");
  $("month").value = key;
  $("shopName").textContent = data.shop.name;
  $("dataBadge").textContent = data.sample ? "Showing sample data" : "Showing your imported data";

  const V = VIEWS[view];
  const [title, subtitle] = V.title(ctx);
  $("title").textContent = title;
  $("sub").textContent = subtitle;
  document.title = `${title.replace(/ 👋$/, "")} · ProfitPilot Barber`;

  $("banners").innerHTML = renderBanners(ctx);
  bindBanners($("banners"), ctx);

  const el = $("view");
  el.innerHTML = V.render(ctx);
  V.bind?.(el, ctx);
  drawCharts(ctx);
  bindTips(el);
}

/** Draw width-dependent charts at their card's real width (again whenever the window is resized). */
function drawCharts(ctx) {
  document.querySelectorAll("#view [data-chart]").forEach((el) => {
    const series = el.dataset.series ? JSON.parse(el.dataset.series) : null;
    el.innerHTML = WIDTH_CHARTS[el.dataset.chart](ctx.s, Math.max(280, Math.floor(el.clientWidth)), series);
    bindTips(el);
  });
}
let lastCtx = null;

function closeMenu() {
  document.body.classList.remove("nav-open");
  $("menuBtn").setAttribute("aria-expanded", "false");
}

function start() {
  $("menu").innerHTML = SECTIONS.map(([k, name, ic]) => `<button data-v="${k}">${icon(ic)}${esc(name)}</button>`).join("");
  $("menu").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) { go(b.dataset.v); closeMenu(); }
  });
  $("menuBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    const open = document.body.classList.toggle("nav-open");
    $("menuBtn").setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", (e) => {
    if (document.body.classList.contains("nav-open") && !e.target.closest(".side")) closeMenu();
  });
  addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

  // any element with data-goto="view/tab" navigates
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-goto]");
    if (t) { const [v, s] = t.dataset.goto.split("/"); go(v, s); }
  });

  // "please check" badges on imported names: tapping one marks that service or barber as checked
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-confirm]");
    if (!t) return;
    const [kind, id] = t.dataset.confirm.split(":");
    update((d) => { const item = (kind === "barber" ? d.barbers : d.services).find((x) => x.id === id); if (item) item.confirmed = true; });
    toast("Marked as checked");
  });

  $("avatar").addEventListener("click", () => go("settings"));
  $("themeBtn").addEventListener("click", () => update((d) => { d.prefs.theme = isDark() ? "light" : "dark"; }));
  $("month").addEventListener("change", (e) => update((d) => { d.ui.month = e.target.value; }, { uiOnly: true }));

  // remember the section and tab, so he comes back where he left off
  let resizeTimer;
  addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => lastCtx && drawCharts(lastCtx), 120); });

  onRouteChange(({ view, sub }) => update((d) => { d.ui.view = view; d.ui.sub = { ...d.ui.sub, [view]: sub }; }, { uiOnly: true }));
  if (!location.hash && data.ui.view && data.ui.view !== "dash") {
    history.replaceState(null, "", `#${data.ui.view}${data.ui.sub?.[data.ui.view] ? "/" + data.ui.sub[data.ui.view] : ""}`);
  }
  const opened = currentRoute(); // opened straight on a section (a link or a refresh): that's where he is now
  data.ui.view = opened.view;
  data.ui.sub = { ...data.ui.sub, [opened.view]: opened.sub };
  if (!store.unreadable) store.save(data);

  applyTheme();
  recalc();
  render();
  if (store.unreadable) toast("Saved data couldn't be read; showing sample data.");
}

start();
