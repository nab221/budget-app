# Company tab — corporation tax on dividends: design

**Date:** 2026-09-12
**Status:** approved by owner (brainstorm 2026-09-12), not yet implemented
**Spec:** amends `REFACTOR-SPEC.md` (amendment 2026-09-12 (j)); no schema change

## 1. Purpose

Both people in the app draw dividends from the same limited company. A dividend can
only be paid out of profit **after** corporation tax (CT), so every dividend drawn
implies a larger profit that has to be earned, and a slice of CT that has to be set
aside. The owner's rule of thumb so far — *"£10k profit: draw £8k, keep £2k for CT"* —
is close in the small-profits band (the real rate is 19%, so £8,100 and £1,900) and
wrong once the company passes £50k profit in a year, where **marginal relief** makes
each extra pound of profit cost 26.5%, i.e. **36p of CT per £1 of dividend**, not 20p.

The Company tab answers two questions at any point in the company year:

1. Given the dividends drawn so far, what profit does that imply and how much CT must
   be set aside?
2. If I draw £X more, how does that picture change — for the company *and* for the
   person drawing it?

### The CT rules modelled (Financial Year 2023 onward)

| Profit in the accounting period | Rate |
|---|---|
| Up to **£50,000** | **19%** small profits rate |
| **£250,000** and above | **25%** main rate |
| Between | 25% less marginal relief of **3/200 × (£250,000 − profit)**, an effective **26.5%** on each pound in the band |

CT is assessed on the company's **accounting period**, not the personal tax year. The
owner confirmed the company's year-end is **31 March**, so a company year runs
1 April – 31 March and sits inside exactly one HMRC financial year (no rate
apportionment across two FYs). CT is payable **9 months and 1 day** after year-end.

Written-in assumptions (owner's model, per the "simpler option" rule):

- **Profit = dividends + CT.** Every pound of post-tax profit is distributed. No
  retained reserves from earlier years, no losses brought forward, no salaries or
  expenses (they are already netted off before the profit this screen reasons about).
- **One company, no associated companies**, so the £50k / £250k limits are not divided.
- **A full 12-month period**, so the limits are not pro-rated.

## 2. Screen

A new top-level **Company** tab, after Mileage.

**Header** — "Company" plus a year navigator (‹ / › / Today) in the Income/Mileage
style, but stepping on the **1 April** boundary and labelled by financial year:
*FY2026 · 1 Apr 2026 – 31 Mar 2027*. A banner flags a year whose rates fell back to the
nearest known table, as the other tabs do.

**Summary panel** (always shown; reads as zeros with no dividends):

- **KPI row** — dividends drawn · **CT to set aside** · profit required
  (dividends + CT) · effective CT rate.
- **Band meter** — profit required against the £50k small-profits limit and the £250k
  main-rate limit, with one line under it: *"Next £1 of profit is taxed at 19% —
  ≈ £X more dividends before the marginal band"*, or the marginal / main-rate
  equivalents once crossed. The dividend headroom is the profit gap × 81%.
- **Set-aside rate** — pence of CT per £1 of dividend, both the year's average and
  the marginal figure for the next pound (23.5p in the small band, 36.1p in the
  marginal band, 33.3p at the main rate).
- **CT due** hint — the payment date (1 January after year-end).
- **Per-person split** — a small table: name, dividends drawn, share of the total.

**Dividend ledger** — every `dividend` income event dated inside the company year,
from both people, newest first: date, person, amount, note, with edit and delete.
These are the **same rows the Income tab shows**; editing here updates there, so the
two tabs can never disagree. A **Record dividend** button opens a person picker plus
the existing dividend event form. Empty state when there are no people yet points to
the Income tab.

**Draw calculator** — a panel with three inputs: **amount**, **who draws it** (person
picker, default the first person), and **date** (default today if inside the viewed
company year, else the year's first day). It is transient UI state, never stored.
With an amount entered it shows:

- **Company side, before → after:** dividends, profit required, CT, effective rate.
  Then the answer in one sentence: *"This draw adds £Y of CT — set aside £Y; the
  company needs £X+Y of profit to fund it."* The CT rate on the extra profit is shown
  (blended if the draw straddles a band edge), and a warning when the draw takes the
  year past the £50k line.
- **Personal side, before → after,** for the chosen person in the **personal tax
  year containing the date** (6 Apr – 5 Apr, which is not the company year): extra
  personal tax via Self Assessment, net in hand after both taxes, headroom to the
  40% band, and whether it crosses the £100k line. The extra personal tax is the
  change in the person's *total* tax, so it includes any personal-allowance taper
  the draw triggers, not just the dividend rate.
- **Combined:** of the £X+Y of profit, how much is CT, how much is personal tax, and
  how much lands in the person's pocket.
- A **Record this dividend** button writes the event (person, date, amount) and clears
  the calculator.

With no people recorded the calculator is disabled with a hint.

## 3. Engine — `src/engine/corporation-tax.js`

Pure, tested, integer pence, no DB or clock. Mirrors the `TAX_YEAR_TABLES` pattern from
`tax.js` so a Budget change lands as a new entry rather than an edit.

```js
export const CT_TABLES = {
  FY2023: { smallRate: 0.19, mainRate: 0.25,
            lowerLimitPence: 5_000_000, upperLimitPence: 25_000_000,
            marginalReliefFraction: 3 / 200 },
  FY2024: { …same… }, FY2025: { …same… }, FY2026: { …same… },
};
```

Every year from FY2023 is seeded explicitly (the fallback only handles years outside
the known range, like `taxYearTable`). A year before FY2023 falls back to FY2023 and
the UI shows the fallback banner — the flat-19% era is out of scope.

### Financial-year helpers

- `financialYearForDate(isoDate)` → `"FY2026"` for any date 1 Apr 2026 – 31 Mar 2027.
- `financialYearBounds(label)` → `{ startDate: '2026-04-01', endDate: '2027-03-31' }`.
- `shiftFinancialYear(label, delta)`, `financialYearTable(label)` →
  `{ table, tableYear }`.
- `ctPaymentDate(label)` → ISO date of 1 January following year-end.

### Core functions

- `corporationTax(profitPence, table)` → `{ taxPence, band, marginalRate,
  effectiveRate, reliefPence }`.
  `band` is `'small' | 'marginal' | 'main'`. In the marginal band
  `reliefPence = round(fraction × (upper − profit))` and
  `taxPence = round(mainRate × profit) − reliefPence`, the HMRC formula. Rounded to
  the penny at the end, never mid-way.
- `profitForNetDividends(netPence, table)` → the smallest integer profit `P` such
  that `P − corporationTax(P) ≥ net`. Closed form per band, then nudged by at most a
  few pence to satisfy the inequality after rounding:
  - small: `P = net / (1 − small)`, valid while `P ≤ lower` (net ≤ £40,500);
  - marginal: `P = (net − fraction × upper) / (1 − main − fraction)`, valid up to
    `P < upper` (net < £187,500);
  - main: `P = net / (1 − main)`.
- `buildCompanyYear({ dividendEvents, people, table })` → totals
  `{ dividendPence, profitPence, ctPence, effectiveRate, band, marginalRate,
  averageSetAsidePerPound, marginalSetAsidePerPound, headroomProfitPence,
  headroomDividendPence }` plus `perPerson: [{ personId, name, dividendPence,
  share }]` and the ledger `events` (newest first, each with `personName`).
- `previewDraw({ year, extraDividendPence, table })` → `{ before, after,
  extraCtPence, extraProfitPence, rateOnExtraProfit, crossesLowerLimit,
  crossesUpperLimit }` where `before`/`after` are `buildCompanyYear`-shaped totals.

### Decisions

- **Dividends define profit, not the other way round.** The owner enters what was
  drawn; the engine inverts the CT formula to find the profit that leaves exactly that
  net. This is the whole point of the screen and why the inverse is a first-class
  function with its own tests.
- **Personal figures come from the Income engine, unchanged.** The calculator takes
  the person's existing `input` for the relevant tax year, adds the draw to
  `dividendPence`, and calls `computePersonTax` again. No dividend-tax logic is
  duplicated in this module.
- **Two different years on one screen, deliberately.** The company side is FY (1 Apr),
  the personal side is the tax year (6 Apr) containing the draw date. The calculator
  labels both so a draw on 3 April is visibly "FY2025 for the company, 2025-26 for
  you".

## 4. Data — `src/db/companyData.js`

No schema change, no new settings, no new stores. The 31 March year-end is a constant
in the engine. Nothing computed is persisted.

- `gatherCompanyData(fyLabel)` — reads `peopleRepo.getAll()` and
  `incomeEventsRepo.between(startDate, endDate)` filtered to `kind === 'dividend'`,
  converts pounds → pence at this edge (the `mileageData.js` pattern), and returns
  `{ financialYear, tableYear, startDate, endDate, table, people, …buildCompanyYear }`.
- `previewPersonalDraw({ personId, amountPence, date })` — calls
  `gatherIncomeData(taxYearForDate(date))`, finds the person, recomputes
  `computePersonTax` with the extra dividend, and returns `{ taxYear, before, after,
  extraTaxPence, netInHandPence }`.

Writes go through the existing `incomeEventsRepo` (add / update / delete), so the
Company tab's ledger and the Income tab's event lists are one data set.

## 5. Files

| File | Role |
|---|---|
| `src/engine/corporation-tax.js` | CT tables, FY helpers, tax + inverse, year build, draw preview (+ `corporation-tax.test.js`) |
| `src/db/companyData.js` | pounds → pence adapter for the company year; personal-side preview (+ `companyData.test.js`) |
| `src/ui/Company.jsx` | the tab: navigator, dialogs, wiring |
| `src/ui/company/CompanySummary.jsx` | KPIs, band meter, set-aside rates, CT due, per-person split |
| `src/ui/company/DividendLedger.jsx` | the year's dividend events, edit / delete |
| `src/ui/company/DividendForm.jsx` | person picker wrapped around the existing `income/EventForm` (kind `dividend`) |
| `src/ui/company/DrawCalculator.jsx` | amount / person / date; company, personal, and combined before → after; record button |
| `src/ui/company/companyRender.test.jsx` | tab integration test |
| `src/App.jsx` | registers the tab |
| `specs/REFACTOR-SPEC.md` | amendment (j) |

## 6. Tests

- **Engine** — known HMRC figures: £10,000 → £1,900; £50,000 → £9,500;
  £100,000 → £22,750; £150,000 → £36,000; £250,000 → £62,500; £300,000 → £75,000.
  Inverse round-trips at and either side of both limits (net £40,500 → £50,000;
  net £187,500 → £250,000), and the "smallest P with P − CT ≥ net" property on a
  sweep of nets. FY helpers on 31 March / 1 April boundaries. `previewDraw` for a draw
  that stays in the small band, one that crosses £50k (blended rate), and one in the
  main band.
- **Adapter** — on the in-memory Dexie: dividends from two people are pooled; a
  dividend dated 5 April lands in the earlier FY; non-dividend events are ignored;
  `previewPersonalDraw` picks the tax year from the date and its `extraTaxPence`
  matches a direct `computePersonTax` diff.
- **Tab render** — empty state with no people; summary + ledger with seeded events;
  calculator shows before → after and the set-aside sentence; Record writes an event.

## 7. Non-goals

- Associated companies, short or long accounting periods, rate apportionment across
  two financial years — the 1 April – 31 March year makes the last unnecessary.
- Retained profit, losses, salaries from the company, expenses: profit here is
  defined as dividends + CT.
- Employer NI, dividend vouchers, CT600 filing, HMRC payment — the due date is a hint
  only, in keeping with "no HMRC filing or export".
- A configurable year-end. If it is ever needed, it becomes one setting and the FY
  helpers take a `yearEnd` argument; nothing else changes.
