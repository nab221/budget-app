# Expenses Tab — Table and By-date Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persisted **Cards · Table · By date** view switch to the Expenses tab so every committed outgoing can be scanned, sorted and compared in one place, without changing the data model.

**Architecture:** Three pure modules under `src/ui/expenses/` (`tableRows.js`, `sortRows.js`, `byDate.js`) turn the tab's existing pence data into row objects using engine functions that already exist (`insights.effectiveApr` / `monthlyInterestPence`, `plan.creditCardMinPence`, `finance.simulatePayoff` / `simulateLoanPayoff`, `spending.spendingOccurrences` and the `next*` helpers). Three read-only components (`DebtsTable`, `ExpensesTable`, `ByDateList`) render them. `Expenses.jsx` owns the view state, persists it through one new settings key, and handles "jump back to the card". Cards view is untouched.

**Tech Stack:** Vite + React 18 (JSX, plain JavaScript, no TypeScript), Dexie over IndexedDB, date-fns, Vitest + @testing-library/react + fake-indexeddb.

**Spec:** `specs/2026-09-12-expenses-views-design.md` (owner-approved 2026-09-12).

## Global Constraints

- Money is integer **pence** in every module in this plan. The tab already holds pence data (`penceData` built by `mapBillsToPence` / `mapDebtsToPence` / `childcareDepositsFromChildren`); the new modules take that and only that. Pounds appear nowhere except through `<Money pence={…} />`.
- Never persist computed rows. Row objects, totals, running totals, payoff months are computed at read time. The only new stored value is the setting `expensesView`.
- No `innerHTML`, no `window.*` handler globals, no inline `onclick=` attributes.
- Payment dates already come working-day adjusted from the engine; show the existing `shifted` tag, never recompute.
- Table and By-date rows are **read-only**: no Edit / Delete / Update balance in them. Clicking a name jumps to the card.
- View values are exactly `'cards' | 'table' | 'by-date'`, default `'cards'`. Sort state and expanded months are component state only.
- "Today" is `localDayStr(new Date())` (local calendar day), the same `from` the tab already computes. An occurrence dated today counts as **still to go**.
- Tests: one file with `npx vitest run <path>`; the whole suite with `npx vitest run`. Render tests use fake timers with `toFake: ['Date']` at **Tue 7 Jul 2026** like the existing suite.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Work on branch `claude/expenses-views` (already created from `origin/main`, holds the design doc).

## File Structure

| File | Responsibility |
|---|---|
| `src/db/settings.js` | New default `expensesView: 'cards'`, `EXPENSES_VIEWS`, `getExpensesView` / `setExpensesView`. |
| `src/db/settings.test.js` | Default + round-trip + invalid-value tests. |
| `src/ui/expenses/cardIds.js` | `cardDomId(kind, key)` — the stable DOM id a card carries and a row jumps to. |
| `src/ui/expenses/sortRows.js` | `sortRows`, `toggleSort`, `compareValues` — column sorting, empties last. |
| `src/ui/expenses/sortRows.test.js` | Sort tests. |
| `src/ui/expenses/tableRows.js` | `buildDebtRows`, `buildExpenseRows`, `debtTotals`, `expenseTotals` — pence row models for both tables. |
| `src/ui/expenses/tableRows.test.js` | Row-model tests (rates, promo, utilisation, payoff, status, totals). |
| `src/ui/expenses/byDate.js` | `buildByDate`, `rollUpMonths`, `describeKind`, `occurrenceDomId` — day groups, running totals, today split, month roll-up. |
| `src/ui/expenses/byDate.test.js` | By-date tests. |
| `src/ui/expenses/SortHeader.jsx` | One sortable `<th>` (button + arrow + `aria-sort`), shared by both tables. |
| `src/ui/expenses/DebtsTable.jsx` | The debts panel. |
| `src/ui/expenses/ExpensesTable.jsx` | The recurring-expenses panel. |
| `src/ui/expenses/ByDateList.jsx` | The by-date panel with today divider, footer, month roll-up. |
| `src/ui/expenses/ExpenseCard.jsx` | Exports `FREQ_SUFFIX`; accepts `domId` / `highlighted`. |
| `src/ui/expenses/DebtCard.jsx` | Accepts `domId` / `highlighted`. |
| `src/ui/Expenses.jsx` | View state + persistence, View control, row building, jump-to-card highlight. |
| `src/ui/expenses/expensesRender.test.jsx` | Component tests for the three panels + integration tests on the tab. |
| `src/styles.css` | `.sort-btn`, `.rowlink`, `.util--inline`, `.bydate__*`, `.is-past`, `.is-highlight`. |

---

### Task 1: The `expensesView` setting

**Files:**
- Modify: `src/db/settings.js` (defaults block at the top, `settings` object at the bottom)
- Test: `src/db/settings.test.js`

**Interfaces:**
- Produces: `EXPENSES_VIEWS = ['cards', 'table', 'by-date']`, `settings.getExpensesView(): Promise<string>`, `settings.setExpensesView(view): Promise<void>` (an unknown value is stored as `'cards'`).

- [ ] **Step 1: Write the failing tests**

In `src/db/settings.test.js`, add one line to the existing defaults test and a new `describe` after the last one in the file:

```js
// inside it('returns documented defaults when unset', …) — add with the other expects:
    expect(await getSetting('expensesView')).toBe('cards');
```

```js
describe('expensesView', () => {
  it('defaults to cards and round-trips a valid view', async () => {
    expect(await settings.getExpensesView()).toBe('cards');
    await settings.setExpensesView('table');
    expect(await settings.getExpensesView()).toBe('table');
    await settings.setExpensesView('by-date');
    expect(await settings.getExpensesView()).toBe('by-date');
  });

  it('falls back to cards for an unknown value', async () => {
    await settings.setExpensesView('bogus');
    expect(await settings.getExpensesView()).toBe('cards');
  });

  it('is listed in the defaults so getAllSettings includes it', async () => {
    expect(SETTINGS_DEFAULTS.expensesView).toBe('cards');
    expect(EXPENSES_VIEWS).toEqual(['cards', 'table', 'by-date']);
  });
});
```

Update the import at the top of the test file to:

```js
import { getSetting, setSetting, settings, SETTINGS_DEFAULTS, EXPENSES_VIEWS } from './settings.js';
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/db/settings.test.js`
Expected: FAIL — `EXPENSES_VIEWS` is not exported / `settings.getExpensesView is not a function`.

- [ ] **Step 3: Implement**

In `src/db/settings.js`, add to `SETTINGS_DEFAULTS` (after `mileageMarginalRate`):

```js
  // Expenses tab view (design 2026-09-12): 'cards' | 'table' | 'by-date'.
  expensesView: 'cards',
```

Add above `SETTINGS_DEFAULTS`:

```js
/** The Expenses tab's view switch values, in display order. */
export const EXPENSES_VIEWS = ['cards', 'table', 'by-date'];
```

Add to the `settings` object (after the Mileage entries, before "Backup bookkeeping"):

```js
  // Expenses tab view. Anything outside EXPENSES_VIEWS is stored as 'cards'
  // so a stale or hand-edited value can never blank the tab.
  getExpensesView: () => getSetting('expensesView'),
  setExpensesView: (view) =>
    setSetting('expensesView', EXPENSES_VIEWS.includes(view) ? view : 'cards'),
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/db/settings.test.js`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add src/db/settings.js src/db/settings.test.js
git commit -m "Add the expensesView setting for the Expenses tab view switch

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Column sorting helper

**Files:**
- Create: `src/ui/expenses/sortRows.js`
- Test: `src/ui/expenses/sortRows.test.js`

**Interfaces:**
- Produces: `sortRows(rows, key, dir = 'asc') → Array` (new array; numbers numeric, strings `localeCompare`, empty values last in both directions; stable), `toggleSort(current, key) → { key, dir }` (same key flips, new key starts `'asc'`), `compareValues(a, b) → number`.

- [ ] **Step 1: Write the failing tests**

```js
// src/ui/expenses/sortRows.test.js
import { describe, it, expect } from 'vitest';
import { sortRows, toggleSort, compareValues } from './sortRows.js';

const rows = [
  { name: 'Visa', balancePence: 100000, utilisation: 50 },
  { name: 'amex', balancePence: 5000, utilisation: null },
  { name: 'Car loan', balancePence: 500000, utilisation: null },
  { name: 'Barclaycard', balancePence: 20000, utilisation: 10 },
];

describe('sortRows', () => {
  it('sorts numbers ascending and descending', () => {
    expect(sortRows(rows, 'balancePence', 'asc').map((r) => r.name)).toEqual([
      'amex', 'Barclaycard', 'Visa', 'Car loan',
    ]);
    expect(sortRows(rows, 'balancePence', 'desc').map((r) => r.name)).toEqual([
      'Car loan', 'Visa', 'Barclaycard', 'amex',
    ]);
  });

  it('sorts text case-insensitively with localeCompare', () => {
    expect(sortRows(rows, 'name', 'asc').map((r) => r.name)).toEqual([
      'amex', 'Barclaycard', 'Car loan', 'Visa',
    ]);
  });

  it('puts empty values last in both directions', () => {
    expect(sortRows(rows, 'utilisation', 'asc').map((r) => r.name)).toEqual([
      'Barclaycard', 'Visa', 'amex', 'Car loan',
    ]);
    expect(sortRows(rows, 'utilisation', 'desc').map((r) => r.name)).toEqual([
      'Visa', 'Barclaycard', 'amex', 'Car loan',
    ]);
  });

  it('does not mutate the input', () => {
    const copy = [...rows];
    sortRows(rows, 'balancePence', 'desc');
    expect(rows).toEqual(copy);
  });

  it('treats an empty string as empty', () => {
    expect(compareValues('', 'x')).toBeGreaterThan(0);
    expect(compareValues(null, undefined)).toBe(0);
  });
});

describe('toggleSort', () => {
  it('starts a new column ascending and flips the same column', () => {
    expect(toggleSort({ key: 'ratePercent', dir: 'desc' }, 'balancePence')).toEqual({
      key: 'balancePence', dir: 'asc',
    });
    expect(toggleSort({ key: 'balancePence', dir: 'asc' }, 'balancePence')).toEqual({
      key: 'balancePence', dir: 'desc',
    });
    expect(toggleSort({ key: 'balancePence', dir: 'desc' }, 'balancePence')).toEqual({
      key: 'balancePence', dir: 'asc',
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/expenses/sortRows.test.js`
Expected: FAIL — cannot resolve `./sortRows.js`.

- [ ] **Step 3: Implement**

```js
// src/ui/expenses/sortRows.js
/**
 * Column sorting for the Expenses tab tables (design 2026-09-12 §3.3). Pure.
 *
 * Empty values (null / undefined / '') sort LAST in both directions, so a loan
 * with no utilisation never floats to the top of a utilisation sort. Numbers
 * compare numerically, everything else by locale-aware string comparison.
 */

const isEmpty = (v) => v == null || v === '';

/** Three-way compare; empties last. */
export function compareValues(a, b) {
  const ea = isEmpty(a);
  const eb = isEmpty(b);
  if (ea && eb) return 0;
  if (ea) return 1;
  if (eb) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'en-GB', { sensitivity: 'base' });
}

/**
 * @param {Array<object>} rows
 * @param {string} key - row property to sort by
 * @param {'asc'|'desc'} [dir]
 * @returns {Array<object>} a new, stably sorted array
 */
export function sortRows(rows, key, dir = 'asc') {
  const sign = dir === 'desc' ? -1 : 1;
  return [...rows].sort((x, y) => {
    const a = x[key];
    const b = y[key];
    const ea = isEmpty(a);
    const eb = isEmpty(b);
    // Empties stay last regardless of direction.
    if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1;
    return compareValues(a, b) * sign;
  });
}

/**
 * Next sort state after clicking a column header: first click ascending,
 * second click flips, a different column starts ascending again.
 * @param {{key: string, dir: 'asc'|'desc'}|null} current
 * @param {string} key
 */
export function toggleSort(current, key) {
  if (current && current.key === key) {
    return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  }
  return { key, dir: 'asc' };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/ui/expenses/sortRows.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/expenses/sortRows.js src/ui/expenses/sortRows.test.js
git commit -m "Add the column sort helper for the Expenses tables

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Row models for both tables

**Files:**
- Create: `src/ui/expenses/cardIds.js`
- Create: `src/ui/expenses/tableRows.js`
- Test: `src/ui/expenses/tableRows.test.js`

**Interfaces:**
- Consumes (engine, all pence): `effectiveApr(debt, refStr)`, `monthlyInterestPence(debts, refStr) → { totalPence, byDebt: [{id, name, pence}] }` from `src/engine/insights.js`; `creditCardMinPence(debt, refStr)` from `src/engine/plan.js`; `simulatePayoff(cards, strategy, extraPence, startDate)` and `simulateLoanPayoff(loans, 'term-reduction', 0, startDate)` from `src/engine/finance.js`, both returning `{ resultsByDebt: [{ id, monthsToClear }] }` where `monthsToClear` is `Infinity` when never cleared and `1` means the start month; `toFinanceDebts(debts) → { cards, loans }` and `SIMULATION_CAP_MONTHS` from `src/engine/payoff.js`; `annualisedBillPence`, `annualToPeriodPence`, `nextDebtPayment`, `nextBillOccurrence`, `nextChildcareDeposit` from `src/engine/spending.js`.
- Produces:
  - `cardDomId(kind, key) → string` with `kind ∈ 'debt' | 'bill' | 'childcare'`.
  - `buildDebtRows({ debts, strategy, extraPence, fromStr }) → DebtRow[]` where `DebtRow = { id, domId, name, type: 'Card'|'Loan', balancePence, ratePercent, promoActive, promoEndDate: string|null, postPromoApr: number|null, paymentPence, interestPence, utilisation: number|null, creditLimitPence: number|null, payoffMonth: 'yyyy-MM'|null, neverClears: boolean, nextDate: string|null, nextAdjusted: boolean }`.
  - `buildExpenseRows({ bills, childcareDeposits, categories, fromStr }) → ExpenseRow[]` where `ExpenseRow = { id, domId, kind: 'bill'|'childcare', name, category, amountPence, frequency, perMonthPence, perYearPence, nextDate: string|null, nextAdjusted: boolean, status: 'active'|'paused'|'ended' }`.
  - `debtTotals(rows) → { balancePence, paymentPence, interestPence }`, `expenseTotals(rows) → { perMonthPence, perYearPence }`.

- [ ] **Step 1: Write the failing tests**

```js
// src/ui/expenses/tableRows.test.js
import { describe, it, expect } from 'vitest';
import { cardDomId } from './cardIds.js';
import { buildDebtRows, buildExpenseRows, debtTotals, expenseTotals } from './tableRows.js';

const FROM = '2026-07-07'; // Tue

// Engine-shape (PENCE) fixtures — what mapDebtsToPence / mapBillsToPence return.
const visa = {
  id: 1, name: 'Visa', debtType: 'credit-card', balancePence: 100000, apr: 24,
  creditLimitPence: 200000, promoEndDate: null, postPromoApr: null,
  minPaymentOverridePence: null, paymentDayOfMonth: 20,
};
const promoCard = {
  id: 2, name: 'Promo card', debtType: 'credit-card', balancePence: 50000, apr: 22,
  creditLimitPence: null, promoEndDate: '2026-12-31', postPromoApr: 29,
  minPaymentOverridePence: 2500, paymentDayOfMonth: 5,
};
const loan = {
  id: 3, name: 'Car loan', debtType: 'loan', balancePence: 500000, interestRate: 6,
  fixedMonthlyPaymentPence: 25000, paymentDayOfMonth: 28,
};
const cleared = {
  id: 4, name: 'Old card', debtType: 'credit-card', balancePence: 0, apr: 30,
  creditLimitPence: 100000, promoEndDate: null, postPromoApr: null,
  minPaymentOverridePence: null, paymentDayOfMonth: 1,
};
const hopeless = {
  id: 5, name: 'Stuck loan', debtType: 'loan', balancePence: 500000, interestRate: 12,
  fixedMonthlyPaymentPence: 1000, paymentDayOfMonth: 1,
};

describe('cardDomId', () => {
  it('is stable and safe for any key', () => {
    expect(cardDomId('debt', 7)).toBe('expense-card-debt-7');
    expect(cardDomId('childcare', 'Childcare — Ada')).toBe('expense-card-childcare-Childcare_____Ada');
  });
});

describe('buildDebtRows', () => {
  const rows = buildDebtRows({ debts: [visa, promoCard, loan, cleared, hopeless], strategy: 'avalanche', extraPence: 0, fromStr: FROM });
  const byName = Object.fromEntries(rows.map((r) => [r.name, r]));

  it('builds a card row: effective rate, min payment, interest, utilisation, next date', () => {
    const r = byName.Visa;
    expect(r.type).toBe('Card');
    expect(r.domId).toBe('expense-card-debt-1');
    expect(r.ratePercent).toBe(24);
    expect(r.promoActive).toBe(false);
    // UK min: max(1% + interest, 2.25%, £5) = max(1000 + 2000, 2250, 500) = £30.
    expect(r.paymentPence).toBe(3000);
    expect(r.interestPence).toBe(2000); // 100000 × 24% ÷ 12
    expect(r.utilisation).toBe(50);
    expect(r.creditLimitPence).toBe(200000);
    expect(r.payoffMonth).toMatch(/^\d{4}-\d{2}$/);
    expect(r.neverClears).toBe(false);
    expect(r.nextDate).toBe('2026-07-20');
    expect(r.nextAdjusted).toBe(false);
  });

  it('shows 0% with the post-promo rate while a promo is active, and honours the override', () => {
    const r = byName['Promo card'];
    expect(r.ratePercent).toBe(0);
    expect(r.promoActive).toBe(true);
    expect(r.promoEndDate).toBe('2026-12-31');
    expect(r.postPromoApr).toBe(29);
    expect(r.interestPence).toBe(0);
    expect(r.paymentPence).toBe(2500);
    expect(r.utilisation).toBeNull(); // no limit
    expect(r.creditLimitPence).toBeNull();
  });

  it('builds a loan row with no utilisation and the fixed payment', () => {
    const r = byName['Car loan'];
    expect(r.type).toBe('Loan');
    expect(r.ratePercent).toBe(6);
    expect(r.paymentPence).toBe(25000);
    expect(r.interestPence).toBe(2500); // 500000 × 6% ÷ 12
    expect(r.utilisation).toBeNull();
    expect(r.payoffMonth).toMatch(/^\d{4}-\d{2}$/);
    expect(r.nextDate).toBe('2026-07-28');
  });

  it('gives a zero-balance debt nothing to pay and no payoff month', () => {
    const r = byName['Old card'];
    expect(r.paymentPence).toBe(0);
    expect(r.interestPence).toBe(0);
    expect(r.utilisation).toBe(0);
    expect(r.payoffMonth).toBeNull();
    expect(r.neverClears).toBe(false);
    expect(r.nextDate).toBeNull();
  });

  it('flags a loan whose payment never covers the interest as never clearing', () => {
    const r = byName['Stuck loan'];
    expect(r.payoffMonth).toBeNull();
    expect(r.neverClears).toBe(true);
  });

  it('dates the payoff month from fromStr (a loan cleared in month 1 clears this month)', () => {
    const tiny = { ...loan, id: 9, name: 'Tiny', balancePence: 1000 };
    const [r] = buildDebtRows({ debts: [tiny], strategy: 'avalanche', extraPence: 0, fromStr: FROM });
    expect(r.payoffMonth).toBe('2026-07');
  });

  it('clamps utilisation to 100', () => {
    const over = { ...visa, id: 10, balancePence: 250000 };
    const [r] = buildDebtRows({ debts: [over], strategy: 'avalanche', extraPence: 0, fromStr: FROM });
    expect(r.utilisation).toBe(100);
  });

  it('totals balance, payment and interest', () => {
    expect(debtTotals(rows)).toEqual({
      balancePence: 100000 + 50000 + 500000 + 0 + 500000,
      paymentPence: 3000 + 2500 + 25000 + 0 + 1000,
      interestPence: 2000 + 0 + 2500 + 0 + 5000,
    });
  });
});

describe('buildExpenseRows', () => {
  const categories = [{ id: 1, name: 'Utilities', kind: 'spending' }];
  const broadband = {
    id: 11, label: 'Broadband', amountPence: 3000, categoryId: 1, frequency: 'monthly',
    nextDueDate: '2026-07-15', dueDayAnchor: 15, adjustToWorkingDay: false, active: true,
  };
  const gym = { ...broadband, id: 12, label: 'Gym', amountPence: 4000, categoryId: 99, active: false };
  const old = { ...broadband, id: 13, label: 'Old sub', nextDueDate: '2026-01-10', dueDayAnchor: 10, endDate: '2026-03-01' };
  const weekly = { ...broadband, id: 14, label: 'Milk', amountPence: 500, frequency: 'weekly', nextDueDate: '2026-07-09' };
  const deposit = { label: 'Childcare — Ada', amountPence: 40000, paymentDayOfMonth: 1, adjustToWorkingDay: true };

  const rows = buildExpenseRows({ bills: [broadband, gym, old, weekly], childcareDeposits: [deposit], categories, fromStr: FROM });
  const byName = Object.fromEntries(rows.map((r) => [r.name, r]));

  it('builds an active monthly bill row', () => {
    const r = byName.Broadband;
    expect(r).toMatchObject({
      kind: 'bill', domId: 'expense-card-bill-11', category: 'Utilities', amountPence: 3000,
      frequency: 'monthly', perMonthPence: 3000, perYearPence: 36000,
      nextDate: '2026-07-15', nextAdjusted: false, status: 'active',
    });
  });

  it('marks a paused bill and zeroes its per-period figures', () => {
    const r = byName.Gym;
    expect(r.status).toBe('paused');
    expect(r.category).toBe('Uncategorised');
    expect(r.amountPence).toBe(4000); // the amount is still shown
    expect(r.perMonthPence).toBe(0);
    expect(r.perYearPence).toBe(0);
    expect(r.nextDate).toBeNull();
  });

  it('marks an ended bill and zeroes its per-period figures', () => {
    const r = byName['Old sub'];
    expect(r.status).toBe('ended');
    expect(r.perYearPence).toBe(0);
    expect(r.nextDate).toBeNull();
  });

  it('annualises a weekly bill with exact day steps (52.18 a year)', () => {
    const r = byName.Milk;
    expect(r.perYearPence).toBe(Math.round(500 * (365.25 / 7)));
    expect(r.perMonthPence).toBe(Math.round((500 * (365.25 / 7)) / 12));
    expect(r.nextDate).toBe('2026-07-09');
  });

  it('adds a childcare deposit as a monthly row under the Childcare category', () => {
    const r = byName['Childcare — Ada'];
    expect(r).toMatchObject({
      kind: 'childcare', domId: cardDomId('childcare', 'Childcare — Ada'), category: 'Childcare',
      amountPence: 40000, frequency: 'monthly', perMonthPence: 40000, perYearPence: 480000, status: 'active',
    });
    expect(r.nextDate).toBe('2026-08-03'); // 1 Aug 2026 is a Saturday → Mon 3 Aug
    expect(r.nextAdjusted).toBe(true);
  });

  it('totals only active rows', () => {
    expect(expenseTotals(rows)).toEqual({
      perMonthPence: 3000 + Math.round((500 * (365.25 / 7)) / 12) + 40000,
      perYearPence: 36000 + Math.round(500 * (365.25 / 7)) + 480000,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/expenses/tableRows.test.js`
Expected: FAIL — cannot resolve `./cardIds.js` / `./tableRows.js`.

- [ ] **Step 3: Implement `cardIds.js`**

```js
// src/ui/expenses/cardIds.js
/**
 * Stable DOM id for one card on the Expenses tab, so the Table and By-date
 * views can jump back to it (design 2026-09-12 §2). Any character that is not
 * safe in an id is replaced, so a childcare label with spaces or dashes works.
 *
 * @param {'debt'|'bill'|'childcare'} kind
 * @param {string|number} key - debt id, bill id, or the childcare deposit label
 */
export function cardDomId(kind, key) {
  return `expense-card-${kind}-${String(key).replace(/[^A-Za-z0-9_-]/g, '_')}`;
}
```

- [ ] **Step 4: Implement `tableRows.js`**

```js
// src/ui/expenses/tableRows.js
/**
 * Row models for the Expenses tab's Table view (design 2026-09-12 §3). Pure,
 * PENCE in and PENCE out: the caller passes the engine-shaped data the tab
 * already builds (`mapDebtsToPence`, `mapBillsToPence`,
 * `childcareDepositsFromChildren`). Nothing here is persisted.
 */
import { addMonths, format, parseISO } from 'date-fns';
import { effectiveApr, monthlyInterestPence } from '../../engine/insights.js';
import { creditCardMinPence } from '../../engine/plan.js';
import { simulatePayoff, simulateLoanPayoff } from '../../engine/finance.js';
import { toFinanceDebts, SIMULATION_CAP_MONTHS } from '../../engine/payoff.js';
import {
  annualisedBillPence,
  annualToPeriodPence,
  nextDebtPayment,
  nextBillOccurrence,
  nextChildcareDeposit,
} from '../../engine/spending.js';
import { cardDomId } from './cardIds.js';

/** 'yyyy-MM' a debt clears; simulation month 1 is the month of `fromStr`. */
function clearMonth(monthsToClear, fromStr) {
  if (!Number.isFinite(monthsToClear) || monthsToClear >= SIMULATION_CAP_MONTHS) return null;
  return format(addMonths(parseISO(fromStr), Math.max(0, monthsToClear - 1)), 'yyyy-MM');
}

/**
 * Per-debt payoff month under the persisted strategy: cards through the card
 * simulator (with the extra payment), loans at their fixed payment. Debts with
 * no balance are skipped by `toFinanceDebts` and simply have no entry.
 * @returns {Map<*, {payoffMonth: string|null, neverClears: boolean}>}
 */
function payoffByDebtId(debts, strategy, extraPence, fromStr) {
  const { cards, loans } = toFinanceDebts(debts);
  const out = new Map();
  const collect = (sim) => {
    for (const r of sim.resultsByDebt) {
      const payoffMonth = clearMonth(r.monthsToClear, fromStr);
      out.set(r.id, { payoffMonth, neverClears: payoffMonth == null });
    }
  };
  if (cards.length > 0) collect(simulatePayoff(cards, strategy, extraPence, fromStr));
  if (loans.length > 0) collect(simulateLoanPayoff(loans, 'term-reduction', 0, fromStr));
  return out;
}

/**
 * @param {{debts: Array, strategy?: 'avalanche'|'snowball', extraPence?: number, fromStr: string}} args
 * @returns {Array<object>} one DebtRow per debt (see plan Task 3 Interfaces)
 */
export function buildDebtRows({ debts, strategy = 'avalanche', extraPence = 0, fromStr }) {
  const list = debts || [];
  const interestById = new Map(monthlyInterestPence(list, fromStr).byDebt.map((d) => [d.id, d.pence]));
  const payoff = payoffByDebtId(list, strategy, extraPence, fromStr);

  return list.map((d) => {
    const isCard = d.debtType !== 'loan';
    const balance = d.balancePence || 0;
    const limit = isCard ? d.creditLimitPence || 0 : 0;
    const promoActive = isCard && Boolean(d.promoEndDate) && fromStr < d.promoEndDate;
    const paymentPence = isCard
      ? balance > 0
        ? creditCardMinPence(d, fromStr)
        : 0
      : d.fixedMonthlyPaymentPence || 0;
    const p = payoff.get(d.id) || { payoffMonth: null, neverClears: false };
    const next = nextDebtPayment(d, fromStr);
    return {
      id: d.id,
      domId: cardDomId('debt', d.id),
      name: d.name,
      type: isCard ? 'Card' : 'Loan',
      balancePence: balance,
      ratePercent: effectiveApr(d, fromStr),
      promoActive,
      promoEndDate: promoActive ? d.promoEndDate : null,
      postPromoApr: promoActive ? (d.postPromoApr ?? d.apr ?? 0) : null,
      paymentPence,
      interestPence: interestById.get(d.id) || 0,
      utilisation: limit > 0 ? Math.min(100, Math.max(0, (balance / limit) * 100)) : null,
      creditLimitPence: limit > 0 ? limit : null,
      payoffMonth: p.payoffMonth,
      neverClears: p.neverClears,
      nextDate: next ? next.date : null,
      nextAdjusted: Boolean(next && next.isAdjusted),
    };
  });
}

/**
 * @param {{bills: Array, childcareDeposits: Array, categories: Array, fromStr: string}} args
 * @returns {Array<object>} one ExpenseRow per bill, then one per childcare deposit
 */
export function buildExpenseRows({ bills, childcareDeposits, categories, fromStr }) {
  const categoryName = new Map((categories || []).map((c) => [c.id, c.name]));

  const rows = (bills || []).map((b) => {
    const paused = b.active === false;
    const next = paused ? null : nextBillOccurrence(b, fromStr);
    const status = paused ? 'paused' : next ? 'active' : 'ended';
    // Paused and ended rows keep their amount but count for nothing.
    const perYearPence = status === 'active' ? Math.round(annualisedBillPence(b)) : 0;
    return {
      id: b.id,
      domId: cardDomId('bill', b.id),
      kind: 'bill',
      name: b.label,
      category: categoryName.get(b.categoryId) ?? 'Uncategorised',
      amountPence: b.amountPence || 0,
      frequency: b.frequency,
      perMonthPence: status === 'active' ? annualToPeriodPence(annualisedBillPence(b), 'month') : 0,
      perYearPence,
      nextDate: next ? next.date : null,
      nextAdjusted: Boolean(next && next.isAdjusted),
      status,
    };
  });

  for (const dep of childcareDeposits || []) {
    const next = nextChildcareDeposit(dep, fromStr);
    rows.push({
      id: `childcare:${dep.label}`,
      domId: cardDomId('childcare', dep.label),
      kind: 'childcare',
      name: dep.label,
      category: 'Childcare',
      amountPence: dep.amountPence || 0,
      frequency: 'monthly',
      perMonthPence: dep.amountPence || 0,
      perYearPence: (dep.amountPence || 0) * 12,
      nextDate: next ? next.date : null,
      nextAdjusted: Boolean(next && next.isAdjusted),
      status: 'active',
    });
  }
  return rows;
}

/** Totals row for the debts table (pence). */
export function debtTotals(rows) {
  return rows.reduce(
    (t, r) => ({
      balancePence: t.balancePence + (r.balancePence || 0),
      paymentPence: t.paymentPence + (r.paymentPence || 0),
      interestPence: t.interestPence + (r.interestPence || 0),
    }),
    { balancePence: 0, paymentPence: 0, interestPence: 0 },
  );
}

/** Totals row for the expenses table (pence). Inactive rows already carry 0. */
export function expenseTotals(rows) {
  return rows.reduce(
    (t, r) => ({
      perMonthPence: t.perMonthPence + (r.perMonthPence || 0),
      perYearPence: t.perYearPence + (r.perYearPence || 0),
    }),
    { perMonthPence: 0, perYearPence: 0 },
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/ui/expenses/tableRows.test.js`
Expected: PASS (15 tests). If the childcare `nextDate` assertion fails on the working-day shift, check the date: 1 Aug 2026 is a Saturday, so the engine shifts to Mon 3 Aug 2026; the fixture's `fromStr` is 7 Jul, so July's 1st has passed.

- [ ] **Step 6: Commit**

```bash
git add src/ui/expenses/cardIds.js src/ui/expenses/tableRows.js src/ui/expenses/tableRows.test.js
git commit -m "Add pure row models for the Expenses Table view

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: By-date grouping helper

**Files:**
- Create: `src/ui/expenses/byDate.js`
- Test: `src/ui/expenses/byDate.test.js`

**Interfaces:**
- Consumes: `spendingOccurrences(data, startStr, endStr)` from `src/engine/spending.js`, returning date-sorted rows `{ date, label, amountPence, kind: 'bill'|'debt-min'|'loan'|'childcare', isAdjusted, sourceId? (bills), debtId? (debts) }`; `cardDomId` from Task 3.
- Produces:
  - `buildByDate(data, startStr, endStr, todayStr) → { days: Day[], months: Month[], goneOutPence, stillToGoPence, totalPence }` where `Day = { date, isPast, rows: Row[], totalPence }`, `Row = occurrence + { runningPence, domId }`, `Month = { month: 'yyyy-MM', days: Day[], totalPence, isPast }`.
  - `rollUpMonths(days) → Month[]`.
  - `describeKind(occ, categoryByBillId: Map<billId, categoryName>) → string` (`'Card' | 'Loan' | 'Childcare' | 'Bill' | 'Bill · <category>'`).
  - `occurrenceDomId(occ) → string`.

- [ ] **Step 1: Write the failing tests**

```js
// src/ui/expenses/byDate.test.js
import { describe, it, expect } from 'vitest';
import { buildByDate, rollUpMonths, describeKind, occurrenceDomId } from './byDate.js';

// Engine-shape (PENCE) data. July 2026: bill on Wed 15th, Visa min on Mon 20th,
// loan on Tue 28th — none shift.
const data = {
  recurringBills: [
    { id: 11, label: 'Broadband', amountPence: 3000, frequency: 'monthly', nextDueDate: '2026-07-15', dueDayAnchor: 15, adjustToWorkingDay: false, active: true },
  ],
  debts: [
    { id: 1, name: 'Visa', debtType: 'credit-card', balancePence: 100000, apr: 0, minPaymentOverridePence: 5000, paymentDayOfMonth: 20 },
    { id: 3, name: 'Car loan', debtType: 'loan', balancePence: 500000, interestRate: 6, fixedMonthlyPaymentPence: 25000, paymentDayOfMonth: 28 },
  ],
  childcareDeposits: [],
};
const JULY = ['2026-07-01', '2026-08-01'];

describe('buildByDate', () => {
  it('groups occurrences by day with running totals', () => {
    const r = buildByDate(data, ...JULY, '2026-07-07');
    expect(r.days.map((d) => d.date)).toEqual(['2026-07-15', '2026-07-20', '2026-07-28']);
    expect(r.days.map((d) => d.rows[0].runningPence)).toEqual([3000, 8000, 33000]);
    expect(r.days.map((d) => d.totalPence)).toEqual([3000, 5000, 25000]);
    expect(r.totalPence).toBe(33000);
    expect(r.days[0].rows[0].domId).toBe('expense-card-bill-11');
    expect(r.days[1].rows[0].domId).toBe('expense-card-debt-1');
  });

  it('splits gone-out and still-to-go at today', () => {
    const r = buildByDate(data, ...JULY, '2026-07-21');
    expect(r.goneOutPence).toBe(8000);
    expect(r.stillToGoPence).toBe(25000);
    expect(r.days.map((d) => d.isPast)).toEqual([true, true, false]);
  });

  it('counts an occurrence dated today as still to go', () => {
    const r = buildByDate(data, ...JULY, '2026-07-20');
    expect(r.goneOutPence).toBe(3000);
    expect(r.stillToGoPence).toBe(30000);
    expect(r.days[1].isPast).toBe(false);
  });

  it('merges two payments on one day into one group', () => {
    const sameDay = { ...data, debts: [{ ...data.debts[0], paymentDayOfMonth: 15 }] };
    const r = buildByDate(sameDay, ...JULY, '2026-07-07');
    expect(r.days[0].rows).toHaveLength(2);
    expect(r.days[0].totalPence).toBe(8000);
    expect(r.days[0].rows[1].runningPence).toBe(8000);
  });

  it('returns empty structures when nothing is due', () => {
    const r = buildByDate({ recurringBills: [], debts: [], childcareDeposits: [] }, ...JULY, '2026-07-07');
    expect(r).toEqual({ days: [], months: [], goneOutPence: 0, stillToGoPence: 0, totalPence: 0 });
  });
});

describe('rollUpMonths', () => {
  it('rolls days into months with totals, a month being past only when all its days are', () => {
    const r = buildByDate(data, '2026-07-01', '2026-10-01', '2026-08-25');
    expect(r.months.map((m) => m.month)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(r.months.map((m) => m.totalPence)).toEqual([33000, 33000, 33000]);
    expect(r.months.map((m) => m.isPast)).toEqual([true, false, false]);
    expect(r.months[1].days).toHaveLength(3);
    expect(rollUpMonths([])).toEqual([]);
  });
});

describe('describeKind / occurrenceDomId', () => {
  const cats = new Map([[11, 'Utilities']]);
  it('labels each kind, bills with their category', () => {
    expect(describeKind({ kind: 'debt-min' }, cats)).toBe('Card');
    expect(describeKind({ kind: 'loan' }, cats)).toBe('Loan');
    expect(describeKind({ kind: 'childcare' }, cats)).toBe('Childcare');
    expect(describeKind({ kind: 'bill', sourceId: 11 }, cats)).toBe('Bill · Utilities');
    expect(describeKind({ kind: 'bill', sourceId: 99 }, cats)).toBe('Bill');
    expect(describeKind({ kind: 'bill', sourceId: 11 }, undefined)).toBe('Bill');
  });
  it('maps an occurrence to its card id', () => {
    expect(occurrenceDomId({ kind: 'bill', sourceId: 11 })).toBe('expense-card-bill-11');
    expect(occurrenceDomId({ kind: 'loan', debtId: 3 })).toBe('expense-card-debt-3');
    expect(occurrenceDomId({ kind: 'childcare', label: 'Childcare — Ada' })).toBe('expense-card-childcare-Childcare_____Ada');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/expenses/byDate.test.js`
Expected: FAIL — cannot resolve `./byDate.js`.

- [ ] **Step 3: Implement**

```js
// src/ui/expenses/byDate.js
/**
 * The Expenses tab's By-date view (design 2026-09-12 §4): every occurrence in
 * the selected period from the SAME engine walk that produces the "Going out"
 * total, grouped by day, with running totals and a split at today. Pure, PENCE.
 */
import { spendingOccurrences } from '../../engine/spending.js';
import { cardDomId } from './cardIds.js';

const KIND_LABEL = { 'debt-min': 'Card', loan: 'Loan', childcare: 'Childcare', bill: 'Bill' };

/** 'Card' / 'Loan' / 'Childcare' / 'Bill · <category>' for the kind column. */
export function describeKind(occ, categoryByBillId) {
  if (occ.kind === 'bill') {
    const category = categoryByBillId ? categoryByBillId.get(occ.sourceId) : null;
    return category ? `Bill · ${category}` : 'Bill';
  }
  return KIND_LABEL[occ.kind] ?? occ.kind;
}

/** The DOM id of the card this occurrence belongs to. */
export function occurrenceDomId(occ) {
  if (occ.kind === 'bill') return cardDomId('bill', occ.sourceId);
  if (occ.kind === 'childcare') return cardDomId('childcare', occ.label);
  return cardDomId('debt', occ.debtId);
}

/**
 * Days → months, in order. A month is "past" only when every day in it is.
 * @param {Array<{date: string, isPast: boolean, rows: Array, totalPence: number}>} days
 * @returns {Array<{month: string, days: Array, totalPence: number, isPast: boolean}>}
 */
export function rollUpMonths(days) {
  const months = [];
  for (const day of days) {
    const key = day.date.slice(0, 7);
    const last = months[months.length - 1];
    if (last && last.month === key) {
      last.days.push(day);
      last.totalPence += day.totalPence;
      last.isPast = last.isPast && day.isPast;
    } else {
      months.push({ month: key, days: [day], totalPence: day.totalPence, isPast: day.isPast });
    }
  }
  return months;
}

/**
 * @param {{recurringBills?: Array, debts?: Array, childcareDeposits?: Array}} data - PENCE domain
 * @param {string} startStr - period start (inclusive), 'yyyy-MM-dd'
 * @param {string} endStr - period end (exclusive)
 * @param {string} todayStr - local calendar day; occurrences ON today are still to go
 */
export function buildByDate(data, startStr, endStr, todayStr) {
  const days = [];
  let running = 0;
  let goneOutPence = 0;
  let stillToGoPence = 0;

  // `spendingOccurrences` is date-sorted, so same-date rows arrive together.
  for (const occ of spendingOccurrences(data, startStr, endStr)) {
    const amount = occ.amountPence || 0;
    running += amount;
    const isPast = occ.date < todayStr;
    if (isPast) goneOutPence += amount;
    else stillToGoPence += amount;

    const row = { ...occ, runningPence: running, domId: occurrenceDomId(occ) };
    const last = days[days.length - 1];
    if (last && last.date === occ.date) {
      last.rows.push(row);
      last.totalPence += amount;
    } else {
      days.push({ date: occ.date, isPast, rows: [row], totalPence: amount });
    }
  }

  return { days, months: rollUpMonths(days), goneOutPence, stillToGoPence, totalPence: running };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/ui/expenses/byDate.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/expenses/byDate.js src/ui/expenses/byDate.test.js
git commit -m "Add the by-date grouping helper for the Expenses tab

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Sortable header and the two tables

**Files:**
- Create: `src/ui/expenses/SortHeader.jsx`
- Create: `src/ui/expenses/DebtsTable.jsx`
- Create: `src/ui/expenses/ExpensesTable.jsx`
- Modify: `src/ui/expenses/ExpenseCard.jsx` (export `FREQ_SUFFIX`)
- Modify: `src/styles.css` (append)
- Test: `src/ui/expenses/expensesRender.test.jsx` (new `describe` blocks)

**Interfaces:**
- Consumes: `sortRows`, `toggleSort` (Task 2); `debtTotals`, `expenseTotals` and the `DebtRow` / `ExpenseRow` shapes (Task 3); `Money`, `EmptyState`, `formatDay`, `formatPayMonth` from `src/ui/components/`.
- Produces: `<SortHeader column label sort onSort numeric />`, `<DebtsTable rows onJump />`, `<ExpensesTable rows onJump />`. `onJump(domId)` is called with the row's `domId`. Panel headings are exactly **"Debts"** and **"Recurring expenses"**.

- [ ] **Step 1: Write the failing tests**

Append to `src/ui/expenses/expensesRender.test.jsx` (after the last `describe`). Add these imports at the top of the file, below the existing ones:

```js
import DebtsTable from './DebtsTable.jsx';
import ExpensesTable from './ExpensesTable.jsx';
```

```js
// Hand-built rows in the shape buildDebtRows / buildExpenseRows return (pence).
const debtRows = [
  { id: 1, domId: 'expense-card-debt-1', name: 'Visa', type: 'Card', balancePence: 100000, ratePercent: 24, promoActive: false, promoEndDate: null, postPromoApr: null, paymentPence: 3000, interestPence: 2000, utilisation: 50, creditLimitPence: 200000, payoffMonth: '2030-06', neverClears: false, nextDate: '2026-07-20', nextAdjusted: false },
  { id: 2, domId: 'expense-card-debt-2', name: 'Promo card', type: 'Card', balancePence: 50000, ratePercent: 0, promoActive: true, promoEndDate: '2026-12-31', postPromoApr: 29, paymentPence: 2500, interestPence: 0, utilisation: null, creditLimitPence: null, payoffMonth: '2028-03', neverClears: false, nextDate: '2026-08-05', nextAdjusted: false },
  { id: 3, domId: 'expense-card-debt-3', name: 'Car loan', type: 'Loan', balancePence: 500000, ratePercent: 6, promoActive: false, promoEndDate: null, postPromoApr: null, paymentPence: 25000, interestPence: 2500, utilisation: null, creditLimitPence: null, payoffMonth: null, neverClears: true, nextDate: '2026-08-01', nextAdjusted: true },
];
const expenseRows = [
  { id: 11, domId: 'expense-card-bill-11', kind: 'bill', name: 'Broadband', category: 'Utilities', amountPence: 3000, frequency: 'monthly', perMonthPence: 3000, perYearPence: 36000, nextDate: '2026-07-15', nextAdjusted: false, status: 'active' },
  { id: 12, domId: 'expense-card-bill-12', kind: 'bill', name: 'Gym', category: 'Uncategorised', amountPence: 4000, frequency: 'monthly', perMonthPence: 0, perYearPence: 0, nextDate: null, nextAdjusted: false, status: 'paused' },
  { id: 'childcare:Ada', domId: 'expense-card-childcare-Ada', kind: 'childcare', name: 'Childcare — Ada', category: 'Childcare', amountPence: 40000, frequency: 'monthly', perMonthPence: 40000, perYearPence: 480000, nextDate: '2026-08-03', nextAdjusted: true, status: 'active' },
];

const bodyNames = () =>
  Array.from(document.querySelectorAll('tbody tr td:first-child')).map((td) => td.textContent);

describe('DebtsTable', () => {
  it('renders rows sorted by rate descending with totals, badges and payoff', () => {
    render(<DebtsTable rows={debtRows} onJump={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Debts' })).toBeTruthy();
    expect(bodyNames()).toEqual(['Visa', 'Car loan', 'Promo card']);
    expect(screen.getByRole('columnheader', { name: /Rate/ }).getAttribute('aria-sort')).toBe('descending');
    // Totals: £6,500 balance, £305 payment, £45 interest.
    expect(screen.getByText('£6,500.00')).toBeTruthy();
    expect(screen.getByText('£305.00')).toBeTruthy();
    expect(screen.getByText('£45.00')).toBeTruthy();
    // Promo badge with the post-promo rate in its tooltip; never-clearing loan; shifted tag.
    expect(screen.getByText('0% until 31 Dec 2026').getAttribute('title')).toBe('Then 29%');
    expect(screen.getByText('Never')).toBeTruthy();
    expect(screen.getByText('Jun 2030')).toBeTruthy();
    expect(screen.getByText('shifted')).toBeTruthy();
    // Utilisation only where there is a limit.
    expect(screen.getByText('50%')).toBeTruthy();
    // Read-only: no card actions.
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Update balance' })).toBeNull();
  });

  it('toggles a column ascending then descending and jumps on a name click', () => {
    const onJump = vi.fn();
    render(<DebtsTable rows={debtRows} onJump={onJump} />);
    const balance = screen.getByRole('button', { name: /Balance/ });
    fireEvent.click(balance);
    expect(bodyNames()).toEqual(['Promo card', 'Visa', 'Car loan']);
    expect(screen.getByRole('columnheader', { name: /Balance/ }).getAttribute('aria-sort')).toBe('ascending');
    fireEvent.click(balance);
    expect(bodyNames()).toEqual(['Car loan', 'Visa', 'Promo card']);
    expect(screen.getByRole('columnheader', { name: /Balance/ }).getAttribute('aria-sort')).toBe('descending');

    fireEvent.click(screen.getByRole('button', { name: 'Car loan' }));
    expect(onJump).toHaveBeenCalledWith('expense-card-debt-3');
  });

  it('shows an empty state with no debts', () => {
    render(<DebtsTable rows={[]} onJump={() => {}} />);
    expect(screen.getByText(/No credit cards or loans yet/)).toBeTruthy();
  });
});

describe('ExpensesTable', () => {
  it('renders rows sorted by per-month descending with totals and status', () => {
    render(<ExpensesTable rows={expenseRows} onJump={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Recurring expenses' })).toBeTruthy();
    expect(bodyNames()).toEqual(['Childcare — Ada', 'Broadband', 'Gym']);
    // Totals exclude the paused row: £430 / month, £5,160 / year.
    expect(screen.getByText('£430.00')).toBeTruthy();
    expect(screen.getByText('£5,160.00')).toBeTruthy();
    expect(screen.getByText('Paused')).toBeTruthy();
    expect(screen.getAllByText('Active')).toHaveLength(2);
    expect(screen.getByText('Utilities')).toBeTruthy();
    expect(screen.getByText('Childcare')).toBeTruthy();
    expect(screen.getByText('shifted')).toBeTruthy();
    // Paused row is muted.
    expect(screen.getByRole('button', { name: 'Gym' }).closest('tr').className).toContain('is-inactive');
  });

  it('sorts by name and jumps on a name click', () => {
    const onJump = vi.fn();
    render(<ExpensesTable rows={expenseRows} onJump={onJump} />);
    fireEvent.click(screen.getByRole('button', { name: /^Name/ }));
    expect(bodyNames()).toEqual(['Broadband', 'Childcare — Ada', 'Gym']);
    fireEvent.click(screen.getByRole('button', { name: 'Broadband' }));
    expect(onJump).toHaveBeenCalledWith('expense-card-bill-11');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/expenses/expensesRender.test.jsx`
Expected: FAIL — cannot resolve `./DebtsTable.jsx`.

- [ ] **Step 3: Export the frequency labels from `ExpenseCard.jsx`**

Change the `const FREQ_SUFFIX = {` line in `src/ui/expenses/ExpenseCard.jsx` to:

```js
export const FREQ_SUFFIX = {
```

- [ ] **Step 4: Implement `SortHeader.jsx`**

```jsx
// src/ui/expenses/SortHeader.jsx
/**
 * One sortable table header: a button that reports its column to the parent,
 * an arrow for the active column, and `aria-sort` for assistive tech.
 * First click on a column sorts ascending, the next flips (see `toggleSort`).
 */
export default function SortHeader({ column, label, sort, onSort, numeric = false }) {
  const active = sort.key === column;
  const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
  return (
    <th className={numeric ? 'num' : undefined} aria-sort={ariaSort}>
      <button
        type="button"
        className={`sort-btn${active ? ' is-active' : ''}`}
        onClick={() => onSort(column)}
      >
        {label}
        <span className="sort-btn__arrow" aria-hidden="true">
          {active ? (sort.dir === 'asc' ? '▲' : '▼') : ''}
        </span>
      </button>
    </th>
  );
}
```

- [ ] **Step 5: Implement `DebtsTable.jsx`**

```jsx
// src/ui/expenses/DebtsTable.jsx
import { useState } from 'react';
import Money from '../components/Money.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { formatDay, formatPayMonth } from '../components/dates.js';
import SortHeader from './SortHeader.jsx';
import { sortRows, toggleSort } from './sortRows.js';
import { debtTotals } from './tableRows.js';

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'type', label: 'Type' },
  { key: 'balancePence', label: 'Balance', numeric: true },
  { key: 'ratePercent', label: 'Rate', numeric: true },
  { key: 'paymentPence', label: 'Payment', numeric: true },
  { key: 'interestPence', label: 'Interest / month', numeric: true },
  { key: 'utilisation', label: 'Utilisation', numeric: true },
  { key: 'payoffMonth', label: 'Payoff' },
  { key: 'nextDate', label: 'Next payment' },
];

/**
 * Read-only, sortable table of every credit card and loan (design §3.1).
 * `rows` come from `buildDebtRows` (pence). Clicking a name calls
 * `onJump(domId)` so the tab can return to that card.
 */
export default function DebtsTable({ rows, onJump }) {
  const [sort, setSort] = useState({ key: 'ratePercent', dir: 'desc' });
  const sorted = sortRows(rows, sort.key, sort.dir);
  const totals = debtTotals(rows);

  return (
    <section className="panel">
      <h3 className="panel__title">Debts</h3>
      {rows.length === 0 ? (
        <EmptyState hint="No credit cards or loans yet. Add one from the Cards view." />
      ) : (
        <div className="table-wrap">
          <table className="table expenses-table">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <SortHeader
                    key={c.key}
                    column={c.key}
                    label={c.label}
                    numeric={c.numeric}
                    sort={sort}
                    onSort={(key) => setSort(toggleSort(sort, key))}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id}>
                  <td>
                    <button type="button" className="rowlink" onClick={() => onJump(r.domId)}>
                      {r.name}
                    </button>
                  </td>
                  <td>{r.type}</td>
                  <td className="num">
                    <Money pence={r.balancePence} />
                  </td>
                  <td className="num">
                    {r.ratePercent}%
                    {r.promoActive && (
                      <span className="badge badge--promo" title={`Then ${r.postPromoApr}%`}>
                        0% until {formatDay(r.promoEndDate)}
                      </span>
                    )}
                  </td>
                  <td className="num">
                    <Money pence={r.paymentPence} />
                  </td>
                  <td className="num">
                    <Money pence={r.interestPence} />
                  </td>
                  <td className="num">
                    {r.utilisation == null ? (
                      '—'
                    ) : (
                      <span className="util util--inline">
                        <span className="util__bar">
                          <span className="util__fill" style={{ width: `${r.utilisation}%` }} />
                        </span>
                        <span>{r.utilisation.toFixed(0)}%</span>
                      </span>
                    )}
                  </td>
                  <td>{r.neverClears ? 'Never' : r.payoffMonth ? formatPayMonth(r.payoffMonth) : '—'}</td>
                  <td>
                    {r.nextDate ? formatDay(r.nextDate) : '—'}
                    {r.nextAdjusted && <span className="tag">shifted</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="txn-totals">
                <td>Total</td>
                <td />
                <td className="num">
                  <Money pence={totals.balancePence} />
                </td>
                <td />
                <td className="num">
                  <Money pence={totals.paymentPence} />
                </td>
                <td className="num">
                  <Money pence={totals.interestPence} />
                </td>
                <td />
                <td />
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Implement `ExpensesTable.jsx`**

```jsx
// src/ui/expenses/ExpensesTable.jsx
import { useState } from 'react';
import Money from '../components/Money.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { formatDay } from '../components/dates.js';
import SortHeader from './SortHeader.jsx';
import { sortRows, toggleSort } from './sortRows.js';
import { expenseTotals } from './tableRows.js';
import { FREQ_SUFFIX } from './ExpenseCard.jsx';

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category' },
  { key: 'amountPence', label: 'Amount', numeric: true },
  { key: 'frequency', label: 'Frequency' },
  { key: 'perMonthPence', label: 'Per month', numeric: true },
  { key: 'perYearPence', label: 'Per year', numeric: true },
  { key: 'nextDate', label: 'Next payment' },
  { key: 'status', label: 'Status' },
];

const STATUS_LABEL = { active: 'Active', paused: 'Paused', ended: 'Ended' };

/**
 * Read-only, sortable table of every recurring expense and childcare deposit
 * (design §3.2). `rows` come from `buildExpenseRows` (pence).
 */
export default function ExpensesTable({ rows, onJump }) {
  const [sort, setSort] = useState({ key: 'perMonthPence', dir: 'desc' });
  const sorted = sortRows(rows, sort.key, sort.dir);
  const totals = expenseTotals(rows);

  return (
    <section className="panel">
      <h3 className="panel__title">Recurring expenses</h3>
      {rows.length === 0 ? (
        <EmptyState hint="No recurring expenses yet. Add one from the Cards view." />
      ) : (
        <div className="table-wrap">
          <table className="table expenses-table">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <SortHeader
                    key={c.key}
                    column={c.key}
                    label={c.label}
                    numeric={c.numeric}
                    sort={sort}
                    onSort={(key) => setSort(toggleSort(sort, key))}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className={r.status === 'active' ? undefined : 'is-inactive'}>
                  <td>
                    <button type="button" className="rowlink" onClick={() => onJump(r.domId)}>
                      {r.name}
                    </button>
                  </td>
                  <td>{r.category}</td>
                  <td className="num">
                    <Money pence={r.amountPence} />
                  </td>
                  <td>{FREQ_SUFFIX[r.frequency] ?? r.frequency}</td>
                  <td className="num">
                    <Money pence={r.perMonthPence} />
                  </td>
                  <td className="num">
                    <Money pence={r.perYearPence} />
                  </td>
                  <td>
                    {r.nextDate ? formatDay(r.nextDate) : '—'}
                    {r.nextAdjusted && <span className="tag">shifted</span>}
                  </td>
                  <td>{STATUS_LABEL[r.status] ?? r.status}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="txn-totals">
                <td>Total</td>
                <td />
                <td />
                <td />
                <td className="num">
                  <Money pence={totals.perMonthPence} />
                </td>
                <td className="num">
                  <Money pence={totals.perYearPence} />
                </td>
                <td />
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 7: Append the CSS**

Append to the end of `src/styles.css`:

```css
/* Expenses tab — Table view (design 2026-09-12) */
.sort-btn {
  font: inherit;
  font-size: inherit;
  text-transform: inherit;
  letter-spacing: inherit;
  color: inherit;
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
  white-space: nowrap;
}
.sort-btn.is-active {
  color: var(--fg);
}
.sort-btn__arrow {
  display: inline-block;
  width: 1em;
  margin-left: 0.2rem;
  font-size: 0.7em;
}
.table .num .sort-btn {
  text-align: right;
}
/* A row's name: looks like a link, jumps back to the card. */
.rowlink {
  font: inherit;
  color: var(--accent);
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
  text-align: left;
}
.rowlink:hover,
.rowlink:focus-visible {
  text-decoration: underline;
}
.expenses-table tr.is-inactive td {
  opacity: 0.55;
}
/* Utilisation meter squeezed into a table cell. */
.util--inline {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 0.4rem;
  min-width: 6rem;
}
.util--inline .util__bar {
  display: inline-block;
  width: 3.5rem;
}
.util--inline .util__fill {
  display: block;
}
.expenses-table .badge {
  margin-left: 0.4rem;
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run src/ui/expenses/expensesRender.test.jsx`
Expected: PASS — the existing tests plus the 5 new ones.

- [ ] **Step 9: Commit**

```bash
git add src/ui/expenses/SortHeader.jsx src/ui/expenses/DebtsTable.jsx src/ui/expenses/ExpensesTable.jsx src/ui/expenses/ExpenseCard.jsx src/styles.css src/ui/expenses/expensesRender.test.jsx
git commit -m "Add the read-only Debts and Recurring expenses tables

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: The By-date list

**Files:**
- Create: `src/ui/expenses/ByDateList.jsx`
- Modify: `src/styles.css` (append)
- Test: `src/ui/expenses/expensesRender.test.jsx` (new `describe`)

**Interfaces:**
- Consumes: `buildByDate` result shape and `describeKind` (Task 4); `Money`, `EmptyState`, `formatDay`, `formatPayMonth`.
- Produces: `<ByDateList byDate period todayStr categoryByBillId onJump />` where `period ∈ 'week'|'month'|'year'`. Footer labels are exactly **"Gone out so far"**, **"Still to go"**, **"Period total"**.

- [ ] **Step 1: Write the failing tests**

Add the import below the table imports in `src/ui/expenses/expensesRender.test.jsx`:

```js
import ByDateList from './ByDateList.jsx';
import { buildByDate } from './byDate.js';
```

Append:

```js
describe('ByDateList', () => {
  // Engine-shape pence data: bill 15th, Visa 20th, loan 28th each month.
  const data = {
    recurringBills: [
      { id: 11, label: 'Broadband', amountPence: 3000, frequency: 'monthly', nextDueDate: '2026-07-15', dueDayAnchor: 15, adjustToWorkingDay: false, active: true },
    ],
    debts: [
      { id: 1, name: 'Visa', debtType: 'credit-card', balancePence: 100000, apr: 0, minPaymentOverridePence: 5000, paymentDayOfMonth: 20 },
      { id: 3, name: 'Car loan', debtType: 'loan', balancePence: 500000, interestRate: 6, fixedMonthlyPaymentPence: 25000, paymentDayOfMonth: 28 },
    ],
    childcareDeposits: [],
  };
  const cats = new Map([[11, 'Utilities']]);
  const statValue = (label) => screen.getByText(label).nextSibling.textContent;

  it('lists a month by day with kinds, running totals, a today divider and the footer', () => {
    const byDate = buildByDate(data, '2026-07-01', '2026-08-01', '2026-07-21');
    const onJump = vi.fn();
    render(<ByDateList byDate={byDate} period="month" todayStr="2026-07-21" categoryByBillId={cats} onJump={onJump} />);

    expect(screen.getByText('15 Jul 2026')).toBeTruthy();
    expect(screen.getByText('Bill · Utilities')).toBeTruthy();
    expect(screen.getByText('Card')).toBeTruthy();
    expect(screen.getByText('Loan')).toBeTruthy();
    // Running totals: £30 → £80 → £330.
    expect(screen.getByText('£80.00')).toBeTruthy();
    expect(screen.getAllByText('£330.00').length).toBeGreaterThanOrEqual(1);
    // Today divider sits between the 20th and the 28th.
    expect(screen.getByText('Today — 21 Jul 2026')).toBeTruthy();
    expect(statValue('Gone out so far')).toBe('£80.00');
    expect(statValue('Still to go')).toBe('£250.00');
    expect(statValue('Period total')).toBe('£330.00');
    // Past days are muted.
    expect(screen.getByText('15 Jul 2026').closest('.day-group').className).toContain('is-past');
    expect(screen.getByText('28 Jul 2026').closest('.day-group').className).not.toContain('is-past');

    fireEvent.click(screen.getByRole('button', { name: 'Broadband' }));
    expect(onJump).toHaveBeenCalledWith('expense-card-bill-11');
  });

  it('rolls the year up into months that expand on click', () => {
    const byDate = buildByDate(data, '2026-07-01', '2027-01-01', '2026-07-21');
    render(<ByDateList byDate={byDate} period="year" todayStr="2026-07-21" categoryByBillId={cats} onJump={() => {}} />);

    // Six month rows, collapsed: no day headings yet.
    expect(screen.getByRole('button', { name: /Jul 2026/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Dec 2026/ })).toBeTruthy();
    expect(screen.queryByText('15 Jul 2026')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Aug 2026/ }));
    expect(screen.getByText('15 Aug 2026')).toBeTruthy(); // adjustToWorkingDay is false, so the 15th stays
  });

  it('shows an empty state when nothing is due', () => {
    const byDate = buildByDate({ recurringBills: [], debts: [], childcareDeposits: [] }, '2026-07-01', '2026-08-01', '2026-07-21');
    render(<ByDateList byDate={byDate} period="month" todayStr="2026-07-21" categoryByBillId={cats} onJump={() => {}} />);
    expect(screen.getByText(/Nothing goes out in this period/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/expenses/expensesRender.test.jsx`
Expected: FAIL — cannot resolve `./ByDateList.jsx`.

- [ ] **Step 3: Implement `ByDateList.jsx`**

```jsx
// src/ui/expenses/ByDateList.jsx
import { useState } from 'react';
import Money from '../components/Money.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { formatDay, formatPayMonth } from '../components/dates.js';
import { describeKind } from './byDate.js';

/** One day's occurrences under a date + day-total heading (mirrors PaymentDayGroup). */
function DayBlock({ day, categoryByBillId, onJump }) {
  return (
    <div className={`day-group${day.isPast ? ' is-past' : ''}`}>
      <div className="day-group__head">
        <span className="day-group__date">{formatDay(day.date)}</span>
        {day.rows.length > 1 && <Money pence={day.totalPence} className="day-group__total" />}
      </div>
      <ul className="upcoming-list">
        {day.rows.map((r, i) => (
          <li className="upcoming-list__row bydate__row" key={`${r.domId}-${i}`}>
            <span className="upcoming-list__label">
              <button type="button" className="rowlink" onClick={() => onJump(r.domId)}>
                {r.label}
              </button>
              <span className="bydate__kind muted">{describeKind(r, categoryByBillId)}</span>
              {r.isAdjusted && <span className="tag">shifted</span>}
            </span>
            <Money pence={r.amountPence} className="upcoming-list__amount" />
            <Money pence={r.runningPence} className="bydate__running muted" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function TodayDivider({ todayStr }) {
  return (
    <div className="bydate__today" role="separator" aria-label="Today">
      Today — {formatDay(todayStr)}
    </div>
  );
}

/**
 * Renders `items` in order with the today divider before the first item that
 * is not past (or after everything when the whole period has gone). `isPast`
 * and `render` let the same walk serve days (week/month) and months (year).
 */
function withTodayDivider(items, todayStr, isPast, render) {
  const out = [];
  let placed = false;
  for (const item of items) {
    if (!placed && !isPast(item)) {
      out.push(<TodayDivider key="today" todayStr={todayStr} />);
      placed = true;
    }
    out.push(render(item));
  }
  if (!placed) out.push(<TodayDivider key="today" todayStr={todayStr} />);
  return out;
}

/**
 * The By-date view (design §4): every occurrence in the period in date order,
 * grouped by day, with running totals, a divider at today, and a footer that
 * splits the period total into gone-out and still-to-go. For the year period
 * days roll up into collapsible months. Read-only; names jump to their card.
 */
export default function ByDateList({ byDate, period, todayStr, categoryByBillId, onJump }) {
  const [openMonths, setOpenMonths] = useState(() => new Set());
  const { days, months, goneOutPence, stillToGoPence, totalPence } = byDate;

  const toggleMonth = (month) =>
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });

  if (days.length === 0) {
    return (
      <section className="panel">
        <h3 className="panel__title">By date</h3>
        <EmptyState hint="Nothing goes out in this period." />
      </section>
    );
  }

  const renderDay = (day) => (
    <DayBlock key={day.date} day={day} categoryByBillId={categoryByBillId} onJump={onJump} />
  );

  return (
    <section className="panel bydate">
      <h3 className="panel__title">By date</h3>

      {period === 'year'
        ? withTodayDivider(months, todayStr, (m) => m.isPast, (m) => {
            const open = openMonths.has(m.month);
            return (
              <div className={`bydate__month${m.isPast ? ' is-past' : ''}`} key={m.month}>
                <button
                  type="button"
                  className="bydate__month-head"
                  aria-expanded={open}
                  onClick={() => toggleMonth(m.month)}
                >
                  <span className="bydate__month-name">{formatPayMonth(m.month)}</span>
                  <span className="muted">
                    {m.days.length} day{m.days.length === 1 ? '' : 's'}
                  </span>
                  <Money pence={m.totalPence} className="bydate__month-total" />
                </button>
                {open && <div className="bydate__month-days">{m.days.map(renderDay)}</div>}
              </div>
            );
          })
        : withTodayDivider(days, todayStr, (d) => d.isPast, renderDay)}

      <div className="bydate__footer">
        <div className="stat">
          <span className="stat__label">Gone out so far</span>
          <Money pence={goneOutPence} className="stat__value stat__value--muted" />
        </div>
        <div className="stat">
          <span className="stat__label">Still to go</span>
          <Money pence={stillToGoPence} className="stat__value" />
        </div>
        <div className="stat">
          <span className="stat__label">Period total</span>
          <Money pence={totalPence} className="stat__value stat__value--muted" />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Append the CSS**

Append to the end of `src/styles.css`:

```css
/* Expenses tab — By date view (design 2026-09-12) */
.bydate .day-group.is-past,
.bydate .bydate__month.is-past > .bydate__month-head {
  opacity: 0.55;
}
.bydate__kind {
  margin-left: 0.5rem;
  font-size: 0.8rem;
}
.bydate__running {
  flex: 0 0 6.5rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-size: 0.85rem;
}
.bydate__today {
  margin: 0.8rem 0;
  padding: 0.3rem 0.6rem;
  border-left: 3px solid var(--accent);
  color: var(--accent);
  font-weight: 600;
  font-size: 0.85rem;
}
.bydate__month + .bydate__month {
  margin-top: 0.4rem;
}
.bydate__month-head {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  width: 100%;
  font: inherit;
  color: var(--fg);
  background: none;
  border: 0;
  border-bottom: 1px solid var(--border);
  padding: 0.45rem 0;
  cursor: pointer;
  text-align: left;
}
.bydate__month-name {
  flex: 1;
  font-weight: 600;
}
.bydate__month-total {
  font-variant-numeric: tabular-nums;
}
.bydate__month-days {
  padding: 0.4rem 0 0.6rem 1rem;
}
.bydate__footer {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
  margin-top: 1rem;
  padding-top: 0.8rem;
  border-top: 1px solid var(--border);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/ui/expenses/expensesRender.test.jsx`
Expected: PASS including the 3 new ByDateList tests.

- [ ] **Step 6: Commit**

```bash
git add src/ui/expenses/ByDateList.jsx src/styles.css src/ui/expenses/expensesRender.test.jsx
git commit -m "Add the read-only By date list for the Expenses tab

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Wire the view switch into the Expenses tab

**Files:**
- Modify: `src/ui/Expenses.jsx`
- Modify: `src/ui/expenses/DebtCard.jsx` (root `<li>`)
- Modify: `src/ui/expenses/ExpenseCard.jsx` (root `<li>`)
- Modify: `src/styles.css` (append)
- Test: `src/ui/expenses/expensesRender.test.jsx` (new tests inside `describe('Expenses screen')`)

**Interfaces:**
- Consumes: `settings.getExpensesView` / `setExpensesView` and `EXPENSES_VIEWS` (Task 1); `buildDebtRows`, `buildExpenseRows` (Task 3); `buildByDate` (Task 4); `DebtsTable`, `ExpensesTable` (Task 5); `ByDateList` (Task 6); `cardDomId` (Task 3); `getSetting` from `src/db/settings.js`; `PeriodSelector` with custom `options`.
- Produces: the tab's View control (`role="group"`, `aria-label="View"`, buttons **Cards / Table / By date**); cards rendered with `id={domId}` and the `is-highlight` class after a jump; `DebtCard` and `ExpenseCard` accept `domId` and `highlighted` props.

- [ ] **Step 1: Write the failing tests**

Add inside `describe('Expenses screen', …)` in `src/ui/expenses/expensesRender.test.jsx`, after the `'paused expenses drop out of the totals'` test:

```js
  it('switches to the Table view, hides card actions, and remembers the view', async () => {
    await seed();
    const first = render(<Expenses />);
    await screen.findByText('Visa');
    expect(screen.getAllByRole('button', { name: 'Update balance' }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Table' }));
    expect(await screen.findByRole('heading', { name: 'Debts' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Recurring expenses' })).toBeTruthy();
    // Debt totals: £1,000 + £5,000 balance; £50 + £250 payment.
    expect(screen.getByText('£6,000.00')).toBeTruthy();
    expect(screen.getByText('£300.00')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Update balance' })).toBeNull();
    // The period strip is still there.
    expect(screen.getByText('Going out — July 2026')).toBeTruthy();

    first.unmount();
    render(<Expenses />);
    expect(await screen.findByRole('heading', { name: 'Debts' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Table' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('jumps from a table row back to its highlighted card', async () => {
    await seed();
    render(<Expenses />);
    await screen.findByText('Visa');
    fireEvent.click(screen.getByRole('button', { name: 'Table' }));
    await screen.findByRole('heading', { name: 'Debts' });

    fireEvent.click(screen.getByRole('button', { name: 'Car loan' }));
    // Back on Cards: the loan card is present, carries its id and the highlight.
    const name = await screen.findByText('Car loan');
    const card = name.closest('li');
    expect(card.id).toMatch(/^expense-card-debt-\d+$/);
    expect(card.className).toContain('is-highlight');
    expect(screen.getByRole('button', { name: 'Cards' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('heading', { name: 'Debts' })).toBeNull();
  });

  it('shows the month by date with gone-out and still-to-go totals', async () => {
    await seed();
    render(<Expenses />);
    await screen.findByText('Visa');
    fireEvent.click(screen.getByRole('button', { name: 'By date' }));

    // Today is Tue 7 Jul: nothing has gone out; all £330 is still to go.
    expect(await screen.findByText('Still to go')).toBeTruthy();
    expect(screen.getByText('Gone out so far').nextSibling.textContent).toBe('£0.00');
    expect(screen.getByText('Still to go').nextSibling.textContent).toBe('£330.00');
    expect(screen.getByText('Today — 7 Jul 2026')).toBeTruthy();
    expect(screen.getByText('Bill · Utilities')).toBeTruthy();

    // The Week period narrows the list to nothing.
    fireEvent.click(screen.getByRole('button', { name: 'Week' }));
    expect(screen.getByText(/Nothing goes out in this period/)).toBeTruthy();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/expenses/expensesRender.test.jsx`
Expected: FAIL — `Unable to find role="button" and name "Table"`.

- [ ] **Step 3: Give the cards a DOM id and a highlight**

In `src/ui/expenses/DebtCard.jsx`, change the signature and the root element:

```jsx
export default function DebtCard({
  debt,
  nextPayment,
  onUpdateBalance,
  onEdit,
  onDelete,
  domId,
  highlighted = false,
}) {
```

```jsx
    <li id={domId} className={`card debt-card${highlighted ? ' is-highlight' : ''}`}>
```

In `src/ui/expenses/ExpenseCard.jsx`:

```jsx
export default function ExpenseCard({
  bill,
  next,
  onToggleActive,
  onEdit,
  onDelete,
  domId,
  highlighted = false,
}) {
```

```jsx
    <li
      id={domId}
      className={`card debt-card expense-card${paused ? ' is-inactive' : ''}${highlighted ? ' is-highlight' : ''}`}
    >
```

- [ ] **Step 4: Update `src/ui/Expenses.jsx`**

Add these imports after the existing ones:

```js
import { getSetting, settings } from '../db/settings.js';
import { cardDomId } from './expenses/cardIds.js';
import { buildDebtRows, buildExpenseRows } from './expenses/tableRows.js';
import { buildByDate } from './expenses/byDate.js';
import DebtsTable from './expenses/DebtsTable.jsx';
import ExpensesTable from './expenses/ExpensesTable.jsx';
import ByDateList from './expenses/ByDateList.jsx';
```

Below `const PERIOD_NOUN = …` add:

```js
const VIEW_OPTIONS = [
  { value: 'cards', label: 'Cards' },
  { value: 'table', label: 'Table' },
  { value: 'by-date', label: 'By date' },
];
const HIGHLIGHT_MS = 1500;
```

Extend the loader so the persisted payoff strategy and extra come along (they drive the Payoff column):

```js
  const { data, loading } = useLiveData(async () => {
    const [debts, bills, categories, children, payoffStrategy, payoffExtraPence] = await Promise.all([
      debtsRepo.getAll(),
      recurringBillsRepo.getAll(),
      categoriesRepo.getAll(),
      childrenRepo.getAll(),
      getSetting('payoffStrategy'),
      getSetting('payoffExtraPence'),
    ]);
    return { debts, bills, categories, children, payoffStrategy, payoffExtraPence };
  }, []);
```

After the existing `useState` lines add the view + highlight state:

```js
  // View: null until the persisted choice has loaded (rendered as Cards).
  const [view, setView] = useState(null);
  const [highlightId, setHighlightId] = useState(null);

  useEffect(() => {
    let alive = true;
    settings.getExpensesView().then((v) => {
      if (alive) setView(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  const changeView = (next) => {
    setView(next);
    settings.setExpensesView(next);
  };

  // Jump from a Table / By-date row back to its card: switch view, then once
  // the cards are in the DOM scroll to it and flash it briefly.
  const jumpToCard = (domId) => {
    setHighlightId(domId);
    changeView('cards');
  };

  useEffect(() => {
    if (!highlightId || (view ?? 'cards') !== 'cards') return undefined;
    const el = document.getElementById(highlightId);
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center' });
    const t = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    return () => clearTimeout(t);
  }, [highlightId, view]);
```

After the `nextByDebt` memo add the row models (all pence, all computed at read time):

```js
  const strategy = data?.payoffStrategy === 'snowball' ? 'snowball' : 'avalanche';
  const extraPence = data?.payoffExtraPence || 0;

  const debtRows = useMemo(
    () => buildDebtRows({ debts: penceData.debts, strategy, extraPence, fromStr: from }),
    [penceData, strategy, extraPence, from]
  );
  const expenseRows = useMemo(
    () =>
      buildExpenseRows({
        bills: penceData.recurringBills,
        childcareDeposits: penceData.childcareDeposits,
        categories,
        fromStr: from,
      }),
    [penceData, categories, from]
  );
  const byDate = useMemo(
    () => buildByDate(penceData, startStr, endStr, from),
    [penceData, startStr, endStr, from]
  );
  const categoryByBillId = useMemo(() => {
    const name = new Map(categories.map((c) => [c.id, c.name]));
    return new Map(bills.map((b) => [b.id, name.get(b.categoryId) ?? null]));
  }, [bills, categories]);
```

In the summary strip, add the View control right after the Period one:

```jsx
          <PeriodSelector value={period} onChange={setPeriod} />
          <PeriodSelector
            value={view ?? 'cards'}
            onChange={changeView}
            options={VIEW_OPTIONS}
            label="View"
          />
```

Replace the body. Where the JSX currently reads

```jsx
      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          {debtGroup(
```

change it to route on the view, keeping the cards branch's existing contents intact:

```jsx
      {loading ? (
        <p className="muted">Loading…</p>
      ) : (view ?? 'cards') === 'table' ? (
        <>
          <DebtsTable rows={debtRows} onJump={jumpToCard} />
          <ExpensesTable rows={expenseRows} onJump={jumpToCard} />
        </>
      ) : (view ?? 'cards') === 'by-date' ? (
        <ByDateList
          byDate={byDate}
          period={period}
          todayStr={from}
          categoryByBillId={categoryByBillId}
          onJump={jumpToCard}
        />
      ) : (
        <>
          {debtGroup(
```

Then pass ids and the highlight into the cards. In `debtGroup`:

```jsx
            <DebtCard
              key={d.id}
              debt={d}
              nextPayment={nextByDebt.get(d.id)}
              domId={cardDomId('debt', d.id)}
              highlighted={highlightId === cardDomId('debt', d.id)}
              onUpdateBalance={updateBalance}
              onEdit={() => setEditingDebt(d)}
              onDelete={() => setConfirmDelete({ kind: 'debt', row: d })}
            />
```

In the bill groups:

```jsx
                    <ExpenseCard
                      key={b.id}
                      bill={b}
                      next={nextByBill.get(b.id)}
                      domId={cardDomId('bill', b.id)}
                      highlighted={highlightId === cardDomId('bill', b.id)}
                      onToggleActive={() => toggleBillActive(b)}
                      onEdit={() => setEditingBill(b)}
                      onDelete={() => setConfirmDelete({ kind: 'bill', row: b })}
                    />
```

And the read-only childcare `<li>`:

```jsx
                    <li
                      className={`card debt-card expense-card${
                        highlightId === cardDomId('childcare', dep.label) ? ' is-highlight' : ''
                      }`}
                      id={cardDomId('childcare', dep.label)}
                      key={dep.label}
                    >
```

- [ ] **Step 5: Append the CSS**

Append to the end of `src/styles.css`:

```css
/* A card the Table / By date view just jumped to. */
.card.is-highlight {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  transition: outline-color 0.4s ease;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/ui/expenses/expensesRender.test.jsx`
Expected: PASS — every test in the file, including the 3 new integration tests.

If `'£300.00'` matches more than one node, the Cards view is still mounted: check the view routing in Step 4. If the remount does not show the Debts heading, check that `settings.setExpensesView` is awaited by Dexie before unmount — wrap the click in `await act(async () => …)` from `@testing-library/react` if needed.

- [ ] **Step 7: Run the whole suite**

Run: `npx vitest run`
Expected: all files pass. The Dashboard tests in the same file must still pass (the Dashboard is untouched).

- [ ] **Step 8: Commit**

```bash
git add src/ui/Expenses.jsx src/ui/expenses/DebtCard.jsx src/ui/expenses/ExpenseCard.jsx src/styles.css src/ui/expenses/expensesRender.test.jsx
git commit -m "Expenses tab: Cards / Table / By date view switch, persisted, with jump-to-card

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Verify in the browser, mark the spec implemented

**Files:**
- Modify: `specs/2026-09-12-expenses-views-design.md` (status line)

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: `✓ built in …` with no errors or warnings about unresolved imports.

- [ ] **Step 2: Drive the real app**

Follow `.claude/skills/verify/SKILL.md`. Start the dev server, open the Expenses tab, and add one credit card (balance £1,000, APR 24%, limit £2,000, day 20), one loan (£5,000, 6%, £250, day 28), and one monthly expense (£30, Utilities, next due the 15th). Then:

1. Click **Table** — both panels show, the debts table sorted by Rate descending, totals rows present, no Edit / Delete / Update balance buttons anywhere.
2. Click the **Balance** header twice — order flips; the arrow moves.
3. Click a debt's name — the tab returns to Cards, the card scrolls into view with an accent outline that fades after about 1.5 s.
4. Click **By date** — day groups in order, the "Today" divider in the right place, footer figures equal to the "Going out" figure in the strip. Switch **Year** — month rows, click one to expand.
5. Reload the page — the tab opens on the view you left it on.
6. Console and `pageerror` stay clean throughout.

Record anything that differs from the design in the PR description rather than fixing it silently.

- [ ] **Step 3: Mark the design implemented**

In `specs/2026-09-12-expenses-views-design.md`, change the status line to:

```markdown
**Status:** Implemented 2026-09-12 (plan: `specs/2026-09-12-expenses-views-plan.md`).
```

- [ ] **Step 4: Commit**

```bash
git add specs/2026-09-12-expenses-views-design.md
git commit -m "Mark the Expenses views design as implemented

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review against the spec

- §2 Structure — Task 7 (View control beside Period, strip visible in every view, editing only in Cards, jump with highlight, stable ids on all three card kinds).
- §3.1 Debts table columns and sources — Task 3 rows + Task 5 rendering; Rate uses `effectiveApr`, Payment uses `creditCardMinPence` (override wins) / fixed payment, Interest uses `monthlyInterestPence`, Payoff uses both simulators through `toFinanceDebts`, Utilisation only with a limit, default sort Rate desc, totals row.
- §3.2 Expenses table — Task 3 + Task 5; Childcare rows, Paused/Ended muted and zeroed, default sort Per month desc, totals row.
- §3.3 Sorting — Task 2 (asc → desc, empties last, numeric vs text) + `SortHeader` (`aria-sort`, arrow); sort state not persisted.
- §4 By-date — Task 4 + Task 6; same `spendingOccurrences` walk, day groups, running totals, today divider with today counted as still-to-go, footer, year roll-up with click-to-expand, read-only with jump.
- §5 Persistence — Task 1 + Task 7 (`expensesView`, read on load, written on switch).
- §6 Files — matches, plus `SortHeader.jsx` (shared header, noted here) and `cardIds.js` (the id helper the spec describes under §2).
- §7 Tests — every listed case has a test in Tasks 1–7.
- §8 Non-goals — nothing here reads income, adds caps, adds actions to tables, or stores rows.
