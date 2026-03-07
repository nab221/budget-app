# Feature Research

**Domain:** Personal Finance PWA — UX Polish & Spending Insights (v2.4)
**Researched:** 2026-03-07
**Confidence:** MEDIUM (patterns well-established; specific implementation details from web sources, no Context7 for these UI patterns)

---

## Scope

This file covers only the three new features for v2.4. Previously built features (reconciliation, analytics suite, bottom nav, privacy mode) are already shipped and not re-researched here.

---

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Swipe-to-delete gesture on transaction rows | Native iOS/Android apps universally use this pattern; users transferred from native apps expect it | MEDIUM | Left-swipe reveals red background + trash icon; must snap back if threshold not met; reconciled rows must remain non-swipeable |
| Visual affordance for swipe (background reveal) | Without it swipe feels broken — no feedback during drag | LOW | CSS `translateX` + red background layer underneath; icon appears as row slides |
| Mouse/pointer fallback for swipe | Desktop users can't swipe; must still delete via buttons | LOW | Existing Edit/Delete buttons remain the desktop path; swipe is additive for touch only |
| Threshold-based snap-back | Industry standard: if user doesn't cross threshold, row returns to origin | LOW | 80–100px or ~30% of row width is standard; CSS transition handles animation |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Swipe-right-to-clear (reconciliation action) | Native banking apps (Monzo, Revolut) use directional swipe semantics — right = positive action (clear), left = destructive (delete) | MEDIUM | Only meaningful when reconciliation mode is active; requires knowing row's current cleared state |
| GitHub-style year heatmap (daily spending) | Immediately shows high-spend days and seasonal patterns across the full year — no other view in app does this | HIGH | 52×7 CSS grid; color intensity = daily total spend; requires pulling all oneOffExpenses + recurrentExpenses for the year |
| Year-over-Year heatmap toggle | See current year alongside prior year to spot recurring patterns (Christmas spike, annual bills) | HIGH | Two heatmaps stacked; same color scale so intensities are directly comparable; prior year data may be sparse |
| Haptic feedback on threshold cross | The moment the swipe crosses the delete/clear threshold, a short pulse confirms commitment — removes need to look at screen | LOW | `navigator.vibrate(50)` at threshold crossing; distinct pattern for delete vs clear |
| Haptic on destructive confirm | Single clean pulse confirms deletion completed; double pulse distinguishes error | LOW | Success: `[50]`; Error: `[100, 50, 100]`; keeps patterns short to avoid annoyance |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Swipe on reconciled/locked rows | Users may try to swipe reconciled rows expecting the same behavior | Reconciled rows must not be deletable or clearable — swipe could trigger a confusing no-op or visual jank | Visually suppress swipe affordance on reconciled rows (no translateX response); preserve existing disabled state on buttons |
| Heatmap with category breakdown per cell | "Show me what category I spent on each day" sounds useful | A single cell is ~12px square — a tooltip is the maximum viable interaction; per-cell category drill-down requires a modal and kills the "bird's eye view" purpose of a heatmap | Tooltip on hover/tap showing daily total + top category; full breakdown goes in the existing doughnut chart |
| Swipe-to-edit (right swipe on non-recon rows) | Mirrors some email clients | Right swipe conflicts with swipe-to-clear in reconciliation mode; two modes with different right-swipe semantics on the same row type is confusing | Edit stays as an explicit button; right swipe reserved for clear action in recon mode only |
| Year-over-Year as overlaid single grid | "Show both years on one grid" — saves vertical space | Color encoding breaks: you'd need two colors per cell or alternating cells, destroying the heatmap's ability to show intensity | Side-by-side stacked grids with a shared color scale; label each grid's year |
| Continuous vibration / long haptic patterns | Some devs use long vibrations for emphasis | Annoying, drains battery, disabled by device silent mode anyway; users turn it off entirely after one bad experience | Keep all patterns under 150ms total duration |
| Haptic on every button press | "Make everything feel responsive" | Haptics should be reserved for meaningful state changes, not generic affordance — overuse causes users to disable it | Limit to: swipe threshold cross, delete confirm, error state |

---

## Feature Dependencies

```
Existing: reconciliationMode flag (expensesUI.reconciliationMode)
    └──required by──> Swipe-to-clear (must know if recon mode active)
                          └──conflicts with──> Swipe-to-edit (same right-swipe direction)

Existing: reconciled/locked row state (isReconciled)
    └──required by──> Swipe gesture suppression on locked rows

Existing: oneOffExpenseRepository + recurrentExpenseRepository
    └──required by──> Heatmap data aggregation (daily spend totals across year)
                          └──feeds──> Year-over-Year second grid (prior year same query, different date range)

Haptic feedback
    └──enhances──> Swipe gesture (threshold pulse)
    └──enhances──> Delete confirm (completion pulse)
    └──standalone for──> Error states (form validation failures, failed ops)

Swipe gesture system
    └──required by──> Haptic threshold pulse (needs to know when threshold crossed)
```

### Dependency Notes

- **Swipe-to-clear requires reconciliationMode**: The right-swipe action only makes sense in reconciliation mode. Outside that mode, right-swipe should do nothing or be suppressed entirely, to avoid conflicting with swipe-to-edit if that were ever added.
- **Heatmap requires both expense tables**: Recurrent expenses (the main volume of data) and one-off expenses both need to be queried. The heatmap aggregates by `nextDate` for recurrents and `date` for one-offs. This is the same data the existing Expenses tab already renders per-month — heatmap just aggregates it differently across the full year.
- **Haptic requires swipe threshold awareness**: The threshold pulse must fire exactly once as the finger crosses the threshold, not continuously. The gesture handler must track whether the threshold was already crossed in the current drag.
- **Reconciled rows suppress swipe**: The swipe system must check `isReconciled` on each row and skip attaching gesture listeners (or ignore translation) for those rows. The existing `disabled` attribute on buttons provides the model.

---

## MVP Definition

### Launch With (v2.4)

- [x] Swipe-to-delete (left swipe, Expenses tab transaction rows) — core friction reduction
- [x] Swipe-to-clear (right swipe, active only in reconciliation mode) — completes the recon workflow
- [x] Snap-back on sub-threshold release — without this, gesture feels broken
- [x] Red background + trash icon reveal during left swipe — visual affordance
- [x] Green background + check icon reveal during right swipe in recon mode
- [x] Suppression on reconciled rows — data integrity guard
- [x] Year heatmap — one full calendar year of daily spending (current year)
- [x] Tooltip on cell tap/hover — daily total + top category
- [x] Haptic: threshold-cross pulse (swipe) + completion pulse (delete/clear)

### Add After Validation (v1.x / later v2.4 iteration)

- [ ] Year-over-Year second heatmap grid — add once single-year heatmap is confirmed useful; requires verifying prior year data density is sufficient to be meaningful
- [ ] Haptic on error states — useful but not critical for MVP; add if haptic infrastructure is in place and feels natural

### Future Consideration (v2.5+)

- [ ] Swipe gesture on Income tab transaction rows — same pattern, different module; defer to confirm expenses swipe works cleanly first
- [ ] Category filter on heatmap — "show only Groceries spend" heatmap; requires filter UI addition to the analytics panel

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Swipe-to-delete (Expenses) | HIGH | MEDIUM | P1 |
| Snap-back + visual affordance | HIGH | LOW | P1 |
| Suppression on reconciled rows | HIGH (data integrity) | LOW | P1 |
| Swipe-to-clear (recon mode) | MEDIUM | LOW (once swipe infra exists) | P1 |
| Spending heatmap (current year) | HIGH | HIGH | P1 |
| Cell tooltip (daily total) | MEDIUM | LOW | P1 |
| Haptic: swipe threshold + delete | MEDIUM | LOW | P1 |
| Year-over-Year second grid | MEDIUM | MEDIUM | P2 |
| Haptic: error states | LOW | LOW | P2 |
| Swipe on Income tab | LOW | LOW (copy pattern) | P3 |
| Category-filtered heatmap | LOW | HIGH | P3 |

**Priority key:** P1 = v2.4 launch scope, P2 = v2.4 if time allows, P3 = future milestone

---

## Implementation Details by Feature

### ANAL-05: Spending Heatmap

**Grid approach: GitHub-style 52×7 CSS grid (not month-grid)**

Rationale: Month-grid (12 columns × max-31 rows) wastes vertical space and makes weekly patterns invisible. The 52-week × 7-day layout makes day-of-week patterns immediately visible (e.g., "I always spend more on Fridays") and is the standard for contribution-style heatmaps. Implemented with pure CSS Grid — no library needed.

Structure:
- 52 columns + 1 label column (Mon/Wed/Fri labels on left)
- 7 rows + 1 header row (month labels spanning columns)
- `grid-auto-flow: column` so days flow top-to-bottom then left-to-right
- Each cell: ~12px square with 2px gap

Color scale:
- Single-hue progressive scale (white/very-light → deep color) using CSS custom properties
- 5 intensity levels: 0 spend = `var(--bg-alt)`, levels 1–4 based on quartiles of that year's spending distribution
- Do NOT use red-for-high — this conflicts with the app's `var(--danger)` semantic color. Use the app's accent color (blue/teal) for highest spend.
- Color thresholds computed dynamically from the year's data (quartile bucketing) so the scale is relative to actual spending, not an arbitrary fixed range

Data:
- Query: all `recurrentExpenses` where `nextDate` falls in the year + all `oneOffExpenses` where `date` falls in the year
- Aggregate by calendar date → sum of pence per day
- Both tables already exposed via `recurrentExpenseRepository.getAll()` and `oneOffExpenseRepository.getAll()`

Y-o-Y: Two grids stacked, same quartile color scale computed across BOTH years' combined data (so intensities are directly comparable). Label each grid with the year. Current year on top.

Tooltip: On cell hover (desktop) / tap (mobile) — small floating tooltip showing: date, total spend (formatted GBP), top category for that day.

**Confidence: MEDIUM** — CSS grid heatmap approach is well-documented; the data aggregation is straightforward given existing repository layer. Color scale quartile logic is custom implementation.

### UX-03: Swipe Gestures

**Touch event approach: native `touchstart`/`touchmove`/`touchend` on `<tr>` elements**

No library needed. The pattern is:
1. `touchstart`: record `startX`
2. `touchmove`: compute `deltaX = currentX - startX`; apply `transform: translateX(deltaX)` to the row; reveal background layer (red left, green right) based on direction; fire haptic once when `|deltaX|` crosses threshold
3. `touchend`: if `|deltaX| >= threshold` → execute action (delete or clear) + completion haptic; else → animate snap-back via CSS transition

Key decisions:
- **Threshold**: 80px absolute OR 30% of row width, whichever is smaller — accounts for narrow phone screens
- **Reconciled rows**: attach no swipe listeners; `isReconciled` check at listener-attach time
- **Right-swipe semantics**: only meaningful in `expensesUI.reconciliationMode === true`; outside recon mode, right-swipe is ignored (no visual feedback)
- **Direction disambiguation**: require `|deltaX| > |deltaY| * 2` before activating swipe mode (prevents interfering with vertical scroll)
- **Mouse fallback**: swipe is touch-only; existing Edit/Delete buttons remain the pointer/keyboard path
- **Pointer Events API**: could use `pointerdown/pointermove/pointerup` instead of touch events for unified touch+mouse, but mouse swipe-to-delete is not a common UX pattern and would be surprising; stick to touch events

Background layer implementation: the `<tr>` gets `position: relative; overflow: hidden`. A `<td>`-spanning pseudo-element or absolute-positioned div underneath carries the color and icon. As `translateX` increases, the background div is revealed.

**Confidence: HIGH** — touch event API is stable, pattern is industry-standard, no dependencies required.

### UX-04: Haptic Feedback

**API: `navigator.vibrate()` — Android only (iOS Safari does not support)**

iOS limitation is accepted: haptics are progressive enhancement. No fallback needed — silence on iOS is fine.

Recommended patterns:
| Event | Pattern | Rationale |
|-------|---------|-----------|
| Swipe threshold crossed | `navigator.vibrate(40)` | Short pulse = "you've committed"; fires once per drag, not repeatedly |
| Delete confirmed | `navigator.vibrate(60)` | Slightly longer = action completed |
| Clear confirmed (recon) | `navigator.vibrate(40)` | Same as threshold — lighter action |
| Error (e.g. delete reconciled attempt) | `navigator.vibrate([80, 50, 80])` | Double pulse = "no" signal |
| Form submit success | Not recommended | Form submits already have visual confirmation; haptic here would be noise |

Wrapper function to add everywhere:
```js
function haptic(pattern) {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
}
```

All patterns stay under 150ms total to avoid annoyance and battery impact. `navigator.vibrate(0)` cancels any in-progress vibration before starting a new one (prevents stacking).

**Requires sticky user activation** (MDN): haptic only works after user has interacted with the page. This is always true in this app's context (user initiated the swipe or tap).

**Confidence: HIGH** — MDN documentation is authoritative; API is simple; iOS limitation is a known, accepted constraint.

---

## Competitor Feature Analysis

| Feature | Monzo (native iOS/Android) | YNAB (web) | Our Approach |
|---------|---------------------------|------------|--------------|
| Swipe-to-delete | Left swipe, red reveal, instant delete with undo snackbar | Not present (uses button) | Left swipe, red reveal; no undo (matches existing delete behavior) |
| Swipe-to-clear | Right swipe in transaction list | Not present | Right swipe in reconciliation mode only |
| Spending heatmap | Not present natively | Third-party tool via API | Native, year-view, CSS grid, quartile color scale |
| Y-o-Y comparison | "Trends" bar chart, not calendar | Not present | Stacked heatmap grids (P2) |
| Haptic feedback | System haptics on actions | No haptics (web only) | `navigator.vibrate` on Android; silence on iOS |

---

## Sources

- [MDN: Touch Events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events)
- [MDN: Navigator.vibrate()](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate)
- [MDN: Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API)
- [LogRocket: Designing swipe-to-delete and swipe-to-reveal interactions](https://blog.logrocket.com/ux-design/accessible-swipe-contextual-action-triggers/)
- [bitsofco.de: Recreating the GitHub Contribution Graph with CSS Grid](https://bitsofco.de/github-contribution-graph-css-grid/)
- [CSS Script: Github Style Contribution Graph In JavaScript](https://www.cssscript.com/github-contribution-graph-heatmap/)
- [Heatmap for YNAB (third-party)](https://heatmapforynab.netlify.app/)
- [jqueryscript.net: 9 Best Github Style Calendar Heatmap Plugins](https://www.jqueryscript.net/blog/best-github-style-calendar-heatmap.html)
- [cal-heatmap library](https://cal-heatmap.com/) — considered but not recommended (D3 dependency, adds weight to a no-dependency app)
- [Haptic UX Design — Android AOSP](https://source.android.com/docs/core/interaction/haptics/haptics-ux-design)
- [Medium: 2025 Guide to Haptics](https://saropa-contacts.medium.com/2025-guide-to-haptics-enhancing-mobile-ux-with-tactile-feedback-676dd5937774)

---

*Feature research for: v2.4 — Spending Heatmap, Swipe Gestures, Haptic Feedback*
*Researched: 2026-03-07*
