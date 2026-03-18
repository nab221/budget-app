# Phase 36: Navigator & View Toggle Redesign - Research

Researched: 2026-03-15
Domain: Dashboard navigation UX, accessibility interactions, mobile sticky/fixed layout behavior
Confidence: HIGH

## User Constraints

Locked by Phase 36 scope and requirements:
- Replace dashboard view selector with a segmented control for This Month, Year to Date, and All Time.
- Keep pay-period style navigation visible without scrolling on desktop and mobile.
- Preserve NAV-03 heatmap year-boundary behavior while doing the redesign.
- Meet MOB-02 and MOB-03 mobile expectations without regressing existing mobile bottom navigation.

Out of scope for this phase:
- New affordability engine implementation work from Phase 34.
- Non-navigation dashboard feature expansions.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NAV-02 | Navigator always fixed/visible | Existing sticky/fixed and z-index stack analyzed; safe hook points identified in dashboard picker container and month-nav class usage. |
| NAV-03 | Heatmap year-boundary fix | Dashboard already requests yearly filtered data by selected month year; seam and regression checks identified. |
| MOB-03 | Modern segmented view toggle | Current select wiring and render state contract identified for drop-in segmented control integration. |
| MOB-02 | Mobile fixed top nav/pay-period bar | Existing mobile fixed bottom nav and header behavior analyzed for collision and padding strategy. |

## Key Findings

1. Current dashboard view toggle is a select element, not a segmented control.
- Markup uses id="viewSelect" with values current/ytd/all.
- Dashboard init binds only a change listener and sets _selectedView from select value.
- This creates a clean seam to replace the input UI while keeping _selectedView and renderDashboard() contract intact.

2. Dashboard month navigator seam exists and is colocated with view toggle, but no pay-period navigator implementation exists in runtime code.
- Existing container id="dashboardMonthPicker" is rendered each dashboard refresh via renderMonthNavigator().
- Existing invariant test enforces proximity/order between dashboardMonthPicker and viewSelect.
- No pay-period container/id/module is present in src code yet; Phase 34 appears present in planning docs but not implemented in current codebase.

3. Heatmap year-boundary risk is currently low but still regression-prone during navigator refactor.
- Dashboard derives year from _selectedMonth and calls getYearlyDailyIncome(year)/getYearlyDailySpending(year).
- Heatmap unit tests currently cover date keying and CSS var color resolution, but not dashboard-level year switching behavior.

4. Keyboard interaction patterns in the app are minimal and should inform Phase 36 accessibility expectations.
- Current view toggle provides native keyboard behavior only because it is a select.
- Existing custom UI keyboard patterns are limited (Escape to close modal, Enter on some form inputs).
- There is no existing app-wide arrow-key roving focus pattern to reuse, so segmented control keyboard behavior should be self-contained.

5. Mobile layering has known constraints that affect fixed navigator implementation.
- Header is sticky with z-index 100.
- Mobile bottom nav container is fixed with z-index 1000.
- Modal overlay is z-index 1000; notifications are z-index 10000.
- Existing month-nav mobile style is sticky top var(--header-height) with z-index 99.
- A new fixed top dashboard navigator must avoid content occlusion and avoid colliding with bottom bar and overlays.

6. Test seams already exist for dashboard markup invariants and can be extended cheaply.
- dashboard.invariant.test.js already validates ordering and proximity involving dashboardMonthPicker and viewSelect.
- This is the lowest-risk place to codify segmented-control placement and legacy select removal.

## Assumptions To Carry Into Planning

1. Keep _selectedView values and semantics as current | ytd | all to avoid repository contract churn.
2. Preserve renderDashboard() as the single refresh point after navigation or view changes.
3. Reuse dashboardMonthPicker area as the integration seam for segmented control + navigator container composition.
4. Treat pay-period navigator as a layout shell in this phase unless a concrete Phase 34 runtime component is discovered during implementation.
5. Keep heatmap year source tied to _selectedMonth until dedicated pay-period date-state is fully implemented.
6. On mobile, fixed top navigator needs explicit dashboard content offset/padding to prevent hidden first content block.
7. Existing bottom nav (z-index 1000) remains authoritative on mobile; top navigator must not exceed it unless intentionally required.

## Anti-Patterns To Avoid

- Replacing _selectedView with new enum/string values and breaking getDashboardData period mapping.
- Implementing segmented control as click-only UI without ArrowLeft/ArrowRight and Enter/Space support.
- Mounting fixed mobile navigator globally for all tabs when only dashboard requires it.
- Introducing hardcoded top offsets detached from actual header height behavior.
- Raising navigator z-index above modals/notifications and causing overlay regressions.
- Deleting or bypassing dashboard invariant tests instead of updating them for new markup.
- Coupling segmented control component directly to repository/data-fetch code.

## Confirmed Module/Component Interfaces For Segmented Control Integration

1. Dashboard state and render contract (confirmed)
- Module state in src/ui/dashboard.js:
  - _selectedMonth: string (YYYY-MM)
  - _selectedView: one of current | ytd | all
- initDashboard(): currently wires view control and calls first render.
- renderDashboard(): authoritative rerender entry point.
- Integration requirement: segmented control must set _selectedView then call renderDashboard().

2. Existing DOM seam (confirmed)
- index.html dashboard control row currently hosts:
  - #dashboardMonthPicker container
  - #viewSelect control
- Integration requirement: preserve a stable control row seam so existing layout and tests can be evolved safely.

3. Proposed segmented control component contract (planning-safe)
- New file: src/ui/components/segmented-control.js
- Suggested API:
  - createSegmentedControl({
      container,
      name,
      options, // [{ value, label }]
      value,
      onChange
    })
- Behavior contract:
  - Emits onChange(nextValue) on click/tap activation.
  - Supports ArrowLeft/ArrowRight focus movement and Enter/Space activation.
  - Uses ARIA radio-group semantics (radiogroup + radio + aria-checked) or tablist pattern consistently.

4. Dashboard integration boundary (planning-safe)
- dashboard.js owns mapping logic current -> month for repository period argument.
- segmented-control.js remains a pure UI input component with no repository imports.

## Files To Change With Rationale

1. index.html
- Replace #viewSelect markup with segmented-control mount container in same dashboard controls row.
- Rationale: preserve existing control placement seam and minimize layout churn.

2. src/ui/dashboard.js
- Replace select-specific wiring with segmented control wiring.
- Add show/hide behavior for month navigator in ytd/all modes.
- Add/adjust hook class(es) for fixed/sticky dashboard navigator container behavior.
- Rationale: this file already owns _selectedView, _selectedMonth, and dashboard rerender lifecycle.

3. src/ui/components/segmented-control.js (new)
- Implement reusable segmented control with keyboard and pointer interactions.
- Rationale: isolates accessibility and interaction complexity from dashboard business logic.

4. css/main.css
- Add segmented control styles for active/inactive/focus-visible states.
- Add dashboard-scoped sticky (desktop) and fixed (mobile) navigator container rules.
- Add dashboard content offset/padding rules on mobile.
- Rationale: current file already contains month-nav, header, and bottom-nav layering rules.

5. src/ui/dashboard.invariant.test.js
- Update/add invariants for segmented control placement and removal of legacy select id.
- Rationale: protects layout seam and prevents accidental regression in future phase work.

6. Optional new test file: src/ui/dashboard.view-toggle.test.js
- Unit test segmented control to _selectedView wiring and month navigator visibility rules.
- Rationale: currently missing direct behavior tests for this interaction.

7. Optional new test file: src/ui/components/segmented-control.test.js
- Unit test keyboard behavior (ArrowLeft/ArrowRight, Enter/Space) and aria state transitions.
- Rationale: accessibility behavior is non-trivial and should be verified independently.

## Suggested Test Strategy (Vitest Commands)

Baseline checks before edits:
- npm test -- src/ui/dashboard.invariant.test.js
- npm test -- src/ui/heatmap.test.js

After segmented control integration:
- npm test -- src/ui/dashboard.invariant.test.js src/ui/heatmap.test.js
- npm test -- src/ui/components/segmented-control.test.js
- npm test -- src/ui/dashboard.view-toggle.test.js

Broad UI regression sweep:
- npm test -- src/ui/*.test.js

Full suite gate:
- npm test

## Implementation Notes For Planner

- Keep compatibility with current dashboard period mapping: current -> month, ytd -> ytd, all -> all.
- For mobile fixed top navigator, prefer dashboard-scoped offset (for example on dashboard panel content) rather than global card padding.
- Preserve month picker rendering function for This Month mode and hide it in Year to Date and All Time modes.
- If Phase 34 pay-period runtime UI is discovered during implementation, integrate via composition under the same dashboard navigator shell instead of replacing dashboard month seam.

## Confidence Breakdown

- View toggle seam: HIGH (directly verified in index.html and src/ui/dashboard.js).
- Navigator container reality (Phase 34 seam status): HIGH (no runtime pay-period navigator found in src; only planning artifacts exist).
- Keyboard interaction baseline: HIGH (directly verified across app keyboard listeners).
- Mobile z-index conflict analysis: HIGH (directly verified in css/main.css and notifications runtime styles).
- Test seam quality: MEDIUM-HIGH (existing invariant tests are strong for layout, but behavior tests for view-toggle interactions are currently absent).