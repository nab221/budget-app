# Phase 09: UI Restoration & Initialization Cleanup

## Goal
Restore valuable missing UI features and refactor app initialization for performance and robustness.

## Waves

### Wave 1: 09-01-forecast-table-restoration
**Goal**: Restore the 90-day daily forecast table to the Dashboard.
- [ ] UI-01: Extract forecast table HTML structure from `budget-app.html.bak`.
- [ ] UI-02: Update `index.html` to include the forecast table container (hidden by default).
- [ ] UI-03: Update `src/ui/dashboard.js` to render the forecast table using `calculateForecast`.
- [ ] UI-04: Add a "Show/Hide Detailed Forecast" toggle to the Dashboard UI.

### Wave 2: 09-02-app-initialization-cleanup
**Goal**: Refactor `src/app.js` and improve mobile navigation.
- [ ] CLEAN-01: Parallelize the `init()` sequence in `src/app.js` using `Promise.all`.
- [ ] CLEAN-02: Consolidate rendering logic into a single robust `renderAll` function.
- [ ] CLEAN-03: Improve mobile menu UX (e.g., close on click-outside or better transitions).

## Success Criteria
- [ ] Dashboard tab includes a functional, toggleable 90-day forecast table.
- [ ] `src/app.js` initialization is faster and cleaner.
- [ ] Mobile navigation is responsive and robust.
