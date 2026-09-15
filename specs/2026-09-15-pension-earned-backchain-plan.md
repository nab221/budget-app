# Pension Earned Back-Chain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the Pension tab rebuild the three years before the statement anchor — and so the carry-forward — from the NHS/LGPS site's per-year "pension earned" figure, which is the only historical figure the site gives.

**Architecture:** The pure engine (`src/engine/pension.js`) gains a backward roll: the anchor is the closing value of the year before its opening year, and each step back solves `opening = (closing − earned) ÷ (1 + CPI + real)`. A new user-entered field `pensionEarnedPence` on `pensionYears` rows feeds it (and replaces earnings ÷ 54 in forward years). The adapter builds an `earnedByYear` map and passes it through; the year form, the four-year table and the card surface it. No schema version bump (non-indexed field).

**Tech Stack:** Vite + React 18 (JSX, no TypeScript), Dexie 4 over IndexedDB, Vitest + @testing-library/react + fake-indexeddb.

**Design:** `specs/2026-09-15-pension-earned-backchain-design.md` (the contract). Parent: `specs/2026-09-15-pension-panel-design.md`, spec amendment (k) in `specs/REFACTOR-SPEC.md`.

## Global Constraints

- Money is integer **pence** at rest and in the engine; pounds only at the repository edge (`createBaseRepository` converts) and in forms.
- Never persist computed rows: `pensionYears` holds only entered statement figures (PIA, pensionable earnings, pension earned) and a note.
- No `innerHTML`, no `window.*` handlers, no inline `onclick=`.
- Engine modules are pure: no DB, no clock.
- Scheme parameters: `nhs-2015` accrual 1/54, real revaluation 1.5%; `lgps-2014` accrual 1/49, real revaluation 0%.
- PIA = `16 × (closing − opening × (1 + CPI))`, computed in full, rounded once.
- Estimates only from `2022-23` (`FIRST_ESTIMATE_YEAR`) onward. Back-chain stops there.
- Backward step: `opening = (closing − earned) ÷ (1 + cpi + realRevaluation)`, rounded once per year, clamped at 0.
- Source precedence per year is unchanged: entered PIA → estimate → none. A *none* year for a scheme member contributes zero unused allowance.
- `cpiMissing` lists a year only when a CPI is missing in the year itself or on the chain to it — never for a missing pension-earned row.
- Copy uses the codebase's curly apostrophe `’` in user-facing text (e.g. *year’s*).
- Run one test file with `npx vitest run <path>`; the whole suite with `npx vitest run`.
- Commit after every task with the attribution line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Naming used across tasks

| Name | Where | Meaning |
|---|---|---|
| `pensionEarnedPence` | `pensionYears` row, form payload, adapter row | The statement's "pension earned in year"; null = not entered. Pounds at the repo edge, pence inside. |
| `earnedByYear` | engine + adapter | `{ '2025-26': 124615, … }` — only years with a figure. |
| `earnedPence` | `estimatePia` option; `estimate` object | This year's accrual in pence when a statement figure exists. |
| `earnedSource` | `estimate` object | `'statement'` when the accrual came from `earnedByYear`, `'earnings'` when derived from pensionable earnings ÷ denominator. |
| `estimatePiaFromClosing` | engine | One backward step from a year's closing pension. |
| `rollBackward` | engine | Chains backward steps from the anchor to a target year. |

Acceptance data (owner's NHS TRS, verified against the site) in pence:

| Tax year | Opening | CPI | Pension earned | Closing | PIA (table) |
|---|---|---|---|---|---|
| 2022-23 | 280,982 | 0.031 | 70,857 | 364,764 | 1,201,200 |
| 2023-24 | 364,764 | 0.101 | 88,650 | 495,727 | 1,506,000 |
| 2024-25 | 495,727 | 0.067 | 108,393 | 644,770 | 1,853,300 |
| 2025-26 | 644,770 | 0.017 | 124,615 | 790,018 | 2,148,600 |

Anchor: 790,018 at 2026-03-31, opens 2026-27. The back-chain from it reproduces every opening exactly (rounded) and every PIA within 100 pence (2,148,585 / 1,853,263 / 1,505,943 / 1,201,148).

---

### Task 1: `estimatePia` accepts a statement accrual; `rollForward` threads it

**Files:**
- Modify: `src/engine/pension.js` (`estimatePia`, `rollForward`)
- Test: `src/engine/pension.test.js`

**Interfaces:**
- Produces: `estimatePia({ scheme, openingPence, cpi, earningsPence, earnedPence = null })` — unchanged return `{ closingPence, upratedOpeningPence, piaPence }`; when `earnedPence` is a number it is the accrual instead of `earningsPence ÷ accrualDenominator`.
- Produces: `rollForward({ scheme, anchorPence, anchorOpeningYear, targetYear, cpiByYear, earningsByYear, earnedByYear = {} })` — unchanged return; each step uses `earnedByYear[year]` when it is a number.

- [ ] **Step 1: Add the failing tests**

In `src/engine/pension.test.js`, inside `describe('estimatePia', …)` after the LGPS test, add:

```js
  it('uses the statement pension earned as the accrual when given, ignoring earnings', () => {
    const est = estimatePia({ scheme: 'nhs-2015', openingPence: 644_770, cpi: 0.017, earningsPence: 0, earnedPence: 124_615 });
    expect(est.closingPence).toBe(790_018);
    expect(Math.abs(est.piaPence - 2_148_600)).toBeLessThan(100);
    const derived = estimatePia({ scheme: 'nhs-2015', openingPence: 644_770, cpi: 0.017, earningsPence: 6_729_210, earnedPence: null });
    expect(derived.closingPence).toBe(790_018); // null → earnings ÷ 54, as before
  });
```

After the `NHS_EARNINGS` constant (before `describe('rollForward', …)`), add:

```js
// The same years as the site shows them: "pension earned" = earnings ÷ 54.
const NHS_EARNED = {
  '2022-23': 70_857,
  '2023-24': 88_650,
  '2024-25': 108_393,
  '2025-26': 124_615,
};
```

Inside `describe('rollForward', …)` add:

```js
  it('uses pension earned in place of earnings ÷ 54 for the years that have it', () => {
    const r = rollForward({
      scheme: 'nhs-2015',
      anchorPence: 280_982,
      anchorOpeningYear: '2022-23',
      targetYear: '2026-27',
      earningsByYear: {},
      earnedByYear: NHS_EARNED,
    });
    expect(r.chain.map((c) => [c.taxYear, c.closingPence])).toEqual([
      ['2022-23', 364_764],
      ['2023-24', 495_727],
      ['2024-25', 644_770],
      ['2025-26', 790_018],
    ]);
  });
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/engine/pension.test.js`
Expected: the two new tests FAIL (closing 655,403 instead of 790,018 in the first; chain closings wrong in the second). Everything else passes.

- [ ] **Step 3: Implement**

In `src/engine/pension.js` replace `estimatePia` with:

```js
/**
 * One year's pension input amount from its opening pension, computed in full
 * (revaluation and accrual on one side, CPI uprating on the other) and rounded
 * once at the end. The accrual is the statement's "pension earned" when
 * `earnedPence` is a number, else pensionable earnings ÷ the scheme's accrual.
 * @returns {{ closingPence: number, upratedOpeningPence: number, piaPence: number }}
 */
export function estimatePia({ scheme, openingPence, cpi, earningsPence, earnedPence = null }) {
  const s = schemeOf(scheme);
  const opening = pence(openingPence);
  const rate = Number(cpi) || 0;
  const accrualExact = typeof earnedPence === 'number' ? pence(earnedPence) : pence(earningsPence) / s.accrualDenominator;
  const closingExact = opening * (1 + rate + s.realRevaluation) + accrualExact;
  const upratedExact = opening * (1 + rate);
  return {
    closingPence: Math.round(closingExact),
    upratedOpeningPence: Math.round(upratedExact),
    piaPence: Math.max(0, Math.round(PIA_FACTOR * (closingExact - upratedExact))),
  };
}
```

Add a module-level helper just above `estimatePia`:

```js
/** `map[label]` when it is a number, else null ("not entered"). */
const numberOrNull = (map, label) => (typeof map?.[label] === 'number' ? map[label] : null);
```

In `rollForward`, add the `earnedByYear = {}` parameter after `earningsByYear = {}` and change the loop body's estimate call to:

```js
    const { closingPence } = estimatePia({
      scheme,
      openingPence: opening,
      cpi,
      earningsPence: earningsByYear[year] || 0,
      earnedPence: numberOrNull(earnedByYear, year),
    });
```

Update the `rollForward` JSDoc's first sentence to: `closing = opening × (1 + CPI + real) + accrual (the year's pension earned when known, else earnings ÷ denominator)`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/engine/pension.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/pension.js src/engine/pension.test.js
git commit -m "Pension engine: statement pension earned as the accrual in estimatePia and rollForward

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: `estimatePiaFromClosing` and `rollBackward`

**Files:**
- Modify: `src/engine/pension.js` (new exports after `rollForward`)
- Test: `src/engine/pension.test.js`

**Interfaces:**
- Consumes: `SCHEMES`, `SEPTEMBER_CPI`, `FIRST_ESTIMATE_YEAR`, `PIA_FACTOR`, `pence`, `schemeOf`, `shiftTaxYear` (all already in the module).
- Produces: `estimatePiaFromClosing({ scheme, closingPence, cpi, earnedPence })` → `{ openingPence, upratedOpeningPence, piaPence }`.
- Produces: `rollBackward({ scheme, anchorPence, anchorOpeningYear, targetYear, cpiByYear = SEPTEMBER_CPI, earnedByYear = {} })` → `{ openingPence, closingPence, chain } | null`, `chain` newest first, each entry `{ taxYear, openingPence, closingPence, upratedOpeningPence, piaPence, cpi, earnedPence }`. The last chain entry is the target year.

- [ ] **Step 1: Add the failing tests**

Add `estimatePiaFromClosing` and `rollBackward` to the import list at the top of `src/engine/pension.test.js`. Then, after `describe('rollForward', …)`, add:

```js
describe('estimatePiaFromClosing', () => {
  it('reverses the 2025-26 step: £7,900.18 closing, £1,246.15 earned → £6,447.70 opening, PIA ≈ £21,486', () => {
    const r = estimatePiaFromClosing({ scheme: 'nhs-2015', closingPence: 790_018, cpi: 0.017, earnedPence: 124_615 });
    expect(r.openingPence).toBe(644_770);
    expect(r.upratedOpeningPence).toBe(655_731);
    expect(Math.abs(r.piaPence - 2_148_600)).toBeLessThan(100);
  });

  it('clamps the opening at zero when earned exceeds closing', () => {
    const r = estimatePiaFromClosing({ scheme: 'lgps-2014', closingPence: 1_000, cpi: 0.02, earnedPence: 5_000 });
    expect(r.openingPence).toBe(0);
    expect(r.piaPence).toBe(16_000); // 16 × closing
  });

  it('rejects an unknown scheme', () => {
    expect(() => estimatePiaFromClosing({ scheme: 'uss', closingPence: 0, cpi: 0, earnedPence: 0 })).toThrow(/scheme/);
  });
});

describe('rollBackward', () => {
  const base = { scheme: 'nhs-2015', anchorPence: 790_018, anchorOpeningYear: '2026-27', earnedByYear: NHS_EARNED };

  it('rebuilds every year back to 2022-23 from the anchor, newest first', () => {
    const r = rollBackward({ ...base, targetYear: '2022-23' });
    expect(r.chain.map((c) => [c.taxYear, c.openingPence, c.closingPence])).toEqual([
      ['2025-26', 644_770, 790_018],
      ['2024-25', 495_727, 644_770],
      ['2023-24', 364_764, 495_727],
      ['2022-23', 280_982, 364_764],
    ]);
    expect(r.openingPence).toBe(280_982);
    expect(r.closingPence).toBe(364_764);
    const within = (pia, pounds) => expect(Math.abs(pia - pounds * 100)).toBeLessThan(100);
    within(r.chain[0].piaPence, 21486);
    within(r.chain[1].piaPence, 18533);
    within(r.chain[2].piaPence, 15060);
    within(r.chain[3].piaPence, 12012);
    expect(r.chain[0].earnedPence).toBe(124_615);
  });

  it('stops one year back when that is the target', () => {
    const r = rollBackward({ ...base, targetYear: '2025-26' });
    expect(r.chain).toHaveLength(1);
    expect(r.openingPence).toBe(644_770);
  });

  it('returns null before 2022-23, at or after the anchor year, on a missing pension-earned row, or a missing CPI', () => {
    expect(rollBackward({ ...base, targetYear: '2021-22' })).toBe(null);
    expect(rollBackward({ ...base, targetYear: '2026-27' })).toBe(null);
    expect(rollBackward({ ...base, targetYear: '2027-28' })).toBe(null);
    const { '2024-25': _gap, ...withGap } = NHS_EARNED;
    expect(rollBackward({ ...base, earnedByYear: withGap, targetYear: '2023-24' })).toBe(null);
    expect(rollBackward({ ...base, earnedByYear: withGap, targetYear: '2025-26' })).not.toBe(null);
    const { '2024-25': _cpi, ...cpiGap } = SEPTEMBER_CPI;
    expect(rollBackward({ ...base, cpiByYear: cpiGap, targetYear: '2023-24' })).toBe(null);
    expect(rollBackward({ ...base, scheme: 'uss', targetYear: '2025-26' })).toBe(null);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/engine/pension.test.js`
Expected: FAIL — `estimatePiaFromClosing` / `rollBackward` are not exported.

- [ ] **Step 3: Implement**

In `src/engine/pension.js`, directly after `rollForward`, add:

```js
/**
 * One BACKWARD step: from a year's closing pension and the statement's
 * "pension earned", the opening pension and that year's input amount, in
 * full and rounded once. opening = (closing − earned) ÷ (1 + CPI + real),
 * clamped at zero; PIA = 16 × (closing − opening × (1 + CPI)).
 * @returns {{ openingPence: number, upratedOpeningPence: number, piaPence: number }}
 */
export function estimatePiaFromClosing({ scheme, closingPence, cpi, earnedPence }) {
  const s = schemeOf(scheme);
  const closing = pence(closingPence);
  const rate = Number(cpi) || 0;
  const openingExact = Math.max(0, (closing - pence(earnedPence)) / (1 + rate + s.realRevaluation));
  const upratedExact = openingExact * (1 + rate);
  return {
    openingPence: Math.round(openingExact),
    upratedOpeningPence: Math.round(upratedExact),
    piaPence: Math.max(0, Math.round(PIA_FACTOR * (closing - upratedExact))),
  };
}

/**
 * Roll a statement anchor BACKWARDS to `targetYear`. The anchor is the
 * closing pension of the year before its opening year; each step back needs
 * that year's "pension earned" and CPI, and its opening becomes the previous
 * year's closing (rounded once per year). Null when the target is before
 * 2022-23, at or after the anchor's opening year (forward territory), or any
 * year on the way lacks a pension-earned figure or a CPI. `chain` is newest
 * first — the order it was computed — and its last entry is `targetYear`.
 * @returns {{ openingPence: number, closingPence: number, chain: Array<{ taxYear, openingPence, closingPence, upratedOpeningPence, piaPence, cpi, earnedPence }> } | null}
 */
export function rollBackward({
  scheme,
  anchorPence,
  anchorOpeningYear: fromYear,
  targetYear,
  cpiByYear = SEPTEMBER_CPI,
  earnedByYear = {},
}) {
  if (!SCHEMES[scheme]) return null;
  if (String(targetYear) < FIRST_ESTIMATE_YEAR || String(targetYear) >= String(fromYear)) return null;
  let closing = pence(anchorPence);
  const chain = [];
  let year = shiftTaxYear(fromYear, -1);
  for (;;) {
    const cpi = cpiByYear[year];
    const earnedPence = numberOrNull(earnedByYear, year);
    if (typeof cpi !== 'number' || earnedPence == null) return null;
    const step = estimatePiaFromClosing({ scheme, closingPence: closing, cpi, earnedPence });
    chain.push({ taxYear: year, closingPence: closing, cpi, earnedPence, ...step });
    if (year === targetYear) return { openingPence: step.openingPence, closingPence: closing, chain };
    closing = step.openingPence;
    year = shiftTaxYear(year, -1);
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/engine/pension.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/pension.js src/engine/pension.test.js
git commit -m "Pension engine: roll the anchor backwards from the statement's pension earned

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `buildPensionYear` estimates the years before the anchor

**Files:**
- Modify: `src/engine/pension.js` (`buildPensionYear`, module header comment)
- Test: `src/engine/pension.test.js`

**Interfaces:**
- Consumes: `rollForward` (Task 1), `rollBackward` (Task 2), `numberOrNull`.
- Produces: `buildPensionYear({ taxYear, scheme, anchor, rows, earningsByYear, earnedByYear = {}, sippGrossByYear, cpiByYear })`. Every `estimate` object now carries `earnedPence` (number) and `earnedSource` (`'statement' | 'earnings'`) in addition to `openingPence, cpi, closingPence, upratedOpeningPence, piaPence, earningsPence, earningsSource`.

- [ ] **Step 1: Add the failing tests**

Inside `describe('buildPensionYear', …)` in `src/engine/pension.test.js`, after the existing tests, add:

```js
  describe('back-chain from the statement anchor', () => {
    const anchor2026 = { pence: 790_018, date: '2026-03-31', openingYear: '2026-27' };
    const within = (pia, pounds) => expect(Math.abs(pia - pounds * 100)).toBeLessThan(100);

    it('estimates the three prior years from pension earned and matches the TRS PIAs within £1', () => {
      const y = buildPensionYear({
        taxYear: '2026-27',
        scheme: 'nhs-2015',
        anchor: anchor2026,
        rows: [],
        earningsByYear: { '2026-27': 7_000_000 },
        earnedByYear: NHS_EARNED,
        sippGrossByYear: {},
      });
      expect(y.years.map((r) => r.piaSource)).toEqual(['estimate', 'estimate', 'estimate', 'estimate']);
      within(y.years[0].piaPence, 15060);
      within(y.years[1].piaPence, 18533);
      within(y.years[2].piaPence, 21486);
      expect(y.years.map((r) => r.estimate.openingPence)).toEqual([364_764, 495_727, 644_770, 790_018]);
      expect(y.years.map((r) => r.estimate.closingPence)).toEqual([495_727, 644_770, 790_018, 961_519]);
      expect(y.years.map((r) => r.estimate.earnedSource)).toEqual(['statement', 'statement', 'statement', 'earnings']);
      expect(y.years[2].estimate.earnedPence).toBe(124_615);
      expect(y.current.estimate.earnedPence).toBe(Math.round(7_000_000 / 54));
      expect(Math.abs(y.carryForwardPence - 12_492_100)).toBeLessThan(300);
      expect(y.cpiMissing).toEqual([]);
    });

    it('a missing pension-earned row stops the chain and is not a CPI gap', () => {
      const { '2024-25': _gap, ...withGap } = NHS_EARNED;
      const y = buildPensionYear({ taxYear: '2026-27', scheme: 'nhs-2015', anchor: anchor2026, rows: [], earningsByYear: {}, earnedByYear: withGap, sippGrossByYear: {} });
      expect(y.years.map((r) => r.piaSource)).toEqual(['none', 'none', 'estimate', 'estimate']);
      expect(y.years.slice(0, 2).map((r) => r.unusedPence)).toEqual([0, 0]);
      expect(y.cpiMissing).toEqual([]);
    });

    it('a missing CPI on the chain switches off that year and the years behind it, and lists them', () => {
      const { '2024-25': _cpi, ...cpiGap } = SEPTEMBER_CPI;
      const y = buildPensionYear({ taxYear: '2026-27', scheme: 'nhs-2015', anchor: anchor2026, rows: [], earningsByYear: {}, earnedByYear: NHS_EARNED, sippGrossByYear: {}, cpiByYear: cpiGap });
      expect(y.years.map((r) => r.piaSource)).toEqual(['none', 'none', 'estimate', 'estimate']);
      expect(y.cpiMissing).toEqual(['2023-24', '2024-25']);
    });

    it('a forward year with a pension-earned figure uses it instead of earnings ÷ 54', () => {
      const y = buildPensionYear({ taxYear: '2026-27', scheme: 'nhs-2015', anchor: anchor2026, rows: [], earningsByYear: { '2026-27': 7_000_000 }, earnedByYear: { '2026-27': 130_000 }, sippGrossByYear: {} });
      expect(y.current.estimate.earnedSource).toBe('statement');
      expect(y.current.estimate.earnedPence).toBe(130_000);
      expect(y.current.estimate.closingPence).toBe(961_889); // 790,018 × 1.053 + 130,000
    });

    it('an entered PIA still beats a back-chained estimate', () => {
      const y = buildPensionYear({ taxYear: '2026-27', scheme: 'nhs-2015', anchor: anchor2026, rows: [{ taxYear: '2025-26', piaPence: 2_150_000 }], earningsByYear: {}, earnedByYear: NHS_EARNED, sippGrossByYear: {} });
      expect(y.years[2]).toMatchObject({ piaSource: 'entered', piaPence: 2_150_000 });
      within(y.years[2].estimate.piaPence, 21486);
    });

    it('reaches 2022-23 but never back-chains before it, and that is not a CPI gap', () => {
      const y = buildPensionYear({ taxYear: '2024-25', scheme: 'nhs-2015', anchor: { pence: 364_764, date: '2023-03-31', openingYear: '2023-24' }, rows: [], earningsByYear: {}, earnedByYear: { ...NHS_EARNED, '2021-22': 50_000 }, sippGrossByYear: {} });
      expect(y.years.map((r) => r.taxYear)).toEqual(['2021-22', '2022-23', '2023-24', '2024-25']);
      expect(y.years.map((r) => r.piaSource)).toEqual(['none', 'estimate', 'estimate', 'estimate']);
      expect(y.years[1].estimate.openingPence).toBe(280_982); // 2022-23, one step back from the anchor
      expect(y.cpiMissing).toEqual([]);
    });
  });
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/engine/pension.test.js`
Expected: the new `back-chain` tests FAIL (prior years come back `'none'`; `earnedSource` undefined). Existing tests still pass.

- [ ] **Step 3: Implement**

In `src/engine/pension.js`, replace the whole `buildPensionYear` function with:

```js
/**
 * The viewed tax year plus the three before it: per year the allowance, the
 * pension input amount in force (entered beats estimate), grossed-up
 * personal/SIPP contributions, used and unused; then the carry-forward,
 * SIPP headroom (gross and the net payment), and the over/chargeable verdict.
 *
 * Years from the anchor's opening year onward are rolled FORWARD from it;
 * years before it are rolled BACKWARD through the statement's per-year
 * "pension earned" (`earnedByYear`) — a gap in those rows stops the chain and
 * leaves the earlier years unknown (source 'none').
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
  earnedByYear = {},
  sippGrossByYear = {},
  cpiByYear = SEPTEMBER_CPI,
}) {
  const rowByYear = new Map((rows || []).map((r) => [r.taxYear, r]));
  const cpiMissing = [];
  const canEstimate = !!(scheme && SCHEMES[scheme] && anchor && anchor.openingYear && anchor.openingYear >= FIRST_ESTIMATE_YEAR);
  const anchorArgs = canEstimate ? { scheme, anchorPence: anchor.pence, anchorOpeningYear: anchor.openingYear, cpiByYear } : null;

  /** True when any CPI from `from` to `to` inclusive is missing. */
  const cpiGapBetween = (from, to) => {
    for (let y = from; y <= to; y = shiftTaxYear(y, 1)) if (typeof cpiByYear[y] !== 'number') return true;
    return false;
  };

  const years = windowYears(taxYear).map((label) => {
    const { allowancePence, fromTable } = annualAllowanceForYear(label);
    const row = rowByYear.get(label) || null;
    const earningsPence = pence(earningsByYear[label]);
    const earningsSource = row && row.pensionableEarningsPence != null ? 'override' : 'timeline';
    const earnedEntered = numberOrNull(earnedByYear, label);

    let estimate = null;
    if (canEstimate && label >= FIRST_ESTIMATE_YEAR) {
      if (label >= anchor.openingYear) {
        const rolled = rollForward({ ...anchorArgs, targetYear: label, earningsByYear, earnedByYear });
        const cpi = cpiByYear[label];
        if (rolled && typeof cpi === 'number') {
          const est = estimatePia({ scheme, openingPence: rolled.openingPence, cpi, earningsPence, earnedPence: earnedEntered });
          estimate = {
            openingPence: rolled.openingPence,
            cpi,
            ...est,
            earningsPence,
            earningsSource,
            earnedPence: earnedEntered != null ? earnedEntered : Math.round(earningsPence / SCHEMES[scheme].accrualDenominator),
            earnedSource: earnedEntered != null ? 'statement' : 'earnings',
          };
        } else {
          cpiMissing.push(label);
        }
      } else {
        const rolled = rollBackward({ ...anchorArgs, targetYear: label, earnedByYear });
        if (rolled) {
          const step = rolled.chain[rolled.chain.length - 1];
          estimate = {
            openingPence: step.openingPence,
            cpi: step.cpi,
            closingPence: step.closingPence,
            upratedOpeningPence: step.upratedOpeningPence,
            piaPence: step.piaPence,
            earningsPence,
            earningsSource,
            earnedPence: step.earnedPence,
            earnedSource: 'statement',
          };
        } else if (cpiGapBetween(label, shiftTaxYear(anchor.openingYear, -1))) {
          cpiMissing.push(label);
        }
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

In the module header comment, replace the paragraph starting `The user enters one ANCHOR` with:

```
 * The user enters one ANCHOR (accrued pension at a statement date); the engine
 * rolls it forward year by year, and BACKWARDS through the statement's
 * per-year "pension earned" for the years before it. An entered figure
 * (Pension Savings Statement or the owner's own reconstruction) always beats
 * the estimate.
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/engine/pension.test.js`
Expected: all PASS, including the pre-existing `lists the years whose estimate was switched off by a missing CPI` (`['2027-28', '2028-29']`) and `a scheme member year with no entered figure and no estimate contributes nothing` (`cpiMissing` empty).

- [ ] **Step 5: Run the whole suite**

Run: `npx vitest run`
Expected: all PASS (the adapter and render tests still call `buildPensionYear` without `earnedByYear`, which defaults to `{}`).

- [ ] **Step 6: Commit**

```bash
git add src/engine/pension.js src/engine/pension.test.js
git commit -m "Pension engine: estimate the years before the anchor by back-chaining pension earned

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: `pensionEarnedPence` on the repository

**Files:**
- Modify: `src/db/repositories.js` (`validatePensionYear`, `pensionYearsRepo`)
- Test: `src/db/pensionYears.test.js`

**Interfaces:**
- Produces: `pensionYears` rows accept `pensionEarnedPence` (pounds at the edge, integer pence at rest, null passes through, default null, negative rejected). `upsert(personId, taxYear, data)` accepts it in `data`.

- [ ] **Step 1: Add the failing test**

Inside `describe('pensionYearsRepo', …)` in `src/db/pensionYears.test.js`, add:

```js
  it('stores pensionEarnedPence as pence, reads it back as pounds, keeps null, rejects negatives', async () => {
    const p = await peopleRepo.add({ name: 'A' });
    const id = await pensionYearsRepo.add({ personId: p, taxYear: '2025-26', pensionEarnedPence: 1246.15 });
    expect(await db.pensionYears.get(id)).toMatchObject({ pensionEarnedPence: 124615, piaPence: null, pensionableEarningsPence: null });
    expect(await pensionYearsRepo.get(id)).toMatchObject({ pensionEarnedPence: 1246.15 });

    const bare = await pensionYearsRepo.add({ personId: p, taxYear: '2024-25' });
    expect((await db.pensionYears.get(bare)).pensionEarnedPence).toBe(null);

    await pensionYearsRepo.upsert(p, '2025-26', { pensionEarnedPence: null });
    expect((await db.pensionYears.get(id)).pensionEarnedPence).toBe(null);

    await expect(pensionYearsRepo.add({ personId: p, taxYear: '2023-24', pensionEarnedPence: -1 })).rejects.toThrow(/pensionEarnedPence/);
  });
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/db/pensionYears.test.js`
Expected: FAIL — the stored row has no `pensionEarnedPence` (the base repository strips unknown fields), or it is stored as pounds.

- [ ] **Step 3: Implement**

In `src/db/repositories.js`:

In `validatePensionYear`, change the loop list to:

```js
  for (const f of ['piaPence', 'pensionableEarningsPence', 'pensionEarnedPence']) {
```

In `pensionYearsRepo`, change the `createBaseRepository` call to:

```js
  ...createBaseRepository(
    db.pensionYears,
    // null passes through untouched: "not entered" is a real state.
    ['piaPence', 'pensionableEarningsPence', 'pensionEarnedPence'],
    { piaPence: null, pensionableEarningsPence: null, pensionEarnedPence: null, note: '' },
    validatePensionYear
  ),
```

Update the `upsert` JSDoc `@param {object} data` line to list `piaPence, pensionableEarningsPence, pensionEarnedPence, note`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/db/pensionYears.test.js src/db/schemaUpgrade.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/repositories.js src/db/pensionYears.test.js
git commit -m "Pension years: store the statement's pension earned per year

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Adapter builds `earnedByYear`

**Files:**
- Modify: `src/db/pensionData.js`
- Test: `src/db/pensionData.test.js`

**Interfaces:**
- Consumes: `buildPensionYear` with `earnedByYear` (Task 3); repository field (Task 4).
- Produces: each person entry from `gatherPensionData` has `rows[].pensionEarnedPence` (pence or null) and `earnedByYear` (`{ label: pence }`, only years with a figure); the engine result is built with it.

- [ ] **Step 1: Add the failing test**

Inside `describe('gatherPensionData', …)` in `src/db/pensionData.test.js`, after the earnings-override test, add:

```js
  it('back-chains the years before the anchor from the statement pension earned', async () => {
    const p = await peopleRepo.add({
      name: 'Anderson',
      pensionScheme: 'nhs-2015',
      pensionAnchorPence: 7900.18,
      pensionAnchorDate: '2026-03-31',
    });
    await salaryPeriodsRepo.add({ personId: p, effectiveFrom: '1900-01-01', annualSalaryPence: 70000 });
    await pensionYearsRepo.upsert(p, '2023-24', { pensionEarnedPence: 886.5 });
    await pensionYearsRepo.upsert(p, '2024-25', { pensionEarnedPence: 1083.93 });
    await pensionYearsRepo.upsert(p, '2025-26', { pensionEarnedPence: 1246.15, note: 'from the NHS site' });

    const me = (await gatherPensionData('2026-27')).people[0];
    expect(me.rows.find((r) => r.taxYear === '2025-26')).toMatchObject({ pensionEarnedPence: 124_615, piaPence: null });
    expect(me.earnedByYear).toEqual({ '2023-24': 88_650, '2024-25': 108_393, '2025-26': 124_615 });
    expect(me.years.map((y) => y.piaSource)).toEqual(['estimate', 'estimate', 'estimate', 'estimate']);
    expect(me.years.map((y) => y.estimate.openingPence)).toEqual([364_764, 495_727, 644_770, 790_018]);
    expect(me.years.map((y) => y.estimate.earnedSource)).toEqual(['statement', 'statement', 'statement', 'earnings']);
    expect(Math.abs(me.carryForwardPence - 12_492_100)).toBeLessThan(300);
  });
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/db/pensionData.test.js`
Expected: FAIL — `earnedByYear` is undefined and the prior years are `'none'`.

- [ ] **Step 3: Implement**

In `src/db/pensionData.js`:

Extend the `rows` mapping:

```js
    const rows = rowsRaw
      .filter((r) => r.personId === p.id)
      .map((r) => ({
        id: r.id,
        taxYear: r.taxYear,
        note: r.note || '',
        piaPence: r.piaPence == null ? null : toPence(r.piaPence), // pounds → pence
        pensionableEarningsPence:
          r.pensionableEarningsPence == null ? null : toPence(r.pensionableEarningsPence), // pounds → pence
        pensionEarnedPence: r.pensionEarnedPence == null ? null : toPence(r.pensionEarnedPence), // pounds → pence
      }));
```

After the `earningsByYear` loop, add:

```js
    // The statement's "pension earned" per year — the back-chain's input, and
    // the accrual in place of earnings ÷ denominator where a year has one.
    const earnedByYear = {};
    for (const r of rows) if (r.pensionEarnedPence != null) earnedByYear[r.taxYear] = r.pensionEarnedPence;
```

In the returned object, add `earnedByYear,` after `earningsByYear,` and pass it to the engine:

```js
      ...buildPensionYear({ taxYear: taxYearLabel, scheme, anchor, rows, earningsByYear, earnedByYear, sippGrossByYear }),
```

Update the function JSDoc: after "the pensionable earnings per year (…)", add "the statement's pension earned per year,".

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/db/pensionData.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/pensionData.js src/db/pensionData.test.js
git commit -m "Pension adapter: pass the statement's pension earned per year to the engine

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Year form, four-year table and card

**Files:**
- Modify: `src/ui/pension/PensionYearForm.jsx`
- Modify: `src/ui/pension/PensionYearsTable.jsx`
- Modify: `src/ui/pension/PensionCard.jsx`
- Test: `src/ui/pension/pensionRender.test.jsx`

**Interfaces:**
- Consumes: `entry.years[].estimate.{openingPence, closingPence, earnedPence, earnedSource}` (Task 3), `entry.anchor.openingYear`, `FIRST_ESTIMATE_YEAR`; `pensionYearsRepo.upsert` accepting `pensionEarnedPence` (Task 4).
- Produces: `PensionYearForm` `onSubmit` payload `{ piaPence, pensionableEarningsPence, pensionEarnedPence, note }` (pounds or null). `Pension.jsx` already forwards the payload to `upsert` untouched, so it needs no change.

- [ ] **Step 1: Add the failing render test**

In `src/ui/pension/pensionRender.test.jsx`, inside `describe('Pension tab', …)`, after the `lists the four-year window…` test, add:

```js
  it('back-chains prior years from the statement’s pension earned, showing opening and closing', async () => {
    const p = await peopleRepo.add({
      name: 'Anderson',
      pensionScheme: 'nhs-2015',
      pensionAnchorPence: 7900.18,
      pensionAnchorDate: '2026-03-31',
    });
    await salaryPeriodsRepo.add({ personId: p, effectiveFrom: '1900-01-01', annualSalaryPence: 70000 });
    await pensionYearsRepo.upsert(p, '2024-25', { pensionEarnedPence: 1083.93 });
    await pensionYearsRepo.upsert(p, '2025-26', { pensionEarnedPence: 1246.15 });
    render(<Pension initialTaxYear="2026-27" />);
    await screen.findByText('Anderson');

    // 2023-24 has no pension-earned row yet: the chain stops there and the card says what to do.
    expect(screen.getByText(/Enter each year’s pension earned from the statement/)).toBeTruthy();
    const yearRows = () => screen.getAllByRole('row').filter((r) => /^20\d\d-\d\d/.test(r.textContent));
    let rows = yearRows();
    expect(within(rows[0]).getByText('none')).toBeTruthy();
    expect(within(rows[1]).getByText('estimate')).toBeTruthy();
    expect(rows[1].textContent).toMatch(/£4,957\.27/); // 2024-25 opening
    expect(rows[1].textContent).toMatch(/£6,447\.70/); // 2024-25 closing
    expect(rows[2].textContent).toMatch(/£7,900\.18/); // 2025-26 closing = the anchor
    expect(within(rows[0]).getAllByText('—').length).toBeGreaterThanOrEqual(3); // opening, closing, pension input

    fireEvent.click(within(rows[0]).getByRole('button', { name: 'Edit' }));
    await screen.findByRole('dialog');
    fireEvent.change(screen.getByLabelText('Pension earned'), { target: { value: '886.50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => {
      const saved = (await pensionYearsRepo.forPerson(p)).find((r) => r.taxYear === '2023-24');
      expect(saved).toMatchObject({ pensionEarnedPence: 886.5, piaPence: null, pensionableEarningsPence: null });
    });
    await waitFor(() => {
      rows = yearRows();
      expect(within(rows[0]).getByText('estimate')).toBeTruthy();
    });
    expect(rows[0].textContent).toMatch(/£3,647\.64/); // 2023-24 opening
    expect(rows[0].textContent).toMatch(/£15,059\.43/); // 2023-24 PIA, within £1 of the TRS £15,060
    expect(screen.queryByText(/Enter each year’s pension earned/)).toBeNull();
  });

  it('labels the accrual as from the statement when this year has a pension-earned figure', async () => {
    const p = await seedOwner();
    await pensionYearsRepo.upsert(p, '2026-27', { pensionEarnedPence: 1300 });
    render(<Pension initialTaxYear="2026-27" />);
    await screen.findByText('Anderson');
    const estimate = screen.getByText(/This year’s estimate/).closest('section');
    expect(within(estimate).getByText(/from statement/)).toBeTruthy();
    expect(within(estimate).getByText('£1,300.00')).toBeTruthy();
  });
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/ui/pension/pensionRender.test.jsx`
Expected: the two new tests FAIL (no "Enter each year’s pension earned" text; no "Pension earned" label). Existing tests pass.

- [ ] **Step 3: The year form**

Replace `src/ui/pension/PensionYearForm.jsx` with:

```jsx
import { useState } from 'react';
import CurrencyInput from '../components/CurrencyInput.jsx';

/**
 * One tax year's entered figures (amendment (k) + the pension-earned
 * back-chain): the statement's "pension earned in year", the pension input
 * amount from a Pension Savings Statement, and an optional pensionable-
 * earnings override. Blank = null = "not entered" — the engine estimates
 * what it can from the rest. Pounds at the repository edge.
 *
 * @param {string} props.taxYear - "2025-26".
 * @param {object|null} props.initial - the raw pensionYears row (pounds), or null.
 * @param {(payload: { piaPence, pensionableEarningsPence, pensionEarnedPence, note }) => void} props.onSubmit
 */
export default function PensionYearForm({ taxYear, initial, onSubmit, onCancel }) {
  const [earned, setEarned] = useState(initial?.pensionEarnedPence ?? '');
  const [pia, setPia] = useState(initial?.piaPence ?? '');
  const [earnings, setEarnings] = useState(initial?.pensionableEarningsPence ?? '');
  const [note, setNote] = useState(initial?.note || '');
  const [error, setError] = useState(null);

  const optional = (v) => (v === '' || v == null ? null : Number(v));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const pensionEarnedPence = optional(earned);
    const piaPence = optional(pia);
    const pensionableEarningsPence = optional(earnings);
    if ([pensionEarnedPence, piaPence, pensionableEarningsPence].some((v) => v != null && v < 0)) {
      setError('Figures can’t be negative.');
      return;
    }
    try {
      await onSubmit({ piaPence, pensionableEarningsPence, pensionEarnedPence, note: note.trim() }); // pounds edge
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <div className="form-row">
        <div className="field">
          <label htmlFor="pension-year-earned">Pension earned</label>
          <CurrencyInput id="pension-year-earned" value={earned} onChange={setEarned} />
          <p className="field__hint">
            The “pension earned in year” figure from the NHS/LGPS statement. Fills in the years
            before the statement, and replaces earnings ÷ 54 otherwise.
          </p>
        </div>
        <div className="field">
          <label htmlFor="pension-year-pia">Pension input amount</label>
          <CurrencyInput id="pension-year-pia" value={pia} onChange={setPia} />
          <p className="field__hint">
            The {taxYear} figure from the Pension Savings Statement, if you have one. Leave
            blank to use the estimate.
          </p>
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="pension-year-earnings">Pensionable earnings</label>
          <CurrencyInput id="pension-year-earnings" value={earnings} onChange={setEarnings} />
          <p className="field__hint">
            Only if the year's pensionable pay differs from the salary timeline. Leave blank to
            use the timeline.
          </p>
        </div>
        <div className="field">
          <label htmlFor="pension-year-note">Note</label>
          <input id="pension-year-note" className="input" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. PSS received Oct 2026" />
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

- [ ] **Step 4: The four-year table**

In `src/ui/pension/PensionYearsTable.jsx`, add two header cells after `<th>Tax year</th>`:

```jsx
            <th className="num">Opening</th>
            <th className="num">Closing</th>
```

and two body cells after `<td>{y.taxYear}</td>`:

```jsx
              <td className="num">{y.estimate ? <Money pence={y.estimate.openingPence} /> : <span className="muted">—</span>}</td>
              <td className="num">{y.estimate ? <Money pence={y.estimate.closingPence} /> : <span className="muted">—</span>}</td>
```

Update the component JSDoc's first line to: "The four-year window: opening and closing pension (from the estimate), allowance, pension input amount (with its source), …".

- [ ] **Step 5: The card**

In `src/ui/pension/PensionCard.jsx`:

Replace the *Accrual added* `<dd>` with:

```jsx
              <dd>
                <Money pence={est.earnedPence} />
                {est.earnedSource === 'statement' && <span className="muted"> (from statement)</span>}
              </dd>
```

Replace the fallback text branch `current.taxYear < anchor.openingYear ? … : …` with:

```jsx
                : current.taxYear < anchor.openingYear
                  ? `The anchor opens ${anchor.openingYear}; enter this year’s pension earned from the statement (and each year between) to estimate it backwards.`
                  : 'No estimate — the September CPI for this year is not recorded yet.'}
```

Add, just before the `<PensionYearsTable …/>` line, a prompt computed from the window:

```jsx
      {needsEarned && (
        <p className="muted">Enter each year’s pension earned from the statement to fill the years before it.</p>
      )}
```

and near the top of the component (after `const taper = …`):

```js
  // A prior year the back-chain could reach but has no pension-earned row for.
  const needsEarned =
    !!scheme &&
    !!anchor &&
    years.slice(0, -1).some((y) => y.piaSource === 'none' && y.taxYear >= FIRST_ESTIMATE_YEAR && y.taxYear < anchor.openingYear);
```

(`FIRST_ESTIMATE_YEAR` is already imported.)

- [ ] **Step 6: Run the render tests**

Run: `npx vitest run src/ui/pension/pensionRender.test.jsx`
Expected: all PASS. (`£15,059.43` is the engine's 2023-24 PIA from the rounded chain, 1,505,943 pence — the same figure Task 3 checks within £1 of the TRS £15,060.)

- [ ] **Step 7: Run the whole suite**

Run: `npx vitest run`
Expected: all PASS.

- [ ] **Step 8: Verify in the browser**

Use the project's `verify` skill (`Skill: verify`) to launch the app, open the Pension tab, set the owner's scheme/anchor if not present, edit 2025-26 → Pension earned 1246.15, 2024-25 → 1083.93, 2023-24 → 886.50, and confirm: the three prior rows show *estimate* with openings £3,647.64 / £4,957.27 / £6,447.70, carry-forward ≈ £124,921, and no console errors. Take a screenshot.

- [ ] **Step 9: Commit**

```bash
git add src/ui/pension/PensionYearForm.jsx src/ui/pension/PensionYearsTable.jsx src/ui/pension/PensionCard.jsx src/ui/pension/pensionRender.test.jsx
git commit -m "Pension tab: enter the statement's pension earned per year; show opening and closing

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Spec amendment and design status

**Files:**
- Modify: `specs/REFACTOR-SPEC.md` (amendment (k) bullets)
- Modify: `specs/2026-09-15-pension-earned-backchain-design.md` (status line)
- Modify: `specs/2026-09-15-pension-panel-design.md` (one pointer)

- [ ] **Step 1: Amendment (k) bullet**

In `specs/REFACTOR-SPEC.md`, under amendment (k), after the **Data — schema v8, additive** bullet, add:

```markdown
- **Back-chain from "pension earned"** (2026-09-15, additive, no schema bump): the NHS/LGPS
  site gives the current accrued pension and each year's *pension earned* but no PIA and
  no past statements. `pensionYears` rows gain `pensionEarnedPence`; the engine rolls the
  anchor **backwards** through consecutive years that have it
  (`opening = (closing − earned) ÷ (1 + CPI + real)`), so the carry-forward years are
  estimated, and uses it as the accrual in forward years. A gap stops the chain; the year
  form, table (opening/closing columns) and card surface it. Design:
  `specs/2026-09-15-pension-earned-backchain-design.md`.
```

- [ ] **Step 2: Status lines**

In `specs/2026-09-15-pension-earned-backchain-design.md`, change `**Status:** approved, not yet implemented` to `**Status:** implemented`.

In `specs/2026-09-15-pension-panel-design.md`, after the `**Spec:**` line, add:

```markdown
**See also:** `2026-09-15-pension-earned-backchain-design.md` — prior years estimated
backwards from the statement's "pension earned" (adds `pensionEarnedPence`, `rollBackward`).
```

- [ ] **Step 3: Commit**

```bash
git add specs/REFACTOR-SPEC.md specs/2026-09-15-pension-earned-backchain-design.md specs/2026-09-15-pension-panel-design.md
git commit -m "Specs: record the pension-earned back-chain as built

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
