# Phase 27 Context: Critical Bug Fixes & Cloud-Sync Hardening

## Objective
Fix three confirmed bugs in `cloud-sync.js`, fix the heatmap year-boundary rendering bug, and fix the mobile header layout issue. No new features. All fixes are surgical and targeted.

## Background

### Bug 1 — Cloud-Sync Event Listener Accumulation (cloud-sync.js)
`_renderSignedIn()` attaches `addEventListener('click', ...)` directly to `#cloudPushBtn` and `#cloudPullBtn` every time it re-renders. Because the element is re-inserted into the DOM, listeners pile up and push/pull are called multiple times per click.
- **Fix:** Use event delegation on the container element. Guard with `this._signedInListenerAttached` flag. Reset flag in `_renderSignedOut()`.
- **File:** `src/ui/cloud-sync.js`, lines ~69, 74, 90, 122

### Bug 2 — XSS Risk in Cloud Snapshot Modal (cloud-sync.js)
In `_bindPreviewListener()`, table/store names from the Supabase payload are injected raw into the modal's innerHTML without escaping. A malformed or compromised cloud payload could inject HTML/script.
- **Fix:** Apply standard HTML entity escaping to all user-controlled strings before innerHTML interpolation. The `safeHTML()` utility from `src/ui/render.js` should be used or the escaping should be done inline.
- **File:** `src/ui/cloud-sync.js`, lines ~177-187

### Bug 3 — Missing Init Guard / Duplicate Auth Listeners (cloud-sync.js)
`cloudSyncUI.init()` calls `_bindAuthListener()` and `_bindPreviewListener()` without idempotency guards. If init is called more than once (e.g. after a route change), duplicate Supabase auth state change listeners are registered.
- **Fix:** Add `this._initialized` guard in `init()`. Add `this._authListenerBound` in `_bindAuthListener()`. Add `this._previewListenerBound` in `_bindPreviewListener()`.
- **File:** `src/ui/cloud-sync.js`, lines ~20-27, 150

### Bug 4 — Heatmap Cross-Year Split (heatmap.js)
When a transaction is dated in a previous year (e.g. 2024) and the navigator is showing 2025, the `renderSpendingHeatmap()` function renders both years' canvases side by side (or one breaks the layout). Root cause: the function is called with `allYearsData` that includes prior-year entries and the loop does not guard strictly against `date.getFullYear() !== yearNum` for data lookup.
- **Fix:** In `renderSpendingHeatmap()`, ensure `dailyData` passed to the function is pre-filtered to only include entries for `year`. The calling site in `dashboard.js` / `transactions.js` should filter the data map before passing it in. The inner loop already has `if (date.getFullYear() > yearNum) break` but does not guard `< yearNum` fully for data side-effects on the scale calculation.
- **Files:** `src/ui/heatmap.js`, `src/ui/dashboard.js`, `src/ui/transactions.js`

### Bug 5 — Header Save-Dot Layout on Mobile (css/main.css)
The auto-save indicator dot (from cloud-sync status) is rendering on a new line in the mobile header toolbar. The toolbar uses flexbox but the dot element appears to have `display:block` or a `width:100%` style that forces it to wrap.
- **Fix:** Ensure the save dot element has `display:inline-flex` or `display:inline-block` and does not force a line break. The header toolbar flex row should not wrap for this element. May need `flex-wrap: nowrap` or a min-width guard.
- **File:** `css/main.css`, header toolbar styles

## Scope
- **In scope:** Only the five fixes listed above
- **Out of scope:** No UI redesign, no new features, no schema changes

## Files to Change
- `src/ui/cloud-sync.js`
- `src/ui/heatmap.js`
- `src/ui/dashboard.js` (heatmap data filter)
- `src/ui/transactions.js` (heatmap data filter, if relevant)
- `css/main.css`

## Acceptance Criteria
- [ ] Push/Pull buttons trigger their handler exactly once per click, regardless of how many re-renders have occurred
- [ ] Cloud snapshot modal displays safely when store/table names contain `<`, `>`, `&`, `"` characters
- [ ] `cloudSyncUI.init()` is safe to call multiple times without registering duplicate listeners
- [ ] Heatmap shows only the selected year's data; no cross-year canvas split
- [ ] Auto-save dot and local icon appear on the same line in the mobile header
- [ ] All 354+ existing Vitest tests pass after changes
- [ ] No new console errors on app load

## Test Strategy
- Existing `src/ui/cloud-sync.test.js` must remain green
- Existing `src/ui/heatmap.test.js` must remain green
- Manual check: toggle cloud sync push button rapidly — inspect console to confirm single invocation
- Manual check: open app on mobile viewport — confirm header layout

## Resources
- `.planning/QUICK_FIX_REFERENCE.md` — exact fix patterns for all three cloud-sync bugs
- `src/ui/heatmap.js` — full source, cross-year issue is in the loop and data-filter at call sites
- `css/main.css` — header toolbar flexbox styles
