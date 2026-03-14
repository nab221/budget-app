
# Phase 37 Context: Budget vs Actual Reporting

## Objective
Add a budget vs actual monthly report to the Dashboard tab. Allow users to set monthly budgets per category. Show variance (over/under budget) with colour coding. Export to CSV or PDF.

## Background

### Current State
The app tracks income and expenses but has no budget feature. Users cannot set spending limits per category or see how actual spending compares to a budget.

### Budget Model
```js
// New store: monthlyBudgets
{
  id: auto,
  categoryId: FK → categories.id,
  month: string,        // 'YYYY-MM' format
  budgetAmount: number  // pence
}
```
If no budget is set for a category/month, that category is shown as "No budget set" in the report.

### Budget vs Actual Table
```
Category          Budget    Actual    Variance    %
──────────────────────────────────────────────────
Groceries         £400      £423      -£23 ↑      105%
Dining Out        £150      £98       +£52 ↓      65%
Transport         £200      £200      £0          100%
No budget set:
Gym               —         £45       —
```

- Red: actual > budget (over-budget)
- Green: actual < budget (under-budget)
- Grey: no budget set

### Month Selector
Add a month/year selector (prev/next arrows + month label) above the table. Default: current calendar month.

### Export
- CSV: same column structure as the table
- PDF: formatted report with app branding (use existing PDF export infrastructure if available, or use `jsPDF`)

### Cloud Sync Registration
The `monthlyBudgets` store must be registered in `src/ui/cloud-sync.js`.

## Files to Change
- `src/db/schema.js` — add `monthlyBudgets` store, bump version
- `src/db/repository.js` — budget CRUD, budget vs actual aggregation query
- `src/ui/dashboard.js` — budget vs actual section (or new `src/ui/budget-report.js`)
- `src/ui/cloud-sync.js` — register `monthlyBudgets` store
- `src/utils/budget-export.js` — CSV + PDF export utility (new)

## Acceptance Criteria
- [ ] Monthly budgets can be set per category (add/edit/delete)
- [ ] Budget vs actual table renders for the selected month
- [ ] Variance column shows correct amount and direction (↑ over, ↓ under)
- [ ] % column shows actual/budget × 100, formatted as integer %
- [ ] Categories with no budget show "No budget set" row
- [ ] Over-budget rows highlighted red; under-budget rows highlighted green
- [ ] Month selector navigates between months correctly
- [ ] CSV export downloads correct data
- [ ] PDF export renders formatted report
- [ ] `monthlyBudgets` store registered in cloud sync
- [ ] All 354+ existing Vitest tests pass
- [ ] New budget tests achieve ≥ 85% branch coverage

## Technical Notes
- Budget amounts are stored in pence (integer) to match the rest of the app's money handling
- The aggregation query joins `monthlyBudgets`, `categories`, and the expense stores to produce the report data
- If `jsPDF` is not already in dependencies, add it. Check `package.json` first.
- The month selector should default to the current month on first load, then remember the last selected month in component state (not persisted to DB)
