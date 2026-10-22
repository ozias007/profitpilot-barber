# ProfitPilot Barber

A dashboard for small barber shop owners who don't know which services, days and barbers actually make them money.

Import a month of sales from a CSV and ProfitPilot shows:

- **money kept**: sales minus every cost, including each barber's commission;
- **earnings per chair-minute** for each service;
- **busy hours** by weekday and time slot;
- where the money went, with unusual cost increases flagged;
- plain-language tips worked out by simple, tested rules.

There's no AI and no server, and nothing is uploaded: everything runs and is saved in the browser on your own device.

**Live app:** https://ozias007.github.io/profitpilot-barber/

**Source:** https://github.com/ozias007/profitpilot-barber

## Try it

1. Open the app. The first visit shows a made-up shop ("The Fade Room") with two sample months.
2. Go to **Reports** and tap **Try with an example sheet**. It loads September and October 2026 with example costs.
3. In **Costs**, set October's electricity to `2760`. An "Electricity up 38%" alert appears, and Money Kept drops by exactly R760.
4. In **Sales & Services › Price Planner**, try Kids Cut at R80 on Saturdays.

To try the real import, download [`examples/sales-2026-10.csv`](examples/sales-2026-10.csv) and choose it in **Reports › Choose a CSV file**. It's deliberately messy:

- semicolons, day-first dates and `R 120,00` prices;
- refunds and free cuts;
- a new service, and a customer column that is never saved.

## Run it locally

You need [Node.js](https://nodejs.org/) 20 or newer (built and tested on 24). There are no dependencies to install.

```
npm start      # http://localhost:8000
npm test       # node --test: CSV parsing, money maths, tips, planner, reports, reminders, saving
```

`npm start` serves the folder with caching turned off, on this computer only. Run `HOST=0.0.0.0 npm start` to try it on your phone over Wi-Fi.

## How it's built

Plain HTML, CSS and JavaScript modules, with no framework and no build step. The whole app is about 55 KB to download (compressed), which matters on prepaid mobile data.

- **`src/core/`** is the pure logic (money in cents, CSV reading, the month maths, tips, the planner, reports, reminders). It never touches the screen and is fully covered by `test/`.
- **`src/app/`** is the screens. Every change goes through one cycle: change → save → recalculate → redraw.
- **Saving:** one JSON document in `localStorage` under the key `profitpilot-barber.v1`. Only date, time, barber, service, price and minutes are ever stored from an import.

The planning documents behind it (scope, product requirements, technical spec and build checklist) are in [`devpost/`](devpost/).
