---
doc: scope
status: approved
---

# ProfitPilot Barber

A dashboard that shows a small barber shop owner which services, days and barbers actually make them money. It works from a month of sales, all on their own device.

## The Unique Kernel
**Money kept** and **earnings per chair-minute** (price ÷ minutes in the chair), worked out from a month of real sales. An owner can't see either of these today. The CSV import feeds everything, so it's part of the kernel too.

## Who It's For
**Sipho, 38.** He owns a 5-chair barber shop in Soweto, and his barbers work on commission. His takings come from a card machine plus cash. On the 1st of the month he *guesses* whether it was a good month. He knows Saturdays are busy. He doesn't know which services or barbers actually make him money, or why his costs crept up.

## The Core Loop
1. On the 1st, Sipho imports last month's sales CSV.
2. He sees what he kept and which services earn the most per chair-minute.
3. He updates the month's costs and reads the plain-language tips.
4. He tries a change, such as a new price or a commission rate, before he makes it.

He comes back every month to compare it with the last one.

## Inspiration & Identity
- **Design reference:** `C:\DevPost\design\profitpilot-dashboard.html`. Match it 1:1, but don't paste its code.
  - Dark navy sidebar with a barber-pole brand and white cards.
  - Plus Jakarta Sans font, amounts in rand (R).
  - Light and dark mode, and a phone layout.
- **Tone:** plain language for a busy owner, no finance jargon. Motto: "Small changes make big differences."
- The reference is a working in-memory prototype. Things it doesn't have that the build must add:
  - saving data on the device;
  - tested maths, kept separate from the screens;
  - insights computed from the data (some are hard-coded in the reference);
  - real behavior behind its placeholder buttons.

## Why This Matters to the Learner
"I work in the financial advisory sector and see how many small business owners can't tell which part of their business actually makes money."

**Learning goals:**
- robust CSV parsing of messy real exports (different column names, date formats, semicolons);
- plain-language tips from simple, testable rules instead of AI.

## What "Working" Looks Like
1. Sipho opens ProfitPilot and sees the example month.
2. He taps **Import sales** and drops in his October CSV. The dashboard switches to his numbers: money kept, which service earns most per chair-minute, and when Saturdays are full.
3. He opens **Costs** and types his real electricity bill. The "Electricity up 38%" alert appears, and money kept drops by exactly that amount.
4. In the **Price Planner** he tries kids cuts at R80 on Saturdays and sees "+R330 a month."

(The exact figures depend on the data and are illustrative.)

**Finish line:** import a real-looking CSV, every number updates correctly, and editing a cost or price changes the totals by the exact amount.

## The POC Boundary
The full design, built 1:1, in this order so the core works early:

1. **CSV import, example data and the Dashboard.** The Dashboard covers money kept, per-minute earnings, the busy-hours heatmap, where the money went, and insights. Light/dark mode (colour tokens) and the responsive phone layout are built here too, as the foundation for every later screen.
2. **Costs** (with editing) and **Barbers** (with commission editing).
3. **Sales & Services** (with service editing and the price planner).
4. **Reports** (all four tabs) and **Settings** (all five screens).

**Rules that apply throughout:**
- All maths lives in code with tests.
- No AI and no API.
- Data stays on the device and is saved locally.
- Example data loads on the first visit, so the dashboard is never empty.
- **Imports keep only what the app needs:** date, time, barber, service, price and minutes. Any other column is never stored, including customer names and phone numbers.

**The design's placeholder buttons become real** where it's cheap and works without a server. No button may do nothing.
- **Export PDF:** the browser's print-to-PDF, with a clean print layout for each report.
- **Excel downloads:** a CSV download, which opens in Excel.
- **Shop details:** real editing, saved on the device.
- **Notifications:** real in-app reminders, saved on the device. Examples: a banner on the 1st saying "Import last month's sales", and the cost-jump alert.
- **Weekly summary:** an in-app summary card on Mondays.
- **Shop picker:** shows the shop name only, with no dropdown.

## Later
- **Slice 4** (Reports and Settings) moves here if time runs out. The core slices stay, along with light/dark mode and the phone layout.
- Email and SMS reminders.

## Explicitly Cut
- **Multiple shops.** This version has one shop, so the shop dropdown goes.
- **Email/SMS delivery.** It needs a server, which breaks the "no API, data stays on the device" rule.
- **Any AI-generated advice.** Tips are rule-based by design.
