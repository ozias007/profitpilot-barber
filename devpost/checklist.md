---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast, with learn mode for slices 2–3 (CSV parsing and import); learner's stated preference in `learner-profile.md`.

## Slices

- [x] **1. Open ProfitPilot and see the sample month's Dashboard**
  Becomes usable:
  - The app runs locally and shows the full app frame from the design: sidebar, top bar with the month selector and shop name, light/dark toggle, and the phone slide-in menu.
  - The Dashboard is drawn from the sample months: Money Kept, Total Sales, Chair Time and Total Costs tiles with "vs last month"; Top Services by R/min; the Busy Hours heatmap; Where the money went.
  - The other five sections exist in the menu, each showing its title.
  Why now: The kernel (money kept and per chair-minute) is visible and computed by tested code on day one. The bootstrap, the design port, the theme tokens and the phone layout all land here, so every later slice builds on the real frame (`scope.md > The POC Boundary`: light/dark and phone from slice 1).
  PRD ref: `prd.md > Screens and Layout`, `prd.md > Look and Feel`, `prd.md > How the Numbers Work`, `prd.md > Dashboard` (tiles and cards; tips come in slice 4), `prd.md > States and Boundaries` (first visit)
  Spec ref: `spec.md > Look and Feel`, `spec.md > File Structure`, `spec.md > Components` (`core/money.js` formatting, `core/sample.js` sample months, `core/month.js`, `app/main.js and app/router.js`, `app/ui/` dom + charts heatmap/stacked bar, `app/views/` dashboard), `spec.md > Data Model`
  Build:
  - Create `index.html`, `styles.css` (the reference's tokens and components ported, light and dark), `package.json` (`"type": "module"`, `npm test`), `.gitignore` and the `src/` tree.
  - Write `money.js` (cents and formatting), a seeded `sample.js` (Aug/Sep 2026, The Fade Room, the reference's services, barbers and costs), and `month.js` (sales, commission per barber rounded to the rand, costs, kept or null, actual R/min with list fallback, heatmap, daily lines, `compare()`).
  - Build the app frame, hash router, theme toggle, the Dashboard tiles and cards, and the shared tooltip and toast helpers.
  Verify (mechanical):
  - `npm test` passes `money.test.js` and `month.test.js`. They hand-check money kept, commission rounding, R/min (actual, and the list fallback for 0 sales), heatmap cell maths, and `compare()` with no previous month.
  - Serve with `npm start` and load it in a headless browser at 1280px and 390px, in light and dark: no console errors; the Dashboard numbers match a `month.js` run on the same sample data; the phone menu opens and closes.
  Learner check: Run `npm start`, open http://localhost:8000, and compare the Dashboard side by side with `profitpilot-dashboard.html`. Flip dark mode, narrow the window to phone width, and open the menu. Does it look like the design?
  Commit: `Add app frame and sample-data Dashboard with tested month maths`

- [x] **2. Import a CSV and see your own numbers**
  Becomes usable:
  - Reports shows the Import card. Sipho picks a CSV (comma or semicolon, quoted fields, header aliases, day-first dates, messy prices) and the Dashboard switches to his month.
  - The sample months disappear and the badge says "Showing your imported data".
  - The import summary lists the sales read, refunds, free cuts, skipped rows and "please check" prices above R5 000.
  - **Try with an example sheet** loads September and October 2026 with labelled example costs.
  - Download links for both example CSVs work.
  Why now: CSV parsing is the riskiest piece and the learner's main learning goal, and the import feeds every number. It runs in learn mode.
  PRD ref: `prd.md > Import Sales` (reading the file, messy rows, months), `prd.md > The Core Journey` steps 2, 4 and 5, `prd.md > Product Decisions` (sample months disappear)
  Spec ref: `spec.md > Components` (`core/money.js` price parsing, `core/csv.js`, `core/importer.js`, `core/sample.js` example CSVs and example costs, `app/views/` import.js), `spec.md > Decisions and Open Issues` (the learner's useful unknown, separators)
  Build:
  - Price parsing in `money.js`, using the confirmed separator rule plus the R/space/NBSP and negative forms.
  - `csv.js`: BOM, line endings, quotes, delimiter detection.
  - `importer.js`: aliases, row kinds, skips with row numbers, the >R5 000 check, months split, unmapped columns never read, new-name and mismatch detection returned (the UI for those comes in slice 3).
  - The Import card, the summary and the example-sheet button.
  - `scripts/make-examples.mjs`, which writes `examples/sales-2026-09.csv` and `sales-2026-10.csv`.
  Verify (mechanical):
  - `npm test` passes `money.test.js` (all nine separator and negative cases), `csv.test.js` and `importer.test.js`. These cover the semicolon file with a `customer` column (customer absent from the result), refunds, free cuts, skipped rows, the >R5 000 flag, and a missing required column (error, nothing returned).
  - In a headless browser, importing the October example file updates the Dashboard totals to match `month.js` on the parsed rows.
  Learner check: Open Reports, tap "Try with an example sheet", then check the month selector and the Dashboard. Then import `examples/sales-2026-10.csv` with the file picker, and also a messy file of your own (semicolons, `R 1 200,00`, a refund). Is the summary right?
  Commit: `Add CSV parser and sales import with example sheets`

- [x] **3. Imports are safe, and everything survives a reload**
  Becomes usable:
  - New service or barber names stop the import at the "New in this file" step (minutes and list price, or commission rate, with "please check" badges).
  - Re-importing a month asks "Replace them with this file?".
  - A minute mismatch offers a one-tap Update.
  - The first real import starts with empty costs ("Add your costs to see money kept"); later months copy the previous costs with the banner.
  - Everything is saved in `localStorage` (`profitpilot-barber.v1`) and survives a reload, with the last section and month remembered. Blocked or full storage shows the in-memory warning instead of crashing.
  Why now: It completes the import half of the kernel. Without saving, nothing else in the build is usable for real, and the data model gets proven before four sections depend on it.
  PRD ref: `prd.md > Import Sales` (new names, minutes that differ, months), `prd.md > States and Boundaries` (no costs entered, saved between visits), `prd.md > Product Decisions`
  Spec ref: `spec.md > Components` (`app/store.js`, `app/views/` import.js, `core/importer.js`), `spec.md > Data Model`, `spec.md > Important Failure Modes`
  Build:
  - `store.js` (load, save and clear in try/catch, version check, corrupt-data fallback without overwriting).
  - The single `update()` → save → recalc → render cycle.
  - The "New in this file" step, the in-page replace confirmation, mismatch Update, `costsSource` handling and the banners, and the empty-costs Money Kept state.
  - **Prices to check (learner feedback at the slice 2 check):** a sale above R5 000 stays out of the totals until confirmed in the "New in this file" step, with two choices: "Keep R12 000" or "It's in cents: R120.00".
  Verify (mechanical):
  - `npm test` passes the importer tests for new names (defaults: most common price, shop's usual rate), mismatches, and copied vs empty costs.
  - In a headless browser:
    - import, reload, and the data and month are still there;
    - re-import October, choose Cancel (unchanged), then Replace (sale count equal to the file, no double count);
    - with `localStorage.setItem` stubbed to throw, the warning banner shows and the app keeps working.
  Learner check: Import October from the file picker (it has "Dreadlocks retwist", a new service), confirm it, then reload the page. Import the same file again and try both Cancel and Replace. Does every step feel clear?
  Commit: `Add import safeguards and on-device saving`

- [x] **4. Plain-language tips tell Sipho what to do**
  Becomes usable:
  - The Dashboard's Quick Insights shows up to 3 tips chosen by rand impact, with the busiest slot guaranteed a place.
  - "What to do next" shows the top tip as an action, and "Steady month" with a green tick appears when nothing fires.
  - Each tip links to where to act (for example the Price Planner, once it exists).
  Why now: The tips turn the kernel numbers into decisions, and they're the learner's second learning goal. Doing them before the section pages means Costs and Barbers can reuse the same rules.
  PRD ref: `prd.md > Tips`, `prd.md > Dashboard`
  Spec ref: `spec.md > Components` (`core/tips.js`, `app/views/` dashboard.js)
  Build: `tips.js`, with one function per rule, the rand-impact values, `pickDashboardTips()` (top 2 + guaranteed busiest slot + no double counting) and the steady-month result, wired into the Dashboard. The barber tip functions are built and tested here and displayed in slice 6.
  Verify (mechanical): `npm test` passes `tips.test.js`. It covers just inside and just outside every threshold (cost +15% no, +16% yes, +20% but R150 no; 10 sales vs 9; 20% below the average; 0.5 and 3.0 cuts an hour; the 60% team average), the busiest-slot guarantee with 3 bigger tips, the cost-jump/money-kept-fell de-duplication, and the steady month. In the browser, the example-sheet October data shows the expected tips.
  Learner check: Load the example sheet and read the three Dashboard tips for October. Do they read like advice you'd give a client? Change nothing yet; just note anything that feels off.
  Commit: `Add rule-based tips to the Dashboard`

- [x] **5. Costs: edit them and see money kept move exactly**
  Becomes usable:
  - The Costs section with all four tabs (Overview donut and Cost Trend, Edit Costs, Cost Breakdown, Trends), its three tiles, the cost-jump alert and the warning icons.
  - Editing, adding and removing costs works, with validation and toasts; the read-only Commission row links to Barbers.
  - "Electricity up 38%" appears when October's electricity goes from R2 000 to R2 760.
  Why now: This is the demo's "exact amount" moment and the second half of money kept.
  PRD ref: `prd.md > Costs`, `prd.md > Tips` (cost jump), `prd.md > The Core Journey` step 6
  Spec ref: `spec.md > Components` (`app/views/` costs.js, `app/ui/` charts donut + lines, `core/month.js`)
  Build: The costs view and tabs, editing via `update()`, the donut and the daily line chart with tooltips, and the alert driven by the cost-jump rule.
  Verify (mechanical): `npm test` passes the new `month.test.js` cases: changing electricity by +R760 lowers kept by exactly 76 000 cents; adding Security R450 and then removing it restores the figure. In the browser, the same edits change the Money Kept tile by exactly those amounts, and the alert appears.
  Learner check: With the example sheet loaded, set October electricity to 2760 and watch Money Kept and the alert. Add and remove "Security 450". Did every number move by exactly what you typed?
  Commit: `Add Costs section with editing and cost-jump alert`

- [x] **6. Barbers: commission you can set and check**
  Becomes usable:
  - The Barbers section with the Overview, Performance and Commission tabs, and its three tiles.
  - Editable rates (0–100), Add a barber (no duplicates), and "please check" badges for unconfirmed barbers.
  - The Performance Insights card with the supportive barber tips.
  Why now: Commission is the other lever on money kept, and the Barbers page completes the core-loop step "try a change".
  PRD ref: `prd.md > Barbers`, `prd.md > Tips` (barber rules)
  Spec ref: `spec.md > Components` (`app/views/` barbers.js, `core/month.js`, `core/tips.js`)
  Build: The barbers view and tabs, rate editing and Add barber via `update()`, and the barber tips shown.
  Verify (mechanical): `npm test` passes the commission case (11% → 12% changes commission by 1% of that barber's sales, rounded to the rand, and kept by the same amount in the opposite direction). In the browser the same change shows on the tiles and in the table.
  Learner check: Change one barber from 11% to 12%, then check "Shop keeps" and the Dashboard's Money Kept. Add a barber called "Musa". Do the barber tips sound supportive?
  Commit: `Add Barbers section with commission editing`

- [x] **7. Sales & Services and the Price Planner**
  Becomes usable:
  - Sales & Services with Overview (table, donut, computed Pro Tip), Services (edit name, price and minutes; add a service; "please check" badges; price edits never re-price the past), and Transactions (latest 30).
  - The Price Planner with live sliders, labelled "assumes customers pay the new price".
  Why now: This completes the core loop's "try a change" and the demo's final beat (+R330).
  PRD ref: `prd.md > Sales & Services`, `prd.md > Price Planner`
  Spec ref: `spec.md > Components` (`core/planner.js`, `app/views/` sales.js)
  Build: `planner.js`, the sales view and tabs, service editing and adding via `update()`, and the planner's live update without a full redraw.
  Verify (mechanical): `npm test` passes `planner.test.js`: 33 Saturday kids cuts at R70 → R80 with 0% lost = +R330; lost% rounding; the baseline uses the actual amount charged. A test also confirms a price edit leaves past sales totals unchanged. In the browser, the planner with Kids Cut, R80 and Saturdays only shows the computed figure.
  Learner check: Open the Price Planner, pick Kids Cut, set R80, tick Saturdays only, then move "customers you might lose". Change the Fade price on Services and confirm last month's takings didn't change.
  Commit: `Add Sales & Services and the Price Planner`

- [x] **8. Reports: summaries, custom filters, PDF and CSV**
  Becomes usable:
  - Reports with all four tabs: Monthly Summary (mini tiles, the Sales vs Costs bars, the Import card, Download Reports, a tip), Service Report, Barber Report, and Custom Report (filters, tiles, chart, matching sales, the empty message).
  - Export PDF prints a clean layout of the current tab, and every CSV download opens in Excel.
  Why now: Slice 4 of the scope; it moves to Later first if time runs out.
  PRD ref: `prd.md > Reports`
  Spec ref: `spec.md > Components` (`core/reports.js`, `app/views/` reports.js, `app/ui/` charts bars + hbars), `spec.md > Look and Feel` (print stylesheet)
  Build: `reports.js` (custom filter, report rows, CSV text with proper quoting), the four tabs, `print.css` with `window.print()`, and Blob downloads.
  Verify (mechanical):
  - `npm test` passes `reports.test.js`:
    - the custom filter, Saturdays + Kids Cut, equals the planner's Saturday count;
    - the CSV export round-trips through `csv.js` with the same rows, including a name with a comma.
  - In the browser:
    - the print media emulation hides the sidebar and controls;
    - a CSV download is triggered.
  Learner check: Filter the Custom Report to Saturdays + Kids Cut, download the Transactions CSV and open it in Excel, then press Export PDF on the Service Report and look at the print preview.
  Commit: `Add Reports with custom filters, PDF and CSV export`

- [ ] **9. Settings, reminders and the README**
  Becomes usable:
  - Settings with all five screens:
    - **Shop Details:** editable, with the top bar updating; Data Management; Preferences (no auto-backup toggle).
    - **Profile:** the greeting uses "call you".
    - **Notifications:** five working toggles and Recent alerts.
    - **Backup & Export:** CSV download, PDF, months stored, and Clear All Data with an in-page confirmation that brings the samples back.
    - **About.**
  - In-app banners: the 1st–7th import reminder, the Monday summary card, Saturday mornings full, the 20th–25th restock reminder. Each is dismissible and respects its toggle.
  - A README with what it is, how to run it and test it, and the live link placeholder.
  Why now: The last scope slice; reminders depend on everything above.
  PRD ref: `prd.md > Settings`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Components` (`core/reminders.js`, `app/ui/` banners.js, `app/views/` settings.js, `app/store.js` clear), `spec.md > Where It Runs and How Someone Tries It`
  Build: `reminders.js`, the banners, the settings view and its five screens, Clear All Data via `store.clear()`, and `README.md`.
  Verify (mechanical): `npm test` passes `reminders.test.js`:
  - the import banner on the 1st–7th only when the month is missing, gone after import, and dismissal lasting the month;
  - the Monday card with the latest full Mon–Sun week, and the fallback text;
  - Saturday full across 3 full weeks (fires) vs 2 (doesn't);
  - restock on the 20th and 25th but not the 19th or 26th.

  In the browser, Clear All Data, then confirm, brings the sample months back, and every Settings button and toggle changes something visible.
  Learner check: Edit the shop name and watch the top bar change. Change "What should the dashboard call you?" and look at the greeting. Turn a notification off, then on. Finally, Clear All Data and confirm the sample data is back.
  Commit: `Add Settings, in-app reminders and README`

## Hands-on Checkpoints

- [x] Early usable behavior explored — after slice 4: import the example sheet and your own messy CSV, read the Dashboard and tips, and give feedback while Costs, Barbers and Sales are still to come
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence:
Route and stops:
Edit outcome:
Reflection:
Activity mode:

## Revisions

- Added `npm start` (`scripts/serve.mjs`, no dependencies, no-cache, localhost only, never serves `learner-profile.md`) as the way to run the app. `python -m http.server` let the browser cache old modules, so code changes didn't show after a reload.
- `applyImport` (the import → saved-data step) lives in `core/importer.js` rather than the app, so the rules for removing sample data, copying costs and replacing months are unit-tested. The spec put this in the app.
- The first real import keeps sample services and barbers only when their names appear in the file (with their list settings), and drops the rest, so the made-up shop's barbers don't linger. The PRD didn't say what happens to sample names.
- Re-importing a month keeps that month's existing costs; only the sales are replaced. The PRD covered sales only, and losing typed costs on a corrected re-import would surprise Sipho.
- Refunds reduce sales but aren't counted as cuts and use no chair time. The PRD said only that they "reduce sales".
- At the slice 2 learner check, the import summary gained a plain reason per skipped row ("Row 9: “31/02/2026” isn't a real date.") and a rows-read line ("Read 11 rows: 9 sales, 1 refund, 1 free cut. 2 rows skipped."). Holding back prices above R5 000 until confirmed moved into slice 3. Learner feedback.
- `finalizeImport()` (applying the answers from "New in this file") is in `core/importer.js`, and `store.js` takes its storage as a parameter. That way the R5 000 answers, the new-name edits and full or blocked storage are all unit-tested in Node, not only in the browser.
- "Please check" stays on a new service or barber until the owner ticks **Checked** in the step (or confirms it later on Services or Commission). Pressing Finish alone doesn't confirm anything. The PRD said badges last "until confirmed" but didn't say what confirming is.
- Opening the app straight on a section (a link or a refresh) now counts as "where he left off". Found in the browser check: only clicks were being remembered.
- Learner feedback at the slice 3 check:
  - a new service whose only sales were free cuts now starts with an empty list price ("no paid sale") instead of R0, which used to block Finish;
  - step errors appear next to their own item and name it ("Shape-up needs a list price.");
  - an unanswered R5 000 row says "Row 10: choose Keep R12 000 or It's in cents.";
  - typed values survive the redraw.

  The checking moved into `core/importer.js` as `checkStepAnswers()`, with tests.
- A service's "average charged" now leaves refunds out (free cuts still count at R0). A refund isn't a discount, and counting it made the Discount gap tip misfire.
- The October example sheet now has slightly more discounted fades (45% instead of 40%), so its Fade average (R106) triggers the Discount gap tip, as the PRD's "Fades sold for R108 on average" example intends. It was R108.x and didn't fire.
- The heatmap shows two-letter day names (Mo, Tu…) only between 1201 and 1500px wide, where the reference's own labels overlap (25px labels in 19px columns). Every other width matches the reference.
- At the slice 4 checkpoint the learner resolved the electricity question with option (c):
  - cost jumps are **warnings, not tips**: a slim red alert strip at the top of the Dashboard ("Electricity up 38% (+R760). Check costs →"), shown whatever the tip ranking, plus the alert on Costs;
  - they never appear in Quick Insights, and the tip ranking is unchanged;
  - the "money kept fell vs cost jump" de-duplication was removed, since there's nothing left to de-duplicate.

  The `prd.md > Tips` table and acceptance were updated. The test is in `tips.test.js`.
- Donut legends stack under the donut whenever their card is narrower than 560px, using a CSS container query. At about 1280px the reference's own legend overlaps ("Commission" runs into its percentage, and the warning icon covers "Electricity").
- Costs: adding a cost whose name is already on the list (ignoring case) is refused with "Electricity is already on the list. Change its amount above." The PRD didn't cover duplicates.
- "Please check" badges on Barbers (and later Services) are buttons: tapping one marks that imported name as checked. Editing a barber's rate also counts as checking it. A new barber added by hand starts with the shop's most common rate.
- The Price Planner opens on the lowest earner per minute (the service the Dashboard tip links to), with "Saturdays only" ticked and the list price + R10. With the October example sheet that's Kids Cut: 36 Saturday cuts, so R80 shows +R360. The PRD's +R330 (33 cuts) is checked exactly in `planner.test.js`.
- The Transactions CSV export uses the import's own columns (date, time, barber, service, price, minutes), so an export imports back unchanged; there's a round-trip test. The CSV files start with a byte-order mark so Excel reads them as UTF-8.
- Known limit: the reference palette has six series colours, so a 7th service or barber reuses the first colour in charts.

