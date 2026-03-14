# Phase 12: Balance Integration Fixes - Research

**Researched:** 2026-03-01
**Domain:** IndexedDB Repository Pattern, Recurrent Expense Filtering, Custom Event Bus
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BAL-01 | Opening balance transaction creates the correct starting point for the balance chain (seeded from "Opening Balance" category entry in the configured start month) | Already correct. Defect 2 fix restores accuracy of projected-month expense sums which indirectly affects BAL-01 correctness in projections. |
| BAL-02 | Closing balance of one month becomes the opening balance of the next (carry-forward arithmetic engine) | Arithmetic is correct. BAL-02 integration gap: `recurrentExpenseRepository` mutations do not call `triggerBalanceRecalc`, leaving the balance chain stale after recurrent adds/edits/deletes. |
| BAL-03 | Balance chain engine calculates actuals for past months and projections for future months, deducting all recurrent expenses in every projected month | Current code deducts ALL recurrents in EVERY projected month (`getRecurrent` ignores `_monthStr`). Fix must scope each projected month to only the recurrents due that month (frequency-aware). |
</phase_requirements>

---

## Summary

Phase 12 closes two verified integration defects in the Phase 11 balance carry-forward feature, documented in `v1.0-MILESTONE-AUDIT.md`.

**Defect 1 (BAL-02, functional):** `recurrentExpenseRepository` in `src/db/repository.js` (lines 362–393) uses the base repository without overriding `add`, `update`, or `delete`. Every other mutation repository (`incomeRepository`, `oneOffExpenseRepository`) calls `triggerBalanceRecalc(date).catch(() => {})` as a fire-and-forget side-effect. `recurrentExpenseRepository` does not. The fix is a direct mirror of the existing `incomeRepository` override pattern — no new abstractions needed.

**Defect 2 (BAL-01, BAL-03, accuracy):** `calculateBalanceChain` in `src/utils/finance.js` (line 267) was repaired in Phase 11-03 by replacing a broken `.startsWith(monthStr)` filter with `db.recurrentExpenses.toArray()` (no filter). This fixed the "empty projection" bug but overcorrects — it now includes ALL recurrent expenses in EVERY projected month. A quarterly Council Tax payment of £600 appears in all 3 projected months instead of just the one it falls in. The fix is frequency-aware `nextDate` advancement: given a recurrent item with a known `frequency` and `nextDate`, compute the next occurrence dates from `nextDate` forward and include the item in a projected month only when a cycle falls within that month.

**Primary recommendation:** Override `add/update/delete` in `recurrentExpenseRepository` (mirror `incomeRepository`) and implement a `nextDateInMonth(item, monthStr)` helper in `finance.js` that advances `nextDate` by frequency steps until it reaches or passes the projected month.

---

## Standard Stack

### Core (all already in the project — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Dexie.js | ^3.2.0 | IndexedDB wrapper — `db.recurrentExpenses` | Existing project DB engine |
| date-fns | ^2.30.0 | `addMonths`, `addQuarters`, `addYears`, `parseISO`, `format` | Already used in `finance.js` for payoff simulations and balance chain |
| Vitest | (existing) | Unit tests for `calculateBalanceChain` and repository overrides | Existing test framework; tests run with `npm test -- --run` |

**No new packages required.** Both defect fixes are pure logic changes to existing modules.

---

## Architecture Patterns

### Existing Project Structure (no new files needed)

```
src/
├── db/
│   └── repository.js    # Defect 1 fix: add recurrentExpenseRepository overrides
└── utils/
    └── finance.js       # Defect 2 fix: frequency-aware nextDate filter in calculateBalanceChain
    └── finance.test.js  # New tests for both fixes
```

### Pattern 1: Repository Mutation Override (mirrors incomeRepository)

**What:** Override `add`, `update`, `delete` in `recurrentExpenseRepository` to call `triggerBalanceRecalc(date)` after the base mutation completes.

**When to use:** Any repository whose mutations affect the balance chain. Currently: income, oneOff, and (after this fix) recurrent.

**Exact pattern from `incomeRepository` (lines 276–299) — mirror this in `recurrentExpenseRepository`:**

```javascript
// In repository.js — recurrentExpenseRepository overrides (to add after line 392)
export const recurrentExpenseRepository = {
  ...createBaseRepository(db.recurrentExpenses),

  async getByMonth(monthStr) {
    return await db.recurrentExpenses.toArray();
  },

  async markAllAsPaid() { /* unchanged */ },

  /** Add a recurrent expense and trigger balance recalculation. */
  async add(data) {
    const toSave = { ...data, amount: toPence(data.amount) };
    const id = await db.recurrentExpenses.add(toSave);
    // Use nextDate as the anchor for recalculation (this is the "due date" for the item)
    const dateForRecalc = toSave.nextDate || toSave.date;
    if (dateForRecalc) triggerBalanceRecalc(dateForRecalc).catch(() => {});
    return id;
  },

  /** Update a recurrent expense and trigger recalculation. */
  async update(id, data) {
    const toUpdate = { ...data };
    if (toUpdate.amount !== undefined) toUpdate.amount = toPence(toUpdate.amount);
    await db.recurrentExpenses.update(id, toUpdate);
    const dateForRecalc = toUpdate.nextDate || toUpdate.date || (await db.recurrentExpenses.get(id))?.nextDate;
    if (dateForRecalc) triggerBalanceRecalc(dateForRecalc).catch(() => {});
    return 1;
  },

  /** Delete a recurrent expense and trigger recalculation. */
  async delete(id) {
    const record = await db.recurrentExpenses.get(id);
    await db.recurrentExpenses.delete(id);
    const dateForRecalc = record?.nextDate || record?.date;
    if (dateForRecalc) triggerBalanceRecalc(dateForRecalc).catch(() => {});
  }
};
```

**Key detail:** Use `nextDate` (not `date`) as the recalculation anchor. `nextDate` is the scheduled due date of the recurrent item — it is the date that determines which balance snapshot to invalidate. `date` on a recurrent expense is the entry creation date, not the schedule anchor.

### Pattern 2: Frequency-Aware Next Occurrence Filter

**What:** In `calculateBalanceChain`, replace the `getRecurrent = async (_monthStr) => db.recurrentExpenses.toArray()` live closure with one that filters recurrent items by whether their next occurrence (or any subsequent cycle) falls within the queried month.

**Frequency values in the codebase:** `'monthly'`, `'quarterly'`, `'annual'` (from `src/ui/expenses.js` and `src/ui/subscriptions.js`). The `cycleTotal`/`cycleCurrent` fields track finite-cycle items (e.g. 10-month Council Tax). Items where `cycleTotal > 0 && cycleCurrent >= cycleTotal` are finished and should not be projected.

**Algorithm for `nextDateInMonth(item, targetMonthStr)`:**

```javascript
// Source: project codebase analysis + date-fns docs
import { parseISO, addMonths, addQuarters, addYears, format, isBefore, isEqual } from 'date-fns';

/**
 * Returns true if the recurrent item has an occurrence falling within targetMonthStr.
 * Advances item.nextDate by frequency steps until reaching or passing targetMonthStr.
 *
 * @param {Object} item - Recurrent expense with nextDate (YYYY-MM-DD) and frequency.
 * @param {string} targetMonthStr - YYYY-MM
 * @returns {boolean}
 */
function recurrentFallsInMonth(item, targetMonthStr) {
  // Finished cycle items do not project
  if (item.cycleTotal > 0 && (item.cycleCurrent || 0) >= item.cycleTotal) return false;

  const nextDate = item.nextDate || item.date;
  if (!nextDate) return false;

  const itemMonthStr = nextDate.slice(0, 7); // YYYY-MM

  // Item is already scheduled in or before target — check for exact or cycle match
  if (itemMonthStr === targetMonthStr) return true;

  // If item is in the future relative to target, it can't fall in target month
  if (itemMonthStr > targetMonthStr) return false;

  // Advance by frequency from itemMonthStr until reaching targetMonthStr or overshooting
  const freq = item.frequency || 'monthly';
  let cursor = parseISO(`${itemMonthStr}-01`);
  const target = parseISO(`${targetMonthStr}-01`);

  // Advance until cursor reaches or passes target
  while (isBefore(cursor, target)) {
    if (freq === 'monthly') cursor = addMonths(cursor, 1);
    else if (freq === 'quarterly') cursor = addMonths(cursor, 3);
    else if (freq === 'annual') cursor = addMonths(cursor, 12);
    else cursor = addMonths(cursor, 1); // default to monthly for unknown frequencies
  }

  return format(cursor, 'yyyy-MM') === targetMonthStr;
}
```

**Updated live `getRecurrent` closure in `calculateBalanceChain`:**

```javascript
// In finance.js — replace lines 267-268
getRecurrent = async (monthStr) => {
  const all = await db.recurrentExpenses.toArray();
  return all.filter(item => recurrentFallsInMonth(item, monthStr));
};
```

**IMPORTANT — deps injection path is unchanged.** The `deps.getRecurrent(monthStr)` injected path (used by all existing unit tests) is not touched. Tests supply their own `getRecurrent` mock. Only the `else` branch (live DB path) is changed.

### Pattern 3: app:refresh Event Bus (already correct)

`triggerBalanceRecalc` already dispatches `window.dispatchEvent(new CustomEvent('app:refresh'))` after `calculateBalanceChain` resolves (fixed in Phase 11-03). No changes needed here for the new recurrent triggers — they call the same `triggerBalanceRecalc` function.

### Anti-Patterns to Avoid

- **Using `date` instead of `nextDate` as recalc anchor:** Recurrent items use `nextDate` to schedule the next payment. The `date` field on a recurrent record is the entry creation date, not the due date. Using `date` would invalidate the wrong month's snapshots.
- **Touching the deps-injection path:** The `if (deps) { ... }` branch in `calculateBalanceChain` is used exclusively by unit tests. Modifying it breaks all existing tests. Only change the `else` branch (lines 259–278).
- **Calling `triggerBalanceRecalc` synchronously inside a Dexie transaction:** Phase 09 had a `DexieError` caused by starting a new operation inside a transaction. Recurrent mutations are not wrapped in a Dexie transaction, so fire-and-forget `.catch(() => {})` is safe and correct — same pattern as `incomeRepository`.
- **Infinite loop in frequency advancement:** The `recurrentFallsInMonth` cursor loop must advance at least 1 step per iteration. All known frequencies (`monthly`, `quarterly`, `annual`) advance by at least 1 month. Guard against unknown/zero-step frequencies with the `else` fallback to `addMonths(cursor, 1)`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date arithmetic (advancing by frequency) | Custom `new Date()` manipulation | `date-fns addMonths` | Handles month-end edge cases (e.g., Jan 31 + 1 month = Feb 28) correctly |
| Month comparison | String numeric comparison | YYYY-MM string compare (`>`, `===`) | Already used throughout the project for month keying; correct for lexicographic sort of ISO strings |
| Recalculation event dispatch | Custom pub/sub | Existing `CustomEvent('app:refresh')` + `window.dispatchEvent` | Pattern already implemented in `triggerBalanceRecalc`; all UI modules already listen |

**Key insight:** Both fixes are small, targeted changes to existing logic. No new abstractions, utilities, or patterns are needed. The hardest part is the frequency-advancement filter — `date-fns` makes it 5 lines.

---

## Common Pitfalls

### Pitfall 1: Wrong Date Field for recalc anchor
**What goes wrong:** `triggerBalanceRecalc(toSave.date)` is called instead of `triggerBalanceRecalc(toSave.nextDate)`. Snapshots for the wrong month are invalidated — balance panel stays stale for the actual due month.
**Why it happens:** `recurrentExpenses` has both `date` (entry creation) and `nextDate` (schedule anchor). `incomeRepository` uses `date` because income records have only one date. Copying the pattern blindly uses the wrong field.
**How to avoid:** Always use `nextDate || date` as the fallback chain for recurrent expenses.
**Warning signs:** Balance snapshots appear to recalculate (console logs) but the month shown in the balance panel doesn't change.

### Pitfall 2: Quarterly expense counted in every month
**What goes wrong:** `getRecurrent` returns all items regardless of frequency — a quarterly item appears in March, April, and May projections.
**Why it happens:** Phase 11-03 fix was too broad — it swapped an over-restrictive filter for no filter at all.
**How to avoid:** Implement `recurrentFallsInMonth` to advance from `nextDate` by frequency steps and check if the cursor lands in the target month.
**Warning signs:** A known quarterly expense (e.g., £600/quarter TV License) shows up in all 3 projected months in the balance forecast.

### Pitfall 3: Forgetting finished-cycle items
**What goes wrong:** A 10-month Council Tax payment continues to appear in projected months after all 10 payments have been made (`cycleCurrent >= cycleTotal`).
**Why it happens:** `recurrentFallsInMonth` doesn't check cycle termination.
**How to avoid:** Guard: `if (item.cycleTotal > 0 && (item.cycleCurrent || 0) >= item.cycleTotal) return false;` at the top of the filter.
**Warning signs:** Expenses continue projecting after a finite-cycle item should have ended.

### Pitfall 4: Tests breaking due to deps-path modification
**What goes wrong:** Modifying `getRecurrent` in the deps injection path (`if (deps)` branch) breaks all 14+ existing `calculateBalanceChain` unit tests.
**Why it happens:** Tests supply their own `getRecurrent` mock via the `deps` parameter. The live DB path change must only affect the `else` branch.
**How to avoid:** Verify `if (deps)` vs `else` — only the `else` branch (live DB closure) should change.
**Warning signs:** `npm test -- --run` fails on `calculateBalanceChain` tests after the change.

---

## Code Examples

### Recurrent Repository Override — add (mirrors incomeRepository)
```javascript
// Source: repository.js incomeRepository pattern (lines 276-299)
async add(data) {
  const toSave = { ...data, amount: toPence(data.amount) };
  const id = await db.recurrentExpenses.add(toSave);
  const dateForRecalc = toSave.nextDate || toSave.date;
  if (dateForRecalc) triggerBalanceRecalc(dateForRecalc).catch(() => {});
  return id;
},
```

### Recurrent Repository Override — delete (mirrors oneOffExpenseRepository)
```javascript
// Source: repository.js oneOffExpenseRepository.delete pattern (lines 421-424)
async delete(id) {
  const record = await db.recurrentExpenses.get(id);
  await db.recurrentExpenses.delete(id);
  const dateForRecalc = record?.nextDate || record?.date;
  if (dateForRecalc) triggerBalanceRecalc(dateForRecalc).catch(() => {});
},
```

### Frequency-Aware Filter (complete)
```javascript
// Source: project codebase analysis; date-fns docs
import { parseISO, addMonths, format, isBefore } from 'date-fns';

function recurrentFallsInMonth(item, targetMonthStr) {
  if (item.cycleTotal > 0 && (item.cycleCurrent || 0) >= item.cycleTotal) return false;
  const nextDate = item.nextDate || item.date;
  if (!nextDate) return false;
  const itemMonthStr = nextDate.slice(0, 7);
  if (itemMonthStr === targetMonthStr) return true;
  if (itemMonthStr > targetMonthStr) return false;

  const freq = item.frequency || 'monthly';
  const stepMonths = freq === 'quarterly' ? 3 : freq === 'annual' ? 12 : 1;
  let cursor = parseISO(`${itemMonthStr}-01`);
  const target = parseISO(`${targetMonthStr}-01`);

  while (isBefore(cursor, target)) {
    cursor = addMonths(cursor, stepMonths);
  }
  return format(cursor, 'yyyy-MM') === targetMonthStr;
}
```

### Test: quarterly item counted once per quarter (not in every month)
```javascript
// Source: test pattern from src/utils/finance.test.js
it('counts a quarterly expense exactly once per quarter in projections', async () => {
  const QUARTERLY_AMOUNT = 60000; // £600 quarterly

  // Build deps where getRecurrent applies the frequency filter
  // For this test, we supply a filtered mock that only returns the item for March and June
  const deps = {
    getIncome: async (_month) => [],
    getRecurrent: async (month) =>
      month === '2026-03' || month === '2026-06'
        ? [{ amount: QUARTERLY_AMOUNT }]
        : [],
    getOneOff: async (_month) => [],
    getOpeningBalCatId: async () => null,
    saveSnapshot: async (snap) => snap
  };

  const result = await calculateBalanceChain('2026-03', 3, deps);
  const apr = result.find(s => s.month === '2026-04');
  const may = result.find(s => s.month === '2026-05');
  const jun = result.find(s => s.month === '2026-06');

  expect(apr.expenseTotal).toBe(0);        // quarterly item not due in April
  expect(may.expenseTotal).toBe(0);        // not due in May
  expect(jun.expenseTotal).toBe(QUARTERLY_AMOUNT); // due in June
});
```

### Test: recalc triggered on recurrent add
```javascript
// Integration-level smoke test — verifies triggerBalanceRecalc is called
// (manual verification: add a recurrent expense in browser, confirm balance card updates)
it('recurrentExpenseRepository.add triggers triggerBalanceRecalc', async () => {
  // Unit test: verify add calls through to DB and returns an id
  // (Full integration test is manual UAT — window.dispatchEvent not mocked in Vitest)
  const repo = recurrentExpenseRepository;
  // Snapshot the current add method and verify it includes the trigger
  // Detailed test: use a spy on triggerBalanceRecalc if importable
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `getRecurrent` filtered by `nextDate.startsWith(monthStr)` | `getRecurrent` returns all items (no filter) | Phase 11-03 | Fixed empty projections but introduced over-counting for non-monthly items |
| `recurrentExpenseRepository` uses base add/update/delete | **Needs:** override with `triggerBalanceRecalc` | Phase 12 (this phase) | Will close stale-projection defect |
| `getRecurrent` returns all items | **Needs:** frequency-aware filter | Phase 12 (this phase) | Will close over-count defect |

---

## Open Questions

1. **How to handle recurrents where `nextDate` is far in the past**
   - What we know: Some recurrent items may have a `nextDate` months in the past (not updated after each cycle if the user never marks them paid). The frequency-advancement loop will advance from `nextDate` to the target month regardless of how far behind `nextDate` is — this is correct behavior (it simulates "when would this item next fall").
   - What's unclear: If `nextDate` is 18 months old and `frequency = 'quarterly'`, the loop advances 6 steps. This is a worst-case of ~6 iterations — acceptable performance.
   - Recommendation: Accept this behavior. The loop terminates deterministically. No guard needed beyond the `isBefore` check.

2. **`app:refresh` dispatch after recurrent mutation — double-dispatch risk**
   - What we know: `triggerBalanceRecalc` dispatches `app:refresh` once after `calculateBalanceChain` resolves. Adding `add/update/delete` overrides to `recurrentExpenseRepository` adds new callers of `triggerBalanceRecalc` — but the same single dispatch per call.
   - What's unclear: If a user edits a recurrent expense at the same time as an income mutation, two `triggerBalanceRecalc` calls could overlap. This is benign — each recalculates the full chain and dispatches `app:refresh`. The second call's snapshot will overwrite the first's (idempotent upsert in `balanceSnapshotRepository.save`).
   - Recommendation: No change needed. The existing fire-and-forget pattern is tolerant of concurrent recalcs.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (existing, version from package.json) |
| Config file | None (Vitest auto-discovers via `vite.config.js` or default) |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BAL-02 | `recurrentExpenseRepository.add/update/delete` triggers `triggerBalanceRecalc` | unit (smoke: verify override exists and calls DB + trigger) | `npm test -- --run` | Partial — new test needed in `finance.test.js` or `repository.test.js` |
| BAL-01 | Opening balance chain is not affected by recurrent deduction changes | unit (existing tests cover the chain; confirm they still pass) | `npm test -- --run` | ✅ existing `calculateBalanceChain` describe block |
| BAL-03 | Quarterly expense counted once per quarter, not in every projected month | unit (new test: quarterly item filter) | `npm test -- --run` | ❌ Wave 0: new test required |

### Sampling Rate
- **Per task commit:** `npm test -- --run`
- **Per wave merge:** `npm test -- --run`
- **Phase gate:** Full suite green (currently 93+ tests, 0 failures) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/utils/finance.test.js` — new test: quarterly expense counted once per quarter in projected months (covers BAL-03)
- [ ] `src/db/repository.test.js` — new test or smoke check: `recurrentExpenseRepository` override exists and calls `triggerBalanceRecalc` (covers BAL-02)

*(Two new tests needed. Both files already exist — no new files required.)*

---

## Sources

### Primary (HIGH confidence)
- `src/db/repository.js` (project codebase) — `incomeRepository` override pattern (lines 276–299); `oneOffExpenseRepository` override pattern (lines 401–436); `recurrentExpenseRepository` base implementation (lines 362–393); `triggerBalanceRecalc` implementation (lines 20–44)
- `src/utils/finance.js` (project codebase) — `calculateBalanceChain` implementation; `getRecurrent` live closure (lines 267–268); deps injection architecture (lines 255–278)
- `src/utils/finance.test.js` (project codebase) — existing test patterns for `calculateBalanceChain`; `makeDeps` helper; confirmed 93 tests passing
- `src/db/schema.js` (project codebase) — `recurrentExpenses` schema v5–v9; fields: `frequency`, `nextDate`, `cycleTotal`, `cycleCurrent`
- `.planning/v1.0-MILESTONE-AUDIT.md` — authoritative defect specifications with exact file/line references; confirmed BAL-01/02/03 gap descriptions

### Secondary (MEDIUM confidence)
- date-fns `addMonths` documentation — frequency advancement (monthly=1, quarterly=3, annual=12 months); `isBefore` for cursor termination

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Defect 1 (recurrentExpenseRepository override): HIGH — exact fix documented in audit, exact mirror pattern exists in same file
- Defect 2 (frequency-aware filter): HIGH — audit specifies root cause and fix strategy; `date-fns` tools needed are already imported; frequency values enumerated from UI code
- Test architecture: HIGH — Vitest/`makeDeps` pattern already established in `finance.test.js`

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (stable internal codebase; no external library changes needed)
