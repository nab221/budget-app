# Company Tab (Corporation Tax on Dividends) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new top-level **Company** tab that pools both people's dividend events by company year (1 April – 31 March), inverts the UK corporation-tax formula to show the profit those dividends imply and the CT to set aside, and offers a "if I draw £X" calculator with company-side and personal-side before/after.

**Architecture:** A pure engine module (`src/engine/corporation-tax.js`) holds the FY-keyed CT rate table, the tax and inverse-tax functions, the company-year builder, and the draw preview. A thin adapter (`src/db/companyData.js`) reads the existing `people` and `incomeEvents` stores at the pounds edge, converts to pence, and calls the engine; the personal side reuses `gatherIncomeData` + `computePersonTax` unchanged. The tab (`src/ui/Company.jsx` + `src/ui/company/*`) follows the Mileage tab layout exactly. **No schema change, no new settings, nothing computed is persisted.**

**Tech Stack:** Vite + React 18 (JSX, plain JavaScript, no TypeScript), Dexie over IndexedDB, Vitest + @testing-library/react + fake-indexeddb.

**Spec:** `specs/2026-09-12-corporation-tax-design.md` (owner-approved). `specs/REFACTOR-SPEC.md` amendment (j) is already committed.

## Global Constraints

- Money is integer **pence** at rest and in the engine; pounds only at the UI / repository edge. Repositories take and return **pounds** (`createBaseRepository` converts the listed `*Pence` fields). The adapter is the only place pounds → pence happens.
- Never persist computed rows. Profit, CT, previews are computed at read time.
- No `innerHTML`, no `window.*` handler globals, no inline `onclick=` attributes.
- Company year-end is a constant **31 March** (owner decision). Company year label is the HMRC financial year: `FY2026` = 1 Apr 2026 – 31 Mar 2027.
- CT rules from FY2023: small profits rate **19%** up to **£50,000**; main rate **25%** from **£250,000**; marginal relief fraction **3/200** in between (effective 26.5%). Every year FY2023–FY2026 is seeded explicitly.
- Assumptions (written in the spec, not configurable): profit = dividends + CT; one company, no associated companies; full 12-month period.
- Tests run with `npx vitest run <path>`; the whole suite with `npx vitest run`.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Work on branch `claude/corporation-tax` (already created from `origin/main`).

## File Structure

| File | Responsibility |
|---|---|
| `src/engine/corporation-tax.js` | `CT_TABLES`; FY date helpers; `corporationTax`, `profitForNetDividends`, `setAsidePerPound`; `companyTotals`, `buildCompanyYear`, `previewDraw`. Pure, pence. |
| `src/engine/corporation-tax.test.js` | Engine tests. |
| `src/db/companyData.js` | `gatherCompanyData(fy)` (pounds → pence, calls the builder); `previewPersonalDraw({ personId, amountPence, date })` (reuses the Income engine). |
| `src/db/companyData.test.js` | Adapter tests on the real Dexie over fake-indexeddb. |
| `src/ui/company/format.js` | `formatRate`, `formatPerPound`, `fyTitle` display helpers. |
| `src/ui/company/CompanySummary.jsx` | KPI row, £50k band meter, set-aside rates, CT due hint, per-person split. |
| `src/ui/company/DividendLedger.jsx` | The year's dividend events (both people), edit / delete. |
| `src/ui/company/DividendForm.jsx` | Person picker wrapped around `income/EventForm` (kind `dividend`). |
| `src/ui/company/DrawCalculator.jsx` | Amount / person / date; company, personal, combined before → after; Record button. |
| `src/ui/company/companyRender.test.jsx` | Tab integration test. |
| `src/ui/Company.jsx` | The tab: FY navigator, data load, dialogs, wiring. |
| `src/App.jsx` | Registers the tab after Mileage. |
| `src/styles.css` | `.company-*` block appended at the end. |

---

### Task 1: Engine — CT tables and financial-year helpers

**Files:**
- Create: `src/engine/corporation-tax.js`
- Test: `src/engine/corporation-tax.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `CT_TABLES: { [fyLabel]: { smallRate, mainRate, lowerLimitPence, upperLimitPence, marginalReliefFraction } }`
  - `financialYearForDate(isoDate: string): string` → `'FY2026'`
  - `fyStartYear(label: string): number` → `2026`
  - `financialYearBounds(label): { startDate: string, endDate: string }`
  - `shiftFinancialYear(label, delta: number): string`
  - `financialYearTable(label): { table: object, tableYear: string }`
  - `ctPaymentDate(label): string` — ISO date 9 months + 1 day after year-end (always 1 January).

- [ ] **Step 1: Write the failing tests**

Create `src/engine/corporation-tax.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  CT_TABLES,
  financialYearForDate,
  fyStartYear,
  financialYearBounds,
  shiftFinancialYear,
  financialYearTable,
  ctPaymentDate,
} from './corporation-tax.js';

describe('financial-year helpers (1 April – 31 March)', () => {
  it('puts 31 March in the earlier FY and 1 April in the later one', () => {
    expect(financialYearForDate('2026-03-31')).toBe('FY2025');
    expect(financialYearForDate('2026-04-01')).toBe('FY2026');
    expect(financialYearForDate('2027-03-31')).toBe('FY2026');
    expect(financialYearForDate('2026-12-25')).toBe('FY2026');
  });

  it('parses the start year and shifts labels', () => {
    expect(fyStartYear('FY2026')).toBe(2026);
    expect(shiftFinancialYear('FY2026', -1)).toBe('FY2025');
    expect(shiftFinancialYear('FY2026', 1)).toBe('FY2027');
    expect(() => fyStartYear('2026-27')).toThrow(/Bad financial-year label/);
  });

  it('gives inclusive bounds', () => {
    expect(financialYearBounds('FY2026')).toEqual({
      startDate: '2026-04-01',
      endDate: '2027-03-31',
    });
  });

  it('dates CT payment 9 months and 1 day after year-end', () => {
    expect(ctPaymentDate('FY2026')).toBe('2028-01-01');
    expect(ctPaymentDate('FY2025')).toBe('2027-01-01');
  });

  it('seeds every FY from 2023 with the 19% / 25% / 3⁄200 rules', () => {
    for (const label of ['FY2023', 'FY2024', 'FY2025', 'FY2026']) {
      expect(CT_TABLES[label]).toEqual({
        smallRate: 0.19,
        mainRate: 0.25,
        lowerLimitPence: 5_000_000,
        upperLimitPence: 25_000_000,
        marginalReliefFraction: 3 / 200,
      });
    }
  });

  it('falls back to the nearest known table outside the seeded range', () => {
    expect(financialYearTable('FY2026')).toEqual({ table: CT_TABLES.FY2026, tableYear: 'FY2026' });
    expect(financialYearTable('FY2020').tableYear).toBe('FY2023');
    expect(financialYearTable('FY2031').tableYear).toBe('FY2026');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engine/corporation-tax.test.js`
Expected: FAIL — `Failed to resolve import "./corporation-tax.js"`.

- [ ] **Step 3: Write the implementation**

Create `src/engine/corporation-tax.js`:

```js
/**
 * corporation-tax.js — UK corporation tax (CT) on a small company's profit,
 * driven backwards from the dividends drawn (spec amendment 2026-09-12 (j)).
 *
 * Pure module: integer PENCE in, integer pence out. No DB access, no clock —
 * callers pass dates in.
 *
 * ── The rules modelled (Financial Year 2023 onward) ────────────────────────
 *   Profit ≤ £50,000            19% small profits rate
 *   Profit ≥ £250,000           25% main rate
 *   Between                     25% less marginal relief of
 *                               3/200 × (£250,000 − profit)
 *                               → an effective 26.5% on each pound in the band
 *
 * CT is assessed on the company's ACCOUNTING PERIOD. The owner's company year
 * ends 31 March, so a company year is 1 April – 31 March and sits inside
 * exactly one HMRC financial year: no apportionment across two rate tables.
 * A company year is labelled by its FY — "FY2026" is 1 Apr 2026 – 31 Mar 2027.
 *
 * ── Dividends define profit ─────────────────────────────────────────────────
 * A dividend can only be paid out of profit AFTER CT. The owner records what
 * was drawn; this module inverts the CT formula to find the smallest profit
 * that leaves that much net, and therefore the CT that has to be set aside.
 *
 * ── Documented simplifications (spec "simpler option" rule) ────────────────
 * - Profit = dividends + CT. No retained reserves, losses, salaries or
 *   expenses — they are netted off before the profit this module sees.
 * - One company, no associated companies (limits are not divided).
 * - A full 12-month period (limits are not pro-rated).
 */

// ---------------------------------------------------------------------------
// Rate tables
// ---------------------------------------------------------------------------

/**
 * Per-financial-year CT rules, keyed by label ("FY2026") — the
 * `TAX_YEAR_TABLES` pattern from `tax.js`, so a Budget change lands as a new
 * entry rather than an edit. Every year from FY2023 (when the 25% main rate
 * and marginal relief returned) is seeded explicitly; the fallback only
 * handles years outside the seeded range.
 */
const FY2023_RULES = {
  smallRate: 0.19,
  mainRate: 0.25,
  lowerLimitPence: 5_000_000, // £50,000
  upperLimitPence: 25_000_000, // £250,000
  marginalReliefFraction: 3 / 200,
};

export const CT_TABLES = {
  FY2023: { ...FY2023_RULES },
  FY2024: { ...FY2023_RULES },
  FY2025: { ...FY2023_RULES },
  FY2026: { ...FY2023_RULES },
};

const KNOWN_FYS = Object.keys(CT_TABLES).sort();

// ---------------------------------------------------------------------------
// Financial-year calendar helpers (1 April – 31 March)
// ---------------------------------------------------------------------------

/** "FY2026" for a start year of 2026. */
function labelForStartYear(startYear) {
  return `FY${startYear}`;
}

/** Start year (e.g. 2026) parsed from an "FY2026" label. */
export function fyStartYear(label) {
  const m = /^FY(\d{4})$/.exec(String(label));
  if (!m) throw new Error(`Bad financial-year label: "${label}"`);
  return Number(m[1]);
}

/**
 * The financial year containing an ISO `yyyy-MM-dd` date.
 * @returns {string} e.g. "FY2026" for any date 1 Apr 2026 – 31 Mar 2027.
 */
export function financialYearForDate(isoDate) {
  const s = String(isoDate);
  const year = Number(s.slice(0, 4));
  if (!Number.isInteger(year)) throw new Error(`Bad ISO date: "${isoDate}"`);
  const startYear = s >= `${year}-04-01` ? year : year - 1;
  return labelForStartYear(startYear);
}

/**
 * Inclusive date bounds of a financial year.
 * @returns {{ startDate: string, endDate: string }} e.g. 2026-04-01 … 2027-03-31.
 */
export function financialYearBounds(label) {
  const y = fyStartYear(label);
  return { startDate: `${y}-04-01`, endDate: `${y + 1}-03-31` };
}

/** The label `delta` years away ("FY2026", −1 → "FY2025"). */
export function shiftFinancialYear(label, delta) {
  return labelForStartYear(fyStartYear(label) + delta);
}

/**
 * The CT rules for a financial year, clamping to the nearest known table for
 * years outside the seeded range (mirrors `taxYearTable`).
 * @returns {{ table: object, tableYear: string }} `tableYear` is the label of
 *   the table actually used, so the UI can flag a fallback.
 */
export function financialYearTable(label) {
  if (CT_TABLES[label]) return { table: CT_TABLES[label], tableYear: label };
  const oldest = KNOWN_FYS[0];
  const newest = KNOWN_FYS[KNOWN_FYS.length - 1];
  const tableYear = String(label) < oldest ? oldest : newest;
  return { table: CT_TABLES[tableYear], tableYear };
}

/**
 * When the year's CT is due: 9 months and 1 day after the 31 March year-end,
 * i.e. 1 January of the following calendar year.
 * @returns {string} ISO date.
 */
export function ctPaymentDate(label) {
  return `${fyStartYear(label) + 2}-01-01`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/engine/corporation-tax.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/engine/corporation-tax.js src/engine/corporation-tax.test.js
git commit -m "Add corporation-tax engine: FY tables and calendar helpers

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Engine — `corporationTax` and the inverse `profitForNetDividends`

**Files:**
- Modify: `src/engine/corporation-tax.js` (append)
- Test: `src/engine/corporation-tax.test.js` (append)

**Interfaces:**
- Consumes: `CT_TABLES` from Task 1.
- Produces:
  - `marginalRateAt(profitPence, table): number` — rate on the NEXT pound (0.19 below £50k, 0.265 from £50k to under £250k, 0.25 from £250k).
  - `corporationTax(profitPence, table): { taxPence, reliefPence, band: 'small'|'marginal'|'main', marginalRate, effectiveRate }`
  - `profitForNetDividends(netPence, table): number` — smallest integer profit `P` with `P − corporationTax(P).taxPence ≥ net`.
  - `setAsidePerPound(rate): number` — `rate / (1 − rate)`: pence of CT per pound of dividend at a given profit rate.

- [ ] **Step 1: Write the failing tests**

Append to `src/engine/corporation-tax.test.js` (add the new names to the import at the top):

```js
import {
  // …existing names…
  marginalRateAt,
  corporationTax,
  profitForNetDividends,
  setAsidePerPound,
} from './corporation-tax.js';

const T = CT_TABLES.FY2026;

describe('corporationTax', () => {
  it('matches HMRC worked figures', () => {
    expect(corporationTax(0, T).taxPence).toBe(0);
    expect(corporationTax(1_000_000, T).taxPence).toBe(190_000); // £10k → £1,900
    expect(corporationTax(5_000_000, T).taxPence).toBe(950_000); // £50k → £9,500
    expect(corporationTax(10_000_000, T).taxPence).toBe(2_275_000); // £100k → £22,750
    expect(corporationTax(15_000_000, T).taxPence).toBe(3_600_000); // £150k → £36,000
    expect(corporationTax(25_000_000, T).taxPence).toBe(6_250_000); // £250k → £62,500
    expect(corporationTax(30_000_000, T).taxPence).toBe(7_500_000); // £300k → £75,000
  });

  it('reports the band, the relief, and the rates', () => {
    const small = corporationTax(1_000_000, T);
    expect(small.band).toBe('small');
    expect(small.reliefPence).toBe(0);
    expect(small.marginalRate).toBe(0.19);
    expect(small.effectiveRate).toBeCloseTo(0.19, 10);

    const marginal = corporationTax(10_000_000, T);
    expect(marginal.band).toBe('marginal');
    expect(marginal.reliefPence).toBe(225_000); // 3/200 × £150,000
    expect(marginal.marginalRate).toBeCloseTo(0.265, 10);
    expect(marginal.effectiveRate).toBeCloseTo(0.2275, 10);

    const main = corporationTax(30_000_000, T);
    expect(main.band).toBe('main');
    expect(main.marginalRate).toBe(0.25);
    expect(main.effectiveRate).toBeCloseTo(0.25, 10);
  });

  it('treats exactly £50,000 as small-band profit whose NEXT pound is marginal', () => {
    const edge = corporationTax(5_000_000, T);
    expect(edge.band).toBe('small');
    expect(edge.marginalRate).toBeCloseTo(0.265, 10);
    expect(marginalRateAt(4_999_999, T)).toBe(0.19);
    expect(marginalRateAt(5_000_000, T)).toBeCloseTo(0.265, 10);
    expect(marginalRateAt(24_999_999, T)).toBeCloseTo(0.265, 10);
    expect(marginalRateAt(25_000_000, T)).toBe(0.25);
  });

  it('never returns negative tax and rounds junk to zero', () => {
    expect(corporationTax(-500, T).taxPence).toBe(0);
    expect(corporationTax(undefined, T).taxPence).toBe(0);
    expect(corporationTax(0, T).effectiveRate).toBe(0);
  });
});

describe('profitForNetDividends', () => {
  it('inverts the small band', () => {
    expect(profitForNetDividends(0, T)).toBe(0);
    expect(profitForNetDividends(810_000, T)).toBe(1_000_000); // £8,100 net ← £10,000
    expect(profitForNetDividends(4_050_000, T)).toBe(5_000_000); // £40,500 net ← £50,000
  });

  it('inverts the marginal band', () => {
    expect(profitForNetDividends(7_725_000, T)).toBe(10_000_000); // £77,250 net ← £100,000
    expect(profitForNetDividends(11_400_000, T)).toBe(15_000_000); // £114,000 net ← £150,000
    expect(profitForNetDividends(18_750_000, T)).toBe(25_000_000); // £187,500 net ← £250,000
  });

  it('inverts the main band', () => {
    expect(profitForNetDividends(22_500_000, T)).toBe(30_000_000); // £225,000 net ← £300,000
  });

  it('returns the SMALLEST profit that leaves at least the net, across a sweep', () => {
    const nets = [1, 99, 12_345, 810_001, 4_049_999, 4_050_001, 5_000_000, 7_725_001,
      18_749_999, 18_750_001, 40_000_000];
    for (const net of nets) {
      const p = profitForNetDividends(net, T);
      const netAt = (x) => x - corporationTax(x, T).taxPence;
      expect(netAt(p)).toBeGreaterThanOrEqual(net);
      expect(netAt(p - 1)).toBeLessThan(net);
    }
  });
});

describe('setAsidePerPound', () => {
  it('turns a profit rate into pence of CT per pound of dividend', () => {
    expect(setAsidePerPound(0.19)).toBeCloseTo(0.2346, 4);
    expect(setAsidePerPound(0.265)).toBeCloseTo(0.3605, 4);
    expect(setAsidePerPound(0.25)).toBeCloseTo(0.3333, 4);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engine/corporation-tax.test.js`
Expected: FAIL — `corporationTax is not a function` (and the others).

- [ ] **Step 3: Write the implementation**

Append to `src/engine/corporation-tax.js`:

```js
// ---------------------------------------------------------------------------
// The tax, and its inverse
// ---------------------------------------------------------------------------

/**
 * The CT rate on the NEXT pound of profit at a given profit level: 19% below
 * the lower limit, the marginal-relief rate (main + fraction = 26.5%) from
 * the lower limit up to but not including the upper limit, the main rate
 * from there. Used for "what does one more pound cost" wording.
 */
export function marginalRateAt(profitPence, table) {
  const profit = Math.max(0, Math.round(profitPence || 0));
  if (profit < table.lowerLimitPence) return table.smallRate;
  if (profit < table.upperLimitPence) return table.mainRate + table.marginalReliefFraction;
  return table.mainRate;
}

/**
 * Corporation tax on a full-year profit.
 *
 * In the marginal band HMRC's formula is: main rate on the whole profit, less
 * marginal relief of `fraction × (upper limit − profit)`. Rounded to the
 * penny at the end of each term, never mid-way.
 *
 * @param {number} profitPence - integer pence; negative or junk → 0.
 * @param {object} table - a `CT_TABLES` entry.
 * @returns {{ taxPence: number, reliefPence: number,
 *             band: 'small'|'marginal'|'main', marginalRate: number,
 *             effectiveRate: number }}
 *   `band` follows HMRC's wording (£50,000 "or less" is small; £250,000 "or
 *   more" is main); `marginalRate` is the rate on the next pound, so at
 *   exactly £50,000 it is already 26.5%.
 */
export function corporationTax(profitPence, table) {
  const profit = Math.max(0, Math.round(profitPence || 0));
  const { smallRate, mainRate, lowerLimitPence, upperLimitPence, marginalReliefFraction } = table;

  let band;
  let taxPence;
  let reliefPence = 0;
  if (profit <= lowerLimitPence) {
    band = 'small';
    taxPence = Math.round(profit * smallRate);
  } else if (profit >= upperLimitPence) {
    band = 'main';
    taxPence = Math.round(profit * mainRate);
  } else {
    band = 'marginal';
    reliefPence = Math.round((upperLimitPence - profit) * marginalReliefFraction);
    taxPence = Math.round(profit * mainRate) - reliefPence;
  }

  return {
    taxPence,
    reliefPence,
    band,
    marginalRate: marginalRateAt(profit, table),
    effectiveRate: profit > 0 ? taxPence / profit : 0,
  };
}

/**
 * The smallest integer profit whose after-CT amount is at least `netPence`
 * — i.e. the profit a company must earn to pay that much out as dividends.
 *
 * Closed form per band (net = profit − CT):
 *   small     net = (1 − small) × P                    → P = net / (1 − small)
 *   marginal  net = (1 − main − f) × P + f × upper     → P = (net − f × upper) / (1 − main − f)
 *   main      net = (1 − main) × P                     → P = net / (1 − main)
 * then nudged by a few pence so the rounded tax satisfies the inequality
 * exactly — the ledger total, the CT, and the profit must reconcile to the
 * penny on screen. The profit can leave up to a penny MORE than the net.
 *
 * @param {number} netPence - integer pence of dividends; negative or junk → 0.
 * @returns {number} integer pence of profit.
 */
export function profitForNetDividends(netPence, table) {
  const net = Math.max(0, Math.round(netPence || 0));
  if (net === 0) return 0;
  const { smallRate, mainRate, lowerLimitPence, upperLimitPence, marginalReliefFraction: f } = table;
  const netAt = (p) => p - corporationTax(p, table).taxPence;

  let guess;
  if (net <= netAt(lowerLimitPence)) guess = net / (1 - smallRate);
  else if (net < netAt(upperLimitPence)) guess = (net - f * upperLimitPence) / (1 - mainRate - f);
  else guess = net / (1 - mainRate);

  // Start a couple of pence below the real-valued solution and walk up to the
  // first integer profit that works. Rounding moves the answer by at most a
  // penny or two, so this loop runs a handful of times; the cap is a guard.
  let profit = Math.max(0, Math.floor(guess) - 2);
  for (let i = 0; i < 20 && netAt(profit) < net; i += 1) profit += 1;
  return profit;
}

/**
 * Pence of CT per pound of DIVIDEND at a given rate on profit. £1 of dividend
 * needs £1 / (1 − rate) of profit, of which rate / (1 − rate) is CT:
 * 23.5p at 19%, 36.1p at 26.5%, 33.3p at 25%. This is the number the "keep
 * 20%" rule of thumb gets wrong in the marginal band.
 */
export function setAsidePerPound(rate) {
  return rate / (1 - rate);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/engine/corporation-tax.test.js`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/engine/corporation-tax.js src/engine/corporation-tax.test.js
git commit -m "Corporation-tax engine: tax with marginal relief and the dividend inverse

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Engine — `companyTotals`, `buildCompanyYear`, `previewDraw`

**Files:**
- Modify: `src/engine/corporation-tax.js` (append)
- Test: `src/engine/corporation-tax.test.js` (append)

**Interfaces:**
- Consumes: Task 2 functions.
- Produces:
  - `companyTotals(dividendPence, table): { dividendPence, profitPence, ctPence, effectiveRate, band, marginalRate, averageSetAsidePerPound, marginalSetAsidePerPound, headroomProfitPence, headroomDividendPence }`
  - `buildCompanyYear({ dividendEvents, people, table }): { events, perPerson, ...companyTotals }`
    - `dividendEvents`: `Array<{ id, personId, date, kind, note, amountPence }>` in pence; non-`dividend` kinds are ignored.
    - `people`: `Array<{ id, name }>`.
    - `events`: newest first (date desc, id desc), each with `personName` (`null` if unknown).
    - `perPerson`: `Array<{ personId, name, dividendPence, share }>`, people order, then any unknown personIds with `name: null`.
  - `previewDraw({ dividendPence, extraDividendPence, table }): { before, after, extraDividendPence, extraCtPence, extraProfitPence, rateOnExtraProfit, setAsidePerPound, crossesLowerLimit, crossesUpperLimit }` where `before`/`after` are `companyTotals` results.

- [ ] **Step 1: Write the failing tests**

Append to `src/engine/corporation-tax.test.js` (extend the import with `companyTotals`, `buildCompanyYear`, `previewDraw`):

```js
describe('companyTotals', () => {
  it('reads as zeros with no dividends but still knows the next-pound rate', () => {
    const t = companyTotals(0, T);
    expect(t).toMatchObject({
      dividendPence: 0,
      profitPence: 0,
      ctPence: 0,
      effectiveRate: 0,
      band: 'small',
      marginalRate: 0.19,
      headroomProfitPence: 5_000_000,
      headroomDividendPence: 4_050_000,
    });
    expect(t.averageSetAsidePerPound).toBeCloseTo(0.2346, 4);
    expect(t.marginalSetAsidePerPound).toBeCloseTo(0.2346, 4);
  });

  it('derives profit, CT, and headroom from the dividends', () => {
    const t = companyTotals(810_000, T); // £8,100 drawn
    expect(t.profitPence).toBe(1_000_000);
    expect(t.ctPence).toBe(190_000);
    expect(t.headroomProfitPence).toBe(4_000_000);
    expect(t.headroomDividendPence).toBe(3_240_000); // £40,000 × 81%
    expect(t.averageSetAsidePerPound).toBeCloseTo(190_000 / 810_000, 10);
  });

  it('flips to the marginal band past £50,000 of profit', () => {
    const t = companyTotals(7_725_000, T); // £77,250 drawn ← £100,000 profit
    expect(t.band).toBe('marginal');
    expect(t.profitPence).toBe(10_000_000);
    expect(t.ctPence).toBe(2_275_000);
    expect(t.marginalRate).toBeCloseTo(0.265, 10);
    expect(t.marginalSetAsidePerPound).toBeCloseTo(0.3605, 4);
    expect(t.headroomProfitPence).toBe(0);
    expect(t.headroomDividendPence).toBe(0);
  });
});

describe('buildCompanyYear', () => {
  const people = [
    { id: 1, name: 'Anderson' },
    { id: 2, name: 'Wife' },
  ];
  const events = [
    { id: 10, personId: 1, date: '2026-05-01', kind: 'dividend', note: 'Q1', amountPence: 540_000 },
    { id: 11, personId: 2, date: '2026-05-01', kind: 'dividend', note: '', amountPence: 270_000 },
    { id: 12, personId: 1, date: '2026-08-01', kind: 'sipp-contribution', note: '', amountPence: 100_000 },
    { id: 13, personId: 2, date: '2026-04-15', kind: 'dividend', note: '', amountPence: 100 },
  ];

  it('pools both people, ignores other kinds, and orders newest first', () => {
    const year = buildCompanyYear({ dividendEvents: events, people, table: T });
    expect(year.events.map((e) => e.id)).toEqual([11, 10, 13]);
    expect(year.events[0].personName).toBe('Wife');
    expect(year.dividendPence).toBe(810_100);
    expect(year.profitPence).toBe(profitForNetDividends(810_100, T));
    expect(year.ctPence).toBe(corporationTax(year.profitPence, T).taxPence);
  });

  it('splits the total per person in people order, with shares', () => {
    const year = buildCompanyYear({ dividendEvents: events, people, table: T });
    expect(year.perPerson).toEqual([
      { personId: 1, name: 'Anderson', dividendPence: 540_000, share: 540_000 / 810_100 },
      { personId: 2, name: 'Wife', dividendPence: 270_100, share: 270_100 / 810_100 },
    ]);
  });

  it('keeps counting a dividend whose person is unknown', () => {
    const year = buildCompanyYear({
      dividendEvents: [{ id: 1, personId: 99, date: '2026-05-01', kind: 'dividend', amountPence: 100 }],
      people,
      table: T,
    });
    expect(year.dividendPence).toBe(100);
    expect(year.events[0].personName).toBe(null);
    expect(year.perPerson).toEqual([
      { personId: 1, name: 'Anderson', dividendPence: 0, share: 0 },
      { personId: 2, name: 'Wife', dividendPence: 0, share: 0 },
      { personId: 99, name: null, dividendPence: 100, share: 1 },
    ]);
  });

  it('is empty-safe', () => {
    const year = buildCompanyYear({ table: T });
    expect(year.events).toEqual([]);
    expect(year.perPerson).toEqual([]);
    expect(year.dividendPence).toBe(0);
  });
});

describe('previewDraw', () => {
  it('prices a draw that stays in the small band', () => {
    const p = previewDraw({ dividendPence: 810_000, extraDividendPence: 100_000, table: T });
    expect(p.before.profitPence).toBe(1_000_000);
    expect(p.after.dividendPence).toBe(910_000);
    expect(p.after.profitPence).toBe(1_123_457); // £11,234.57
    expect(p.after.ctPence).toBe(213_457);
    expect(p.extraCtPence).toBe(23_457); // £234.57
    expect(p.extraProfitPence).toBe(123_457);
    expect(p.rateOnExtraProfit).toBeCloseTo(0.19, 3);
    expect(p.setAsidePerPound).toBeCloseTo(0.2346, 3);
    expect(p.crossesLowerLimit).toBe(false);
    expect(p.crossesUpperLimit).toBe(false);
  });

  it('flags and blends a draw that crosses £50,000 of profit', () => {
    // £40,000 drawn (£49,382.72 profit) + £5,000 → past the lower limit.
    const p = previewDraw({ dividendPence: 4_000_000, extraDividendPence: 500_000, table: T });
    expect(p.before.band).toBe('small');
    expect(p.after.band).toBe('marginal');
    expect(p.crossesLowerLimit).toBe(true);
    expect(p.rateOnExtraProfit).toBeGreaterThan(0.19);
    expect(p.rateOnExtraProfit).toBeLessThan(0.265);
  });

  it('prices a main-band draw at 25%', () => {
    const p = previewDraw({ dividendPence: 22_500_000, extraDividendPence: 750_000, table: T });
    expect(p.extraProfitPence).toBe(1_000_000);
    expect(p.extraCtPence).toBe(250_000);
    expect(p.rateOnExtraProfit).toBeCloseTo(0.25, 10);
  });

  it('treats a zero or junk draw as no change', () => {
    const p = previewDraw({ dividendPence: 810_000, extraDividendPence: null, table: T });
    expect(p.extraDividendPence).toBe(0);
    expect(p.extraCtPence).toBe(0);
    expect(p.after).toEqual(p.before);
    expect(p.rateOnExtraProfit).toBe(0.19);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engine/corporation-tax.test.js`
Expected: FAIL — `companyTotals is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `src/engine/corporation-tax.js`:

```js
// ---------------------------------------------------------------------------
// The company-year build
// ---------------------------------------------------------------------------

/**
 * Everything the headline needs from one number: the year's dividends.
 *
 * @param {number} dividendPence - integer pence drawn so far.
 * @param {object} table - a `CT_TABLES` entry.
 * @returns {{ dividendPence, profitPence, ctPence, effectiveRate, band,
 *   marginalRate, averageSetAsidePerPound, marginalSetAsidePerPound,
 *   headroomProfitPence, headroomDividendPence }}
 *   `headroom*` are how much more profit / how many more pounds of dividend
 *   fit under the £50k line (zero once past it). `averageSetAsidePerPound` is
 *   CT ÷ dividends for the year so far; with nothing drawn it reads as the
 *   marginal figure so the screen never shows a meaningless 0.
 */
export function companyTotals(dividendPence, table) {
  const dividends = Math.max(0, Math.round(dividendPence || 0));
  const profitPence = profitForNetDividends(dividends, table);
  const ct = corporationTax(profitPence, table);
  const marginalSetAsidePerPound = setAsidePerPound(ct.marginalRate);
  const headroomProfitPence = Math.max(0, table.lowerLimitPence - profitPence);
  return {
    dividendPence: dividends,
    profitPence,
    ctPence: ct.taxPence,
    effectiveRate: ct.effectiveRate,
    band: ct.band,
    marginalRate: ct.marginalRate,
    averageSetAsidePerPound: dividends > 0 ? ct.taxPence / dividends : marginalSetAsidePerPound,
    marginalSetAsidePerPound,
    headroomProfitPence,
    headroomDividendPence: Math.round(headroomProfitPence * (1 - table.smallRate)),
  };
}

/** Events newest first: by date, then by id so a same-day pair is stable. */
function newestFirst(events) {
  return [...events].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.id ?? 0) - (a.id ?? 0);
  });
}

/**
 * Pool a company year's dividend events (both people draw from the same
 * company) and work out the profit and CT they imply.
 *
 * Nothing here is persisted: the Company screen recomputes this on every
 * read, per the "never persist computed rows" rule.
 *
 * @param {object} args
 * @param {Array<{ id?: number, personId: number, date: string, kind: string,
 *   note?: string, amountPence: number }>} [args.dividendEvents] - integer
 *   pence; anything whose `kind` is not `'dividend'` is ignored, so a caller
 *   may pass a year's whole event list.
 * @param {Array<{ id: number, name: string }>} [args.people] - names the
 *   events and orders the per-person split.
 * @param {object} args.table - a `CT_TABLES` entry.
 * @returns {{ events: Array<object>, perPerson: Array<object> } & ReturnType<typeof companyTotals>}
 */
export function buildCompanyYear({ dividendEvents = [], people = [], table }) {
  const nameOf = new Map(people.map((p) => [p.id, p.name]));

  const events = newestFirst(
    dividendEvents
      .filter((e) => e.kind === 'dividend')
      .map((e) => ({
        ...e,
        amountPence: Math.max(0, Math.round(e.amountPence || 0)),
        personName: nameOf.get(e.personId) ?? null,
      }))
  );

  const byPerson = new Map(people.map((p) => [p.id, 0]));
  let dividendPence = 0;
  for (const e of events) {
    dividendPence += e.amountPence;
    byPerson.set(e.personId, (byPerson.get(e.personId) || 0) + e.amountPence);
  }

  // People in the order given, then any personId the events mention that is
  // not in the list (should not happen — deleting a person cascades to their
  // events — but the total must still add up if it does).
  const perPerson = [...byPerson.entries()].map(([personId, pence]) => ({
    personId,
    name: nameOf.get(personId) ?? null,
    dividendPence: pence,
    share: dividendPence > 0 ? pence / dividendPence : 0,
  }));

  return { events, perPerson, ...companyTotals(dividendPence, table) };
}

/**
 * "If I draw £X more": the company picture before and after.
 *
 * @param {object} args
 * @param {number} args.dividendPence - integer pence drawn so far this year.
 * @param {number} args.extraDividendPence - the proposed draw; junk → 0.
 * @param {object} args.table - a `CT_TABLES` entry.
 * @returns {{ before: object, after: object, extraDividendPence: number,
 *   extraCtPence: number, extraProfitPence: number, rateOnExtraProfit: number,
 *   setAsidePerPound: number, crossesLowerLimit: boolean,
 *   crossesUpperLimit: boolean }}
 *   `rateOnExtraProfit` is blended when the draw straddles a band edge;
 *   `setAsidePerPound` is CT per £1 of THIS draw.
 */
export function previewDraw({ dividendPence, extraDividendPence, table }) {
  const extra = Math.max(0, Math.round(extraDividendPence || 0));
  const before = companyTotals(dividendPence, table);
  const after = companyTotals(before.dividendPence + extra, table);
  const extraCtPence = after.ctPence - before.ctPence;
  const extraProfitPence = after.profitPence - before.profitPence;
  return {
    before,
    after,
    extraDividendPence: extra,
    extraCtPence,
    extraProfitPence,
    rateOnExtraProfit: extraProfitPence > 0 ? extraCtPence / extraProfitPence : after.marginalRate,
    setAsidePerPound: extra > 0 ? extraCtPence / extra : after.marginalSetAsidePerPound,
    crossesLowerLimit:
      before.profitPence < table.lowerLimitPence && after.profitPence > table.lowerLimitPence,
    crossesUpperLimit:
      before.profitPence < table.upperLimitPence && after.profitPence > table.upperLimitPence,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/engine/corporation-tax.test.js`
Expected: PASS, 26 tests.

- [ ] **Step 5: Commit**

```bash
git add src/engine/corporation-tax.js src/engine/corporation-tax.test.js
git commit -m "Corporation-tax engine: company-year build and draw preview

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Adapter — `gatherCompanyData`

**Files:**
- Create: `src/db/companyData.js`
- Test: `src/db/companyData.test.js`

**Interfaces:**
- Consumes: `peopleRepo.getAll()` and `incomeEventsRepo.between(start, end)` (both **pounds** at the edge, from `src/db/repositories.js`); `toPence` from `src/engine/currency.js`; Task 1 and Task 3 engine functions.
- Produces: `gatherCompanyData(fyLabel: string): Promise<{ financialYear, tableYear, startDate, endDate, table, paymentDate, people: Array<{ id, name }>, events, perPerson, ...companyTotals }>` — all money in **pence**.

- [ ] **Step 1: Write the failing tests**

Create `src/db/companyData.test.js`:

```js
/**
 * Adapter test for the Company tab: write people and dividend events through
 * the REAL repositories (real Dexie over fake-indexeddb) and check the pounds
 * → pence edge, the company-year (1 Apr – 31 Mar) range read, and the CT
 * figures that come back.
 */
import { resetDb } from './test-utils.js';
import { describe, it, expect, beforeEach } from 'vitest';
import { peopleRepo, incomeEventsRepo } from './repositories.js';
import { gatherCompanyData } from './companyData.js';

beforeEach(resetDb);

/** Add a dividend through the repo (pounds at the edge). */
const addDividend = (personId, date, pounds, note = '') =>
  incomeEventsRepo.add({ personId, date, kind: 'dividend', amountPence: pounds, note });

describe('gatherCompanyData', () => {
  it('returns an empty year with no people or dividends', async () => {
    const data = await gatherCompanyData('FY2026');
    expect(data.financialYear).toBe('FY2026');
    expect(data.tableYear).toBe('FY2026');
    expect(data.startDate).toBe('2026-04-01');
    expect(data.endDate).toBe('2027-03-31');
    expect(data.paymentDate).toBe('2028-01-01');
    expect(data.people).toEqual([]);
    expect(data.events).toEqual([]);
    expect(data.dividendPence).toBe(0);
    expect(data.ctPence).toBe(0);
  });

  it('pools both people, converts pounds to pence, and derives profit + CT', async () => {
    const a = await peopleRepo.add({ name: 'Anderson' });
    const b = await peopleRepo.add({ name: 'Wife' });
    await addDividend(a, '2026-05-01', 5400, 'Q1');
    await addDividend(b, '2026-06-01', 2700);

    const data = await gatherCompanyData('FY2026');
    expect(data.people).toEqual([
      { id: a, name: 'Anderson' },
      { id: b, name: 'Wife' },
    ]);
    expect(data.dividendPence).toBe(810_000);
    expect(data.profitPence).toBe(1_000_000);
    expect(data.ctPence).toBe(190_000);
    expect(data.events.map((e) => [e.personName, e.amountPence, e.note])).toEqual([
      ['Wife', 270_000, ''],
      ['Anderson', 540_000, 'Q1'],
    ]);
    expect(data.perPerson.map((p) => p.dividendPence)).toEqual([540_000, 270_000]);
  });

  it('only reads dividends inside the company year (1 Apr – 31 Mar)', async () => {
    const a = await peopleRepo.add({ name: 'Anderson' });
    await addDividend(a, '2026-03-31', 1000); // last day of FY2025
    await addDividend(a, '2026-04-01', 10); // first day of FY2026
    await addDividend(a, '2027-03-31', 10); // last day of FY2026
    await addDividend(a, '2027-04-01', 1000); // first day of FY2027

    expect((await gatherCompanyData('FY2026')).dividendPence).toBe(2000);
    expect((await gatherCompanyData('FY2025')).dividendPence).toBe(100_000);
    expect((await gatherCompanyData('FY2027')).dividendPence).toBe(100_000);
  });

  it('ignores non-dividend income events', async () => {
    const a = await peopleRepo.add({ name: 'Anderson' });
    await addDividend(a, '2026-05-01', 100);
    await incomeEventsRepo.add({ personId: a, date: '2026-05-02', kind: 'sipp-contribution', amountPence: 500 });
    await incomeEventsRepo.add({ personId: a, date: '2026-05-03', kind: 'other-income', amountPence: 500 });
    await incomeEventsRepo.add({ personId: a, date: '2026-05-04', kind: 'salary-adjustment', amountPence: -50 });

    const data = await gatherCompanyData('FY2026');
    expect(data.events).toHaveLength(1);
    expect(data.dividendPence).toBe(10_000);
  });

  it('flags a rate-table fallback for an unseeded year', async () => {
    const data = await gatherCompanyData('FY2020');
    expect(data.tableYear).toBe('FY2023');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/db/companyData.test.js`
Expected: FAIL — `Failed to resolve import "./companyData.js"`.

- [ ] **Step 3: Write the implementation**

Create `src/db/companyData.js`:

```js
/**
 * companyData.js — thin adapter that gathers what the Company tab needs and
 * converts it from the repository POUNDS edge into the PENCE domain the pure
 * corporation-tax engine works in (the `mileageData.js` / `incomeData.js`
 * pattern: this is the ONLY place pounds→pence conversion happens for the
 * company screen).
 *
 * The dividend rows ARE the Income tab's `incomeEvents` (kind `dividend`):
 * both people draw from the same company, so the company year is simply
 * every dividend event from everyone, re-cut on the 1 April boundary.
 */

import { peopleRepo, incomeEventsRepo } from './repositories.js';
import { toPence } from '../engine/currency.js';
import {
  financialYearBounds,
  financialYearTable,
  ctPaymentDate,
  buildCompanyYear,
} from '../engine/corporation-tax.js';

/**
 * Read one company year's dividends from both people and return a
 * pence-domain snapshot: the ledger (newest first, named), the per-person
 * split, and the profit / CT / headroom figures those dividends imply.
 * Nothing here is ever persisted — computed at read time, per the hard rules.
 *
 * @param {string} fyLabel - e.g. "FY2026" (1 Apr 2026 – 31 Mar 2027).
 * @returns {Promise<object>} `tableYear` differs from `financialYear` when the
 *   rules fell back to the nearest known table.
 */
export async function gatherCompanyData(fyLabel) {
  const { startDate, endDate } = financialYearBounds(fyLabel);
  const { table, tableYear } = financialYearTable(fyLabel);

  const [peopleRaw, eventsRaw] = await Promise.all([
    peopleRepo.getAll(), // pounds at the edge — only id + name are needed here
    incomeEventsRepo.between(startDate, endDate), // pounds at the edge
  ]);

  const people = peopleRaw.map((p) => ({ id: p.id, name: p.name }));
  const dividendEvents = eventsRaw
    .filter((e) => e.kind === 'dividend')
    .map((e) => ({
      id: e.id,
      personId: e.personId,
      date: e.date,
      kind: e.kind,
      note: e.note ?? '',
      amountPence: toPence(e.amountPence), // pounds → pence
    }));

  return {
    financialYear: fyLabel,
    tableYear,
    startDate,
    endDate,
    table,
    paymentDate: ctPaymentDate(fyLabel),
    people,
    ...buildCompanyYear({ dividendEvents, people, table }), // events, perPerson, totals
  };
}

export default gatherCompanyData;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/db/companyData.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/db/companyData.js src/db/companyData.test.js
git commit -m "Add companyData adapter: pool dividends by company year

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Adapter — `previewPersonalDraw`

**Files:**
- Modify: `src/db/companyData.js` (append)
- Test: `src/db/companyData.test.js` (append)

**Interfaces:**
- Consumes: `gatherIncomeData(taxYearLabel)` from `src/db/incomeData.js` (returns `{ taxYear, tableYear, table, people: [{ id, name, input, summary, … }] }` in pence); `taxYearForDate`, `computePersonTax` from `src/engine/tax.js`.
- Produces: `previewPersonalDraw({ personId, amountPence, date }): Promise<null | { taxYear, tableYear, personId, name, before, after, extraTaxPence, netInHandPence }>` where `before`/`after` are `computePersonTax` results (`totalTaxPence`, `selfAssessmentTaxPence`, `headroomToHigherRatePence`, `headroomTo100kPence`, `over100k`, `overHigherRate`, `grossIncomePence`…). `null` when the person does not exist.

- [ ] **Step 1: Write the failing tests**

Append to `src/db/companyData.test.js` (extend the imports):

```js
import { previewPersonalDraw } from './companyData.js';
import { computePersonTax, taxYearTable } from '../engine/tax.js';
import { gatherIncomeData } from './incomeData.js';

describe('previewPersonalDraw', () => {
  it('picks the PERSONAL tax year from the draw date and diffs the tax', async () => {
    // £50,000 salary via the legacy annual field (no timeline rows needed).
    // £30,000 salary keeps the draw inside the basic band with 40% headroom to spare.
    const a = await peopleRepo.add({ name: 'Anderson', annualSalaryPence: 30000 });
    await addDividend(a, '2026-05-01', 2000);

    const preview = await previewPersonalDraw({ personId: a, amountPence: 1_000_000, date: '2026-07-01' });
    expect(preview.taxYear).toBe('2026-27');
    expect(preview.name).toBe('Anderson');

    // Must equal a direct engine diff on the same year input.
    const income = await gatherIncomeData('2026-27');
    const person = income.people.find((p) => p.id === a);
    const { table } = taxYearTable('2026-27');
    const after = computePersonTax(
      { ...person.input, dividendPence: person.input.dividendPence + 1_000_000 },
      table
    );
    expect(preview.before.totalTaxPence).toBe(person.summary.totalTaxPence);
    expect(preview.after.totalTaxPence).toBe(after.totalTaxPence);
    expect(preview.extraTaxPence).toBe(after.totalTaxPence - person.summary.totalTaxPence);
    expect(preview.extraTaxPence).toBeGreaterThan(0);
    expect(preview.netInHandPence).toBe(1_000_000 - preview.extraTaxPence);
    expect(preview.after.headroomToHigherRatePence).toBeLessThan(
      preview.before.headroomToHigherRatePence
    );
  });

  it('uses the earlier tax year for a draw dated 1–5 April', async () => {
    const a = await peopleRepo.add({ name: 'Anderson' });
    const preview = await previewPersonalDraw({ personId: a, amountPence: 100, date: '2026-04-03' });
    expect(preview.taxYear).toBe('2025-26');
  });

  it('returns null for an unknown person', async () => {
    expect(await previewPersonalDraw({ personId: 999, amountPence: 100, date: '2026-07-01' })).toBe(null);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/db/companyData.test.js`
Expected: FAIL — `previewPersonalDraw is not a function` (import resolves to undefined).

- [ ] **Step 3: Write the implementation**

Append to `src/db/companyData.js` (add the two imports near the top):

```js
import { gatherIncomeData } from './incomeData.js';
import { taxYearForDate, computePersonTax } from '../engine/tax.js';

/**
 * The PERSONAL side of "if I draw £X": the drawing person's income-tax
 * position before and after, in the personal tax year (6 Apr – 5 Apr)
 * containing the draw date — which is not the company year. No dividend-tax
 * logic lives here: the person's existing year input from the Income engine
 * gets the draw added to its dividends and is recomputed.
 *
 * @param {object} args
 * @param {number} args.personId
 * @param {number} args.amountPence - integer pence of the proposed dividend.
 * @param {string} args.date - ISO yyyy-MM-dd the dividend would be dated.
 * @returns {Promise<null | { taxYear: string, tableYear: string, personId: number,
 *   name: string, before: object, after: object, extraTaxPence: number,
 *   netInHandPence: number }>} `extraTaxPence` is the change in the person's
 *   TOTAL tax, so it includes any personal-allowance taper the draw triggers.
 *   `null` when the person does not exist.
 */
export async function previewPersonalDraw({ personId, amountPence, date }) {
  const taxYear = taxYearForDate(date);
  const income = await gatherIncomeData(taxYear);
  const person = income.people.find((p) => p.id === personId);
  if (!person) return null;

  const extra = Math.max(0, Math.round(amountPence || 0));
  const before = person.summary;
  const after = computePersonTax(
    { ...person.input, dividendPence: person.input.dividendPence + extra },
    income.table
  );
  const extraTaxPence = after.totalTaxPence - before.totalTaxPence;

  return {
    taxYear,
    tableYear: income.tableYear,
    personId,
    name: person.name,
    before,
    after,
    extraTaxPence,
    netInHandPence: extra - extraTaxPence,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/db/companyData.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/db/companyData.js src/db/companyData.test.js
git commit -m "companyData: personal-side preview of a dividend draw via the Income engine

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: UI — Company tab shell, summary panel, App registration

**Files:**
- Create: `src/ui/company/format.js`
- Create: `src/ui/company/CompanySummary.jsx`
- Create: `src/ui/Company.jsx`
- Modify: `src/App.jsx` (the `TABS` array)
- Modify: `src/styles.css` (append)
- Test: `src/ui/company/companyRender.test.jsx`

**Interfaces:**
- Consumes: `gatherCompanyData` (Task 4); `financialYearForDate`, `shiftFinancialYear`, `financialYearBounds` (Task 1); existing `useLiveData`, `Money` (`pence` prop), `EmptyState`, `formatDay`.
- Produces:
  - `format.js`: `formatRate(rate, dp = 1): string` → `'26.5%'`; `formatPerPound(rate): string` → `'36.1p'`; `fyTitle(label): string` → `'FY2026'` (the label as shown; kept as a function so the display can change in one place).
  - `CompanySummary({ data })` — `data` is the `gatherCompanyData` snapshot.
  - `Company()` — the tab; later tasks add the ledger and calculator into its body where marked.

- [ ] **Step 1: Write the failing render tests**

Create `src/ui/company/companyRender.test.jsx`:

```jsx
/**
 * Integration smoke test for the Company tab: seed people and dividend
 * events through the REAL repositories (real Dexie over fake-indexeddb) and
 * render the real Company component. Confirms the profit / CT figures reach
 * the screen.
 *
 * The tab opens on whatever company year "today" falls in, so events are
 * seeded relative to that rather than to a hard-coded date.
 */
import { resetDb } from '../../db/test-utils.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { peopleRepo, incomeEventsRepo } from '../../db/repositories.js';
import { financialYearForDate, financialYearBounds } from '../../engine/corporation-tax.js';
import Company from '../Company.jsx';

const TODAY = new Date().toISOString().slice(0, 10);
const CURRENT_FY = financialYearForDate(TODAY);
const { startDate } = financialYearBounds(CURRENT_FY);
/** An ISO date `days` after the start of the current company year. */
const inYear = (days) => {
  const d = new Date(`${startDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

beforeEach(resetDb);
afterEach(cleanup);

describe('Company tab (seeded)', () => {
  it('points to the Income tab when there are no people', async () => {
    render(<Company />);
    expect(await screen.findByText(/No people yet/)).toBeTruthy();
    expect(screen.getByText(/Income tab/)).toBeTruthy();
  });

  it('renders the CT summary from the pooled dividends', async () => {
    const a = await peopleRepo.add({ name: 'Anderson' });
    const b = await peopleRepo.add({ name: 'Wife' });
    // £5,400 + £2,700 = £8,100 net ← £10,000 profit, £1,900 CT.
    await incomeEventsRepo.add({ personId: a, date: inYear(10), kind: 'dividend', amountPence: 5400, note: 'Q1' });
    await incomeEventsRepo.add({ personId: b, date: inYear(11), kind: 'dividend', amountPence: 2700 });

    render(<Company />);

    expect(await screen.findByText('Dividends drawn')).toBeTruthy();
    expect(screen.getByText(new RegExp(`Company year ${CURRENT_FY}`))).toBeTruthy();
    expect(screen.getByText('Corporation tax to set aside')).toBeTruthy();
    expect(screen.getAllByText('£8,100.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('£1,900.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('£10,000.00').length).toBeGreaterThan(0);
    // Still in the small band: £40,000 of profit headroom = £32,400 of dividends.
    // The headroom is a <Money> span inside the sentence, so match on the
    // sentence element's full textContent rather than its own text nodes.
    expect(
      screen.getByText(
        (_, el) => el.tagName === 'SPAN' && /£32,400\.00 more in dividends/.test(el.textContent)
      )
    ).toBeTruthy();
    expect(screen.getByText(/Next £1 of profit is taxed at 19.0%/)).toBeTruthy();
    // Per-person split.
    expect(screen.getAllByText('Anderson').length).toBeGreaterThan(0);
    expect(screen.getAllByText('£5,400.00').length).toBeGreaterThan(0);
  });

  it('flips the band meter once profit passes £50,000', async () => {
    const a = await peopleRepo.add({ name: 'Anderson' });
    // £77,250 net ← £100,000 profit.
    await incomeEventsRepo.add({ personId: a, date: inYear(10), kind: 'dividend', amountPence: 77250 });

    render(<Company />);

    expect(await screen.findByText(/Past £50,000.00 of profit/)).toBeTruthy();
    expect(screen.getByText(/each further pound costs 26.5%/)).toBeTruthy();
    expect(screen.getAllByText('£22,750.00').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/company/companyRender.test.jsx`
Expected: FAIL — `Failed to resolve import "../Company.jsx"`.

- [ ] **Step 3: Write the format helpers**

Create `src/ui/company/format.js`:

```js
/**
 * Display helpers shared by the Company screens. Rates arrive as fractions
 * (0.265) from the engine; money arrives as pence and goes through <Money>.
 */

/** 0.265 → "26.5%". */
export function formatRate(rate, dp = 1) {
  return `${((rate || 0) * 100).toFixed(dp)}%`;
}

/** 0.3605 → "36.1p" — pence of CT per £1 of dividend. */
export function formatPerPound(rate) {
  return `${((rate || 0) * 100).toFixed(1)}p`;
}

/** The company-year label as shown ("FY2026"); one place to change it. */
export function fyTitle(label) {
  return String(label);
}
```

- [ ] **Step 4: Write the summary panel**

Create `src/ui/company/CompanySummary.jsx`:

```jsx
import Money from '../components/Money.jsx';
import { formatGBP } from '../../engine/currency.js';
import { formatDay } from '../components/dates.js';
import { formatRate, formatPerPound } from './format.js';

/**
 * The £50,000 small-profits meter: how far the year's implied profit is
 * from the marginal band, and what the next pound costs once past it.
 *
 * The statutory limits are public constants, so they are plain text via
 * `formatGBP` rather than <Money> — the privacy blur is for the owner's own
 * figures, and plain text keeps each sentence one text run for the tests.
 */
function BandMeter({ data }) {
  const { profitPence, band, marginalRate, headroomDividendPence, table } = data;
  const lower = formatGBP(table.lowerLimitPence);
  const upper = formatGBP(table.upperLimitPence);
  const pct = Math.min(100, Math.round((profitPence / table.lowerLimitPence) * 100));
  const over = band !== 'small';
  return (
    <div className={`util threshold${over ? ' threshold--over' : ''}`}>
      <div className="util__label threshold__head">
        <span>{lower} small-profits limit</span>
        <span className="threshold__pct">{pct}%</span>
      </div>
      <div className="util__bar">
        <div className="util__fill threshold__fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="util__label">
        {band === 'small' && (
          <span>
            Next £1 of profit is taxed at {formatRate(marginalRate)} — ≈{' '}
            <Money pence={headroomDividendPence} /> more in dividends before the marginal band.
          </span>
        )}
        {band === 'marginal' && (
          <span className="threshold__over">
            Past {lower} of profit — each further pound costs {formatRate(marginalRate)} (
            {formatPerPound(data.marginalSetAsidePerPound)} per £1 of dividend) until {upper}.
          </span>
        )}
        {band === 'main' && (
          <span className="threshold__over">
            Past {upper} of profit — the {formatRate(marginalRate)} main rate applies to all of
            it.
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * The company-year headline: dividends drawn by both people, the profit
 * those dividends imply, the corporation tax to set aside, where the year
 * sits against the £50k line, and who drew what. Everything is computed at
 * read time by `gatherCompanyData`.
 *
 * @param {object} props.data - the `gatherCompanyData` snapshot (pence).
 */
export default function CompanySummary({ data }) {
  const { dividendPence, profitPence, ctPence, effectiveRate, perPerson, paymentDate } = data;

  return (
    <section className="panel company-summary">
      <div className="kpi-row">
        <div className="stat">
          <span className="stat__label">Dividends drawn</span>
          <span className="stat__value">
            <Money pence={dividendPence} />
          </span>
          <span className="stat__sub muted">Both people, this company year</span>
        </div>
        <div className="stat">
          <span className="stat__label">Corporation tax to set aside</span>
          <span className="stat__value">
            <Money pence={ctPence} />
          </span>
          <span className="stat__sub muted">Due {formatDay(paymentDate)}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Profit required</span>
          <span className="stat__value">
            <Money pence={profitPence} />
          </span>
          <span className="stat__sub muted">Dividends + CT</span>
        </div>
        <div className="stat">
          <span className="stat__label">Effective CT rate</span>
          <span className="stat__value">{formatRate(effectiveRate)}</span>
          <span className="stat__sub muted">
            {formatPerPound(data.averageSetAsidePerPound)} per £1 drawn so far ·{' '}
            {formatPerPound(data.marginalSetAsidePerPound)} on the next £1
          </span>
        </div>
      </div>

      <BandMeter data={data} />

      {perPerson.length > 0 && (
        <div className="table-wrap">
          <table className="table company-split">
            <thead>
              <tr>
                <th>Person</th>
                <th className="num">Dividends</th>
                <th className="num">Share</th>
              </tr>
            </thead>
            <tbody>
              {perPerson.map((p) => (
                <tr key={p.personId}>
                  <td>{p.name ?? <span className="muted">Unknown person</span>}</td>
                  <td className="num">
                    <Money pence={p.dividendPence} />
                  </td>
                  <td className="num">{formatRate(p.share, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Write the tab shell**

Create `src/ui/Company.jsx`:

```jsx
import { useState } from 'react';
import { useLiveData } from '../db/useLiveData.js';
import { gatherCompanyData } from '../db/companyData.js';
import {
  financialYearForDate,
  shiftFinancialYear,
  financialYearBounds,
} from '../engine/corporation-tax.js';
import EmptyState from './components/EmptyState.jsx';
import { formatDay } from './components/dates.js';
import CompanySummary from './company/CompanySummary.jsx';
import { fyTitle } from './company/format.js';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Company tab (spec amendment 2026-09-12 (j)) — corporation tax on the
 * dividends both people draw from the same limited company. A dividend can
 * only be paid out of profit AFTER corporation tax, so the dividends drawn
 * in a company year (1 April – 31 March, the owner's year-end) imply a
 * profit and a CT bill; this screen shows both, where the year sits against
 * the £50,000 small-profits line, and — via the draw calculator — what one
 * more dividend would cost the company and the person drawing it.
 *
 * The ledger IS the Income tab's dividend events. Nothing is stored here:
 * profit, CT, and previews are computed at read time by `gatherCompanyData`,
 * per the "never persist computed rows" rule.
 */
export default function Company() {
  const [fy, setFy] = useState(() => financialYearForDate(today()));

  const { data, loading } = useLiveData(() => gatherCompanyData(fy), [fy]);

  const currentFy = financialYearForDate(today());
  const bounds = financialYearBounds(fy);
  const people = data?.people ?? [];

  return (
    <div className="screen">
      <header className="screen__head">
        <h2>Company</h2>
        <div className="screen__head-actions">
          <div className="taxyear-nav" role="group" aria-label="Company year">
            <button
              type="button"
              className="btn btn--sm"
              aria-label="Previous company year"
              onClick={() => setFy((y) => shiftFinancialYear(y, -1))}
            >
              ‹
            </button>
            <span className="taxyear-nav__label">
              Company year {fyTitle(fy)}
              <span className="muted taxyear-nav__dates">
                {formatDay(bounds.startDate)} – {formatDay(bounds.endDate)}
              </span>
            </span>
            <button
              type="button"
              className="btn btn--sm"
              aria-label="Next company year"
              onClick={() => setFy((y) => shiftFinancialYear(y, 1))}
            >
              ›
            </button>
            {fy !== currentFy && (
              <button type="button" className="btn btn--sm" onClick={() => setFy(currentFy)}>
                Today
              </button>
            )}
          </div>
          {/* Task 7 adds the "Record dividend" button here. */}
        </div>
      </header>

      {data && data.tableYear !== data.financialYear && (
        <p className="banner banner--info">
          No corporation-tax rules recorded for {fyTitle(data.financialYear)} — figures use
          the {fyTitle(data.tableYear)} rules.
        </p>
      )}

      {loading && !data ? (
        <p className="muted">Loading…</p>
      ) : people.length === 0 ? (
        <EmptyState
          title="No people yet"
          hint="Add yourself and your wife on the Income tab first. Every dividend recorded there is pooled here as a draw from the company."
        />
      ) : (
        <>
          <CompanySummary data={data} />
          {/* Task 8 adds <DrawCalculator> here. */}
          {/* Task 7 adds <DividendLedger> here. */}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Register the tab and add the styles**

In `src/App.jsx`, add the import after the Mileage import and the tab after the mileage entry:

```jsx
import Company from './ui/Company.jsx';
// …
const TABS = [
  { id: 'dashboard', label: 'Dashboard', Component: Dashboard },
  { id: 'income', label: 'Income', Component: Income },
  { id: 'expenses', label: 'Expenses', Component: Expenses },
  { id: 'payoff', label: 'Payoff', Component: Payoff },
  { id: 'childcare', label: 'Childcare', Component: Childcare },
  { id: 'mileage', label: 'Mileage', Component: Mileage },
  { id: 'company', label: 'Company', Component: Company },
];
```

Append to the end of `src/styles.css`:

```css

/* Company tab — corporation tax on dividends */
.company-summary {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.company-split td,
.company-split th {
  padding: 0.35rem 0.6rem;
}
.company-ledger {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}
.company-ledger__actions {
  text-align: right;
  white-space: nowrap;
}
.company-calc {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.company-calc__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
  gap: 1rem;
}
.company-calc__sentence {
  margin: 0;
  font-weight: 600;
}
.company-calc h3 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
}
.compare td,
.compare th {
  padding: 0.3rem 0.6rem;
}
.compare__after {
  font-weight: 600;
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/ui/company/companyRender.test.jsx`
Expected: PASS, 3 tests.

Testing-library's default text matcher looks only at an element's own text nodes, so a sentence containing a `<Money>` span only matches on the text either side of it. The tests above are written for that: plain regexes where the phrase is one text run, and a function matcher on `textContent` where a `<Money>` sits inside the phrase. Keep sentences shaped as written.

- [ ] **Step 8: Commit**

```bash
git add src/ui/Company.jsx src/ui/company/format.js src/ui/company/CompanySummary.jsx src/ui/company/companyRender.test.jsx src/App.jsx src/styles.css
git commit -m "Add the Company tab: FY navigator and corporation-tax summary

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: UI — dividend ledger and the record / edit / delete dialogs

**Files:**
- Create: `src/ui/company/DividendForm.jsx`
- Create: `src/ui/company/DividendLedger.jsx`
- Modify: `src/ui/Company.jsx` (fill the two Task 7 markers, add state + handlers)
- Test: `src/ui/company/companyRender.test.jsx` (append)

**Interfaces:**
- Consumes: `EventForm` from `src/ui/income/EventForm.jsx` (`{ kind, initial, onSubmit(payload: { date, kind, amountPence (pounds), note }), onCancel }`); `incomeEventsRepo.add / update / delete / get` (pounds at the edge); `Modal({ title, onClose })`; `ConfirmDialog({ open, title, message, confirmLabel, danger, onConfirm, onCancel })`.
- Produces:
  - `DividendForm({ people, initialPersonId, initial, onSubmit, onCancel })` — calls `onSubmit({ personId, date, kind: 'dividend', amountPence, note })` (pounds).
  - `DividendLedger({ events, onEdit(event), onDelete(event) })` — `events` are the pence-domain rows from the snapshot.

- [ ] **Step 1: Write the failing render tests**

Append to `src/ui/company/companyRender.test.jsx` (add `fireEvent` and `waitFor` to the testing-library import):

```jsx
describe('Company tab ledger', () => {
  it('lists every dividend from both people, newest first, with a note', async () => {
    const a = await peopleRepo.add({ name: 'Anderson' });
    const b = await peopleRepo.add({ name: 'Wife' });
    await incomeEventsRepo.add({ personId: a, date: inYear(10), kind: 'dividend', amountPence: 5400, note: 'Q1 draw' });
    await incomeEventsRepo.add({ personId: b, date: inYear(20), kind: 'dividend', amountPence: 2700, note: 'Summer' });

    render(<Company />);

    expect(await screen.findByText('Q1 draw')).toBeTruthy();
    const rows = screen.getAllByRole('row').filter((r) => /Q1 draw|Summer/.test(r.textContent));
    expect(rows[0].textContent).toMatch(/Summer/); // newest first
    expect(rows[1].textContent).toMatch(/Q1 draw/);
  });

  it('records a dividend for a chosen person through the same incomeEvents store', async () => {
    const a = await peopleRepo.add({ name: 'Anderson' });
    await peopleRepo.add({ name: 'Wife' });

    render(<Company />);
    fireEvent.click(await screen.findByRole('button', { name: 'Record dividend' }));

    const person = screen.getByLabelText('Person');
    fireEvent.change(person, { target: { value: String(a) } });
    // EventForm's Amount label has no htmlFor, so find the currency input
    // inside the open dialog rather than by label.
    const amount = screen.getByRole('dialog').querySelector('.currency-input input');
    fireEvent.change(amount, { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add dividend draw' }));

    await waitFor(async () => {
      const rows = await incomeEventsRepo.getAll();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ personId: a, kind: 'dividend', amountPence: 1000 });
    });
    // Appears in the KPI row and in the ledger.
    expect((await screen.findAllByText('£1,000.00')).length).toBeGreaterThan(0);
  });

  it('deletes a dividend after confirming', async () => {
    const a = await peopleRepo.add({ name: 'Anderson' });
    await incomeEventsRepo.add({ personId: a, date: inYear(10), kind: 'dividend', amountPence: 5400, note: 'Q1 draw' });

    render(<Company />);
    expect(await screen.findByText('Q1 draw')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete dividend' }));

    await waitFor(async () => {
      expect(await incomeEventsRepo.getAll()).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/company/companyRender.test.jsx`
Expected: FAIL — `Unable to find … "Q1 draw"` / `"Record dividend"`.

- [ ] **Step 3: Write the form wrapper**

Create `src/ui/company/DividendForm.jsx`:

```jsx
import { useState } from 'react';
import EventForm from '../income/EventForm.jsx';

/**
 * Record or edit a dividend from the Company tab: a person picker wrapped
 * around the Income tab's dividend event form, so the row written is the
 * same `incomeEvents` row the Income tab shows. Money is pounds at the
 * repository edge, as everywhere else. Rendered inside a Modal.
 *
 * @param {object} props
 * @param {Array<{ id: number, name: string }>} props.people
 * @param {number} [props.initialPersonId] - preselected person (defaults to the first).
 * @param {object} [props.initial] - existing event row (pounds) when editing.
 * @param {(payload: { personId, date, kind, amountPence, note }) => Promise<void>} props.onSubmit
 */
export default function DividendForm({ people, initialPersonId, initial, onSubmit, onCancel }) {
  const [personId, setPersonId] = useState(
    () => initial?.personId ?? initialPersonId ?? people[0]?.id ?? null
  );

  return (
    <div className="form">
      <div className="form-row">
        <div className="field">
          <label htmlFor="company-dividend-person">Person</label>
          <select
            id="company-dividend-person"
            className="input"
            value={personId ?? ''}
            onChange={(e) => setPersonId(Number(e.target.value))}
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <EventForm
        kind="dividend"
        initial={initial}
        onSubmit={(payload) => onSubmit({ ...payload, personId })}
        onCancel={onCancel}
      />
    </div>
  );
}
```

- [ ] **Step 4: Write the ledger**

Create `src/ui/company/DividendLedger.jsx`:

```jsx
import Money from '../components/Money.jsx';
import { formatDay } from '../components/dates.js';

/**
 * The company year's dividends from both people, newest first. These are the
 * Income tab's dividend events; editing or deleting here changes them there.
 *
 * @param {Array<object>} props.events - pence-domain rows from `gatherCompanyData`
 *   (each carries `personName`).
 */
export default function DividendLedger({ events, onEdit, onDelete }) {
  return (
    <section className="company-ledger">
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Person</th>
              <th>Note</th>
              <th className="num">Dividend</th>
              <th className="company-ledger__actions">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev.id}>
                <td>{formatDay(ev.date)}</td>
                <td>{ev.personName ?? <span className="muted">Unknown person</span>}</td>
                <td>{ev.note || <span className="muted">—</span>}</td>
                <td className="num">
                  <Money pence={ev.amountPence} />
                </td>
                <td className="company-ledger__actions">
                  <button type="button" className="btn btn--sm" onClick={() => onEdit(ev)}>
                    Edit
                  </button>{' '}
                  <button
                    type="button"
                    className="btn btn--sm btn--danger"
                    onClick={() => onDelete(ev)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Wire it into the tab**

In `src/ui/Company.jsx`:

Add imports:

```jsx
import { incomeEventsRepo } from '../db/repositories.js';
import Modal from './components/Modal.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import DividendForm from './company/DividendForm.jsx';
import DividendLedger from './company/DividendLedger.jsx';
```

Add state and handlers after the `people` line:

```jsx
  const [recording, setRecording] = useState(false);
  const [editing, setEditing] = useState(null); // raw repo row (pounds)
  const [confirmDelete, setConfirmDelete] = useState(null); // pence-domain ledger row

  const record = async (payload) => {
    await incomeEventsRepo.add(payload);
    setRecording(false);
  };
  const save = async (payload) => {
    await incomeEventsRepo.update(editing.id, payload);
    setEditing(null);
  };
  const remove = async () => {
    await incomeEventsRepo.delete(confirmDelete.id);
    setConfirmDelete(null);
  };
  // The ledger carries pence-domain rows; the edit form needs the pounds row back.
  const openEdit = async (ev) => {
    setEditing(await incomeEventsRepo.get(ev.id));
  };
```

Replace the `{/* Task 7 adds the "Record dividend" button here. */}` marker with:

```jsx
          <button
            type="button"
            className="btn btn--primary"
            disabled={people.length === 0}
            onClick={() => setRecording(true)}
          >
            Record dividend
          </button>
```

Add the dialogs directly after the fallback banner (before the loading ternary):

```jsx
      {recording && (
        <Modal title="Record dividend" onClose={() => setRecording(false)}>
          <DividendForm people={people} onSubmit={record} onCancel={() => setRecording(false)} />
        </Modal>
      )}
      {editing && (
        <Modal title={`Edit dividend — ${formatDay(editing.date)}`} onClose={() => setEditing(null)}>
          <DividendForm
            key={editing.id}
            people={people}
            initial={editing}
            onSubmit={save}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
```

Replace the `{/* Task 7 adds <DividendLedger> here. */}` marker with:

```jsx
          {data.events.length === 0 ? (
            <EmptyState
              title={`No dividends drawn in ${fyTitle(fy)}`}
              hint="Record a dividend here or on the Income tab — either way it counts against this company year."
            />
          ) : (
            <DividendLedger events={data.events} onEdit={openEdit} onDelete={setConfirmDelete} />
          )}
```

Add the confirm dialog just before the closing `</div>` of the screen:

```jsx
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete dividend"
        message={
          confirmDelete
            ? `Delete the dividend of ${formatGBP(confirmDelete.amountPence)} on ${formatDay(confirmDelete.date)}? It disappears from the Income tab too. This can't be undone.`
            : ''
        }
        confirmLabel="Delete dividend"
        danger
        onConfirm={remove}
        onCancel={() => setConfirmDelete(null)}
      />
```

and add `import { formatGBP } from '../engine/currency.js';` to the imports.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/ui/company/companyRender.test.jsx`
Expected: PASS, 6 tests. If the Delete test finds two "Delete" buttons, the per-row button and the dialog's confirm share a name; the confirm is `Delete dividend`, the row button is `Delete` — the exact-name query above disambiguates them.

- [ ] **Step 7: Commit**

```bash
git add src/ui/Company.jsx src/ui/company/DividendForm.jsx src/ui/company/DividendLedger.jsx src/ui/company/companyRender.test.jsx
git commit -m "Company tab: dividend ledger with record, edit, and delete

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: UI — the draw calculator

**Files:**
- Create: `src/ui/company/DrawCalculator.jsx`
- Modify: `src/ui/Company.jsx` (fill the Task 8 marker)
- Test: `src/ui/company/companyRender.test.jsx` (append)

**Interfaces:**
- Consumes: `previewDraw` (Task 3); `previewPersonalDraw` (Task 5); `taxYearForDate` from `src/engine/tax.js`; `toPence` from `src/engine/currency.js`; `useLiveData`; `CurrencyInput({ id, value, onChange })`; `Money`; `formatRate`, `formatPerPound`.
- Produces: `DrawCalculator({ data, onRecord })` — `onRecord({ personId, date, kind: 'dividend', amountPence (pounds), note: '' })` returns a promise; the calculator clears its amount when it resolves.

- [ ] **Step 1: Write the failing render tests**

Append to `src/ui/company/companyRender.test.jsx`:

```jsx
describe('Company tab draw calculator', () => {
  it('shows the company picture before and after a draw', async () => {
    const a = await peopleRepo.add({ name: 'Anderson' });
    // £8,100 drawn ← £10,000 profit, £1,900 CT.
    await incomeEventsRepo.add({ personId: a, date: inYear(10), kind: 'dividend', amountPence: 8100 });

    render(<Company />);
    const amount = await screen.findByLabelText('Amount to draw');
    fireEvent.change(amount, { target: { value: '1000' } });

    // £9,100 net ← £11,234.57 profit, £2,134.57 CT: +£234.57 of CT on
    // +£1,234.57 of profit. The sentence figures sit inside <Money> spans,
    // so match on the paragraph's textContent.
    expect((await screen.findAllByText('£11,234.57')).length).toBeGreaterThan(0);
    expect(screen.getByText('£2,134.57')).toBeTruthy();
    const sentence = (re) => (_, el) => el.tagName === 'P' && re.test(el.textContent);
    expect(screen.getByText(sentence(/adds £234\.57 of corporation tax/))).toBeTruthy();
    expect(screen.getByText(sentence(/needs £1,234\.57 more profit/))).toBeTruthy();
    // Personal side, for the (only) person, in the tax year of the draw date.
    expect(await screen.findByText(/For Anderson in tax year/)).toBeTruthy();
    expect(screen.getByText('Net in hand')).toBeTruthy();
  });

  it('warns when a draw crosses the £50,000 profit line', async () => {
    const a = await peopleRepo.add({ name: 'Anderson' });
    await incomeEventsRepo.add({ personId: a, date: inYear(10), kind: 'dividend', amountPence: 40000 });

    render(<Company />);
    fireEvent.change(await screen.findByLabelText('Amount to draw'), { target: { value: '5000' } });

    expect(await screen.findByText(/takes the year past £50,000 of profit/)).toBeTruthy();
  });

  it('records the previewed dividend and clears the amount', async () => {
    const a = await peopleRepo.add({ name: 'Anderson' });

    render(<Company />);
    const amount = await screen.findByLabelText('Amount to draw');
    fireEvent.change(amount, { target: { value: '2500' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Record this dividend' }));

    await waitFor(async () => {
      const rows = await incomeEventsRepo.getAll();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ personId: a, kind: 'dividend', amountPence: 2500 });
    });
    await waitFor(() => expect(screen.getByLabelText('Amount to draw').value).toBe(''));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/company/companyRender.test.jsx`
Expected: FAIL — `Unable to find a label with the text of: Amount to draw`.

- [ ] **Step 3: Write the calculator**

Create `src/ui/company/DrawCalculator.jsx`:

```jsx
import { useState } from 'react';
import { useLiveData } from '../../db/useLiveData.js';
import { previewPersonalDraw } from '../../db/companyData.js';
import { previewDraw } from '../../engine/corporation-tax.js';
import { taxYearForDate } from '../../engine/tax.js';
import { toPence } from '../../engine/currency.js';
import CurrencyInput from '../components/CurrencyInput.jsx';
import Money from '../components/Money.jsx';
import { formatRate, formatPerPound, fyTitle } from './format.js';

const today = () => new Date().toISOString().slice(0, 10);

/** A two-column "now → after" row. */
function CompareRow({ label, before, after }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td className="num">{before}</td>
      <td className="num compare__after">{after}</td>
    </tr>
  );
}

/**
 * "If I draw £X": the company picture and the drawing person's income-tax
 * picture, before and after. Transient UI state — nothing here is stored
 * until Record is pressed, which writes an ordinary dividend event.
 *
 * Two different years sit side by side on purpose: the company side is the
 * financial year being viewed (1 Apr – 31 Mar); the personal side is the
 * tax year (6 Apr – 5 Apr) that contains the draw DATE. Both are labelled.
 *
 * @param {object} props.data - the `gatherCompanyData` snapshot (pence).
 * @param {(payload: object) => Promise<void>} props.onRecord - pounds payload
 *   for `incomeEventsRepo.add`.
 */
export default function DrawCalculator({ data, onRecord }) {
  const { people, startDate, endDate, table } = data;
  const [amountPounds, setAmountPounds] = useState(null);
  const [personId, setPersonId] = useState(() => people[0]?.id ?? null);
  // Today if it falls inside the viewed company year, else the year's first day.
  const [date, setDate] = useState(() => {
    const t = today();
    return t >= startDate && t <= endDate ? t : startDate;
  });

  const amountPence = amountPounds != null && amountPounds > 0 ? toPence(amountPounds) : 0;
  const dateInYear = date >= startDate && date <= endDate;
  const active = amountPence > 0 && personId != null;

  const company = previewDraw({ dividendPence: data.dividendPence, extraDividendPence: amountPence, table });

  const { data: personal } = useLiveData(
    () => (active && dateInYear ? previewPersonalDraw({ personId, amountPence, date }) : Promise.resolve(null)),
    [active, dateInYear, personId, amountPence, date]
  );

  const record = async () => {
    await onRecord({ personId, date, kind: 'dividend', amountPence: amountPounds, note: '' });
    setAmountPounds(null);
  };

  const profitNeeded = company.after.profitPence - company.before.profitPence;
  const combinedTax = company.extraCtPence + (personal?.extraTaxPence ?? 0);

  return (
    <section className="panel company-calc">
      <h3>If I draw…</h3>
      <div className="form-row">
        <div className="field">
          <label htmlFor="company-draw-amount">Amount to draw</label>
          <CurrencyInput id="company-draw-amount" value={amountPounds} onChange={setAmountPounds} />
        </div>
        <div className="field">
          <label htmlFor="company-draw-person">Drawn by</label>
          <select
            id="company-draw-person"
            className="input"
            value={personId ?? ''}
            onChange={(e) => setPersonId(Number(e.target.value))}
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="company-draw-date">Dated</label>
          <input
            id="company-draw-date"
            className="input"
            type="date"
            min={startDate}
            max={endDate}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      {!dateInYear && (
        <p className="banner banner--warn">
          That date is outside company year {fyTitle(data.financialYear)} — pick a date between{' '}
          {startDate} and {endDate}, or switch year.
        </p>
      )}

      {active && (
        <>
          <div className="company-calc__grid">
            <div>
              <h3>Company — {fyTitle(data.financialYear)}</h3>
              <table className="table compare">
                <thead>
                  <tr>
                    <th />
                    <th className="num">Now</th>
                    <th className="num">After</th>
                  </tr>
                </thead>
                <tbody>
                  <CompareRow
                    label="Dividends"
                    before={<Money pence={company.before.dividendPence} />}
                    after={<Money pence={company.after.dividendPence} />}
                  />
                  <CompareRow
                    label="Profit required"
                    before={<Money pence={company.before.profitPence} />}
                    after={<Money pence={company.after.profitPence} />}
                  />
                  <CompareRow
                    label="Corporation tax"
                    before={<Money pence={company.before.ctPence} />}
                    after={<Money pence={company.after.ctPence} />}
                  />
                  <CompareRow
                    label="Effective rate"
                    before={formatRate(company.before.effectiveRate)}
                    after={formatRate(company.after.effectiveRate)}
                  />
                </tbody>
              </table>
              <p className="company-calc__sentence">
                This draw adds <Money pence={company.extraCtPence} /> of corporation tax — set that
                aside. The company needs <Money pence={profitNeeded} /> more profit to fund it
                ({formatRate(company.rateOnExtraProfit)} on the extra profit,{' '}
                {formatPerPound(company.setAsidePerPound)} per £1 drawn).
              </p>
              {company.crossesLowerLimit && (
                <p className="banner banner--warn">
                  This draw takes the year past £50,000 of profit — every pound above that costs{' '}
                  {formatRate(table.mainRate + table.marginalReliefFraction)} instead of{' '}
                  {formatRate(table.smallRate)}.
                </p>
              )}
              {company.crossesUpperLimit && (
                <p className="banner banner--info">
                  This draw takes the year past £250,000 of profit — the {formatRate(table.mainRate)}{' '}
                  main rate then applies to all of it.
                </p>
              )}
            </div>

            <div>
              {personal ? (
                <>
                  <h3>
                    For {personal.name} in tax year {personal.taxYear}
                  </h3>
                  <table className="table compare">
                    <thead>
                      <tr>
                        <th />
                        <th className="num">Now</th>
                        <th className="num">After</th>
                      </tr>
                    </thead>
                    <tbody>
                      <CompareRow
                        label="Gross income"
                        before={<Money pence={personal.before.grossIncomePence} />}
                        after={<Money pence={personal.after.grossIncomePence} />}
                      />
                      <CompareRow
                        label="Total income tax"
                        before={<Money pence={personal.before.totalTaxPence} />}
                        after={<Money pence={personal.after.totalTaxPence} />}
                      />
                      <CompareRow
                        label="Via Self Assessment"
                        before={<Money pence={personal.before.selfAssessmentTaxPence} />}
                        after={<Money pence={personal.after.selfAssessmentTaxPence} />}
                      />
                      <CompareRow
                        label="Headroom to 40%"
                        before={<Money pence={personal.before.headroomToHigherRatePence} />}
                        after={<Money pence={personal.after.headroomToHigherRatePence} />}
                      />
                      <CompareRow
                        label="Headroom to £100k"
                        before={<Money pence={personal.before.headroomTo100kPence} />}
                        after={<Money pence={personal.after.headroomTo100kPence} />}
                      />
                    </tbody>
                  </table>
                  <p className="company-calc__sentence">
                    Extra personal tax ≈ <Money pence={personal.extraTaxPence} />, settled via Self
                    Assessment. <span className="muted">Net in hand</span>{' '}
                    <Money pence={personal.netInHandPence} />.
                  </p>
                  {personal.after.over100k && !personal.before.over100k && (
                    <p className="banner banner--warn">
                      This draw takes {personal.name} over £100,000 — the personal allowance starts
                      tapering and childcare entitlements are affected.
                    </p>
                  )}
                </>
              ) : (
                <p className="muted">
                  {dateInYear
                    ? `Working out the personal side for tax year ${taxYearForDate(date)}…`
                    : 'Personal figures need a date inside the company year.'}
                </p>
              )}
            </div>
          </div>

          {personal && (
            <p className="muted">
              Of <Money pence={amountPence + company.extraCtPence} /> of profit:{' '}
              <Money pence={company.extraCtPence} /> corporation tax,{' '}
              <Money pence={personal.extraTaxPence} /> personal tax,{' '}
              <Money pence={personal.netInHandPence} /> in {personal.name}'s pocket (
              {formatRate(combinedTax / (amountPence + company.extraCtPence))} all-in).
            </p>
          )}

          <div className="form__actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={!dateInYear}
              onClick={record}
            >
              Record this dividend
            </button>
          </div>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Wire it into the tab**

In `src/ui/Company.jsx`, add `import DrawCalculator from './company/DrawCalculator.jsx';` and replace the `{/* Task 8 adds <DrawCalculator> here. */}` marker with:

```jsx
          <DrawCalculator
            key={fy}
            data={data}
            onRecord={(payload) => incomeEventsRepo.add(payload)}
          />
```

(`key={fy}` resets the calculator's date default when the viewed year changes.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/ui/company/companyRender.test.jsx`
Expected: PASS, 9 tests.

The £50,000 warning paragraph is plain text (no `<Money>` inside it), so its plain regex matches the paragraph's own text; the two "adds / needs" sentences contain `<Money>` spans and are matched on `textContent` via the `sentence` helper. If a figure assertion fails, print `screen.debug()` and compare against the expected engine figures in the comment before changing the numbers.

- [ ] **Step 6: Commit**

```bash
git add src/ui/Company.jsx src/ui/company/DrawCalculator.jsx src/ui/company/companyRender.test.jsx
git commit -m "Company tab: draw calculator with company and personal before/after

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Full verification, browser check, spec status

**Files:**
- Modify: `specs/2026-09-12-corporation-tax-design.md` (status line)

- [ ] **Step 1: Run the whole suite and the production build**

Run: `npx vitest run`
Expected: all green, including the pre-existing suites (nothing shared was changed except `App.jsx` and `styles.css`).

Run: `npm run build`
Expected: `✓ built in …` with no errors.

- [ ] **Step 2: Check it in the browser**

Use the project's `verify` skill (`/verify`) to start the dev server and open the app, then:

1. Open the **Company** tab. With no people, the empty state points at the Income tab.
2. On the **Income** tab add two people and give each a dividend dated in the current company year (e.g. £5,400 and £2,700).
3. Back on **Company**: KPIs read £8,100 / £1,900 / £10,000 / 19.0%; the band meter shows 20% and "£32,400.00 more in dividends before the marginal band"; both people appear in the split and the ledger.
4. Type **1000** into "Amount to draw": After column shows £11,234.57 profit and £2,134.57 CT; the sentence says +£234.57; the personal panel shows the first person in the current tax year. Press **Record this dividend** and confirm the ledger gains a £1,000 row and the amount clears.
5. Type **80000**: the £50,000 warning appears and the extra-profit rate reads above 19%.
6. Step ‹ to the previous company year: the ledger empties, the Today button appears.

Take a screenshot of step 4 for the PR.

- [ ] **Step 3: Mark the design implemented**

In `specs/2026-09-12-corporation-tax-design.md` change the status line to:

```markdown
**Status:** implemented
```

- [ ] **Step 4: Commit**

```bash
git add specs/2026-09-12-corporation-tax-design.md
git commit -m "Mark the corporation-tax design as implemented

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Then hand over to the `superpowers:finishing-a-development-branch` skill to open the PR against `main`.
