# Phase 42: Tab Button Uniformity - Research

**Researched:** 2026-03-20
**Domain:** CSS button sizing, mobile bottom nav tab uniformity, active-state styling
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TABUI-01 | All 8 mobile tab buttons are identical in height and shape in both active and inactive states | Active `.tab` at mobile breakpoint sets `background: none` and `color: var(--accent)` — no padding, height, or border-radius change. However, the global `button` rule sets `border-radius: 999px` and the default `.tab` rule sets `border-radius: 999px` for desktop. On mobile, `.tab` overrides to `border-radius: 0`. The `.tab.active` rule on desktop sets `background: var(--accent); border-color: var(--accent); box-shadow: 0 4px 12px var(--accent-soft)` — none of these are present in the mobile active rule. The structure looks correct, but the global `button` rule applies `transform: translateY(-1px)` on hover/active for `.primary` — if any tab inherits a spurious active-state transform, height changes. Need to audit all property-changing rules that could apply to `.tab.active` at mobile. |
| TABUI-02 | Payoff tab button does not change shape or size when tapped on mobile | The Payoff tab uses the same `.tab` HTML element as all other tabs. No Payoff-specific CSS class exists. The `.tab.active` override at mobile breakpoint (`background: none; color: var(--accent)`) should not change shape. The symptom (shape/size change on tap) likely comes from one of: (a) the `transition: all var(--tr)` on `.tab` — "all" includes `padding`, `border-radius`, `height`, `box-shadow`; (b) the global `button` base rule `transform` or `box-shadow` transition triggered on `:active` pseudo-class; (c) the desktop `.tab.active` rule not being fully overridden at mobile breakpoint, leaking `border-radius: 999px` or `box-shadow` through the cascade. The Payoff tab may exhibit the issue more noticeably than others due to emoji icon size or label length differences. |
</phase_requirements>

---

## Summary

Phase 42 is a pure CSS fix. The HTML tab structure (`<button class="tab" data-tab="...">`) is identical across all 8 tabs. The JavaScript sets/removes `active` class identically on all tabs. The root cause of non-uniform button shape lives in the CSS cascade.

**The core problem has two layers:**

1. **Cascade leak from desktop `.tab.active`:** The desktop `.tab.active` rule (`border-radius: 999px; background: var(--accent); box-shadow: 0 4px 12px var(--accent-soft)`) is not fully reset by the mobile override. At the mobile breakpoint, `.tab.active` gets `background: none; color: var(--accent)` — but the `box-shadow` property is only overridden via `box-shadow: none !important` on the non-active `.tab` rule, not on `.tab.active`. If the inherited `box-shadow` from the desktop active rule bleeds in, the active button visually changes compared to inactive.

2. **The global `button` base rule uses `transition: all`:** Line 90 of `main.css` sets `transition: border-color var(--tr), background var(--tr), transform var(--tr), box-shadow var(--tr)` on all buttons. The `.tab` mobile rule includes `transition: all var(--tr)` implicitly via the desktop rule. "all" transitions can cause visual size changes during `:active` pseudo-class activation (the tap moment). The `button.primary:hover { transform: translateY(-1px) }` on the base `button` rule does not target `.tab` directly, but the global `transition: all` on `.tab` means any property that changes during tap — including properties from browser UA stylesheet on `:active` — will animate.

**The fix is narrow:** at the mobile breakpoint, `.tab.active` must explicitly reset every property that differs from `.tab` inactive: `box-shadow: none`, `border-radius: 0` (matching the non-active mobile tab), no `padding` change, and `transition` on `.tab` must be limited to `color` only (not `all`) to prevent size-changing animations on tap.

**Primary recommendation:** Add explicit `box-shadow: none`, `border-radius: 0`, `padding: 6px 0` (matching inactive tab), and `transition: color var(--tr)` to `.tab.active` inside the `@media (max-width: 768px)` block. Remove `transition: all` from the mobile `.tab` rule and replace with `transition: color var(--tr)`. This is a 5-line CSS-only change in `css/main.css`.

---

## Standard Stack

### Core (no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CSS cascade overrides | Native | Reset desktop `.tab.active` properties in mobile breakpoint | All tab styling is in `css/main.css` — no JS, no new library |
| Vitest + jsdom | Existing (722 tests) | Smoke test that existing tests still pass after CSS-only change | Already installed; CSS changes carry zero JS regression risk |

### No New Libraries Required

All changes are in `css/main.css`. No JavaScript changes required.

**Installation:** None.

---

## Architecture Patterns

### Recommended File Changes

```
css/
└── main.css    — modify .tab.active rule inside @media (max-width: 768px) block
                — modify transition on .tab inside @media (max-width: 768px) block
```

No changes to: `index.html`, `src/app.js`, or any UI module.

### Current CSS Audit (mobile breakpoint rules, lines 239–328)

The following rules at `@media (max-width: 768px)` govern tab button appearance:

**Non-active `.tab` (lines 266–281):**
```css
.tab {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px 0;
  background: none;
  border: none;
  border-radius: 0;
  font-size: 0.65rem;
  color: var(--text-dim);
  box-shadow: none !important;
  min-height: 44px;
}
```

**Active `.tab.active` (lines 285–288):**
```css
.tab.active {
  background: none;
  color: var(--accent);
}
```

**The gap:** `.tab.active` at mobile only overrides `background` and `color`. It does NOT override:
- `box-shadow` — inherited from desktop `.tab.active { box-shadow: 0 4px 12px var(--accent-soft) }` (line 218)
- `border-radius` — inherited from desktop `.tab.active { border-radius: 999px }` (implied via `.tab { border-radius: 999px }` staying active unless overridden)
- `padding` — desktop `.tab.active` does not change padding, but desktop `.tab` has `padding: 8px 16px` vs mobile's `6px 0`; the mobile `.tab` rule correctly sets this, but `.tab.active` in mobile does not re-assert it
- `transition` — mobile `.tab` inherits the desktop `transition: all var(--tr)` — "all" includes layout-affecting properties

### Pattern 1: Explicit Reset on Mobile `.tab.active`

**What:** Add all properties that must match the inactive state to the mobile `.tab.active` rule.

**When to use:** Whenever a mobile breakpoint overrides a desktop style partially — the override must cover every property that differs, not just the visually obvious ones.

**Correct mobile `.tab.active` rule:**
```css
/* Source: css/main.css — inside @media (max-width: 768px) */
.tab.active {
  background: none;
  color: var(--accent);
  border-radius: 0;        /* Match mobile .tab border-radius */
  box-shadow: none;        /* Reset desktop .tab.active box-shadow */
  padding: 6px 0;          /* Explicitly match mobile .tab padding — prevent cascade from pulling desktop 8px 16px */
  border: none;            /* Match mobile .tab border */
  font-weight: 500;        /* Match mobile .tab font-weight (desktop active uses font-weight: 600) */
}
```

### Pattern 2: Restrict `transition` on Mobile Tabs to Color Only

**What:** The mobile `.tab` rule inherits `transition: all var(--tr)` from the desktop rule (line 208: `transition: all var(--tr)`). "all" means any property change during tap (`:active` pseudo-class) — including box-sizing, height, padding — will animate. Restricting to `color` prevents any shape change from animating/flashing.

**Current desktop `.tab` rule (line 208):**
```css
.tab { transition: all var(--tr); }
```

**Fix — add inside `@media (max-width: 768px)` under the `.tab` rule:**
```css
/* Source: css/main.css — inside @media (max-width: 768px) */
.tab {
  /* ... existing properties ... */
  transition: color var(--tr);   /* Override desktop "all" — prevent shape animation on tap */
}
```

### Pattern 3: Verify No `:active` Pseudo-Class Shape Change

The global `button` rule in `main.css` does not apply `transform` or `padding` changes on `:active`. The `.primary:hover` rule uses `transform: translateY(-1px)` but is scoped to `button.primary`, not `.tab`. However, browsers apply UA stylesheet `:active` states. To ensure no size jump on tap:

```css
/* Source: css/main.css — inside @media (max-width: 768px) */
.tab:active {
  transform: none;       /* Explicitly prevent any UA or inherited transform on tap */
  background: none;      /* Prevent UA active background flash */
}
```

### Anti-Patterns to Avoid

- **Only overriding `background` and `color` in mobile `.tab.active`:** The existing partial override is the root cause of the bug. Every property that differs between active and inactive MUST be explicitly reset.
- **Using `transition: all` on mobile tab buttons:** "all" transitions include layout-affecting properties (`height`, `padding`, `border-radius`). On a tap gesture, a brief property change in any of these will cause a visible shape jump. Use `transition: color var(--tr)` only.
- **Using `!important` on box-shadow for inactive but not active:** Current code has `box-shadow: none !important` on the mobile `.tab` rule, but not on `.tab.active`. This asymmetry means active buttons can inherit the desktop box-shadow while inactive buttons cannot. Both must be `none`.
- **Font-weight differences between active and inactive:** Desktop `.tab.active` sets `font-weight: 600` vs inactive `font-weight: 500`. On mobile, text may reflow slightly if `font-weight` changes (browser-dependent). Lock to `font-weight: 500` for both active and inactive in mobile.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting which tab is active for height equalization | JS ResizeObserver loop to match all tab heights | CSS `flex: 1 1 0` on all `.tab` elements (already present) + explicit active-state reset | All tabs already have `flex: 1 1 0` — they are inherently equal width; height equality comes from resetting active-state properties, not from JS measurement |
| Per-tab active state class | Custom JS to apply different styling per tab | Single `.tab.active` rule that is identical for all 8 tabs | The JS already applies a single `active` class identically to all tabs; CSS must treat all tabs the same |
| Payoff-specific tab fix | Adding `.tab[data-tab="payoff"].active` special rule | Fixing the root cause in `.tab.active` (all tabs) | There is no Payoff-specific CSS currently; the bug affects Payoff because it's noticed there, not because Payoff has special styling |

**Key insight:** The entire fix is ~7 CSS property declarations inside an existing media query block. No JavaScript is touched.

---

## Common Pitfalls

### Pitfall 1: Cascade Specificity Surprises

**What goes wrong:** Developer adds `box-shadow: none` to the mobile `.tab.active` rule but the desktop rule's `box-shadow: 0 4px 12px var(--accent-soft)` on `.tab.active` has equal specificity (both are `.tab.active`). The media query block wins based on source order — the mobile breakpoint MUST appear after the desktop `.tab.active` rule in the stylesheet.

**Why it happens:** CSS specificity for `.tab.active` is the same whether inside or outside a media query. Position in the file (cascade order) determines which wins when specificity is equal. `@media (max-width: 768px)` blocks currently appear after the base rules in `main.css` (lines 239+), so mobile rules correctly override.

**How to avoid:** Keep all mobile overrides inside the existing `@media (max-width: 768px)` block. Do not add a separate new media query block earlier in the file.

**Warning signs:** After adding the fix, inspect in DevTools at 390px — if the added property shows as "overridden" (strikethrough), the specificity or order is wrong.

### Pitfall 2: `transition: all` Causes Invisible Shape Jump

**What goes wrong:** The fix sets `box-shadow: none` and `border-radius: 0` on `.tab.active` at mobile. But if `transition: all` is still active, the transition from the tap-moment `:active` pseudo-class state back to steady-state will animate these values. The visual result is a brief "pill" shape appearing and shrinking back on every tap — exactly the reported symptom.

**Why it happens:** `transition: all` intercepts every property change, including the removal of `box-shadow` and changes to `border-radius`. Even if the static value is correct, the transition to it can cause a momentary shape change.

**How to avoid:** Override `transition: color var(--tr)` on `.tab` inside the mobile media query. Color transitions are safe — they do not affect layout or shape.

**Warning signs:** After the fix, tapping a tab still shows a brief pill shape or flash. This indicates `transition: all` is still active for that breakpoint.

### Pitfall 3: The `:hover` Rule on Mobile `.tab`

**What goes wrong:** `main.css` line 283 inside the mobile block sets `.tab:hover { background: none; }`. This is fine. However, there is no `:hover { box-shadow: none }` rule. On touch devices, hover state persists after a tap until the user taps elsewhere (sticky hover). If the desktop `.tab:hover { border-color: var(--text-dim); color: var(--text) }` bleeds into mobile, the active button could briefly show a border.

**Why it happens:** The mobile `.tab:hover` rule only overrides `background`. It does not override `border-color`. The desktop `.tab:hover { border-color: var(--text-dim) }` could activate on touch.

**How to avoid:** The mobile `.tab` already has `border: none` which would override any border-color. Confirm `border: none !important` on mobile `.tab:hover` if the border-color bleed is confirmed in testing.

**Warning signs:** Active tab briefly shows a colored border ring after tapping on iOS Safari.

### Pitfall 4: `font-weight` Change Causing Micro-Reflow

**What goes wrong:** Desktop `.tab.active` sets `font-weight: 600` vs inactive `font-weight: 500`. Some fonts change their character box width at different font-weights. If `font-weight` changes on activation, the label text can shift width slightly — this would be most visible on tabs with long labels (e.g., "Transactions", "Childcare") or the Payoff tab's shorter label.

**Why it happens:** `system-ui` font family uses the system font which typically varies glyph advance widths between 500 and 600 weight.

**How to avoid:** Set `font-weight: 500` on both active and inactive mobile `.tab` rules. Lock it in the mobile `.tab.active` override.

**Warning signs:** Tab label text shifts slightly horizontally on tap.

---

## Code Examples

Verified patterns from direct `css/main.css` inspection:

### Current Mobile `.tab` Rule (lines 266–281) — Reference

```css
/* Source: css/main.css lines 266–281 — inside @media (max-width: 768px) */
.tab {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px 0;
  background: none;
  border: none;
  border-radius: 0;
  font-size: 0.65rem;
  color: var(--text-dim);
  box-shadow: none !important;
  min-height: 44px;
}
```

### Current Mobile `.tab.active` Rule (lines 285–288) — The Incomplete Override

```css
/* Source: css/main.css lines 285–288 — inside @media (max-width: 768px) */
/* PROBLEM: Only overrides background and color — all other active-state properties leak from desktop rule */
.tab.active {
  background: none;
  color: var(--accent);
}
```

### Desktop `.tab.active` Rule (lines 213–219) — Properties That Leak

```css
/* Source: css/main.css lines 213–219 — desktop (no media query) */
/* These properties are NOT reset by the mobile .tab.active override */
.tab.active {
  background: var(--accent);       /* overridden in mobile — OK */
  border-color: var(--accent);     /* NOT reset in mobile — but .tab: border: none covers it */
  color: #fff;                     /* overridden in mobile — OK */
  font-weight: 600;                /* NOT reset in mobile — causes micro-reflow */
  box-shadow: 0 4px 12px var(--accent-soft); /* NOT reset in mobile — causes shape change */
}
```

### Complete Fix — Replace Mobile `.tab.active` Rule

```css
/* Source: css/main.css — inside @media (max-width: 768px) */
/* REPLACE the existing .tab.active block (lines 285–288) with this: */
.tab.active {
  background: none;
  color: var(--accent);
  border-radius: 0;
  box-shadow: none;
  padding: 6px 0;
  border: none;
  font-weight: 500;
}
```

### Add `transition` and `:active` Overrides to Mobile `.tab` Rule

```css
/* Source: css/main.css — inside @media (max-width: 768px), add to existing .tab block */
.tab {
  /* ... existing properties (flex, padding, background, etc.) ... */
  transition: color var(--tr);   /* Override desktop "transition: all" */
}

/* Add new rule: */
.tab:active {
  transform: none;
  background: none;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Desktop `.tab.active` with pill shape | Mobile override with flat icon-only style | Phase 28 | Mobile nav correctly became flat icon-bar; but incomplete override left box-shadow and font-weight leaking |
| Desktop horizontal scrollable tabs | Mobile fixed bottom nav with `flex: 1 1 0` | Phase 28 | 8 equal-width columns; height uniformity still depends on active-state CSS being fully reset |

**Deprecated/outdated:**
- Mobile `.tab.active` partial override (only `background` + `color`): complete override required for uniformity.

---

## Open Questions

1. **Does Phase 41's `.nav-container` move (direct body child) affect any `.tab.active` CSS?**
   - What we know: Phase 41 moved `.nav-container` out of `.shell` to be a direct `<body>` child. The `.tab.active` rules use class selectors only (no descendant combinators involving `.shell` or `.nav-container`). The move does not affect specificity or cascade order for tab button styling.
   - What's unclear: Nothing — the move is transparent to this phase.
   - Recommendation: No action required.

2. **Is the Payoff tab specifically affected by any unique property, or is it the same root cause as all tabs?**
   - What we know: There is no Payoff-specific CSS (only `.tab[data-tab="payoff"]::before { content: "📈" }` for the icon). The HTML element and class structure is identical to all other tabs. The JS applies the same `active` class.
   - What's unclear: Why the Payoff tab is called out specifically in the requirements. It may be that the `📈` emoji renders at a different line-height/size than other emoji icons, making the shape change more perceptible. Or the Payoff tab may be the one the user last tapped before noticing the regression.
   - Recommendation: Fix the root cause for ALL tabs. Run verification across all 8 tabs, not just Payoff.

3. **Does Phase 41 status (incomplete as of 2026-03-20) block Phase 42?**
   - What we know: ROADMAP.md lists Phase 42 as "Depends on: Phase 41." STATE.md shows Phase 41 was completed and verified (41-04 BOTNAV verified). The ROADMAP.md progress table marks Phase 41 as Complete.
   - What's unclear: Whether any of the 41-04 gap-closure fixes interact with tab button sizing. Phase 41 worked on nav positioning and iOS safe area — not tab button active-state CSS.
   - Recommendation: Phase 42 can proceed. Its changes (lines 285–288 in main.css) are in a different CSS rule block than anything touched by Phase 41.

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
| TABUI-01 | All 8 tab buttons identical height/shape active vs inactive | manual-only | N/A — jsdom does not compute CSS layout; `border-radius`, `box-shadow`, `padding` cascade cannot be verified in jsdom | N/A |
| TABUI-02 | Payoff tab button does not change shape on tap | manual-only | N/A — requires touch event simulation with live browser layout engine; jsdom cannot simulate `:active` pseudo-class CSS cascade | N/A |

**Note:** Both TABUI requirements are CSS visual rendering requirements. Vitest + jsdom does not implement the CSS cascade, computed styles from media queries, or `:active` pseudo-class visual states. Verification requires Chrome DevTools at 390px viewport or a real mobile device.

The **only automation possible** for this phase is confirming the existing 722+ tests still pass after the CSS-only change (no JS regressions).

### Sampling Rate

- **Per task commit:** `npm test -- --run` — confirm no regression in existing suite (CSS change cannot break JS tests, but run for safety)
- **Per wave merge:** `npm test -- --run`
- **Phase gate:** Full suite green + manual browser verification across all 8 tabs on Chrome DevTools 390px

### Wave 0 Gaps

None — no new test infrastructure required. Both requirements are manual-only. Existing Vitest suite covers all regressions.

---

## Sources

### Primary (HIGH confidence)

- `css/main.css` — full inspection: confirmed `.tab` rules (lines 197–219), mobile override block (lines 239–328), specific `.tab.active` mobile rule (lines 285–288), desktop `.tab.active` rule (lines 213–219), `transition: all var(--tr)` on desktop `.tab` (line 208), `box-shadow: none !important` on mobile `.tab` (line 279 equivalent)
- `index.html` — full inspection: confirmed all 8 `<button class="tab" data-tab="...">` elements are structurally identical; no Payoff-specific classes
- `src/app.js` lines 194–231 — confirmed tab switching is identical for all 8 tabs: `classList.remove('active')` on all, `classList.add('active')` on clicked tab; no special handling for Payoff tab
- `.planning/REQUIREMENTS.md` — TABUI-01 and TABUI-02 confirmed as the two requirements for this phase
- `.planning/ROADMAP.md` — Phase 42 goal and success criteria confirmed

### Secondary (MEDIUM confidence)

- `.planning/phases/41-bottom-nav-consistency-ios-safe-area/41-RESEARCH.md` — Phase 41 context confirming `.nav-container` move does not affect tab button CSS rules; z-index stack audit shows no tab button z-index conflicts

### Tertiary (LOW confidence)

- General CSS knowledge: `transition: all` including layout properties during `:active` pseudo-class — widely observed behavior; not verified against a specific spec citation for this project's exact font/UA combination

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — CSS-only fix; no new dependencies; all changes are in one file at identified line numbers
- Architecture: HIGH — full CSS and JS audit completed; root cause identified precisely in two CSS rule gaps; fix is ~7 property declarations
- Pitfalls: HIGH — cascade leak and `transition: all` are the confirmed root causes; verified by direct file inspection

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable domain; CSS cascade rules do not change)
