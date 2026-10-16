// Settings: prd.md > Settings. Shop Details, Profile, Notifications, Backup & Export, About.
// Every button and switch does something real; nothing says "part of the full app".

import { monthLabel } from "../../core/month.js";
import { transactionsCsv } from "../../core/reports.js";
import { dashboardTips, costJumps } from "../../core/tips.js";
import { esc, icon, tile, downloadCsv } from "../ui/dom.js";
import { tipRow } from "./dashboard.js";
import { rateLabel } from "./barbers.js";

export const title = () => ["Settings", "Manage your shop details, preferences and data."];

const NAV = [["shop", "Shop Details", "i-shop"], ["profile", "Profile", "i-barber"], ["notif", "Notifications", "i-bell"], ["backup", "Backup & Export", "i-up"], ["about", "About", "i-info"]];
const SHOP_FIELDS = [["name", "Shop Name"], ["location", "Location"], ["hours", "Shop Hours"]];

let editing = null; // which shop field is open for editing
let confirmClear = false;

const isDark = () => (document.documentElement.dataset.theme ? document.documentElement.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches);
const sw = (label, on, key) => `<div class="toggle">${esc(label)}<button class="sw-t" role="switch" data-switch="${key}" aria-checked="${on}" aria-label="${esc(label)}"></button></div>`;
const privacy = (text) => `<div class="privacy">${icon("i-lock")}<div><b>Your data stays on your device.</b>${text}</div></div>`;

function shopPage({ data }) {
  const field = ([key, label]) => editing === key
    ? `<form class="fld" data-shopform="${key}"><small>${label}</small><input name="value" value="${esc(data.shop[key])}" aria-label="${label}" class="in-t" style="width:100%" required>
        <span style="grid-row:1/3;grid-column:2;display:flex;gap:6px"><button class="btn primary">Save</button><button type="button" class="btn" data-cancel>Cancel</button></span></form>`
    : `<div class="fld"><small>${label}</small><b>${esc(data.shop[key] || "—")}</b><button aria-label="Edit ${label}" data-edit="${key}">${icon("i-pen")}</button></div>`;
  const link = (label, value, goto) => `<div class="fld"><small>${label}</small><b>${value}</b><button aria-label="Open ${label}" data-goto="${goto}">${icon("i-pen")}</button></div>`;
  return `<section class="card"><h2>Shop Details <small>Update your shop information and preferences.</small></h2>
    <div class="shop"><div class="shopicon">${icon("i-shop")}</div><div>
     ${SHOP_FIELDS.map(field).join("")}
     <div class="fld"><small>Currency</small><b>South African Rand (R)</b></div>
     ${link("Commission", `${rateLabel(data.barbers)} of each barber's sales`, "barbers/commission")}
     ${link("Services and prices", `${data.services.length} services`, "sales/services")}
    </div></div>
    <h2 style="margin-top:22px">Data Management</h2>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn soft" style="flex:1;justify-content:center" data-snav="backup">${icon("i-up")}Import &amp; Export</button><button class="btn danger" style="flex:1;justify-content:center" data-snav="backup" data-ask-clear>${icon("i-trash")}Clear All Data</button></div></section>
   <section class="card"><h2>Preferences</h2>
    ${sw("Show commission on reports", data.prefs.showCommission !== false, "showCommission")}
    ${sw("Weekly summary (a card every Monday)", data.prefs.notify.monday !== false, "notify.monday")}
    ${sw("Dark mode", isDark(), "dark")}
    <p class="sub" style="margin:12px 0 0">Everything is saved on this device automatically.</p>
    ${privacy("No internet. No cloud. Just your business, your data.")}</section>`;
}

function profilePage({ data }) {
  const P = data.profile;
  const initials = (P.name || P.greet || "?").split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase();
  return `<section class="card"><h2>Profile <small>The owner's details, shown on printed reports.</small></h2>
    <form id="profileForm" class="stack" novalidate>
     <div class="avatar-big">${esc(initials)}</div>
     <label>Your name<input name="name" value="${esc(P.name)}" autocomplete="name"></label>
     <label>Role<select name="role">${["Owner", "Manager", "Owner & barber"].map((r) => `<option ${P.role === r ? "selected" : ""}>${r}</option>`).join("")}</select></label>
     <label>Email for reports<input name="email" type="email" value="${esc(P.email)}" autocomplete="email" placeholder="you@example.com"></label>
     <label>Phone<input name="phone" type="tel" value="${esc(P.phone)}" autocomplete="tel" placeholder="082 000 0000"></label>
     <label>What should the dashboard call you?<input name="greet" value="${esc(P.greet)}" placeholder="Boss"></label>
     <button class="btn primary" style="justify-self:start">Save profile</button></form></section>
   <section class="card"><h2>Your shop at a glance</h2><div class="ins">
    <div class="in">${tile("i-shield", "green")}<div><b>Free, on this device</b><span>Everything runs on your phone or laptop. Nothing is uploaded.</span></div></div>
    <div class="in">${tile("i-barber", "blue")}<div><b>${data.barbers.length} barbers · ${data.services.length} services</b><span>Manage them under <button class="linkbtn" data-goto="barbers/commission">Barbers</button> and <button class="linkbtn" data-goto="sales/services">Services</button>.</span></div></div></div></section>`;
}

function notifPage(ctx) {
  const n = ctx.data.prefs.notify;
  const alerts = costJumps(ctx.s, ctx.p).map((a) => tipRow({ ...a, icon: "i-alert", color: "red", link: null }));
  const tips = dashboardTips(ctx.s, ctx.p);
  const recent = [...alerts, ...[...tips.dashboard, ...tips.rest].map(tipRow)];
  return `<section class="card"><h2>Notifications <small>Reminders that keep your numbers up to date.</small></h2>
    ${sw("Remind me to import last month's sales on the 1st", n.importReminder !== false, "notify.importReminder")}
    ${sw("Warn me when a cost jumps by more than 15%", n.costJump !== false, "notify.costJump")}
    ${sw("Tell me when Saturday mornings are full 3 weeks in a row", n.satFull !== false, "notify.satFull")}
    ${sw("Weekly summary every Monday", n.monday !== false, "notify.monday")}
    ${sw("Month-end reminder: restock between the 20th and 25th", n.restock !== false, "notify.restock")}
    <p class="sub" style="margin:12px 0 0">Reminders show inside the app, at the top of the page. Nothing is sent by email or SMS.</p></section>
   <section class="card"><h2>Recent alerts <small>${esc(ctx.label)}</small></h2><div class="ins">${recent.join("") || `<span class="sub">Nothing needs your attention this month.</span>`}</div></section>`;
}

function backupPage({ data, key, label }) {
  const keys = Object.keys(data.months).sort();
  const count = Object.values(data.months).reduce((a, m) => a + m.sales.length, 0);
  return `<section class="card"><h2>Import sales <small>Add a month from a CSV sheet.</small></h2>
     <p class="sub" style="margin:0 0 12px">Columns: date, time, barber, service, price (minutes optional). New barbers and services are checked with you first.</p>
     <button class="btn primary" data-goto="reports/month">${icon("i-up")}Go to Import sales</button>
     <h2 style="margin-top:22px">Export</h2>
     <div style="display:grid;gap:10px">
      <button class="btn soft" id="downloadSales" style="justify-content:center">${icon("i-receipt")}Download ${esc(label)} sales as CSV</button>
      <button class="btn soft" id="printMonth" style="justify-content:center">${icon("i-report")}Monthly report (PDF)</button></div></section>
    <section class="card"><h2>Backup &amp; data</h2>
     <div class="ins">
      <div class="in">${tile("i-cal", "blue")}<div><b>${keys.length} month${keys.length === 1 ? "" : "s"} of sales</b><span>${keys.map((k) => esc(monthLabel(k)) + (data.sample ? " (sample)" : "")).join(", ")}</span></div></div>
      <div class="in">${tile("i-receipt", "purple")}<div><b>${count} sales stored</b><span>On this device only. Customer names and phone numbers are never saved.</span></div></div></div>
     <div class="dangerzone"><b>Clear all data</b><span class="sub">Removes every imported month, cost and change you made. The sample months come back.</span>
      ${confirmClear
        ? `<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn danger" id="clearYes">Yes, clear everything</button><button class="btn" id="clearNo">Cancel</button></div>`
        : `<button class="btn danger" id="clearAll" style="margin-top:10px;justify-self:start">${icon("i-trash")}Clear All Data</button>`}</div></section>`;
}

function aboutPage({ data }) {
  return `<section class="card"><h2>About ProfitPilot Barber</h2>
     <div class="aboutlogo"><span class="pole" aria-hidden="true"></span><div><b>ProfitPilot Barber</b><span class="sub">Version 1.0</span></div></div>
     <p>ProfitPilot shows a barber shop owner what they actually keep each month, which services earn the most per minute of chair time, when the chairs are full, and where the money goes.</p>
     <h2 style="margin-top:18px">How the numbers work</h2>
     <ul class="howlist">
      <li><b>Money kept</b> = sales − all costs, including each barber's commission (rounded to the rand).</li>
      <li><b>Per chair-minute</b> = what a service actually brought in ÷ the minutes it took. Chair time is what a barber shop really sells.</li>
      <li><b>Busy hours</b> = average cuts an hour for each weekday and two-hour slot.</li>
      <li><b>Tips</b> are simple rules worked out from your numbers. No AI.</li></ul></section>
    <section class="card"><h2>Privacy</h2>${privacy("No account, no cloud, no tracking. Your sales sheet is read on this device and never uploaded.").replace('class="privacy"', 'class="privacy" style="margin-top:0"')}
     ${data.sample ? `<p class="sub" style="margin-top:14px">You're looking at a made-up shop, “The Fade Room”, with sample sales for August and September 2026.</p>` : ""}</section>`;
}

export function render(ctx) {
  const page = NAV.some(([k]) => k === ctx.sub) ? ctx.sub : "shop";
  const pages = { shop: shopPage, profile: profilePage, notif: notifPage, backup: backupPage, about: aboutPage };
  return `<div class="settings">
   <nav class="snav card" style="padding:10px" aria-label="Settings sections">${NAV.map(([k, n, i]) => `<button data-snav="${k}" aria-current="${page === k}">${icon(i)}${n}</button>`).join("")}</nav>
   ${pages[page](ctx)}</div>`;
}


export function bind(el, ctx) {
  const redraw = () => ctx.update(() => {}, { uiOnly: true });
  el.querySelectorAll("[data-snav]").forEach((b) => b.addEventListener("click", () => {
    if (b.hasAttribute("data-ask-clear")) confirmClear = true;
    ctx.go("settings", b.dataset.snav);
  }));

  // Shop Details: the pen opens the field, Save keeps it on this device
  el.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => { editing = b.dataset.edit; redraw(); el.querySelector("[data-shopform] input")?.focus(); }));
  el.querySelector("[data-cancel]")?.addEventListener("click", () => { editing = null; redraw(); });
  el.querySelector("[data-shopform]")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const key = e.target.dataset.shopform;
    const value = e.target.value.value.trim().replace(/\s+/g, " ");
    if (!value) { ctx.toast("This can't be empty"); return; }
    editing = null;
    ctx.update((d) => { d.shop[key] = value; });
    ctx.toast("Shop details saved");
  });

  // switches: preferences and notifications, saved on this device
  el.querySelectorAll("[data-switch]").forEach((b) => b.addEventListener("click", () => {
    const key = b.dataset.switch;
    const on = b.getAttribute("aria-checked") !== "true";
    ctx.update((d) => {
      if (key === "dark") d.prefs.theme = on ? "dark" : "light";
      else if (key.startsWith("notify.")) d.prefs.notify[key.slice(7)] = on;
      else d.prefs[key] = on;
    });
    ctx.toast(`${b.getAttribute("aria-label")}: ${on ? "on" : "off"}`);
  }));

  el.querySelector("#profileForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.email.value.trim() && !f.email.checkValidity()) { ctx.toast("That email address doesn't look right"); f.email.focus(); return; }
    ctx.update((d) => { d.profile = { name: f.name.value.trim(), role: f.role.value, email: f.email.value.trim(), phone: f.phone.value.trim(), greet: f.greet.value.trim() || "Boss" }; });
    ctx.toast("Profile saved");
  });

  el.querySelector("#downloadSales")?.addEventListener("click", () => {
    downloadCsv(`profitpilot-transactions-${ctx.key}.csv`, transactionsCsv(ctx.key, ctx.data.months[ctx.key].sales, ctx.data.services, ctx.data.barbers));
    ctx.toast("Downloaded. It opens in Excel.");
  });
  el.querySelector("#printMonth")?.addEventListener("click", () => { ctx.go("reports", "month"); setTimeout(() => window.print(), 300); });

  el.querySelector("#clearAll")?.addEventListener("click", () => { confirmClear = true; redraw(); });
  el.querySelector("#clearNo")?.addEventListener("click", () => { confirmClear = false; redraw(); });
  el.querySelector("#clearYes")?.addEventListener("click", () => {
    confirmClear = false;
    ctx.update(() => ctx.store.clear());
    ctx.toast("Everything cleared. The sample months are back.");
  });
}
