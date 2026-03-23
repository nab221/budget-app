# Phase 18: Category System Refactoring — Research

**Researched:** 2026-03-09
**Domain:** Dexie.js IndexedDB, vanilla JS UI (debt/expense forms), repository pattern
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

All five bug fixes are fully specified with exact code in the CONTEXT.md. These are locked:

- **A (Loan/Mortgage Form):** Add `mortgageMonthlyPayment`, `mortgagePaymentStart`, `mortgageInterestOnly`, `loanMonthlyPayment`, `loanPaymentStart` FIELD_IDS; add form-row HTML to both fieldsets; populate and save the new fields in `_populateEditFields` and `_saveDebt`.
- **B (Expense Guard):** `openForm()` checks `isDebtPayment` flag and redirects to Debts tab; edit button changes to "↗ Debts"; `deleteExpense` handler blocks debt-linked deletions.
- **C (Dashboard field name fix):** `getDashboardData` uses `d.debtType` not `d.type`; `d.fixedMonthlyPayment` not `d.monthlyPayment`.
- **D (Schema index):** New Dexie version 17 adds `linkedDebtId` to `recurrentExpenses` index string.
- **E (Mark-Paid button):** Visual update to "✓ Paid" / "○ Pending" with `title` attribute.

### Claude's Discretion

None specified — all changes are fully prescribed.

### Deferred Ideas (OUT OF SCOPE)

- Auto-calculating `fixedMonthlyPayment` from term + interest
- Changes to `recurrence.js` or `finance.js`
- Altering any tables other than `recurrentExpenses` in the schema bump
- Any tables beyond those in the Files to Modify list
</user_constraints>

---

## Summary

Phase 18 is a targeted bug-fix phase across four files. The CONTEXT.md provides exact, line-level implementation instructions for all five bug groups. Research confirms the current state of each file matches the spec's description of what to change: the bugs described are real and present in the actual source.

The key implementation insight is that most of the Phase 18 changes are already partially or fully implemented in the live source files based on the code review. This is critical for planning: the planner must distinguish what still needs to be done versus what the spec describes as a target state.

**Primary recommendation:** Read the actual current file state first in each plan before applying changes — the source code has received some Phase 18 work already (FIELD_IDS, form HTML, openForm guard, delete guard, render button, getDashboardData fix, schema v17). The planner should verify each change against current source before writing implementation steps.

---

## Current State Assessment (HIGH confidence — verified by direct source read)

### What is ALREADY implemented in the live code

| Fix | File | Status |
|-----|------|--------|
| A1: FIELD_IDS for mortgage/loan new fields | `debts.js` lines 32–42 | DONE |
| A2: Mortgage form-row HTML (Monthly Payment, First Payment Date, Interest Only) | `debts.js` lines 494–507 | DONE |
| A3: Loan form-row HTML (Monthly Payment, First Payment Date) | `debts.js` lines 531–540 | DONE |
| A4: `_populateEditFields` mortgage branch populates new fields | `debts.js` lines 289–292 | DONE |
| A4: `_populateEditFields` loan branch populates new fields | `debts.js` lines 298–299 | DONE |
| A5: `_saveDebt` mortgage branch includes `fixedMonthlyPayment`, `paymentStartDate`, `isInterestOnly` | `debts.js` lines 345–348 | DONE |
| A6: `_saveDebt` loan branch includes `fixedMonthlyPayment`, `paymentStartDate` | `debts.js` lines 358–360 | DONE |
| A7: `generateLoanPayments` uses `debt.paymentStartDate` with `subMonths` offset | `repository.js` lines 218–222 | DONE |
| B1: `openForm()` guard in `expenses.js` | `expenses.js` lines 319–334 | DONE |
| B2: Edit button shows "↗ Debts" with title for debt-linked items | `expenses.js` lines 762–763 | DONE |
| B3: `deleteExpense` blocks debt-linked deletion | `expenses.js` lines 175–182 | DONE |
| C: `getDashboardData` uses `d.debtType` and `d.fixedMonthlyPayment` | `repository.js` lines 609–614 | DONE |
| D: Schema version 17 with `linkedDebtId` index on `recurrentExpenses` | `schema.js` lines 484–501 | DONE |
| E: Mark-Paid button uses "✓ Paid" / "☐ Mark Paid" (close but not exactly spec) | `expenses.js` lines 749–751 | PARTIAL |

### What still needs attention

**E (Mark-Paid button):** The spec calls for `'✓ Paid' : '○ Pending'` with a `title` attribute. The live code has `'✓ Paid' : '☐ Mark Paid'` without a `title` attribute. The "Paid" state matches but "pending" state uses `☐ Mark Paid` instead of `○ Pending`. This is the one remaining delta.

---

## Standard Stack

### Core (all verified by source inspection — HIGH confidence)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| Dexie.js | 3.x (via `dexie.min.js`) | IndexedDB ORM | Schema versioning, index definitions |
| Vitest | (package.json devDep) | Unit test runner | `npm test` runs vitest |
| Vite | (package.json devDep) | Build tool | vite.config.js present |
| date-fns | ^4.1.0 | Date arithmetic | Used in `repository.js` (`format`, `subMonths`, `parseISO`) |

### Project Conventions (HIGH confidence — observed in all source files)

- All monetary values stored in **integer pence**; `toPence()` / `fromPence()` in `src/utils/currency.js` convert at read/write boundaries
- `safeHTML` tagged template literal used for all innerHTML to prevent XSS
- `alertWithHaptic()` from `src/utils/haptics.js` used instead of native `alert()`
- `modalUI.show(title, content, footerButtons)` from `src/ui/render.js` is the standard modal pattern
- `triggerSync()` called after every write to schedule auto-save
- `triggerBalanceRecalc(date)` called after expense mutations to invalidate the balance chain

---

## Architecture Patterns

### Dexie Schema Versioning

```js
// Pattern: each version() call defines the FULL stores object, not a delta.
// Only changed tables need a different index string. All other tables are copied verbatim.
// An upgrade() callback is only needed when data migration is required.
// For adding an index to an existing field: no upgrade() needed — Dexie re-indexes automatically.
db.version(17).stores({
  recurrentExpenses: '++id, ..., linkedDebtId',
  // all other tables identical to v16
});
```

**Key rule:** The stores string for a Dexie table is an index declaration, NOT a column list. Fields not in the index string can still be stored and queried via `.filter()`. Adding a field to the index string enables `.where('fieldName').equals()` efficient lookups.

### Repository Pattern

The project uses a `createBaseRepository(table, penceFields, defaults)` factory. Pence conversion happens automatically at `add()` and `update()` for declared fields. Debt repository extends this base with specialized methods (`generateLoanPayments`, `deleteLinkedExpenses`).

### Form Pattern in `debts.js`

`_buildFormHTML()` returns the full modal body HTML. `_populateEditFields(debt)` populates fields after the modal is shown. `_saveDebt()` reads values and calls `debtRepository.add()` or `.update()`. `_onTypeChange()` shows/hides fieldsets by toggling `.hidden` class.

### Expense Guard Pattern

```js
// In openForm(), check the item before showing the form:
if (this.editingId && this.editingType === 'recurrent') {
  const item = await recurrentExpenseRepository.get(this.editingId);
  if (item && item.isDebtPayment) {
    alertWithHaptic('...', 'info');
    this.editingId = null;
    this.editingType = null;
    if (window.app && window.app.showTab) window.app.showTab('debts');
    return;
  }
}
```

### Anti-Patterns to Avoid

- **Editing `linkedDebtId` field via generic expense update**: The guard prevents this but any future path that calls `repo.update()` on a debt-linked item with a plain payload would strip debt metadata. Always check `isDebtPayment` before patching.
- **Version gap in Dexie**: Version 3 was intentionally skipped (noted in schema.js). Do not renumber versions — gaps are safe in Dexie.
- **Calling `toPence()` twice**: `debtRepository.update()` already calls `toPence()` for declared pence fields. Passing pence values directly to `update()` would double-convert. Always pass pounds (floats) to repository methods.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| IndexedDB queries | Raw IDBTransaction/IDBObjectStore | Dexie `.where().equals()` |
| HTML escaping | Manual string replace | `safeHTML` tagged template |
| Modal dialogs | Custom overlay divs | `modalUI.show()` from `render.js` |
| User alerts/feedback | `window.alert()` | `alertWithHaptic()` from `haptics.js` |
| Tab navigation | Direct DOM panel toggle | `window.app.showTab()` |
| Date arithmetic | Manual month math | `date-fns` (`format`, `subMonths`, `parseISO`) |

---

## Common Pitfalls

### Pitfall 1: Dexie index string vs. column list
**What goes wrong:** Developer adds a new field to the stores string of an older version (e.g., v16) instead of creating a new version. Existing users' databases already ran v16 and won't re-run it.
**Prevention:** Always increment the version number. Never modify an existing version's stores definition.

### Pitfall 2: Double pence conversion
**What goes wrong:** Passing an already-pence value to `debtRepository.update({ fixedMonthlyPayment: 20000 })` — the repository multiplies by 100 again, storing 2,000,000 pence (£20,000).
**Prevention:** Repository methods always expect pounds (floats). `toPence()` conversion is internal.
**Warning sign:** Card shows "Monthly: £20,000.00" for a £200 payment.

### Pitfall 3: `isDebtPayment` guard only in `openForm()`
**What goes wrong:** The guard in `openForm()` prevents editing, but the `editExpense()` method (which is the button's `onclick`) calls `openForm()` — so the guard fires. However, direct calls to `handleSaveExpense()` without going through `openForm()` would bypass it.
**Prevention:** No direct `handleSaveExpense()` calls exist outside the modal button; the pattern is safe. Keep it that way.

### Pitfall 4: `generateLoanPayments` `baseDate` offset
**What goes wrong:** `generateInstances` adds 1+ months to the base date before generating the first instance. If `startDate` is passed directly as the base, the first instance lands one month after the intended start.
**Prevention:** Already handled in the live code — `baseDate = format(subMonths(parseISO(startDate), 1), 'yyyy-MM-dd')` backs off one month so `generateInstances` produces the correct `startDate` as its first instance.

### Pitfall 5: `debtRepository.update()` regeneration trigger conditions
**What goes wrong:** The `update()` method in `debtRepository` only regenerates loan payments when `debtType`, `fixedMonthlyPayment`, `paymentStartDate`, or `name` changes. If a user changes only the interest rate on a loan, no regeneration occurs — this is intentional (payments are fixed, not recalculated). Don't add `interestRate` to the trigger conditions.
**Prevention:** Per spec constraint: "Do NOT auto-calculate `fixedMonthlyPayment` from term + interest."

---

## Code Examples

### Verified: Dexie version 17 (schema.js lines 484–501)
```js
db.version(17).stores({
  income: '++id, date, source, amount, categoryId, isCleared, isReconciled',
  recurrentExpenses: '++id, date, categoryId, label, amount, status, frequency, nextDate, predictedPaymentDate, isEssential, cycleTotal, cycleCurrent, endDate, isDebtPayment, linkedStatementId, isRecurring, recurrenceId, parentDate, debtType, isCleared, isReconciled, linkedDebtId',
  // ... all other tables identical to v16
});
// No upgrade() needed — Dexie auto-indexes existing data.
```

### Verified: getDashboardData fix (repository.js lines 609–614)
```js
ccPayments: debts
  .filter(d => d.debtType === 'credit-card' || !d.debtType)
  .reduce((sum, d) => sum + calcMinPayment(d.currentBalance, d.apr, 0, new Date(), d.promoEndDate), 0),
loanPayments: debts
  .filter(d => d.debtType === 'loan' || d.debtType === 'mortgage')
  .reduce((sum, d) => sum + (d.fixedMonthlyPayment || 0), 0),
```

### Verified: generateLoanPayments start date handling (repository.js lines 218–221)
```js
const startDate = debt.paymentStartDate || new Date().toISOString().slice(0, 10);
const baseDate = format(subMonths(parseISO(startDate), 1), 'yyyy-MM-dd');
```

### Mark-Paid button — CURRENT vs TARGET (expenses.js lines 749–751)
```js
// CURRENT (live code):
<button class="sm ${isPaid ? '' : 'ghost'}" style="${isPaid ? 'color:var(--success)' : ''}" ...>
  ${isPaid ? '✓ Paid' : '☐ Mark Paid'}
</button>

// TARGET (spec Part E):
<button class="sm ${isPaid ? 'success' : 'ghost'}" ... title="${isPaid ? 'Paid' : 'Mark as Paid'}">
  ${isPaid ? '✓ Paid' : '○ Pending'}
</button>
```
Deltas: class `success` vs inline `style`, pending label `○ Pending` vs `☐ Mark Paid`, add `title` attribute.

---

## State of the Art

| Area | Current State | Notes |
|------|---------------|-------|
| Most Phase 18 changes | Already implemented | Verified by source read |
| Mark-Paid button (Part E) | Partially implemented | "Paid" state correct; "pending" state and class/title differ |
| All remaining changes | Trivially small | 3-line button template update |

---

## Open Questions

1. **Is Part E the only remaining work?**
   - What we know: A1–A7, B1–B3, C, D are all verified as implemented in the live source.
   - What's unclear: Whether there may be other minor deltas not caught by spot-checking.
   - Recommendation: The plan should include a verification step that diffs each changed function against the CONTEXT.md spec to confirm no gaps.

2. **`loanMonthlyPayment` / `loanPaymentStart` FIELD_IDS: spec says to add them in A1, but they're already present.**
   - The spec's A1 section says "add to the FIELD_IDS object" — these are already at lines 41–42.
   - Recommendation: The plan should note these are already in place and skip re-adding.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (version from package.json devDependencies) |
| Config file | `vite.config.js` (no separate vitest.config — vitest uses vite config by default) |
| Quick run command | `npm test -- --run tests/balance/` |
| Full suite command | `npm test -- --run` |
| Test directory | `tests/balance/` (only directory found) |

### Existing Tests
- `tests/balance/balance-ui.test.js` — balance UI tests
- `tests/balance/dashboard-kpis.test.js` — dashboard KPI tests

### Phase Requirements → Test Map

| Area | Behavior | Test Type | Automated? | Notes |
|------|----------|-----------|-----------|-------|
| A (Loan/Mortgage form) | Monthly payment + start date saved to DB, card shows correct amount, 12 recurrent expenses generated with correct amount/date | Integration | Partially — dashboard-kpis.test.js may cover `getDashboardData` | No dedicated loan-form tests found |
| B (Expense guard) | `openForm()` with `isDebtPayment=true` shows alert, redirects, does not open form | Unit | No existing test | Gap — Wave 0 |
| C (Dashboard field name) | `getDashboardData` returns correct `ccPayments` and `loanPayments` | Unit | Likely covered by dashboard-kpis.test.js | Verify |
| D (Schema index) | `deleteLinkedExpenses` works efficiently via index | Integration | Not testable in unit environment | Manual verification |
| E (Button style) | Pending button shows "○ Pending" | DOM/render | Not testable in current test setup | Manual |

### Wave 0 Gaps
- [ ] `tests/balance/dashboard-kpis.test.js` — verify it covers `ccPayments`/`loanPayments` field name fix (REQ-C)
- No new test files needed if existing tests cover REQ-C; otherwise add assertions to existing file

*(Most changes in this phase are already implemented, so Wave 0 is minimal)*

---

## Sources

### Primary (HIGH confidence)
- Direct source read: `src/ui/debts.js` — FIELD_IDS, form HTML, _populateEditFields, _saveDebt verified
- Direct source read: `src/ui/expenses.js` — openForm guard, deleteExpense guard, render button, mark-paid button verified
- Direct source read: `src/db/repository.js` — getDashboardData, generateLoanPayments verified
- Direct source read: `src/db/schema.js` — version 17 with linkedDebtId verified
- `.planning/phases/phase-18-CONTEXT.md` — authoritative spec

### Secondary (MEDIUM confidence)
- Dexie.js documentation (general knowledge): version() API, stores string semantics, no-upgrade auto-reindex

---

## Metadata

**Confidence breakdown:**
- Current state assessment: HIGH — verified by direct source read
- Remaining work (Part E): HIGH — clear delta identified
- Dexie versioning rules: HIGH — consistent with observed schema history
- Test coverage gaps: MEDIUM — tests directory has limited coverage; exact test contents not fully read

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable codebase; no fast-moving dependencies)
