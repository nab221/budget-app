# Requirements: Budget App

**Defined:** 2026-03-07
**Milestone:** v2.4 — UX Polish & Spending Insights
**Core Value:** A personal budget tracker that helps a UK household track income, expenses, debts, assets, and forecast cash flow — fully offline, PWA-ready, no server required.

## v2.4 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Haptic Feedback

- [ ] **HAP-01**: App triggers haptic feedback (`navigator.vibrate`) on all data-mutating actions (save, delete, status toggle) — silent no-op on iOS
- [ ] **HAP-02**: App triggers haptic error pulse on form validation failures
- [ ] **HAP-03**: `src/utils/haptics.js` provides named patterns (`tap`, `success`, `delete`, `error`) with a single feature-detect guard

### Swipe Gestures

- [ ] **SWP-01**: `src/utils/swipe.js` provides a `SwipeManager` class with delegated touch handlers on `<tbody>` containers (avoids listener leak on row re-render)
- [ ] **SWP-02**: User can left-swipe an Expenses row to reveal a delete affordance (red background + trash icon); explicit tap on the revealed button confirms delete
- [ ] **SWP-03**: User can right-swipe an Expenses row in Reconciliation mode to mark it as cleared (green reveal + check icon)
- [ ] **SWP-04**: Reconciled/locked rows do not respond to swipe gestures
- [ ] **SWP-05**: Sub-threshold swipe snaps the row back to its original position

### Spending Heatmap

- [ ] **HMP-01**: Dashboard displays a 52×7 spending heatmap for the current year (GitHub-style grid, custom canvas renderer, quartile color scale)
- [ ] **HMP-02**: Tapping/hovering a heatmap cell shows a tooltip with date, daily spend total, and top category
- [ ] **HMP-03**: Heatmap canvas blurs when Privacy Mode is active
- [ ] **HMP-04**: Dashboard displays a second heatmap grid for the prior year when 13+ months of expense records exist (shared color scale, hidden otherwise)

## Future Requirements (v2.5+)

### Swipe (deferred)

- **SWP-F1**: Swipe-to-delete on Income tab rows (copy pattern from Expenses after validation)

### Heatmap (deferred)

- **HMP-F1**: Category-filtered heatmap view (requires filter UI addition — high cost, low priority)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Swipe on reconciled rows | Data integrity — reconciled rows must not be accidentally modified via gesture |
| chartjs-chart-matrix plugin | Chart.js plugin risk confirmed in codebase history; custom canvas is sufficient and has zero new dependencies |
| Continuous/long haptic patterns | Annoying and battery-draining; all patterns kept under 150ms |
| Haptics on passive/read-only actions | Navigation, filter, search — no haptic feedback to avoid noise |
| Y-o-Y heatmap as single overlaid grid | Color intensity encoding breaks when two datasets share the same cells — must use stacked grids |
| Swipe on Income rows (v2.4) | Deferred to validate Expenses swipe pattern first |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| HAP-01 | — | Pending |
| HAP-02 | — | Pending |
| HAP-03 | — | Pending |
| SWP-01 | — | Pending |
| SWP-02 | — | Pending |
| SWP-03 | — | Pending |
| SWP-04 | — | Pending |
| SWP-05 | — | Pending |
| HMP-01 | — | Pending |
| HMP-02 | — | Pending |
| HMP-03 | — | Pending |
| HMP-04 | — | Pending |

**Coverage:**
- v2.4 requirements: 12 total
- Mapped to phases: 0
- Unmapped: 12 ⚠️

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-07 after initial definition*
