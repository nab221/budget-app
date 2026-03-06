# Roadmap: Milestone v2.3 — Advanced Analytics & Mobile Polish

## Phases
- [x] **Phase 1: Integrity (Reconciliation)** - Implement the "Cleared" vs "Reconciled" lifecycle for matching digital ledger to bank reality.
- [x] **Phase 2: Insights (Analytics)** - Build the "Insights" engine on the Dashboard with category breakdowns and net worth trends.
- [x] **Phase 3: Mobile Polish (UX)** - Refine the PWA experience for thumb-zone navigation, privacy, and tactile interaction.

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

## Progress Table
| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Integrity (Reconciliation) | 1/1 | Completed | 2026-03-06 |
| 2. Insights (Analytics) | 1/1 | Completed | 2026-03-06 |
| 3. Mobile Polish (UX) | 1/1 | Completed | 2026-03-06 |
