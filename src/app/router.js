// Keeps the current section and tab in the URL hash (#costs/edit), so refresh and the back button keep your place.

export const SECTIONS = [
  ["dash", "Dashboard", "i-dash"],
  ["sales", "Sales & Services", "i-sales"],
  ["costs", "Costs", "i-costs"],
  ["barbers", "Barbers", "i-barber"],
  ["reports", "Reports", "i-report"],
  ["settings", "Settings", "i-gear"],
];

/** Read "#view/tab" → { view, sub }. Unknown views fall back to the Dashboard. */
export function currentRoute() {
  const [view, sub = ""] = location.hash.slice(1).split("/");
  return SECTIONS.some(([k]) => k === view) ? { view, sub } : { view: "dash", sub: "" };
}

export function go(view, sub = "") {
  const hash = "#" + view + (sub ? "/" + sub : "");
  if (location.hash === hash) dispatchEvent(new HashChangeEvent("hashchange"));
  else location.hash = hash;
}

export function onRouteChange(fn) {
  addEventListener("hashchange", () => {
    fn(currentRoute());
    scrollTo(0, 0);
  });
}
