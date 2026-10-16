// Reports: prd.md > Reports. Slice 2 has the Import card; the four report tabs come in slice 8.

import { importCard, bindImport } from "./import.js";

export const title = () => ["Reports", "Import your sales, view detailed reports and track your shop's performance over time."];

export function render(ctx) {
  return importCard(ctx);
}

export function bind(el, ctx) {
  bindImport(el, ctx);
}
