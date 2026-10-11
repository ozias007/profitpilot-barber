---
doc: prd
status: approved
---

# ProfitPilot Barber — Product Requirements

ProfitPilot Barber is a dashboard for Sipho, who owns a 5-chair barber shop. It shows what he actually kept each month, and which services, days and barbers make him money. It works from his monthly sales CSV, entirely on his own device.

Sources: `scope.md > The Unique Kernel`, `scope.md > Who It's For`.

## The Core Journey
Source: `scope.md > The Core Loop` and `scope.md > What "Working" Looks Like`.

1. **First visit.** Sipho opens ProfitPilot. The Dashboard shows two **sample months** (August and September 2026, "The Fade Room"), and the sidebar says *Showing sample data*. Nothing is empty.
2. **Import.** He taps **Import sales** (on Reports, or from the 1st-of-month banner) and picks a CSV.
3. **New in this file.** Any service or barber name the app hasn't seen is listed before the import finishes. New services need minutes and a list price; new barbers need a commission rate. Each has a "please check" badge until he confirms it.
4. **Import summary.** It shows the sales read, refunds, free cuts, rows skipped (with row numbers), and minute mismatches, each mismatch with a one-tap **Update**.
5. **His numbers.** The sample months disappear, and every screen now shows his month.
   - On a first import, costs start empty with a prompt to enter them. The Money Kept tile says "Add your costs to see money kept".
   - On later imports, costs are copied from the previous real month, with a banner "Costs copied from September. Update them."
6. **Costs.** He types his real costs, such as the electricity bill. Money kept changes by exactly that amount. If a cost jumped (see **Tips**), the alert appears.
7. **Tips.** The Dashboard shows up to 3 plain-language tips, ordered by rand impact. Each links to where he can act on it.
8. **Try a change.** In the **Price Planner** he tries a new price, sees the exact effect, and can change a commission rate on Barbers.
9. **Next month.** He imports the next month and the month-to-month comparisons become real.

**Success (the finish line):**
- Import a real-looking CSV and every number updates correctly.
- Editing a cost or a commission rate changes money kept by the exact amount.
- The price planner shows the exact effect of a new price.

**Demo path:** import the provided **September** example CSV, then the **October** one. That makes the month comparison real, and so is "Electricity up 38%" once he enters October's electricity bill.

## Screens and Layout
Match the design reference `C:\DevPost\design\profitpilot-dashboard.html` 1:1 (`scope.md > Inspiration & Identity`). Read it as the reference; don't paste its code.

**App frame (every screen)**
- **Left sidebar:** barber-pole brand "ProfitPilot Barber · More cuts. Better decisions."
  - Six menu items: Dashboard, Sales & Services, Costs, Barbers, Reports, Settings.
  - The motto at the bottom, plus a data badge: *Showing sample data* or *Showing your imported data*.
- **Top bar:**
  - page title and subtitle (the Dashboard greets him by name, e.g. "Good morning, Boss! 👋");
  - a **month selector** listing every month stored;
  - the **shop name as text** (no dropdown);
  - a light/dark toggle;
  - an avatar button that opens Settings.
- **Banners** (1st-of-month reminder, costs-copied reminder) appear under the top bar.
- **Phone (below ~900px):** the sidebar becomes a slide-in menu opened by a hamburger button, and cards stack in one column. Tables and charts scroll sideways inside their card; the page itself never does.
- **Small touches:** short confirmations appear as toasts at the bottom ("Electricity updated"). Chart parts, heatmap cells and bars show a tooltip on hover, tap or keyboard focus.

**The six sections, with their tabs:**

| Section | Tabs |
|---|---|
| Dashboard | (none) |
| Sales & Services | Overview · Services · Price Planner · Transactions |
| Costs | Overview · Edit Costs · Cost Breakdown · Trends |
| Barbers | Overview · Performance · Commission |
| Reports | Monthly Summary · Service Report · Barber Report · Custom Report |
| Settings | Shop Details · Profile · Notifications · Backup & Export · About |

## Look and Feel
- **Match the reference exactly:**
  - **Colors:** a dark navy sidebar (#0a1631) on a light ground (#f5f7fb), white cards with soft shadows and 14–16px corners, brand blue (#2563eb).
  - **Status colors:** green = good or money kept, red = up or worse, orange = costs, purple = time.
  - **Charts:** a six-color series palette.
  - **Font:** Plus Jakarta Sans, falling back to the system font.
  - **Numbers:** tabular figures; rand shown as `R12 345`; negatives as `−R240`.
- **Dark mode** uses the reference's dark palette. It follows the device setting until he flips the toggle, and his choice is remembered.
- **Built from slice 1:** light/dark mode and the phone layout (`scope.md > The POC Boundary`).
- **Tone:** plain language for a busy owner, no finance jargon. Tips are encouraging and never blame a barber.
- **One label differs from the reference on purpose:** the heatmap is called **"Busy Hours"**, with the subtitle "average cuts an hour, by weekday". The reference's "This Week's Activity" is inaccurate.

## Features and Behavior

### How the Numbers Work
Source: `scope.md > The Unique Kernel`. Every figure below is computed in code and covered by tests.

**Money**
- **Sales:** the sum of every sale's price in the month. Refunds (negative prices) reduce it; free cuts add R0.
- **Commission:** for each barber, that barber's sales × their commission rate, rounded to the rand. Total commission is the sum.
- **Total costs:** the month's entered costs plus total commission.
- **Money kept:** sales − total costs. If no costs are entered for the month, the tile shows "Add your costs to see money kept" instead of a number.

**Chair time**
- **Chair time:** the sum of each sale's minutes. The minutes come from the file when it has a minutes column; otherwise from the service's list minutes.
- **Earnings per chair-minute** for a service: the total charged for it ÷ the total actual minutes. If it had no sales that month, use list price ÷ list minutes. Always show the list price next to it.

**Busy hours (heatmap)**
- 7 weekdays (Mon–Sun) × 6 two-hour slots (08–10, 10–12, …, 18–20).
- Each cell = the cuts in that weekday-and-slot ÷ how many times that weekday occurs in the month ÷ 2 hours.
- Colors (as in the reference):

| Cuts an hour | Color |
|---|---|
| under 1.2 | Quiet |
| 1.2 to under 2 | Busy |
| 2 to under 3 | Busy (stronger) |
| 3 or more | Full / Queue |

**Comparisons and charts**
- **"vs last month":** a percent change against the previous *real* month. With no earlier real month it says "no earlier month".
- **Daily cost line (charts):** that day's share of the entered costs (spread evenly across the month's days), plus commission at the month's average rate on that day's sales. *Carried over from the reference (confirmed).*

### Import Sales
Sources: `scope.md > The Unique Kernel`, `scope.md > The POC Boundary`. Learning goal: robust CSV parsing.

**Where:** the Import card on Reports › Monthly Summary, also reachable from the "Import sales" button, the 1st-of-month banner, and Settings › Backup & Export. He can choose a file, or tap **Try with an example sheet**.

**Two example files are provided:** September 2026 and October 2026. **Try with an example sheet** loads both, with their own example costs labelled "example costs", so the demo's cost comparison is real. A real file still starts with empty costs (decided in `4-spec`). The October file includes a few refunds, a free cut and one new name, so the "New in this file" step and the summary show up in the demo.

**Reading the file**
- The **first row is headings.** It finds columns by name, ignoring case and allowing common alternatives:

  | Column | Also recognised as |
  |---|---|
  | date | |
  | time | |
  | barber | staff, stylist |
  | service | item, product |
  | price | amount, total |
  | minutes | min, duration (optional) |

- **Required columns:** date, service and price. Missing any of them gives the error "Couldn't find the date, service and price columns…" with a sample of the expected headings.
- **Commas or semicolons both work,** and so do quoted fields.
- **Dates** can be `2026-10-03`, `03/10/2026` or `03-10-2026`; day-first is assumed for slashes, as in South Africa.
- **Prices** like `R120`, `120,00` or `1 200` are read.
- If the **time** is missing, the sale counts at 12:00. If the **barber** is missing, it's "Unknown".
- **Privacy:** only date, time, barber, service, price and minutes are kept. Every other column (customer names, phone numbers) is never stored.

**Messy rows**
- **Negative price:** treated as a refund. It reduces sales, and the summary shows "2 refunds, −R240".
- **Zero price:** a free cut. It counts as a cut, uses chair time, earns R0, and is listed ("3 free cuts").
- **Price above R5 000:** imported, but listed as "please check" (likely a misread number or a cents column). Prices can also be written as `R 1 200,00`, `−120` or `(120.00)`.
- **Unreadable row** (bad date, no price): skipped, and the summary shows "Skipped 2 rows (row 14, 87)".
- **New service or barber name:** the **"New in this file"** step appears before the import finishes. New services ask for minutes, plus a list price pre-filled with the most common price in the file. New barbers ask for a commission rate, pre-filled with the shop's usual rate. Defaults carry a "please check" badge until confirmed, both in this step and afterwards on the Services and Commission lists.
- **Minutes that differ from the list:** each sale keeps the file's minutes. The summary says "Fades took 35 min on average in your file, but your list says 40. Update the list?" with a one-tap **Update**.

**Months**
- A file can contain more than one month; each is stored as its own month.
- **Same month imported again:** ask "October already has 754 sales. Replace them with this file?" with **Replace** and **Cancel**. It never merges.
- **First real import:** the sample months are removed.
- **A new month's costs:** copied from the previous real month, with the banner "Costs copied from September. Update them." On the very first import, costs start empty with a prompt to enter them.
- After import, the month selector jumps to the newest imported month.

**Acceptance**
- [ ] Both example CSVs import; the month selector lists only September and October 2026; the sidebar says "Showing your imported data".
- [ ] A semicolon-separated file with headings "Date;Staff;Item;Amount;Customer" and dates like `03/10/2026` imports correctly. The customer column is nowhere in the stored data.
- [ ] Refunds and free cuts are counted and shown in the summary as described.
- [ ] An unknown service triggers the "New in this file" step, and nothing is guessed silently.
- [ ] Importing October again asks before replacing; afterwards there is no double-counting.
- [ ] A file without date, service or price columns shows a plain error, and the existing data is unchanged.

### Dashboard
Source: `scope.md > The Unique Kernel`.

**Four tiles**
- **Money Kept:** with "out of R… taken in" and a progress bar showing the percent kept.
- **Total Sales** and **Total Chair Time:** each with "vs last month".
- **Total Costs:** with "% of sales".

**Three cards**
- **Top Services by Profitability:** every service with sales, ranked by R/min, with a bar each and the list price on hover. Links to "Plan prices →".
- **Busy Hours:** the heatmap, with a legend: Quiet / Busy / Full.
- **Quick Insights:** up to 3 tips (see **Tips**).

**Bottom row**
- **Where the money went:** a stacked bar of the cost categories plus commission, with percentages. Links to "Edit costs →".
- **What to do next:** the single highest-impact tip, phrased as an action.

**Acceptance**
- [ ] With October imported and costs entered, Money Kept equals sales − entered costs − commission, matching a hand calculation.
- [ ] Changing October electricity from R2 000 to R2 760 makes Money Kept exactly R760 lower.

### Tips
Source: `scope.md > Why This Matters to the Learner` (rule-based tips, no AI). Every rule is a tested function: given the numbers in, it either fires a tip or doesn't.

Tips are ordered by **rand impact**. The Dashboard shows at most 3; the rest appear on the relevant page (see **Choosing the Dashboard's 3 tips** below).

| Tip | Fires when | Example wording | Shown on |
|---|---|---|---|
| **Busiest slot** | a slot averages 3+ cuts an hour | "Saturday 10:00–12:00 averages 3.9 cuts an hour. Take bookings so walk-ins don't leave." | Dashboard |
| **Cost jump** | a cost is up more than 15% **and** at least R200 vs the previous real month | "Electricity up 38%: R2 000 → R2 760." Also drives the Costs alert and its warning icon. | Dashboard, Costs |
| **Lowest earner per minute** | the service with the lowest R/min that has 10+ sales and is at least 20% below the shop's average R/min | Links to the Price Planner with that service selected. | Dashboard |
| **Discount gap** | a service with 10+ sales whose average charged price is 10%+ below its list price | "Fades sold for R108 on average, not R120." | Dashboard |
| **Money kept fell** | money kept is down more than 10% vs last month | Names the biggest cause: a specific cost, fewer cuts, or higher commission. | Dashboard |
| **Quiet slot** | a weekday (Mon–Fri) slot averages under 0.5 cuts an hour | "Tuesday 12:00–14:00 is quiet. Try a weekday special." | Dashboard |
| **Top earner** | always, when a barber has sales | Name and share of total sales. | Barbers only |
| **Best per hour** | always, when a barber has sales | Name and average rand per chair-hour. | Barbers only |
| **Lowest share** | a barber's sales are below 60% of the team average | Supportive, never blaming: "Give Nathi the Saturday overflow." | Barbers only |

- **Nothing fires:** a green tick with "Nothing needs your attention this month. Steady month."
- **Rand impact** (per month):
  - cost jump: the rand increase;
  - money kept fell: the rand drop;
  - discount gap: (list − average charged) × number sold;
  - lowest earner per minute: (shop average R/min − this service's R/min) × this service's total minutes that month;
  - busiest and quiet slots: no rand amount; they rank after the tips that have one.
- **Choosing the Dashboard's 3 tips:**
  1. Take the top 2 tips by rand impact.
  2. If the busiest-slot tip fires, it takes 3rd place. Otherwise, 3rd place goes to the next tip by rand impact.
  3. **No double counting:** if "Money kept fell" names a cost as its biggest cause, and that same cost also fired "Cost jump", show only "Money kept fell" (with the cost named in it).

**Acceptance**
- [ ] Each rule has tests just inside and just outside its threshold. For example, a cost up 15% doesn't fire, 16% does; up 20% but only R150 doesn't fire.
- [ ] With the October example plus the demo electricity bill, "Electricity up 38%" appears on the Dashboard and Costs.
- [ ] The busiest-slot tip is on the Dashboard whenever it fires, even when 3+ tips have a higher rand impact.
- [ ] When money kept fell because of a cost that also jumped, only one tip appears for it.

### Costs
Source: `scope.md > The POC Boundary`, slice 2.

**Tiles (every tab):** Total Costs (% of sales), Highest Cost, and Biggest Increase vs last month.

**Tabs**
- **Overview:** a donut of costs including commission, with the cost-jump icon on flagged items. Next to it, the **Cost Trend** chart (daily costs vs sales) with the cost-jump alert under it.
- **Edit Costs:**
  - one row per cost for the selected month: name, an amount field, "last month R…", and a remove button;
  - a read-only **Commission** row, "worked out from each barber's rate", linking to Barbers › Commission;
  - an **Add a cost** row (name and amount).
  - Saving: Enter or leaving the field saves, recalculates everything, and shows a toast.
  - Validation: an amount must be R0 or more, and a cost can't be named "Commission". A plain message explains either problem.
- **Cost Breakdown:** a table of each cost last month vs this month, with the change in rand.
- **Trends:** the Cost Trend chart on its own.

**Acceptance**
- [ ] Adding "Security R450" lowers money kept by exactly R450 and appears in the donut and the bar.
- [ ] Removing it restores the previous figure exactly.

### Barbers
Source: `scope.md > The POC Boundary`, slice 2.

**Tiles:** Total Barbers ("on 11% commission", or a range like "10–12%"), Total Sales vs last month, and Total Commission (% of sales).

**Tabs**
- **Overview:** barber, sales, commission, % of total, and average per chair-hour.
- **Performance:** cuts, chair hours, average per cut, and average per hour.
- **Commission:**
  - each barber's sales, an editable **rate %** (0–100), commission, and "Shop keeps";
  - an **Add a barber** row (name and rate). Duplicate names are refused.

**Performance Insights card:** the barber tips from **Tips**.

**Acceptance**
- [ ] Changing a barber's rate from 11% to 12% changes commission by exactly 1% of their sales (rounded to the rand), and money kept by the same amount in the opposite direction.

### Sales & Services
Source: `scope.md > The POC Boundary`, slice 3.

**Tiles (Overview and Transactions):** Total Sales, Avg. Sale and Total Transactions, each vs last month.

**Tabs**
- **Overview:** a Sales by Service table (sales, % of total, average price) and a Service Share donut. A **Pro Tip** box below shows a computed comparison of two services: the highest-earning service per minute vs the most-sold one. *The reference's hard-coded sentence becomes a rule (confirmed).*
- **Services:**
  - an editable list: name, list price, list minutes, R/min (actual, list price shown next to it), and this month's count and sales;
  - an **Add a service** row (name, price, minutes). Duplicate names are refused, and price and minutes must be above 0.
  - **Editing a price never re-prices past sales.** It changes the list, the fallback R/min and the planner.
- **Price Planner:** inputs and results are under **Price Planner** below.
- **Transactions:** the latest 30 sales of the month (date, time, barber, service, amount).

### Price Planner
Source: `scope.md > The Core Loop`, step 4.

**Inputs**
- **Service.**
- **New price:** a slider from 50% to 160% of the list price, in R5 steps.
- **Customers you might lose:** 0–40%, in 5% steps.
- **Saturdays only:** a checkbox.

**Results update live**
- **Cuts a month:** n → n kept. n = that service's cuts this month (Saturdays only, if ticked); n kept = n × (1 − lost%), rounded.
- **Extra money a month:** (n kept × new price) − (what those n cuts actually brought in, discounts included), with before → after. It's labelled "assumes customers pay the new price".
- **Earnings per chair-minute:** current actual R/min → new price ÷ list minutes, and how many chair-minutes are freed by lost customers.

**Footnote:** "Based on October 2026. A rough guide: real customers may react differently, so try a change for a month and compare."

**Acceptance**
- [ ] For a hand-made month with 33 Saturday kids cuts that each brought in R70, planning R80 with 0% lost shows "+R330 a month".

### Reports
Source: `scope.md > The POC Boundary`, slice 4. Moves to Later if time runs out.

**Header buttons:** **Select date** (opens Custom Report), **Import sales**, and **Export PDF**. Export PDF opens the browser's print dialog with a clean print layout of the current report tab: no sidebar or buttons, and charts kept.

**Tabs**
- **Monthly Summary:**
  - four mini tiles: Sales, Costs, Money Kept and Cuts, each vs last month;
  - the Sales vs Costs daily bar chart;
  - the **Import** card;
  - **Download Reports:** four cards (Monthly Summary, Service Report, Barber Report, Transactions), each offering **Open**, **PDF** (print) and **CSV** (download, opens in Excel);
  - a tip card.
- **Service Report:**
  - tiles: Services sold, Best earner per minute, and Uses the most chair time;
  - a table per service: sold, change, sales, change, % of sales, chair time, R/min, plus a Total row;
  - two donuts: share of sales and share of chair time;
  - a "Read it together" note.
- **Barber Report:**
  - tiles: Barbers, Average sales per barber, and Commission paid;
  - a table: cuts, sales, change, commission (rate), average per cut, per chair-hour, busiest day, and the service they do most;
  - horizontal bars of sales by barber.
- **Custom Report:**
  - filters: From day, To day (within the selected month), Barber, Service, Day of the week, and Reset;
  - tiles: Sales (% of the month), Cuts (per cut), and Chair time (R/min);
  - a sales-per-day chart, and the matching sales (latest 40).
  - With nothing matching: "No sales match these filters. Try a wider date range."

**Acceptance**
- [ ] The Custom Report filtered to Saturdays + Kids Cut gives the same count the Price Planner uses for "Saturdays only".
- [ ] A downloaded CSV opens in Excel with the same rows as on screen.

### Settings
Source: `scope.md > The POC Boundary`, slice 4. Moves to Later if time runs out.

**Shop Details**
- Editable fields, saved on the device: shop name, location and shop hours. The shop name updates the top bar. Currency is shown as South African Rand (R), display only (confirmed).
- Commission and Services rows link to their pages.
- **Data Management:** Import & Export, and Clear All Data.
- **Preferences** toggles: Show commission on reports, Weekly summary (the Monday card), and Dark mode (same as the top-bar toggle). The reference's "Auto backup" toggle is removed and replaced by the line "Everything is saved on this device automatically."
- The privacy note: "Your data stays on your device."

**Profile**
- Name, role (Owner / Manager / Owner & barber), email and phone (optional, stored on the device only, used on printed reports), and "What should the dashboard call you?" (used in the greeting).
- Saving validates the email format.
- A "Your shop at a glance" card.

**Notifications** (in-app only; toggles saved on the device)
- **1st-of-month banner:** "Import last month's sales". It shows from the 1st to the 7th when last month isn't imported, disappears once it is, and can be dismissed for the rest of that month.
- **Cost-jump warning:** turns the Cost jump tip and alert on or off.
- **Monday card:** on Mondays, all day, dismissible. It summarises the most recent full Mon–Sun week in the data:
  - sales and cuts vs the week before;
  - the top service;
  - the busiest slot;
  - one tip.

  If that week isn't imported: "Import this month's sales so far to see last week."
- **Saturday mornings full:** a banner that fires when the Saturday 08:00–12:00 slots average 3+ cuts an hour in each of the last 3 full weeks in the data.
- **Restock reminder:** a banner from the 20th to the 25th of the current month: "Month-end is your busiest week. Restock blades and products."
- **Recent alerts:** a list of the tips that fired for the selected month.

**Backup & Export**
- A link to Import.
- **Download this month's sales as CSV.**
- **Monthly report (PDF):** print.
- A list of the months stored and the number of sales stored.
- **Clear All Data:** asks for confirmation in the page with "Yes, clear everything" and "Cancel". It removes every imported month, cost and edit, and brings the sample months back.

**About**
- What ProfitPilot does.
- "How the numbers work" (money kept, per chair-minute, busy hours, tips are rules not AI).
- The privacy note.

**Acceptance**
- [ ] Every button and toggle in Settings does something visible. None just shows "part of the full app".

## States and Boundaries
- **First visit:** the sample months and *Showing sample data*. Tips fire on the sample data, so nothing is empty.
- **Only one real month:** every "vs last month" shows "no earlier month", and the cost-jump and money-kept-fell tips don't fire.
- **No costs entered:** the Money Kept tile shows "Add your costs to see money kept". Commission is still calculated and shown.
- **A month with no sales** (e.g. a service with 0 sales): R/min falls back to list price ÷ list minutes. Tables show "—" rather than R0 per hour.
- **Import error:** a plain message explains what's wrong and existing data is untouched.
- **Saved between visits:** imported months (only the six allowed fields), costs per month, services, barbers and rates, shop details, profile, notification toggles, dismissed banners, the theme choice, and the last viewed month and section. A refresh loses nothing.
- **Privacy boundary:** no internet calls, no account, no AI. Nothing leaves the device except files he downloads or prints himself.
- **Sales outside 08:00–20:00:** counted in every total, but not shown in the heatmap (confirmed).

## Product Decisions
- **Sample months disappear on the first real import.** Comparing real data with made-up data would create fake alerts. Clear All Data brings them back.
- **Re-importing a month asks to replace and never merges.** Merging would double-count.
- **Two example CSVs (September and October).** They make the month comparison and the cost alert real in the demo.
- **Price edits never re-price the past.** Imported sales are what was actually charged.
- **The finish line was reworded:** "editing a cost or a commission rate changes money kept by the exact amount; the price planner shows the exact effect of a new price."
- **R/min uses actual charged ÷ actual minutes,** with the list price shown next to it. That's what Sipho really earned, discounts included.
- **No silent guesses for new names.** Defaults are shown with "please check" until confirmed.
- **No misleading Money Kept before costs are entered.**
- **Tips are ordered by rand impact,** at most 3 on the Dashboard. Barber tips stay on the Barbers page and are supportive in tone.
- **The heatmap is renamed "Busy Hours".** Accuracy beats matching a label word for word.
- **Price Planner baseline is the actual amount charged,** labelled "assumes customers pay the new price". It matches how R/min is worked out.
- **The busiest-slot tip always gets a Dashboard place when it fires.** Saturday's queue is the demo moment.
- **No dead buttons.** Placeholders become real when they're cheap and need no server (`scope.md > The POC Boundary`).
- **Imports never store extra columns.** That keeps customer names and phone numbers out (`scope.md > The POC Boundary`).

## What We're Building
Everything in **Features and Behavior**, in the scope's build order:

1. **Import, example data and the Dashboard.** This includes the number rules and tips, light/dark mode and the phone layout.
2. **Costs and Barbers.**
3. **Sales & Services and the Price Planner.**
4. **Reports and Settings.**

## Deferred From the POC
- **Reports and Settings (slice 4)** if time runs out. Without Settings, Clear All Data and notifications wait too; the core loop still works.
- **Email and SMS reminders and summaries.** They need a server.
- **Editing or deleting individual sales.** Re-import a corrected file instead.

## Possible Later Enhancements
- **Booking or POS integration** instead of a CSV.
- **Multi-month trends** beyond last month vs this month.
- **Per-barber pay slips** from commission.

## Non-Goals
- **Multiple shops:** one shop in this version.
- **AI-written advice:** tips are rules, so they can be tested.
- **Accounts, cloud sync or sharing:** the data stays on the device.
- **Storing customer details:** extra CSV columns are dropped.
- **Re-pricing past sales from the price list.**

## Open Questions
None. All four were resolved before approval:
- the Price Planner baseline is the actual amount charged;
- the Auto backup toggle is removed;
- both extra notification toggles are now real banners;
- tip ordering is fixed, including the busiest-slot guarantee and the no-double-counting rule.
