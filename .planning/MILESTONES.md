# Milestones
## v3.0 Budget Planning Core Redesign (Shipped: 2026-03-18)

**Phases completed:** Phases 27–40 (with 39.1 and 40), 30 plans complete
**Timeline:** 2026-03-14 → 2026-03-18 (5 days)
**Codebase:** ~29,600 LOC (JS + CSS) | 181 files changed | 27,620 lines added
**Tests:** 715 Vitest tests passing (up from 354 at v2.7 baseline)

**Key accomplishments:**
- Built Pay-Period Affordability Engine: balance entry → projected balance → max extra debt payment with collapsible timeline and pay-period navigator
- Delivered full mobile overhaul: fixed bottom tab bar with icons/labels, sticky header, swipe-to-edit/delete on Income and Expenses tables, WCAG-compliant tap targets
- Implemented Banking Calendar utility + recurrence engine working-day support (UK bank holidays, next-working-day adjustment for payment dates)
- Replaced statement-based loan/mortgage tracking with predictive amortisation model (Confirm Balance flow, schedule chart)
- Added configurable Income Sources tab and Spending Buckets; childcare providers integrated into affordability calculation
- Unified Income + Expenses into a single merged Transactions tab (IN/OUT cashflow view, dual heatmaps); removed separate Expenses tab
- Added delta-mode cloud snapshot preview (shows only what changed since last sync)
- Legacy v2.x data import pipeline + data integrity validator running on startup/pull/import

### Known Gaps
Phase 39 ("v3.0 Milestone Verification & Polish") was planned but manual verification (Task 2) was not completed before milestone archive:
- gate-p0-plan02-human: affordability output manual verification against spreadsheet
- gate-p0-mob01 through gate-p0-mob07: cross-device testing (iOS Safari, Android Chrome)
- gate-p0-nav01, gate-p0-nav02, gate-p0-sync01: manual nav/sync checks
- Lighthouse mobile ≥90 score not confirmed
- PWA install prompt not manually confirmed on Android Chrome

All automated P0 gates and all P1 gates (except PLAN-05 and MOB-03 — deferred) passed in `39-01`.

---


## v2.3 Advanced Analytics & Mobile Polish (Shipped: 2026-03-07)

**Phases completed:** 7 phases, 22 plans
**Timeline:** 2026-03-06 → 2026-03-07 (2 days)
**Codebase:** ~12,191 JS LOC

**Key accomplishments:**
- Implemented full Reconciliation workflow with cleared/reconciled lifecycle and padlock UI
- Built Analytics suite: Expenses Doughnut Chart, Savings Rate KPI, and 12-month Net Worth Trend
- Delivered mobile PWA polish: bottom navigation bar, Privacy Mode blur, PWA install icons
- Hardened Privacy Mode to cover Dashboard Summary Cards and Payoff Planner (audit gap fix)
- Unified forecast engine: chart and Detailed Forecast table aligned to 45-day horizon with identical balances
- Improved code quality: advanceNextDate bug fixed, dead bar chart code purged, balance engines unified

### Known Gaps
Requirements deferred to v2.4:
- ANAL-05: Monthly Spending Heatmap / Year-over-Year comparison widget
- UX-03: Swipe-to-clear / swipe-to-delete gesture support for transaction rows
- UX-04: Haptic feedback (`navigator.vibrate`) on key actions

---
