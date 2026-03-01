---
status: complete
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
  artifacts: []
  missing: []

- truth: "Projected months include recurrent expense deductions (fixed monthly frequency)"
  status: failed
  reason: "User reported: The projection is not considering the recurrent payments out for the following months, even if it is a fixed expense with monthly frequency."
  severity: major
  test: 5
  artifacts: []
  missing: []

- truth: "Balance card and chart update immediately after adding/editing income without tab switch"
  status: failed
  reason: "User reported: It does not automatically update it, only when change tabs."
  severity: major
  test: 6
  artifacts: []
  missing: []
