# Phase 24: Payment Confirmation Workflow - Research

**Researched:** 2026-03-02
**Domain:** UI/UX, Data Layer, Debt Management
**Confidence:** HIGH

## Summary

This phase focuses on the specialized workflow for confirming debt payments within the Expenses tab. When a user marks a debt-related expense as "paid," they will no longer perform a simple toggle. Instead, they will be prompted with a confirmation dialog to record the actual amount paid and the payment date. This information is then synchronized with the corresponding debt statement in the `statements` table.

The repository layer for recording these payments (`statementRepository.recordPayment()`) is already implemented, but the UI triggers and feedback mechanisms need to be built. We will also integrate UK bank holiday logic to suggest the most likely actual payment date for these transactions.

**Primary recommendation:** Intercept the existing `toggleRecurrentStatus` function in `src/ui/expenses.js`. If the item has the `isDebtPayment` flag, trigger a specialized confirmation modal before calling `statementRepository.recordPayment()`.

<user_constraints>
## User Constraints (from CONTEXT.md)

*No CONTEXT.md found for this phase. Researching based on requirements in REQUIREMENTS.md and ROADMAP.md.*
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEBT-02.4 | Implement "Mark Paid" specialized workflow for debt-linked expenses that prompts for actual amount paid. | `src/ui/expenses.js` analysis confirms "Mark Paid" is a simple toggle; repo already supports `recordPayment`. |
| DEBT-04.3 | Add visual `💳` badge and unique styling for debt-related expenses in all lists and charts. | Found existing 💳 badge logic in `src/ui/expenses.js`; needs extension to `src/ui/debts.js`. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Dexie.js | ^3.2.0 | Database | Existing project standard for IndexedDB. |
| date-fns | ^2.29.0 | Date manipulation | Used for UK bank holiday and next working day logic. |

## Architecture Patterns

### Recommended Confirmation Dialog Pattern
The project uses a simple `confirm()` or manual DOM injection for modals. For this phase, we should use a consistent modal pattern that can handle input.

**Trigger Logic:**
```javascript
// src/ui/expenses.js
window.toggleRecurrentStatus = async (id, currentStatus) => {
  const item = await recurrentExpenseRepository.get(id);
  if (item.isDebtPayment && currentStatus === 'pending') {
    // Show specialized dialog
    showDebtPaymentConfirmation(item);
    return;
  }
  // Fallback to existing toggle logic for non-debts or "un-paying"
  // ...
}
```

### Pattern 1: Synchronized Update
When a debt payment is confirmed:
1.  `statementRepository.recordPayment()` updates the `statements` record (`actualPaymentAmount`, `actualPaymentDate`).
2.  It also updates the linked `recurrentExpenses` record (`status`, `amount`, `cycleCurrent`, `date`).
3.  `triggerBalanceRecalc()` is fired to ensure the forecast and monthly totals are updated with the *actual* amount paid instead of the *minimum* amount.

### Anti-Patterns to Avoid
- **Manual State Desync:** Never update the expense record without calling the `statementRepository` method, as this will lead to the statement history being out of sync with the cash flow.
- **Double Counting:** Ensure that recording the actual amount updates the *existing* expense rather than creating a new one-off expense.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bank Holiday Calculation | Custom holiday lists | `fetchHolidays` & `isBankHoliday` | Already implemented in `src/utils/cashflow.js`. |
| Next Working Day | Custom loops | `nextWorkingDay` | Already implemented in `src/utils/cashflow.js`. |
| Currency Conversion | `parseFloat` * 100 | `toPence` | Handles precision and edge cases; already in `src/utils/currency.js`. |

## Common Pitfalls

### Pitfall 1: Desynchronization on "Un-paying"
**What goes wrong:** If a user accidentally marks a debt payment as paid and then toggles it back to "pending," the `actualPaymentAmount` in the statement might remain populated.
**How to avoid:** If `currentStatus === 'paid'`, the toggle should reset the statement's actual fields to `null` and restore the expense amount to the minimum (from the statement).

### Pitfall 2: Bank Holiday Suggestion
**What goes wrong:** Defaulting to today's date if today is a Sunday or Bank Holiday might result in inaccurate "actual payment date" reporting.
**How to avoid:** Use `nextWorkingDay(new Date().toISOString().slice(0, 10), true)` as the default value for the payment date input.

## Code Examples

### Suggested Confirmation Dialog HTML Structure
```javascript
const dialogHtml = safeHTML`
  <div id="debtConfirmModal" class="modal-overlay">
    <div class="card">
      <h3>Confirm Debt Payment</h3>
      <p>Min Due: ${formatGBP(item.amount)}</p>
      <div class="form-row">
        <div>
          <label>Actual Amount Paid (£)</label>
          <input type="number" step="0.01" id="actualAmtInput" value="${fromPence(item.amount).toFixed(2)}">
        </div>
      </div>
      <div class="form-row">
        <div>
          <label>Payment Date</label>
          <input type="date" id="actualDateInput" value="${suggestedDate}">
        </div>
      </div>
      <div class="form-row btns">
        <button class="primary" onclick="confirmPayment(${item.id})">Record Payment</button>
        <button class="ghost" onclick="closeModal()">Cancel</button>
      </div>
    </div>
  </div>
`;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Simple Toggle | Specialized Dialog | v1.3 (Phase 24) | Better accuracy for debt tracking and net worth projections. |

## Open Questions

1. **How to handle partial payments?**
   - *What we know:* `recordPayment` updates the expense and statement.
   - *Recommendation:* Treat any amount entered as the "actual payment." If it's less than the minimum, it's recorded as such. The system doesn't currently support "remaining balance" on a minimum payment for the *same* cycle.

2. **Should we update the Debt's `currentBalance` on payment?**
   - *What we know:* Requirement DEBT-02.2 says "debt balance remains unchanged... updates only occur when the next statement is logged."
   - *Recommendation:* Strictly follow DEBT-02.2. The actual payment is for historical tracking and cash flow accuracy, but the "official" balance is only updated via statement logging.

## Sources

### Primary (HIGH confidence)
- `src/db/repository.js` - Checked `statementRepository.recordPayment` implementation.
- `src/ui/expenses.js` - Checked existing "Mark Paid" logic.
- `src/utils/cashflow.js` - Checked bank holiday and working day logic.
- `src/db/schema.js` - Verified Schema v11 fields.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing project tools.
- Architecture: HIGH - Fits into current repository/UI pattern.
- Pitfalls: MEDIUM - Identified potential desync issues.

**Research date:** 2026-03-02
**Valid until:** 2026-04-01
