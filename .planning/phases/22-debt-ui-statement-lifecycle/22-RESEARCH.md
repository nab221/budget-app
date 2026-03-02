# Phase 22: Debt UI & Statement Lifecycle - Research

**Researched:** 2026-03-02
**Domain:** UI Development (Vanilla JS), Debt Management, Statement Lifecycle
**Confidence:** HIGH

## Summary

This phase implements the user interface for the enhanced debt management system introduced in Milestone v1.3. It focuses on the "Statement Lifecycle": manually logging monthly statements, which in turn automates the creation of "Minimum Payment" expenses in the budget. This ensures that credit card and loan payments are integrated into the cash flow forecast without redundant data entry.

**Primary recommendation:** Use the `statementRepository.addWithExpense()` method within a newly expanded statement form in `src/ui/debts.js`, incorporating validation that ensures the opening balance of a new statement matches the closing balance of the previous one.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS | ES6+ | UI Logic | Project standard for lean, fast UI |
| Dexie.js | 4.0+ | Database | Robust IndexedDB wrapper with transaction support |
| date-fns | 2.x | Date manipulation | Standard for reliable date arithmetic |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| DOMPurify | 3.x | XSS Prevention | Used in `safeHTML` for rendering |

## Architecture Patterns

### Recommended Project Structure
- `src/ui/debts.js`: Primary location for statement form and history rendering.
- `src/db/repository.js`: Houses the `statementRepository` logic (already enhanced in Phase 21).
- `src/ui/expenses.js`: Displays the linked expenses with visual indicators.

### Pattern 1: Atomic Statement/Expense Creation
**What:** Use Dexie transactions to ensure that a statement and its linked expense are created together or not at all.
**When to use:** Every time a new statement is logged.
**Example:**
```javascript
// src/db/repository.js (already implemented in Phase 21)
async addWithExpense(statementData, debtName) {
  await db.transaction('rw', db.statements, db.recurrentExpenses, async () => {
    const stmtId = await db.statements.add(statementData);
    const expenseId = await db.recurrentExpenses.add({
       label: `Min Payment: ${debtName}`,
       linkedStatementId: stmtId,
       isDebtPayment: true,
       // ...
    });
    await db.statements.update(stmtId, { linkedExpenseId: expenseId });
  });
}
```

### Pattern 2: Continuity Validation
**What:** Before saving a statement, fetch the most recent statement for the same debt and verify that `newStatement.openingBalance === previousStatement.closingBalance`.
**When to use:** In the `handleSaveStatement` method in `src/ui/debts.js`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date arithmetic | Custom logic | `date-fns` | Handles months of varying lengths and leap years |
| Bank Holiday logic | Hardcoded dates | `src/utils/cashflow.js` | Already implements gov.uk API fetch and overrides |
| Currency formatting | `number.toFixed(2)` | `src/utils/currency.js` | Consistent GBP formatting across the app |

## Common Pitfalls

### Pitfall 1: Manual Debt Balance Updates
**What goes wrong:** Updating `debt.currentBalance` separately from statement logging leads to drift.
**Why it happens:** Logic distributed across multiple UI components.
**How to avoid:** Ensure that `debt.currentBalance` is *only* updated when a statement is saved or deleted, using the latest statement's amount as the truth.

### Pitfall 2: Disconnected Expenses
**What goes wrong:** User deletes a statement but the linked "Min Payment" expense remains in the budget.
**Why it happens:** `statementRepository.delete` might not handle the cleanup of the linked record.
**How to avoid:** Update `statementRepository.delete` to also remove the linked expense if `linkedExpenseId` is present.

## Code Examples

### Statement Form Validation (Proposed for `src/ui/debts.js`)
```javascript
async handleSaveStatement() {
  const debtId = parseInt(document.getElementById('stmtDebtId').value);
  const openingBalance = toPence(document.getElementById('stmtOpeningInput').value);
  
  const allStmts = await statementRepository.getAll();
  const prevStmt = allStmts
    .filter(s => s.debtId === debtId)
    .sort((a,b) => b.date.localeCompare(a.date))[0];

  if (prevStmt && openingBalance !== prevStmt.amount) {
    if (!confirm(`Opening balance (£${fromPence(openingBalance)}) does not match previous closing balance (£${fromPence(prevStmt.amount)}). Continue?`)) {
      return;
    }
  }
  // ... proceed to save
}
```

### Visual Indicator in Expenses (Proposed for `src/ui/expenses.js`)
```javascript
const renderRow = (item) => {
  const debtIcon = item.isDebtPayment ? '💳 ' : '';
  return safeHTML`
    <tr>
      <td>${item.nextDate}</td>
      <td>${debtIcon}${item.label}</td>
      <!-- ... -->
    </tr>
  `;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual Balance Entry | Statement-driven Balance | v1.3 | Improved audit trail; better payoff accuracy |
| Separate Bills/Debts | Linked Statement/Expense | v1.3 | Forecast accurately reflects debt payments |

## Open Questions

1. **How to handle Statement Deletion?**
   - What we know: `statementRepository.delete(id)` exists but doesn't explicitly mention linked expenses in Phase 21 plans.
   - What's unclear: Should deleting a statement also delete the auto-generated expense?
   - Recommendation: Yes, for consistency. Update the repository to handle this cleanup within a transaction.

2. **First Statement vs Subsequent?**
   - What we know: Continuity validation only works if a previous statement exists.
   - What's unclear: Should the `openingBalance` be pre-filled for the very first statement?
   - Recommendation: If no statement exists, pre-fill with 0 but allow full editing. For subsequent statements, pre-fill with the previous closing balance and make it editable but validated.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `vite.config.js` |
| Quick run command | `npm test` |
| Full suite command | `npm test -- --run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEBT-02.1 | Manual statement logging with new fields | Unit/Integration | `npm test src/ui/debts.js` | ❌ Phase 22 |
| DEBT-02.2 | Auto-expense creation on save | Integration | `npm test src/db/repository.js` | ✅ (Partially in Phase 21) |
| DEBT-02.3 | Continuity validation | Unit | `npm test src/ui/debts.js` | ❌ Phase 22 |

### Wave 0 Gaps
- [ ] `src/ui/debts.test.js` — covers statement form logic and validation.
- [ ] Update `src/db/repository.test.js` to verify linked expense cleanup on statement deletion.

## Sources

### Primary (HIGH confidence)
- `src/db/repository.js` - Contains `statementRepository.addWithExpense`.
- `src/db/schema.js` - Confirms Schema v11 fields.
- `src/ui/debts.js` - Existing debt/statement UI logic.

### Secondary (MEDIUM confidence)
- `.planning/phases/21-data-layer-and-repository/21-02-PLAN.md` - Implementation details for Phase 21.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Core project technology.
- Architecture: HIGH - Patterns align with existing codebase.
- Pitfalls: HIGH - Common issues in financial tracking apps.

**Research date:** 2026-03-02
**Valid until:** 2026-04-01
