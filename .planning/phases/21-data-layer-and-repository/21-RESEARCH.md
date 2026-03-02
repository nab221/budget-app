# Phase 21: Data Layer & Repository (v1.3) - Research

**Researched:** 2026-03-02
**Domain:** IndexedDB (Dexie.js) Schema & Repository
**Confidence:** HIGH

## Summary

This research phase defines the data layer expansion for **Milestone v1.3: Enhanced Debt Management**. The primary focus is enabling circular linking between credit card statements and their corresponding "Minimum Payment" expenses in the `recurrentExpenses` table. This allows the app to track which specific statement generated a payment and whether that payment has been finalized with an actual amount/date.

**Primary recommendation:** Use a Dexie transaction for `addWithExpense()` to ensure both the statement and its linked expense are created atomically, and use a two-step update process to resolve the circular ID references (`linkedExpenseId` <-> `linkedStatementId`).

<user_constraints>
## User Constraints (from CONTEXT.md)

*No CONTEXT.md was provided for this phase. Research follows the Roadmap and Requirements documentation.*
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEBT-01.1 | Schema v11: Expand `statements` table | Defined exact field list and types for `statements`. |
| DEBT-01.2 | Schema v11: Expand `recurrentExpenses` table | Defined `isDebtPayment` and `linkedStatementId` flags. |
| DEBT-01.3 | Implement migrations for Schema v11 | Planned the `db.version(11).upgrade()` path. |
| DEBT-01.4 | `statementRepository.addWithExpense()` | Defined the atomic transactional interface for circular linking. |
| DEBT-01.5 | `statementRepository.recordPayment()` | Defined logic for updating actual payment and marking linked expense as paid. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Dexie.js | ^3.2.0 | IndexedDB Wrapper | Primary database layer for the project. |

## Architecture Patterns

### Schema v11 Migration Plan
The migration will occur in `src/db/schema.js`. Existing records will be initialized with default values.

**New Fields for `statements`:**
- `openingBalance` (Integer Pence)
- `minimumPayment` (Integer Pence)
- `paymentDueDate` (ISO Date String)
- `actualPaymentAmount` (Integer Pence, null until paid)
- `actualPaymentDate` (ISO Date String, null until paid)
- `linkedExpenseId` (Integer ID, null until linked)

**New Fields for `recurrentExpenses`:**
- `isDebtPayment` (Boolean, default false)
- `linkedStatementId` (Integer ID, default null)

### Circular Linking Pattern
Since `statements` and `recurrentExpenses` reference each other's IDs, `addWithExpense()` must perform a two-step update:
1. Insert `statements` record (ID generated).
2. Insert `recurrentExpenses` record with `linkedStatementId` (ID generated).
3. Update `statements` record with `linkedExpenseId`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic Updates | Custom lock logic | `db.transaction()` | Native Dexie/IndexedDB support for ACID compliance. |
| Currency Math | Floating point | `toPence` / `fromPence` | Project standard to avoid IEEE 754 rounding errors. |
| ID Generation | Manual counters | `++id` (Auto-increment) | Dexie manages unique ID generation safely. |

## Common Pitfalls

### Pitfall 1: Circular ID Dependencies
**What goes wrong:** Attempting to save both records in one step when both require the other's ID.
**How to avoid:** Use the two-step update pattern within a single transaction.

### Pitfall 2: Calculation Stale-ness
**What goes wrong:** Adding/updating statements affects the forecast but doesn't trigger a refresh.
**How to avoid:** Ensure both `addWithExpense` and `recordPayment` call `triggerBalanceRecalc` and `triggerDailyForecastRecalc` upon completion.

### Pitfall 3: Debt Balance Update Timing
**What goes wrong:** Updating `debt.currentBalance` when a payment is made vs when a statement is logged.
**How to avoid:** Per **DEBT-02.2**, only the *logging* of a statement should update the `debt.currentBalance`. `recordPayment` only updates the statement and expense records.

## Code Examples

### Atomic Statement & Expense Creation
```javascript
// src/db/repository.js
async addWithExpense(statementData, expenseData) {
  return await db.transaction('rw', [db.statements, db.recurrentExpenses], async () => {
    // 1. Add statement (monetary fields converted by wrapper or manually)
    const statementId = await db.statements.add({ 
      ...statementData, 
      linkedExpenseId: null 
    });

    // 2. Add expense
    const expenseId = await db.recurrentExpenses.add({ 
      ...expenseData, 
      linkedStatementId: statementId,
      isDebtPayment: true,
      cycleTotal: 1, // Debt payments are one-off instances of a bill
      cycleCurrent: 0,
      status: 'pending'
    });

    // 3. Close the loop
    await db.statements.update(statementId, { linkedExpenseId: expenseId });
    
    return statementId;
  });
}
```

### Recording Actual Payment
```javascript
// src/db/repository.js
async recordPayment(statementId, actualAmount, actualDate) {
  const amtPence = toPence(actualAmount);
  return await db.transaction('rw', [db.statements, db.recurrentExpenses], async () => {
    const stmt = await db.statements.get(statementId);
    if (!stmt) throw new Error('Statement not found');

    // Update statement
    await db.statements.update(statementId, {
      actualPaymentAmount: amtPence,
      actualPaymentDate: actualDate
    });

    // Finalize linked expense
    if (stmt.linkedExpenseId) {
      await db.recurrentExpenses.update(stmt.linkedExpenseId, {
        status: 'paid',
        amount: amtPence, // Update to actual amount if different from minimum
        cycleCurrent: 1,
        date: actualDate
      });
    }
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Simple Statement Log | Linked Lifecycle | Phase 21 | Statements now drive cash flow expenses automatically. |
| Manual "Mark Paid" | Specialized Payment Log | Phase 21 | Enables tracking of "Paid £200" vs "Min Payment £25". |

## Open Questions

1. **Category Detection:** Should `addWithExpense` automatically detect the "Credit Cards & Loans" category ID?
   - **Recommendation:** Yes, the repository should provide a helper to find this ID or accept it from the UI.

## Sources

### Primary (HIGH confidence)
- `src/db/schema.js` - Current schema structure (v10).
- `src/db/repository.js` - Current repository patterns and recalculation triggers.
- `.planning/REQUIREMENTS.md` - DEBT-01.x requirements.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Core project technology.
- Architecture: HIGH - Follows existing project patterns.
- Pitfalls: HIGH - Documented in roadmap/requirements.

**Research date:** 2026-03-02
**Valid until:** 2026-04-01
