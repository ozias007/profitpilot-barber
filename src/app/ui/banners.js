// Banners under the top bar. Slice 3: the storage warning and "costs copied". The reminders (core/reminders.js) join in slice 9.

import { monthLabel } from "../../core/month.js";
import { icon } from "./dom.js";

function banner(kind, text, dismissKey = "") {
  const close = dismissKey ? `<button class="iconx" data-dismiss="${dismissKey}" aria-label="Dismiss">${icon("i-x")}</button>` : "";
  return `<div class="banner ${kind}" role="status">${icon(kind === "warn" ? "i-alert" : "i-info")}<div>${text}</div>${close}</div>`;
}

export function renderBanners({ data, key, store }) {
  const out = [];
  if (!store.ok) out.push(banner("warn", "<b>Can't save on this device.</b> Changes will be lost when you close ProfitPilot."));
  const src = data.months[key]?.costsSource;
  if (src?.startsWith("copied:") && data.dismissed.costsCopied !== key) {
    out.push(banner("info", `Costs copied from ${monthLabel(src.slice(7))}. <button class="linkbtn" data-goto="costs/edit">Update them →</button>`, "costsCopied"));
  }
  return out.join("");
}

export function bindBanners(el, ctx) {
  el.querySelectorAll("[data-dismiss]").forEach((b) =>
    b.addEventListener("click", () => ctx.update((d) => { d.dismissed[b.dataset.dismiss] = ctx.key; })));
}
