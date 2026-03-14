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

---
---

# Stack Research — v2.5 Addendum: Debt Form UX Overhaul

**Domain:** Vanilla JS — Modal dialogs, type-specific form fields, form validation
**Researched:** 2026-03-07
**Confidence:** HIGH (native dialog: HIGH; constraint validation API: HIGH; field-switching: HIGH)

---

## Scope

This addendum covers only the new techniques needed for v2.5. No new npm dependencies are introduced. The existing stack (Dexie.js, Chart.js v4, date-fns, Vanilla JS ES6 modules, Vite) is unchanged.

---

## Decision 1: Native `<dialog>` Element via `showModal()` — Not a Custom Overlay

### Recommendation

Use the native HTML `<dialog>` element with `showModal()` for the Add Debt and Edit Debt forms.

### Rationale

The `<dialog>` element with `showModal()` provides everything a custom overlay must laboriously re-implement: focus trap (keyboard focus stays inside the dialog automatically), backdrop rendering (via `::backdrop` pseudo-element, no extra div needed), `Esc` key dismissal, `aria-modal="true"` set implicitly, and all content outside the dialog made `inert` automatically. A custom overlay div approach requires ~400 lines of JS to replicate this correctly; the native element reduces that to ~38 lines.

Browser support is not a concern for this codebase. The `<dialog>` element is Baseline Widely Available since March 2022 — Chrome 37+, Firefox 98+, Safari 15.4+, iOS Safari 15.4+. Global support is 95.57% as of 2025. The app's PWA targets modern mobile browsers, all of which are well above these floor versions.

### Core API

```js
// Open as modal (blocks page, Esc closes, backdrop shown)
const dialog = document.getElementById('debtDialog');
dialog.showModal();

// Close programmatically
dialog.close();

// Close on backdrop click (event.target === dialog when ::backdrop is clicked)
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) dialog.close();
});

// Reset editingId on close
dialog.addEventListener('close', () => {
  debtUI.editingId = null;
});
```

### HTML Structure

```html
<dialog id="debtDialog" aria-labelledby="debtDialogTitle">
  <div class="dialog-inner">
    <div class="dialog-header">
      <h2 id="debtDialogTitle">Add Debt Account</h2>
      <button class="dialog-close" aria-label="Close" autofocus>&#x2715;</button>
    </div>
    <form id="debtForm" novalidate>
      <!-- fields injected here -->
    </form>
    <div class="dialog-footer">
      <button type="button" class="secondary" id="debtCancelBtn">Cancel</button>
      <button type="submit" form="debtForm" class="primary" id="debtSaveBtn">Add Account</button>
    </div>
  </div>
</dialog>
```

Key points:
- `aria-labelledby` connects the dialog to its heading for screen readers.
- `autofocus` on the close button (not the dialog element itself — that breaks Chrome on macOS) ensures focus lands in a predictable place immediately.
- The close button at top-right is the recommended focus target: users know where to look, and screen readers hear the dialog title before encountering the dismiss action.
- `novalidate` on the form suppresses browser-native validation bubbles so custom validation controls the UX (while the Constraint Validation API still works underneath).

### Background Scroll Lock

`showModal()` makes content inert but does not prevent the page behind from scrolling. Add/remove a CSS class to lock it:

```js
// Before showModal()
document.body.style.overflow = 'hidden';
dialog.showModal();

// In the 'close' event handler
document.body.style.overflow = '';
```

Alternatively, use `scrollbar-gutter: stable` on `:root` to prevent layout shift from the scrollbar disappearing (recommended if the debt tab has a visible scrollbar).

### What NOT to Do

| Avoid | Why |
|-------|-----|
| `tabindex` on the `<dialog>` element | The element is not interactive; adding tabindex causes browsers to make the dialog itself focusable and skip its children |
| `autofocus` on the `<dialog>` element | Fails silently in Chrome on macOS/Windows — place `autofocus` on a child element instead |
| Custom overlay div (`position: fixed; z-index: 9999`) | Must manually implement focus trap, `inert` on background, Esc key, ARIA — ~400 lines of JS to do correctly |
| `dialog[open]` attribute in HTML | Sets the dialog as non-modal (no backdrop, no inert content, no Esc key) — always use `showModal()` for forms |

---

## Decision 2: Type-Specific Field Sets via CSS Class Toggle — Not Dynamic innerHTML

### Recommendation

Render all field sets for all debt types into the dialog HTML at once (hidden by default), then show/hide the relevant set by toggling a CSS class when the type `<select>` changes. Do not re-render the entire form HTML on type change.

### Rationale

The existing `debts.js` uses `toggleDebtTypeFields()` with `classList.remove('hidden')` / `classList.add('hidden')`. This is the correct pattern — it preserves input values across type switches (user types a name, switches type, name is not lost), avoids re-attaching event listeners, and is ~5 lines of JS. The v2.5 requirement adds a fourth type (Other/Generic) — extend the existing pattern, don't replace it.

Rendering via `innerHTML` on each type change (the broken current approach) destroys DOM state, loses partially-entered values, and requires re-querying all inputs after every render.

### Pattern

```js
// debtUI.js
switchDebtType(type) {
  // Map of type value -> fieldset element id
  const fieldsets = {
    'credit-card': document.getElementById('ccFields'),
    'mortgage':    document.getElementById('mortgageFields'),
    'loan':        document.getElementById('loanFields'),
    'other':       document.getElementById('otherFields'),
  };
  Object.entries(fieldsets).forEach(([key, el]) => {
    if (!el) return;
    el.classList.toggle('hidden', key !== type);
  });
}
```

```html
<select id="debtTypeInput" onchange="debtUI.switchDebtType(this.value)">
  <option value="credit-card">Credit Card</option>
  <option value="mortgage">Mortgage</option>
  <option value="loan">Personal Loan</option>
  <option value="other">Other</option>
</select>

<fieldset id="ccFields" class="hidden"><!-- Credit Card fields --></fieldset>
<fieldset id="mortgageFields" class="hidden"><!-- Mortgage fields --></fieldset>
<fieldset id="loanFields" class="hidden"><!-- Personal Loan fields --></fieldset>
<fieldset id="otherFields" class="hidden"><!-- Generic fields --></fieldset>
```

Using `<fieldset>` elements (rather than generic `<div>`) provides semantic grouping that assistive technologies surface as a named group when combined with a `<legend>`.

### Pre-Population on Edit

When opening the dialog in edit mode:
1. Call `showModal()`.
2. Set the `<select>` value to the debt's type.
3. Call `switchDebtType(debt.debtType)` to show the right fieldset.
4. Populate every field input value programmatically (not via `innerHTML`).
5. Update the dialog title and save button text.

This order guarantees the correct fieldset is visible before the user sees the dialog.

---

## Decision 3: Constraint Validation API — Not a Validation Library

### Recommendation

Use the browser's built-in Constraint Validation API (`element.validity`, `element.checkValidity()`, `form.checkValidity()`, `element.setCustomValidity()`, `element.reportValidity()`) for all form validation. No validation library is needed.

### Rationale

The Constraint Validation API is universally supported in all target browsers. It works alongside HTML5 attributes (`required`, `type="number"`, `min`, `max`, `step`) and is the minimum-overhead approach for a vanilla JS codebase with no existing validation infrastructure. The `novalidate` attribute on the form suppresses browser-native error bubbles while keeping the API accessible, giving full control over error presentation.

### Pattern

```js
function validateDebtForm() {
  const form = document.getElementById('debtForm');
  // Check all visible (not hidden-fieldset) inputs
  const visibleInputs = form.querySelectorAll(':not(.hidden *) input, :not(.hidden *) select');
  let valid = true;

  visibleInputs.forEach(input => {
    // Clear previous custom error
    input.setCustomValidity('');

    // Business rule: balance must not exceed credit limit for credit cards
    if (input.id === 'ccBalanceInput' && input.value) {
      const limit = parseFloat(document.getElementById('ccLimitInput').value) || 0;
      if (parseFloat(input.value) > limit) {
        input.setCustomValidity('Balance cannot exceed credit limit');
      }
    }

    if (!input.checkValidity()) {
      input.classList.add('input-error');
      valid = false;
    } else {
      input.classList.remove('input-error');
    }
  });

  return valid;
}

// On save button click:
document.getElementById('debtSaveBtn').addEventListener('click', async (e) => {
  e.preventDefault();
  if (!validateDebtForm()) return;
  await debtUI.handleSaveDebt();
});
```

Key points:
- Validate only inputs in the currently-visible fieldset (`:not(.hidden *) input`) — hidden fields for other debt types must not block submission.
- Use `setCustomValidity('')` to clear a previous custom error before re-checking.
- Use `input.classList.add('input-error')` to style invalid fields — pair with a CSS rule for `.input-error` border colour.
- Do not call `form.reportValidity()` — it shows native browser bubbles. Use `input.checkValidity()` per-field and render your own inline error messages for better UX control.

### Required HTML Attributes Per Field Type

| Field | Required Attributes |
|-------|---------------------|
| Balance inputs | `type="number" min="0" step="0.01" required` |
| Rate/APR | `type="number" min="0" max="100" step="0.01" required` |
| Term (months) | `type="number" min="1" step="1" required` |
| Name | `type="text" required maxlength="100"` |
| Promo end date | `type="date"` (optional, no required) |

Setting these attributes means `checkValidity()` handles range and type checks automatically — `setCustomValidity()` is only needed for cross-field business rules (balance vs. limit).

---

## Installation

No new npm packages. This milestone uses only native browser APIs.

```bash
# No new dependencies for v2.5
```

---

## Integration Notes for Existing debts.js

The existing `debts.js` module has:
- `editingId` state tracking — keep it, works identically for the modal approach.
- `toggleDebtTypeFields()` — rename to `switchDebtType()` and extend with `other` type; same pattern.
- `renderDebtForm()` — replace with a `populateDebtForm(debt)` function that sets input values rather than writing innerHTML.
- `toggleDebtForm(show)` — replace with `openDebtDialog()` / `closeDebtDialog()` that call `dialog.showModal()` / `dialog.close()`.
- `handleSaveDebt()` — keep as-is; just call it after `validateDebtForm()` passes.
- `window.editDebt = (id) => this.editDebt(id)` — keep; the inline onclick attribute on list rows still works.

The `<dialog>` element can be added to the debt tab HTML once (in the shell template), rather than being created and destroyed on each open. This preserves the dialog's DOM state between uses and avoids re-attaching listeners.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Native `<dialog>` + `showModal()` | Custom `position:fixed` overlay div | Never in a modern app — the native element does everything the overlay does plus accessibility, with 10% the JS |
| Native `<dialog>` + `showModal()` | Popover API (`popover` attribute) | Use Popover for non-modal UI (tooltips, dropdowns, menus). Debt forms are modal — user must complete or dismiss before continuing. Popover allows page interaction which is wrong here. |
| Constraint Validation API | Yup / Zod / Valibot | Only if the codebase moves to a build pipeline that already has these (e.g., if TypeScript schema validation is needed). Adds ~7-30 KB for no benefit in a vanilla JS form. |
| CSS class toggle for fieldsets | innerHTML re-render on type change | innerHTML destroys DOM state (loses partially-entered values) and requires re-querying all inputs on every type switch |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `dialog.show()` (non-modal) | Does not add backdrop, does not trap focus, does not make background inert, does not respond to Esc | `dialog.showModal()` |
| `tabindex` on `<dialog>` | Makes the dialog element itself focusable, breaking keyboard navigation for its children | `autofocus` on a child element (close button or first input) |
| `innerHTML` to inject the whole form on each open | Destroys input state, requires re-attaching listeners, slow on repeated open/close | Static HTML with `populateDebtForm()` setting `.value` programmatically |
| Validation library (Yup, Zod, Joi) | 7-30 KB overhead; Constraint Validation API + `setCustomValidity()` covers all needed cases natively | Constraint Validation API |
| `form.reportValidity()` | Triggers browser-native bubble tooltips that can't be styled and vary across browsers | `input.checkValidity()` per field with custom `.input-error` CSS |
| `formmethod="dialog"` on Save button | Closes the dialog without running JS validation — data never gets saved | `type="button"` with a JS click handler that validates then saves |

---

## Version Compatibility

All techniques in this section are native browser APIs with no npm package involvement. No compatibility concerns within the existing stack.

| API | Chrome | Firefox | Safari | iOS Safari | Notes |
|-----|--------|---------|--------|------------|-------|
| `<dialog>` + `showModal()` | 37+ | 98+ | 15.4+ | 15.4+ | Baseline Widely Available since 2022 |
| `::backdrop` pseudo-element | 37+ | 98+ | 15.4+ | 15.4+ | Same as dialog |
| Constraint Validation API | 4+ | 4+ | 5+ | 5+ | Universally available |
| `inert` attribute (auto-set by showModal) | 102+ | 112+ | 15.5+ | 15.5+ | Set automatically — no manual use needed |
| `element.setCustomValidity()` | All | All | All | All | Part of HTML5 standard |

---

## Sources

- [MDN: `<dialog>` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog) — showModal(), close(), returnValue, form method=dialog, browser compat (HIGH confidence — MDN page fetched directly)
- [Can I Use: dialog element](https://caniuse.com/dialog) — 95.57% global support, Chrome 37+, Firefox 98+, Safari 15.4+ (HIGH confidence — page fetched directly)
- [Jared Cunha: HTML Dialog Accessibility](https://jaredcunha.com/blog/html-dialog-getting-accessibility-and-ux-right) — focus management pitfalls, background scroll lock pattern, scrollbar-gutter (HIGH confidence — page fetched directly)
- [web.dev: dialog and popover baseline patterns](https://web.dev/articles/baseline-in-action-dialog-popover) — modal vs non-modal distinction, Popover API context (MEDIUM confidence — search result)
- [MDN: Constraint Validation API](https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation) — checkValidity(), setCustomValidity(), validity object (HIGH confidence — well-established MDN reference)
- [Go Make Things: backdrop click pattern](https://gomakethings.com/how-to-dismiss-native-html-dialog-elements-when-the-backdrop-is-clicked/) — `event.target === dialog` technique (HIGH confidence — search result, technique confirmed by MDN)
- [Can I Use: inert attribute](https://caniuse.com/mdn-html_global_attributes_inert) — Safari inert support, find-in-page caveat (MEDIUM confidence — search result)

---
*Stack research addendum for: Budget App v2.5 — Debt Form UX Overhaul*
*Researched: 2026-03-07*
