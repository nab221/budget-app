---
status: diagnosed
phase: 11-account-balance-carry-forward
source: [11-01-SUMMARY.md, 11-02-SUMMARY.md]
started: 2026-03-01T17:00:00Z
updated: 2026-03-01T17:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Balance Panel on Dashboard
expected: Open the app and go to the Dashboard tab. A "Balance" section/card should be visible showing your running balance and a 3-month forecast (current month plus the next two months ahead).
result: pass

### 2. Balance Trend Chart
expected: Below or near the balance card, a line chart should appear showing a 90-day balance trend. Lines for past/current months should appear solid and filled; lines for projected future months should appear dashed.
result: pass

### 3. Balance Start Date in Settings
expected: Go to the Settings tab. A "Balance Start Date" input field should be present, allowing you to enter the date from which balance carry-forward calculations begin.
result: issue
reported: "Just select month, not day (so not full date)"
severity: minor

### 4. Save Balance Start Date
expected: Enter a date in the Balance Start Date field and click Save. The value should persist — if you refresh the page and return to Settings, the date you entered should still be there. The balance panel on the Dashboard should also update/recalculate based on the new start date.
result: pass

### 5. Red Alert on Negative Projection
expected: When any projected future month has a negative closing balance (i.e., expenses exceed income), the balance card should change its background to red (or a warning/alert state) to indicate you're projected to run out of money.
result: issue
reported: "The projection is not considering the recurrent payments out for the following months, even if it is a fixed expense with monthly frequency."
severity: major

### 6. Income Mutation Triggers Recalculation
expected: Add a new income entry (or edit an existing one) and save it. Then check the Dashboard — the balance card and chart should reflect the change without needing a manual refresh of the page.
result: issue
reported: "It does not automatically update it, only when change tabs."
severity: major

## Summary

total: 6
passed: 3
issues: 3
pending: 0
skipped: 0

## Gaps

- truth: "Balance Start Date input allows selecting a full date (day + month)"
  status: failed
  reason: "User reported: Just select month, not day (so not full date)"
  severity: minor
  test: 3
  root_cause: "index.html line 368 uses <input type='month'> which renders a month-only picker (YYYY-MM). Since balance snapshots are keyed by YYYY-MM this is technically consistent, but may surprise users expecting a day-level date picker."
  artifacts:
    - path: "index.html"
      issue: "input#balanceStartDate uses type='month' instead of type='date'"
  missing:
    - "Decide: keep type='month' (consistent with YYYY-MM schema) or switch to type='date' and truncate to first of month on save"

- truth: "Projected months include recurrent expense deductions (fixed monthly frequency)"
  status: failed
  reason: "User reported: The projection is not considering the recurrent payments out for the following months, even if it is a fixed expense with monthly frequency."
  severity: major
  test: 5
  root_cause: "calculateBalanceChain live DB closure (finance.js ~line 267) queries recurrentExpenses by nextDate.startsWith(monthStr) — returns empty for every future projected month since nextDate only holds the single next occurrence. recurrentExpenseRepository.getByMonth already returns all records correctly but is never called by calculateBalanceChain."
  artifacts:
    - path: "src/utils/finance.js"
      issue: "getRecurrent live closure filters by nextDate.startsWith(monthStr) — returns [] for all projected months"
    - path: "src/db/repository.js"
      issue: "recurrentExpenseRepository.getByMonth correctly returns all records but is bypassed by calculateBalanceChain"
    - path: "src/utils/finance.test.js"
      issue: "No test covers projection with a recurrent expense whose nextDate is in current month but not future months"
  missing:
    - "For projected months, fetch all monthly-frequency recurrent expenses instead of filtering by nextDate"
    - "Add test: recurrent expense with nextDate in month M still deducts in projected month M+1"

- truth: "Balance card and chart update immediately after adding/editing income without tab switch"
  status: failed
  reason: "User reported: It does not automatically update it, only when change tabs."
  severity: major
  test: 6
  root_cause: "triggerBalanceRecalc (repository.js lines 20-43) recalculates snapshots in IndexedDB but never dispatches app:refresh, so the DOM is only updated when the tab-switch handler calls refreshDashboard(). The window app:refresh listener already exists in app.js and would re-render if dispatched."
  artifacts:
    - path: "src/db/repository.js"
      issue: "triggerBalanceRecalc never dispatches CustomEvent('app:refresh') after calculateBalanceChain resolves"
  missing:
    - "After calculateBalanceChain call in triggerBalanceRecalc, dispatch window.dispatchEvent(new CustomEvent('app:refresh'))"
