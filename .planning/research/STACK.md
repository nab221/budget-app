# Stack Research

**Domain:** Vanilla JS PWA — Feature additions (Heatmap, Swipe Gestures, Haptic Feedback)
**Researched:** 2026-03-07
**Confidence:** MEDIUM-HIGH (matrix plugin: HIGH; swipe: HIGH; haptics: MEDIUM due to iOS instability)

---

## Scope

This document covers only additions needed for v2.4. The existing stack (Chart.js v4.5.1, Dexie.js v4, date-fns v4, Vanilla JS ES6 modules, Vite, Vitest) is validated and unchanged.

---

## Feature 1: Monthly Spending Heatmap (ANAL-05)

### Decision: Use chartjs-chart-matrix (not custom canvas)

**Rationale:** The existing codebase uses Chart.js v4 with tree-shaken imports and a single `Chart.register()` call in `src/ui/charts.js`. `chartjs-chart-matrix` plugs directly into this pattern — you import `MatrixController` and `MatrixElement`, add them to the existing `Chart.register()` call, and get a `type: 'matrix'` chart that integrates with the app's existing tooltip, legend, and color theming infrastructure. A custom canvas approach would require duplicating hit-testing, tooltips, and responsive resizing that Chart.js already provides.

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| chartjs-chart-matrix | 3.0.0 | Matrix/heatmap chart type for Chart.js | Official plugin by Chart.js maintainer (kurkle), latest release March 2025, peerDep `>=3.0.0` covers Chart.js v4.5.1, ESM-compatible with tree shaking |

### Integration Details

The plugin uses the same tree-shaking pattern as Chart.js itself — the ESM build has no side effects and requires manual registration:

```js
// In src/ui/charts.js — add to existing imports and Chart.register() call
import { MatrixController, MatrixElement } from 'chartjs-chart-matrix';

Chart.register(
  // ... existing registrations (LineController, DoughnutController, etc.)
  MatrixController,
  MatrixElement
);
```

The matrix chart maps `{x, y, v}` data objects where `x` = month (Jan–Dec), `y` = year, and `v` = total spend value. The `backgroundColor` callback uses `v` to drive a colour ramp (e.g., white to red). No additional scales need to be registered: `LinearScale` is already registered and matrix charts use it by default.

### Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| chartjs-chart-matrix | Custom `<canvas>` with manual 2D context drawing | Only if Chart.js is being removed entirely, or if pixel-perfect control unavailable via Chart.js datasets is needed (non-rectangular cells, complex animations) |
| chartjs-chart-matrix | D3.js heatmap | Only if a full D3 dependency is already present — adding D3 for one widget is ~80 KB overhead with no benefit given Chart.js is already registered |

### What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| chartjs-adapter-date-fns + TimeScale | Not needed for matrix charts; adds ~15 KB and this dependency path caused the bar-width invisibility bug documented in `debugging.md` | chartjs-chart-matrix with LinearScale axes |
| apexcharts / highcharts | Second chart library alongside Chart.js doubles chart bundle and creates conflicting global state | chartjs-chart-matrix |

---

## Feature 2: Swipe-to-Clear / Swipe-to-Delete Gestures (UX-03)

### Decision: Vanilla JS Touch Events — No Library Needed

**Rationale:** The app is ~12,191 LOC of vanilla JS with no framework dependency. Swipe-to-delete on list rows is a well-understood pattern requiring ~50–80 lines of JS: track `touchstart`/`touchmove`/`touchend`, apply CSS `transform: translateX()` during drag, and commit or snap back on `touchend` based on a distance threshold. Adding a gesture library (HammerJS, ZingTouch, etc.) for a single gesture type would add an unmaintained or heavy dependency. Touch events are universally supported on all mobile browsers (Android Chrome, iOS Safari) with no polyfill required.

### Implementation Pattern

```js
// Attach to each transaction row element — ~60 lines, no library
function attachSwipeGesture(rowEl, { onSwipeLeft, threshold = 120 }) {
  let startX = 0;
  let currentX = 0;
  let dragging = false;

  rowEl.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    dragging = true;
    rowEl.style.transition = 'none';
  }, { passive: true });

  rowEl.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    currentX = e.touches[0].clientX - startX;
    if (currentX < 0) {  // left swipe only
      rowEl.style.transform = `translateX(${currentX}px)`;
    }
  }, { passive: true });

  rowEl.addEventListener('touchend', () => {
    dragging = false;
    rowEl.style.transition = 'transform 0.2s ease';
    if (currentX < -threshold) {
      rowEl.style.transform = `translateX(-100%)`;
      onSwipeLeft();
    } else {
      rowEl.style.transform = 'translateX(0)';
    }
    currentX = 0;
  });
}
```

Key implementation notes:
- Use `{ passive: true }` on `touchstart` and `touchmove` to eliminate scroll-blocking warnings and improve scroll performance.
- Only add `preventDefault()` on `touchmove` if the swipe is confirmed horizontal (check `Math.abs(dx) > Math.abs(dy)` before suppressing default scroll behaviour).
- Add a reveal layer (`position: absolute`, `right: 0`) behind the row so the delete/clear action button appears as the row slides left.
- Threshold of 120px is a reasonable default; adjust based on testing.

### Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Vanilla Touch Events | HammerJS | If the app needed multiple complex gestures simultaneously (pinch-zoom, rotate, multi-touch). HammerJS is also no longer actively maintained (last release 2016). |
| Vanilla Touch Events | Pointer Events API | Pointer Events unify mouse+touch+stylus — better if desktop drag-and-drop is also needed. For mobile-only swipe on list rows, Touch Events are simpler. |
| Vanilla Touch Events | @use-gesture/vanilla | Appropriate for apps needing spring physics and complex gesture composition. Overhead not justified for one gesture in a vanilla codebase. |

### What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| HammerJS | Unmaintained since 2016; known issues with passive event listeners in modern browsers | Vanilla Touch Events |
| ZingTouch | Abandoned (last commit 2018) | Vanilla Touch Events |

---

## Feature 3: Haptic Feedback (UX-04)

### Decision: Inline navigator.vibrate with iOS checkbox-switch fallback — No Library

**Rationale:** `navigator.vibrate()` works on Android Chrome and Firefox without any library. iOS Safari does not support `navigator.vibrate()` — this is a long-standing WebKit non-implementation. However, iOS 18+ with Safari 17.4+ added haptic feedback to the `<input type="checkbox" switch>` element when toggled. A ~15-line helper utility handles both cases without pulling in an unaudited dependency.

### Browser Support

| Browser | navigator.vibrate | iOS checkbox-switch haptics | Notes |
|---------|-------------------|-----------------------------|-------|
| Android Chrome 32+ | YES | N/A | Full support |
| Android Firefox 16+ | YES | N/A | Full support |
| Samsung Internet | YES | N/A | Full support |
| iOS Safari below 17.4 | NO | NO | No haptics available — silent no-op |
| iOS Safari 17.4+ (iOS 18+) | NO | YES | Checkbox-switch trick triggers system haptic |
| Desktop Chrome/Firefox | YES (API present) | N/A | No vibration motor — no-op in practice |

**Key constraint from MDN:** `navigator.vibrate()` requires "sticky user activation" — it must be called from within or shortly after a direct user gesture. This matches all intended use cases (swipe commits, button taps, form submits).

### Implementation Pattern

```js
// src/utils/haptics.js — ~15 lines, no dependency

let _iosSwitchEl = null;

function _getIosSwitchEl() {
  if (_iosSwitchEl) return _iosSwitchEl;
  // Only create if we know navigator.vibrate is absent (i.e. likely iOS Safari)
  if (typeof navigator.vibrate === 'function') return null;
  const el = document.createElement('input');
  el.type = 'checkbox';
  el.setAttribute('switch', '');
  el.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:0;height:0';
  document.body.appendChild(el);
  _iosSwitchEl = el;
  return el;
}

export function vibrate(pattern = 10) {
  if (typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern);
  } else {
    const el = _getIosSwitchEl();
    if (el) el.click(); // triggers system haptic on iOS 18+ Safari
    // else: silent no-op (older iOS, desktop without motor)
  }
}
```

Usage: `vibrate(10)` for a short confirmation tap, `vibrate([10, 50, 10])` for a double-tap pattern (Android only — iOS switch produces one fixed intensity).

### iOS Haptics Limitation

The checkbox-switch technique only provides one haptic intensity (the system default for toggle switches). There is no way to vary intensity or produce custom patterns on iOS via web APIs. Do not attempt patterns on iOS — the pattern argument is silently ignored by the switch toggle.

### Why No Library

| Library | Assessment |
|---------|------------|
| ios-haptics (tijnjh/ios-haptics) | Tiny, does exactly this checkbox-switch trick — but it is a micro-library with no tests, no versioning stability, and no audit trail. Inlining the ~15-line pattern is safer and removes an unvetted dependency from a personal budget app that handles financial data. |
| web-haptics (lochie/web-haptics) | React-hook oriented (`useWebHaptics`), not suited for vanilla JS usage. |

### What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Capacitor / Cordova haptics plugins | Requires native wrapper, incompatible with browser PWA deployment | Inline navigator.vibrate + checkbox-switch fallback |
| iOS Core Haptics JS bridge | Only accessible from WKWebView native app context, not Safari web | Checkbox-switch trick |
| Any library wrapping navigator.vibrate | Adds dependency weight for a one-liner API; no additional functionality | Direct navigator.vibrate call |

---

## Installation

```bash
# Only one new npm dependency for v2.4:
npm install chartjs-chart-matrix@3.0.0
```

Touch gesture and haptic implementations are pure JS utilities added to `src/utils/` — no additional packages required.

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| chartjs-chart-matrix@3.0.0 | chart.js@^4.5.1 | peerDependency `>=3.0.0`; confirmed Chart.js v4 compatible |
| chartjs-chart-matrix@3.0.0 | vite@^6.2.0 / ESM | ESM build available, tree-shakeable, no side effects |
| chartjs-chart-matrix@3.0.0 | vitest@^3.0.7 | No test-environment conflicts expected; matrix chart unit tests can use jsdom |

---

## Stack Patterns by Variant

**If the heatmap needs Year-over-Year comparison (two years side by side):**
- Use two `dataset` entries in the same matrix chart (one per year), with distinct y-axis label groups or a faceted layout.
- No additional library needed — matrix charts support multiple datasets natively.

**If iOS haptics need more than one intensity:**
- They cannot. iOS does not expose haptic pattern control via web APIs as of 2026-03. Accept the single system-default intensity.

**If swipe gestures need to work on desktop with a mouse as well:**
- Replace Touch Events with Pointer Events (`pointerdown`, `pointermove`, `pointerup`) using `setPointerCapture`.
- Same threshold and transform logic applies; Pointer Events unify mouse and touch input.

---

## Sources

- [chartjs-chart-matrix GitHub (kurkle)](https://github.com/kurkle/chartjs-chart-matrix) — version, release date, ESM tree-shaking pattern (MEDIUM confidence — rate-limited during fetch, confirmed via search)
- [chartjs-chart-matrix releases](https://github.com/kurkle/chartjs-chart-matrix/releases) — v3.0.0 released March 2025 (HIGH confidence — release page fetched successfully)
- [chartjs-chart-matrix npm](https://www.npmjs.com/package/chartjs-chart-matrix) — latest v3.0.0, peerDep `>=3.0.0` (MEDIUM confidence — 403 on direct fetch, confirmed via search results)
- [MDN Navigator.vibrate()](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate) — sticky user activation requirement, API surface (HIGH confidence — MDN page fetched)
- [mdn/browser-compat-data issue #29166](https://github.com/mdn/browser-compat-data/issues/29166) — navigator.vibrate iOS Safari non-support ongoing discussion (MEDIUM confidence — WebSearch)
- [ios-haptics GitHub (tijnjh)](https://github.com/tijnjh/ios-haptics) — checkbox-switch haptic technique, iOS 17.4+ / iOS 18 requirement (MEDIUM confidence — WebSearch summary, not directly fetched)
- [CSS-Tricks: Simple Swipe with Vanilla JavaScript](https://css-tricks.com/simple-swipe-with-vanilla-javascript/) — touch event pattern, passive listener recommendation (HIGH confidence — well-established reference)
- [MDN Touch Events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events/Using_Touch_Events) — API surface, universal mobile browser support (HIGH confidence)
- [Can I Use: Vibration API](https://caniuse.com/vibration) — browser support table (MEDIUM confidence — WebSearch, page not directly fetched)

---
*Stack research for: Budget App v2.4 — Heatmap, Swipe Gestures, Haptic Feedback*
*Researched: 2026-03-07*
