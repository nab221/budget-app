
# Phase 29 Context: Mobile Table & Interaction Fixes

## Objective
Fix all mobile table layout and interaction issues in the Income and Expenses tabs. Replace wide-column edit/delete buttons with swipe gestures. Fix category rendering in Expenses to use badge chips. Fix the "expenses created from debts" navigation target.

## Background

### Income Tab Issues
1. **Amount header wraps** — the word "Amount" breaks across two lines because the column is too narrow on mobile
2. **Date format** — currently shows full date strings that overflow; should be two lines: `dd-MMM` on line 1, `YYYY` on line 2
3. **Edit/Delete buttons** — consume too much horizontal space; replace with swipe gestures (right-to-edit, left-to-delete) using `src/utils/gestures.js`

### Expenses Tab Issues
1. **Tab menu disappears** — Fixed in Phase 28 (bottom bar); this phase handles the table itself
2. **Category column** — currently rendered as a table header cell with text; must be a badge chip (matching income tab style) that sits inline with the row
3. **Table headers overflow** — currently `Date | Category | Expense | Amount | Status | (actions)` which is too many columns. Reduce to: `Date | Expense | Amount` with Status shown as an inline icon (✓ = paid, ○ = pending, ✗ = cancelled) and Category as a badge chip inside the Expense cell
4. **Date format** — same as Income: `dd-MMM / YYYY`
5. **Debt-linked expenses** — expenses generated from a debt record (mortgage, loan, credit card minimum payment) should navigate to the Debts tab when the row is tapped/swiped, not show an inline edit form
6. **Pending/Paid label** — replace text badge with a compact icon (✓/○/✗) to save space

### Gesture Utility
`src/utils/gestures.js` already exists and provides swipe support. It needs to be applied to table rows in `transactions.js` and `expenses.js`. Review the existing API and use it directly or extend as needed.

### Debt-Linked Expenses
When an expense is created by the debt system (e.g. "Mortgage payment - March"), its `sourceDebtId` (or equivalent) field identifies it as debt-linked. On the Expenses tab:
- Swiping right or tapping the row should navigate to the Debts tab and highlight the corresponding debt record
- There should be no inline edit form for debt-linked expenses (the debt record itself is the source of truth)
- Check `src/ui/expenses.js` for where `sourceDebtId` or similar linkage is stored in the expense record

## Files to Change
- `src/ui/transactions.js` — date format, header layout, swipe gestures
- `src/ui/expenses.js` — category badge, header reduction, status icon, debt-link navigation, swipe gestures, date format
- `src/utils/gestures.js` — extend if needed for table rows
- `css/main.css` — badge chip styles, table mobile overrides, status icon styles

## Acceptance Criteria
- [ ] Income table: "Amount" header does not wrap on any mobile viewport ≥320px
- [ ] Income table: dates display as `dd-MMM` / `YYYY` (two short lines)
- [ ] Income table: swipe-right reveals Edit, swipe-left reveals Delete (with haptic if enabled)
- [ ] Expenses table: headers are `Date | Expense | Amount` only (3 columns)
- [ ] Expenses table: category rendered as badge chip inside/below expense name
- [ ] Expenses table: status shown as ✓ (paid) / ○ (pending) / ✗ (cancelled) icon
- [ ] Expenses table: dates display as `dd-MMM` / `YYYY`
- [ ] Expenses table: debt-linked rows navigate to Debts tab when tapped/swiped
- [ ] Non-debt expenses: swipe-right = edit, swipe-left = delete
- [ ] All 354+ Vitest tests pass
- [ ] Manual check on narrow mobile viewport (320px–390px)

## Technical Notes
- The `gestures.js` swipe handler returns a cleanup function — make sure it is called when a row is removed to prevent memory leaks
- Debt-linkage field name: inspect `src/ui/expenses.js` and `src/db/repository.js` to confirm the exact field (likely `debtId` or `sourceType === 'debt'`)
- Status icon must be accessible: add `aria-label="Paid"` etc. to the icon element
- If `gestures.js` does not support a reveal-under-swipe pattern (swipe to reveal action buttons behind the row), it must be extended with a `SwipeReveal` class that handles: touch start/move/end, translateX animation, reveal container with action buttons, and auto-close when another row is swiped
- Swipe threshold: 60px minimum travel before action is revealed
- Rows must support both horizontal swipe (for actions) and vertical scroll (for table scrolling) — use angle detection to disambiguate
