# Phase 40: Sticky Header & Month Navigator - Research

**Researched:** 2026-03-18
**Domain:** CSS layout — `position: sticky` with scroll shadow, ResizeObserver, and sub-header anchoring in a Vanilla JS PWA
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HEADER-01 | User sees the top header stick at the top of all 8 tabs while scrolling | CSS `position: sticky` already declared; audit overflow ancestors before assuming CSS is wrong; add scroll reset on tab switch |
| HEADER-02 | User sees a shadow separator appear on the header only when the page is scrolled down | `scroll` event listener + CSS class toggle on `<header>`; or `IntersectionObserver` sentinel pattern |
| HEADER-03 | Header height is dynamically measured so the month navigator always positions correctly below it without overlap | `ResizeObserver` on `<header>` to write `--header-height` to `document.documentElement.style` at runtime |
| MONNAV-01 | User sees the month navigator (◀ Month ▶) stick at the top below the header on the Transactions tab while scrolling | `.month-nav { position: sticky; top: var(--header-height) }` already exists in CSS; the fix is making `--header-height` accurate and globally scoped |
</phase_requirements>

---

## Summary

Phase 40 is a pure CSS + minimal JS polish phase. The core functionality (sticky header, sticky month-nav sub-header) is already declared in `css/main.css`. The problems to solve are:

1. The header's sticky background does not cover the full viewport width on screens wider than the 1200px `.shell` max-width — scrolling content is visible at the edges.
2. `--header-height: 56px` is a hardcoded value declared inside a mobile media query. When `cloud-sync.js` injects content into `<header>` (adding toolbar buttons), the actual rendered height may differ. When notification banners are shown above `.shell`, the header shifts down — but `.month-nav { top: var(--header-height) }` does not adapt.
3. There is no scroll shadow on the header — HEADER-02 requires adding one.
4. Tab switching does not reset scroll position — switching from a scrolled-down tab opens the new tab mid-page with the sticky header already out of view.
5. `.month-nav` is mobile-only sticky (`top: var(--header-height)`) — this CSS already exists but depends on #2 being fixed first.

**Primary recommendation:** Fix in sequence: (a) DevTools audit to confirm header sticky is not broken by an overflow ancestor, (b) promote `--header-height` to global `:root` scope and wire a `ResizeObserver` to keep it accurate, (c) add `header::before` background bleed fix, (d) add scroll shadow via scroll listener, (e) add `window.scrollTo` to tab switch handler. All changes land in `css/main.css` and `src/app.js` only — no HTML changes, no new files.

---

## Standard Stack

### Core (no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS | ES2022 | `ResizeObserver`, scroll listener, class toggle | Already the app's only runtime; no framework overhead |
| CSS custom properties | Native | `--header-height` as single source of truth for sub-header offset | Already used throughout `main.css`; zero cost |

### No New Libraries Required

All features in this phase use native browser APIs available in every browser that supports the existing app (Chrome 90+, Safari 15+, Firefox 90+):
- `ResizeObserver` — broad support since 2020
- `window.scrollTo({ behavior: 'instant' })` — universal
- `IntersectionObserver` or `scroll` event — both available; `scroll` is simpler here

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure

No new files. All changes to:
```
css/
└── main.css          — CSS variable scope, header::before, scroll shadow class
src/
└── app.js            — ResizeObserver init, scroll listener, scrollTo on tab switch
```

### Pattern 1: ResizeObserver for Dynamic CSS Variable

**What:** Observe `<header>` height at runtime. Write the measured pixel value to `--header-height` on `:root`. This replaces the hardcoded `56px` value.

**When to use:** Any time a CSS variable must track a DOM element's rendered dimension, especially when that dimension can change due to dynamic content injection.

**Example:**
```javascript
// Source: MDN ResizeObserver — https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver
// Place in src/app.js init(), after DOMContentLoaded
const headerEl = document.querySelector('header');
if (headerEl) {
  const ro = new ResizeObserver(entries => {
    const h = Math.round(entries[0].contentRect.height);
    document.documentElement.style.setProperty('--header-height', `${h}px`);
  });
  ro.observe(headerEl);
}
```

**Why this approach over hardcoded value:**
- `cloud-sync.js` injects content into `#cloudSyncActionsHeader` inside `<header>` on load — the actual header height is unknown until JS runs
- Notification banners `#persistence-warning` and `#export-reminder` appear above `.shell`, pushing the viewport context down; the header's sticky position adapts but `--header-height` does not — causing `.month-nav` to overlap the header on the first pixel
- The `ResizeObserver` fires synchronously on layout, before paint, so the CSS variable is accurate before any sticky calculations apply

### Pattern 2: Scroll Shadow via Scroll Event + CSS Class

**What:** A single passive `scroll` listener on `window` adds/removes a class on `<header>`. A CSS rule applies `box-shadow` only when that class is present.

**When to use:** For a "shadow appears only when scrolled" effect. The alternative (`IntersectionObserver` sentinel) is equally valid but adds more DOM; for a single viewport-level scroll state, a scroll listener is simpler.

**Example:**
```javascript
// Source: standard scroll-shadow pattern, verified against MDN scroll events
// Place in src/app.js init()
window.addEventListener('scroll', () => {
  document.querySelector('header')
    ?.classList.toggle('scrolled', window.scrollY > 0);
}, { passive: true });
```

```css
/* Source: direct codebase pattern — add to header rule in main.css */
header.scrolled {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}
/* In dark mode, slightly more visible shadow */
[data-theme='dark'] header.scrolled {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
}
```

**Key detail:** Use `{ passive: true }` on the scroll listener — this signals to the browser that the listener will not call `preventDefault()`, allowing scroll to run on a compositor thread without waiting for the listener. Without this, Chrome logs a warning and scroll may be throttled.

### Pattern 3: Header Background Bleed Fix for Wide Viewports

**What:** `<header>` lives inside `.shell` (max-width: 1200px, centered). On viewports wider than 1200px, the 1200px-wide sticky header does not visually cover the full viewport width — content scrolling beneath is visible at the outer edges. A `::before` pseudo-element extends the background left and right to cover the full viewport.

**When to use:** Any sticky element inside a max-width container that must appear to span the full page width.

**Example:**
```css
/* Source: direct codebase analysis — main.css header rule */
header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--bg);
  /* Extend background to cover full viewport width on screens > 1200px */
}
header::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(-50vw + 50%);
  right: calc(-50vw + 50%);
  background: var(--bg);
  z-index: -1;
}
```

**Why `calc(-50vw + 50%)`:** When the element is centered (as `.shell` is via `margin: 0 auto`), `50%` is the element's half-width and `50vw` is half the viewport. The difference gives the pixel distance from the element's edge to the viewport edge. Positive to both sides fills the remaining space symmetrically.

### Pattern 4: Tab Switch Scroll Reset

**What:** Add `window.scrollTo({ top: 0, behavior: 'instant' })` to the tab click handler in `app.js`, immediately before the call to `renderAll()`.

**When to use:** Any SPA-style tab switch where page scroll position persists between panels.

**Example:**
```javascript
// Source: direct codebase analysis — src/app.js lines 172-205 (existing tab handler)
mainTabs.addEventListener('click', async (e) => {
  const t = e.target.closest('.tab');
  if (!t) return;
  // ... existing active class toggle ...

  // ADD THIS LINE before renderAll():
  window.scrollTo({ top: 0, behavior: 'instant' });

  await window.app.renderAll();
});
```

**Why `instant` not `smooth`:** `smooth` produces a visible scroll animation that takes ~300ms. The tab panel switch is instantaneous (class toggle). The user would see content mid-scroll on the new tab while the scroll animates to top — jarring. `instant` is the correct UX choice for tab navigation.

### Pattern 5: Promote `--header-height` to Global `:root`

**What:** `--header-height: 56px` is currently declared inside `@media (max-width: 768px) { :root { ... } }`. CSS custom properties declared on `:root` inside a media query are still globally readable at that breakpoint, but the value resolves to `initial` (effectively 0) at breakpoints outside the query. Promoting to the outer `:root` makes the variable available at all breakpoints.

**Current state (main.css lines 221-225):**
```css
@media (max-width: 768px) {
  :root {
    --bottom-bar-height: 72px;
    --header-height: 56px;
  }
}
```

**Fix — promote to global `:root` at top of file:**
```css
:root {
  /* ... existing variables ... */
  --header-height: 56px;      /* Runtime value overwritten by ResizeObserver in app.js */
  --bottom-bar-height: 72px;  /* Mobile bottom nav height */
}
```

**Keep or remove the media query block:** After promoting, the media query block is empty (or keep only if other variables need breakpoint overrides). Clean up the empty block.

### Anti-Patterns to Avoid

- **Adding `overflow: hidden` to `.shell` or `section.card`:** Creates a scroll container that silently breaks `position: sticky` on `<header>`. Use `overflow: clip` instead if visual overflow clipping is needed.
- **Adding `transform` or `filter` to `.shell`:** Creates a new containing block that traps `position: fixed` elements (relevant for Phase 41's bottom nav, but worth noting here so Phase 40 does not introduce the trap).
- **Raising `--header-height` to a larger hardcoded number:** The ResizeObserver approach makes this unnecessary. A hardcoded value will become stale again.
- **Scroll event with `{ passive: false }` or a non-passive default:** Causes scroll thread blocking in Chrome; results in DevTools "violation" warnings.
- **Using `scrollTop` instead of `window.scrollTo`:** `scrollTop` on `document.documentElement` vs `document.body` behaves differently across browsers; `window.scrollTo` is the cross-browser correct API.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Responsive header height measurement | Manual `getBoundingClientRect()` on scroll | `ResizeObserver` | ResizeObserver fires on every layout-affecting resize including content injection; getBoundingClientRect is a point-in-time snapshot |
| Full-viewport-width sticky background | Duplicate `<header>` in `<body>` outside `.shell` | `header::before` pseudo-element with `calc(-50vw + 50%)` | No HTML change; zero risk of duplicate event listeners or focus order issues |
| Scroll shadow | Canvas or SVG overlay | CSS `box-shadow` + class toggle | CSS transitions handle smooth appearance; zero JS layout cost |
| Tab-to-top navigation | Custom scroll position tracking per tab | `window.scrollTo({ top: 0, behavior: 'instant' })` | One line; browser-native; no state to maintain |

**Key insight:** All four problems in this phase have native browser solutions that are one CSS rule or one JavaScript line. The ResizeObserver is the only non-trivial addition — it has ~10 lines of setup code and replaces an entire class of bugs.

---

## Common Pitfalls

### Pitfall 1: `position: sticky` Silently Broken by Overflow Ancestor

**What goes wrong:** `header { position: sticky; top: 0 }` already exists in main.css. If an ancestor element has `overflow: hidden`, `overflow: auto`, or `overflow: scroll`, the sticky positioning is relative to that scroll container rather than the viewport. On tabs with heavy content (Income has a heatmap in `overflow-x: auto` containers), there is a risk that a wrapper was added with `overflow: hidden` at some point.

**Why it happens:** CSS spec: `position: sticky` requires the nearest ancestor scroll container to be the viewport. Any non-`visible`, non-`clip` overflow value on an ancestor creates an intermediate scroll container.

**How to avoid:** Before writing any CSS, open DevTools on each of the 8 tabs, select `<header>`, and check the Computed panel to confirm "Creates stacking context" is true and the scroll container ancestor is `<html>` (not `.shell`, `section.card`, or any `.tab-panel`).

**Warning signs:** Header scrolls away on Income or Expenses tabs but sticks on Dashboard. DevTools shows `position: sticky` in Styles panel but the element scrolls.

### Pitfall 2: `--header-height` Stale When Notification Banners Are Shown

**What goes wrong:** `#persistence-warning` and `#export-reminder` are siblings of `.shell` in the DOM (above it). When visible, they push `.shell` and everything inside it down. The `<header>` sticky `top: 0` is relative to the viewport scroll root — this still works correctly. But `--header-height: 56px` is not updated, so `.month-nav { top: var(--header-height) }` sticks at 56px from the top instead of below the header, causing overlap.

**How to avoid:** Use `ResizeObserver` — it fires whenever the header's content changes (including when banners cause a re-layout). The `contentRect.height` returned is the header's layout box height, which is what the `.month-nav` offset needs.

**Warning signs:** Month-nav sub-header overlaps the main header on Income or Expenses tab when the persistence warning banner is visible.

### Pitfall 3: Cloud-Sync Injection Increases Header Height Beyond 56px

**What goes wrong:** `cloud-sync.js` calls `_renderHeaderActions()` and injects buttons into `#cloudSyncActionsHeader` inside `<header>`. If the toolbar wraps to a second line due to the additional buttons, the header height increases beyond 56px. A hardcoded `--header-height: 56px` will then be too small.

**How to avoid:** The `ResizeObserver` handles this automatically. However, as a diagnostic step, open DevTools after cloud-sync buttons appear in the header and confirm the computed height. If it is > 56px with sync buttons visible, the hardcoded fallback value in `:root` should be updated to match (so the initial render before ResizeObserver fires is also correct).

**Warning signs:** Month-nav partially overlaps the bottom of the header when cloud sync is configured and buttons are visible.

### Pitfall 4: Scroll Shadow Class Not Cleared on Tab Switch

**What goes wrong:** The `scroll` event adds `header.scrolled` when `window.scrollY > 0`. If a user scrolls down, the class is added. When they switch tabs (with scroll reset), `scrollTo(0)` fires, but the `scroll` event may not fire synchronously — or may fire after the tab paint — leaving the shadow class present momentarily on the fresh-to-top tab.

**How to avoid:** Add `window.scrollTo({ top: 0, behavior: 'instant' })` in the tab handler and also immediately remove the `scrolled` class from `<header>` in the same handler, before rendering the new tab. The `scroll` event will confirm the class should be absent when it fires after the `scrollTo`.

```javascript
// In tab click handler, before renderAll():
window.scrollTo({ top: 0, behavior: 'instant' });
document.querySelector('header')?.classList.remove('scrolled');
```

**Warning signs:** Scroll shadow briefly flickers visible at the top of a freshly-switched tab before disappearing.

### Pitfall 5: ResizeObserver Firing on Every Scroll (Performance)

**What goes wrong:** If `<header>` has a CSS `transition` on height or padding, it will trigger `ResizeObserver` repeatedly during the transition, potentially dozens of times per second.

**How to avoid:** The current `header {}` rule has no `transition` property. Do not add one. The ResizeObserver will fire only on true layout changes (content injection, window resize affecting toolbar wrap). At this app's scale, this is never a concern.

---

## Code Examples

Verified patterns from direct codebase analysis:

### ResizeObserver for `--header-height` (add to src/app.js init())

```javascript
// Source: direct codebase analysis — src/app.js; ResizeObserver API per MDN
// Add after line 116 (after the parallel init block) in the init() function
const headerEl = document.querySelector('header');
if (headerEl) {
  new ResizeObserver(entries => {
    const h = Math.round(entries[0].contentRect.height);
    document.documentElement.style.setProperty('--header-height', `${h}px`);
  }).observe(headerEl);
}
```

### Scroll Shadow Listener (add to src/app.js init())

```javascript
// Source: direct codebase analysis; MDN scroll events with passive option
window.addEventListener('scroll', () => {
  document.querySelector('header')
    ?.classList.toggle('scrolled', window.scrollY > 0);
}, { passive: true });
```

### Tab Switch Scroll Reset (modify existing handler in src/app.js ~line 183)

```javascript
// Source: direct codebase analysis — src/app.js lines 172-205
// Existing code: panelId determined, active classes toggled
// ADD immediately before "await window.app.renderAll()":
window.scrollTo({ top: 0, behavior: 'instant' });
document.querySelector('header')?.classList.remove('scrolled');
```

### CSS Changes to main.css

```css
/* 1. Promote to global :root (remove from mobile media query) */
:root {
  /* existing vars ... */
  --header-height: 56px;     /* Initial fallback; overwritten by ResizeObserver at runtime */
  --bottom-bar-height: 72px; /* Mobile bottom nav height */
}

/* 2. Header background bleed — extend past .shell max-width on wide viewports */
header::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(-50vw + 50%);
  right: calc(-50vw + 50%);
  background: var(--bg);
  z-index: -1;
}

/* 3. Scroll shadow — appears only when .scrolled class is present */
header.scrolled {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}
[data-theme='dark'] header.scrolled {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
}

/* 4. Month-nav — already correct in mobile query; verify top value is accurate */
/* Source: main.css lines 279-284 (existing rule) */
@media (max-width: 768px) {
  .month-nav {
    position: sticky;
    top: var(--header-height);  /* Now dynamically updated by ResizeObserver */
    z-index: 99;
    background: var(--bg-alt);
  }
}
```

---

## Current CSS State (What Already Exists)

This section documents exactly what is already in the codebase so the planner knows what to verify vs. what to add.

| Feature | CSS Rule Location | Status |
|---------|------------------|--------|
| `header { position: sticky; top: 0; z-index: 100 }` | `main.css` line 58 | EXISTS — verify not broken by overflow ancestor |
| `header { background: var(--bg) }` | `main.css` line 58 | EXISTS — does not extend past `.shell` max-width |
| `.month-nav { position: sticky; top: var(--header-height) }` | `main.css` lines 280-281 (mobile query) | EXISTS — depends on `--header-height` being accurate |
| `--header-height: 56px` declared in mobile media query | `main.css` lines 222-225 | EXISTS — needs promoting to global `:root` |
| `--bottom-bar-height: 72px` declared in mobile media query | `main.css` lines 222-225 | EXISTS — promote together with `--header-height` |
| Scroll shadow (`box-shadow` on scroll) | Not present | MISSING — add `header.scrolled` rule |
| Tab switch `window.scrollTo` | Not present in `app.js` | MISSING — add to tab click handler |
| `header::before` background bleed | Not present | MISSING — add if wide-viewport coverage needed |
| ResizeObserver on header | Not present | MISSING — add to init() |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded `--header-height` | ResizeObserver updates at runtime | Phase 40 | Month-nav no longer overlaps header when banners or cloud-sync buttons change header height |
| No scroll shadow | CSS class toggle via scroll listener | Phase 40 | Visual cue that header is sticky and content is scrolling behind it |
| Tab switch lands mid-scroll | `scrollTo({ top: 0, behavior: 'instant' })` on tab switch | Phase 40 | User sees top of content on every tab switch |

---

## Open Questions

1. **Does the header actually fail to stick on any tab?**
   - What we know: `position: sticky; top: 0` is already declared globally. `.shell`, `section.card`, and `.tab-panel` do not have non-`visible` overflow in the current CSS.
   - What's unclear: Whether any JS module injects wrapper elements with `overflow: hidden` into tab panels. The Income tab has heatmap containers with `overflow-x: auto` — these are for horizontal scroll only and do not break vertical sticky. Needs live DevTools verification.
   - Recommendation: Make the DevTools audit the first task of Wave 1 — confirm or rule out overflow ancestor issue before writing CSS. If no broken sticky is found, HEADER-01 is already working and only needs the background bleed and scroll shadow additions.

2. **What is the actual rendered height of `<header>` with cloud-sync buttons visible?**
   - What we know: `--header-height: 56px` is the declared value. Cloud-sync injects buttons that may cause toolbar wrap on narrow screens.
   - What's unclear: Whether the toolbar wraps to a second line at mobile viewport widths with full cloud-sync buttons visible, which would make 56px wrong for the ResizeObserver fallback.
   - Recommendation: DevTools measurement during the audit step. Update the fallback value in `:root` if measurement differs from 56px. The ResizeObserver will handle runtime corrections regardless.

3. **Is MONNAV-01 about the current Income tab or a future Transactions tab?**
   - What we know: There is currently no "Transactions" tab in `index.html`. The "Income" tab (`data-panel="income"`) uses `transactionUI` and has `#incMonthPicker`. The Expenses tab (`data-panel="expenses"`) has `#expMonthPicker`. A "Transactions" tab combining income + expense transactions is to be built in Phase 45.
   - What's unclear: Whether MONNAV-01 means (a) ensure the current Income/Expenses month-navs stick correctly (the CSS already declares this), or (b) proactively prepare the sticky CSS so it works when the Transactions tab is built in Phase 45.
   - Recommendation: Interpret MONNAV-01 as covering the existing month-navs on Income and Expenses tabs — they already use `.month-nav` class and the `position: sticky; top: var(--header-height)` rule already applies. The fix is ensuring `--header-height` is accurate (ResizeObserver + promote to `:root`). The Transactions tab in Phase 45 will inherit the correct CSS automatically by using the same `.month-nav` class.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + jsdom |
| Config file | `vitest.config.js` (environment: jsdom) |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HEADER-01 | Header sticks on all 8 tabs while scrolling | manual-only | N/A — requires live browser rendering | N/A |
| HEADER-02 | Shadow appears only when scrolled down | manual-only | N/A — requires visual inspection in browser | N/A |
| HEADER-03 | Header height dynamically measured via ResizeObserver | unit | `npm test -- --run src/ui/header.test.js` | ❌ Wave 0 (optional) |
| MONNAV-01 | Month nav sticks below header with no overlap on banner show | manual-only | N/A — requires live browser and banner trigger | N/A |

**Note on manual-only tests:** HEADER-01, HEADER-02, and MONNAV-01 are CSS layout and visual behavior requirements. jsdom does not implement `position: sticky`, `window.scrollY`, or visual rendering. These must be verified in a real browser (Chrome DevTools device emulation at 375px width is sufficient for HEADER-01, HEADER-02, HEADER-03; live banner trigger for MONNAV-01).

### Sampling Rate

- **Per task commit:** `npm test -- --run` (ensure no existing tests broken by JS changes)
- **Per wave merge:** `npm test -- --run`
- **Phase gate:** Full suite green + manual browser verification checklist completed

### Wave 0 Gaps

- No new test files are strictly required for this phase. The changes are CSS rules and small JS additions (scroll listener, ResizeObserver, `scrollTo` call). Existing 453+ Vitest tests cover the JS modules being modified (`app.js`); the additions are non-breaking augmentations.
- Optional: a unit test for the ResizeObserver wiring in `app.js` if the planner determines test coverage for the JS addition is warranted.

---

## Sources

### Primary (HIGH confidence)

- `css/main.css` — full file inspection: confirmed existing sticky header declaration (line 58), `--header-height` in mobile media query (lines 221-225), `.month-nav` sticky rule (lines 279-284), complete z-index inventory
- `index.html` — full file inspection: confirmed DOM structure (header inside `.shell`), two notification banner placements, `#cloudSyncActionsHeader` injection point, all 8 tab panels
- `src/app.js` — full file inspection: tab switch handler (lines 172-205), confirmed no `window.scrollTo` call, confirmed no `ResizeObserver` on header
- `src/ui/cloud-sync.js` — confirmed `_renderHeaderActions()` injects buttons into `#cloudSyncActionsHeader` inside `<header>`
- `.planning/research/ARCHITECTURE.md` — direct codebase analysis confirming overflow ancestor risk, header background bleed issue, `--header-height` scope problem
- `.planning/research/PITFALLS.md` — pitfall inventory for sticky header, ResizeObserver recommendation, scroll-reset recommendation
- `.planning/research/SUMMARY.md` — Phase 1 of v3.1 confirmed as sticky header audit + fixes

### Secondary (MEDIUM confidence)

- MDN Web Docs: ResizeObserver API — `contentRect.height` pattern
- MDN Web Docs: `position: sticky` — overflow non-visible on ancestor breaks sticky
- MDN Web Docs: `window.scrollTo()` — `behavior: 'instant'` cross-browser support
- MDN Web Docs: EventTarget.addEventListener `passive` option — scroll performance

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all changes use native browser APIs present since 2020+
- Architecture: HIGH — all component responsibilities confirmed by direct file inspection; DOM structure verified line by line
- Pitfalls: HIGH — CSS sticky and overflow containment rules are CSS-specification-defined; pitfalls confirmed against actual codebase state (no `overflow: hidden` on ancestors found in current CSS, but JS module injection is the remaining risk requiring DevTools audit)

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable domain; CSS positioning rules do not change)
