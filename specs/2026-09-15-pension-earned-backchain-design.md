# Pension tab — back-chaining prior years from "pension earned": design

**Date:** 2026-09-15
**Status:** approved, not yet implemented
**Spec:** extends `2026-09-15-pension-panel-design.md` (amendment (k)); no schema version bump

## 1. Purpose

The Pension tab (amendment (k)) takes one **anchor** — the accrued annual pension on the
latest statement — and rolls it **forward** to estimate the pension input amount (PIA)
for the anchor's opening year and later. The three years *before* the anchor, which are
exactly the years carry-forward depends on, come out as *none* unless the owner types a
PIA for each.

The NHS pension site does not give a PIA, nor previous years' statements. It gives:

- the **current** accrued benefit (the anchor), and
- for every scheme year, the **pension earned in year** (pensionable pay ÷ 54).

Given the anchor as the closing value of the last year and each year's pension earned,
the accrual formula reverses exactly, so the engine can rebuild every earlier year's
opening pension and PIA on its own. Revaluation stays in the seeded `SEPTEMBER_CPI`
table; nothing new is entered for it.

Checked against the owner's reconstruction: anchor £7,900.18 (31 Mar 2026), pension
earned 2025-26 £1,246.15, CPI 1.7 % → opening £6,447.70, PIA £21,486, matching the
acceptance table in the parent design.

## 2. Data

`pensionYears` gains one field:

| Field | Type | Meaning |
|---|---|---|
| `pensionEarnedPence` | integer pence or **null** | The statement's "pension earned in year". Null = not entered. |

It is a user-entered statement figure, so the "never persist computed rows" rule is
untouched. Non-indexed → no Dexie version bump. `pensionYearsRepo` adds it to the pence
list for the pounds edge (null passes through) and to the validator (null or ≥ 0).
`gatherPensionData` converts it pounds → pence beside the other two row fields.

## 3. Engine — `src/engine/pension.js`

### `estimatePia` gains an optional accrual override

```js
estimatePia({ scheme, openingPence, cpi, earningsPence, earnedPence = null })
```

When `earnedPence` is a number it is the accrual added that year; otherwise the accrual
is `earningsPence ÷ accrualDenominator` as today. Everything else (CPI uprating,
single rounding, `max(0, …)`) is unchanged. `rollForward` takes an `earnedByYear` map
and passes each step's figure through, so a forward year with a statement figure uses
it too.

### New `rollBackward`

```js
rollBackward({ scheme, anchorPence, anchorOpeningYear, targetYear, cpiByYear, earnedByYear })
  → { openingPence, closingPence, chain: [{ taxYear, openingPence, closingPence, cpi }] } | null
```

Starts with `closing = anchorPence` for the year `anchorOpeningYear − 1` and steps
back one tax year at a time until it has produced `targetYear`:

```
opening = (closing − earned) ÷ (1 + cpi + realRevaluation)   // rounded once per year
next year back: closing = opening
```

Returns null when `targetYear < FIRST_ESTIMATE_YEAR` (2022-23), when
`targetYear ≥ anchorOpeningYear` (that is forward territory), or when any year on the
way has no `earnedByYear` entry or no CPI. `chain` is newest first, matching the order
it was computed. Negative openings clamp to 0 (a statement figure lower than the year's
pension earned is a data error, not a negative pension).

The PIA for a back-chained year is `16 × (closing − opening × (1 + cpi))` computed
from the exact (unrounded) opening and rounded once, which is algebraically
`16 × (earned + opening × real)`.

### `buildPensionYear`

Takes an `earnedByYear` map (built by the adapter from the rows). Per window year:

- `label ≥ anchor.openingYear` → forward, as today, with `earnedByYear` threaded
  through `rollForward` and `estimatePia`.
- `label < anchor.openingYear` and `label ≥ FIRST_ESTIMATE_YEAR` → `rollBackward` to
  `label`. On success the year's `estimate` is
  `{ openingPence, cpi, closingPence, upratedOpeningPence, piaPence, earningsPence,
  earningsSource, earnedPence, earnedSource: 'statement' }`.
- Forward estimates also carry `earnedPence` and `earnedSource` (`'statement'` when the
  row had one, `'earnings'` when derived from pensionable earnings).

`cpiMissing` lists a year only when the reason no estimate exists is a missing CPI —
in the year itself or on the chain to it. A back-chain broken by a missing
pension-earned row is a data-entry prompt, not a table gap, and is not listed.

Source precedence per year is unchanged: entered PIA → estimate → none. A *none* year
for a scheme member still contributes zero unused allowance.

## 4. Screen

- **PensionYearForm** — a new first field, **Pension earned**, hint: *"The 'pension
  earned in year' figure from the NHS/LGPS statement. Fills in the years before the
  statement, and replaces earnings ÷ 54 otherwise."* The pension input amount,
  pensionable earnings and note fields stay; blank = null for all three money fields.
- **PensionYearsTable** — two new numeric columns after *Tax year*: **Opening** and
  **Closing** (`estimate.openingPence` / `estimate.closingPence`), shown as *—* when
  there is no estimate. The *Source* badge is *estimate* for back-chained years, the
  same as forward ones.
- **PensionCard** estimate list — the *accrual added* line shows *(from statement)* when
  `earnedSource === 'statement'`, otherwise the existing wording. Under the four-year
  table, when the person has a scheme and an anchor and any prior window year's source
  is *none*, one line: *"Enter each year's pension earned from the statement to fill
  the years before it."*
- The **Income tab** is unaffected: it already reads the engine's figures through the
  adapter.

## 5. Files

| File | Change |
|---|---|
| `src/engine/pension.js` | `earnedPence` in `estimatePia`; `earnedByYear` in `rollForward`; new `rollBackward`; `buildPensionYear` uses both |
| `src/engine/pension.test.js` | tests in §6 |
| `src/db/repositories.js` | `pensionEarnedPence` in `pensionYearsRepo` pence list + validator |
| `src/db/pensionData.js` | convert the field; build `earnedByYear`; pass it to the engine |
| `src/db/pensionData.test.js` | pounds edge + back-chained year through the adapter |
| `src/ui/pension/PensionYearForm.jsx` | the new field |
| `src/ui/pension/PensionYearsTable.jsx` | Opening / Closing columns |
| `src/ui/pension/PensionCard.jsx` | accrual source wording; the prompt line |
| `src/ui/pension/pensionRender.test.jsx` | form saves the field; table shows the chain |
| `specs/REFACTOR-SPEC.md` | one bullet under amendment (k) pointing here |

## 6. Tests

- **Engine**
  - From anchor £7,900.18 opening 2026-27 and pension earned 2025-26 £1,246.15,
    2024-25 £1,083.93, 2023-24 £886.50, 2022-23 £708.57 (each = the acceptance
    table's closing − opening × (1 + CPI + 1.5 %)), `rollBackward` reproduces every
    opening within £1 and `buildPensionYear` gives PIAs £21,486 / £18,533 / £15,060 /
    £12,012 within £1, all with source *estimate*.
  - A missing pension-earned row for 2024-25 stops the chain: 2025-26 is *estimate*,
    2024-25 and 2023-24 are *none*, `cpiMissing` is empty.
  - A missing CPI for 2024-25 gives the same sources and lists 2024-25 in `cpiMissing`.
  - `rollBackward` returns null for a target before 2022-23 and for a target at or after
    the anchor's opening year.
  - A forward year with a pension-earned figure uses it instead of earnings ÷ 54, and
    `earnedSource` is *statement*.
  - An entered PIA still wins over a back-chained estimate.
- **Repository** — `pensionEarnedPence` null passes, negative throws, pounds round-trip.
- **Adapter** — a row's `pensionEarnedPence` reaches the engine in pence; a person with
  an anchor and three prior rows gets three *estimate* years and a non-zero
  `carryForwardPence`.
- **Tab render** — editing a prior year with only *Pension earned* filled flips its
  badge from *none* to *estimate* and fills Opening / Closing; the prompt line appears
  while a prior year is *none* and disappears once all three are filled.

## 7. Non-goals

- Entering the revaluation rate per year (CPI stays in `SEPTEMBER_CPI`).
- Years before 2022-23 (pre-April-2022 revaluation timing, as in the parent design).
- Deriving pensionable earnings from pension earned (× 54) for the salary timeline.
