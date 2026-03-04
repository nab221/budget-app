# Roadmap: Budget App v2.0

## Goal
Major UI simplification and logic refactoring to clean up legacy patterns, merge redundant visualizations, and formalize debt types.

## Phases
- [ ] **Phase 1: Header & Banner Cleanup** - Ensure UI state reflects true persistence status and clarify data management actions.
- [ ] **Phase 2: Dashboard Chart Merge & Simplification** - Single "Rolling Financial Overview" chart with historical/forecast distinction.
- [ ] **Phase 3: Dashboard Summary Panels Rework** - Surface high-level financial health metrics including debt obligations and balance.
- [ ] **Phase 4: Expense Simplification** - Consolidate expense tracking into a single, unified workflow.
- [ ] **Phase 5: Debt Type Separation (Schema + Logic)** - Formalize different debt types and their specific financial behaviors.
- [ ] **Phase 6: Debts Panel UX** - Improve debt management efficiency through better layout and ledger access.
- [ ] **Phase 7: Payoff Planner Separation** - Tailored payoff strategies for revolving credit vs. fixed-term loans.
- [ ] **Phase 8: Childcare Tab UX** - Simplify childcare account management with ledger-based interactions.
- [ ] **Phase 9: Remove Cash Flow Tab & Income Import** - Eliminate redundant features to streamline the interface.
- [ ] **Phase 10: Current Account Balance & Offset** - Enable reconciliation between digital ledger and real-world bank balance.

## Phase Details

### Phase 1: Header & Banner Cleanup
**Goal**: Ensure UI state reflects true persistence status and clarify data management actions.
**Depends on**: Nothing
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05
**Success Criteria**:
  1. Persistence banner only appears when `ensurePersistence()` is false AND no file-sync handle is active.
  2. DB reset button is renamed to "🗑 Clear All Data" and shows a confirmation dialog.
  3. Disconnect button is renamed to "🔗 Disconnect File" with secondary styling and confirmation.
  4. Header hint text dynamically updates based on file-sync status.
**Plans**:
- [ ] 01-01-PLAN.md — Header & Banner UI updates

### Phase 2: Dashboard Chart Merge & Simplification
**Goal**: Provide a single, clear visual overview of financial trends and forecasts.
**Depends on**: Phase 1
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07
**Success Criteria**:
  1. Single "Rolling Financial Overview" chart replaces two separate charts.
  2. Chart displays 9 months of history and 2 months of forecast around the current month.
  3. Chart distinguishes between historical (solid) and forecast (dashed) data.
  4. Redundant dashboard sections (daily cards, net worth history) are removed.
**Plans**:
- [ ] 02-01-PLAN.md — Data Logic & HTML Update
- [ ] 02-02-PLAN.md — Chart Rendering & Dashboard Integration

### Phase 3: Dashboard Summary Panels Rework
**Goal**: Surface high-level financial health metrics including debt obligations and balance.
**Depends on**: Phase 2
**Requirements**: DASH-08, DASH-09, DASH-10, DASH-11, DASH-12
**Success Criteria**:
  1. Summary grid is simplified (Income, Expenses, Net Position).
  2. New "Credit Card Payments" and "Loan & Mortgage Payments" panels show £ and % of income.
  3. "Current Balance" panel shows today's projected balance.
  4. "Next Negative" alert is visible only when a future balance dip is detected.
**Plans**: TBD

### Phase 4: Expense Simplification
**Goal**: Consolidate expense tracking into a single, unified workflow.
**Depends on**: Phase 1
**Requirements**: EXP-01, EXP-02, EXP-03
**Success Criteria**:
  1. Expenses tab displays a single list without sub-tabs.
  2. One-off expenses are merged into the main list as single-occurrence items.
  3. Variable/Fixed distinctions are removed from charts and UI.
**Plans**: TBD

### Phase 5: Debt Type Separation (Schema + Logic)
**Goal**: Formalize different debt types and their specific financial behaviors.
**Depends on**: Phase 4
**Requirements**: DEBT-01, DEBT-02, DEBT-03, DEBT-04
**Success Criteria**:
  1. Database schema updated to v13 with `debtType` field.
  2. Existing debts are migrated correctly to types.
  3. Loan/Mortgage payments automatically appear in the expenses list with distinct icons.
  4. New fields (principal, term, fixed payment) are accessible in the debt form.
**Plans**: TBD

### Phase 6: Debts Panel UX
**Goal**: Improve debt management efficiency through better layout and ledger access.
**Depends on**: Phase 5
**Requirements**: [DEBT-05, DEBT-06, DEBT-07]
**Success Criteria**:
  1. Debt cards are grouped visually by type.
  2. Clicking a debt card opens its statement history/ledger inline.
  3. Edit/Delete buttons are collocated in the card header.
**Plans**: 2 plans
- [ ] 06-01-PLAN.md — Debts Panel Structure & Grouping
- [ ] 06-02-PLAN.md — Inline Ledger & Lifecycle

### Phase 7: Payoff Planner Separation
**Goal**: Provide tailored payoff strategies for revolving credit vs. fixed-term loans.
**Depends on**: Phase 6
**Requirements**: DEBT-08, DEBT-09, DEBT-10
**Success Criteria**:
  1. Payoff planner is split into Credit Card and Loan/Mortgage sections.
  2. Credit card section retains multi-strategy logic (avalanche/snowball).
  3. Loan/Mortgage section handles principal reduction and early repayment fees.
**Plans**: TBD

### Phase 8: Childcare Tab UX
**Goal**: Simplify childcare account management with ledger-based interactions.
**Depends on**: Phase 1
**Requirements**: CHILD-01, CHILD-02, CHILD-03
**Success Criteria**:
  1. Childcare card click opens ledger view inline.
  2. Opening balance field correctly initializes the running total in the ledger.
  3. Edit functionality is easily accessible from the ledger view.
**Plans**: TBD

### Phase 9: Remove Cash Flow Tab & Income Import
**Goal**: Eliminate redundant or confusing features to streamline the interface.
**Depends on**: Phase 1, Phase 2 (for Cash Flow chart removal)
**Requirements**: UI-06, UI-07
**Success Criteria**:
  1. "Cash Flow" tab is no longer present in the application.
  2. "Import Bank Statement" button is removed from the Income tab.
**Plans**: TBD

### Phase 10: Current Account Balance & Offset
**Goal**: Enable users to reconcile the digital ledger with their real-world bank balance.
**Depends on**: Phase 3, Phase 4
**Requirements**: BAL-01, BAL-02, BAL-03
**Success Criteria**:
  1. "Set Current Balance" button is available on Income and Expenses tabs.
  2. Entering a balance creates an automatic "Balance Adjustment" entry to reconcile the totals.
  3. Dashboard reflects the adjusted balance in the "Current Balance" panel.
**Plans**: TBD

## Progress Table
| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Header & Banner Cleanup | 1/1 | Not started | - |
| 2. Dashboard Chart Merge & Simplification | 2/2 | Not started | - |
| 3. Dashboard Summary Panels Rework | 0/0 | Not started | - |
| 4. Expense Simplification | 0/0 | Not started | - |
| 5. Debt Type Separation (Schema + Logic) | 0/0 | Not started | - |
| 6. Debts Panel UX | 0/2 | Not started | - |
| 7. Payoff Planner Separation | 0/0 | Not started | - |
| 8. Childcare Tab UX | 0/0 | Not started | - |
| 9. Remove Cash Flow Tab & Income Import | 0/0 | Not started | - |
| 10. Current Account Balance & Offset | 0/0 | Not started | - |

## Milestone v2.1: Advanced Refinements & Security
Focused on finalizing the v2.0 architecture by addressing security fallbacks, persistence UX polish, and high-fidelity payoff calculations.

| Phase | Plans | Status | Completed |
|-------|-------|--------|-----------|
| 2.1.1 Security & Persistence UX Polish | 1/1 | Completed | 2026-03-04 |
| 2.1.2 Advanced Debt & Payoff Logic | 0/0 | Not started | - |
| 2.1.3 Power-User Utilities | 0/0 | Not started | - |
| 2.1.4 Legacy UI Cleanup & Final Parity | 0/0 | Not started | - |
