# Phase 7: Code Inconsistencies & Inefficiencies - Research

**Researched:** 2026-03-07
**Domain:** Internal cashflow engine, dead code removal, recurrent expense lifecycle
**Confidence:** HIGH — all findings verified directly from source files

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Bugs first, dead code cleanup second
- Multi-file changes are acceptable if they fix a real bug — not just for structural improvement
- No new abstractions; fix bugs in place using existing patterns
- Exit condition: chart (getDailyRollingData) and 45-day table (calculateForecast) produce identical balance numbers for the same date
- Extract a shared daily balance-walking core function that both getDailyRollingData and calculateForecast call
- Keep getDailyRollingData and calculateForecast as the public API (two thin wrappers)
- Extract the opening balance lookup (dailyBalanceSnapshots → balanceSnapshots fallback) into a shared helper used by both wrappers — this is the likely root of divergence
- _calculateDailyMetrics is already shared; the unification work is above it (the balance accumulation loop and opening balance fetch)
- Delete barForecastPlugin from charts.js — bars were removed in Phase 6, the plugin never fires
- Delete BarController from Chart.register() if it becomes unused after plugin removal
- Delete the binning parameter from getDailyRollingData (nothing passes it)
- Delete aggregateRollingOverview from cashflow.js — the binning hookup is gone, the income/expense object format ({y, daily, isForecast}) is unused
- Audit getRollingFinancialData for import sites; delete it if nothing calls it
- When an expense is marked 'paid' (via markAllAsPaid() or recordPayment()), advance its nextDate to the next occurrence based on frequency
- This advancement logic lives in a cashflow utility as a pure function (e.g. advanceNextDate(item) → newDate)
- Frequencies to support: all values present in the DB schema (weekly, monthly, quarterly, annual, and any others found during audit)
- cycleCurrent only increments during advancement if item.isDebtPayment === true AND cycleTotal is defined — regular bills/subscriptions do not have a meaningful cycle endpoint
- After the root cause fix is in place, add status === 'paid' filter to getDailyRollingData to match calculateForecast

### Claude's Discretion
- Exact name and signature of the shared balance-walking core function
- Whether to extract a separate openingBalanceLookup helper or inline the unified logic
- Order of operations within the recurrence-advancement utility
- Whether any other minor inconsistencies found during implementation are worth fixing in this phase (apply judgment: fix if trivial and correctness-related, defer otherwise)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

Phase 7 is a targeted cleanup of bugs and dead code accumulated across Phases 1–6. Three distinct problems require fixing:

1. **Balance divergence**: `getDailyRollingData` and `calculateForecast` compute different closing balances for the same date. The root cause is confirmed: they fetch the opening balance differently and apply different filters to recurrent expenses (calculateForecast excludes `status === 'paid'` items; getDailyRollingData does not). Both delegate per-day income/expense calculation to the already-shared `_calculateDailyMetrics`, so unification is surgical — only the opening balance fetch and the initial recurrent-list filter need alignment.

2. **Dead code**: `barForecastPlugin`, `BarController`, `aggregateRollingOverview`, the `binning` parameter in `getDailyRollingData`, and `getRollingFinancialData` are all confirmed unreachable. No external file imports `getRollingFinancialData` or `aggregateRollingOverview` except the test file for `aggregateRollingOverview`.

3. **Recurrent expense filter bug**: `markAllAsPaid()` sets `status = 'paid'` but never advances `nextDate`, so paid items permanently occupy their original date and are double-counted by `getDailyRollingData`. The fix is a pure `advanceNextDate(item)` function plus a `status === 'paid'` filter in `getDailyRollingData`.

**Primary recommendation:** Fix in order — recurrent advancement → opening balance unification → dead code sweep. The test suite (Vitest) exists and covers `calculateForecast` and `aggregateRollingOverview`; add tests for the exit condition and `advanceNextDate` in the same run.

---

## Bug Analysis

### Bug 1: Balance Divergence Between Chart and Table

**Confirmed divergence points** (from direct code inspection):

#### Opening balance fetch — different DB queries

`getDailyRollingData` (cashflow.js:334–343):
```javascript
// Queries dailyBalanceSnapshots where date < startDateStr
const latestDaily = await db.dailyBalanceSnapshots
  .where('date').below(startDateStr).reverse().first();
if (latestDaily) return latestDaily.closingBalance;

// Falls back to balanceSnapshots where month < startMonth
const latestMonthly = await db.balanceSnapshots
  .where('month').below(startMonth).reverse().first();
if (latestMonthly) return latestMonthly.closingBalance;

// Final fallback: localStorage
return parseInt(localStorage.getItem('budget_balance_opening_amount') || '0', 10);
```

`calculateForecast` (cashflow.js:155–171):
```javascript
// Uses repository abstractions (dailyBalanceRepository, balanceSnapshotRepository)
const latestDaily = await dailyBalanceRepository.getLatestSnapshot();
const latestMonthly = await balanceSnapshotRepository.getLatestSnapshot();

// Uses latestDaily if date < startDate (startDate is today, passed in)
if (latestDaily && latestDaily.date < startDate) {
  currentBalance = latestDaily.closingBalance;
} else if (latestMonthly) {
  currentBalance = latestMonthly.closingBalance;
}
// No localStorage fallback
```

**Key differences:**
- `getDailyRollingData` queries for snapshots strictly before `startDateStr` (365 days ago). `calculateForecast` gets the globally latest snapshot, then checks if its date is before today. These return different snapshots in most real scenarios.
- `getDailyRollingData` falls back to `localStorage`; `calculateForecast` does not — if no snapshot exists, forecast starts at 0.
- `getDailyRollingData` uses raw `db.*` queries; `calculateForecast` uses repository abstractions. Both ultimately hit the same Dexie tables, but the query conditions are different.

#### Recurrent expense filtering — asymmetric

`calculateForecast` (cashflow.js:177–188):
```javascript
.filter(item => {
  if (item.cycleTotal > 0 && item.cycleCurrent >= item.cycleTotal) return false;
  if (item.status === 'paid') return false;  // EXCLUDES paid items
  return true;
})
```

`getDailyRollingData` (cashflow.js:358–360):
```javascript
const relevantRecurrent = recurrentList.filter(item => {
  if (item.cycleTotal > 0 && (item.cycleCurrent || 0) >= item.cycleTotal) return false;
  return true;  // DOES NOT exclude paid items
});
```

**Impact**: Paid items are included in the chart balance walk but excluded from the forecast table, causing cumulative balance drift equal to the sum of all paid recurrent expenses over the 365-day history window.

#### Historical recurrent item date handling — asymmetric

`getDailyRollingData` (cashflow.js:370–375):
```javascript
if (nextDate < todayStr) {
  return { ...item, effectiveDate: nextDate };  // Uses nextDate as-is for past items
} else {
  const effectiveDate = await nextWorkingDay(nextDate, true);
  return { ...item, effectiveDate };
}
```

`calculateForecast` (cashflow.js:185–188):
```javascript
// Applies nextWorkingDay to ALL items regardless of whether they are past or future
const effectiveDate = await nextWorkingDay(item.nextDate, true);
return { ...item, effectiveDate };
```

This is a secondary divergence: historical items in the rolling chart use `nextDate` verbatim (no weekend shift), but forecast items apply the working-day shift to everything. This could cause ±1-2 day mismatches for recurrent items whose nextDate falls on a weekend.

---

### Bug 2: Recurrent Expense nextDate Not Advanced on Payment

**Current `markAllAsPaid()` in repository.js (lines 122–133):**
```javascript
async markAllAsPaid() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStr = today.slice(0, 7);
  const pending = await db.recurrentExpenses
    .where('nextDate').startsWith(monthStr)
    .filter(i => i.status === 'pending')
    .toArray();
  for (const item of pending) {
    await db.recurrentExpenses.update(item.id, { status: 'paid' });
    // nextDate is NOT advanced — bug
  }
  triggerSync();
}
```

**`statementRepository.recordPayment()` (lines 301–323):**
```javascript
async recordPayment(stmtId, amountPounds, paymentDate) {
  // ...
  await db.recurrentExpenses.update(statement.linkedExpenseId, {
    status: 'paid',
    amount: amountPence,
    cycleCurrent: 1,
    date: paymentDate
    // nextDate is NOT advanced — bug
  });
}
```

After marking an item paid, its `nextDate` remains at the original date. `getDailyRollingData` (once the `status === 'paid'` filter is added) will correctly skip it — but the item will never appear again because `nextDate` hasn't moved forward. The `RecurrenceManager.checkAndGenerate()` in recurrence.js generates new instances by looking at the latest `date` in a series, so it works off `date`, not `nextDate`. The advancement of `nextDate` is specifically needed so that once a filter is applied, the item does not block future occurrences.

**Frequency values confirmed in recurrence.js (generateInstances, lines 27–45):**
- `'weekly'` — addWeeks(base, 1)
- `'biweekly'` — addWeeks(base, 2)
- `'monthly'` — addMonths(base, 1)
- `'quarterly'` — addMonths(base, 3)
- `'annually'` — addYears(base, 1)
- default — addMonths(base, 1)

**advanceNextDate design:**
The function must take a recurrentExpense item and return the next occurrence date string. It mirrors the logic in `generateInstances` but for a single step from `nextDate` (not from `parentDate`).

```javascript
// Recommended signature (pure function, no side effects)
export function advanceNextDate(item) {
  // Returns: YYYY-MM-DD string
  // Input: recurrentExpense item with { nextDate, frequency, cycleCurrent, cycleTotal, isDebtPayment }
}
```

The function should use `date-fns` (`addWeeks`, `addMonths`, `addYears`, `parseISO`, `format`) — already imported in recurrence.js and cashflow.js. Place in `cashflow.js` alongside the other pure cashflow utilities to minimize import surface changes, or in `recurrence.js` where the frequency logic already lives. Either location is valid; recurrence.js is slightly better because frequency-step logic is already centralized there.

---

## Dead Code Inventory

### 1. `barForecastPlugin` — charts.js lines 36–58
```javascript
const barForecastPlugin = {
  id: 'barForecast',
  afterDatasetsDraw(chart) { ... }
};
Chart.register(barForecastPlugin);  // line 60
```
**Status**: Confirmed dead. The plugin fires only when a dataset has `type: 'bar'` with object data containing `isForecast`. The Rolling Overview chart (renderRollingOverviewChart) uses only a single `type: 'line'` dataset with no bar datasets. Plugin callback runs but does nothing meaningful. Safe to delete both the object definition (lines 36–58) and the `Chart.register(barForecastPlugin)` call (line 60).

### 2. `BarController` and `BarElement` imports — charts.js lines 4, 10
```javascript
import { ..., BarController, ... BarElement, ... } from 'chart.js';
Chart.register(BarController, ... BarElement, ...);
```
**Status**: `BarController` is only needed for charts with `type: 'bar'` as the root type. After removing `barForecastPlugin`, there are no bar datasets anywhere in the active chart code. `BarElement` is the bar shape primitive needed for any bar rendering. Both become unused. Safe to remove from import and from `Chart.register()`. Note: `renderTrendsChart` uses `type: 'line'` with stacked area fill — it does not need BarController.

### 3. `binning` parameter in `getDailyRollingData` — cashflow.js line 300
```javascript
export async function getDailyRollingData(targetMonth, binning = 'D') {
```
And its only use at lines 398–402:
```javascript
if (binning !== 'D') {
  return aggregateRollingOverview(result, binning);
}
```
**Callers confirmed**: Only `dashboard.js` line 95 calls `getDailyRollingData(_selectedMonth)` — no binning argument is passed. The parameter defaults to `'D'` and the branch at line 398 is never taken. Safe to remove the parameter and the conditional branch.

### 4. `aggregateRollingOverview` — cashflow.js lines 545–618
**Status**: Only called in cashflow.js itself (line 399, the dead branch) and in the test file. The test file (`cashflow.test.js` lines 5, 157–226) imports and tests it directly. This function is exported but unreachable from application code. When deleting, also remove the `aggregateRollingOverview` import from the test file and its describe block (lines 157–226).

### 5. `getRollingFinancialData` — cashflow.js lines 447–507
**Status**: Confirmed — zero import sites in `/src` outside of cashflow.js itself. The grep confirms it is defined (line 447) and `export`ed, but no other file imports it. Safe to delete in its entirety.

### 6. `date-fns` imports in cashflow.js — currently lines 13–17
After removing `aggregateRollingOverview`, the following date-fns imports become unused:
- `startOfWeek` — used only in aggregateRollingOverview
- `startOfMonth` — used only in aggregateRollingOverview
- `format` — used only in aggregateRollingOverview
- `parseISO` — used only in aggregateRollingOverview

`startOfWeek`, `startOfMonth`, and `format` can be removed. `parseISO` must be verified — it may still be used elsewhere in cashflow.js. A quick scan shows `parseISO` is not used outside `aggregateRollingOverview` in the current cashflow.js. Safe to remove all four.

---

## Recommended Shared Core Function Design

**Name (Claude's discretion):** `_resolveOpeningBalance(anchorDateStr)` → `Promise<number>`

**Rationale**: The divergence between the two paths is entirely in how they pick the opening balance. Both paths then walk the same per-day loop using `_calculateDailyMetrics`. A single shared helper that fetches the correct opening balance for a given date removes the duplication and eliminates the divergence.

**Signature:**
```javascript
// Internal helper — not exported
// Returns the latest closing balance recorded before anchorDateStr, in pence.
// Priority: dailyBalanceSnapshots (latest before anchorDateStr) →
//           balanceSnapshots (latest monthly before anchorDateStr's month) →
//           localStorage fallback
async function _resolveOpeningBalance(anchorDateStr) {
  // Uses repository abstractions (dailyBalanceRepository, balanceSnapshotRepository)
  // to match calculateForecast's access pattern
}
```

**How each wrapper uses it:**
- `getDailyRollingData`: calls `await _resolveOpeningBalance(startDateStr)` to replace the inline IIFE (lines 334–345)
- `calculateForecast`: calls `await _resolveOpeningBalance(startDate)` to replace the current lines 165–171

The query semantics must be: "find the latest snapshot whose date/month is strictly before the given date." This matches `getDailyRollingData`'s current `.below(startDateStr)` approach, which is more correct than `calculateForecast`'s `getLatestSnapshot()` approach (which can return a snapshot after today if one exists).

**Recurrent filter alignment:**
After the `advanceNextDate` bug fix, add the `status === 'paid'` filter to `getDailyRollingData`'s recurrent pre-filter at line 358:
```javascript
const relevantRecurrent = recurrentList.filter(item => {
  if (item.cycleTotal > 0 && (item.cycleCurrent || 0) >= item.cycleTotal) return false;
  if (item.status === 'paid') return false;  // ADD THIS
  return true;
});
```

**Working-day alignment:**
Align `getDailyRollingData`'s historical item handling with `calculateForecast` — apply `nextWorkingDay(nextDate, true)` to all items regardless of past/future. This ensures weekend-straddling historical expenses land on the same day in both engines.

---

## Architecture Patterns

### Pattern: Shared private helper in cashflow.js

The existing `_calculateDailyMetrics` private function (prefix `_`, not exported) is the established pattern for internal helpers. Follow the same convention for `_resolveOpeningBalance`.

### Pattern: Pure utility in recurrence.js

`generateInstances` is already a pure exported function in recurrence.js. `advanceNextDate` follows the same pattern — pure, synchronous, returns a value, no DB access.

### Pattern: Repository mutations call triggerSync()

Every DB mutation in repository.js calls `triggerSync()`. Any caller of `advanceNextDate` that then writes the result to the DB via `db.recurrentExpenses.update()` must also call `triggerSync()` (already done in `markAllAsPaid` and `recordPayment` — just ensure the update call includes the new `nextDate`).

### Anti-patterns to avoid
- Do not add `nextDate` advancement logic inside repository.js without also moving the frequency computation there — keep frequency logic in cashflow/recurrence utils only.
- Do not change the return shape of `getDailyRollingData` or `calculateForecast`. Dashboard.js and renderForecastTable() consume them directly.
- Do not remove `BarElement` from Chart.register() if any chart currently uses bar segments internally — verify no chart uses fill-mode bar before removing.

---

## Common Pitfalls

### Pitfall 1: Test file imports aggregateRollingOverview directly
**What goes wrong:** Deleting `aggregateRollingOverview` without updating `cashflow.test.js` causes test suite to fail on import.
**How to avoid:** Remove the import from line 5 of cashflow.test.js and delete the `describe('aggregateRollingOverview', ...)` block (lines 157–226).

### Pitfall 2: cycleCurrent increment on non-debt items
**What goes wrong:** If `advanceNextDate` always increments `cycleCurrent`, regular subscriptions (which have `cycleTotal: 0` or undefined) accumulate a nonzero `cycleCurrent` that later filters them out incorrectly.
**How to avoid:** Only increment `cycleCurrent` when `item.isDebtPayment === true && item.cycleTotal > 0`. For all other items, leave `cycleCurrent` unchanged.

### Pitfall 3: Opening balance snapshot date semantics
**What goes wrong:** Using `getLatestSnapshot()` (globally latest) instead of "latest before anchor date" returns a future snapshot when one exists, inflating the opening balance.
**How to avoid:** Always query `.below(anchorDateStr)` for dailyBalanceSnapshots and `.below(anchorMonth)` for balanceSnapshots. Avoid `getLatestSnapshot()` repository methods in the unified helper.

### Pitfall 4: `advanceNextDate` called before `status === 'paid'` filter is added
**What goes wrong:** If `nextDate` advances but the filter is not in `getDailyRollingData`, the item disappears from the chart for one cycle (its new nextDate is in the future, outside the historical window) and then reappears — causing a one-time balance jump.
**How to avoid:** Add both changes in the same commit: advance nextDate AND add the status filter to getDailyRollingData.

### Pitfall 5: Removing date-fns imports that are used elsewhere
**What goes wrong:** `parseISO` or `format` appear in other functions not immediately visible.
**How to avoid:** After removing `aggregateRollingOverview`, run `npm test` and check for "X is not defined" errors. Alternatively grep for each import name in cashflow.js before removing.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.0.7 |
| Config file | None (vite.config.js has no test block; Vitest picks up defaults) |
| Quick run command | `npm test -- --run src/utils/cashflow.test.js` |
| Full suite command | `npm test -- --run` |

Vitest is configured inline via the `"test": "vitest"` script in package.json. The jsdom environment is set per-file via `@vitest-environment jsdom` docblock comments. No vitest.config.js exists — Vitest uses Vite's config for transforms.

### Phase Requirements to Test Map

This phase has no formal requirement IDs — it is an internal cleanup phase. The exit condition is: `calculateForecast(today, 45)[N].closingBalance === getDailyRollingData(todayMonth).data.balance[todayIndex + N]` for all N in [0..44].

| Behavior | Test Type | Automated Command | File |
|----------|-----------|-------------------|------|
| `advanceNextDate` returns correct next date for all frequencies | unit | `npm test -- --run src/utils/recurrence.test.js` | Extend recurrence.test.js |
| `advanceNextDate` only increments cycleCurrent for isDebtPayment items | unit | same | Extend recurrence.test.js |
| `getDailyRollingData` excludes paid recurrent expenses | unit | `npm test -- --run src/utils/cashflow.test.js` | Extend cashflow.test.js |
| Chart and table produce same closing balance for day 0 through day 44 | integration | `npm test -- --run src/utils/cashflow.test.js` | Add test in cashflow.test.js |
| `calculateForecast` snapshot count unchanged after unification | regression | `npm test -- --run src/utils/cashflow.test.js` | Existing test at line 80 |
| Dead code removed: `aggregateRollingOverview` no longer exported | smoke | `npm test -- --run src/utils/cashflow.test.js` | Remove test block |

### Sampling Rate
- **Per task commit:** `npm test -- --run src/utils/cashflow.test.js`
- **Per wave merge:** `npm test -- --run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/utils/recurrence.test.js` — add tests for `advanceNextDate` (all 5 frequencies + cycleCurrent gating)
- [ ] `src/utils/cashflow.test.js` — add test asserting `calculateForecast` and `getDailyRollingData` return identical closing balance for the same date
- [ ] `src/utils/cashflow.test.js` — remove `aggregateRollingOverview` import and describe block after function is deleted

---

## DB Schema Reference (recurrentExpenses — current version 16)

Indexed fields (Dexie index, not just stored):
```
++id, date, categoryId, label, amount, status, frequency, nextDate,
predictedPaymentDate, isEssential, cycleTotal, cycleCurrent, endDate,
isDebtPayment, linkedStatementId, isRecurring, recurrenceId, parentDate,
debtType, isCleared, isReconciled
```

**Relevant fields for this phase:**
| Field | Type | Notes |
|-------|------|-------|
| `status` | string | `'pending'` or `'paid'` |
| `nextDate` | YYYY-MM-DD | The date this occurrence falls on |
| `frequency` | string | `'weekly'`, `'biweekly'`, `'monthly'`, `'quarterly'`, `'annually'` (from recurrence.js) |
| `cycleCurrent` | number | How many payments made so far in the cycle |
| `cycleTotal` | number | Total payments expected (0 = infinite/not tracked) |
| `isDebtPayment` | boolean | True only for loan/CC payment linked expenses |

---

## Sources

### Primary (HIGH confidence)
- Direct read: `src/utils/cashflow.js` — all function signatures, line numbers, divergence points confirmed
- Direct read: `src/ui/charts.js` — dead code inventory (barForecastPlugin, BarController, BarElement)
- Direct read: `src/ui/dashboard.js` — confirmed only caller of getDailyRollingData; no binning arg passed
- Direct read: `src/db/repository.js` — markAllAsPaid() and recordPayment() implementations
- Direct read: `src/db/schema.js` — recurrentExpenses schema v16 (current), all frequency/status fields
- Direct read: `src/utils/recurrence.js` — frequency values, generateInstances implementation
- Direct read: `src/utils/cashflow.test.js` — existing test coverage, aggregateRollingOverview test block
- Grep: `getRollingFinancialData` — zero callers outside cashflow.js confirmed
- Grep: `aggregateRollingOverview` — callers: cashflow.js (dead branch) + cashflow.test.js only

### Secondary (MEDIUM confidence)
- `package.json` — confirmed Vitest 3.0.7, no vitest.config.js present; `npm test` runs vitest

---

## Metadata

**Confidence breakdown:**
- Dead code inventory: HIGH — all occurrences verified by grep and code read
- Balance divergence root cause: HIGH — both paths read in full; divergence points confirmed line-by-line
- advanceNextDate design: HIGH — frequency values confirmed from recurrence.js
- Opening balance unification approach: HIGH — both query paths verified
- Test infrastructure: HIGH — package.json and test files read directly

**Research date:** 2026-03-07
**Valid until:** Stable (no external dependencies changing; all findings are from project source)
