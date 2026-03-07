# Project Research Summary

**Project:** Budget App v2.4 — UX Polish & Spending Insights
**Domain:** Vanilla JS PWA — Mobile-first personal finance app, feature additions to mature codebase
**Researched:** 2026-03-07
**Confidence:** HIGH (swipe/haptics/architecture); MEDIUM (heatmap rendering approach has a stack conflict — see Gaps)

## Executive Summary

Budget App v2.4 adds three features to a mature, 12k+ LOC vanilla JS PWA: a GitHub-style spending heatmap (ANAL-05), swipe-to-delete/clear gestures on transaction rows (UX-03), and haptic feedback on data-mutating actions (UX-04). All three features are well-understood patterns with established browser APIs. The overall approach is additive — no schema changes, no new frameworks, minimal new dependencies. The implementation order is dictated by a clear dependency chain: haptics utility first (no dependencies), then swipe utility (imports haptics), then the two gesture-wired UI modules, then heatmap (data query + canvas render + dashboard wiring).

The dominant architectural decision is the heatmap rendering approach. STACK.md recommends `chartjs-chart-matrix@3.0.0`; ARCHITECTURE.md explicitly recommends against it, citing the project's documented bar-chart failures and additional dependency risk, preferring a custom `<canvas>` 2D Context draw (~80 lines) instead. ARCHITECTURE.md has higher confidence (direct codebase inspection) and the stronger technical rationale: Chart.js plugin compatibility is a proven pain point in this codebase, and 365 `fillRect()` calls are entirely sufficient for performance. The custom canvas path is the recommended approach. Resolve this conflict explicitly before Phase 3 implementation begins.

The main risks are mobile-specific: iOS edge-swipe navigation conflicts with left-swipe gesture starts near the screen edge; ghost click events can fire delete immediately after a swipe completes without a second deliberate tap; and `navigator.vibrate` is undefined on iOS Safari and will throw a TypeError if called without a guard. All three risks have low-cost, well-defined mitigations that must be designed in from the start rather than patched later.

## Key Findings

### Recommended Stack

The existing stack (Chart.js v4.5.1, Dexie.js v4, date-fns v4, Vite, Vitest, ES6 modules) is unchanged. No new npm dependencies are required if the custom canvas heatmap path is taken (recommended). Two new source files (`src/utils/swipe.js`, `src/utils/haptics.js`) are pure JS utilities with no external dependencies. The heatmap adds one canvas element to `index.html` and one render function to `src/ui/charts.js`.

**Core technologies:**
- Custom `<canvas>` 2D Context API: heatmap rendering — avoids Chart.js plugin risk, self-contained, ~80 lines, theme-integrated via `getComputedStyle`
- Native Touch Events (`touchstart`/`touchmove`/`touchend`): swipe gestures — universally supported on mobile, no library needed, ~60-80 lines with delegated listener pattern
- `navigator.vibrate()`: haptic feedback on Android — one-liner API; iOS Safari unsupported (silent no-op via feature-detection guard in utility module)
- Dexie.js (existing): new `getSpendingByDay(fromDate, toDate)` range query against existing `oneOffExpenses` and `recurrentExpenses` tables

### Expected Features

**Must have (table stakes) — P1, v2.4 launch:**
- Swipe-to-delete (left swipe, Expenses rows) — native-app users expect this; snap-back on sub-threshold is required or the gesture feels broken
- Visual swipe affordance: red background + trash icon reveals during left drag; green + check during right drag in recon mode
- Suppression of swipe on reconciled/locked rows — data integrity; must not be swiped at all
- Swipe-to-clear (right swipe, reconciliation mode only) — completes the recon workflow without tapping buttons
- Spending heatmap (current year): 52×7 GitHub-style grid, quartile color scale, daily spend from both expense tables
- Heatmap cell tooltip: date, daily total, top category
- Haptic feedback: threshold-cross pulse (swipe) + completion pulse (delete/clear confirm)

**Should have (competitive) — P2, add after validation:**
- Year-over-Year heatmap (second grid stacked, shared color scale) — validate single-year view is useful first; defer if data is sparse
- Haptic on error states (form validation failures) — additive once haptic infrastructure is in place

**Defer (P3 / v2.5+):**
- Swipe gestures on Income tab rows — copy the pattern after expenses is validated
- Category-filtered heatmap — requires filter UI addition; high cost, low priority

**Anti-features (do not build):**
- Swipe on reconciled rows (data integrity violation)
- Continuous or long haptic patterns (annoying, battery drain; all patterns under 150ms)
- Haptics on passive/read-only actions (navigation, filter, search)
- Year-over-Year as a single overlaid grid (color encoding breaks — use stacked grids)

### Architecture Approach

The architecture is purely additive integration into the existing layered vanilla JS app. Two new utility modules are created; four existing files are modified; one canvas element is added to `index.html`; CSS swipe styles are added to `main.css`. No new DB schema version is required. No new external services. All three features are entirely client-side.

**Major components:**

1. `src/utils/haptics.js` (NEW) — feature-detected `navigator.vibrate` wrapper; four named patterns (`tap`, `success`, `delete`, `error`); feature detection runs once at module load time
2. `src/utils/swipe.js` (NEW) — `SwipeManager` class; delegated `touchstart`/`touchmove`/`touchend` on persistent `<tbody>` containers; calls haptics on threshold cross and completion; calls provided callbacks with the `<tr>` element
3. `src/db/repository.js` (MODIFIED) — `getSpendingByDay(fromDate, toDate)` returns `{ 'YYYY-MM-DD': penceTotal }` via parallel Dexie range queries on both expense tables
4. `src/ui/charts.js` (MODIFIED) — `renderSpendingHeatmap(canvasId, dailyData, year)` using `canvas.getContext('2d')`; clears via `clearRect()` then draws 365 `fillRect()` calls with quartile color scale; reads theme colors via `getComputedStyle`
5. `src/ui/dashboard.js` (MODIFIED) — wires heatmap data fetch and render call into `renderDashboard()`
6. `src/ui/transactions.js` + `src/ui/expenses.js` (MODIFIED) — instantiate SwipeManager in `init()` with row action callbacks; import and call haptics at save/delete/toggle sites

The critical architectural pattern for swipe is **delegated event handling on persistent `<tbody>` containers** (not per-row listeners). All rows are rebuilt via `innerHTML` replacement on every render, so per-row listeners are destroyed and re-created each time, causing listener accumulation and memory leaks. Attach once to `#expenseBody` / `#incBody` at `init()` time and use `e.target.closest('tr')` for targeting.

### Critical Pitfalls

1. **Ghost click fires delete immediately after swipe completes** — the browser synthesizes a `click` event at the `touchend` coordinates, which may land on the just-revealed delete button. Prevention: require an explicit second tap (reveal-then-confirm, not reveal-and-act); add 150ms animation delay before the button becomes interactive. Alternative: set a `_swipeJustCompleted` flag and suppress the next `click` event on the row.

2. **`navigator.vibrate` TypeError on iOS** — the API is undefined on all iOS Safari versions; calling it without a guard throws and breaks the action handler. Prevention: write `src/utils/haptics.js` first (Phase 1), with `typeof navigator.vibrate === 'function'` guard at module load time. Never call the API directly at action sites.

3. **Passive touch listener blocks `preventDefault`, allowing simultaneous vertical scroll during horizontal swipe** — Chrome Android defaults `touchmove` listeners to `{passive: true}`. Prevention: attach `touchmove` with explicit `{passive: false}` on the `<tbody>` container; only call `preventDefault()` after confirming gesture is horizontal (`|deltaX| > |deltaY| * 2`).

4. **iOS edge-swipe navigation conflicts with row swipe starts** — iOS reserves ~20px from the left screen edge for the native back gesture; this cannot be suppressed in a PWA. Prevention: confirm the swipe direction (left = finger moves left, row translates left) avoids the left-edge issue; add `touch.pageX < 20` abort guard as a safety net.

5. **Heatmap color scale NaN/black when `maxSpend === 0`** — dividing by zero produces NaN colors for new users or months with no expense data. Prevention: guard `intensity = maxSpend > 0 ? value / maxSpend : 0` in the color callback; test with an empty dataset during development.

## Implications for Roadmap

The build order is determined by the dependency chain identified in ARCHITECTURE.md. Three sequential phases are recommended. Phases 2 and 3 can be partially parallelized (heatmap data query and canvas renderer are independent of swipe work), but Phase 1 must complete before Phase 2 begins.

### Phase 1: Haptic Feedback Infrastructure (UX-04)

**Rationale:** `src/utils/haptics.js` has zero dependencies on other v2.4 work and is required by both `swipe.js` and the action-handler wiring in `transactions.js`/`expenses.js`. Building it first ensures the iOS TypeError guard exists before any wiring occurs. The complete feature (haptics on all data-mutating actions) is deliverable as a standalone increment.

**Delivers:** `haptics` utility module with four named patterns; all action sites in `transactions.js` and `expenses.js` wired to call haptics on save, delete, toggle, and form validation failure.

**Addresses features:** UX-04 (haptic feedback on all data-mutating actions, independent of swipe)

**Avoids pitfalls:** iOS `navigator.vibrate` TypeError (guard written once, not scattered); over-haptics on read-only actions (patterns enumerated in the module, not ad hoc)

**Research flag:** Standard pattern — skip phase research. Feature-detection wrapper is well-documented.

### Phase 2: Swipe Gesture System (UX-03)

**Rationale:** Depends on Phase 1 (`haptics.js` must exist for threshold-cross pulse). SwipeManager is the most visible UX improvement of v2.4. Reconciliation mode guard and ghost click prevention must be designed in from the start — retrofitting these is MEDIUM recovery cost.

**Delivers:** `src/utils/swipe.js` (`SwipeManager` class with delegated listeners); swipe-to-delete (left) and swipe-to-clear (right, recon mode only) on Expenses rows; visual affordance CSS (red/green reveal, row transition); snap-back on sub-threshold release; reconciled row suppression; swipe + haptic integration.

**Addresses features:** UX-03 complete (all P1 swipe features); UX-04 threshold pulse (via Phase 1 infrastructure)

**Avoids pitfalls:** Ghost click (reveal-then-confirm, 150ms delay); passive listener scroll conflict (`{passive: false}` on `touchmove`); iOS edge-swipe conflict (`pageX < 20` abort guard); swipe listener leak on re-render (delegated listener pattern)

**Research flag:** Standard pattern — skip phase research. All edge cases characterized. iOS real-device testing required for sign-off (not just Chrome DevTools emulation).

### Phase 3: Spending Heatmap (ANAL-05)

**Rationale:** Independent of Phases 1 and 2; highest implementation complexity among the three features. Can be split into two parallel sub-tracks: (A) `repository.js` data query and (B) `charts.js` canvas renderer, integrated last in `dashboard.js`. Privacy Mode interaction with the heatmap canvas must be addressed here.

**Delivers:** `getSpendingByDay()` in `repository.js`; `renderSpendingHeatmap()` custom canvas renderer in `charts.js`; heatmap card in Dashboard panel with quartile color scale and theme integration; cell tooltip; empty-state handling (new users with no data); Privacy Mode blur on heatmap canvas.

**Addresses features:** ANAL-05 (full P1 heatmap scope); Year-over-Year grid deferred to P2 (validate single-year view first; hide Y-o-Y toggle until DB has 13+ months of records)

**Avoids pitfalls:** `maxSpend === 0` NaN colors (guard in color callback); Privacy Mode not covering heatmap (explicit CSS check when canvas element is added); tooltip clipping on small viewports (clamp or fixed info bar); graceful Y-o-Y degradation for sparse data

**Research flag:** Moderate complexity — canvas 2D heatmap is well-documented, but the quartile color scale and mobile tooltip positioning benefit from a brief written implementation spec before coding. No formal research-phase needed. Resolve the chartjs-chart-matrix vs custom canvas decision first (recommendation: custom canvas).

### Phase Ordering Rationale

- Haptics first because it is a leaf dependency (nothing it depends on is being built in v2.4) and everything downstream imports it.
- Swipe second because it depends on haptics and is the highest-visibility UX change; completing it before heatmap ensures the milestone has clear user-facing value even if heatmap runs long.
- Heatmap third because it is independent of swipe and is the most complex; its two sub-tracks (data query, canvas renderer) can be developed in parallel and integrated last.

### Research Flags

Phases with standard patterns (skip research-phase):
- **Phase 1 (Haptics):** Feature-detection wrapper is trivial and fully specified in research files.
- **Phase 2 (Swipe):** Touch event delegation is a well-documented pattern; all edge cases are characterized with mitigations in PITFALLS.md.

Phases needing brief implementation planning before coding (not full research-phase):
- **Phase 3 (Heatmap):** Write a short implementation spec covering: (1) rendering approach decision (custom canvas — recommended), (2) quartile bucket computation, (3) mobile tooltip strategy, (4) Privacy Mode CSS, (5) Y-o-Y data density detection.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | chartjs-chart-matrix vs custom canvas conflict between STACK.md (recommends plugin) and ARCHITECTURE.md (recommends custom canvas); custom canvas is the correct call based on codebase history but the conflict must be explicitly resolved |
| Features | MEDIUM | Scope is well-defined; Y-o-Y data density assumption is unvalidated — depends on each user's data history; feature is P2 so this is acceptable |
| Architecture | HIGH | Based on direct codebase inspection; component boundaries, delegated listener pattern, and build order are unambiguous |
| Pitfalls | HIGH | Swipe and haptics pitfalls confirmed via MDN and Chrome documentation; iOS edge-swipe is a confirmed unfixable PWA limitation; heatmap edge cases are well-characterized |

**Overall confidence:** HIGH — three well-characterized features adding to a mature codebase. No architectural unknowns. Main validation risk is iOS real-device testing for swipe and haptics (Chrome DevTools emulation is not sufficient).

### Gaps to Address

- **Heatmap rendering approach conflict (must resolve):** STACK.md recommends chartjs-chart-matrix; ARCHITECTURE.md recommends custom canvas. Resolve before Phase 3 begins. Recommendation: custom canvas (no new dependency, avoids Chart.js plugin risk, simpler and fully controllable). Mark RESOLVED in favor of custom canvas when the decision is made.

- **Y-o-Y data density (conditional feature):** Year-over-Year comparison requires 13+ months of expense records. Many users will not have this. Mitigation: detect in `renderDashboard()` and hide/disable the Y-o-Y toggle until sufficient data exists. Implement detection before exposing the UI control.

- **Privacy Mode + heatmap interaction (integration gap):** Privacy Mode must blur the heatmap canvas, not just the existing summary cards. This is not covered by the current Privacy Mode implementation. Add heatmap canvas to the Privacy Mode blur target list when the canvas element is introduced to `index.html`.

- **iOS real-device testing requirement:** Swipe edge-swipe conflict and ghost click behavior only manifest on real iOS hardware. Chrome DevTools mobile emulation will not catch these. Ensure iOS testing is part of Phase 2 sign-off criteria.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection (`src/app.js`, `src/ui/charts.js`, `src/ui/expenses.js`, `src/ui/transactions.js`, `src/db/repository.js`, `index.html`) — architecture, component boundaries, existing Chart.js registrations confirmed
- MDN Navigator.vibrate() — API surface, sticky user activation requirement, iOS non-support
- MDN Touch Events — API surface, passive listener defaults, universal mobile browser support
- chartjs-chart-matrix releases page (GitHub) — v3.0.0 released March 2025, peerDep `>=3.0.0`
- Chrome Developers — passive event listener defaults since Chrome 56; `{passive: false}` guidance

### Secondary (MEDIUM confidence)
- chartjs-chart-matrix GitHub (kurkle) — ESM tree-shaking pattern, registration requirement (rate-limited during fetch, confirmed via search)
- chartjs-chart-matrix npm — latest v3.0.0, peerDep coverage (403 on direct fetch, confirmed via search results)
- bitsofco.de — GitHub contribution graph CSS grid pattern
- CSS-Tricks: Simple Swipe with Vanilla JavaScript — touch event pattern and passive listener recommendation
- Ionic Framework iOS edge-swipe issue #22299 — confirms iOS back gesture cannot be suppressed in PWA

### Tertiary (LOW confidence / secondary sources)
- Can I Use: Vibration API — browser support table (WebSearch, page not directly fetched)
- mdn/browser-compat-data issue #29166 — iOS `navigator.vibrate` ongoing non-support discussion
- iOS-haptics GitHub (tijnjh) — checkbox-switch haptic technique for iOS 18+; assessed and not recommended for production use (fragile undocumented behavior)
- Medium: 2025 Guide to Haptics — haptic UX pattern recommendations for pattern duration limits

---
*Research completed: 2026-03-07*
*Ready for roadmap: yes*
