# Pension tab — annual allowance with defined-benefit input amounts: design

**Date:** 2026-09-15
**Status:** implemented
**Spec:** amends `REFACTOR-SPEC.md` (amendment 2026-09-15 (k)); schema v8 (additive)

## 1. Purpose

Both people are in **defined-benefit** public-sector pensions: the owner in the
**NHS 2015** scheme, their wife in the **LGPS 2014** scheme (both joined after their
scheme's career-average start, so no final-salary tranche). The owner also intends to
contribute to a **SIPP** without breaching the pension **annual allowance** (AA).

The allowance meter added by amendment (g) measures NHS use as the employee
contributions on the payslips. That is the defined-*contribution* rule and is wrong
for a defined-benefit scheme, where HMRC measures the **pension input amount** (PIA):
the growth in the accrued annual pension over the year, with the opening value uprated
by CPI, multiplied by 16. For an NHS salary the PIA is several times the contributions.
The meter also states that carry-forward is not tracked, and unused allowance from the
three previous tax years is exactly what makes a large SIPP contribution safe.

The Pension tab answers, for any tax year and each person:

1. How much of the allowance is used — NHS/LGPS input amount plus grossed-up SIPP?
2. How much unused allowance carries forward from the three previous years?
3. **How much more can go into a SIPP** — as a gross figure and as the net payment
   actually made?

The owner's own reconstruction (Claude chat, 2026-09-15, from the NHS Total Reward
Statement) is the acceptance data:

| Tax year | Opening pension | CPI uplift | Closing pension | PIA (×16) | AA |
|---|---|---|---|---|---|
| 2021/22 | £1,960.53 | 0.5% | £2,809.82 | £13,432 | £40,000 |
| 2022/23 | £2,809.82 | 3.1% | £3,647.64 | £12,012 | £40,000 |
| 2023/24 | £3,647.64 | 10.1% | £4,957.27 | £15,060 | £60,000 |
| 2024/25 | £4,957.27 | 6.7% | £6,447.70 | £18,533 | £60,000 |
| 2025/26 | £6,447.70 | 1.7% | £7,900.18 | £21,486 | £60,000 |

Carry-forward into 2026/27 = £44,940 + £41,467 + £38,514 = **£124,921**. For 2026/27
(CPI 3.8%, opening £7,900.18) the estimate is **£1,896 + 0.296 × pensionable
earnings**, e.g. ≈ £22,600 on £70,000.

### The rules modelled

- **Pension input amount** (DB): `16 × (closing − opening × (1 + CPI))`, where CPI is
  the September figure before the tax year starts. No lump-sum term (2015 NHS and
  2014 LGPS have none).
- **Career-average accrual and revaluation**, applied at the start of each tax year:

  | Scheme | Accrual per year | In-service revaluation |
  |---|---|---|
  | `nhs-2015` | pensionable earnings ÷ **54** | CPI + **1.5%** |
  | `lgps-2014` | pensionable earnings ÷ **49** | CPI + **0%** |

  `closing = opening × (1 + CPI + real) + earnings ÷ accrual`. Because the AA uplift
  uses the same CPI, the estimate collapses to `16 × (real × opening + earnings ÷
  accrual)` — £1,896 + 0.296 × earnings for the owner; simply `16 × earnings ÷ 49`
  for LGPS. The engine computes the full form and rounds once, so the collapse is a
  test, not an assumption.
- **Annual allowance**: £40,000 up to 2022/23, £60,000 from 2023/24 (already in
  `TAX_YEAR_TABLES` for the seeded years).
- **Allowance used** = PIA + grossed-up personal contributions (the annual
  personal-pension field + `sipp-contribution` events × 1.25, exactly the Income
  engine's `pensionPence`).
- **Carry-forward**: unused allowance from the three previous tax years, consumed
  oldest first once the current year's own allowance is used up.

Written-in assumptions (owner decisions, "simpler option" rule):

- A prior year that itself exceeded its allowance contributes **zero** carry-forward;
  the engine does not chase further back to see what that year borrowed.
- A year with **no data** (no entered PIA and no estimate) contributes zero — the
  conservative reading.
- The **high-income taper** is not computed. The tab warns when adjusted net income
  passes **£200,000** (HMRC's threshold-income line) so the £60,000 figure is not
  trusted blindly.
- The scheme year (1 April – 31 March) is treated as the pension input period
  (6 April – 5 April): the five-day gap is ignored.
- Revaluation is modelled at the **post-April-2022 timing** (applied on 6 April, inside
  the input period, using the September CPI before that date). Before 2022 the NHS
  applied it on 1 April, outside the period, so the engine never estimates 2021-22 or
  earlier — those years are entered, and they drop out of every carry-forward window
  from 2025-26 onward anyway.

## 2. Engine — `src/engine/pension.js`

Pure, tested, integer pence, no DB or clock. Mirrors the `TAX_YEAR_TABLES` pattern: a
Budget or a new September CPI lands as a table row, not an edit.

```js
export const SCHEMES = {
  'nhs-2015': { label: 'NHS 2015', accrualDenominator: 54, realRevaluation: 0.015 },
  'lgps-2014': { label: 'LGPS 2014', accrualDenominator: 49, realRevaluation: 0 },
};

// September CPI, keyed by the tax year it uprates (the September BEFORE it starts).
export const SEPTEMBER_CPI = {
  '2019-20': 0.024, '2020-21': 0.017, '2021-22': 0.005, '2022-23': 0.031,
  '2023-24': 0.101, '2024-25': 0.067, '2025-26': 0.017, '2026-27': 0.038,
};

export const TAPER_THRESHOLD_INCOME_PENCE = 20_000_000; // £200,000
export const PIA_FACTOR = 16;
export const RELIEF_AT_SOURCE_GROSS_UP = 1.25;
```

### Helpers

- `cpiForYear(label)` → the rate or **null** when the year is not seeded. No fallback:
  a wrong CPI silently mis-states the estimate, so a missing year switches the estimate
  off and the UI shows the fallback banner instead.
- `annualAllowanceForYear(label)` → the allowance for the year; `fromTable` is true for
  every year up to the newest seeded tax-table year (£40,000 before 2023-24 and £60,000
  from then on are known facts) and false only for later, unknown years, which is what
  the fallback banner and the `*` marker report.
- `anchorOpeningYear(anchorDate)` → the tax year the anchor OPENS: the statement figure
  is the value at the end of the tax year containing the date (31 March 2026 → end of
  2025-26 → opens `2026-27`).

### Core functions

- `rollForward({ scheme, anchorPence, anchorOpeningYear, targetYear, cpiByYear,
  earningsByYear })` → `{ openingPence, chain: [{ taxYear, openingPence, closingPence,
  cpi }] } | null`. Steps one tax year at a time from the anchor's opening year to
  `targetYear`, `closing = round(opening × (1 + cpi + real) + earnings ÷ denominator)`,
  rounding once per year. Null when `targetYear` is before the anchor's opening year,
  before `2022-23`, or any CPI in the chain is missing.
- `estimatePia({ scheme, openingPence, cpi, earningsPence })` →
  `{ closingPence, upratedOpeningPence, piaPence }`, the full formula, rounded once.
- `buildPensionYear({ taxYear, scheme, anchor, rows, earningsByYear, sippGrossByYear })`
  → the four-year window and the verdict:

  ```js
  {
    taxYear, scheme,
    years: [ // taxYear−3 … taxYear, oldest first
      { taxYear, allowancePence, allowanceFromTable,
        piaPence, piaSource: 'entered' | 'estimate' | 'none',
        estimate: { openingPence, cpi, closingPence, earningsPence, earningsSource } | null,
        sippGrossPence, usedPence, unusedPence, carriedPence }
    ],
    current: /* the last entry */,
    carryForwardPence,        // sum of prior unused, after the current year's excess eats it oldest-first
    totalAvailablePence,      // current allowance + carry-forward before this year's use
    headroomGrossPence,       // what can still go in, gross
    headroomNetPence,         // headroomGross ÷ 1.25 — the payment actually made
    over, chargeablePence,    // excess beyond allowance + carry-forward
    cpiMissing: [labels],     // years whose estimate was switched off — an anchor that
                              // opens before 2022-23 produces no estimate and is NOT a
                              // CPI gap — the card says so
  }
  ```

  Per year, `piaPence` is the entered figure when the row has one, else the estimate
  when the roll-forward reaches that year, else null with source `'none'`. For a scheme member such a year is unknown and contributes zero unused allowance (§1); for a person with no scheme it is complete on SIPP data alone, so unused = allowance − SIPP, never negative.

### Decisions

- **The user enters an anchor, not a balance per year.** One accrued-pension figure
  and its date from the annual statement; the engine rolls it forward. Next year the
  owner replaces the anchor with the new statement figure and the chain restarts from
  there, so estimates never drift more than one year from an official number.
- **Entered beats estimate, always.** When a Pension Savings Statement (or the owner's
  own reconstruction) gives a figure, it is the figure; the estimate is shown beside it
  for reference only.
- **Personal contributions reuse the Income engine's definition.** The annual
  personal-pension field is treated as paid in every year of the window; SIPP events
  count in the tax year of their date, grossed up ×1.25. No second definition.
- **`computePensionAllowance` in `tax.js` is deleted** (with its tests). The Income
  card's meter reads the pension engine's `current.usedPence` / `headroomGrossPence`
  through the adapter, so the two tabs can never disagree.

## 3. Data — schema v8, additive

- **`people`** gains three non-indexed fields (no index change, but bundled into the v8
  bump for clarity): `pensionScheme` (`''` | `'nhs-2015'` | `'lgps-2014'`),
  `pensionAnchorPence` (integer pence; pounds at the repo edge), `pensionAnchorDate`
  (ISO or `''`). Rows without them read back as `''` / 0 / `''` → SIPP-only tracking.
- **New store `pensionYears`**: `'++id, personId, taxYear, &[personId+taxYear]'`.
  Fields: `personId`, `taxYear` (`"2025-26"`), `piaPence` (integer pence or **null**
  = not entered), `pensionableEarningsPence` (integer pence or null = use the timeline),
  `note`. USER-ENTERED rows only — the statement figure and an earnings override — so
  the "never persist computed rows" rule is untouched. Added to `TABLE_NAMES` (backup /
  wipe pick it up automatically).
- **Repositories**: `pensionYearsRepo` (base repo with the pence fields listed for the
  pounds edge; nulls pass through untouched) plus `forPerson(personId)` and
  `upsert(personId, taxYear, data)`. Validation: `taxYear` matches `/^\d{4}-\d{2}$/`,
  pence fields null or ≥ 0. `peopleRepo.delete` also deletes the person's
  `pensionYears` rows in its transaction. `peopleRepo` gains the three new fields in
  its allow-list and defaults.
- **Pensionable earnings estimate**: `salaryTimeline.js` gains
  `projectedYearSalaryPence(periods, taxYear)` — the 12 months' day-weighted
  **annual salary ÷ 12**, before sacrifice, workplace pension and BIK (the same
  blending as `projectedMonthPence`, different rate). Payslips carry no pensionable pay,
  so actuals never override; the per-year `pensionableEarningsPence` field does.
- **Adapter `src/db/pensionData.js`**: `gatherPensionData(taxYear)` reads
  `peopleRepo.getAll()`, `salaryPeriodsRepo.getAll()`, `pensionYearsRepo` rows, and
  `incomeEventsRepo.between(start of taxYear−3, end of taxYear)`; converts pounds →
  pence at this edge; groups SIPP events by `taxYearForDate`; builds
  `earningsByYear` from the timeline (override where a row has one, from the anchor's
  opening year to `taxYear`); returns `{ taxYear, people: [{ id, name, scheme, anchor,
  rows, earningsByYear, ...buildPensionYear }] }`. Nothing persisted.
- **`gatherIncomeData`** calls `gatherPensionData(taxYear)` and attaches each person's
  result as `entry.pension` (replacing `entry.pensionAllowance`). The Pension tab reads
  `gatherIncomeData` too — it needs `summary.adjustedNetIncomePence` for the taper
  warning, and one read path keeps the two tabs on identical figures.

## 4. Screen — Pension tab, after Company

**Header** — "Pension" plus the Income-style tax-year navigator (‹ / › / Today), labelled
*Tax year 2026-27* with *6 Apr 2026 – 5 Apr 2027* beneath it. A banner when any year in the window lacks a
September CPI (*"No CPI for 2027-28 yet — estimates for that year are off; add it to
`SEPTEMBER_CPI` after the September figure is published"*) or when an allowance fell
back to the newest table.

**Per person, one card**:

- **Head** — name, scheme badge (*NHS 2015* / *LGPS 2014* / *No DB scheme*), anchor line
  *"£7,900.18 accrued at 31 Mar 2026 (opens 2026-27)"*, and **Edit pension details**
  (scheme picker, anchor amount, anchor date). A person with no scheme shows *"SIPP-only
  — set the scheme and the statement figure to include the NHS/LGPS pension"*.
- **Headline row** (three stats) — *Allowance used this year* (PIA + SIPP, against the
  year's allowance); *Carry-forward available* (with the three years it comes from);
  **SIPP headroom** — *"£X gross · pay in £Y"* (Y = X ÷ 1.25), or, when over, *"Over by
  £Z after carry-forward — the excess is taxed at your marginal rate"*.
- **This year's estimate** — a small definition list: opening pension · CPI ·
  revaluation applied · pensionable earnings (*from salary timeline* / *override*) ·
  accrual added · closing pension · **pension input amount**. When the year has an
  entered figure the list is titled *"Estimate (for reference — entered figure in
  force)"*. When the estimate is unavailable (anchor later than this year, CPI missing)
  the list says why.
- **Four-year table** — one row per year, oldest first: tax year · allowance · pension
  input (with a source badge *entered* / *estimate* / *none*) · SIPP gross · used ·
  unused (carry-forward) · **Edit**. Edit opens the **PensionYearForm**: pension input
  amount (entered; blank = use estimate), pensionable earnings override (blank = use
  timeline), note. Saving upserts the `pensionYears` row.
- **Taper warning** under the headline when `summary.adjustedNetIncomePence >
  £200,000`: *"Adjusted net income is over £200,000 — the tapered annual allowance may
  apply and the £60,000 figure could be lower. Not modelled here."*

**Empty state** with no people points to the Income tab, as Company does.

**Income tab change** — the person card's third meter keeps its label and shape but
reads `entry.pension.current.usedPence` and `entry.pension.headroomGrossPence`
(headroom text *"more gross pension before the allowance, incl. carry-forward"*). The
"Pension so far: workplace … · personal & SIPP …" line becomes *"NHS/LGPS input £A
(estimate|entered) · personal & SIPP £B · carry-forward £C — details on the Pension
tab"*, and the "carry-forward isn't tracked here" wording goes.

## 5. Files

| File | Role |
|---|---|
| `src/engine/pension.js` | scheme + CPI tables, allowance-by-year, anchor year, roll-forward, PIA estimate, `buildPensionYear` (+ `pension.test.js`) |
| `src/engine/salaryTimeline.js` | `projectedYearSalaryPence` (+ tests) |
| `src/engine/tax.js` | remove `computePensionAllowance` (+ its tests) |
| `src/db/schema.js` | v8: `pensionYears` store, `TABLE_NAMES` |
| `src/db/repositories.js` | `pensionYearsRepo`; `peopleRepo` new fields + cascading delete |
| `src/db/pensionData.js` | pounds → pence adapter, four-year window assembly (+ `pensionData.test.js`) |
| `src/db/incomeData.js` | attach `entry.pension`, drop `pensionAllowance` |
| `src/ui/Pension.jsx` | the tab: navigator, banner, dialogs, wiring |
| `src/ui/pension/PensionCard.jsx` | head, headline stats, estimate list, taper warning |
| `src/ui/pension/PensionYearsTable.jsx` | the four-year table |
| `src/ui/pension/PensionDetailsForm.jsx` | scheme / anchor amount / anchor date |
| `src/ui/pension/PensionYearForm.jsx` | entered PIA / earnings override / note |
| `src/ui/pension/pensionRender.test.jsx` | tab integration test |
| `src/ui/income/PersonCard.jsx` | meter + summary line read `entry.pension` |
| `src/App.jsx` | registers the tab |
| `specs/REFACTOR-SPEC.md` | amendment (k) |

## 6. Tests

- **Engine** — the acceptance table above: from anchor £6,447.70 opening 2025-26, CPI
  1.7%, earnings £67,292.10 (= £1,246.15 × 54) → closing £7,900.18 and PIA £21,486;
  2026-27 from £7,900.18 with CPI 3.8% and £70,000 → £22,637 (= £1,896 + 16/54 × PE
  within rounding); a full chain 2022-23 → 2025-26 reproduces every row within £1.
  LGPS: £40,000 earnings, any CPI → PIA = 16 × 40,000 ÷ 49 within rounding. Entered
  figure overrides the estimate; missing CPI → source `'none'` for that year and later,
  listed in `cpiMissing`; allowance £40,000 for 2022-23 and £60,000 from 2023-24;
  carry-forward £124,921 for the acceptance data; excess consumes carry-forward oldest
  first; a prior year over its allowance contributes 0; `anchorOpeningYear` on
  31 March / 5 April / 6 April; `headroomNetPence = round(gross ÷ 1.25)`.
- **Timeline** — `projectedYearSalaryPence` pro-rates a mid-year raise by day and
  ignores sacrifice / pension / BIK.
- **Adapter** — on the in-memory Dexie: SIPP events land in the tax year of their date
  across the four-year window; an earnings override replaces the timeline figure for
  that year only; a person without a scheme gets SIPP-only rows; pounds ↔ pence at the
  edge; `gatherIncomeData` exposes `entry.pension` and no longer `pensionAllowance`.
- **Repositories / schema** — v8 opens over a v7 database with rows intact;
  `pensionYears` is unique per person-year; deleting a person removes their rows;
  backup round-trips the new table.
- **Tab render** — empty state; card with scheme, anchor, headline and the four-year
  table; editing a year writes the row and the source badge flips to *entered*;
  fallback banner when a CPI is missing; taper warning at > £200,000 ANI.
- **Income card** — the meter shows the engine's figures.

## 7. Non-goals

- The high-income taper (warning only), the money purchase annual allowance, the
  relevant-earnings cap on relief-at-source contributions.
- LGPS 50/50 section, NHS 1995/2008 sections, pre-2014 LGPS final-salary tranches,
  McCloud remedy, transfers in, added-years or additional-pension purchases.
- Carry-forward chains where a prior year borrowed from earlier years.
- Editing CPI in the UI — it lives beside the tax tables and changes once a year.
- Statement PDF import.
