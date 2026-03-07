# Pitfalls Research

**Domain:** Vanilla JS Mobile PWA — Adding Heatmap, Swipe Gestures, Haptic Feedback to existing system
**Researched:** 2026-03-07
**Confidence:** HIGH (swipe/haptics — confirmed via MDN, Chrome docs, iOS issues); MEDIUM (heatmap — chartjs-chart-matrix docs sparse, color scale edge cases from general library knowledge)

---

## Critical Pitfalls

### Pitfall 1: chartjs-chart-matrix Not Registered in Tree-Shaken Import System

**What goes wrong:**
The existing `charts.js` imports only specific Chart.js components (LineController, DoughnutController, CategoryScale, LinearScale, etc.) via tree-shaken imports. chartjs-chart-matrix provides a `MatrixController` and `MatrixElement` that must be explicitly imported and registered with `Chart.register()`. Forgetting this causes a silent runtime error: "No dataset controller found for type 'matrix'". The chart canvas renders blank.

**Why it happens:**
The CDN-based examples in chartjs-chart-matrix docs use the global `Chart` object which auto-registers everything. The tree-shaken ESM path is not documented prominently. Developers copy the example config and omit the registration step.

**How to avoid:**
Add to `charts.js`:
```js
import { MatrixController, MatrixElement } from 'chartjs-chart-matrix';
Chart.register(MatrixController, MatrixElement);
```
Do this before any matrix chart is instantiated. Verify with a console log that `Chart.registry.controllers` includes `matrix`.

**Warning signs:**
- Browser console: "No dataset controller found for type 'matrix'"
- Canvas is present in DOM but completely blank
- No chart error thrown — it fails silently

**Phase to address:** Heatmap phase (first task: install and register before any data work)

---

### Pitfall 2: Heatmap Cell Color Scale Breaks When maxSpend Is Zero

**What goes wrong:**
The color interpolation for heatmap cells divides the cell value by `maxSpend` to get a 0–1 intensity ratio. If all days in the visible range have zero spending (e.g., a new user who has just installed the app, or the current month has no expenses yet), `maxSpend` is 0 and the division produces `NaN` or `Infinity`. Every cell renders as the "zero" color — or worse, as `rgba(NaN, NaN, NaN, NaN)` which collapses to black or transparent depending on browser.

**Why it happens:**
Color scale functions are written assuming at least one non-zero value exists. The zero-max case is a degenerate edge case not covered by typical test data.

**How to avoid:**
Guard the scale function:
```js
const intensity = maxSpend > 0 ? value / maxSpend : 0;
```
Also handle the case where `maxSpend` equals `minSpend` (all days identical) — intensity should be 0.5 or 0, not `0/0`.

**Warning signs:**
- All heatmap cells render the same color (the zero-spend color) even for days with transactions
- Black or transparent cells on a brand-new test dataset
- Console errors mentioning `NaN` in color values

**Phase to address:** Heatmap phase — must be caught in data-aggregation logic before passing to `backgroundColor` callback

---

### Pitfall 3: Swipe Gesture Registers as Passive Listener, Making preventDefault Ineffective

**What goes wrong:**
Chrome (Android) defaults `touchstart` and `touchmove` listeners on `document`, `window`, and `body` to `{passive: true}` since Chrome 56. If swipe handlers are attached without `{passive: false}`, calling `event.preventDefault()` inside the handler has no effect — the browser scrolls anyway and logs: "Unable to preventDefault inside passive event listener". This means the swipe-to-delete action cannot suppress vertical scroll while the user is pulling a row horizontally.

**Why it happens:**
The default passive behavior was added for scroll performance. Developers who don't explicitly opt out get passive listeners without realizing it. The intervention warning appears in DevTools but not in production builds.

**How to avoid:**
Attach the touchmove listener with explicit `{passive: false}` on the individual transaction row elements (not on document/window). Only call `preventDefault()` when the gesture is confirmed to be horizontal (deltaX > deltaY threshold). Keep touchstart as `{passive: true}` to avoid blocking the initial touch.

```js
row.addEventListener('touchmove', handler, {passive: false});
```

**Warning signs:**
- DevTools console: "Unable to preventDefault inside passive event listener due to target being treated as passive"
- Row swipes also scroll the page vertically simultaneously
- Behavior differs between desktop (no issue) and Android Chrome (broken)

**Phase to address:** Swipe gesture phase — architecture decision must be made upfront before any gesture code is written

---

### Pitfall 4: iOS Safari Edge-Swipe Back Navigation Collides With Row Swipe

**What goes wrong:**
On iOS (both Safari and installed PWA), swiping from the left screen edge triggers the browser's native "go back" navigation. If a transaction row is positioned near the left edge of the viewport, beginning a left-to-right swipe to reveal a "delete" action starts the native back navigation gesture simultaneously. The native gesture wins, navigating away from the app (or flickering if it's a PWA with no history).

**Why it happens:**
iOS reserves approximately 20px from each screen edge for navigation gestures. This cannot be disabled via JavaScript or CSS in a home-screen PWA — Apple does not expose this in the Web App Manifest. The W3C manifest spec has an open issue requesting an `"gestures"` field, but it is not implemented.

**How to avoid:**
Design swipe affordance for right-to-left (swipe left to reveal delete), not left-to-right. The right edge of the screen does not have a system gesture conflict on iOS. Alternatively, detect if the touch started within 20px of the left edge (`touch.pageX < 20`) and abort the gesture handler entirely.

**Warning signs:**
- On iOS only, swiping a row near the left edge causes page flicker or navigation
- Works correctly on Android but breaks on iOS PWA
- Ionic and other PWA frameworks have open bugs for exactly this scenario

**Phase to address:** Swipe gesture phase — inform the UX decision about swipe direction before implementation begins

---

### Pitfall 5: Ghost Click Fires on the Row After a Completed Swipe

**What goes wrong:**
After a user completes a horizontal swipe (e.g., reveals the delete button), the browser synthesizes a `click` event at the touchend coordinates. This click lands on whatever element is at those coordinates — often the delete button that just slid into view — triggering an immediate delete without the user intending to tap it. The item disappears instantly, looking like a bug.

**Why it happens:**
Browsers synthesize mouse/click events from touch sequences with a ~300ms delay (or immediately on modern fast-tap browsers). The synthesized click is dispatched after `touchend`, by which time the DOM may have shifted (the swipe reveal animation completed), placing the delete button under the finger's release point.

**How to avoid:**
Two strategies:
1. After a swipe completes (threshold crossed), set a `_swipeJustCompleted` flag and suppress the next `click` event on the row via a one-time `click` handler that calls `event.stopPropagation()` then removes itself.
2. Require an explicit second tap on the revealed delete button (the button must be fully visible, not appearing during the gesture), and add a brief animation delay (150ms) before the button becomes interactive.

Strategy 2 is safer UX — the user must deliberately tap delete after the row settles.

**Warning signs:**
- Swipe to reveal delete immediately deletes the item without a tap
- Issue is timing-dependent and inconsistent (fast swipes hit it, slow swipes don't)
- Works on desktop (no ghost click) but fails on mobile

**Phase to address:** Swipe gesture phase — design the reveal-then-confirm flow, not reveal-and-immediately-act

---

### Pitfall 6: iOS Safari Has No Support for navigator.vibrate

**What goes wrong:**
`navigator.vibrate()` is undefined on all iOS Safari versions. Calling it without a guard throws a TypeError, or silently does nothing if the browser returns `undefined` for the property. On iOS 18+, Safari introduced a non-standard checkbox `switch` attribute that triggers system haptics when programmatically toggled, but this is a fragile workaround requiring hidden DOM elements and is not part of any standard.

**Why it happens:**
Apple has never implemented the W3C Vibration API. The MDN compat data has had an open issue about this since 2024. The Vibration API is implemented in Chrome Android, Firefox, and most Android browsers, creating a false sense of universal support.

**How to avoid:**
Always guard:
```js
function triggerHaptic(pattern = 50) {
  if (typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern);
  }
  // iOS: silently skip — no viable production workaround
}
```
Do NOT attempt the checkbox-switch workaround for production code. It depends on undocumented Safari behavior that could break in any iOS update, and it requires injecting/removing DOM elements on every haptic trigger, which is fragile in a vanilla JS architecture.

**Warning signs:**
- TypeError in console on iOS: "navigator.vibrate is not a function"
- Haptics work on Android test device but nothing happens on iPhone
- Feature assumed to work because it's in MDN without checking the compat table

**Phase to address:** Haptic phase — write the guard utility first, before wiring it to any actions

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Inline `backgroundColor` function computing color from raw value each render | Simple, no pre-processing step | On every Chart.js redraw (e.g., theme toggle) all 365 cells recompute; no memoization | Acceptable for 365 cells — not a real perf issue unless redraw is >60fps |
| Attach swipe listeners in the main `render()` loop (re-add on every render) | Simple, always fresh | Leaks if old listeners aren't removed; doubles up after re-render | Never — always detach before re-attaching or use event delegation |
| Calling `navigator.vibrate()` directly at every call site | Less indirection | No single place to disable haptics; hard to throttle or feature-detect | Never — always centralize in a `triggerHaptic()` utility |
| Using CSS `overflow: hidden` on rows to clip the swipe reveal | Easy containment | Clips box-shadow on the delete button; looks broken in dark mode | Acceptable if delete button uses background color instead of shadow |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| chartjs-chart-matrix + existing Chart.js tree-shaken setup | Importing from `chartjs-chart-matrix` without calling `Chart.register(MatrixController, MatrixElement)` | Add both to the `Chart.register()` call in `charts.js` alongside existing controllers |
| chartjs-chart-matrix + CategoryScale | Using category labels on x-axis for dates — the matrix plugin uses numeric x/y coordinates internally | Use LinearScale (already registered) for both axes; map week number to x, day-of-week to y |
| Privacy Mode blur overlay + swipe gestures | The blur overlay intercepts `touchstart`/`touchmove` before the row, preventing swipe detection | Swipe listeners must be attached to the row element, not the overlay; verify `pointer-events: none` is set on the blur overlay during Privacy Mode |
| Bottom navigation bar + vertical touch events | Bottom nav's `touchstart` handler may capture the start of a swipe that begins near the bottom of a list | Ensure bottom nav event handlers call `event.stopPropagation()` only on confirmed tap (not touch), or use `pointer-events: none` on nav bar during active swipe |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Re-querying all 365 days of expense data on every heatmap render (including theme toggle re-renders) | Visible delay when switching dark/light mode; Dexie query fires unnecessarily | Cache the aggregated day-totals object; only re-query when the selected year changes | Immediately noticeable on slow mobile devices (low-end Android) |
| Attaching `touchstart`/`touchmove`/`touchend` listeners to every row individually without cleanup | Memory grows with each render; old listeners accumulate on detached DOM nodes | Use a single delegated listener on the list container, or explicitly `removeEventListener` before each re-render | After 10+ re-renders (month navigation), memory pressure noticeable |
| Calling `navigator.vibrate()` in rapid succession (e.g., holding a long-press) | Vibration motor is triggered faster than it can complete; results in jank and battery drain on Android | Debounce haptic calls with a 200ms minimum interval | Any action that fires repeatedly (scroll, drag) |
| chartjs-chart-matrix cell width calculated as `chartArea.width / 53` before the chart is fully laid out | `chartArea` is undefined on first render; cells have width 0; chart appears blank | Guard: `width: ({chart}) => (chart.chartArea?.width ?? 0) / 53 - 1` | First render only — subsequent renders are fine |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Heatmap shows current year only but app has <3 months of data — most of the grid is empty/grey | User sees a mostly empty chart and thinks the feature is broken | Show current year with a note "X days of data so far"; do not show Year-over-Year comparison tab until 13+ months of data exist; detect and communicate gracefully |
| Swipe-to-delete with no undo | User swipes accidentally and loses a transaction permanently | Always show a toast with "Undo" (3–5 second window) using the existing `repository.js` delete + re-insert pattern |
| Haptic feedback on every action (form submit, toggle, navigation) | Haptics become background noise; users find it annoying within minutes | Haptics only on destructive or confirmatory actions: delete, clear/reconcile, save. Not on navigation or filter changes |
| Heatmap tooltip positioned off-screen on cells at the top or right edge | Tooltip clips to viewport edge or is partially hidden; unreadable on small phones | Use Chart.js tooltip `position: 'nearest'` and configure the external tooltip callback to clamp to viewport bounds; or disable tooltip on mobile and show a tap-to-highlight selected day's value in a fixed info bar below the chart |
| Swipe gesture with no visual affordance | Users never discover the feature; or they discover it by accident and are confused | Show a subtle swipe hint icon on row hover (desktop) / first-load animation (mobile); document in an onboarding tooltip |

---

## "Looks Done But Isn't" Checklist

- [ ] **Heatmap color scale:** Verify `maxSpend === 0` produces valid colors (not NaN/black/transparent) — test with empty month
- [ ] **Heatmap Y-o-Y tab:** Verify graceful degradation when `< 13 months` of data exists — should hide or disable the comparison tab
- [ ] **Heatmap Privacy Mode:** Verify heatmap cells are blurred when Privacy Mode is active — not just the summary cards
- [ ] **Swipe gesture cleanup:** Verify `touchstart`/`touchmove`/`touchend` listeners are removed before each `render()` call — check DevTools > Event Listeners on a row element after 5 re-renders
- [ ] **Swipe on iOS:** Test specifically on iOS Safari (not just Chrome DevTools mobile emulation) — edge-swipe conflict only manifests on real device
- [ ] **Ghost click:** Test fast swipe: does the delete button activate without a second tap? — if yes, ghost click prevention is missing
- [ ] **Haptic guard:** Verify `triggerHaptic()` does not throw on iOS — open DevTools console on a real iPhone and perform a delete action
- [ ] **Haptic over-triggering:** Verify haptics do not fire on filter changes, month navigation, or search — only on destructive/confirmatory actions
- [ ] **MatrixController registration:** Verify `Chart.registry.controllers.matrix` exists in browser console before heatmap renders
- [ ] **Accessibility — swipe:** Verify each transaction row has a visible delete button reachable by keyboard Tab + Enter for non-touch users

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| MatrixController not registered (blank chart) | LOW | Add `Chart.register(MatrixController, MatrixElement)` to `charts.js`; no data or architecture changes needed |
| Ghost click deleting rows without confirmation | MEDIUM | Add `_swipeJustCompleted` flag + click suppression, or add reveal-then-tap UX; requires testing on device |
| navigator.vibrate TypeError on iOS in production | LOW | Wrap in `typeof navigator.vibrate === 'function'` guard; 1-line fix, no architecture change |
| Swipe listeners accumulating on re-render (memory leak) | MEDIUM | Audit all `addEventListener` call sites; add paired `removeEventListener` before each render; or refactor to event delegation on the list container |
| Heatmap maxSpend=0 NaN color (visible to new users) | LOW | Add `maxSpend > 0 ? value / maxSpend : 0` guard in color callback |
| iOS edge-swipe conflict (UX broken for left-edge rows) | MEDIUM | Change swipe direction to right-to-left (left swipe reveals delete), or add `pageX < 20` abort guard |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| MatrixController not registered | Heatmap — install & setup task | `Chart.registry.controllers.matrix` in console |
| maxSpend=0 NaN color | Heatmap — data aggregation task | Render chart with zero-expense dataset; all cells should show minimum color, not black |
| Y-o-Y tab with insufficient data | Heatmap — UX/display task | Test with fresh DB; Y-o-Y tab should be hidden or show "not enough data" |
| Tooltip clipping on mobile | Heatmap — polish task | Test on 375px-wide viewport; tooltip on top-right cell must not clip |
| Passive listener blocking preventDefault | Swipe — architecture task | Swipe row; page must not scroll vertically while pulling horizontally |
| iOS edge-swipe navigation conflict | Swipe — architecture task (UX direction decision) | Test swipe starting from left 20px of screen on iOS real device |
| Ghost click after swipe | Swipe — gesture logic task | Fast swipe: delete button must not activate without explicit second tap |
| Swipe listener leak on re-render | Swipe — render integration task | DevTools Event Listeners panel; after 5 renders, row should have 1 listener not 5 |
| navigator.vibrate not a function (iOS) | Haptic — utility task (write guard first) | Open Safari console on iPhone; perform delete action; no TypeError |
| Over-haptics on every action | Haptic — wiring task | Step through all actions; haptic should only fire on delete/clear/save |
| Privacy Mode not covering heatmap | Heatmap + Privacy integration task | Enable Privacy Mode; heatmap must be blurred or hidden |

---

## Sources

- [chartjs-chart-matrix GitHub (kurkle/chartjs-chart-matrix)](https://github.com/kurkle/chartjs-chart-matrix) — registration and data format
- [chartjs-chart-matrix Docs — Usage](https://chartjs-chart-matrix.pages.dev/usage) — cell sizing, color callback pattern
- [MDN — Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API) — iOS not supported
- [GitHub — navigator.vibrate works on iOS Safari (mdn/browser-compat-data #29166)](https://github.com/mdn/browser-compat-data/issues/29166) — iOS compat discussion
- [Ionic Framework — iOS cannot disable Safari swipe to go back (PWA)](https://github.com/ionic-team/ionic-framework/issues/22299) — edge-swipe conflict confirmed unfixable
- [Chrome Developers — Making touch scrolling fast by default](https://developer.chrome.com/blog/scrolling-intervention) — passive listener defaults
- [Chrome Lighthouse — Use passive listeners](https://developer.chrome.com/docs/lighthouse/best-practices/uses-passive-event-listeners) — {passive: false} guidance
- [JavaScriptRoom — Prevent touchstart when swiping](https://www.javascriptroom.com/blog/prevent-touchstart-when-swiping/) — tap vs swipe conflict
- [pantaley.com — Separating drag/swipe from click/touch events](https://pantaley.com/blog/How-to-separate-Drag-and-Swipe-from-Click-and-Touch-events/) — ghost click prevention
- [Ionic Framework iOS haptics — iOS 18+ switch workaround](https://github.com/ionic-team/ionic-framework/issues/29942) — checkbox switch technique (not recommended for production)
- [Progressier — Vibration API PWA Demo](https://progressier.com/pwa-capabilities/vibration-api) — cross-platform compat matrix

---
*Pitfalls research for: v2.4 UX Polish — Heatmap, Swipe Gestures, Haptic Feedback*
*Researched: 2026-03-07*
