---
doc: spec
status: approved
---

# ProfitPilot Barber — Technical Spec

## How This Works, In Plain Language
ProfitPilot is a **static web page**: an `index.html`, one stylesheet and a handful of JavaScript files. There's no server and no framework. GitHub Pages hands the files to the browser once (about 100 KB, plus the font), and everything after that happens on Sipho's phone.

The code is split into two halves:

- **The core** (`src/core/`) is plain JavaScript functions that only do maths and rules: reading a CSV, adding up a month, working out commission, choosing tips, the price planner. They never touch the screen or storage. That's what makes them testable: each test gives a function some numbers and checks the answer, using Node's built-in test runner (`node --test`).
- **The app** (`src/app/`) is everything Sipho sees and touches: the sidebar, the six sections, the charts, the forms. When he does something (imports a file, types a cost), the app updates the saved data, asks the core to recalculate, and redraws the screen.

**Saving** uses the browser's `localStorage`, a small notepad the browser keeps for one website. Everything is saved as one JSON document under the key `profitpilot-barber.v1`. The key has a namespace because all your GitHub Pages apps share one origin (`username.github.io`). When he comes back, the app reads that document and he's where he left off. If the browser blocks or fills up storage, the app keeps working in memory and tells him his changes won't be saved.

**Money is stored in cents** (whole numbers), so "money kept drops by exactly R760" is exact. A floating-point slip like R759.9999 can't happen.

**Why this shape:**
- Sipho is on prepaid mobile data, and a ~100 KB page costs almost nothing to load.
- It matches the design reference's own technology, and it's the stack of your last two apps.
- No server means nothing to host, secure or pay for, and no way for his data to leave the phone.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.

1. **First visit.** `main.js` asks `store.js` for saved data and finds none. `core/sample.js` generates the two sample months (August and September 2026) from a fixed seed, so they're identical on every device. The sidebar badge says *Showing sample data*.
2. **Import.** Sipho picks a file. The browser reads it as text, and nothing is uploaded.
   - `core/csv.js` splits the text into rows: it detects comma or semicolon and handles quoted fields.
   - `core/importer.js` matches the headings to columns and reads dates, prices and minutes.
   - The importer drops every other column, labels each row as a sale, refund, free cut or skipped, and lists any names it hasn't seen.
3. **New in this file.** If there are new names, `app/views/import.js` shows the step, with the defaults that `importer.js` suggested. Sipho confirms or edits them.
4. **Replace check.** If a month already exists, the app asks "October already has 754 sales. Replace them with this file?" before going further.
5. **Commit.** `importer.js` returns the new months plus a summary.
   - The app removes the sample months on the first real import.
   - Each new month's costs are copied from the previous real month, or start empty on the very first import.
   - `store.js` saves the result.
6. **His numbers.** `core/month.js` turns each month into a summary: sales, commission, costs, money kept, R/min, heatmap, daily lines. The current section's view draws it.
7. **Costs.** Typing a cost updates `months["2026-10"].costs` and saves; then `month.js` recalculates and the screen redraws. Money kept moves by exactly the change.
8. **Tips.** `core/tips.js` runs every rule against this month and the previous real month. Each rule that fires returns its tip and its rand impact, and the module picks the Dashboard's 3.
9. **Try a change.** `core/planner.js` works out the price planner's numbers live as the sliders move. A commission edit goes through the same update → save → recalculate → redraw cycle as a cost edit.

```
 CSV file ─► core/csv ─► core/importer ─► (New in this file) ─► store (localStorage)
                                                                     │
           screen ◄── app/views ◄── core/month + core/tips ◄─────────┘
             │                                                       ▲
             └── edits (costs, rates, services, settings) ──────────►┘
```

## Stack
Learner's choice: plain HTML/CSS/JS like the reference. The reasons are Sipho's prepaid mobile data, the closest match to the design, and the learner's own recent stack. The accepted tradeoff: no framework conveniences, so the views re-render from template strings.

- **HTML, CSS and JavaScript (ES modules)** in the browser. No bundler, no framework, no npm dependencies.
  - [MDN: JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- **Node.js 24** (installed: v24.16.0), only for running tests. `node --test`.
  - [Node test runner](https://nodejs.org/api/test.html), [node:assert](https://nodejs.org/api/assert.html)
- **Web APIs used:**
  - [`localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) for saving;
  - [`File.text()`](https://developer.mozilla.org/en-US/docs/Web/API/Blob/text) for reading the CSV;
  - [`Blob` and `URL.createObjectURL`](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static) with a download link for CSV export;
  - [`window.print()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/print) with [`@media print`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media#print) for PDF export.
- **Font:** [Plus Jakarta Sans from Google Fonts](https://fonts.google.com/specimen/Plus+Jakarta+Sans), weights 400–800, falling back to `system-ui`. If the font can't load, the system font is used and nothing breaks.
- **CSV parser:** our own, no library. Learner's choice, because it's their main learning goal.

## Where It Runs and How Someone Tries It

**Locally:** ES modules don't load from `file://`, so serve the folder:
```
python -m http.server 8000
```
then open <http://localhost:8000>. Python is already installed. `npx serve` works too, but it downloads a package.

**Tests:**
```
npm test
```
This runs `node --test`. `package.json` has no dependencies, so there's no `npm install`.

**Public link (learner's choice):** GitHub Pages, deployed from the `main` branch root.
- In the repo: Settings → Pages → *Deploy from a branch* → `main` / `/ (root)`.
- URL: `https://<username>.github.io/<repo>/`. All asset paths are relative, so the app works from a sub-path.

**Demo video:** the PRD's demo path, recorded on the Pages URL, or on localhost if Pages isn't ready yet.
1. First visit shows the sample data.
2. Reports → **Try with an example sheet**. This loads September and October 2026 with their labelled example costs. Optionally, also show a real file import of `examples/sales-2026-10.csv` to demonstrate the "New in this file" step and the summary.
3. Costs → set October electricity to R2 760, and "Electricity up 38%" appears.
4. Price Planner → Kids Cut, R80, Saturdays only.

Phone width and dark mode are shown briefly. The example CSVs are also linked from the Import card, so judges can download and import them.

## Look and Feel
Carried from `prd.md > Look and Feel` and `scope.md > Inspiration & Identity`, with no new design decisions.

- **Port the reference's CSS** design tokens and component styles into `styles.css`:
  - `:root` light tokens;
  - a dark block under `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`, plus `:root[data-theme="dark"]`, so the toggle wins either way;
  - the "a little larger" size overrides.

  Rebuild the screens to match; don't copy the reference's JS.
- **Theme:** the toggle sets `data-theme` on `<html>` and saves it in `prefs.theme`. Saved as "system", it follows the device.
- **Layout:**
  - **Phone (below 900px):** a slide-in sidebar with a dimmed backdrop. A hamburger button opens it, and Escape or a tap outside closes it. Cards stack.
  - **Tables:** in `.tw` wrappers with sideways scroll.
  - **Charts:** redraw on resize at the card's width.
  - **Grid breakpoints:** 1200, 1100, 860, 540 and 480px, as in the reference.
- **Numbers:** `R12 345` with a thin space, whole rand on tiles; `R2.80` for R/min; `−R240` for negatives. Tabular figures.
- **Print stylesheet (`print.css`, `media="print"`):**
  - hides the sidebar, top-bar controls, tabs and buttons;
  - white background, cards without shadows, charts kept;
  - a header with the shop name, report name and month.
- **Accessibility basics from the reference:** visible focus rings; `aria-current` on navigation; tablist roles on tabs; switches with `role="switch"`; tooltips that also open on keyboard focus; `prefers-reduced-motion` respected.

## Components

### Core (pure functions, all tested)

#### core/money.js
- Converts between rand and cents; formats amounts (`R12 345`, `R2.80`, `−R240`).
- **Parses messy price strings:** `R1 200,00`, `1,200.00`, `120,00`, `120`.
- **Decimal-separator rule (learner-confirmed):** the last `,` or `.` followed by exactly 1–2 digits is the decimal mark; every other `,` or `.` is a thousands separator. So `1,200` → R1 200, `120,5` → R120.50, `1.200,00` → R1 200.
- **Leading "R" and spaces:** a leading `R` is stripped, with or without a space, and every space is ignored, including non-breaking (U+00A0) and thin (U+202F) spaces. Examples: `R 1 200,00`, `R1 200.00`.
- **Negatives become refunds:** `-120`, `−120` (Unicode minus) and `(120.00)` all mean −R120.
- **Unreadable prices** (no digits, or junk left over) return `NaN`, and the row is skipped.
- **Tests:** one each in `money.test.js` for `1,200`, `120,5`, `1.200,00`, `R 1 200,00`, `R1 200.00`, the non-breaking-space form, `-120`, `−120` and `(120.00)`.
- PRD ref: `prd.md > Import Sales`, `prd.md > How the Numbers Work`.

#### core/csv.js
- Turns text into an array of string arrays. Handles BOM, `\r\n` and `\n`, quoted fields with commas, semicolons or `""` inside, and blank lines.
- **Delimiter detection:** count `;` vs `,` outside quotes in the header line; the larger wins, and ties go to `,`.
- PRD ref: `prd.md > Import Sales`.

#### core/importer.js
- **Maps headings to fields** using the alias table in `prd.md > Import Sales` (case-insensitive, trimmed).
- **Parses each row:**
  - Dates: `YYYY-MM-DD`, or `DD/MM/YYYY` and `DD-MM-YYYY` (day-first). Dates are kept as plain year/month/day numbers, never a `Date` object, so there are no timezone shifts.
  - Time: `HH:MM`, defaulting to 12:00.
  - Price: via `money.js`.
  - Minutes: optional.
- **Labels each row:** sale, refund (price below 0), free cut (price 0), or skipped (with its row number and reason).
- **Lists names it hasn't seen**, with suggested defaults:
  - a new service gets the most common price in the file and minutes from the file (or 30), flagged `confirmed: false`;
  - a new barber gets the shop's most common rate, also `confirmed: false`.
- **Collects minute mismatches:** a service whose average minutes in the file differs from its list minutes.
- **Sanity check:** any single sale above R5 000 is still imported, but listed in the summary as "please check" with its row number. A barber cut over R5 000 is almost certainly a misread number or a cents column. Tested in `importer.test.js`.
- **Returns** `{ months: { "2026-10": [sale…] }, summary, newServices, newBarbers, mismatches, error? }`. Columns that aren't mapped are never read into the result.
- PRD ref: `prd.md > Import Sales`.

#### core/month.js
- **Input:** one month's sales, costs, services and barbers.
- **Output:** the month summary. Every formula is in `prd.md > How the Numbers Work`.
  - **Totals:** sales; commission per barber and in total; costs (entered + commission); money kept, or `null` when no costs are entered.
  - **Chair time:** total minutes; per-service count, sales and actual R/min (falling back to list price ÷ list minutes); per-barber cuts, sales, minutes and per chair-hour.
  - **Busy hours:** the heatmap grid (7 weekdays × 6 slots, cuts an hour).
  - **Charts:** daily sales and daily cost lines.
  - **Barber extras:** busiest weekday and the service they do most.
- Also `compare(current, previous)` for every "vs last month" percentage. `previous` is the previous *real* month, or `null`.
- PRD ref: `prd.md > How the Numbers Work`, `prd.md > Dashboard`, `prd.md > Costs`, `prd.md > Barbers`.

#### core/tips.js
- One function per rule. Each takes the current and previous month summaries and returns either `null` or `{ id, impactCents, title, text, link, page }`.
- `pickDashboardTips(all)` applies the selection: the top 2 by impact, the busiest slot guaranteed 3rd place when it fires, and the "money kept fell" rule replacing a matching "cost jump".
- Also returns the "steady month" result when nothing fires.
- **Wording** is built from the numbers with fixed templates in the PRD's tone. The barber tips are supportive.
- PRD ref: `prd.md > Tips`.

#### core/planner.js
- **Inputs:** service, new price, % lost, Saturdays only, and the month's sales.
- **Outputs:** `{ n, kept, nowCents, afterCents, diffCents, perMinNow, perMinNew, freedMinutes }`. The baseline is what those cuts actually brought in.
- PRD ref: `prd.md > Price Planner`.

#### core/reports.js
- **Custom report filter:** from/to day, barber, service and weekday, giving matching sales, totals and sales per day.
- **Report rows:** the Service and Barber Report table rows with month-on-month changes.
- **CSV export:** turns rows into CSV text, using the same quoting rules as the parser.
- PRD ref: `prd.md > Reports`.

#### core/reminders.js
- **Input:** today's date, the stored months, toggles and dismissals.
- **Output:** which banners and cards to show:
  - **1st-of-month import banner:** days 1–7 when last month is missing and not dismissed this month.
  - **Monday card:** a summary of the most recent full Mon–Sun week in the data vs the week before, with the top service, busiest slot and one tip; or the "import this month so far" text.
  - **Saturday mornings full:** the 08:00–12:00 slots average 3+ cuts an hour in each of the last 3 full weeks.
  - **Restock:** days 20–25.
  - **Costs-copied banner.**
- PRD ref: `prd.md > Settings` (Notifications).

#### core/sample.js
- A seeded random generator, as in the reference's approach, with its own code.
- **Builds the sample months:** August and September 2026, The Fade Room, the reference's services, barbers and costs (electricity R2 000 in September).
- **Produces the two example CSVs' content:** September and October 2026.
  - The October file adds 2 refunds, 3 free cuts, one new service ("Dreadlocks retwist"), a minutes column where Fades average 35 minutes, and a `customer` column.
  - The customer column proves that extra columns get dropped.
- **Tuned so the demo tips fire:** a Saturday 3+ slot; the Kids Cut lowest-earner tip (R70); Kids Cut with about 33 Saturday cuts.
- **Example costs (learner decision, option a):** each example month has its own example costs. September's electricity is R2 000; October's starts at R2 000, so typing R2 760 gives "Electricity up 38%".
  - **"Try with an example sheet"** loads both example months, *with* those costs, and labels them **"example costs"** on Costs and in the import summary.
  - **A real file** chosen by Sipho (including the downloaded example CSVs) follows the PRD: empty costs on the first import, copied costs after that.
- PRD ref: `prd.md > States and Boundaries` (first visit), `prd.md > Import Sales`.

### App (browser, not unit-tested; checked in the browser)

#### app/store.js
- `load()`: read and `JSON.parse` the `profitpilot-barber.v1` key inside try/catch; check the `version`, falling back to defaults on anything unreadable.
- `save(data)`: write inside try/catch. On a quota or security error, set `storageOk = false` and show the banner "Can't save on this device. Changes will be lost when you close ProfitPilot."
- `clear()`: remove the key, so the sample months come back.
- PRD ref: `prd.md > States and Boundaries` (saved between visits).

#### app/main.js and app/router.js
- `main.js` starts everything: load, apply the theme, render, and bind the sidebar, top bar and hamburger.
- `router.js` keeps the view and tab in the URL hash (`#costs/edit`), so a refresh or the back button keeps his place. It also saves the last view and month in `ui`.
- After every change, one `update(mutator)` function runs the mutation, saves, recalculates the summaries and re-renders.
- PRD ref: `prd.md > Screens and Layout`.

#### app/ui/ (shared UI pieces)
- **`dom.js`:** `esc()` for every value coming from user data or CSVs (names are user input, so everything is escaped before going into HTML); toasts; tooltips (hover, touch and focus); the tab bar; the in-page confirm pattern (no `confirm()`).
- **`charts.js`:** SVG donut, daily lines (Cost Trend), daily paired bars (Sales vs Costs and the custom report), horizontal bars, and the heatmap. Each has tooltips.
- **`banners.js`:** renders what `core/reminders.js` says to show.
- PRD ref: `prd.md > Screens and Layout`, `prd.md > Look and Feel`.

#### app/views/ (one file per section)
| File | Implements |
|---|---|
| `dashboard.js` | `prd.md > Dashboard`, Dashboard tips from `prd.md > Tips` |
| `sales.js` | `prd.md > Sales & Services`, `prd.md > Price Planner` (live update without a full redraw) |
| `costs.js` | `prd.md > Costs` |
| `barbers.js` | `prd.md > Barbers` |
| `reports.js` | `prd.md > Reports`, including Export PDF (`window.print()` on the current tab) and CSV downloads |
| `import.js` | the Import card, the "New in this file" step, the replace check and the import summary; used from Reports and Settings (`prd.md > Import Sales`) |
| `settings.js` | `prd.md > Settings`: Shop Details, Profile, Notifications, Backup & Export, About |

## Data Model
One JSON document in `localStorage["profitpilot-barber.v1"]`:

```js
{
  version: 1,
  sample: true,                     // true until the first real import
  shop:    { name: "The Fade Room", location: "", hours: "Mon – Sun 08:00 – 20:00" },
  profile: { name: "", role: "Owner", email: "", phone: "", greet: "Boss" },
  prefs:   { theme: "system", showCommission: true, weeklySummary: true,
             notify: { importReminder: true, costJump: true, satFull: true, monday: true, restock: true } },
  dismissed: { importBanner: "2026-10", monday: "2026-10-12", restock: "2026-10", satFull: "2026-10-12", costsCopied: "2026-10" },
  services: [ { id: "fade", name: "Fade", priceCents: 12000, minutes: 40, confirmed: true } ],
  barbers:  [ { id: "thabo", name: "Thabo", ratePct: 11, confirmed: true } ],
  months: {
    "2026-10": {
      sales: [ [3, 540, "thabo", "fade", 12000, 35] ],   // [day, minuteOfDay, barberId, serviceId, priceCents, minutes]
      costs: { "Rent": 1000000, "Electricity": 276000 },  // cents; commission is never stored, always computed
      costsSource: "copied:2026-09"                        // or "example" (labelled "example costs") or null
    }
  },
  ui: { view: "dash", sub: {}, month: "2026-10" }
}
```

**Where each piece lives, how it changes, and what happens on return**
- **Sample data:** never stored. If `sample` is true, the months are regenerated from the seed on every load. Edits made to sample months are kept in memory for that session only; *implementation choice*.
- **Months:** written only by an import (add or replace) and by cost edits. They survive reloads.
- **Services and barbers:** written by imports, the edit tables and the add forms. Past sales point to them by `id`, so renaming a service renames it everywhere, and price edits never touch `sales`.
- **Sales as compact arrays:** about 30 bytes a sale, so a 754-sale month is about 25 KB, and years of data fit in the roughly 5 MB localStorage limit.
- **Never stored:** summaries, tips and banners. They're recalculated on every render, so they can't go stale.
- **Privacy:** only these fields exist. Unmapped CSV columns never reach the document.

## File Structure
```
profitpilot/
├── index.html              # app shell: sidebar, top bar, <main id="view">, SVG icon sprite, font + CSS links
├── styles.css              # design tokens (light/dark), layout, components — ported from the reference
├── print.css               # @media print layout for PDF export
├── src/
│   ├── core/               # pure logic, no DOM, no storage — all tested
│   │   ├── money.js        # cents, formatting, messy price parsing
│   │   ├── csv.js          # delimiter detection, quoted fields → rows
│   │   ├── importer.js     # header aliases, row parsing, refunds/free cuts/skips, new names, mismatches
│   │   ├── month.js        # month summary: sales, commission, kept, R/min, heatmap, daily lines, compare()
│   │   ├── tips.js         # one function per tip rule + Dashboard selection
│   │   ├── planner.js      # price planner maths
│   │   ├── reports.js      # custom filter, report rows, CSV export text
│   │   ├── reminders.js    # which banners/cards show today
│   │   └── sample.js       # seeded sample months + example CSV content
│   └── app/                # browser-only
│       ├── main.js         # start-up, update() → save → recalc → render
│       ├── router.js       # hash routes (#view/tab)
│       ├── store.js        # localStorage load/save/clear, failure handling
│       ├── ui/
│       │   ├── dom.js      # esc, toast, tooltips, tabs, in-page confirm
│       │   ├── charts.js   # SVG donut, lines, bars, heatmap
│       │   └── banners.js  # reminder banners + Monday card
│       └── views/
│           ├── dashboard.js
│           ├── sales.js    # incl. Price Planner
│           ├── costs.js
│           ├── barbers.js
│           ├── reports.js  # incl. print + CSV downloads
│           ├── import.js   # import card, New-in-this-file step, replace check, summary
│           └── settings.js
├── examples/
│   ├── sales-2026-09.csv   # generated by scripts/make-examples.mjs, committed
│   └── sales-2026-10.csv   # includes refunds, free cuts, a new service, minutes + customer columns
├── scripts/
│   └── make-examples.mjs   # writes the example CSVs from core/sample.js
├── test/                   # node --test
│   ├── money.test.js
│   ├── csv.test.js
│   ├── importer.test.js
│   ├── month.test.js
│   ├── tips.test.js
│   ├── planner.test.js
│   ├── reports.test.js
│   └── reminders.test.js
├── package.json            # "type": "module", "scripts": { "test": "node --test" }, no dependencies
├── README.md               # what it is, live link, run locally, run tests
├── .gitignore
└── devpost/                # planning docs (learner-profile.md is git-ignored)
```

## External Services and Dependencies
- **None at runtime** except the Google Fonts stylesheet (`https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap`). It's optional; with no connection, the system font is used.
- **GitHub Pages:** free static hosting with no keys and no build. [Docs](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
- **No APIs, no AI, no analytics.** Nothing about Sipho's data leaves the device.

## Important Failure Modes
- **Storage blocked, full, or in private mode** → the app runs in memory, with the banner "Can't save on this device. Changes will be lost when you close ProfitPilot." It never crashes.
- **Saved data unreadable** (corrupt JSON or an unknown version) → the app starts from the sample data and shows the toast "Saved data couldn't be read; showing sample data." It doesn't overwrite the bad data until Sipho imports or edits.
- **Misread price** (cents column, missing decimal) → sales above R5 000 are listed as "please check" in the import summary.
- **Messy or wrong CSV** →
  - **Not a CSV, or no required columns:** a plain error, with the data unchanged.
  - **Some unreadable rows:** they're skipped and listed by row number.
  - **Huge file:** imports normally; a year of rows is fine.
- **A real export with an unfamiliar heading** (e.g. "Stylist Name") → aliases match on "contains", as in the reference. If date, service or price is still missing, the error names the missing column.

## What Was Simplified and Why
All of these come from the approved scope and PRD.

- **In-app reminders instead of email/SMS.** Sending them needs a server, which breaks the local-only rule.
- **Browser print-to-PDF instead of a PDF library.** It's free, has no dependency, and works offline. The fuller version would bundle a PDF generator (about 300 KB+).
- **A CSV download instead of a real Excel (.xlsx) file.** Excel opens CSV directly.
- **One shop, shown as text instead of a shop picker.** Multiple shops is a non-goal.
- **Template-string rendering instead of a UI framework.** The page is small, and a framework would add download size Sipho pays for. The tradeoff is a full re-render per change, which is cheap at this size.

## Decisions and Open Issues
**Learner decisions**
- **Plain HTML/CSS/JS with ES modules, tested with `node --test`.** Reasons: mobile-data cost, the closest match to the design, the same stack as the previous apps.
- **Own CSV parser, a test for each case.** It's the main learning goal. The cases: delimiter detection, quoted fields with commas, header aliases, date formats, `R1 200,00` and `1,200.00`, refunds, free cuts, unknown columns ignored.
- **GitHub Pages public link** so judges can try it.
- **`localStorage`, one JSON document, under the namespaced key `profitpilot-barber.v1`**, with storage failures handled gracefully.

**Implementation details derived from those decisions**
- Money in integer cents.
- Dates as plain numbers, not `Date` objects.
- Sales as compact arrays.
- Sample data regenerated, not stored.
- Hash routing.
- One `update()` cycle for every change.

**The learner's useful unknown: separators in messy prices.** `R1 200,00` and `1,200.00` are both the same R1 200, but `1,200` alone could mean twelve hundred or one point two.
- **Proposed rule** (in `core/money.js`): a `,` or `.` followed by exactly 1–2 digits at the end is the decimal mark; anything else is a thousands separator. So `1,200` → R1 200, `120,5` → R120.50, `1.200,00` → R1 200.
- **Evidence:** a test for each of these cases in `money.test.js`.
- **Check during the build:** if a real export contradicts this, the test documents the decision. *Confirmed by the learner at review.*

**Resolved at review**
- **Price rule:** confirmed, and extended with a leading `R` and any kind of space, negatives in three notations as refunds, and the R5 000 "please check" sanity check. Each has a test.
- **Demo gap:** chose option (a). The example sheet brings labelled example costs; real files keep the PRD's empty-then-copied costs.
- **Edits to sample data** lasting one session only: accepted.

**Still open:** none.
