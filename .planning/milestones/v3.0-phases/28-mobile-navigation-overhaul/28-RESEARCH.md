# Phase 28: Mobile Navigation Overhaul - Research

**Researched:** 2026-03-14
**Domain:** CSS responsive navigation / PWA mobile bottom tab bar
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Bottom fixed tab bar on mobile (≤768px): `position: fixed; bottom: 0; left: 0; right: 0; z-index: 1000`
- Each tab shows icon + label text beneath (emoji or SVG, not icon library)
- Tab icons: Dashboard 🏠, Income 💰, Expenses 📋, Debts 💳, Payoff 📊, Assets 🏦, Childcare 👶, Settings ⚙️
- Bottom bar height ~56px, with `--bottom-bar-height` CSS custom property set to 72px for Phase 36 coordination
- All tab-panels must have `padding-bottom: 72px` to prevent content hiding behind the bar
- `#mobileMenuBtn` (hamburger) must be hidden on mobile when bottom bar is shown
- Header must be `position: sticky; top: 0; z-index: 100` on desktop and mobile
- No hamburger menu on mobile — all 8 tabs visible simultaneously in the bottom bar
- iOS safe-area: `padding-bottom: calc(env(safe-area-inset-bottom) + 8px)` on the bar itself
- Each tab button must include `aria-label` for screen reader accessibility
- Minimum tap target: `min-width: 44px; min-height: 44px` per WCAG guidelines

### Mobile Breakpoint Strategy (Locked)
- **> 420px**: Full icon + label for all 8 tabs
- **360–420px**: Icon + truncated label (`max-width: 6ch; overflow: hidden; text-overflow: ellipsis`)
- **< 360px**: Icons only, labels hidden (`display: none` on `.tab-label`)

### Claude's Discretion
- Whether to inject icon markup via JS or add directly to `index.html`
- CSS class naming for the label wrapper element (`.tab-label` is suggested)
- Exact active-tab highlight treatment (colour accent, underline, or elevated icon)
- Whether hamburger button is fully removed from markup or just hidden via CSS

### Deferred Ideas (OUT OF SCOPE)
- Switching to a full icon library (Lucide/Feather) — emoji approach is current standard for this codebase; icon library is mentioned as an option but not locked
- Any changes to desktop tab behaviour beyond making header sticky
- Phase 36 z-index navigator coordination (only needs `--bottom-bar-height` exposed)
</user_constraints>

<research_summary>
## Summary

The mobile bottom navigation pattern for this app is approximately 70% implemented. The existing `css/main.css` already converts `.nav-container` to a fixed bottom bar at the 768px breakpoint, applies `display: flex` to `.tabs`, and adds `padding-bottom: 80px` to `.shell`. The foundation is solid. What is missing is everything needed to make the implementation correct and complete: the 420px and 360px sub-breakpoints for narrow phones, iOS safe-area inset support, the `--bottom-bar-height` CSS custom property, `aria-label` attributes on tab buttons, a sticky header, and a guard on the hamburger JS logic.

The biggest technical risk is the conflicting `.tabs` rule at the 768px breakpoint (lines 273–278 in `main.css`) which sets `overflow-x: auto; justify-content: flex-start`, overriding the earlier `justify-content: space-around`. This is a real regression bug: on narrow devices the tabs pile up left-aligned and require horizontal scrolling instead of filling the bar evenly. This conflicting block must be identified and either removed or reconciled with the primary rule.

The implementation requires zero new libraries. Vanilla CSS media queries with `env(safe-area-inset-bottom)` handle all layout concerns. The existing emoji `::before` pseudo-element approach should be replaced with an explicit label wrapper (a `<span class="tab-label">` inside each button) so that label truncation and hide/show at sub-breakpoints can be targeted precisely. The hamburger JS logic in `app.js` (lines 135–151) is harmless while the button is hidden, but should be guarded with a null-check or visibility check to prevent silent errors if the button is ever removed from markup.

**Primary recommendation:** Fix the conflicting `.tabs` CSS block first, then layer in the sub-breakpoints and safe-area support. Add `aria-label` to HTML and expose `--bottom-bar-height`. No new dependencies needed.
</research_summary>

<standard_stack>
## Standard Stack

No new libraries are needed. This phase is pure Vanilla CSS + Vanilla JS.

### Core
| Technology | Version | Purpose | Why Standard |
|------------|---------|---------|--------------|
| Vanilla CSS media queries | N/A | Responsive breakpoint cascade | Already in use; no build tool needed |
| CSS custom properties | N/A | `--bottom-bar-height` coordination | Native, zero-cost, readable |
| `env(safe-area-inset-bottom)` | CSS env() — all modern browsers | iOS notch / home indicator spacing | The only correct mechanism; no polyfill needed |
| CSS `position: sticky` | Baseline 2017 | Sticky header | Native; no JS scroll listener needed |

### Supporting
| Technology | Version | Purpose | When to Use |
|------------|---------|---------|-------------|
| `aria-label` attribute | HTML standard | Screen reader tab identification | Required on every icon-only or icon+label button |
| `min-height: 44px` on `.tab` | WCAG 2.5.5 | Minimum touch target size | Required for AA compliance |
| `text-overflow: ellipsis` | CSS standard | Label truncation at 360–420px | Use on `.tab-label` inside 420px breakpoint |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS `::before` emoji icons (current) | Inline SVG per tab | SVG allows colour theming and crisp scaling; emoji are simpler but render inconsistently across OS; keep emoji for now per codebase convention |
| Inline SVG icons | Lucide/Feather icon library | Library adds a network dependency and build complexity the app deliberately avoids; not needed for 8 static icons |
| `env(safe-area-inset-bottom)` | JS `window.screen.height` hacks | The env() approach is the only standards-compliant method; JS hacks are fragile and break on orientation change |

**Installation:** No packages to install. No npm changes.
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Relevant File Structure
```
css/
└── main.css          # All responsive nav rules — single source of truth
index.html            # Tab button markup: add aria-label + span.tab-label
src/
└── app.js            # Guard hamburger toggle logic (lines 135–151)
```

### Pattern 1: Progressive Breakpoint Cascade (768 → 420 → 360)
**What:** The 768px block establishes the bottom bar. Inner breakpoints at 420px and 360px narrow the label display. Rules cascade narrowest-last so each breakpoint only overrides what it needs to change.
**When to use:** Any responsive component with multiple viewport modes.
**Example:**
```css
/* Source: MDN CSS media queries, progressive enhancement pattern */

/* ── 768px: bottom bar base ── */
@media (max-width: 768px) {
  :root {
    --bottom-bar-height: 72px;
  }

  .nav-container {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    height: var(--bottom-bar-height);
    padding-bottom: calc(env(safe-area-inset-bottom) + 8px);
  }

  .tabs {
    display: flex;
    justify-content: space-around; /* NOT flex-start — ensure no conflicting rule overrides this */
    align-items: stretch;
    height: 100%;
  }

  .tab {
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 44px;
    font-size: 0.65rem;
  }

  .tab-panel {
    padding-bottom: 72px; /* matches --bottom-bar-height; also use calc with safe-area if needed */
  }

  .mobile-menu-btn {
    display: none;
  }
}

/* ── 420px: truncate labels ── */
@media (max-width: 420px) {
  .tab-label {
    max-width: 6ch;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

/* ── 360px: icons only ── */
@media (max-width: 360px) {
  .tab-label {
    display: none;
  }
}
```

### Pattern 2: CSS Custom Property for Height Coordination
**What:** Declare `--bottom-bar-height` on `:root` inside the 768px media query so Phase 36 (and any other consumer) can reference it without hard-coding `72px` everywhere.
**When to use:** Any layout value that multiple rules or future phases need to coordinate on.
**Example:**
```css
/* Source: CSS custom properties spec / MDN */
@media (max-width: 768px) {
  :root {
    --bottom-bar-height: 72px;
  }

  .shell {
    padding-bottom: var(--bottom-bar-height);
  }
}
```

### Pattern 3: iOS Safe-Area Inset
**What:** Use `env(safe-area-inset-bottom)` inside a `calc()` to add bottom padding on top of the bar's own padding, preventing content from being obscured by iPhone home indicator.
**When to use:** Any fixed element docked to the bottom on a PWA or web app targeting iOS Safari.
**Example:**
```css
/* Source: WebKit blog "Designing Websites for iPhone X" / MDN env() */

/* Required in <head> for env() to have non-zero values on iPhone: */
/* <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"> */

.nav-container {
  padding-bottom: calc(env(safe-area-inset-bottom) + 8px);
}
```
Note: `viewport-fit=cover` must be present in the viewport meta tag or `env(safe-area-inset-bottom)` always returns 0.

### Pattern 4: Tab Label Wrapper for Targeted Breakpoint Control
**What:** Wrap the visible label text in `<span class="tab-label">` inside each `<button class="tab">`. This gives the sub-breakpoints a dedicated selector to truncate or hide without touching the icon or the button itself.
**When to use:** Any icon+label button where the label needs to respond independently.
**Example:**
```html
<!-- Source: ARIA button pattern + codebase convention -->
<button class="tab active" data-tab="dashboard" aria-label="Dashboard">
  <span class="tab-icon" aria-hidden="true">🏠</span>
  <span class="tab-label">Dashboard</span>
</button>
```

### Pattern 5: Guarded Hamburger JS Logic
**What:** Wrap the hamburger event listener attachment in a null-check so the code doesn't throw if the button is removed from markup in a future cleanup pass.
**When to use:** Any JS that queries a DOM element that may be conditionally present.
**Example:**
```js
// Source: Defensive DOM pattern — MDN optional chaining
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
if (mobileMenuBtn) {
  mobileMenuBtn.addEventListener('click', () => {
    document.getElementById('mainTabs')?.classList.toggle('open');
  });
}
```

### Sticky Header Pattern
```css
/* Source: MDN position: sticky */
header,
.app-header {
  position: sticky;
  top: 0;
  z-index: 100; /* below bottom bar's z-index: 1000 but above content */
}
```

### Anti-Patterns to Avoid
- **Two `.tabs` rules in the same media query block:** The current bug at lines 237–243 vs 273–281 in `main.css` — the second rule's `justify-content: flex-start` silently wins. Consolidate into one block.
- **`overflow-x: auto` on `.tabs` at 768px:** This enables horizontal scrolling, which is the wrong UX for a fixed bottom bar. The correct pattern is `space-around` distribution so all 8 tabs share the bar width equally.
- **Hard-coding `72px` in multiple places:** Use `var(--bottom-bar-height)` consistently. Hard-coded values drift when Phase 36 or a future phase adjusts the height.
- **`env()` without `viewport-fit=cover`:** On iOS, omitting this viewport meta attribute causes `env(safe-area-inset-bottom)` to always equal 0, silently breaking safe-area support.
- **Missing `aria-hidden="true"` on decorative emoji:** Screen readers will announce "house emoji" etc. without it. The `aria-label` on the button carries the accessible name; the icon must be hidden from AT.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| iOS safe-area padding | JS to detect iPhone model / screen height | `env(safe-area-inset-bottom)` in CSS | The CSS env() variable is provided by the browser and is always accurate; JS hacks break on new devices and orientation changes |
| Responsive nav state | JS to show/hide tabs on resize | CSS media queries only | A JS-driven approach adds resize listeners, risks flash of wrong layout on load, and re-introduces JS coupling that the hamburger removal was meant to clean up |
| Tab icon library | Custom SVG sprite system or npm icon package | Keep existing CSS `::before` emoji or add `aria-hidden` spans | 8 static icons don't justify a library dependency; emoji are zero-bytes |
| Tab height measurement for padding | `getBoundingClientRect()` in JS | CSS custom property `--bottom-bar-height: 72px` | The height is known and fixed at design time; measuring it in JS is fragile and causes layout thrash |
| Sticky header scroll detection | `scroll` event + `classList.add('sticky')` | `position: sticky` in CSS | Native CSS sticky is hardware-accelerated and requires zero JS |

**Key insight:** Every problem in this phase is a pure CSS layout problem. The existing JS tab-switching logic should be left untouched (except for guarding the hamburger). Adding JS to solve layout is adding complexity in the wrong layer.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Conflicting `.tabs` Rules Within the Same Media Query
**What goes wrong:** The bottom bar renders with `justify-content: flex-start` and horizontal scroll instead of evenly distributed tabs, because a second `.tabs` block later in the 768px media query overrides the first.
**Why it happens:** CSS cascade: the last rule with equal specificity wins. Two `.tabs` blocks inside the same `@media (max-width: 768px)` block — one at lines 237–243 with `justify-content: space-around`, one at lines 273–281 with `overflow-x: auto; justify-content: flex-start` — the latter wins silently.
**How to avoid:** Audit the 768px media query for duplicate selectors before adding new rules. Merge the two `.tabs` blocks into one.
**Warning signs:** Tabs bunch up on the left side of the bar; horizontal scrollbar appears at the bottom of the screen on mobile.

### Pitfall 2: iOS Safe-Area Returns 0 Due to Missing `viewport-fit=cover`
**What goes wrong:** On iPhones with a home indicator, the bottom bar overlaps the system gesture area. The `env(safe-area-inset-bottom)` fix appears to work in desktop dev tools but does nothing on a real device.
**Why it happens:** `env(safe-area-inset-bottom)` only returns a non-zero value when the viewport meta tag includes `viewport-fit=cover`. Without it, the browser uses its own default inset and the CSS env() variable is always 0.
**How to avoid:** Ensure `index.html` has `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
**Warning signs:** Safe-area padding looks correct in Chrome DevTools iPhone simulation but content is clipped behind home indicator on real iOS device.

### Pitfall 3: Z-Index Collision with Modals and Toasts
**What goes wrong:** The Supabase magic link modal or notification toasts appear behind the bottom nav bar.
**Why it happens:** The nav bar is `z-index: 1000`. Any modal or toast with `z-index` ≤ 1000 will render beneath it.
**How to avoid:** Verify that modal/toast z-index values are higher than 1000 (e.g. 1100+). The `--bottom-bar-height` custom property enables future phases to reason about layering without inspecting the nav CSS directly.
**Warning signs:** Modal backdrop visible but modal content partially or fully hidden; toast notifications appear to flash at the bottom of the screen then vanish under the nav bar.

### Pitfall 4: `padding-bottom` on Panel Not Applied at Sub-Breakpoints
**What goes wrong:** On a 350px-wide device, panel content is hidden behind the bottom bar even though the 768px padding-bottom rule is present.
**Why it happens:** If the `padding-bottom` is on `.shell` only (or on a specific panel) rather than on all `.tab-panel` elements, and if a narrower breakpoint overrides or resets padding, the content gap is lost.
**How to avoid:** Apply `padding-bottom: var(--bottom-bar-height)` on `.tab-panel` (or `.shell`) without overriding it in sub-breakpoints. The 72px value should survive all the way to 320px because the bar height does not change.
**Warning signs:** Last transaction row in a table is hidden; "Save" button at bottom of Settings is inaccessible.

### Pitfall 5: Sticky Header + Fixed Bottom Bar Z-Index Interaction
**What goes wrong:** On scroll, the sticky header overlaps dropdown menus or absolute-positioned elements that sit above the main content; alternatively the header z-index is set so high it occludes the bottom bar's own shadow/border.
**Why it happens:** Without an explicit z-index stacking context plan, both elements fight for visual precedence.
**How to avoid:** Use deliberate z-index tiers: content = default, sticky header = 100, bottom nav = 1000, modals = 1100+. These must be documented (ideally as CSS custom properties) so future phases don't break the stack.
**Warning signs:** Header shadow appears on top of a modal overlay; bottom bar is visible above a full-screen modal.

### Pitfall 6: Hamburger JS Logic Throwing on Missing Element
**What goes wrong:** If a future pass removes `#mobileMenuBtn` from `index.html`, lines 135–151 of `app.js` throw `Cannot read properties of null (reading 'addEventListener')`, breaking the entire app JS bundle.
**Why it happens:** `document.getElementById('mobileMenuBtn')` returns null when the element is absent; calling `.addEventListener` on null throws.
**How to avoid:** Wrap the hamburger listener block in a null-check: `const btn = document.getElementById('mobileMenuBtn'); if (btn) { ... }`. This is a low-cost guard that keeps the code robust regardless of markup changes.
**Warning signs:** Console error on app load; all tab-switching breaks because the JS error prevents the rest of `app.js` from executing.
</common_pitfalls>

<code_examples>
## Code Examples

### Safe-Area Inset Pattern for Fixed Bottom Bar
```css
/* Source: WebKit "Designing Websites for iPhone X"
   https://webkit.org/blog/7929/designing-websites-for-iphone-x/ */

/* 1. viewport meta must include viewport-fit=cover */
/* <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"> */

@media (max-width: 768px) {
  .nav-container {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    /* Safe-area padding: 8px buffer above the home indicator */
    padding-bottom: calc(env(safe-area-inset-bottom) + 8px);
  }
}
```

### CSS Custom Property + Breakpoint Cascade
```css
/* Source: CSS Custom Properties spec (MDN)
   https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties */

@media (max-width: 768px) {
  :root {
    --bottom-bar-height: 72px;
  }

  .tabs {
    display: flex;
    justify-content: space-around; /* uniform distribution across bar width */
    align-items: stretch;
  }

  .tab {
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 44px; /* WCAG 2.5.5 minimum touch target */
  }

  .tab-panel {
    padding-bottom: var(--bottom-bar-height);
  }
}

/* Narrow: truncate labels */
@media (max-width: 420px) {
  .tab-label {
    max-width: 6ch;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

/* Very narrow: icon only */
@media (max-width: 360px) {
  .tab-label {
    display: none;
  }
}
```

### Accessible Tab Button Markup
```html
<!-- Source: WAI-ARIA button pattern + CONTEXT.md icon spec
     https://www.w3.org/WAI/ARIA/apg/patterns/button/ -->
<button class="tab active" data-tab="dashboard" aria-label="Dashboard">
  <span class="tab-icon" aria-hidden="true">🏠</span>
  <span class="tab-label">Dashboard</span>
</button>

<button class="tab" data-tab="income" aria-label="Income">
  <span class="tab-icon" aria-hidden="true">💰</span>
  <span class="tab-label">Income</span>
</button>

<!-- Repeat for: Expenses 📋, Debts 💳, Payoff 📊, Assets 🏦, Childcare 👶, Settings ⚙️ -->
```

### Guarded Hamburger Logic in app.js
```js
// Source: Defensive DOM pattern
// Lines 135–151 of app.js should be wrapped as follows:

const mobileMenuBtn = document.getElementById('mobileMenuBtn');
if (mobileMenuBtn) {
  mobileMenuBtn.addEventListener('click', () => {
    const mainTabs = document.getElementById('mainTabs');
    mainTabs?.classList.toggle('open');
  });
}
```

### Sticky Header
```css
/* Source: MDN position sticky
   https://developer.mozilla.org/en-US/docs/Web/CSS/position#sticky */

/* Apply to whichever element wraps the app title / top bar */
.app-header,
header {
  position: sticky;
  top: 0;
  z-index: 100; /* below modal (1100) and bottom nav (1000) */
  background: var(--bg-color, #fff); /* must have a solid background or content shows through */
}
```

### Resolving the Conflicting `.tabs` Rules
```css
/*
  BEFORE (buggy — two blocks inside @media (max-width: 768px)):

  Block 1 (lines 237–243):
  .tabs { display: flex; justify-content: space-around; }

  Block 2 (lines 273–281) — THIS WINS and is wrong:
  .tabs { overflow-x: auto; justify-content: flex-start; }

  FIX: Delete Block 2 entirely, or merge intentional properties into Block 1.
  If horizontal scrollability is ever needed (e.g. desktop nav overflow),
  it should live in a separate, non-mobile selector, NOT inside the 768px block.
*/

@media (max-width: 768px) {
  /* Single consolidated .tabs rule */
  .tabs {
    display: flex;
    justify-content: space-around;
    align-items: stretch;
    overflow-x: hidden; /* explicitly prevent horizontal scroll on mobile nav */
  }
}
```
</code_examples>

<sota_updates>
## State of the Art (2025–2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hamburger menu for mobile nav | Fixed bottom tab bar with icon+label | 2019–2021 (iOS HIG, Material Design 3) | Bottom nav is now the universal mobile nav pattern; hamburger is considered a discoverability anti-pattern for top-level navigation |
| `constant(safe-area-inset-bottom)` | `env(safe-area-inset-bottom)` | iOS 11.2 (2017) | `constant()` is deprecated; use only `env()` |
| JS scroll listeners for sticky header | `position: sticky` CSS | Baseline 2017, widely used 2019+ | Native CSS, GPU-accelerated, zero JS |
| Separate breakpoint stylesheets | Single `main.css` with cascading `@media` blocks | N/A | Already the approach in use |
| Icon fonts (Font Awesome) | Inline SVG or emoji | 2022+ trend | Icon fonts have accessibility issues and extra network cost; inline SVG or emoji are preferred for small icon sets |

**New patterns relevant to this phase:**
- **`@supports (padding: env(safe-area-inset-bottom))`:** Wrapping safe-area rules in a `@supports` block is unnecessary in 2026 — all target browsers support it. Omit the feature query for simplicity.
- **CSS `min()` / `clamp()` for breakpoint-aware sizes:** Could replace the fixed `0.65rem` font-size on `.tab` with `clamp(0.55rem, 1.8vw, 0.75rem)` to smooth transitions between breakpoints.

**Deprecated/outdated:**
- **`constant(safe-area-inset-bottom)`:** Was needed for iOS 11.0–11.1 only. Drop it; adds confusion.
- **`-webkit-overflow-scrolling: touch`:** Removed from modern WebKit; not needed.
</sota_updates>

<open_questions>
## Open Questions

1. **Should `#mobileMenuBtn` be removed from `index.html` markup or just hidden via CSS?**
   - What we know: The button is currently hidden at 768px via `.mobile-menu-btn { display: none }`. The JS on lines 135–151 still wires it up. It plays no role in the new bottom bar design.
   - What's unclear: Whether any future phase or edge-case flow (e.g. a tablet-sized breakpoint between 768px and desktop) might re-introduce a menu button, or whether test fixtures reference `#mobileMenuBtn`.
   - Recommendation: Keep the element in markup for now but add the null-check guard in JS. A separate cleanup task can remove it once all 354+ tests confirm it is unreferenced. Removing it now risks an unexpected test failure if a test queries for it.

2. **Is scrollable `.tabs` at 768px intentional or an accidental leftover?**
   - What we know: The conflicting CSS block at lines 273–281 sets `overflow-x: auto; justify-content: flex-start`, which produces a horizontally scrollable tab row. The earlier block at lines 237–243 sets `justify-content: space-around`, implying all tabs should fit the bar width. Both cannot be right simultaneously.
   - What's unclear: Whether the `overflow-x: auto` block was an intentional affordance for a future state where more tabs might be added, or whether it was a copy-paste error/regression.
   - Recommendation: Treat it as a bug. The CONTEXT.md spec is unambiguous: all 8 tabs visible simultaneously with no scrolling. Delete the `overflow-x: auto; justify-content: flex-start` block. If the tab count ever exceeds the bar width, a `clamp()` font-size approach is preferable to horizontal scroll.

3. **Should the `.tab-label` span be injected via JS or added directly to `index.html`?**
   - What we know: The current tab buttons contain only text content (no wrapper spans). The sub-breakpoint CSS for label truncation/hiding requires a `.tab-label` selector to exist in the DOM.
   - What's unclear: Whether static HTML or JS injection is preferred in this codebase. JS injection would be cleaner for a one-time migration but adds runtime dependency. Static HTML is more transparent and testable.
   - Recommendation: Add the `<span class="tab-icon">` and `<span class="tab-label">` directly to `index.html`. It is a one-time change to 8 buttons, is immediately visible in source, and requires no JS.
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- MDN Web Docs — `env()` / safe-area-inset-bottom — https://developer.mozilla.org/en-US/docs/Web/CSS/env
- MDN Web Docs — `position: sticky` — https://developer.mozilla.org/en-US/docs/Web/CSS/position#sticky
- MDN Web Docs — CSS Custom Properties — https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties
- WebKit Blog — "Designing Websites for iPhone X" — https://webkit.org/blog/7929/designing-websites-for-iphone-x/
- WAI-ARIA Authoring Practices — Button Pattern — https://www.w3.org/WAI/ARIA/apg/patterns/button/
- WCAG 2.5.5 Target Size — https://www.w3.org/WAI/WCAG21/Understanding/target-size.html

### Secondary (MEDIUM confidence)
- Codebase audit of `css/main.css` lines 237–281 — confirmed conflicting `.tabs` rules at 768px breakpoint
- Codebase audit of `src/app.js` lines 135–151 — confirmed hamburger toggle logic present without null-check
- Codebase audit of `index.html` — confirmed 8 tab buttons, hamburger button present, no `aria-label` attributes

### Tertiary (LOW confidence - needs validation)
- None — all findings are based on direct codebase inspection and stable CSS/HTML standards
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Vanilla CSS responsive layout, CSS custom properties, PWA safe-area
- Ecosystem: No new libraries; existing CSS/HTML/JS only
- Patterns: Progressive breakpoint cascade, safe-area inset, CSS custom property coordination, ARIA labelling, sticky positioning
- Pitfalls: Conflicting CSS rules, iOS safe-area env() requirements, z-index stacking, JS null-check omission, padding-bottom regression at sub-breakpoints

**Confidence breakdown:**
- Standard stack: HIGH — no novel libraries; all CSS features are baseline supported
- Architecture: HIGH — patterns derived directly from codebase inspection and MDN/WebKit authoritative docs
- Pitfalls: HIGH — conflicting CSS rules confirmed by line-number audit; iOS safe-area behaviour is well-documented
- Code examples: HIGH — all examples use standard CSS/HTML; verified against spec sources

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (30 days — CSS standards are stable; no fast-moving ecosystem)
</metadata>

---

*Phase: 28-mobile-navigation-overhaul*
*Research completed: 2026-03-14*
*Ready for planning: yes*
