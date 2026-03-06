# Roadmap: Budget App v2.2

## Goal
Navigation overhaul, Dashboard redesign, and critical Debt management bug fixes.

## Phases

### Phase 1: Navigation Restructure
**Goal**: Move Dashboard to a tab and update the layout/shell structure.
- [x] NAV-01: Restructure `index.html` (move Dashboard HTML, update tabs).
- [x] NAV-02: Update `src/app.js` (tab logic, default active state).
- [x] NAV-03: Update `css/main.css` (tab styling, mobile menu).

### Phase 2: Graph — Daily Granularity
**Goal**: Update the Rolling Overview chart to show 365 days of daily balance data.
- [x] DASH-01: Implement `getDailyRollingData` in `src/db/repository.js`.
- [x] DASH-02: Update `renderRollingOverviewChart` in `src/ui/charts.js`.
- [x] DASH-03: Ensure cumulative running total and forecast/historical distinction.

### Phase 3: Period Selector & Summary Boxes
**Goal**: Redesign the summary grid and integrate banners.
- [x] DASH-04: Implement new Month Navigator widget.
- [x] DASH-05: Update `renderDashboard` in `src/ui/dashboard.js` with new order and consolidated data.
- [x] DASH-06: Remove standalone banner functions.
- [x] DASH-07: Implement "Next Negative" warning on Balance box.

### Phase 4: Set Current Balance & Per-Tab Summaries
**Goal**: Implement the reconciliation edit button and tab-specific banners.
- [x] NAV-08: Add balance edit icon to Dashboard.
- [x] TAB-04: Implement `renderTabSummary` utility.
- [x] TAB-05: Integrate summaries into Income, Expenses, Debts, Assets, Childcare tabs.

### Phase 5: Debts Tab — Statement & PDF Bug Fixes
**Goal**: Fix regressions in debt statement management.
- [x] FIX-01: Fix statement history rendering and visibility.
- [x] FIX-02: Fix "Log Statement" form handler.
- [x] FIX-03: Restore PDF import pipeline for debt statements.

### Phase 6: Polish & Verification
**Goal**: Final styling and cross-browser/mobile verification.
- [x] UI-01: Spacing and CSS polish.
- [x] TEST-01: Verify all 31 finance tests pass.
- [x] UAT-01: Full manual walkthrough.

## Milestone v2.2 Stabilization — Stabilization & Gaps
**Goal**: Restore accuracy, fix regressions, and cleanup initialization logic.

### Phase 7: Restore Cashflow Core
**Goal**: Re-implement deleted utility functions and fix the test suite.
- [x] TECH-01: Restore `fetchHolidays`, `isWorkingDay`, `nextWorkingDay` to `src/utils/cashflow.js`.
- [x] TECH-02: Restore `calculateForecast` and `generateExpectedIncomePredictions`.
- [x] TEST-02: Fix `src/utils/cashflow.test.js` and verify all 140+ tests pass.

### Phase 8: Forecast Accuracy
**Goal**: Inject holiday/weekend awareness into the new Rolling Data aggregator.
- [x] ACC-01: Update `getDailyRollingData` to use `nextWorkingDay` for projected recurrent items.
- [x] ACC-02: Ensure consistent balance logic between `calculateBalanceChain` and the Rolling graph.

### Phase 9: UI Restoration & Initialization Cleanup
**Goal**: Bring back missing UI features and refactor app.js.
- [x] UI-03: Restore 90-day daily forecast table as a toggle on the Dashboard tab.
- [x] CLEAN-01: Consolidate rendering logic in `src/app.js` and parallelize `init()` sequence.
- [x] CLEAN-02: Improve mobile navigation menu UX and robustness.
- [x] UI-04: Restore Payoff Planner per-card breakdown and fix chart scaling.

## Completed Milestones
- [x] v2.2: Navigation Overhaul, Dashboard Redesign, and Debt Bug Fixes (2026-03-05)
- [x] v2.1: Advanced Refinements & Security (2026-03-04)
- [x] v1.5: Automatic Recurring Transactions (2026-03-03)
- [x] v1.4: Local File Persistence (2026-03-02)
- [x] v1.3: Enhanced Debt Management (2026-03-02)
- [x] v1.2: Daily Cash Flow Engine (2026-03-02)
- [x] v1.1: UX Refinement & CRUD Hardening (2026-03-02)
- [x] v1.0: Modular Rebuild & Foundation (2026-03-01)
