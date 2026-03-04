# Phase 4: Expense Simplification - Research

**Researched:** 2024-05-24
**Domain:** UI/UX Simplification, Chart.js, Data Layer Integration
**Confidence:** HIGH

## Summary

This phase focuses on consolidating the split expense tracking system into a unified workflow. Currently, the application distinguishes between "Recurrent" (Fixed) and "One-off" (Variable) expenses, both in the UI and the underlying data repositories. The goal is to merge these into a single "Expenses" list and form, removing the mental overhead of choosing a "bucket" before adding a transaction.

**Primary recommendation:** Unify the `Expenses` tab by removing sub-tabs, merging the list rendering logic, and using a single form where the `isRecurring` checkbox determines the target repository.

<user_constraints>
## User Constraints (from CONTEXT.md)

*(Note: No CONTEXT.md was provided for this specific sub-task, but the Roadmap constraints apply.)*

### Locked Decisions
- Expenses tab must display a single list without sub-tabs.
- One-off expenses must be merged into the main list as single-occurrence items.
- Variable/Fixed distinctions are to be removed from charts and UI.

### Claude's Discretion
- Implementation of the unified form layout.
- Styling of the merged list (e.g., using icons or badges to distinguish recurring items).

### Deferred Ideas (OUT OF SCOPE)
- Full schema merge of `recurrentExpenses` and `oneOffExpenses` tables (keep repositories separate but unified in UI for now).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXP-01 | Expenses tab displays a single list without sub-tabs. | Identified sub-tab logic in `src/ui/expenses.js` and how to remove it. |
| EXP-02 | One-off expenses are merged into the main list as single-occurrence items. | Verified `getRollingFinancialData` already merges these; UI needs similar merging. |
| EXP-03 | Variable/Fixed distinctions are removed from charts and UI. | Located "Fixed" and "Variable" strings in `src/ui/charts.js` and category logic. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chart.js | 4.x | Data visualization | Used for all app charts; supports dashed lines for forecasts. |
| Dexie.js | 3.x | Database | Repository pattern abstracts the two underlying tables. |

### Supporting
| Library | Purpose | When to Use |
|---------|---------|--------------|
| `safeHTML` | Template literal for sanitized HTML | Used for all DOM rendering in the project. |
| `filterTransactions` | Utility for search and category filtering | Standard way to filter lists in the app. |

## Architecture Patterns

### Current State: Split Logic
The `expensesUI` module in `src/ui/expenses.js` uses an `activeSubTab` state ('recurrent' or 'oneoff') to toggle between two completely different rendering paths:
- `renderRecurrent()` -> fetches from `recurrentExpenseRepository`.
- `renderOneOff()` -> fetches from `oneOffExpenseRepository`.
- `renderForm()` -> branches into two distinct HTML templates.

### Recommended: Unified Logic
1.  **Unified Rendering**: Replace `renderRecurrent` and `renderOneOff` with a single `renderList()` that fetches from both repositories and merges the results.
2.  **Unified Form**: A single `renderForm()` template. The `isRecurring` checkbox (already present) should toggle the visibility of recurrence-specific fields (Frequency, Total Payments, etc.).
3.  **Repository Dispatch**: `handleSaveExpense` should use the `isRecurring` value to decide which repository to call.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Currency Formatting | Custom string concat | `formatGBP` utility | Handles pence conversion and locale formatting consistently. |
| HTML Sanitization | Regex or manual escaping | `safeHTML` | Project standard for XSS prevention. |
| List Filtering | Custom loops | `filterTransactions` | Already handles multi-field search and category array filtering. |

## Common Pitfalls

### Pitfall 1: Category Group Mismatch
**What goes wrong:** User picks a "Fixed" category for a one-off expense.
**Why it happens:** Categories still have `group: 'fixed'` or `'variable'`.
**How to avoid:** In the unified form, show all categories (both fixed and variable) in one list (possibly grouped by `<optgroup>` for transition, but the roadmap suggests removing the distinction).

### Pitfall 2: Recurrence Series Breakage
**What goes wrong:** Saving a modified recurring item as a one-off accidentally.
**Why it happens:** Incorrect repository dispatch in `handleSaveExpense`.
**How to avoid:** Ensure that if `isRecurring` is checked, it always goes to `recurrentExpenseRepository`.

### Pitfall 3: Sub-tab Persistence
**What goes wrong:** App still tries to load `lastSubTab` from localStorage.
**Why it happens:** Legacy state management in `initMonths`.
**How to avoid:** Clean up `localStorage` keys and `initMonths` logic.

## Code Examples

### Unified List Merging
```javascript
// Suggested pattern for src/ui/expenses.js
async render() {
  const month = this.getCurrentMonth();
  const [recurrent, oneOff] = await Promise.all([
    recurrentExpenseRepository.getByMonth(month),
    oneOffExpenseRepository.getByMonth(month)
  ]);
  
  // Merge and sort
  const allItems = [...recurrent, ...oneOff].sort((a, b) => 
    (a.nextDate || a.date).localeCompare(b.nextDate || b.date)
  );
  
  // Render using a single loop
}
```

### Chart Legend Update
```javascript
// In src/ui/charts.js
// Change this:
labels: ['Income', 'Fixed', 'Variable']
// To this:
labels: ['Income', 'Expenses']
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Split Tabs | Unified List | Phase 4 | Reduced clicks, better "one-stop" visibility. |
| Fixed/Variable Labels | Expenses Label | Phase 4 | Simplified financial terminology for users. |

## Sources

### Primary (HIGH confidence)
- `src/ui/expenses.js`: Confirmed current dual-tab structure and form branching.
- `src/ui/charts.js`: Confirmed "Fixed" and "Variable" legend strings and OKABE_ITO colors.
- `src/db/repository.js`: Verified `getRollingFinancialData` already performs the desired merge for the dashboard.

## Metadata
**Confidence breakdown:**
- Standard stack: HIGH
- Architecture: HIGH
- Pitfalls: MEDIUM (Series management is tricky)

**Research date:** 2024-05-24
**Valid until:** 2024-06-24
