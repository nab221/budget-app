# Roadmap: Milestone v2.3 — Advanced Analytics & Mobile Polish

## Phases
- [x] **Phase 1: Integrity (Reconciliation)** - Implement the "Cleared" vs "Reconciled" lifecycle for matching digital ledger to bank reality.
- [x] **Phase 2: Insights (Analytics)** - Build the "Insights" engine on the Dashboard with category breakdowns and net worth trends.
- [x] **Phase 3: Mobile Polish (UX)** - Refine the PWA experience for thumb-zone navigation, privacy, and tactile interaction.
- [x] **Phase 4: Privacy Hardening & Dashboard Layout** - Seal privacy leaks in Dashboard/Planner and optimize component layout.
- [x] **Phase 5: Forecast & Graph Alignment** - Synchronize calculation logic and horizons between charts and tables.
- [x] **Phase 6: Rolling Overview - Income/Expense Bars & Binning** - Implement bar chart visualization for income/expenses with configurable time binning.

## Phase Details

### Phase 1: Integrity (Reconciliation)
**Goal**: Users can trust that their app ledger perfectly matches their bank statements through a formal reconciliation workflow.
**Depends on**: Nothing
**Requirements**: RECO-01, RECO-02, RECO-03, RECO-04, RECO-05, RECO-06, RECO-07
**Success Criteria** (what must be TRUE):
  1. Transaction lists (Income/Expenses) have a "Reconciliation Mode" that exposes clearing controls.
  2. Users can see a real-time "Cleared Balance" as they toggle individual transactions.
  3. "Finalize Reconciliation" successfully marks items as reconciled and visually locks them.
  4. Reconciled items cannot be edited or deleted.
**Status**: COMPLETED (2026-03-06)

### Phase 2: Insights (Analytics)
**Goal**: Users gain actionable understanding of spending patterns and long-term financial trajectory.
**Depends on**: Phase 1
**Requirements**: ANAL-01, ANAL-02, ANAL-03, ANAL-04, ANAL-05
**Success Criteria** (what must be TRUE):
  1. Dashboard displays a Doughnut Chart showing spending by category (Top 5 + Other).
  2. Dashboard shows a "Savings Rate" KPI calculated from actual income and expenses.
  3. Dashboard includes a Net Worth trend chart spanning the last 12 months.
  4. Users can interact with charts (touch/hover) to see precise values and category details.
**Status**: COMPLETED (2026-03-06)

### Phase 3: Mobile Polish (UX)
**Goal**: The app provides a "pro-tier" mobile experience that is easy to navigate one-handed and safe to use in public.
**Depends on**: Phase 1, Phase 2
**Requirements**: UX-01, UX-02, UX-03, UX-04, UX-05
**Success Criteria** (what must be TRUE):
  1. Primary navigation moves to a bottom bar on screens smaller than 768px.
  2. "Privacy Mode" toggle blurs all sensitive monetary values across the entire application.
  3. Users can see icons and labels in the bottom navigation.
**Status**: COMPLETED (2026-03-06)

### Phase 4: Privacy Hardening & Dashboard Layout
**Goal**: Ensure zero information leakage when Privacy Mode is active and polish the Dashboard UX.
**Depends on**: Phase 3
**Requirements**: DASH-01, DASH-02, UX-01
**Plans**: 2 plans
- [x] 04-01-PLAN.md — Privacy Hardening for Dashboard and Payoff Planner
- [x] 04-02-PLAN.md — Dashboard Layout reordering and title cleanup
**Success Criteria**:
  1. Dashboard Summary Cards and Savings KPI are blurred in Privacy Mode.
  2. Payoff Planner tab content is entirely blurred or restricted in Privacy Mode.
  3. Duplicate "Dashboard" title is removed.
  4. Period selector and navigation are moved above the analytics/summary components.
**Status**: COMPLETED (2026-03-06)

### Phase 5: Forecast & Graph Alignment
**Goal**: Resolve data discrepancies between visual charts and detailed forecast tables.
**Depends on**: Phase 4
**Requirements**: DASH-03, FORC-01
**Plans**: 2 plans
- [x] 05-01-PLAN.md — Data Layer & Chart Core
- [x] 05-02-PLAN.md — Dashboard Integration & Alignment
**Success Criteria**:
  1. 'Rolling Financial Overview' chart includes Income and Expenses lines.
  2. Both chart and 'Detailed Forecast' table use a unified 45-day horizon.
  3. Balance calculations are identical between the chart and the table.
**Status**: COMPLETED (2026-03-06)

### Phase 6: Rolling Overview - Income/Expense Bars & Binning
**Goal**: Enhance the Rolling Overview chart with better visual representation of income/expenses and flexible time aggregation.
**Depends on**: Phase 5
**Requirements**: ANAL-04, DASH-04
**Plans**: 2 plans
- [x] 06-01-PLAN.md — Data Layer & Binning Logic
- [x] 06-02-PLAN.md — UI & Mixed Chart
**Success Criteria**:
  1. Income (positive green) and Expenses (negative red) are displayed as a bar chart overlaying the balance line.
  2. A modern radio button group allows toggling between Daily (D), Weekly (W), and Monthly (M) binning.
  3. Chart correctly aggregates totals for each bin period.
  4. Balance line remains correct across all binning modes.
**Status**: COMPLETED (2026-03-06)

## Progress Table
| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Integrity (Reconciliation) | 1/1 | Completed | 2026-03-06 |
| 2. Insights (Analytics) | 1/1 | Completed | 2026-03-06 |
| 3. Mobile Polish (UX) | 1/1 | Completed | 2026-03-06 |
| 4. Privacy Hardening & Dashboard Layout | 2/2 | Completed | 2026-03-06 |
| 5. Forecast & Graph Alignment | 2/2 | Completed | 2026-03-06 |
| 6. Rolling Overview - Income/Expense Bars & Binning | 2/2 | Completed | 2026-03-06 |

### Phase 7: Code Inconsistencies & Inefficiencies

**Goal:** Fix balance engine divergence between getDailyRollingData and calculateForecast, fix recurrent expense nextDate advancement on payment, and remove dead code from Phases 1–6. Exit condition: chart closing balance === table closing balance for the same date.
**Requirements**: none (internal cleanup — no formal REQ-XX IDs)
**Depends on:** Phase 6
**Plans:** 3 plans

Plans:
- [ ] 07-01-PLAN.md — Wave 1: Test scaffolding (advanceNextDate tests + balance equality integration test)
- [ ] 07-02-PLAN.md — Wave 2: Bug fixes (advanceNextDate, markAllAsPaid/recordPayment, balance engine unification)
- [ ] 07-03-PLAN.md — Wave 3: Dead code removal (barForecastPlugin, BarController/BarElement, aggregateRollingOverview, getRollingFinancialData, binning param)
