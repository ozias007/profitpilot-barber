// Banners under the top bar: the storage warning, "costs copied", and the in-app reminders from core/reminders.js.

import { monthLabel } from "../../core/month.js";
import { formatR } from "../../core/money.js";
import { reminders } from "../../core/reminders.js";
import { dashboardTips, nextStep } from "../../core/tips.js";
import { esc, icon } from "./dom.js";

function banner(kind, text, dismiss = "") {
  const close = dismiss ? `<button class="iconx" data-dismiss="${esc(dismiss)}" aria-label="Dismiss">${icon("i-x")}</button>` : "";
  return `<div class="banner ${kind}" role="status">${icon(kind === "warn" ? "i-alert" : kind === "week" ? "i-cal" : "i-bell")}<div>${text}</div>${close}</div>`;
}

const today = () => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }; };
const signed = (x) => (x == null ? "" : ` (${x >= 0 ? "+" : ""}${x}% on the week before)`);

function mondayCard(r, ctx) {
  if (!r.week) return banner("week", `<b>Your week</b> Import this month's sales so far to see last week. <button class="linkbtn" data-goto="reports/month">Import sales →</button>`, `monday|${r.dismissKey}`);
  const w = r.week;
  const tip = nextStep(dashboardTips(ctx.s, ctx.p));
  return banner("week", `<b>Your week, ${esc(w.from)} – ${esc(w.to)}</b>
    ${formatR(w.salesCents)} from ${w.cuts} cuts${signed(w.salesChange)}.
    Top service: ${esc(w.topService ?? "—")}. Busiest: ${esc(w.busiestSlot ?? "—")}.<br><span class="sub">${esc(tip)}</span>`, `monday|${r.dismissKey}`);
}

export function renderBanners(ctx) {
  const { data, key, store } = ctx;
  const out = [];
  if (!store.ok) out.push(banner("warn", "<b>Can't save on this device.</b> Changes will be lost when you close ProfitPilot."));
  for (const r of reminders(data, today())) {
    if (r.id === "satFull" && ctx.view !== "dash") continue; // a Dashboard-only nudge, not on every page
    if (r.id === "monday") out.push(mondayCard(r, ctx));
    else if (r.id === "importReminder") out.push(banner("info", `${esc(r.text)} <button class="linkbtn" data-goto="reports/month">Import sales →</button>`, `importBanner|${r.dismissKey}`));
    else out.push(banner("info", esc(r.text), `${r.id}|${r.dismissKey}`));
  }
  const src = data.months[key]?.costsSource;
  if (src?.startsWith("copied:") && data.dismissed.costsCopied !== key) {
    out.push(banner("info", `Costs copied from ${monthLabel(src.slice(7))}. <button class="linkbtn" data-goto="costs/edit">Update them →</button>`, `costsCopied|${key}`));
  }
  return out.join("");
}

export function bindBanners(el, ctx) {
  el.querySelectorAll("[data-dismiss]").forEach((b) => b.addEventListener("click", () => {
    const [name, value] = b.dataset.dismiss.split("|");
    ctx.update((d) => { d.dismissed[name] = value; });
  }));
}
