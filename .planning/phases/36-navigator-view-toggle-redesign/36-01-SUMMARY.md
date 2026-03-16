---
phase: 36
plan: "01"
subsystem: dashboard-ui
tags: [segmented-control, view-toggle, accessibility, ARIA, keyboard-nav, CSS, sticky, fixed, TDD]
dependency_graph:
  requires: [35-01]
  provides: [36-01]
  affects: [dashboard-ui, main.css, index.html]
tech_stack:
  added: []
  patterns:
    - WAI-ARIA radiogroup with roving tabindex
    - JS-measured CSS custom property for dynamic layout
    - TDD (RED→GREEN) for UI component
key_files:
  created:
    - src/ui/components/segmented-control.js
    - src/ui/components/segmented-control.test.js
    - src/ui/dashboard.view-toggle.test.js
  modified:
    - src/ui/dashboard.js
    - src/ui/dashboard.invariant.test.js
    - css/main.css
    - index.html
decisions:
  - Arrow keys auto-select (WAI-ARIA radiogroup: focus movement = selection); Enter/Space re-confirms
  - JS measures real rendered header height via getBoundingClientRect() at initDashboard() time and writes --header-height CSS variable; avoids hard-coded height that breaks on toolbar wrapping
  - Desktop navigator: position sticky with top var(--header-height); mobile: position fixed same variable
  - Legacy viewSelect fallback retained in initDashboard for any cached HTML edge-case
  - moveFocus() helper removed from keyboard path; activate() now owns both focus and selection
metrics:
  duration_minutes: ~97
  completed: "2026-03-16"
  tasks_completed: 4
  files_changed: 7
  tests_added: 31
  tests_total: 637
---

# Phase 36 Plan 01: Navigator & View Toggle Redesign Summary

Accessible button-based segmented control replacing the legacy `<select id="viewSelect">`, with sticky/fixed navigator shell that correctly clears the page header on both desktop and mobile.

## What Was Built

### Task 1 — Segmented Control Component (TDD)

`src/ui/components/segmented-control.js` — `createSegmentedControl({ container, name, options, value, onChange })`:
- Mounts a `role="radiogroup"` / `role="radio"` ARIA widget into any container
- Roving tabindex: only the active button is in the tab order (tabIndex=0), others are tabIndex=-1
- WAI-ARIA radiogroup pattern: ArrowLeft/ArrowRight move focus AND auto-select (calling onChange immediately)
- Enter/Space re-confirm the focused/selected button
- Click (pointer) activates the clicked button
- `activate()` centrally manages ARIA checked state, is-active class, tabIndex, `focus()`, and onChange dispatch
- `src/ui/components/segmented-control.test.js`: 5 TDD tests covering render, pointer, keyboard auto-activate, Enter/Space confirm, ARIA sync

### Task 2 — Dashboard Integration

`index.html`: `<select id="viewSelect">` removed; replaced with `<div id="dashboardViewSegmentedControl">` inside a `.dashboard-navigator-shell` wrapper alongside `#dashboardMonthPicker`.

`src/ui/dashboard.js`:
- Imports `createSegmentedControl` from `./components/segmented-control.js`
- `initDashboard()` mounts the segmented control with options: This Month / Year to Date / All Time
- `onChange` callback sets `_selectedView` and calls `renderDashboard()`
- Legacy `viewSelect` fallback retained inside an `else` branch for resilience
- `renderDashboard()` shows/hides `#dashboardMonthPicker` based on `_selectedView === 'current'`

`src/ui/dashboard.invariant.test.js` updated: legacy `viewSelect` assertion replaced with assertion that the segmented control mount is co-located with month picker.

### Task 3 — CSS Styles and Extended Regression Tests

`css/main.css` additions:
- `.segmented-control__btn`: 44px min-height touch target, text/background/shadow transitions
- `.segmented-control__btn.is-active`: card background, accent color, elevation shadow
- `.segmented-control__btn:focus-visible`: 2px accent outline (keyboard accessibility)
- `.dashboard-navigator-shell` (desktop): `position: sticky; top: var(--header-height, 56px); z-index: 98`
- `.dashboard-navigator-shell` (mobile ≤768px): `position: fixed; top: var(--header-height, 56px); z-index: 999; full-width`
- `.tab-panel[data-panel="dashboard"]` (mobile): `padding-top: 72px` to clear fixed navigator

`src/ui/dashboard.view-toggle.test.js` created: 18 tests covering HTML seams, visibility rules, dashboard.js contract, month navigation regression, heatmap year-boundary, CSS sticky/fixed rules, segmented control button styles, focus-visible, mobile padding, z-index hierarchy, and fallback seam safety.

### Task 4 — Checkpoint: Human Verification + Bug Fixes

Manual testing found three issues. All fixed as Rule 1 auto-fixes:

**Bug 1+2: Navigator overlapping header (desktop + mobile)**
- Root cause: desktop CSS used `top: 0` (same as header sticky position), causing the navigator to render on top of the header. On mobile, the hard-coded `--header-height: 56px` didn't account for toolbar wrapping at narrow widths.
- Fix: Changed desktop sticky to `top: var(--header-height, 56px)`. Added JS measurement in `initDashboard()` — `document.querySelector('header').getBoundingClientRect().height` sets `--header-height` at init time with the real rendered value, covering all viewport widths.

**Bug 3: ArrowLeft/ArrowRight not changing the dashboard view**
- Root cause: Arrow key handlers called `moveFocus()` (tabIndex-only roving) without calling `activate()` (which calls onChange). The WAI-ARIA radiogroup specification requires arrow keys to auto-select. Users pressed ArrowRight, saw no change in the dashboard, and concluded keyboard nav was broken.
- Fix: Arrow key handlers now call `activate(nextIdx)` directly. `activate()` now also calls `buttons[focusedIndex].focus()` so focus indicator follows selection.

## Test Coverage

| File | Tests | Description |
|------|-------|-------------|
| `src/ui/components/segmented-control.test.js` | 5 | Render, pointer, keyboard auto-activate + wrapping, Enter/Space confirm, ARIA sync |
| `src/ui/dashboard.view-toggle.test.js` | 18 | HTML seams, visibility, JS contract, CSS rules, keyboard header measurement |
| `src/ui/dashboard.invariant.test.js` | 8 | Layout order, navigator co-location, essential IDs, navigator shell class |

**Total suite: 637 tests passing across 35 test files.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Navigator overlapping/covering header instead of sitting below it**
- Found during: Task 4 (manual verification)
- Issue: Desktop sticky used `top: 0` (matching the header's own `top: 0`), so both header and navigator competed for the same pixel row. Mobile `--header-height: 56px` was a static estimate that doesn't account for toolbar wrapping.
- Fix: CSS changed to `top: var(--header-height, 56px)`; JS in `initDashboard()` sets `--header-height` from `getBoundingClientRect().height` on the header element.
- Files modified: `css/main.css`, `src/ui/dashboard.js`
- Commit: ccbea22

**2. [Rule 1 - Bug] ArrowLeft/ArrowRight moving focus but not changing the selected view**
- Found during: Task 4 (manual verification)
- Issue: Arrow keys called `moveFocus()` (tabIndex only) but not `activate()` (onChange). WAI-ARIA radiogroup pattern requires arrow key press = selection change.
- Fix: Arrow key handlers now call `activate(nextIdx)` directly; `activate()` also calls `.focus()`.
- Files modified: `src/ui/components/segmented-control.js`, `src/ui/components/segmented-control.test.js`
- Commit: ccbea22

## Decisions Made

- Arrow keys auto-select (WAI-ARIA radiogroup: focus movement = selection); Enter/Space re-confirm
- JS measures real rendered header height via `getBoundingClientRect()` at `initDashboard()` time; avoids hard-coded height that breaks on toolbar wrapping at narrow viewport widths
- Desktop navigator: `position: sticky; top: var(--header-height)`; mobile: `position: fixed` same variable; bottom nav z-index (1000) retains precedence over navigator (999)
- Legacy `viewSelect` fallback retained in `initDashboard` for any cached HTML edge-case; guarded by `if (segMount)` null-check
- `moveFocus()` helper removed from keyboard path; `activate()` now owns focus, ARIA state, tabIndex, and onChange

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `src/ui/components/segmented-control.js` | FOUND |
| `src/ui/components/segmented-control.test.js` | FOUND |
| `src/ui/dashboard.view-toggle.test.js` | FOUND |
| `.planning/phases/36-navigator-view-toggle-redesign/36-01-SUMMARY.md` | FOUND |
| Commit 3beb8ac (Task 1) | FOUND |
| Commit 229ef03 (Task 2) | FOUND |
| Commit bec3a8a (Task 3) | FOUND |
| Commit ccbea22 (Task 4 fix) | FOUND |
| 637 tests passing | CONFIRMED |
