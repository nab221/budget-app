---
phase: 10-advanced-debt-and-payoff
plan: 02
subsystem: ui-debts-dashboard
tags: [debts, repayment, ui, dashboard, notifications]
requires: [10-01]
provides: [debt-editing-modal, repayment-impact-panel]
affects: [src/ui/debts.js, src/ui/dashboard.js, index.html]
tech-stack: [vanilla-js, html, css]
key-files: [src/ui/debts.js, src/ui/dashboard.js]
decisions:
  - "Edit debt functionality integrated directly into debt cards via click instead of a separate button."
  - "Dashboard panel calculates total repayment as a percentage of income."
  - "Promo expiration alerts implemented directly in the dashboard repayment panel."
metrics:
  duration: 20 min
  completed_date: "2024-05-24T12:00:00Z"
---

# Phase 10 Plan 02: Debt Interest Rate Tracking and Visualization Summary

## One-liner
Implemented debt editing via card-click and enhanced the dashboard with a proactive debt repayment impact panel and promo expiration alerts.

## Implementation Details

- **Debt Editing (`src/ui/debts.js` & `index.html`):**
  - Updated debt cards to be clickable (`cursor: pointer`), removing the need for an explicit "Edit" button.
  - Implemented an "Edit Debt" modal using `templateUI.showModal`.
  - Added new fields for `promoEndDate` and `postPromoApr` to both the add debt form (`index.html`) and the edit debt modal.
  - The modal pre-fills with existing debt data and saves updates via `debtRepository.update`.
  - Updated the debt card UI to display a warning badge when a promotional rate is active, showing the end date and post-promo APR.

- **Dashboard Repayment Panel (`src/ui/dashboard.js`):**
  - Added `renderDebtRepaymentPanel` to display debt metrics below the snapshot grid.
  - Calculates the **Debt Impact %**: `(Total Min Payments + Extra Monthly Payment) / Total Income * 100`.
  - Retrieves "Extra Monthly Payment" from `localStorage` (preference key `payoffExtra`).
  - Implemented "Promo Expiring" alerts:
    - Checks if any debt has a `promoEndDate` within the next 60 days.
    - Renders a warning notification in the panel if expiring debts are found.

## Deviations from Plan
None - plan executed exactly as written.

## Self-Check: PASSED
- [x] Debt cards are clickable and open edit modal.
- [x] Promo dates and post-promo APRs are editable and saved.
- [x] Dashboard shows "(Min + Extra) / Income %" metric.
- [x] 60-day promo expiration warnings appear on dashboard.
- [x] Commits made for each task.

## Commits
- `10ab7e0`: feat(10-02): implement debt editing via card-click and add promo fields
- `00b6f7d`: feat(10-02): add debt repayment impact panel and promo alerts to dashboard
