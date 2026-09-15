# Pension Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Pension tab that measures the annual allowance by the HMRC pension input amount for NHS 2015 / LGPS 2014 members, carries unused allowance forward three years, and shows how much more can go into a SIPP.

**Architecture:** A pure engine (`src/engine/pension.js`) holds scheme parameters, September CPI, allowance history, a statement-anchor roll-forward, the PIA estimate and the four-year window. A pounds→pence adapter (`src/db/pensionData.js`) reads people, salary periods, the new `pensionYears` store and SIPP events, and `gatherIncomeData` attaches the result as `entry.pension` so the Income card meter and the new tab read one set of figures. Schema v8 is additive.

**Tech Stack:** Vite + React 18 (JSX, no TypeScript), Dexie 4 over IndexedDB, Vitest + @testing-library/react + fake-indexeddb.

**Design:** `specs/2026-09-15-pension-panel-design.md` (the contract; spec amendment (k) in `specs/REFACTOR-SPEC.md`).

## Global Constraints

- Money is integer **pence** at rest and in the engine; pounds only at the repository edge (`createBaseRepository` converts) and in forms.
- Never persist computed rows: `pensionYears` holds only the entered PIA, the earnings override and a note.
- No `innerHTML`, no `window.*` handlers, no inline `onclick=`.
- Engine modules are pure: no DB, no clock — callers pass dates in.
- Scheme parameters: `nhs-2015` accrual 1/54, real revaluation 1.5%; `lgps-2014` accrual 1/49, real revaluation 0%.
- PIA = `16 × (closing − opening × (1 + CPI))`, computed in full, rounded once.
- Annual allowance: £40,000 (4_000_000 pence) before `2023-24`, then the tax tables (£60,000).
- Carry-forward window: the 3 previous tax years, consumed oldest first.
- Estimates only from `2022-23` onward (post-April-2022 revaluation timing); earlier years are entered.
- Relief-at-source gross-up: net × 1.25; SIPP headroom net = gross ÷ 1.25.
- Taper: not computed; warn when adjusted net income > £200,000 (20_000_000 pence).
- Run tests with `npx vitest run <path>`; the whole suite with `npx vitest run`.
- Commit after every task with the attribution line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Naming used across tasks

| Name | Shape |
|---|---|
| `anchor` | `{ pence: number, date: 'yyyy-MM-dd', openingYear: '2026-27' } \| null` |
| `pensionYears` row (pence domain) | `{ id, taxYear, piaPence: number\|null, pensionableEarningsPence: number\|null, note }` |
| `earningsByYear` | `{ '2025-26': pence, … }` |
| `sippGrossByYear` | `{ '2025-26': pence, … }` |
| year entry (from `buildPensionYear`) | `{ taxYear, allowancePence, allowanceFromTable, piaPence, piaSource: 'entered'\|'estimate'\|'none', estimate, sippGrossPence, usedPence, unusedPence, carriedPence }` |
| `entry.pension` (on `gatherIncomeData` people) | the `gatherPensionData` person: `{ id, name, scheme, anchor, rows, earningsByYear, years, current, carryForwardPence, totalAvailablePence, headroomGrossPence, headroomNetPence, over, chargeablePence, cpiMissing }` |

---

### Task 1: Engine tables, allowance-by-year, anchor year, PIA estimate

**Files:**
- Create: `src/engine/pension.js`
- Test: `src/engine/pension.test.js`

**Interfaces:**
- Consumes: `TAX_YEAR_TABLES`, `taxYearTable`, `taxYearForDate`, `shiftTaxYear` from `src/engine/tax.js`.
- Produces: `SCHEMES`, `SEPTEMBER_CPI`, `PIA_FACTOR`, `RELIEF_AT_SOURCE_GROSS_UP`, `TAPER_THRESHOLD_INCOME_PENCE`, `FIRST_ESTIMATE_YEAR`, `CARRY_FORWARD_YEARS`, `PRE_2023_ALLOWANCE_PENCE`, `cpiForYear(label) → number|null`, `annualAllowanceForYear(label) → { allowancePence, fromTable }`, `anchorOpeningYear(isoDate) → label`, `estimatePia({ scheme, openingPence, cpi, earningsPence }) → { closingPence, upratedOpeningPence, piaPence }`.

- [ ] **Step 1: Write the failing tests**

```js
// src/engine/pension.test.js
import { describe, it, expect } from 'vitest';
import {
  SCHEMES,
  SEPTEMBER_CPI,
  cpiForYear,
  annualAllowanceForYear,
  anchorOpeningYear,
  estimatePia,
} from './pension.js';

describe('tables', () => {
  it('seeds both career-average schemes', () => {
    expect(SCHEMES['nhs-2015']).toEqual({ label: 'NHS 2015', accrualDenominator: 54, realRevaluation: 0.015 });
    expect(SCHEMES['lgps-2014']).toEqual({ label: 'LGPS 2014', accrualDenominator: 49, realRevaluation: 0 });
  });

  it('seeds September CPI by the tax year it uprates', () => {
    expect(SEPTEMBER_CPI['2023-24']).toBe(0.101);
    expect(SEPTEMBER_CPI['2026-27']).toBe(0.038);
    expect(cpiForYear('2025-26')).toBe(0.017);
    expect(cpiForYear('2031-32')).toBe(null); // no fallback, ever
  });
});

describe('annualAllowanceForYear', () => {
  it('is £40,000 before 2023-24 and the tax table from then on', () => {
    expect(annualAllowanceForYear('2022-23')).toEqual({ allowancePence: 4_000_000, fromTable: false });
    expect(annualAllowanceForYear('2023-24')).toEqual({ allowancePence: 6_000_000, fromTable: false });
    expect(annualAllowanceForYear('2026-27')).toEqual({ allowancePence: 6_000_000, fromTable: true });
    expect(annualAllowanceForYear('2035-36')).toEqual({ allowancePence: 6_000_000, fromTable: false });
  });
});

describe('anchorOpeningYear', () => {
  it('a statement dated at the end of a tax year opens the next one', () => {
    expect(anchorOpeningYear('2026-03-31')).toBe('2026-27');
    expect(anchorOpeningYear('2026-04-05')).toBe('2026-27');
    expect(anchorOpeningYear('2026-04-06')).toBe('2027-28');
  });
});

describe('estimatePia', () => {
  it('reproduces the owner’s 2025-26 NHS figures (£6,447.70 → £7,900.18, PIA ≈ £21,486)', () => {
    const est = estimatePia({
      scheme: 'nhs-2015',
      openingPence: 644_770,
      cpi: 0.017,
      earningsPence: 6_729_210, // £1,246.15 × 54
    });
    expect(est.closingPence).toBe(790_018);
    expect(est.upratedOpeningPence).toBe(655_731);
    expect(Math.abs(est.piaPence - 2_148_600)).toBeLessThan(100);
  });

  it('2026-27 on £70,000 ≈ £1,896 + 16/54 × earnings', () => {
    const est = estimatePia({ scheme: 'nhs-2015', openingPence: 790_018, cpi: 0.038, earningsPence: 7_000_000 });
    expect(est.piaPence).toBe(2_263_678);
    const collapsed = Math.round(16 * (0.015 * 790_018 + 7_000_000 / 54));
    expect(Math.abs(est.piaPence - collapsed)).toBeLessThan(100);
  });

  it('LGPS collapses to 16 × earnings ÷ 49 whatever the CPI', () => {
    const est = estimatePia({ scheme: 'lgps-2014', openingPence: 500_000, cpi: 0.031, earningsPence: 4_000_000 });
    expect(Math.abs(est.piaPence - Math.round((16 * 4_000_000) / 49))).toBeLessThan(100);
  });

  it('never goes negative and treats junk as zero', () => {
    const est = estimatePia({ scheme: 'lgps-2014', openingPence: 'x', cpi: 0.02, earningsPence: null });
    expect(est).toEqual({ closingPence: 0, upratedOpeningPence: 0, piaPence: 0 });
  });

  it('rejects an unknown scheme', () => {
    expect(() => estimatePia({ scheme: 'usс', openingPence: 0, cpi: 0, earningsPence: 0 })).toThrow(/scheme/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engine/pension.test.js`
Expected: FAIL — `Failed to resolve import "./pension.js"`.

- [ ] **Step 3: Write the module**

```js
// src/engine/pension.js
/**
 * pension.js — pension annual allowance for defined-benefit members
 * (REFACTOR-SPEC amendment 2026-09-15 (k)).
 *
 * Pure module: integer PENCE in, integer pence out. No DB access, no clock.
 *
 * HMRC measures a defined-benefit scheme's use of the annual allowance by the
 * PENSION INPUT AMOUNT: 16 × (closing pension − opening pension × (1 + CPI)),
 * CPI being the September figure before the tax year starts. Both household
 * schemes are career-average with no lump sum, so a year's closing pension is
 * opening × (1 + CPI + real revaluation) + pensionable earnings ÷ accrual.
 *
 * The user enters one ANCHOR (accrued pension at a statement date); the engine
 * rolls it forward year by year. An entered figure (Pension Savings Statement
 * or the owner's own reconstruction) always beats the estimate.
 *
 * Documented simplifications: post-April-2022 revaluation timing only (no
 * estimates before 2022-23); a prior year over its own allowance contributes
 * zero carry-forward; the high-income taper is a warning, not a computation.
 */

import { TAX_YEAR_TABLES, taxYearTable, taxYearForDate, shiftTaxYear } from './tax.js';

export const SCHEMES = {
  'nhs-2015': { label: 'NHS 2015', accrualDenominator: 54, realRevaluation: 0.015 },
  'lgps-2014': { label: 'LGPS 2014', accrualDenominator: 49, realRevaluation: 0 },
};

/**
 * September CPI, keyed by the tax year it uprates (the September BEFORE it
 * starts). Add a row after each September figure is published — a missing
 * year switches the estimate off rather than guessing.
 */
export const SEPTEMBER_CPI = {
  '2019-20': 0.024,
  '2020-21': 0.017,
  '2021-22': 0.005,
  '2022-23': 0.031,
  '2023-24': 0.101,
  '2024-25': 0.067,
  '2025-26': 0.017,
  '2026-27': 0.038,
};

export const PIA_FACTOR = 16;
export const RELIEF_AT_SOURCE_GROSS_UP = 1.25;
export const TAPER_THRESHOLD_INCOME_PENCE = 20_000_000; // £200,000
export const PRE_2023_ALLOWANCE_PENCE = 4_000_000; // £40,000 up to 2022-23
export const FIRST_ESTIMATE_YEAR = '2022-23';
export const CARRY_FORWARD_YEARS = 3;

/** The September CPI for a tax year, or null when not seeded (no fallback). */
export function cpiForYear(label) {
  const v = SEPTEMBER_CPI[label];
  return typeof v === 'number' ? v : null;
}

/**
 * The annual allowance for a tax year: the tax table where seeded, £40,000
 * for years before 2023-24, else the newest table's figure.
 * @returns {{ allowancePence: number, fromTable: boolean }}
 */
export function annualAllowanceForYear(label) {
  const seeded = TAX_YEAR_TABLES[label];
  if (seeded) return { allowancePence: seeded.pensionAnnualAllowancePence, fromTable: true };
  if (String(label) < '2023-24') return { allowancePence: PRE_2023_ALLOWANCE_PENCE, fromTable: false };
  return { allowancePence: taxYearTable(label).table.pensionAnnualAllowancePence, fromTable: false };
}

/**
 * The tax year an anchor OPENS: a statement figure is the value at the end of
 * the tax year containing its date (31 March 2026 → end of 2025-26 → opens
 * 2026-27).
 */
export function anchorOpeningYear(isoDate) {
  return shiftTaxYear(taxYearForDate(isoDate), 1);
}

const pence = (v) => Math.max(0, Math.round(Number(v) || 0));

function schemeOf(key) {
  const scheme = SCHEMES[key];
  if (!scheme) throw new Error(`Unknown pension scheme: "${key}"`);
  return scheme;
}

/**
 * One year's pension input amount from its opening pension, computed in full
 * (revaluation and accrual on one side, CPI uprating on the other) and rounded
 * once at the end.
 * @returns {{ closingPence: number, upratedOpeningPence: number, piaPence: number }}
 */
export function estimatePia({ scheme, openingPence, cpi, earningsPence }) {
  const s = schemeOf(scheme);
  const opening = pence(openingPence);
  const earnings = pence(earningsPence);
  const rate = Number(cpi) || 0;
  const closingExact = opening * (1 + rate + s.realRevaluation) + earnings / s.accrualDenominator;
  const upratedExact = opening * (1 + rate);
  return {
    closingPence: Math.round(closingExact),
    upratedOpeningPence: Math.round(upratedExact),
    piaPence: Math.max(0, Math.round(PIA_FACTOR * (closingExact - upratedExact))),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/engine/pension.test.js`
Expected: PASS (5 describe blocks, 9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/pension.js src/engine/pension.test.js
git commit -m "Pension engine: scheme tables, September CPI, allowance by year, PIA estimate

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Roll-forward and the four-year window (`buildPensionYear`)

**Files:**
- Modify: `src/engine/pension.js` (append)
- Test: `src/engine/pension.test.js` (append)

**Interfaces:**
- Consumes: Task 1's `estimatePia`, `annualAllowanceForYear`, `SEPTEMBER_CPI`, `FIRST_ESTIMATE_YEAR`, `CARRY_FORWARD_YEARS`, `RELIEF_AT_SOURCE_GROSS_UP`; `shiftTaxYear` from `tax.js`.
- Produces: `rollForward({ scheme, anchorPence, anchorOpeningYear, targetYear, cpiByYear?, earningsByYear }) → { openingPence, chain } | null` and `buildPensionYear({ taxYear, scheme, anchor, rows, earningsByYear, sippGrossByYear, cpiByYear? })` → the shape in "Naming used across tasks".

- [ ] **Step 1: Write the failing tests**

Append to `src/engine/pension.test.js` (add `rollForward, buildPensionYear` to the import):

```js
// The owner's TRS reconstruction: anchor £2,809.82 at 31 Mar 2022 (opens
// 2022-23), earnings = the TRS "earned" figure × 54.
const NHS_EARNINGS = {
  '2022-23': 3_826_278, // £708.57 × 54
  '2023-24': 4_787_100, // £886.50 × 54
  '2024-25': 5_853_222, // £1,083.93 × 54
  '2025-26': 6_729_210, // £1,246.15 × 54
  '2026-27': 7_000_000,
};

describe('rollForward', () => {
  it('reproduces the TRS balances year by year, rounding once per year', () => {
    const r = rollForward({
      scheme: 'nhs-2015',
      anchorPence: 280_982,
      anchorOpeningYear: '2022-23',
      targetYear: '2026-27',
      earningsByYear: NHS_EARNINGS,
    });
    expect(r.chain.map((c) => [c.taxYear, c.closingPence])).toEqual([
      ['2022-23', 364_764],
      ['2023-24', 495_727],
      ['2024-25', 644_770],
      ['2025-26', 790_018],
    ]);
    expect(r.openingPence).toBe(790_018);
  });

  it('is the anchor itself for the anchor’s own opening year', () => {
    const r = rollForward({ scheme: 'nhs-2015', anchorPence: 790_018, anchorOpeningYear: '2026-27', targetYear: '2026-27', earningsByYear: {} });
    expect(r).toEqual({ openingPence: 790_018, chain: [] });
  });

  it('returns null before the anchor, before 2022-23, or when a CPI in the chain is missing', () => {
    const base = { scheme: 'nhs-2015', anchorPence: 100, earningsByYear: {} };
    expect(rollForward({ ...base, anchorOpeningYear: '2026-27', targetYear: '2025-26' })).toBe(null);
    expect(rollForward({ ...base, anchorOpeningYear: '2021-22', targetYear: '2023-24' })).toBe(null);
    expect(rollForward({ ...base, anchorOpeningYear: '2026-27', targetYear: '2028-29' })).toBe(null); // no 2027-28 CPI
    expect(rollForward({ ...base, anchorOpeningYear: '2026-27', targetYear: '2027-28', cpiByYear: { '2026-27': 0.038 } }).openingPence).toBeGreaterThan(100);
  });
});

describe('buildPensionYear', () => {
  const anchor = { pence: 280_982, date: '2022-03-31', openingYear: '2022-23' };

  it('estimates every year in the window from the anchor and matches the TRS PIAs within £1', () => {
    const y = buildPensionYear({ taxYear: '2025-26', scheme: 'nhs-2015', anchor, rows: [], earningsByYear: NHS_EARNINGS, sippGrossByYear: {} });
    expect(y.years.map((r) => r.taxYear)).toEqual(['2022-23', '2023-24', '2024-25', '2025-26']);
    expect(y.years.map((r) => r.piaSource)).toEqual(['estimate', 'estimate', 'estimate', 'estimate']);
    const within = (pia, pounds) => expect(Math.abs(pia - pounds * 100)).toBeLessThan(100);
    within(y.years[0].piaPence, 12_012);
    within(y.years[1].piaPence, 15_060);
    within(y.years[2].piaPence, 18_533);
    within(y.years[3].piaPence, 21_486);
    expect(y.years[0].allowancePence).toBe(4_000_000);
    expect(y.years[1].allowancePence).toBe(6_000_000);
    expect(y.cpiMissing).toEqual([]);
  });

  it('an entered figure beats the estimate, and the estimate stays for reference', () => {
    const rows = [{ taxYear: '2025-26', piaPence: 2_148_600, pensionableEarningsPence: null, note: '' }];
    const y = buildPensionYear({ taxYear: '2025-26', scheme: 'nhs-2015', anchor, rows, earningsByYear: NHS_EARNINGS, sippGrossByYear: {} });
    expect(y.current.piaSource).toBe('entered');
    expect(y.current.piaPence).toBe(2_148_600);
    expect(y.current.estimate.piaPence).toBeGreaterThan(0);
    expect(y.current.estimate.earningsSource).toBe('timeline');
  });

  it('reproduces the owner’s 2026-27 position: £124,921 carry-forward, headroom gross and net', () => {
    const rows = [
      { taxYear: '2023-24', piaPence: 1_506_000, pensionableEarningsPence: null, note: '' },
      { taxYear: '2024-25', piaPence: 1_853_300, pensionableEarningsPence: null, note: '' },
      { taxYear: '2025-26', piaPence: 2_148_600, pensionableEarningsPence: null, note: '' },
    ];
    const y = buildPensionYear({
      taxYear: '2026-27',
      scheme: 'nhs-2015',
      anchor: { pence: 790_018, date: '2026-03-31', openingYear: '2026-27' },
      rows,
      earningsByYear: { '2026-27': 7_000_000 },
      sippGrossByYear: { '2026-27': 500_000 },
    });
    expect(y.years.slice(0, 3).map((r) => r.unusedPence)).toEqual([4_494_000, 4_146_700, 3_851_400]);
    expect(y.carryForwardPence).toBe(12_492_100);
    expect(y.current.piaPence).toBe(2_263_678);
    expect(y.current.sippGrossPence).toBe(500_000);
    expect(y.current.usedPence).toBe(2_763_678);
    expect(y.totalAvailablePence).toBe(6_000_000 + 12_492_100);
    expect(y.headroomGrossPence).toBe(6_000_000 + 12_492_100 - 2_763_678);
    expect(y.headroomNetPence).toBe(Math.round(y.headroomGrossPence / 1.25));
    expect(y.over).toBe(false);
    expect(y.chargeablePence).toBe(0);
  });

  it('an excess eats carry-forward oldest first and reports what is left', () => {
    const rows = [
      { taxYear: '2023-24', piaPence: 5_000_000, pensionableEarningsPence: null, note: '' }, // £10k unused
      { taxYear: '2024-25', piaPence: 4_000_000, pensionableEarningsPence: null, note: '' }, // £20k unused
      { taxYear: '2025-26', piaPence: 6_500_000, pensionableEarningsPence: null, note: '' }, // over → 0
      { taxYear: '2026-27', piaPence: 7_500_000, pensionableEarningsPence: null, note: '' }, // £15k over
    ];
    const y = buildPensionYear({ taxYear: '2026-27', scheme: 'nhs-2015', anchor: null, rows, earningsByYear: {}, sippGrossByYear: {} });
    expect(y.years.map((r) => r.carriedPence)).toEqual([1_000_000, 500_000, 0, 0]);
    expect(y.carryForwardPence).toBe(1_500_000);
    expect(y.headroomGrossPence).toBe(1_500_000);
    expect(y.over).toBe(false);
    const worse = buildPensionYear({ ...{ taxYear: '2026-27', scheme: 'nhs-2015', anchor: null, earningsByYear: {}, sippGrossByYear: {} }, rows: [...rows.slice(0, 3), { taxYear: '2026-27', piaPence: 10_000_000, pensionableEarningsPence: null, note: '' }] });
    expect(worse.over).toBe(true);
    expect(worse.chargeablePence).toBe(4_000_000 - 3_000_000);
    expect(worse.headroomGrossPence).toBe(0);
  });

  it('a scheme member’s year with no entered figure and no estimate contributes nothing', () => {
    const y = buildPensionYear({ taxYear: '2026-27', scheme: 'nhs-2015', anchor: { pence: 790_018, date: '2026-03-31', openingYear: '2026-27' }, rows: [], earningsByYear: { '2026-27': 7_000_000 }, sippGrossByYear: {} });
    expect(y.years.slice(0, 3).map((r) => r.piaSource)).toEqual(['none', 'none', 'none']);
    expect(y.years.slice(0, 3).map((r) => r.unusedPence)).toEqual([0, 0, 0]);
    expect(y.carryForwardPence).toBe(0);
    expect(y.current.piaSource).toBe('estimate');
  });

  it('a person with no scheme is tracked on SIPP alone, with full carry-forward', () => {
    const y = buildPensionYear({ taxYear: '2026-27', scheme: null, anchor: null, rows: [], earningsByYear: {}, sippGrossByYear: { '2025-26': 1_000_000, '2026-27': 250_000 } });
    expect(y.years.map((r) => r.piaSource)).toEqual(['none', 'none', 'none', 'none']);
    expect(y.years.map((r) => r.unusedPence)).toEqual([6_000_000, 6_000_000, 5_000_000, 5_750_000]);
    expect(y.carryForwardPence).toBe(17_000_000);
    expect(y.headroomGrossPence).toBe(17_000_000 + 5_750_000);
  });

  it('lists the years whose estimate was switched off by a missing CPI', () => {
    const y = buildPensionYear({ taxYear: '2028-29', scheme: 'nhs-2015', anchor: { pence: 790_018, date: '2026-03-31', openingYear: '2026-27' }, rows: [], earningsByYear: {}, sippGrossByYear: {} });
    expect(y.years.map((r) => r.piaSource)).toEqual(['none', 'estimate', 'none', 'none']);
    expect(y.cpiMissing).toEqual(['2027-28', '2028-29']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engine/pension.test.js`
Expected: FAIL — `rollForward is not a function`.

- [ ] **Step 3: Append the implementation**

```js
// src/engine/pension.js (append)

/**
 * Roll a statement anchor forward to the opening pension of `targetYear`,
 * one tax year at a time: closing = opening × (1 + CPI + real) + earnings ÷
 * accrual, rounded once per year. Null when the target is before the
 * anchor's opening year, before 2022-23 (pre-2022 revaluation timing is not
 * modelled), or any CPI on the way is missing.
 * @returns {{ openingPence: number, chain: Array<{ taxYear, openingPence, closingPence, cpi }> } | null}
 */
export function rollForward({
  scheme,
  anchorPence,
  anchorOpeningYear: fromYear,
  targetYear,
  cpiByYear = SEPTEMBER_CPI,
  earningsByYear = {},
}) {
  if (!SCHEMES[scheme]) return null;
  if (String(fromYear) < FIRST_ESTIMATE_YEAR || String(targetYear) < String(fromYear)) return null;
  let opening = pence(anchorPence);
  const chain = [];
  let year = fromYear;
  while (year < targetYear) {
    const cpi = cpiByYear[year];
    if (typeof cpi !== 'number') return null;
    const { closingPence } = estimatePia({ scheme, openingPence: opening, cpi, earningsPence: earningsByYear[year] || 0 });
    chain.push({ taxYear: year, openingPence: opening, closingPence, cpi });
    opening = closingPence;
    year = shiftTaxYear(year, 1);
  }
  return { openingPence: opening, chain };
}

/** The window's labels, oldest first: taxYear − 3 … taxYear. */
export function windowYears(taxYear) {
  const out = [];
  for (let i = CARRY_FORWARD_YEARS; i >= 0; i -= 1) out.push(shiftTaxYear(taxYear, -i));
  return out;
}

/**
 * The viewed tax year plus the three before it: per year the allowance, the
 * pension input amount in force (entered beats estimate), grossed-up
 * personal/SIPP contributions, used and unused; then the carry-forward,
 * SIPP headroom (gross and the net payment), and the over/chargeable verdict.
 *
 * A scheme member's year with neither an entered figure nor an estimate is
 * unknown — it contributes ZERO carry-forward (conservative). A person with no
 * scheme is complete on SIPP data alone, so their unused is allowance − SIPP.
 * A prior year over its own allowance contributes zero; nothing is chased
 * further back.
 */
export function buildPensionYear({
  taxYear,
  scheme = null,
  anchor = null,
  rows = [],
  earningsByYear = {},
  sippGrossByYear = {},
  cpiByYear = SEPTEMBER_CPI,
}) {
  const rowByYear = new Map((rows || []).map((r) => [r.taxYear, r]));
  const cpiMissing = [];
  const canEstimate = !!(scheme && SCHEMES[scheme] && anchor && anchor.openingYear);

  const years = windowYears(taxYear).map((label) => {
    const { allowancePence, fromTable } = annualAllowanceForYear(label);
    const row = rowByYear.get(label) || null;
    const earningsPence = pence(earningsByYear[label]);
    const earningsSource = row && row.pensionableEarningsPence != null ? 'override' : 'timeline';

    let estimate = null;
    if (canEstimate && label >= anchor.openingYear && label >= FIRST_ESTIMATE_YEAR) {
      const rolled = rollForward({
        scheme,
        anchorPence: anchor.pence,
        anchorOpeningYear: anchor.openingYear,
        targetYear: label,
        cpiByYear,
        earningsByYear,
      });
      const cpi = cpiByYear[label];
      if (rolled && typeof cpi === 'number') {
        const est = estimatePia({ scheme, openingPence: rolled.openingPence, cpi, earningsPence });
        estimate = { openingPence: rolled.openingPence, cpi, ...est, earningsPence, earningsSource };
      } else {
        cpiMissing.push(label);
      }
    }

    const entered = row && row.piaPence != null ? pence(row.piaPence) : null;
    const piaPence = entered != null ? entered : estimate ? estimate.piaPence : null;
    const piaSource = entered != null ? 'entered' : estimate ? 'estimate' : 'none';
    const sippGrossPence = pence(sippGrossByYear[label]);
    const usedPence = (piaPence || 0) + sippGrossPence;
    const unknown = !!scheme && piaSource === 'none';
    return {
      taxYear: label,
      allowancePence,
      allowanceFromTable: fromTable,
      piaPence,
      piaSource,
      estimate,
      sippGrossPence,
      usedPence,
      unusedPence: unknown ? 0 : Math.max(0, allowancePence - usedPence),
      carriedPence: 0,
    };
  });

  const current = years[years.length - 1];
  const prior = years.slice(0, -1);
  const priorUnused = prior.reduce((sum, y) => sum + y.unusedPence, 0);
  // The current year's excess eats prior unused allowance oldest first.
  let remaining = Math.max(0, current.usedPence - current.allowancePence);
  for (const y of prior) {
    y.carriedPence = Math.min(remaining, y.unusedPence);
    remaining -= y.carriedPence;
  }
  const carryForwardPence = prior.reduce((sum, y) => sum + (y.unusedPence - y.carriedPence), 0);
  const totalAvailablePence = current.allowancePence + priorUnused;
  const headroomGrossPence = Math.max(0, totalAvailablePence - current.usedPence);
  return {
    taxYear,
    scheme,
    years,
    current,
    carryForwardPence,
    totalAvailablePence,
    headroomGrossPence,
    headroomNetPence: Math.round(headroomGrossPence / RELIEF_AT_SOURCE_GROSS_UP),
    over: remaining > 0,
    chargeablePence: remaining,
    cpiMissing,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/engine/pension.test.js`
Expected: PASS. If the "£124,921" test is off by a few pence, the bug is rounding inside `estimatePia` — it must round `closingExact` and the PIA separately from the exact values, never from each other.

- [ ] **Step 5: Commit**

```bash
git add src/engine/pension.js src/engine/pension.test.js
git commit -m "Pension engine: anchor roll-forward and the four-year allowance window

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `projectedYearSalaryPence` on the salary timeline

**Files:**
- Modify: `src/engine/salaryTimeline.js` (after `projectedMonthPensionPence`, ~line 143)
- Test: `src/engine/salaryTimeline.test.js` (append)

**Interfaces:**
- Consumes: the module's private `dayWeightedMonthPence(periods, yyyyMM, rateOf)` and `monthsOfTaxYear`.
- Produces: `projectedYearSalaryPence(periods, taxYear) → number` — the 12 months' day-weighted ANNUAL SALARY ÷ 12, before sacrifice, workplace pension and BIK (the pensionable-earnings proxy).

- [ ] **Step 1: Write the failing tests**

Append to `src/engine/salaryTimeline.test.js` (add `projectedYearSalaryPence` to the import):

```js
describe('projectedYearSalaryPence', () => {
  it('is the annual salary for one full-year rate', () => {
    expect(projectedYearSalaryPence(FLAT_60K, '2026-27')).toBe(6_000_000);
  });

  it('ignores sacrifice, workplace pension and BIK — pensionable pay is the gross salary', () => {
    const periods = [
      {
        effectiveFrom: '1900-01-01',
        annualSalaryPence: 6_000_000,
        salarySacrificePence: 600_000,
        workplacePensionAnnualPence: 500_000,
        bikAnnualPence: 100_000,
      },
    ];
    expect(projectedYearSalaryPence(periods, '2026-27')).toBe(6_000_000);
  });

  it('pro-rates a raise from 1 October by month', () => {
    const periods = [
      { effectiveFrom: '1900-01-01', annualSalaryPence: 6_000_000 },
      { effectiveFrom: '2026-10-01', annualSalaryPence: 7_200_000 },
    ];
    expect(projectedYearSalaryPence(periods, '2026-27')).toBe(6 * 500_000 + 6 * 600_000);
  });

  it('is 0 with no periods', () => {
    expect(projectedYearSalaryPence([], '2026-27')).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engine/salaryTimeline.test.js`
Expected: FAIL — `projectedYearSalaryPence is not a function`.

- [ ] **Step 3: Add the helper**

Insert after `projectedMonthPensionPence` in `src/engine/salaryTimeline.js`:

```js
/** A period's gross annual salary per month — before sacrifice, workplace
 * pension and BIK. The pensionable-earnings proxy for the Pension tab. */
function monthlySalaryRateOf(period) {
  return Math.round(Math.max(0, Math.round(Number(period.annualSalaryPence) || 0)) / 12);
}

/**
 * Projected gross salary for a whole tax year from the timeline: the 12 pay
 * months' day-weighted annual salary ÷ 12 (amendment (k) — the default
 * pensionable earnings when no override is entered).
 * @param {Array<object>} periods - pence-domain salary periods.
 * @param {string} taxYear - e.g. "2026-27".
 * @returns {number} pence
 */
export function projectedYearSalaryPence(periods, taxYear) {
  return monthsOfTaxYear(taxYear).reduce(
    (sum, month) => sum + dayWeightedMonthPence(periods, month, monthlySalaryRateOf),
    0
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/engine/salaryTimeline.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/salaryTimeline.js src/engine/salaryTimeline.test.js
git commit -m "Salary timeline: projected gross salary for a tax year (pensionable pay proxy)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Schema v8 (`pensionYears`) and repositories

**Files:**
- Modify: `src/db/schema.js` (version history comment, `SCHEMA_VERSION`, new `db.version(8)`, `TABLE_NAMES`)
- Modify: `src/db/repositories.js` (`validatePerson`, `peopleRepo`, new `pensionYearsRepo`)
- Test: `src/db/schemaUpgrade.test.js` (append), `src/db/incomeData.test.js` (append to the `peopleRepo` describe), new `src/db/pensionYears.test.js`

**Interfaces:**
- Consumes: `SCHEMES` from `src/engine/pension.js`.
- Produces: `db.pensionYears` store `'++id, personId, taxYear, &[personId+taxYear]'`; `people` fields `pensionScheme` (`''` | scheme key), `pensionAnchorPence` (pounds at the edge), `pensionAnchorDate` (`''` | ISO); `pensionYearsRepo` with the base API plus `forPerson(personId)` and `upsert(personId, taxYear, data)`; `peopleRepo.delete` cascades to `pensionYears`.

- [ ] **Step 1: Write the failing tests**

Append to `src/db/schemaUpgrade.test.js`:

```js
  it('v7 → v8: preserves rows and adds a unique-per-person-year pensionYears store', async () => {
    const v7 = new Dexie(DB_NAME);
    v7.version(1).stores(V1_STORES);
    v7.version(2).stores({ transactions: '++id, date, kind, categoryId, source, importHash, debtId' });
    v7.version(3).stores({ people: '++id', incomeEvents: '++id, personId, date, kind' });
    v7.version(4).stores({ balanceUpdates: '++id, debtId, date' });
    v7.version(5).stores({
      salaryPeriods: '++id, personId, effectiveFrom',
      payslips: '++id, personId, month, &[personId+month]',
    });
    v7.version(6).stores({ mileageTrips: '++id, date, vehicle' });
    v7.version(7).stores({ employers: '++id, name', mileageTrips: '++id, date, vehicle, employerId' });
    await v7.open();
    expect(v7.verno).toBe(7);
    const personId = await v7.people.add({ name: 'A', annualSalaryPence: 6000000 });
    v7.close();

    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
    const person = await db.people.get(personId);
    expect(person.name).toBe('A');
    expect(person.pensionScheme).toBeUndefined(); // read back as '' by the repo

    expect(await db.pensionYears.count()).toBe(0);
    await db.pensionYears.add({ personId, taxYear: '2025-26', piaPence: 2148600, pensionableEarningsPence: null, note: '' });
    await expect(
      db.pensionYears.add({ personId, taxYear: '2025-26', piaPence: 1, pensionableEarningsPence: null, note: '' })
    ).rejects.toThrow();
    expect(await db.pensionYears.where('personId').equals(personId).count()).toBe(1);
  });
```

Create `src/db/pensionYears.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb } from './test-utils.js';
import { db, TABLE_NAMES } from './schema.js';
import { peopleRepo, pensionYearsRepo } from './repositories.js';

beforeEach(resetDb);

describe('peopleRepo pension fields', () => {
  it('defaults to no scheme and no anchor', async () => {
    const id = await peopleRepo.add({ name: 'A' });
    expect(await db.people.get(id)).toMatchObject({ pensionScheme: '', pensionAnchorPence: 0, pensionAnchorDate: '' });
  });

  it('stores the anchor as pence and reads it back as pounds', async () => {
    const id = await peopleRepo.add({ name: 'A', pensionScheme: 'nhs-2015', pensionAnchorPence: 7900.18, pensionAnchorDate: '2026-03-31' });
    expect((await db.people.get(id)).pensionAnchorPence).toBe(790018);
    expect(await peopleRepo.get(id)).toMatchObject({ pensionScheme: 'nhs-2015', pensionAnchorPence: 7900.18, pensionAnchorDate: '2026-03-31' });
  });

  it('rejects an unknown scheme or a non-ISO anchor date', async () => {
    await expect(peopleRepo.add({ name: 'A', pensionScheme: 'uss' })).rejects.toThrow(/pensionScheme/);
    await expect(peopleRepo.add({ name: 'A', pensionAnchorDate: '31/03/2026' })).rejects.toThrow(/pensionAnchorDate/);
  });
});

describe('pensionYearsRepo', () => {
  it('is in the backup table list', () => {
    expect(TABLE_NAMES).toContain('pensionYears');
  });

  it('round-trips pounds at the edge and keeps nulls as nulls', async () => {
    const p = await peopleRepo.add({ name: 'A' });
    const id = await pensionYearsRepo.add({ personId: p, taxYear: '2025-26', piaPence: 21486, pensionableEarningsPence: null, note: 'TRS' });
    expect(await db.pensionYears.get(id)).toMatchObject({ piaPence: 2148600, pensionableEarningsPence: null, note: 'TRS' });
    expect(await pensionYearsRepo.get(id)).toMatchObject({ piaPence: 21486, pensionableEarningsPence: null });
  });

  it('defaults both figures to null (use the estimate / the timeline)', async () => {
    const p = await peopleRepo.add({ name: 'A' });
    const id = await pensionYearsRepo.add({ personId: p, taxYear: '2025-26' });
    expect(await db.pensionYears.get(id)).toMatchObject({ piaPence: null, pensionableEarningsPence: null, note: '' });
  });

  it('validates the tax-year label and non-negative figures', async () => {
    const p = await peopleRepo.add({ name: 'A' });
    await expect(pensionYearsRepo.add({ personId: p, taxYear: '2025/26' })).rejects.toThrow(/taxYear/);
    await expect(pensionYearsRepo.add({ personId: p, taxYear: '2025-26', piaPence: -1 })).rejects.toThrow(/piaPence/);
    await expect(pensionYearsRepo.add({ taxYear: '2025-26' })).rejects.toThrow(/personId/);
  });

  it('upserts one row per person-year and lists a person’s rows oldest first', async () => {
    const p = await peopleRepo.add({ name: 'A' });
    await pensionYearsRepo.upsert(p, '2025-26', { piaPence: 21486 });
    await pensionYearsRepo.upsert(p, '2025-26', { piaPence: 21500, note: 'PSS' });
    await pensionYearsRepo.upsert(p, '2023-24', { piaPence: 15060 });
    const rows = await pensionYearsRepo.forPerson(p);
    expect(rows.map((r) => [r.taxYear, r.piaPence, r.note])).toEqual([
      ['2023-24', 15060, ''],
      ['2025-26', 21500, 'PSS'],
    ]);
  });

  it('deleting a person removes their pension years', async () => {
    const a = await peopleRepo.add({ name: 'A' });
    const b = await peopleRepo.add({ name: 'B' });
    await pensionYearsRepo.upsert(a, '2025-26', { piaPence: 1 });
    await pensionYearsRepo.upsert(b, '2025-26', { piaPence: 2 });
    await peopleRepo.delete(a);
    expect(await db.pensionYears.count()).toBe(1);
    expect((await db.pensionYears.toArray())[0].personId).toBe(b);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/db/schemaUpgrade.test.js src/db/pensionYears.test.js`
Expected: FAIL — `db.pensionYears` undefined / `pensionYearsRepo` not exported.

- [ ] **Step 3: Schema v8**

In `src/db/schema.js`, add to the version-history comment (after the v7 paragraph):

```js
 * v8 — additive only (Pension tab, spec amendment 2026-09-15 (k)): a
 *      `pensionYears` store, unique per person + tax year, holding the
 *      USER-ENTERED pension input amount (from a Pension Savings Statement or
 *      the owner's own reconstruction) and an optional pensionable-earnings
 *      override. Estimates, carry-forward and headroom are computed at read
 *      time and never stored. `people` also gains three non-indexed fields —
 *      `pensionScheme`, `pensionAnchorPence`, `pensionAnchorDate` — which need
 *      no schema change; rows without them read back as '' / 0 / '' through
 *      the repository (SIPP-only tracking). New store only, no upgrade function.
```

Change `export const SCHEMA_VERSION = 7;` to `8`, and after the `db.version(7)` block add:

```js
// v8 — additive: the `pensionYears` store. `&[personId+taxYear]` makes the
// entered figure unique per person-year at the DB level (like payslips).
db.version(8).stores({
  pensionYears: '++id, personId, taxYear, &[personId+taxYear]',
});
```

Append `'pensionYears',` to `TABLE_NAMES` (after `'employers'`).

- [ ] **Step 4: Repositories**

In `src/db/repositories.js`, import the schemes next to the other engine imports:

```js
import { SCHEMES } from '../engine/pension.js';
```

Extend `validatePerson`:

```js
function validatePerson(data) {
  // Blank means "use the standard allowance"; anything else must be a code
  // the engine understands, or the PAYE check would silently ignore it.
  if (data.taxCode !== undefined && data.taxCode !== '' && !parseTaxCode(data.taxCode)) {
    throw new Error(
      `people.taxCode must be a recognised PAYE code (e.g. 1257L, K475, BR, D0, NT) or blank; got "${data.taxCode}"`
    );
  }
  // Blank = no defined-benefit scheme (SIPP-only tracking on the Pension tab).
  if (data.pensionScheme !== undefined && data.pensionScheme !== '' && !SCHEMES[data.pensionScheme]) {
    throw new Error(
      `people.pensionScheme must be one of ${Object.keys(SCHEMES).join(', ')} or blank; got "${data.pensionScheme}"`
    );
  }
  if (
    data.pensionAnchorDate !== undefined &&
    data.pensionAnchorDate !== '' &&
    !/^\d{4}-\d{2}-\d{2}$/.test(String(data.pensionAnchorDate))
  ) {
    throw new Error(
      `people.pensionAnchorDate must be an ISO yyyy-MM-dd string or blank; got "${data.pensionAnchorDate}"`
    );
  }
  if (data.pensionAnchorPence !== undefined && Number(data.pensionAnchorPence) < 0) {
    throw new Error('people.pensionAnchorPence must not be negative');
  }
}

function validatePensionYear(data, mode) {
  if (mode === 'add' && !Number.isInteger(data.personId)) {
    throw new Error(`pensionYears.personId is required; got ${JSON.stringify(data.personId)}`);
  }
  if (data.taxYear !== undefined && !/^\d{4}-\d{2}$/.test(String(data.taxYear))) {
    throw new Error(`pensionYears.taxYear must be a "yyyy-yy" label like 2025-26; got "${data.taxYear}"`);
  }
  for (const f of ['piaPence', 'pensionableEarningsPence']) {
    if (data[f] !== undefined && data[f] !== null && Number(data[f]) < 0) {
      throw new Error(`pensionYears.${f} must be null or non-negative; got ${JSON.stringify(data[f])}`);
    }
  }
}
```

Update `peopleRepo`: add `'pensionAnchorPence'` to the pence-field list, add `pensionScheme: '', pensionAnchorPence: 0, pensionAnchorDate: ''` to the defaults, and add `db.pensionYears` to the delete transaction:

```js
  async delete(id) {
    await db.transaction(
      'rw',
      db.people,
      db.incomeEvents,
      db.salaryPeriods,
      db.payslips,
      db.pensionYears,
      async () => {
        await db.incomeEvents.where('personId').equals(id).delete();
        await db.salaryPeriods.where('personId').equals(id).delete();
        await db.payslips.where('personId').equals(id).delete();
        await db.pensionYears.where('personId').equals(id).delete();
        await db.people.delete(id);
      }
    );
    dispatchMutation();
  },
```

Add the new repository after `payslipsRepo`:

```js
export const pensionYearsRepo = {
  ...createBaseRepository(
    db.pensionYears,
    // null passes through untouched: "not entered" is a real state.
    ['piaPence', 'pensionableEarningsPence'],
    { piaPence: null, pensionableEarningsPence: null, note: '' },
    validatePensionYear
  ),

  /** A person's rows, oldest tax year first. Pounds at the edge. */
  async forPerson(personId) {
    const rows = await db.pensionYears.where('personId').equals(personId).toArray();
    rows.sort((a, b) => (a.taxYear < b.taxYear ? -1 : 1));
    return rows.map(this._fromStorage);
  },

  /**
   * One row per person-year: update in place if the year already has one,
   * insert otherwise (the year form always goes through here).
   * @param {number} personId
   * @param {string} taxYear - "2025-26"
   * @param {object} data - pounds-at-edge fields (piaPence, pensionableEarningsPence, note).
   */
  async upsert(personId, taxYear, data) {
    validatePensionYear({ ...data, taxYear }, 'update');
    return db.transaction('rw', db.pensionYears, async () => {
      const existing = await db.pensionYears
        .where('[personId+taxYear]')
        .equals([personId, taxYear])
        .first();
      if (existing) return this.update(existing.id, data);
      return this.add({ ...data, personId, taxYear });
    });
  },
};
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/db/`
Expected: PASS for every db test, including `backup.test.js` and `wipe.test.js` (they iterate `TABLE_NAMES`).

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.js src/db/repositories.js src/db/schemaUpgrade.test.js src/db/pensionYears.test.js
git commit -m "Schema v8: pensionYears store, person pension scheme + anchor fields

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: `gatherPensionData` adapter, `entry.pension` on the Income data, retire `computePensionAllowance`

**Files:**
- Create: `src/db/pensionData.js`
- Test: `src/db/pensionData.test.js`
- Modify: `src/db/incomeData.js` (replace `pensionAllowance` with `pension`)
- Modify: `src/db/incomeData.test.js:271-305` (the two allowance tests)
- Modify: `src/engine/tax.js` (delete `computePensionAllowance`), `src/engine/tax.test.js:11,166-189` (delete its import and describe block)
- Modify: `src/ui/income/PersonCard.jsx:196-222` (the allowance meter + summary line), `src/ui/income/incomeRender.test.jsx` (append)

**Interfaces:**
- Consumes: Task 2's `buildPensionYear`, `anchorOpeningYear`, `windowYears`, `RELIEF_AT_SOURCE_GROSS_UP`; Task 3's `projectedYearSalaryPence`; Task 4's `pensionYearsRepo`; `taxYearBounds`, `taxYearForDate`, `shiftTaxYear` from `tax.js`.
- Produces: `gatherPensionData(taxYear) → { taxYear, people: [{ id, name, scheme, anchor, rows, earningsByYear, ...buildPensionYear result }] }`; `gatherIncomeData(...).people[i].pension` (same person object); `entry.pensionAllowance` is gone.

- [ ] **Step 1: Write the failing adapter tests**

```js
// src/db/pensionData.test.js
/**
 * Adapter test for the Pension tab: write people, salary periods, pension
 * years and SIPP events through the REAL repositories (real Dexie over
 * fake-indexeddb) and check the pounds → pence edge, the four-year SIPP
 * window, the earnings override, and the figures that come back.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb } from './test-utils.js';
import { peopleRepo, salaryPeriodsRepo, incomeEventsRepo, pensionYearsRepo } from './repositories.js';
import { gatherPensionData } from './pensionData.js';
import { gatherIncomeData } from './incomeData.js';

beforeEach(resetDb);

const sipp = (personId, date, pounds) =>
  incomeEventsRepo.add({ personId, date, kind: 'sipp-contribution', amountPence: pounds });

describe('gatherPensionData', () => {
  it('returns no people on an empty database', async () => {
    expect(await gatherPensionData('2026-27')).toEqual({ taxYear: '2026-27', people: [] });
  });

  it('builds the owner’s 2026-27 position from the anchor, entered years and timeline salary', async () => {
    const p = await peopleRepo.add({
      name: 'Anderson',
      pensionScheme: 'nhs-2015',
      pensionAnchorPence: 7900.18,
      pensionAnchorDate: '2026-03-31',
    });
    await salaryPeriodsRepo.add({ personId: p, effectiveFrom: '1900-01-01', annualSalaryPence: 70000 });
    await pensionYearsRepo.upsert(p, '2023-24', { piaPence: 15060 });
    await pensionYearsRepo.upsert(p, '2024-25', { piaPence: 18533 });
    await pensionYearsRepo.upsert(p, '2025-26', { piaPence: 21486 });
    await sipp(p, '2026-06-15', 4000); // £5,000 gross

    const { people } = await gatherPensionData('2026-27');
    const me = people[0];
    expect(me).toMatchObject({ id: p, name: 'Anderson', scheme: 'nhs-2015' });
    expect(me.anchor).toEqual({ pence: 790018, date: '2026-03-31', openingYear: '2026-27' });
    expect(me.earningsByYear['2026-27']).toBe(7_000_000);
    expect(me.years.map((y) => y.piaSource)).toEqual(['entered', 'entered', 'entered', 'estimate']);
    expect(me.current.piaPence).toBe(2_263_678);
    expect(me.current.sippGrossPence).toBe(500_000);
    expect(me.carryForwardPence).toBe(12_492_100);
    expect(me.headroomGrossPence).toBe(6_000_000 + 12_492_100 - 2_263_678 - 500_000);
  });

  it('counts SIPP events in the tax year of their date across the window, plus the annual personal pension every year', async () => {
    const p = await peopleRepo.add({ name: 'A', pensionAnnualPence: 1200 }); // £1,200 gross, every year
    await sipp(p, '2023-04-05', 800); // 2022-23 — outside the window
    await sipp(p, '2023-04-06', 800); // 2023-24
    await sipp(p, '2026-04-05', 400); // 2025-26
    await sipp(p, '2027-04-05', 400); // 2026-27 (last day)
    await sipp(p, '2027-04-06', 999); // 2027-28 — outside

    const me = (await gatherPensionData('2026-27')).people[0];
    expect(me.years.map((y) => y.sippGrossPence)).toEqual([
      120_000 + 100_000,
      120_000,
      120_000 + 50_000,
      120_000 + 50_000,
    ]);
  });

  it('an earnings override replaces the timeline figure for that year only', async () => {
    const p = await peopleRepo.add({ name: 'A', pensionScheme: 'lgps-2014', pensionAnchorPence: 5000, pensionAnchorDate: '2025-03-31' });
    await salaryPeriodsRepo.add({ personId: p, effectiveFrom: '1900-01-01', annualSalaryPence: 40000 });
    await pensionYearsRepo.upsert(p, '2025-26', { pensionableEarningsPence: 38000 });

    const me = (await gatherPensionData('2026-27')).people[0];
    expect(me.earningsByYear['2025-26']).toBe(3_800_000);
    expect(me.earningsByYear['2026-27']).toBe(4_000_000);
    const y25 = me.years.find((y) => y.taxYear === '2025-26');
    expect(y25.estimate.earningsSource).toBe('override');
    expect(y25.estimate.earningsPence).toBe(3_800_000);
    expect(me.current.estimate.earningsSource).toBe('timeline');
  });

  it('falls back to the legacy annual salary when a person has no salary periods', async () => {
    const p = await peopleRepo.add({ name: 'A', annualSalaryPence: 60000, pensionScheme: 'nhs-2015', pensionAnchorPence: 1000, pensionAnchorDate: '2026-03-31' });
    const me = (await gatherPensionData('2026-27')).people[0];
    expect(me.earningsByYear['2026-27']).toBe(6_000_000);
  });

  it('a person without a scheme (or without an anchor) has no estimate and is tracked on SIPP alone', async () => {
    const p = await peopleRepo.add({ name: 'Wife' });
    await sipp(p, '2026-06-01', 800);
    const me = (await gatherPensionData('2026-27')).people[0];
    expect(me.scheme).toBe(null);
    expect(me.anchor).toBe(null);
    expect(me.current).toMatchObject({ piaSource: 'none', sippGrossPence: 100_000, usedPence: 100_000 });
    expect(me.carryForwardPence).toBe(18_000_000);
  });
});

describe('gatherIncomeData exposes entry.pension', () => {
  it('carries the same person object and no longer a pensionAllowance', async () => {
    const p = await peopleRepo.add({ name: 'A' });
    await sipp(p, '2026-06-15', 800);
    const income = await gatherIncomeData('2026-27');
    const pension = await gatherPensionData('2026-27');
    expect(income.people[0].pensionAllowance).toBeUndefined();
    expect(income.people[0].pension.current.usedPence).toBe(100_000);
    expect(income.people[0].pension.headroomGrossPence).toBe(pension.people[0].headroomGrossPence);
    expect(income.people[0].pension.id).toBe(p);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/db/pensionData.test.js`
Expected: FAIL — `Failed to resolve import "./pensionData.js"`.

- [ ] **Step 3: Write the adapter**

```js
// src/db/pensionData.js
/**
 * pensionData.js — thin adapter that gathers what the Pension tab needs and
 * converts it from the repository POUNDS edge into the PENCE domain the pure
 * pension engine works in (the `incomeData.js` pattern: the ONLY place
 * pounds→pence conversion happens for the allowance tracker).
 *
 * Nothing here is ever persisted — estimates, carry-forward and headroom are
 * computed at read time, per the hard rules.
 */

import { peopleRepo, salaryPeriodsRepo, incomeEventsRepo, pensionYearsRepo } from './repositories.js';
import { toPence } from '../engine/currency.js';
import { taxYearBounds, taxYearForDate, shiftTaxYear } from '../engine/tax.js';
import { projectedYearSalaryPence } from '../engine/salaryTimeline.js';
import {
  SCHEMES,
  RELIEF_AT_SOURCE_GROSS_UP,
  anchorOpeningYear,
  buildPensionYear,
  windowYears,
} from '../engine/pension.js';

/** Every tax-year label from `from` to `to` inclusive (from ≤ to). */
function labelsBetween(from, to) {
  const out = [];
  for (let y = from; y <= to; y = shiftTaxYear(y, 1)) out.push(y);
  return out;
}

/**
 * Read every person + their salary periods, pension-year rows and SIPP events
 * for the viewed tax year and the three before it, and return a pence-domain
 * snapshot: per person, the anchor, the entered rows, the pensionable
 * earnings per year (override, else the timeline's gross salary, else the
 * legacy annual salary), grossed-up SIPP per year, and `buildPensionYear`'s
 * result.
 *
 * @param {string} taxYearLabel - e.g. "2026-27".
 * @returns {Promise<{ taxYear: string, people: Array<object> }>}
 */
export async function gatherPensionData(taxYearLabel) {
  const window = windowYears(taxYearLabel);
  const windowStart = taxYearBounds(window[0]).startDate;
  const { endDate } = taxYearBounds(taxYearLabel);

  const [peopleRaw, periodsRaw, rowsRaw, eventsRaw] = await Promise.all([
    peopleRepo.getAll(), // pounds at the edge
    salaryPeriodsRepo.getAll(), // pounds at the edge
    pensionYearsRepo.getAll(), // pounds at the edge
    incomeEventsRepo.between(windowStart, endDate), // pounds at the edge
  ]);

  const people = peopleRaw.map((p) => {
    const scheme = SCHEMES[p.pensionScheme] ? p.pensionScheme : null;
    const anchorPence = toPence(p.pensionAnchorPence); // pounds → pence
    const anchor =
      scheme && p.pensionAnchorDate && anchorPence > 0
        ? { pence: anchorPence, date: p.pensionAnchorDate, openingYear: anchorOpeningYear(p.pensionAnchorDate) }
        : null;

    const periods = periodsRaw
      .filter((sp) => sp.personId === p.id)
      .map((sp) => ({ effectiveFrom: sp.effectiveFrom, annualSalaryPence: toPence(sp.annualSalaryPence) })); // pounds → pence
    // Legacy fallback: no periods → the person's annual salary, always in force.
    const effectivePeriods =
      periods.length > 0
        ? periods
        : [{ effectiveFrom: '1900-01-01', annualSalaryPence: toPence(p.annualSalaryPence) }]; // pounds → pence

    const rows = rowsRaw
      .filter((r) => r.personId === p.id)
      .map((r) => ({
        id: r.id,
        taxYear: r.taxYear,
        note: r.note || '',
        piaPence: r.piaPence == null ? null : toPence(r.piaPence), // pounds → pence
        pensionableEarningsPence:
          r.pensionableEarningsPence == null ? null : toPence(r.pensionableEarningsPence), // pounds → pence
      }));
    const rowByYear = new Map(rows.map((r) => [r.taxYear, r]));

    // Earnings for every year the roll-forward or the window can touch.
    const firstYear = anchor && anchor.openingYear < window[0] ? anchor.openingYear : window[0];
    const earningsByYear = {};
    for (const label of labelsBetween(firstYear, taxYearLabel)) {
      const override = rowByYear.get(label)?.pensionableEarningsPence;
      earningsByYear[label] =
        override != null ? override : projectedYearSalaryPence(effectivePeriods, label);
    }

    // Grossed-up personal contributions per window year: the annual
    // personal-pension field (entered gross) every year + SIPP events × 1.25
    // in the tax year of their date — the Income engine's definition.
    const annualPersonalPence = toPence(p.pensionAnnualPence); // pounds → pence
    const sippGrossByYear = Object.fromEntries(window.map((label) => [label, annualPersonalPence]));
    for (const ev of eventsRaw) {
      if (ev.personId !== p.id || ev.kind !== 'sipp-contribution') continue;
      const label = taxYearForDate(ev.date);
      if (label in sippGrossByYear) {
        sippGrossByYear[label] += Math.round(toPence(ev.amountPence) * RELIEF_AT_SOURCE_GROSS_UP); // pounds → pence
      }
    }

    return {
      id: p.id,
      name: p.name,
      scheme,
      anchor,
      rows,
      earningsByYear,
      ...buildPensionYear({ taxYear: taxYearLabel, scheme, anchor, rows, earningsByYear, sippGrossByYear }),
    };
  });

  return { taxYear: taxYearLabel, people };
}

export default gatherPensionData;
```

- [ ] **Step 4: Wire it into `gatherIncomeData`**

In `src/db/incomeData.js`:
- Remove `computePensionAllowance` from the `tax.js` import; add `import { gatherPensionData } from './pensionData.js';`.
- Inside `gatherIncomeData`, extend the `Promise.all` destructuring with a fifth read: `const [peopleRaw, eventsRaw, periodsRaw, payslipsRaw, pensionData] = await Promise.all([ …existing four…, gatherPensionData(taxYearLabel) ]);`
- Delete the `workplacePensionYearPence` reduce and the `pensionAllowance:` property, and add in its place:

```js
      // Annual-allowance position (amendment (k)): computed by the pension
      // adapter from the person's scheme anchor, entered years and SIPP events.
      pension: pensionData.people.find((x) => x.id === p.id) ?? null,
```

- Update the comment above it accordingly (delete the "Annual-allowance use (amendment (g))" comment).

- [ ] **Step 5: Retire `computePensionAllowance`**

- In `src/engine/tax.js` delete the whole `computePensionAllowance` function and its JSDoc (the block between `buildPersonYearInput` and "The tax computation").
- In `src/engine/tax.test.js` delete `computePensionAllowance,` from the import and the `describe('computePensionAllowance', …)` block (lines 166–189).
- In `src/db/incomeData.test.js` replace the assertions at lines 285–287 with:

```js
    expect(person.pension.current.sippGrossPence).toBe(100000);
    expect(person.pension.current.usedPence).toBe(100000);
    expect(person.pension.over).toBe(false);
```

  and replace the whole test `'the allowance tracker sums payslip pension actuals with timeline projections'` (lines 290–305) with:

```js
  it('payslip pension contributions no longer count toward the annual allowance (amendment (k))', async () => {
    const p = await peopleRepo.add({ name: 'Anderson' });
    await salaryPeriodsRepo.add({
      personId: p,
      effectiveFrom: '1900-01-01',
      annualSalaryPence: 60000,
      workplacePensionAnnualPence: 6000,
    });
    await payslipsRepo.upsert(p, { month: '2026-04', taxablePence: 4500, pensionPence: 709.71 });

    const data = await gatherIncomeData('2026-27', '2026-04-30');
    const person = data.people[0];
    // The month grid still carries the contribution…
    expect(person.monthly[0].pensionPence).toBe(70971);
    // …but a DB scheme is measured by its input amount, so with no scheme set
    // the person is tracked on SIPP alone.
    expect(person.pension.current.usedPence).toBe(0);
    expect(person.pension.current.piaSource).toBe('none');
  });
```

- [ ] **Step 5b: Point the Income card's meter at `entry.pension`**

`PersonCard` destructures `pensionAllowance` from the entry and would throw once it is gone, so the card moves in the same commit. In `src/ui/income/PersonCard.jsx`:

- In the destructuring at the top of `PersonCard`, replace `pensionAllowance,` with `pension,`.
- Replace the third `<ThresholdMeter …/>` and the `<p className="muted">Pension so far: …</p>` that follows it with:

```jsx
      <ThresholdMeter
        label={`Pension annual allowance (${poundsLabel(pension.current.allowancePence)})`}
        valuePence={pension.current.usedPence}
        limitPence={pension.current.allowancePence}
        headroomPence={pension.headroomGrossPence}
        headroomText="more gross pension before the allowance, incl. carry-forward"
        over={pension.over}
        overText="Over the annual allowance even after carry-forward — the excess is taxed at your marginal rate. See the Pension tab."
      />
      <p className="muted">
        {pension.current.piaSource === 'none' ? (
          'No NHS/LGPS input amount for this year'
        ) : (
          <>
            NHS/LGPS input <Money pence={pension.current.piaPence} /> ({pension.current.piaSource})
          </>
        )}
        {' · '}personal &amp; SIPP <Money pence={pension.current.sippGrossPence} />
        {' · '}carry-forward <Money pence={pension.carryForwardPence} /> — details on the Pension tab.
      </p>
```

- Update the card's JSDoc line "the two threshold meters (£50,270 / £100,000)" to mention the allowance meter reads the Pension engine.

Add to `src/ui/income/incomeRender.test.jsx`, inside `describe('Income tab (seeded)')`:

```jsx
  it('the allowance meter reads the pension engine: SIPP-only person shows carry-forward (amendment (k))', async () => {
    const p = await peopleRepo.add({ name: 'Anderson', annualSalaryPence: 60000 });
    await incomeEventsRepo.add({ personId: p, date: startDate, kind: 'sipp-contribution', amountPence: 800 });

    render(<Income />);

    expect(await screen.findByText(/Pension annual allowance \(£60,000\)/)).toBeTruthy();
    expect(screen.getByText(/No NHS\/LGPS input amount for this year/)).toBeTruthy();
    // £1,000 gross SIPP used; headroom = £60,000 − £1,000 + 3 × £60,000 carry-forward.
    expect(
      screen.getByText((_, el) => el.tagName === 'SPAN' && /£239,000\.00 more gross pension/.test(el.textContent))
    ).toBeTruthy();
    expect(screen.queryByText(/carry-forward isn/)).toBeNull();
  });
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/db/ src/engine/tax.test.js src/ui/income/`
Expected: PASS. `grep -rn "computePensionAllowance\|pensionAllowance" src` must print nothing.

- [ ] **Step 7: Commit**

```bash
git add src/db/pensionData.js src/db/pensionData.test.js src/db/incomeData.js src/db/incomeData.test.js src/engine/tax.js src/engine/tax.test.js src/ui/income/PersonCard.jsx src/ui/income/incomeRender.test.jsx
git commit -m "Pension adapter: four-year window from anchor, entered years and SIPP events; entry.pension on Income data

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: The two forms — pension details (scheme + anchor) and pension year (entered figure + override)

**Files:**
- Create: `src/ui/pension/PensionDetailsForm.jsx`, `src/ui/pension/PensionYearForm.jsx`
- Test: `src/ui/pension/pensionForms.test.jsx`

**Interfaces:**
- Consumes: `CurrencyInput` (`src/ui/components/CurrencyInput.jsx`), `SCHEMES` from the engine.
- Produces: `<PensionDetailsForm initial onSubmit onCancel />` — `initial` is the raw people row (pounds); `onSubmit({ pensionScheme, pensionAnchorPence, pensionAnchorDate })` in pounds. `<PensionYearForm taxYear initial onSubmit onCancel />` — `initial` is the raw `pensionYears` row (pounds) or null; `onSubmit({ piaPence: number|null, pensionableEarningsPence: number|null, note })` in pounds.

- [ ] **Step 1: Write the failing tests**

```jsx
// src/ui/pension/pensionForms.test.jsx
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import PensionDetailsForm from './PensionDetailsForm.jsx';
import PensionYearForm from './PensionYearForm.jsx';

afterEach(cleanup);

describe('PensionDetailsForm', () => {
  it('submits scheme, anchor amount (pounds) and anchor date', () => {
    const onSubmit = vi.fn();
    render(<PensionDetailsForm initial={{ pensionScheme: '', pensionAnchorPence: 0, pensionAnchorDate: '' }} onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText('Scheme'), { target: { value: 'nhs-2015' } });
    fireEvent.change(screen.getByLabelText('Accrued annual pension'), { target: { value: '7900.18' } });
    fireEvent.change(screen.getByLabelText('As at'), { target: { value: '2026-03-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith({ pensionScheme: 'nhs-2015', pensionAnchorPence: 7900.18, pensionAnchorDate: '2026-03-31' });
  });

  it('a scheme needs an anchor; no scheme clears the anchor', () => {
    const onSubmit = vi.fn();
    render(<PensionDetailsForm initial={{ pensionScheme: 'nhs-2015', pensionAnchorPence: 7900.18, pensionAnchorDate: '2026-03-31' }} onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText('As at'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText(/needs the accrued pension and its date/)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Scheme'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith({ pensionScheme: '', pensionAnchorPence: 0, pensionAnchorDate: '' });
  });
});

describe('PensionYearForm', () => {
  it('submits nulls for blank fields (use the estimate / the timeline)', () => {
    const onSubmit = vi.fn();
    render(<PensionYearForm taxYear="2025-26" initial={null} onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith({ piaPence: null, pensionableEarningsPence: null, note: '' });
  });

  it('submits the entered figure, override and note in pounds, prefilled from the row', () => {
    const onSubmit = vi.fn();
    render(<PensionYearForm taxYear="2025-26" initial={{ piaPence: 21486, pensionableEarningsPence: null, note: 'TRS' }} onSubmit={onSubmit} onCancel={() => {}} />);
    expect(screen.getByLabelText('Pension input amount').value).toBe('21486');
    fireEvent.change(screen.getByLabelText('Pensionable earnings'), { target: { value: '67292.10' } });
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'PSS received' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith({ piaPence: 21486, pensionableEarningsPence: 67292.1, note: 'PSS received' });
  });

  it('rejects a negative figure', () => {
    const onSubmit = vi.fn();
    render(<PensionYearForm taxYear="2025-26" initial={null} onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText('Pension input amount'), { target: { value: '-5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText(/can’t be negative/)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/pension/pensionForms.test.jsx`
Expected: FAIL — cannot resolve `./PensionDetailsForm.jsx`.

- [ ] **Step 3: Write `PensionDetailsForm.jsx`**

```jsx
// src/ui/pension/PensionDetailsForm.jsx
import { useState } from 'react';
import CurrencyInput from '../components/CurrencyInput.jsx';
import { SCHEMES } from '../../engine/pension.js';

/**
 * Scheme + statement anchor for one person (amendment (k)). The anchor is
 * the accrued ANNUAL pension printed on the latest statement (NHS Total
 * Reward Statement / LGPS annual benefit statement) and the date it was true
 * — the engine rolls it forward from there. Pounds at the repository edge.
 *
 * @param {object} props.initial - the raw people row (pounds).
 * @param {(payload: { pensionScheme, pensionAnchorPence, pensionAnchorDate }) => void} props.onSubmit
 */
export default function PensionDetailsForm({ initial, onSubmit, onCancel }) {
  const [scheme, setScheme] = useState(initial?.pensionScheme || '');
  const [anchor, setAnchor] = useState(initial?.pensionAnchorPence || '');
  const [asAt, setAsAt] = useState(initial?.pensionAnchorDate || '');
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!scheme) {
      // No defined-benefit scheme: SIPP-only tracking, anchor cleared.
      try {
        await onSubmit({ pensionScheme: '', pensionAnchorPence: 0, pensionAnchorDate: '' });
      } catch (err) {
        setError(err.message || String(err));
      }
      return;
    }
    const pounds = anchor === '' || anchor == null ? 0 : Number(anchor);
    if (!(pounds > 0) || !asAt) {
      setError('A scheme needs the accrued pension and its date from the latest statement.');
      return;
    }
    try {
      await onSubmit({ pensionScheme: scheme, pensionAnchorPence: pounds, pensionAnchorDate: asAt }); // pounds edge
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <div className="form-row">
        <div className="field">
          <label htmlFor="pension-scheme">Scheme</label>
          <select id="pension-scheme" className="input" value={scheme} onChange={(e) => setScheme(e.target.value)}>
            <option value="">No defined-benefit scheme (SIPP only)</option>
            {Object.entries(SCHEMES).map(([key, s]) => (
              <option key={key} value={key}>
                {s.label}
              </option>
            ))}
          </select>
          <p className="field__hint">
            Career-average public-sector schemes are measured by the growth in the pension,
            not by what you pay in.
          </p>
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="pension-anchor">Accrued annual pension</label>
          <CurrencyInput id="pension-anchor" value={anchor} onChange={setAnchor} />
          <p className="field__hint">
            The pension built up so far, per year, from the latest statement (e.g. £7,900.18).
            Replace it each year when the new statement arrives.
          </p>
        </div>
        <div className="field">
          <label htmlFor="pension-as-at">As at</label>
          <input id="pension-as-at" className="input" type="date" value={asAt} onChange={(e) => setAsAt(e.target.value)} />
          <p className="field__hint">The statement date — usually 31 March.</p>
        </div>
      </div>
      {error && <p className="form__error">{error}</p>}
      <div className="form__actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary">
          Save
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Write `PensionYearForm.jsx`**

```jsx
// src/ui/pension/PensionYearForm.jsx
import { useState } from 'react';
import CurrencyInput from '../components/CurrencyInput.jsx';

/**
 * One tax year's entered figures (amendment (k)): the pension input amount
 * from a Pension Savings Statement (or the owner's own reconstruction) and an
 * optional pensionable-earnings override. Blank = null = "use the estimate" /
 * "use the salary timeline". Pounds at the repository edge.
 *
 * @param {string} props.taxYear - "2025-26".
 * @param {object|null} props.initial - the raw pensionYears row (pounds), or null.
 * @param {(payload: { piaPence, pensionableEarningsPence, note }) => void} props.onSubmit
 */
export default function PensionYearForm({ taxYear, initial, onSubmit, onCancel }) {
  const [pia, setPia] = useState(initial?.piaPence ?? '');
  const [earnings, setEarnings] = useState(initial?.pensionableEarningsPence ?? '');
  const [note, setNote] = useState(initial?.note || '');
  const [error, setError] = useState(null);

  const optional = (v) => (v === '' || v == null ? null : Number(v));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const piaPence = optional(pia);
    const pensionableEarningsPence = optional(earnings);
    if ((piaPence != null && piaPence < 0) || (pensionableEarningsPence != null && pensionableEarningsPence < 0)) {
      setError('Figures can’t be negative.');
      return;
    }
    try {
      await onSubmit({ piaPence, pensionableEarningsPence, note: note.trim() }); // pounds edge
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <div className="form-row">
        <div className="field">
          <label htmlFor="pension-year-pia">Pension input amount</label>
          <CurrencyInput id="pension-year-pia" value={pia} onChange={setPia} />
          <p className="field__hint">
            The {taxYear} figure from the Pension Savings Statement, if you have one. Leave
            blank to use the estimate.
          </p>
        </div>
        <div className="field">
          <label htmlFor="pension-year-earnings">Pensionable earnings</label>
          <CurrencyInput id="pension-year-earnings" value={earnings} onChange={setEarnings} />
          <p className="field__hint">
            Only if the year’s pensionable pay differs from the salary timeline. Leave blank to
            use the timeline.
          </p>
        </div>
      </div>
      <div className="field">
        <label htmlFor="pension-year-note">Note</label>
        <input id="pension-year-note" className="input" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. PSS received Oct 2026" />
      </div>
      {error && <p className="form__error">{error}</p>}
      <div className="form__actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary">
          Save
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/ui/pension/pensionForms.test.jsx`
Expected: PASS. (`CurrencyInput` forwards `id`, so `getByLabelText` resolves through `htmlFor`; it reports parsed pounds on every change, so `7900.18` arrives as the number `7900.18`.)

- [ ] **Step 6: Commit**

```bash
git add src/ui/pension/PensionDetailsForm.jsx src/ui/pension/PensionYearForm.jsx src/ui/pension/pensionForms.test.jsx
git commit -m "Pension tab: scheme/anchor and per-year entry forms

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: The Pension tab — card, four-year table, screen, navigation, styles

**Files:**
- Create: `src/ui/pension/PensionCard.jsx`, `src/ui/pension/PensionYearsTable.jsx`, `src/ui/Pension.jsx`
- Modify: `src/App.jsx` (register the tab after Company), `src/styles.css` (append)
- Test: `src/ui/pension/pensionRender.test.jsx`

**Interfaces:**
- Consumes: `gatherIncomeData` (people entries carry `pension` from Task 5 and `summary.adjustedNetIncomePence`), `peopleRepo`, `pensionYearsRepo`, Task 6's forms, `Money`, `Modal`, `EmptyState`, `formatDay`, `taxYearForDate` / `shiftTaxYear` / `taxYearBounds` from `tax.js`, `SCHEMES`, `TAPER_THRESHOLD_INCOME_PENCE`, `cpiForYear` from the engine.
- Produces: `<Pension initialTaxYear? />` (the prop exists so tests can pin a seeded year); `<PensionCard entry summary onEditDetails onEditYear />` where `entry` is a `gatherPensionData` person and `onEditYear(yearEntry)` receives one row of `entry.years`; `<PensionYearsTable years onEditYear />`.

- [ ] **Step 1: Write the failing render test**

```jsx
// src/ui/pension/pensionRender.test.jsx
/**
 * Integration test for the Pension tab: seed people, salary periods,
 * pension years and SIPP events through the REAL repositories (real Dexie
 * over fake-indexeddb) and render the real Pension component pinned to
 * 2026-27, the owner's acceptance year (CPI seeded, anchor 31 Mar 2026).
 */
import { resetDb } from '../../db/test-utils.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { peopleRepo, salaryPeriodsRepo, incomeEventsRepo, pensionYearsRepo } from '../../db/repositories.js';
import Pension from '../Pension.jsx';

beforeEach(resetDb);
afterEach(cleanup);

const seedOwner = async () => {
  const p = await peopleRepo.add({
    name: 'Anderson',
    pensionScheme: 'nhs-2015',
    pensionAnchorPence: 7900.18,
    pensionAnchorDate: '2026-03-31',
  });
  await salaryPeriodsRepo.add({ personId: p, effectiveFrom: '1900-01-01', annualSalaryPence: 70000 });
  await pensionYearsRepo.upsert(p, '2023-24', { piaPence: 15060 });
  await pensionYearsRepo.upsert(p, '2024-25', { piaPence: 18533 });
  await pensionYearsRepo.upsert(p, '2025-26', { piaPence: 21486, note: 'TRS reconstruction' });
  await incomeEventsRepo.add({ personId: p, date: '2026-06-15', kind: 'sipp-contribution', amountPence: 4000 });
  return p;
};

const inSpan = (re) => (_, el) => el.tagName === 'SPAN' && re.test(el.textContent);

describe('Pension tab', () => {
  it('points to the Income tab when there are no people', async () => {
    render(<Pension initialTaxYear="2026-27" />);
    expect(await screen.findByText(/No people yet/)).toBeTruthy();
    expect(screen.getByText(/Income tab/)).toBeTruthy();
  });

  it('shows the owner’s 2026-27 headline: used, carry-forward, SIPP headroom gross and net', async () => {
    await seedOwner();
    render(<Pension initialTaxYear="2026-27" />);

    expect(await screen.findByText('Anderson')).toBeTruthy();
    expect(screen.getByText('NHS 2015')).toBeTruthy();
    // The figure is a <Money> span inside the sentence — match on the paragraph's textContent.
    expect(screen.getByText((_, el) => el.tagName === 'P' && /£7,900\.18 accrued at 31 Mar 2026/.test(el.textContent))).toBeTruthy();
    expect(screen.getByText('Allowance used this year')).toBeTruthy();
    expect(screen.getAllByText('£27,636.78').length).toBeGreaterThan(0); // £22,636.78 PIA + £5,000 SIPP
    expect(screen.getByText('Carry-forward available')).toBeTruthy();
    expect(screen.getAllByText('£124,921.00').length).toBeGreaterThan(0);
    expect(screen.getByText('SIPP headroom')).toBeTruthy();
    expect(screen.getByText(inSpan(/£157,284\.22 gross · pay in £125,827\.38/))).toBeTruthy();
  });

  it('shows this year’s estimate with its inputs', async () => {
    await seedOwner();
    render(<Pension initialTaxYear="2026-27" />);
    await screen.findByText('Anderson');

    const estimate = screen.getByText(/This year’s estimate/).closest('section');
    const list = within(estimate);
    expect(list.getByText('£7,900.18')).toBeTruthy(); // opening
    expect(list.getByText('3.8%')).toBeTruthy(); // CPI
    expect(list.getByText('5.3%')).toBeTruthy(); // revaluation
    expect(list.getByText(/£70,000\.00/)).toBeTruthy(); // earnings, from the timeline
    expect(list.getByText(/from salary timeline/)).toBeTruthy();
    expect(list.getByText('£9,615.19')).toBeTruthy(); // closing
    expect(list.getByText('£22,636.78')).toBeTruthy(); // PIA
  });

  it('lists the four-year window with source badges and lets a year be edited', async () => {
    const p = await seedOwner();
    render(<Pension initialTaxYear="2026-27" />);
    await screen.findByText('Anderson');

    const rows = screen.getAllByRole('row').filter((r) => /^20\d\d-\d\d/.test(r.textContent));
    expect(rows.map((r) => r.textContent.slice(0, 7))).toEqual(['2023-24', '2024-25', '2025-26', '2026-27']);
    expect(rows[0].textContent).toMatch(/£15,060\.00/);
    expect(rows[0].textContent).toMatch(/£44,940\.00/); // unused
    expect(within(rows[0]).getByText('entered')).toBeTruthy();
    expect(within(rows[3]).getByText('estimate')).toBeTruthy();
    expect(rows[2].textContent).toMatch(/TRS reconstruction/);

    fireEvent.click(within(rows[3]).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.getAttribute('aria-label')).toMatch(/2026-27/);
    fireEvent.change(screen.getByLabelText('Pension input amount'), { target: { value: '23000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => {
      const saved = (await pensionYearsRepo.forPerson(p)).find((r) => r.taxYear === '2026-27');
      expect(saved).toMatchObject({ piaPence: 23000, pensionableEarningsPence: null });
    });
    const current = (await screen.findAllByRole('row')).find((r) => r.textContent.startsWith('2026-27'));
    expect(within(current).getByText('entered')).toBeTruthy();
    expect(screen.getAllByText('£28,000.00').length).toBeGreaterThan(0); // £23,000 + £5,000 SIPP
  });

  it('edits the scheme and anchor through the details form', async () => {
    const p = await peopleRepo.add({ name: 'Wife' });
    render(<Pension initialTaxYear="2026-27" />);
    await screen.findByText('Wife');
    expect(screen.getByText(/SIPP-only/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Edit pension details' }));
    fireEvent.change(await screen.findByLabelText('Scheme'), { target: { value: 'lgps-2014' } });
    fireEvent.change(screen.getByLabelText('Accrued annual pension'), { target: { value: '5000' } });
    fireEvent.change(screen.getByLabelText('As at'), { target: { value: '2026-03-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => {
      expect(await peopleRepo.get(p)).toMatchObject({ pensionScheme: 'lgps-2014', pensionAnchorPence: 5000, pensionAnchorDate: '2026-03-31' });
    });
    expect(await screen.findByText('LGPS 2014')).toBeTruthy();
  });

  it('warns about the taper when adjusted net income passes £200,000', async () => {
    const p = await peopleRepo.add({ name: 'Anderson' });
    await salaryPeriodsRepo.add({ personId: p, effectiveFrom: '1900-01-01', annualSalaryPence: 250000 });
    render(<Pension initialTaxYear="2026-27" />);
    expect(await screen.findByText(/tapered annual allowance may apply/)).toBeTruthy();
  });

  it('flags a year with no September CPI', async () => {
    await seedOwner();
    render(<Pension initialTaxYear="2028-29" />);
    expect(await screen.findByText(/No September CPI for 2027-28, 2028-29/)).toBeTruthy();
  });

  it('steps between tax years', async () => {
    await seedOwner();
    render(<Pension initialTaxYear="2026-27" />);
    await screen.findByText('Anderson');
    fireEvent.click(screen.getByRole('button', { name: 'Previous tax year' }));
    expect(await screen.findByText(/Tax year 2025-26/)).toBeTruthy();
    expect(screen.getAllByText('£21,486.00').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/pension/pensionRender.test.jsx`
Expected: FAIL — cannot resolve `../Pension.jsx`.

- [ ] **Step 3: Write `PensionYearsTable.jsx`**

```jsx
// src/ui/pension/PensionYearsTable.jsx
import Money from '../components/Money.jsx';

const SOURCE_LABEL = { entered: 'entered', estimate: 'estimate', none: 'none' };

/**
 * The four-year window: allowance, pension input amount (with its source),
 * SIPP gross, used, unused / carry-forward, and an Edit per year. Public
 * constants (the allowance) are plain text; the owner's figures go through
 * <Money> so the privacy blur applies.
 *
 * @param {Array<object>} props.years - `entry.years` from the pension engine, oldest first.
 * @param {(year: object) => void} props.onEditYear
 */
export default function PensionYearsTable({ years, onEditYear }) {
  return (
    <div className="table-wrap">
      <table className="table pension-years">
        <thead>
          <tr>
            <th>Tax year</th>
            <th className="num">Allowance</th>
            <th className="num">Pension input</th>
            <th>Source</th>
            <th className="num">SIPP gross</th>
            <th className="num">Used</th>
            <th className="num">Unused</th>
            <th>Note</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {years.map((y) => (
            <tr key={y.taxYear} className={y.piaSource === 'none' ? 'is-inactive' : ''}>
              <td>{y.taxYear}</td>
              <td className="num">
                <Money pence={y.allowancePence} />
                {!y.allowanceFromTable && <span className="muted"> *</span>}
              </td>
              <td className="num">{y.piaPence == null ? <span className="muted">—</span> : <Money pence={y.piaPence} />}</td>
              <td>
                <span className={`badge badge--pension-${y.piaSource}`}>{SOURCE_LABEL[y.piaSource]}</span>
              </td>
              <td className="num">
                <Money pence={y.sippGrossPence} />
              </td>
              <td className="num">
                <Money pence={y.usedPence} />
              </td>
              <td className="num">
                <Money pence={y.unusedPence} />
                {y.carriedPence > 0 && (
                  <span className="muted">
                    {' '}
                    (−<Money pence={y.carriedPence} /> used this year)
                  </span>
                )}
              </td>
              <td className="muted">{y.note || ''}</td>
              <td className="pension-years__actions">
                <button type="button" className="btn btn--sm" onClick={() => onEditYear(y)}>
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

`y.note` is not on the engine row: `PensionCard` merges it in (Step 4) from `entry.rows` before passing `years` down.

- [ ] **Step 4: Write `PensionCard.jsx`**

```jsx
// src/ui/pension/PensionCard.jsx
import Money from '../components/Money.jsx';
import { formatDay } from '../components/dates.js';
import { SCHEMES, TAPER_THRESHOLD_INCOME_PENCE } from '../../engine/pension.js';
import { formatGBP } from '../../engine/currency.js';
import PensionYearsTable from './PensionYearsTable.jsx';

/** 0.038 → "3.8%". */
const pct = (rate) => `${((rate || 0) * 100).toFixed(1)}%`;

/**
 * One person's annual-allowance card (amendment (k)): scheme + anchor,
 * the headline (used, carry-forward, SIPP headroom), this year's estimate
 * with its inputs, the taper warning, and the four-year table. Everything
 * is computed at read time by `gatherPensionData` — nothing persisted.
 *
 * @param {object} props.entry - a `gatherPensionData` person (`entry.pension` on the Income data).
 * @param {object} props.summary - the person's `computePersonTax` summary (for adjusted net income).
 */
export default function PensionCard({ entry, summary, onEditDetails, onEditYear }) {
  const { name, scheme, anchor, rows, years, current, carryForwardPence, headroomGrossPence, headroomNetPence, over, chargeablePence } = entry;
  const schemeLabel = scheme ? SCHEMES[scheme].label : 'No DB scheme';
  const noteByYear = new Map(rows.map((r) => [r.taxYear, r.note]));
  const yearsWithNotes = years.map((y) => ({ ...y, note: noteByYear.get(y.taxYear) || '' }));
  const est = current.estimate;
  const taper = summary && summary.adjustedNetIncomePence > TAPER_THRESHOLD_INCOME_PENCE;

  return (
    <li className="card pension-card">
      <div className="debt-card__head">
        <span className="debt-card__name">{name}</span>
        <span className={`badge ${scheme ? 'badge--income' : 'badge--source'}`}>{schemeLabel}</span>
        <div className="debt-card__actions">
          <button type="button" className="btn btn--sm" onClick={onEditDetails}>
            Edit pension details
          </button>
        </div>
      </div>

      {anchor ? (
        <p className="muted">
          <Money pence={anchor.pence} /> accrued at {formatDay(anchor.date)} (opens {anchor.openingYear})
        </p>
      ) : (
        <p className="muted">
          SIPP-only — set the scheme and the statement figure to include the NHS/LGPS pension.
        </p>
      )}

      <div className="kpi-row">
        <div className="stat">
          <span className="stat__label">Allowance used this year</span>
          <span className="stat__value">
            <Money pence={current.usedPence} />
          </span>
          <span className="stat__sub muted">of {formatGBP(current.allowancePence)}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Carry-forward available</span>
          <span className="stat__value">
            <Money pence={carryForwardPence} />
          </span>
          <span className="stat__sub muted">
            unused from {years[0].taxYear} – {years[years.length - 2].taxYear}
          </span>
        </div>
        <div className="stat">
          <span className="stat__label">SIPP headroom</span>
          {over ? (
            <span className="stat__value stat__value--neg">
              <Money pence={chargeablePence} /> over
            </span>
          ) : (
            <span className="stat__value">
              <Money pence={headroomGrossPence} /> gross · pay in <Money pence={headroomNetPence} />
            </span>
          )}
          <span className="stat__sub muted">
            {over
              ? 'Over the allowance after carry-forward — the excess is taxed at your marginal rate.'
              : 'Gross includes the 25% relief the provider adds.'}
          </span>
        </div>
      </div>

      {taper && (
        <p className="banner banner--warn">
          Adjusted net income is over {formatGBP(TAPER_THRESHOLD_INCOME_PENCE)} — the tapered annual
          allowance may apply and the {formatGBP(current.allowancePence)} figure could be lower. Not
          modelled here.
        </p>
      )}

      <section className="pension-estimate">
        <h4>
          This year’s estimate
          {current.piaSource === 'entered' && <span className="muted"> (for reference — entered figure in force)</span>}
        </h4>
        {est ? (
          <dl className="debt-card__facts">
            <div>
              <dt>Opening pension</dt>
              <dd><Money pence={est.openingPence} /></dd>
            </div>
            <div>
              <dt>CPI</dt>
              <dd>{pct(est.cpi)}</dd>
            </div>
            <div>
              <dt>Revaluation applied</dt>
              <dd>{pct(est.cpi + SCHEMES[scheme].realRevaluation)}</dd>
            </div>
            <div>
              <dt>Pensionable earnings</dt>
              <dd>
                <Money pence={est.earningsPence} />{' '}
                <span className="muted">({est.earningsSource === 'override' ? 'override' : 'from salary timeline'})</span>
              </dd>
            </div>
            <div>
              <dt>Accrual added</dt>
              <dd><Money pence={Math.round(est.earningsPence / SCHEMES[scheme].accrualDenominator)} /></dd>
            </div>
            <div>
              <dt>Closing pension</dt>
              <dd><Money pence={est.closingPence} /></dd>
            </div>
            <div>
              <dt>Pension input amount</dt>
              <dd><Money pence={est.piaPence} /></dd>
            </div>
          </dl>
        ) : (
          <p className="muted">
            {!scheme || !anchor
              ? 'No estimate without a scheme and a statement anchor.'
              : current.taxYear < anchor.openingYear
                ? `The anchor opens ${anchor.openingYear}; earlier years are entered, not estimated.`
                : 'No estimate — the September CPI for this year is not recorded yet.'}
          </p>
        )}
      </section>

      <PensionYearsTable years={yearsWithNotes} onEditYear={onEditYear} />
    </li>
  );
}
```

- [ ] **Step 5: Write `Pension.jsx`**

```jsx
// src/ui/Pension.jsx
import { useState } from 'react';
import { useLiveData } from '../db/useLiveData.js';
import { gatherIncomeData } from '../db/incomeData.js';
import { peopleRepo, pensionYearsRepo } from '../db/repositories.js';
import { taxYearForDate, shiftTaxYear, taxYearBounds } from '../engine/tax.js';
import EmptyState from './components/EmptyState.jsx';
import Modal from './components/Modal.jsx';
import { formatDay } from './components/dates.js';
import PensionCard from './pension/PensionCard.jsx';
import PensionDetailsForm from './pension/PensionDetailsForm.jsx';
import PensionYearForm from './pension/PensionYearForm.jsx';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Pension tab (spec amendment 2026-09-15 (k)) — the pension annual
 * allowance for defined-benefit members, measured the way HMRC does: by the
 * pension input amount, not by contributions. Per person: scheme + statement
 * anchor, this year's estimate, the three-year carry-forward, and how much
 * more can go into a SIPP. Reads `gatherIncomeData` so the figures are the
 * ones the Income card's meter shows; nothing is stored beyond the entered
 * figures.
 *
 * @param {string} [props.initialTaxYear] - pin the opening year (tests); defaults to today's.
 */
export default function Pension({ initialTaxYear }) {
  const [taxYear, setTaxYear] = useState(() => initialTaxYear || taxYearForDate(today()));
  const [detailsDialog, setDetailsDialog] = useState(null); // income entry (raw person row inside)
  const [yearDialog, setYearDialog] = useState(null); // { personId, personName, taxYear, row }

  const { data, loading } = useLiveData(() => gatherIncomeData(taxYear), [taxYear]);

  const currentYear = taxYearForDate(today());
  const bounds = taxYearBounds(taxYear);
  const people = data?.people ?? [];

  const cpiMissing = [...new Set(people.flatMap((p) => p.pension?.cpiMissing ?? []))].sort();
  const fallbackYears = [
    ...new Set(people.flatMap((p) => (p.pension?.years ?? []).filter((y) => !y.allowanceFromTable).map((y) => y.taxYear))),
  ].sort();

  const saveDetails = async (payload) => {
    await peopleRepo.update(detailsDialog.id, payload);
    setDetailsDialog(null);
  };
  const openYear = async (person, year) => {
    const existing = person.pension.rows.find((r) => r.taxYear === year.taxYear);
    setYearDialog({
      personId: person.id,
      personName: person.name,
      taxYear: year.taxYear,
      row: existing ? await pensionYearsRepo.get(existing.id) : null, // pounds row for the form
    });
  };
  const saveYear = async (payload) => {
    await pensionYearsRepo.upsert(yearDialog.personId, yearDialog.taxYear, payload);
    setYearDialog(null);
  };

  return (
    <div className="screen">
      <header className="screen__head">
        <h2>Pension</h2>
        <div className="screen__head-actions">
          <div className="taxyear-nav" role="group" aria-label="Tax year">
            <button type="button" className="btn btn--sm" aria-label="Previous tax year" onClick={() => setTaxYear((y) => shiftTaxYear(y, -1))}>
              ‹
            </button>
            <span className="taxyear-nav__label">
              Tax year {taxYear}
              <span className="muted taxyear-nav__dates">
                {formatDay(bounds.startDate)} – {formatDay(bounds.endDate)}
              </span>
            </span>
            <button type="button" className="btn btn--sm" aria-label="Next tax year" onClick={() => setTaxYear((y) => shiftTaxYear(y, 1))}>
              ›
            </button>
            {taxYear !== currentYear && (
              <button type="button" className="btn btn--sm" onClick={() => setTaxYear(currentYear)}>
                Today
              </button>
            )}
          </div>
        </div>
      </header>

      {cpiMissing.length > 0 && (
        <p className="banner banner--info">
          No September CPI for {cpiMissing.join(', ')} yet — estimates for those years are off. Add
          the figure to SEPTEMBER_CPI in the pension engine once it is published.
        </p>
      )}
      {fallbackYears.length > 0 && (
        <p className="banner banner--info">
          No rate table for {fallbackYears.join(', ')} — the annual allowance shown (*) uses the
          nearest known year.
        </p>
      )}

      {detailsDialog && (
        <Modal title={`Pension details — ${detailsDialog.name}`} onClose={() => setDetailsDialog(null)}>
          <PensionDetailsForm key={detailsDialog.id} initial={detailsDialog.person} onSubmit={saveDetails} onCancel={() => setDetailsDialog(null)} />
        </Modal>
      )}
      {yearDialog && (
        <Modal title={`${yearDialog.personName} — ${yearDialog.taxYear}`} onClose={() => setYearDialog(null)}>
          <PensionYearForm key={`${yearDialog.personId}-${yearDialog.taxYear}`} taxYear={yearDialog.taxYear} initial={yearDialog.row} onSubmit={saveYear} onCancel={() => setYearDialog(null)} />
        </Modal>
      )}

      {loading && !data ? (
        <p className="muted">Loading…</p>
      ) : people.length === 0 ? (
        <EmptyState title="No people yet" hint="Add yourself and your wife on the Income tab first; each person's scheme and statement figure are set here." />
      ) : (
        <ul className="card-list">
          {people.map((person) => (
            <PensionCard
              key={person.id}
              entry={person.pension}
              summary={person.summary}
              onEditDetails={() => setDetailsDialog(person)}
              onEditYear={(year) => openYear(person, year)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
```

`person.person` is the raw pounds row `gatherIncomeData` already attaches (used by the Income edit form), so the details form prefills without another read.

- [ ] **Step 6: Register the tab and add styles**

In `src/App.jsx` add `import Pension from './ui/Pension.jsx';` and, after the Company entry in `TABS`, `{ id: 'pension', label: 'Pension', Component: Pension },`.

Append to `src/styles.css`:

```css
/* Pension tab — annual allowance for defined-benefit members */
.pension-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.pension-card .debt-card__head {
  gap: 0.75rem;
}
.pension-estimate h4 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
}
.pension-years td,
.pension-years th {
  padding: 0.35rem 0.6rem;
}
.pension-years__actions {
  text-align: right;
  white-space: nowrap;
}
.badge--pension-entered {
  background: var(--accent);
  color: #fff;
}
.badge--pension-estimate {
  color: var(--accent);
  border-color: currentColor;
}
.badge--pension-none {
  opacity: 0.6;
}
```

(`--accent` is the variable the existing `.badge--income` / `.badge--promo` rules use; check the top of `styles.css` and use the same name if it differs.)

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/ui/pension/ src/ui/income/ src/ui/company/`
Expected: PASS. Then `npx vitest run` — the whole suite green.

- [ ] **Step 8: Look at it in the browser**

Run `npm run dev`, open http://localhost:5173, Pension tab: with no people the empty state; add a person on Income, set scheme/anchor, enter the three prior years, confirm the headline reads gross and net headroom, the table shows the badges, and the Income card's meter shows the same used figure. Fix anything that looks wrong before committing.

- [ ] **Step 9: Commit**

```bash
git add src/ui/Pension.jsx src/ui/pension/PensionCard.jsx src/ui/pension/PensionYearsTable.jsx src/ui/pension/pensionRender.test.jsx src/App.jsx src/styles.css
git commit -m "Pension tab: allowance headline, this year's estimate, four-year table, year navigation

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Documentation status and final verification

**Files:**
- Modify: `specs/2026-09-15-pension-panel-design.md` (status line; the no-data rule)

- [ ] **Step 1: Mark the design implemented and pin the no-data rule**

In `specs/2026-09-15-pension-panel-design.md`:
- Change `**Status:** approved, not yet implemented` to `**Status:** implemented`.
- In §2 "Year builder", replace `else null with source 'none' (used = SIPP only, unused = allowance − SIPP, never negative)` with: `else null with source 'none'. For a scheme member such a year is unknown and contributes zero unused allowance (§1); for a person with no scheme it is complete on SIPP data alone, so unused = allowance − SIPP, never negative.`

- [ ] **Step 2: Full verification**

```bash
npx vitest run
npm run build
grep -rn "computePensionAllowance\|pensionAllowance" src
```

Expected: all tests pass, the build succeeds, the grep prints nothing.

- [ ] **Step 3: Commit**

```bash
git add specs/2026-09-15-pension-panel-design.md
git commit -m "Mark the Pension tab design as implemented

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Then follow `superpowers:finishing-a-development-branch` (PR to `main`).
