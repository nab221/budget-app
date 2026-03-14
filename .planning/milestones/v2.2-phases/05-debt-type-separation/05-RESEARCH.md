# Phase 5: Debt Type Separation (Schema + Logic) - Research

**Researched:** 2026-03-04
**Domain:** Database Schema (Dexie.js), Financial Logic, UI Rendering
**Confidence:** HIGH

## Summary

This phase focuses on formalizing debt types (`credit-card`, `loan`, `mortgage`) in the database schema (v13) and the UI. It addresses the need for specialized logic and fields for installment-based debts (loans and mortgages) as opposed to revolving credit (credit cards).

**Primary recommendation:** Use the existing `isDebtPayment` and `linkedStatementId` pattern but extend `recurrentExpenses` with `debtType` and `linkedDebtId` to enable type-specific icons (🏠, 💰, 💳) and automatic series generation for loans/mortgages.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEBT-01 | Schema Migration (v13): Add `debtType` to `debts` table. | v13 upgrade path identified in `src/db/schema.js`. |
| DEBT-02 | Map existing debts to types during migration. | Mapping logic from `type` to `debtType` (hyphenated) defined. |
| DEBT-03 | Add Loan/Mortgage fields (principal, term, fixed payment, etc.). | Form updates identified for `src/ui/debts.js`. |
| DEBT-04 | Loan/Mortgage scheduled payments in expenses with icons (🏠/💰). | `badgeHTML` logic identified in `src/ui/expenses.js`. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Dexie.js | 3.x | IndexedDB Wrapper | Already used for DB operations. Supports schema versions. |
| date-fns | 2.x | Date Manipulation | Used for recurring series and next-date calculations. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|--------------|
| `src/utils/finance.js` | N/A | Financial Formulas | Used for payoff and min-payment calculations. |
| `src/utils/recurrence.js` | N/A | Recurring Series | Used to generate future payment instances for loans. |

## Architecture Patterns

### Database Schema (v13)
The `debts` table will be updated to version 13.
```javascript
// src/db/schema.js
db.version(13).stores({
  debts: '++id, name, debtType, apr, creditLimit, currentBalance, originalPrincipal, termMonths, fixedMonthlyPayment, interestRate, earlyRepaymentFee, earlyRepaymentAllowed',
  recurrentExpenses: '..., debtType, linkedDebtId' // Recommended addition
});
```

### Pattern 1: Automatic Series Generation
For `loan` and `mortgage` debts, which have a `fixedMonthlyPayment`, the app should automatically generate a series of `recurrentExpenses` for the duration of the `termMonths`. This avoids the manual "Log Statement" requirement for every single installment.

**When to use:** When a debt of type `loan` or `mortgage` is created or its `fixedMonthlyPayment` is updated.

### Anti-Patterns to Avoid
- **Duplicating Series:** Avoid re-generating the entire series every time a loan is edited. Use `deleteSeries` from `recurrentExpenseRepository` before re-adding to avoid double-counting.
- **Hard-coding Icons:** Don't hard-code icons in multiple places. Centralize icon selection based on `debtType`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Installment Calculation | Custom interest loop | `calcLoanPayment` | Use standard amortization formulas (Standard math: `P*r(1+r)^n/((1+r)^n-1)`). |
| Recurring Generation | Custom loops | `generateInstances` | Existing utility handles UUIDs and future date logic correctly. |

## Common Pitfalls

### Pitfall 1: Hyphenated Type Mismatch
**What goes wrong:** Requirement specifies `credit-card` (hyphen), but existing code uses `credit_card` (underscore).
**Why it happens:** Inconsistency between early implementation and v2.0 design spec.
**How to avoid:** Migration MUST explicitly rename `credit_card` to `credit-card` and UI forms must use hyphenated values.

### Pitfall 2: Static `isDebtPayment`
**What goes wrong:** If `isDebtPayment` is just a boolean, the Expenses list won't know *which* icon to show without a join.
**Why it happens:** Initial design only considered one debt icon (💳).
**How to avoid:** Store the `debtType` (e.g., `loan`, `mortgage`, `credit-card`) directly on the `recurrentExpense` record.

## Code Examples

### Migration Logic (v13)
```javascript
// Source: Migration Proposal
await tx.table('debts').toCollection().modify(debt => {
  // Map old 'type' to new 'debtType'
  if (debt.type === 'credit_card' || debt.type === 'overdraft' || !debt.type) {
    debt.debtType = 'credit-card';
  } else {
    debt.debtType = debt.type; // 'loan' or 'mortgage'
  }
  delete debt.type;

  // Initialize new fields with defaults
  debt.originalPrincipal = debt.originalPrincipal || 0;
  debt.termMonths = debt.termMonths || 0;
  debt.fixedMonthlyPayment = debt.fixedMonthlyPayment || 0;
  debt.interestRate = debt.interestRate || debt.apr || 0;
  debt.earlyRepaymentFee = debt.earlyRepaymentFee || 0;
  debt.earlyRepaymentFeeIsPercent = false; // Recommended refinement
  debt.earlyRepaymentAllowed = debt.earlyRepaymentAllowed !== undefined ? debt.earlyRepaymentAllowed : true;
});
```

### Icon Rendering (src/ui/expenses.js)
```javascript
// Source: Proposed update for Expenses UI
const getDebtIcon = (debtType) => {
  switch (debtType) {
    case 'mortgage': return '🏠';
    case 'loan': return '💰';
    default: return '💳';
  }
};

// Inside render loop
if (item.isDebtPayment) {
  const icon = getDebtIcon(item.debtType);
  badgeHTML.push(`<span class="pill" style="background:var(--accent);color:#fff;font-size:.65rem">${icon} Debt</span>`);
}
```

## Open Questions

1. **How to handle "Early Repayment Fee" input?**
   - What we know: Users need to enter £ or %.
   - What's unclear: Best UI for this choice.
   - Recommendation: Store as `earlyRepaymentFee` (pence) and `earlyRepaymentFeeIsPercent` (bool) or just use a string parser.

2. **Should we delete existing installments when a loan is updated?**
   - What we know: Updating `fixedMonthlyPayment` should change future installments.
   - What's unclear: Should past (paid) installments be kept?
   - Recommendation: Only delete/update `pending` installments in the series.

## Sources

### Primary (HIGH confidence)
- `src/db/schema.js` - Current schema (v12) structure.
- `src/ui/debts.js` - Existing debt form and rendering logic.
- `src/ui/expenses.js` - Current icon and badge rendering.
- `REQUIREMENTS.md` - Phase 5 specific requirements.

## Metadata
**Confidence breakdown:**
- Standard stack: HIGH - Libraries already in use.
- Architecture: HIGH - Clear migration path in Dexie.
- Pitfalls: MEDIUM - Naming mismatch is subtle but likely.

**Research date:** 2026-03-04
**Valid until:** 2026-04-03
