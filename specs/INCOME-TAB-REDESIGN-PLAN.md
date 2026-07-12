# Income tab redesign — salary timeline + monthly payslips

Status: **plan for owner review** — supersedes the "no monthly payslip logging" owner
decision of 2026-07-07 (REFACTOR-SPEC amendment (b)). Nothing here is built yet.

## 1. Why

The current model stores **one fixed annual salary per person** and assumes it holds
for the entire tax year. The owner's real pay this year has: a pay raise, a reduction
to less-than-full-time, and an upcoming new contract. A single annual figure cannot
represent any of that, and the one-off "salary adjustment" events are the wrong tool
for a *rate change* (you'd have to hand-compute the cumulative correction every month).

Two ideas fix it together:

1. **Salary rate timeline** — the annual figure becomes *"£X per year from date D"*.
   A raise, an LTFT step-down, or a new contract is just a new dated entry. The engine
   pro-rates each stretch across the tax year.
2. **Monthly payslip log** — for each month you can enter the actual taxable pay from
   the payslip. Entered months use actuals; months without a payslip are projected
   from the rate timeline. The year figure — and the £50,270 / £100,000 meters — then
   always sit on the most-updated track.

## 2. Owner decisions (proposed defaults — confirm or override)

These were posed as questions; the interactive dialog could not be delivered, so the
recommended option is taken as the working default. **Any of these can be flipped
before implementation.**

| # | Question | Default taken |
|---|---|---|
| 1 | How much detail per payslip entry? | **One number per month**: the month's *taxable pay* (the payslip figure that already reflects LTFT, salary sacrifice, and net-pay pension), plus an optional note. |
| 2 | How are un-entered months estimated? | **Rate timeline + payslip overrides**: months with a payslip use the actual; all other months use the annual rate in force that month (so a known future contract change is anticipated before its first payslip). |
| 3 | Fate of "salary adjustment" events? | **Folded into the months**: a past bonus / unpaid-leave month is already inside that month's real payslip; a known *future* one-off is entered as a planned amount on that future month. The "Add salary adjustment" button goes away; existing adjustment rows keep counting until deleted (no data loss). |
| 4 | Card layout? | **Month grid with running total**: an Apr–Mar table per person — each month shows its figure, an *actual / planned / projected* badge, and a cumulative-income column so you can watch yourself approach the two thresholds month by month. Click a month to enter or edit its payslip. |

Also assumed (flag if wrong):

- **Monthly pay only** (NHS-style). No weekly/4-weekly payslips.
- A month's payslip belongs to the tax year of its **calendar month** (April payslip →
  new tax year). Documented simplification, same spirit as the existing tax engine notes.
- The wife's card keeps working with **no payslips at all** — her timeline (one rate
  entry, her car-scheme sacrifice) projects all 12 months, exactly like today's annual
  model. Payslip entry is optional per person.
- Pension, benefits-in-kind, and other income stay **annual fields on the person**
  (they feed adjusted net income as now). Salary sacrifice moves onto the rate
  timeline, because a contract change can change it.
- No payslip PDF import/OCR (stays a non-goal). Manual entry is one number per month.

## 3. Data model (schema v4 — additive, follows the v3 pattern)

| Table | Fields (indexed → `*`) |
|---|---|
| `salaryPeriods` | `*id`, `*personId`, `*effectiveFrom` (ISO date), `annualSalaryPence`, `salarySacrificePence`, `note` |
| `payslips` | `*id`, `*personId`, `*month` (`yyyy-MM`, unique per person+month), `taxablePence`, `note` |

- `people` keeps `pensionAnnualPence`, `benefitsInKindPence`, `otherIncomePence`.
  `annualSalaryPence` / `salarySacrificePence` stop being written (kept in the schema
  for backup compatibility, ignored by the engine once a person has periods).
- **Upgrade migration**: for each existing person with a salary, create one
  `salaryPeriods` row effective from `1900-01-01` carrying their current salary +
  sacrifice — the app behaves identically to today until the owner adds a dated change.
- `incomeEvents` unchanged: dividends work exactly as now; legacy `salary-adjustment`
  rows remain counted (added to the year's non-dividend income) but can no longer be
  created.
- Both new tables join `TABLE_NAMES` so backup/wipe cover them automatically. Money is
  pounds at the repository edge, integer pence at rest and in the engine, as everywhere.

## 4. Engine (`src/engine/tax.js` + new `src/engine/salaryTimeline.js`)

New pure module `salaryTimeline.js`:

- `monthsOfTaxYear(label)` → the 12 `yyyy-MM` slots Apr…Mar.
- `rateForMonth(periods, month)` → the period in force (latest `effectiveFrom` ≤ the
  month), pro-rated **by day** when a change lands mid-month.
- `buildMonthlyPay(periods, payslips, taxYear)` → 12 rows
  `{ month, pence, source: 'actual' | 'planned' | 'projected' }`
  - payslip row for a past/current month → `actual`
  - payslip row for a future month → `planned` (the pencilled bonus case)
  - no payslip → `projected` from the timeline
  - plus a `cumulativePence` running total.

`buildPersonYearInput` gains the monthly path: `salaryPence` = sum of the 12 rows
(replacing `annual − sacrifice`); adjustments/dividends/pension/BIK/other fold in
exactly as today. `computePersonTax` is **untouched** — the band/taper/dividend maths
is already correct and tested; only its input assembly changes.

## 5. UI

- **PersonCard** gains the month grid (§2 Q4): Month · Pay · badge · Cumulative ·
  Edit. The current month with no payslip gets a gentle nudge state ("enter July's
  payslip"). Threshold meters, tax split, and the dividend list are unchanged.
- **Salary timeline editor** ("Change salary…" on the card): a list of dated rate
  entries (from-date, annual salary, sacrifice/year, note) with add/edit/delete and
  plain-English hints ("enter the new full-year rate — the app pro-rates the
  part-year automatically", "for less-than-full-time enter the reduced annual rate,
  not the percentage").
- **PersonForm** slims down to name + pension + BIK + other income; salary moves to
  the timeline editor.
- **Payslip form** (click a month): amount (taxable pay for the month) + optional
  note; pre-filled with the projected figure so a normal month is *confirm-and-save*.
- "Add salary adjustment" button removed; legacy adjustment rows still listed with
  edit/delete.
- Dashboard Z6 strip needs no change (it mirrors `computePersonTax` output).

## 6. Build order

1. **Engine**: `salaryTimeline.js` + tests (proration incl. mid-month change, leap
   Feb, empty timeline, future planned payslip); `buildPersonYearInput` monthly path +
   tests.
2. **DB**: schema v4, repos (`salaryPeriodsRepo`, `payslipsRepo` with per-person-month
   upsert), upgrade migration + tests, backup round-trip test.
3. **Data adapter**: `gatherIncomeData` gathers periods + payslips, returns the
   12-row grid per person; tests.
4. **UI**: month grid, timeline editor, payslip form, PersonForm slim-down; render
   tests.
5. **Spec**: fold the confirmed decisions into REFACTOR-SPEC as amendment (c), marking
   the 2026-07-07 "no monthly payslip logging" line superseded.

## 7. Non-goals

No NI / student loans (unchanged), no payslip OCR or PDF import, no weekly pay
frequencies, no per-payslip tax-paid reconciliation (owner can opt into decision #1's
fuller variant later — the schema extends without migration pain), no changes to
dividends, childcare, or the dormant `incomeSources` cashflow table.
