---
phase: 09-tax-free-childcare-tracker
plan: 02
subsystem: ui
tags: [childcare, tfc, dashboard, expenses, ui, badge, funding-gap]
dependency_graph:
  requires: [src/utils/childcare.js, childcareRepository, src/db/schema.js@v7]
  provides: [src/ui/childcare.js, childcare tab, TFC dashboard card, TFC expense badge]
  affects: [src/ui/dashboard.js, src/ui/expenses.js, src/db/repository.js, src/app.js, index.html]
tech_stack:
  added: []
  patterns:
    - safeHTML template tag used for all dynamic HTML generation (DOMPurify)
    - formatGBP used for all monetary display
    - Window-scoped handler pattern for onclick in innerHTML rows (childcareViewLedger, childcareDeleteAccount)
    - childcareUI._activeAccountId tracks ledger vs account-list view state
    - getDashboardData async-maps childcareAccounts to include balances in totalAssets
key_files:
  created:
    - src/ui/childcare.js
  modified:
    - index.html
    - src/app.js
    - src/db/repository.js
    - src/ui/dashboard.js
    - src/ui/expenses.js
decisions:
  - "childcareSummary returned from getDashboardData so dashboard.js receives pre-computed gap/suggestedDeposit without a second DB round-trip"
  - "renderChildcareFunding inserts its section before the existing grid2 (Budget Progress / Net Worth History) by DOM insertion, not a static HTML placeholder"
  - "Deposit topUpMsg uses explicit pence conversion (amount * 100 * 0.25) to avoid confusion between pounds and pence in alert feedback"
  - "Childcare Assets card only shown when childcareSummary.length > 0 to avoid cluttering the dashboard for users who have not set up TFC accounts"
metrics:
  duration: 475s
  completed_date: "2026-03-01"
  tasks_completed: 3
  files_changed: 6
---

# Phase 09 Plan 02: TFC UI, Dashboard & Expense Integration Summary

**One-liner:** Childcare tab with account/ledger management, dashboard funding-gap cards with reconfirmation alerts, and Tax-free Childcare badge on one-off expenses.

## What Was Built

Three UI deliverables completing the Tax-Free Childcare tracker feature:

1. **Childcare UI Module** (`src/ui/childcare.js`):
   - `renderAccounts()`: Shows per-account cards with current balance, funding gap, top-up suggestion, and reconfirmation alert (when entitlement period ends within 7 days).
   - `renderLedger(accountId)`: Chronological table of all entries (Deposit, Gov Top-up, Spend) with running balances and type-coloured badges.
   - Forms: "Add Account" (child name, target monthly spend, entitlement start, disabled flag), "Log Deposit" (date, amount, category — defaults to today + Childcare category), "Log Spend" (date, amount, provider description).
   - Delete Account with two-part confirmation warning about permanent ledger loss.

2. **Dashboard & Expense Integration** (`src/db/repository.js`, `src/ui/dashboard.js`, `src/ui/expenses.js`):
   - `getDashboardData` fetches all childcare accounts, gets balances via `childcareRepository.getBalance`, adds sum to `totalAssets` so Net Worth correctly includes TFC funds, and returns `childcareSummary` with pre-computed `gap`/`suggestedDeposit`.
   - Dashboard renders a "Childcare Assets" summary card (visible only when accounts exist) and a "Childcare Funding" section showing per-child balance vs target with funding gap guidance.
   - `renderChildcareFunding` shows reconfirmation badges on the dashboard when entitlement period ends within 7 days.
   - One-off expense rows display a blue "Tax-free Childcare" pill badge when the note starts with `"Tax-free Childcare:"`.

3. **UX Polish** (`src/ui/childcare.js`):
   - Removed unused `toPence` import; clarified deposit-to-pence conversion comment.
   - All monetary values consistently use `formatGBP`.
   - `safeHTML` applied to all ledger row rendering.

## Task Completion

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Childcare UI Module | 31594ef | src/ui/childcare.js, index.html, src/app.js |
| 2 | Dashboard & Expense Integration | 0c6b251 | src/db/repository.js, src/ui/dashboard.js, src/ui/expenses.js |
| 3 | UX Polish & Final Wiring | 2b08ed6 | src/ui/childcare.js |

## Key Decisions Made

- **childcareSummary in getDashboardData**: Pre-computed in the repository layer so dashboard.js gets gap/suggestedDeposit without a second async round-trip per account.
- **Childcare Assets card conditional**: Only rendered when `childcareSummary.length > 0` — avoids cluttering the summary grid for users without TFC accounts.
- **DOM insertion for Childcare Funding section**: `renderChildcareFunding` inserts before the existing `grid2` element dynamically rather than requiring a static placeholder in HTML — keeps index.html clean.
- **Window-scoped row handlers**: `childcareViewLedger` and `childcareDeleteAccount` follow the existing project pattern (used by `deleteOneOffExpense`, `toggleRecurrentStatus`, etc.) for onclick attributes in innerHTML-rendered rows.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- All 52 unit tests pass (`npx vitest run`) — no regressions.
- Production build succeeds: `npx vite build` (0 errors, chunk size warning pre-existing).
- Build confirms imports resolve correctly across all 6 modified files.

## Self-Check: PASSED
