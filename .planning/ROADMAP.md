# Roadmap: Budget App

## Milestones

- ✅ **v2.3 Advanced Analytics & Mobile Polish** — Phases 1-7 (shipped 2026-03-07)
- ✅ **v2.4 UX Polish & Spending Insights** — Phases 8-10 (shipped 2026-03-07)

## Phases

<details>
<summary>✅ v2.3 Advanced Analytics & Mobile Polish (Phases 1-7) — SHIPPED 2026-03-07</summary>

- [x] Phase 1: Integrity (Reconciliation) (3/3 plans) — completed 2026-03-06
- [x] Phase 2: Insights (Analytics) (4/4 plans) — completed 2026-03-06
- [x] Phase 3: Mobile Polish (UX) (5/5 plans) — completed 2026-03-06
- [x] Phase 4: Privacy Hardening & Dashboard Layout (2/2 plans) — completed 2026-03-06
- [x] Phase 5: Forecast & Graph Alignment (2/2 plans) — completed 2026-03-06
- [x] Phase 6: Rolling Overview - Income/Expense Bars & Binning (3/3 plans) — completed 2026-03-06
- [x] Phase 7: Code Inconsistencies & Inefficiencies (3/3 plans) — completed 2026-03-07

Full archive: `.planning/milestones/v2.3-ROADMAP.md`

</details>

<details>
<summary>✅ v2.4 UX Polish & Spending Insights (Phases 8-10) — SHIPPED 2026-03-07</summary>

- [x] Phase 8: Haptic Feedback (3/3 plans) — completed 2026-03-07
- [x] Phase 9: Swipe Gesture System (3/3 plans) — completed 2026-03-07
- [x] Phase 10: Spending Heatmap (2/2 plans) — completed 2026-03-07

</details>

### ✅ v2.4 UX Polish & Spending Insights (Complete)

**Milestone Goal:** Implement the three deferred v2.3 items — haptic feedback infrastructure, swipe gestures on transaction rows, and a GitHub-style spending heatmap on the Dashboard.

- [x] **Phase 8: Haptic Feedback** — Utility module + all data-mutating action sites wired to named haptic patterns
- [x] **Phase 9: Swipe Gesture System** — Delegated swipe-to-delete and swipe-to-clear on Expenses rows with visual affordances
- [x] **Phase 10: Spending Heatmap** — 52×7 canvas heatmap on Dashboard with tooltip, Privacy Mode integration, and Y-o-Y grid

## Phase Details

### Phase 8: Haptic Feedback
**Goal**: Users receive tactile confirmation on every data-mutating action and a distinct error pulse on form validation failures
**Depends on**: Nothing (leaf dependency — first phase of v2.4)
**Requirements**: HAP-01, HAP-02, HAP-03
**Success Criteria** (what must be TRUE):
  1. Saving a transaction, income entry, or debt produces a short vibration on Android; no error or pause on iOS
  2. Deleting a row produces a distinct vibration pattern different from a save
  3. Toggling a status (e.g. cleared/reconciled) produces a tap-length haptic
  4. Submitting a form with a validation error produces a distinctive error-pulse haptic, not the success pattern
  5. All haptic calls go through `src/utils/haptics.js`; no direct `navigator.vibrate` calls exist elsewhere in the codebase
**Plans**:
- [x] 08-01: Establish the haptic feedback infrastructure and settings UI — completed 2026-03-07
- [x] 08-02: Integrate haptic feedback into Expenses, Income, and Privacy Mode — completed 2026-03-07
- [x] 08-03: Integrate haptic feedback into all remaining secondary data-mutating actions — completed 2026-03-07

### Phase 9: Swipe Gesture System
**Goal**: Users can swipe Expenses rows to delete or clear them without touching secondary buttons, with the gesture behaving correctly on mobile hardware
**Depends on**: Phase 8 (haptics.js must exist for threshold-cross and completion pulses)
**Requirements**: SWP-01, SWP-02, SWP-03, SWP-04, SWP-05
**Success Criteria** (what must be TRUE):
  1. Left-swiping an Expenses row reveals a red delete affordance; tapping it deletes the row (a second deliberate tap is required — not a ghost click)
  2. Right-swiping an Expenses row in Reconciliation mode reveals a green clear affordance; tapping it marks the row cleared
  3. Reconciled or locked rows do not move or respond when swiped
  4. Releasing a swipe below the gesture threshold snaps the row back to its original position with no action taken
  5. Swiping works correctly on a real iOS or Android device (not only Chrome DevTools emulation), with no accidental deletes from iOS back-gesture edge conflicts
**Plans**:
- [x] 09-01: Establish the infrastructure for swipe gestures including a reusable SwipeHandler utility, CSS affordances, and haptic refinements. — completed 2026-03-07
- [x] 09-02: Integrate swipe-to-delete into the Expenses tab. — completed 2026-03-07
- [x] 09-03: Implement right-swipe to clear and refine the gesture experience for mobile. — completed 2026-03-07
### Phase 10: Spending Heatmap
**Goal**: The Dashboard displays a visual spending heatmap that lets users see their spending density across the year at a glance, with Privacy Mode and year-over-year support
**Depends on**: Nothing (independent of Phase 9; can be worked in parallel after Phase 8)
**Requirements**: HMP-01, HMP-02, HMP-03, HMP-04
**Success Criteria** (what must be TRUE):
  1. The Dashboard shows a 52-column by 7-row heatmap grid for the current calendar year where cell color intensity reflects daily spending via a quartile scale
  2. Tapping or hovering a heatmap cell shows a tooltip displaying the date, the total spend for that day, and the top spending category
  3. Activating Privacy Mode blurs the heatmap canvas alongside the existing summary cards
  4. When 13 or more months of expense records exist, a second heatmap grid for the prior year appears beneath the current-year grid using the same shared color scale; when fewer records exist the prior-year grid is hidden
**Plans**:
- [x] 10-01: Establish the infrastructure for the spending heatmap including data aggregation, a reusable HeatmapRenderer utility, and basic Dashboard integration. — completed 2026-03-07
- [x] 10-02: Implement interactivity (tooltips) and advanced features (Year-over-Year grid, Privacy Mode integration). — completed 2026-03-07

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
| ----- | --------- | -------------- | ------ | --------- |
| 1. Integrity (Reconciliation) | v2.3 | 3/3 | Complete | 2026-03-06 |
| 2. Insights (Analytics) | v2.3 | 4/4 | Complete | 2026-03-06 |
| 3. Mobile Polish (UX) | v2.3 | 5/5 | Complete | 2026-03-06 |
| 4. Privacy Hardening & Dashboard Layout | v2.3 | 2/2 | Complete | 2026-03-06 |
| 5. Forecast & Graph Alignment | v2.3 | 2/2 | Complete | 2026-03-06 |
| 6. Rolling Overview - Income/Expense Bars & Binning | v2.3 | 3/3 | Complete | 2026-03-06 |
| 7. Code Inconsistencies & Inefficiencies | v2.3 | 3/3 | Complete | 2026-03-07 |
| 8. Haptic Feedback | v2.4 | 3/3 | Complete | 2026-03-07 |
| 9. Swipe Gesture System | v2.4 | 3/3 | Complete | 2026-03-07 |
| 10. Spending Heatmap | v2.4 | 2/2 | Complete | 2026-03-07 |
