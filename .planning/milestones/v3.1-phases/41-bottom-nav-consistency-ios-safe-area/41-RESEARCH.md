# Phase 41: Bottom Nav Consistency & iOS Safe Area - Research

**Researched:** 2026-03-19
**Domain:** CSS fixed positioning, iOS safe-area-inset-bottom, viewport-fit=cover, PWA update bar z-index stacking
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BOTNAV-01 | Mobile bottom tab bar is fixed and visible on all 8 tabs at all times | `.nav-container { position: fixed; bottom: 0 }` already declared; root cause audit required — possible fixed-position containment trap from ancestor `transform`/`filter`/`will-change` |
| BOTNAV-02 | Tab content on all tabs does not scroll behind the bottom nav bar | `.shell { padding-bottom: calc(var(--bottom-bar-height) + 8px) }` exists but may not account for iOS safe-area-inset-bottom correctly; `--bottom-bar-height` is a CSS variable already declared |
| BOTNAV-03 | Bottom nav iOS safe-area padding works correctly on iPhones with home indicator | `viewport-fit=cover` is MISSING from the meta viewport tag; `env(safe-area-inset-bottom)` currently returns 0 on all iPhones; add `viewport-fit=cover` to index.html plus adjust nav and shell padding |
| BOTNAV-04 | PWA update bar appears above the bottom nav bar | `.update-bar { position: fixed; bottom: 0; z-index: 2000 }` is styled in CSS but no DOM element exists; update bar must be created in pwa-ux.js using `onNeedRefresh` callback; position must be `bottom: var(--bottom-bar-height-with-safe-area)` on mobile |
</phase_requirements>

---

## Summary

Phase 41 addresses four distinct but related problems in the mobile bottom navigation system. The work is CSS-and-HTML-only for BOTNAV-01 through BOTNAV-03, plus a new JS feature (update bar DOM creation) for BOTNAV-04.

**The single highest-impact fix in this phase (and the entire v3.1 milestone) is adding `viewport-fit=cover` to the meta viewport tag in `index.html`.** The STATE.md research note from v3.1 planning confirmed this: `env(safe-area-inset-bottom)` returns 0 on every iPhone with a home indicator because `viewport-fit=cover` is missing. The current `.nav-container { padding-bottom: calc(env(safe-area-inset-bottom) + 8px) }` rule is already written and waiting — but is silently inert without the HTML meta tag change.

The current bottom nav CSS (`position: fixed; bottom: 0; z-index: 1000`) is already structurally correct for BOTNAV-01. The STATE.md decision from v3.1 research identified that moving `.nav-container` to be a direct child of `<body>` is the definitive fix for fixed-position containment traps. Currently the `.nav-container` is inside `.shell`, which is inside `<body>`. The shell does not have `transform`, `filter`, or `will-change` in the current CSS, but the risk exists that a JS module (e.g. theme.js, privacy.js) applies these to `.shell` or an ancestor at runtime.

For BOTNAV-04, the `.update-bar` CSS class is fully defined in `main.css` (lines 487–512) but no JavaScript creates the DOM element. The `registerType: 'autoUpdate'` in `vite.config.js` means Workbox auto-activates new service workers without prompting — but the `pwa-ux.js` file uses `registerSW` which exposes `onNeedRefresh` and `updateServiceWorker` callbacks. The update bar needs to be constructed with `onNeedRefresh`, positioned above the bottom nav bar on mobile, and dismissed after the user taps "Update."

**Primary recommendation:** (1) Add `viewport-fit=cover` to `index.html` meta viewport — one attribute, highest real-device impact. (2) Move `.nav-container` out of `.shell` to direct `<body>` child — eliminates containment trap risk permanently. (3) Adjust `--bottom-bar-height` computation to include `env(safe-area-inset-bottom)`. (4) Implement update bar DOM in `pwa-ux.js` with `bottom` offset equal to the bottom nav height. All changes land in `index.html`, `css/main.css`, and `src/ui/pwa-ux.js`.

---

## Standard Stack

### Core (no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS | ES2022 | Create update bar DOM element, wire `onNeedRefresh` callback | Already the only runtime; no framework overhead |
| CSS `env()` | Native | `env(safe-area-inset-bottom)` for iOS home indicator clearance | W3C standard; Safari 11.1+, Chrome 69+, Firefox 65+ |
| `viewport-fit=cover` | HTML meta attribute | Opt-in to allow content to extend under iOS home indicator | Required for `env(safe-area-inset-bottom)` to return non-zero |
| `virtual:pwa-register` | vite-plugin-pwa | `registerSW` with `onNeedRefresh` callback — exposes when new SW is waiting | Already imported in `pwa-ux.js`; callback not yet wired |

### No New Libraries Required

All features use browser APIs and existing project infrastructure.

**Installation:** None required.

---

## Architecture Patterns

### Recommended File Changes

```
index.html                    — add viewport-fit=cover to meta viewport
                              — move .nav-container outside .shell (to direct body child)
css/
└── main.css                  — adjust .nav-container padding-bottom for safe-area
                              — adjust .shell padding-bottom to account for safe-area
                              — adjust .update-bar bottom offset on mobile
src/ui/
└── pwa-ux.js                 — implement _showUpdateBar() and _hideUpdateBar()
                              — wire onNeedRefresh callback in _registerUpdateListener()
```

### Pattern 1: viewport-fit=cover + env(safe-area-inset-bottom)

**What:** `viewport-fit=cover` is an attribute of the `<meta name="viewport">` tag. Without it, the browser letterboxes the viewport to exclude the iPhone home indicator area, and `env(safe-area-inset-bottom)` resolves to 0. With it, content can extend under the home indicator, and `env(safe-area-inset-bottom)` returns the actual inset (typically 34px on iPhone X/11/12/13/14/15 with 4th-gen Face ID, 20px on some older models).

**When to use:** Any PWA or web app that uses `position: fixed` elements at the bottom of the screen on iOS.

**Example:**
```html
<!-- index.html <head> — change this: -->
<meta name="viewport" content="width=device-width, initial-scale=1.0" />

<!-- To this: -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

**CRITICAL: This single HTML change is required before any CSS `env(safe-area-inset-bottom)` rule has any effect on iOS.**

### Pattern 2: Fixed Bottom Nav with Safe-Area Padding

**What:** After adding `viewport-fit=cover`, apply the safe area inset as padding-bottom on the nav container so the tab buttons sit above the home indicator. The `env()` function takes a fallback value — `env(safe-area-inset-bottom, 0px)` — which is used on non-iOS devices.

**Current state (main.css lines 243–255, inside `@media (max-width: 768px)`):**
```css
.nav-container {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--card);
  border-top: 1px solid var(--border);
  margin-bottom: 0;
  z-index: 1000;
  box-shadow: 0 -4px 12px rgba(0,0,0,0.05);
  backdrop-filter: blur(10px);
  padding-bottom: calc(env(safe-area-inset-bottom) + 8px);
}
```

The `padding-bottom` rule is already there but is currently inert because `env(safe-area-inset-bottom)` returns 0 without `viewport-fit=cover`. After the HTML change, this rule activates automatically.

**What also needs updating:** The `--bottom-bar-height: 72px` CSS variable used by `.shell { padding-bottom: calc(var(--bottom-bar-height) + 8px) }` does not account for the safe area. The shell padding will be too small on iPhones once the nav grows taller. The fix is to use `env(safe-area-inset-bottom)` directly in the shell padding calculation:

```css
/* In @media (max-width: 768px): */
.shell {
  padding-bottom: calc(var(--bottom-bar-height) + env(safe-area-inset-bottom, 0px) + 8px);
}
```

### Pattern 3: Moving .nav-container to Direct body Child

**What:** Move `<nav class="nav-container">` from inside `<div class="shell">` to a direct child of `<body>`, placed after the `<div class="shell">` closing tag. This permanently prevents any future `transform`, `filter`, `will-change`, `contain: paint/layout/strict`, or `isolation: isolate` property on `.shell` or its ancestors from creating a new stacking/containing context that would trap `position: fixed` inside it.

**Current HTML structure (index.html lines 23–54):**
```html
<body>
  <!-- banners -->
  <div class="shell">
    <header>...</header>
    <nav class="nav-container">   <!-- INSIDE shell — containment risk -->
      ...
    </nav>
    <section class="card">...</section>
  </div>
  <!-- modals -->
</body>
```

**Target HTML structure:**
```html
<body>
  <!-- banners -->
  <div class="shell">
    <header>...</header>
    <!-- nav-container REMOVED from here -->
    <section class="card">...</section>
  </div>
  <nav class="nav-container">    <!-- DIRECT body child — no containment risk -->
    ...
  </nav>
  <!-- modals -->
</body>
```

**CSS impact:** `.nav-container` is `position: fixed; bottom: 0; left: 0; right: 0` — it is already positioned relative to the viewport, not the shell. Moving it in the DOM does not change its visual position. The CSS rule `margin-bottom: 0` on `.nav-container` (currently overriding the normal-flow `.nav-container { margin-bottom: 14px }` from the desktop rule) will still work correctly.

**JavaScript impact:** All JS event delegation for tab switching uses `document.getElementById('mainTabs')` — which targets the `<div class="tabs">` inside `<nav class="nav-container">`. This is an ID-based lookup, so the move is transparent to JavaScript. No JS changes required.

**STATE.md confirmed decision:** "[v3.1 Research]: Moving `.nav-container` to direct child of `<body>` is the correct fix for fixed-position containment trap."

### Pattern 4: PWA Update Bar DOM Creation

**What:** The `.update-bar` CSS class is fully defined in `main.css` (lines 487–512) but no code creates the element. `pwa-ux.js` uses `registerSW` from `virtual:pwa-register`. The `registerSW` function accepts an `onNeedRefresh` callback that fires when a new service worker is installed and waiting. This is the correct place to create the update bar.

**Note on registerType:** `vite.config.js` sets `registerType: 'autoUpdate'` and `skipWaiting: true`. With this configuration, the new SW auto-claims all clients. However, `registerSW` still fires `onNeedRefresh` before the auto-reload, giving a brief window to show the user a "Refreshing..." bar. The more practical approach is to show the bar and provide a manual "Update" button — calling `updateServiceWorker(true)` reloads the page to apply the new SW immediately.

**Current `_registerUpdateListener` (pwa-ux.js lines 116–134):**
```javascript
function _registerUpdateListener() {
  registerSW({
    onOfflineReady() {
      console.log('[PWA] App ready for offline use.');
      _showOfflineReadyStatus();
    },
    onRegisteredSW(swUrl, registration) {
      console.log(`[PWA] Service worker registered: ${swUrl}`);
      if (registration) {
        setInterval(() => {
          if (!document.hidden) {
            registration.update().catch(() => {});
          }
        }, 60 * 60 * 1000);
      }
    },
    // MISSING: onNeedRefresh callback
  });
}
```

**Pattern to add:**
```javascript
// Source: vite-plugin-pwa documentation — virtual:pwa-register API
function _registerUpdateListener() {
  const updateSW = registerSW({
    onOfflineReady() {
      _showOfflineReadyStatus();
    },
    onRegisteredSW(swUrl, registration) {
      if (registration) {
        setInterval(() => {
          if (!document.hidden) registration.update().catch(() => {});
        }, 60 * 60 * 1000);
      }
    },
    onNeedRefresh() {
      _showUpdateBar(() => updateSW(true));
    },
  });
}

function _showUpdateBar(onUpdate) {
  // Create bar element if not present
  let bar = document.getElementById('pwa-update-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'pwa-update-bar';
    bar.className = 'update-bar';
    bar.innerHTML = `
      <span>A new version is available.</span>
      <button id="pwa-update-btn">Update now</button>
      <button id="pwa-update-dismiss">Later</button>
    `;
    document.body.appendChild(bar);
  }
  bar.style.display = 'flex';
  document.getElementById('pwa-update-btn')?.addEventListener('click', () => {
    onUpdate();
    _hideUpdateBar();
  });
  document.getElementById('pwa-update-dismiss')?.addEventListener('click', _hideUpdateBar);
}

function _hideUpdateBar() {
  const bar = document.getElementById('pwa-update-bar');
  if (bar) bar.style.display = 'none';
}
```

**Mobile positioning:** The update bar's `bottom: 0` in the CSS will overlap the bottom nav on mobile. The fix:

```css
/* In @media (max-width: 768px): */
.update-bar {
  bottom: calc(var(--bottom-bar-height) + env(safe-area-inset-bottom, 0px));
}
```

**Desktop:** The update bar stays at `bottom: 0` (no bottom nav on desktop).

### Pattern 5: z-index Stacking Order Audit

The existing z-index values in the codebase:

| Element | z-index | Layer |
|---------|---------|-------|
| `.nav-container` (mobile) | 1000 | Bottom nav |
| `header` | 100 | Sticky header |
| `.month-nav` (mobile) | 99 | Month sub-nav |
| `.dashboard-navigator-shell` (mobile) | 999 | Dashboard navigator |
| `.modal-overlay` | 1000 | Modals |
| `.update-bar` | 2000 | PWA update bar |
| `.heatmap-tooltip` | 1000 | Tooltips |

The `.update-bar { z-index: 2000 }` already defined in CSS will correctly appear above the bottom nav (`z-index: 1000`). No z-index changes are needed — only the `bottom` offset needs correcting on mobile.

### Anti-Patterns to Avoid

- **Applying `transform`, `filter`, `will-change`, or `contain` to `.shell`:** Creates a containing block that breaks `position: fixed` on the bottom nav. The nav-move to `<body>` direct child prevents this permanently.
- **Using `min-height: 100vh` on body or shell with safe-area-inset:** On iOS with `viewport-fit=cover`, `100vh` still includes the safe area zone. Use `min-height: -webkit-fill-available` as a Safari workaround if needed (this app does not need it since content scrolls within `.shell`).
- **Setting `--bottom-bar-height` dynamically:** The bottom bar height is constant (72px tabs + safe area). A ResizeObserver on `.nav-container` could track it, but the nav height does not change at runtime. Use the CSS variable plus `env()` directly in dependents.
- **Using `padding-bottom: env(safe-area-inset-bottom)` without `viewport-fit=cover`:** Silently returns 0 on iOS; code appears to work in Chrome DevTools (which does not simulate this) but fails on real iPhone.
- **Placing the update bar inside `.shell`:** The `.shell` has `max-width: 1200px; margin: 0 auto` — a bar inside it would be 1200px max-width centered. The update bar should span the full viewport width (it is `position: fixed; left: 0; right: 0`), so it must be appended to `document.body`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| iOS safe area inset value | JS to detect iPhone model and return a pixel value | `env(safe-area-inset-bottom)` | Device-specific values are known only to the browser; the CSS env variable is maintained by Apple/browser vendors for every device |
| Bottom nav height tracking for update bar offset | `ResizeObserver` on `.nav-container` | `calc(var(--bottom-bar-height) + env(safe-area-inset-bottom, 0px))` | The nav height does not change at runtime; CSS calc with the existing variable is sufficient |
| PWA update detection | `navigator.serviceWorker.getRegistration()` polling | `onNeedRefresh` from `registerSW` | `vite-plugin-pwa`'s `registerSW` handles all service worker lifecycle events; re-implementing them duplicates logic already in the plugin |
| Fixed-position isolation test | Testing each tab for containment breakage | Move nav to `<body>` direct child | Prevents the class of problem entirely rather than detecting it tab-by-tab |

**Key insight:** All four requirements have CSS-native solutions (env(), calc(), CSS variables) that are maintained by browser vendors. The JS addition (update bar DOM creation) is ~15 lines in the existing `pwa-ux.js` file.

---

## Common Pitfalls

### Pitfall 1: env(safe-area-inset-bottom) Always Returns 0

**What goes wrong:** Developer adds `padding-bottom: calc(env(safe-area-inset-bottom) + 8px)` to the nav, tests in Chrome DevTools with "iPhone 12" selected in device emulation, sees the padding does not change. Concludes the CSS is wrong. The CSS is correct — the problem is that Chrome DevTools does not simulate the iOS safe area.

**Why it happens:** `env(safe-area-inset-bottom)` returns 0 in two situations: (1) `viewport-fit=cover` is not set in the meta viewport tag; (2) the environment is not a real iOS WebKit engine (Chrome DevTools emulation does not implement this CSS variable).

**How to avoid:** (1) Add `viewport-fit=cover` to meta viewport. (2) Verify on a real iPhone or in Safari's responsive design mode (Develop > Enter Responsive Design Mode) with a device that has a home indicator selected.

**Warning signs:** `env(safe-area-inset-bottom)` is present in CSS but visually indistinguishable from the non-safe-area version in any Chromium-based browser's device emulation.

**From STATE.md:** "[Phase 41] iOS safe-area fixes must be verified on real iPhone or Safari simulator — Chrome DevTools will not expose the missing `viewport-fit=cover` issue."

### Pitfall 2: Fixed Element Containment Trap

**What goes wrong:** `position: fixed` is normally positioned relative to the viewport. But if any ancestor element has `transform`, `filter`, `will-change: transform`, `will-change: filter`, `contain: paint`, `contain: layout`, `contain: strict`, `contain: content`, or `isolation: isolate` — the `position: fixed` element is instead positioned relative to that ancestor, appearing at wrong positions or clipping at the ancestor's boundary.

**Why it happens:** This is CSS spec-defined behavior. `transform`, `filter`, and `will-change` create a new containing block for fixed-position descendants.

**Current state:** `.shell` does not have these properties in `main.css`. However, `privacy.js` applies `filter: blur(10px)` to `.privacy-blur` elements (not `.shell`), and `theme.js` does not apply transforms. The risk exists if future JS modules touch `.shell`.

**How to avoid:** Move `.nav-container` outside `.shell` entirely (to direct `<body>` child). This is a permanent structural fix. Audit current JS modules for runtime style mutations on `.shell` as a verification step.

**Warning signs:** Bottom nav appears inside the page scroll area instead of at the viewport bottom, or disappears when certain content is active.

### Pitfall 3: Scroll Content Visible Behind Bottom Nav (BOTNAV-02)

**What goes wrong:** User scrolls to the bottom of the Transactions tab and the last table row is hidden behind the bottom nav bar. The last content item is not fully visible.

**Why it happens:** `.shell { padding-bottom: calc(var(--bottom-bar-height) + 8px) }` should prevent this. But once `viewport-fit=cover` is active and `env(safe-area-inset-bottom)` returns the actual inset (~34px), the nav becomes taller than `--bottom-bar-height: 72px`. The shell padding does not account for the extra safe-area height, creating a gap where content hides behind the nav's lower portion.

**How to avoid:** Change the shell padding formula to:
```css
@media (max-width: 768px) {
  .shell {
    padding-bottom: calc(var(--bottom-bar-height) + env(safe-area-inset-bottom, 0px) + 8px);
  }
}
```

**Warning signs:** After adding `viewport-fit=cover`, last-item visibility regression on content-heavy tabs on real iPhone.

### Pitfall 4: Update Bar Overlaps Bottom Nav on Mobile

**What goes wrong:** The update bar is `position: fixed; bottom: 0; z-index: 2000`. On desktop, this is correct — there is no bottom nav. On mobile, it overlaps the bottom nav bar, blocking the tab icons.

**Why it happens:** The CSS does not distinguish mobile/desktop for the `bottom` value. The nav bar is also at `bottom: 0`.

**How to avoid:** Add a mobile media query override for `.update-bar`:
```css
@media (max-width: 768px) {
  .update-bar {
    bottom: calc(var(--bottom-bar-height) + env(safe-area-inset-bottom, 0px));
  }
}
```

**Warning signs:** Update bar appears but the bottom nav icons are no longer visible/tappable.

### Pitfall 5: registerType: 'autoUpdate' Means onNeedRefresh May Never Fire in Production

**What goes wrong:** With `registerType: 'autoUpdate'` and `skipWaiting: true`, the new service worker activates immediately. Depending on Workbox internals, the `onNeedRefresh` callback from `registerSW` might fire briefly before the auto-reload, or the page might reload before user sees the bar.

**Why it happens:** `autoUpdate` + `skipWaiting: true` means Workbox auto-activates the new SW and then the client reloads. The `onNeedRefresh` from `registerSW` still fires in the window between the new SW becoming installed-waiting and its activation — but this window can be very short.

**Impact on this phase:** The update bar (BOTNAV-04) is a "belt and suspenders" UX feature. Even if the auto-update fires before the user sees the bar, the requirement is that *when* the bar appears it must appear above the nav. The bar may appear briefly on some devices/networks before the auto-reload, and should position correctly when it does.

**How to avoid:** No change to `vite.config.js` is needed. The `onNeedRefresh` wiring is still correct. Accept that the bar may appear briefly before auto-reload. If manual control is desired in the future, change `registerType: 'prompt'` — but that is out of scope for this phase.

---

## Code Examples

Verified patterns from codebase analysis:

### 1. index.html: Add viewport-fit=cover

```html
<!-- Source: index.html line 5 — change this: -->
<meta name="viewport" content="width=device-width, initial-scale=1.0" />

<!-- To this: -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

### 2. index.html: Move .nav-container to direct body child

```html
<!-- Source: index.html lines 23–54; move nav out of .shell -->
<body>
  <!-- banners remain here -->
  <div class="shell">
    <header>...</header>
    <!-- nav-container removed from here -->
    <section class="card">...</section>
  </div>
  <nav class="nav-container">  <!-- now direct body child -->
    <button id="mobileMenuBtn" ...>...</button>
    <div class="tabs" id="mainTabs">...</div>
  </nav>
  <!-- modals remain here -->
</body>
```

### 3. css/main.css: Shell padding accounts for safe-area

```css
/* Source: main.css line 241 — current: */
.shell { padding-bottom: calc(var(--bottom-bar-height) + 8px); }

/* Replace with (inside @media (max-width: 768px)): */
.shell { padding-bottom: calc(var(--bottom-bar-height) + env(safe-area-inset-bottom, 0px) + 8px); }
```

### 4. css/main.css: Update bar raised above bottom nav on mobile

```css
/* Source: main.css line 487–512 — existing .update-bar rule stays at bottom: 0 for desktop */
/* ADD a mobile override: */
@media (max-width: 768px) {
  .update-bar {
    bottom: calc(var(--bottom-bar-height) + env(safe-area-inset-bottom, 0px));
  }
}
```

### 5. src/ui/pwa-ux.js: Wire onNeedRefresh to show update bar

```javascript
// Source: pwa-ux.js lines 116–134 — modify _registerUpdateListener()
function _registerUpdateListener() {
  const updateSW = registerSW({
    onOfflineReady() {
      _showOfflineReadyStatus();
    },
    onRegisteredSW(swUrl, registration) {
      if (registration) {
        setInterval(() => {
          if (!document.hidden) registration.update().catch(() => {});
        }, 60 * 60 * 1000);
      }
    },
    onNeedRefresh() {
      _showUpdateBar(() => updateSW(true));
    },
  });
}

function _showUpdateBar(onUpdate) {
  let bar = document.getElementById('pwa-update-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'pwa-update-bar';
    bar.className = 'update-bar';
    bar.innerHTML =
      '<span>A new version is available.</span>' +
      '<button id="pwa-update-btn">Update now</button>' +
      '<button id="pwa-update-dismiss">Later</button>';
    document.body.appendChild(bar);
  }
  bar.style.removeProperty('display');
  document.getElementById('pwa-update-btn')
    ?.addEventListener('click', () => { onUpdate(); _hideUpdateBar(); });
  document.getElementById('pwa-update-dismiss')
    ?.addEventListener('click', _hideUpdateBar);
}

function _hideUpdateBar() {
  const bar = document.getElementById('pwa-update-bar');
  if (bar) bar.style.display = 'none';
}
```

---

## Current State Audit (What Already Exists vs. What Needs Changing)

| Feature | File:Location | Current State | Action Needed |
|---------|--------------|---------------|---------------|
| `viewport-fit=cover` | `index.html` line 5 | MISSING — only `width=device-width, initial-scale=1.0` | ADD `viewport-fit=cover` |
| `.nav-container` DOM location | `index.html` lines 42–54 | INSIDE `.shell` — containment trap risk | MOVE to direct `<body>` child |
| `position: fixed; bottom: 0` on `.nav-container` | `main.css` lines 243–255 | EXISTS — correct | No change needed |
| `z-index: 1000` on `.nav-container` | `main.css` line 251 | EXISTS — correct | No change needed |
| `padding-bottom: calc(env(safe-area-inset-bottom) + 8px)` on `.nav-container` | `main.css` line 254 | EXISTS — rule written but inert (missing `viewport-fit=cover`) | HTML change activates it |
| `.shell { padding-bottom }` on mobile | `main.css` line 241 | `calc(var(--bottom-bar-height) + 8px)` — does not include safe area | UPDATE to include `env(safe-area-inset-bottom, 0px)` |
| `.update-bar` CSS class | `main.css` lines 487–512 | EXISTS — fully styled, `position: fixed; bottom: 0; z-index: 2000` | ADD mobile media query to raise above nav |
| Update bar DOM element | `pwa-ux.js` | MISSING — CSS class exists but no JS creates the element | ADD `_showUpdateBar()`, `_hideUpdateBar()`; wire `onNeedRefresh` |
| `onNeedRefresh` callback | `pwa-ux.js` line 117 | MISSING from `registerSW()` call | ADD callback that calls `_showUpdateBar()` |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No safe-area support | `env(safe-area-inset-bottom)` in CSS (correct) but `viewport-fit=cover` absent | Phase 41 | After change: home indicator no longer overlapped by nav on iPhone |
| `.nav-container` inside `.shell` | `.nav-container` as direct `<body>` child | Phase 41 | Eliminates all current and future fixed-position containment traps |
| No PWA update bar DOM | `.update-bar` CSS class exists; JS creates element on `onNeedRefresh` | Phase 41 | Update notification visible above nav bar when new SW is waiting |
| Shell padding ignores safe area | Shell padding includes `env(safe-area-inset-bottom, 0px)` | Phase 41 | Last content item on iOS never hidden behind taller safe-area nav |

---

## Open Questions

1. **Is `.shell` or any ancestor targeted by runtime JS with transform/filter?**
   - What we know: `main.css` does not apply `transform`, `filter`, or `will-change` to `.shell`. `privacy.js` applies blur to `.privacy-blur` elements inside tab panels, not to `.shell`.
   - What's unclear: Whether any other JS module (cloud-sync.js, theme.js, file-sync.js) injects inline styles on `.shell` with these properties.
   - Recommendation: DevTools audit — inspect `.shell` computed styles in each JS state (privacy on, cloud sync active). If none found, moving nav to `<body>` is a preventive fix rather than a reactive one. Either way, move is the correct action per STATE.md decision.

2. **Does the `onNeedRefresh` callback actually fire with `registerType: 'autoUpdate'`?**
   - What we know: `vite-plugin-pwa` documentation states `onNeedRefresh` fires when a new SW is waiting to be installed. With `autoUpdate`, the plugin adds auto-activation logic, but the `registerSW` callback from `virtual:pwa-register` still exposes lifecycle events.
   - What's unclear: The exact timing — does `onNeedRefresh` fire before or after the auto-reload with `skipWaiting: true` + `clientsClaim: true`?
   - Recommendation: Wire the callback as designed. The bar may flash briefly. If testing confirms it never fires (auto-reload too fast), BOTNAV-04 is still satisfied structurally and can be documented as "bar is positioned correctly when/if it appears." Do not change `registerType` — that is out of scope.

3. **What exact height does the nav reach on iPhone with safe area?**
   - What we know: `--bottom-bar-height: 72px` is the tab area height. `env(safe-area-inset-bottom)` is ~34px on iPhone X-series, ~20px on some older devices.
   - What's unclear: Whether 72px + 34px = 106px is the actual rendered nav height on all iPhones, or whether `padding-bottom` on the nav also increases its layout height (it does — padding is included in block height).
   - Recommendation: Verify on Safari simulator after adding `viewport-fit=cover`. The `--bottom-bar-height` variable only needs to equal the height of the tab icon area (72px), not the full nav element height including safe-area padding — the shell padding formula `calc(var(--bottom-bar-height) + env(safe-area-inset-bottom, 0px) + 8px)` mirrors the nav's padding-bottom calculation exactly.

---

## Validation Architecture

> `workflow.nyquist_validation` key is absent from `.planning/config.json` — treated as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + jsdom |
| Config file | `vitest.config.js` |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BOTNAV-01 | Bottom nav fixed and visible on all 8 tabs | manual-only | N/A — requires live browser; jsdom does not implement `position: fixed` | N/A |
| BOTNAV-02 | Last content item not hidden behind bottom nav | manual-only | N/A — requires browser layout engine + scrolling | N/A |
| BOTNAV-03 | iOS safe-area padding respected on real device | manual-only | N/A — requires Safari/iOS WebKit; Chrome DevTools does not simulate `env(safe-area-inset-bottom)` with `viewport-fit=cover` | N/A |
| BOTNAV-04 | Update bar appears above nav bar | unit (partial) + manual | `npm test -- --run` — verify `_showUpdateBar` creates element at correct class; visual position is manual | ❌ Wave 0 (optional) |

**Note:** BOTNAV-01 through BOTNAV-03 are CSS layout and iOS-specific rendering requirements. Vitest + jsdom cannot simulate `position: fixed`, `env()` CSS variables, or `viewport-fit` behavior. These must be verified in:
- Chrome DevTools at 390px (BOTNAV-01, BOTNAV-02 baseline)
- Safari responsive design mode or real iPhone (BOTNAV-03)

BOTNAV-04 is partially automatable: the `_showUpdateBar` function can be unit tested to confirm it creates a DOM element with `className === 'update-bar'` and appends it to `document.body`. Visual positioning above the nav is manual-only.

### Sampling Rate

- **Per task commit:** `npm test -- --run` (ensure existing 453+ tests still pass)
- **Per wave merge:** `npm test -- --run`
- **Phase gate:** Full suite green + manual browser verification checklist completed

### Wave 0 Gaps

- Optional: unit test for `_showUpdateBar()` in `src/ui/pwa-ux.js` — covers element creation and `document.body` insertion
- No new test infrastructure required — existing Vitest + jsdom setup covers what is automatable

*(All structural/positioning requirements are manual-only for this phase.)*

---

## Sources

### Primary (HIGH confidence)

- `css/main.css` — full inspection: confirmed `.nav-container` rules (lines 243–255), `.update-bar` CSS class (lines 487–512), `--bottom-bar-height: 72px` (line 24), `.shell` mobile padding (line 241), z-index inventory
- `index.html` — full inspection: confirmed `<meta name="viewport">` without `viewport-fit=cover` (line 5), `.nav-container` inside `.shell` (lines 42–54), no `.update-bar` element present
- `src/ui/pwa-ux.js` — full inspection: `registerSW` used with only `onOfflineReady` and `onRegisteredSW` callbacks (lines 116–134); `onNeedRefresh` absent; no `_showUpdateBar` function
- `vite.config.js` — full inspection: `registerType: 'autoUpdate'`, `skipWaiting: true`, `clientsClaim: true` confirmed
- `.planning/STATE.md` — confirmed: `viewport-fit=cover` missing; `env(safe-area-inset-bottom)` returns 0; moving `.nav-container` to `<body>` child is the correct fix; iOS verification requires real device or Safari simulator

### Secondary (MEDIUM confidence)

- MDN Web Docs: `env()` CSS function — `safe-area-inset-bottom` variable behavior, `viewport-fit=cover` requirement
- MDN Web Docs: `position: fixed` — containing block formation by `transform`/`filter`/`will-change`
- vite-plugin-pwa documentation: `registerSW` `onNeedRefresh` callback + `updateServiceWorker(true)` usage
- Apple Human Interface Guidelines: Safe Area — home indicator clearance, 34px typical inset for Face ID devices

### Tertiary (LOW confidence)

- Community practice: `env(safe-area-inset-bottom, 0px)` fallback syntax in `calc()` — the `, 0px` fallback is required in some calc contexts; confirmed pattern in multiple CSS sources but not explicitly documented in W3C spec examples

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all changes use native browser APIs and existing project infrastructure
- Architecture: HIGH — all files inspected directly; DOM structure, CSS rules, and JS functions confirmed line by line; STATE.md confirms key architectural decisions
- Pitfalls: HIGH — `env(safe-area-inset-bottom)` returning 0 without `viewport-fit=cover` is a well-documented iOS WebKit behavior; CSS containment trap is CSS-spec-defined; both confirmed in STATE.md as known risks for this phase

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable domain; CSS `env()` and `viewport-fit` have not changed since Safari 11.1)
