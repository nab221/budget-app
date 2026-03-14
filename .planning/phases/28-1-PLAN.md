---
phase: 28-mobile-navigation-overhaul
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [css/main.css]
autonomous: true
requirements: [MOB-01, MOB-02, NAV-01]
user_setup: []

# Goal-backward verification (derived during planning, verified after execution)
must_haves:
  truths:
    - "On mobile (≤768px), the tab bar is fixed to the bottom of the screen and never scrolls away"
    - "No tab-panel content is hidden behind the bottom bar at any supported viewport width"
    - "On mobile viewports ≤360px, tab labels are hidden and only icons are visible"
    - "On mobile viewports 361–420px, tab labels are visible but truncated with ellipsis"
    - "Header stays visible on scroll (sticky) on all viewport sizes"
    - "Each tab button meets the 44×44px minimum tap target (WCAG)"
    - "iOS PWA safe-area inset is respected so the bar is not obscured by the home indicator"
  artifacts:
    - path: "css/main.css"
      provides: "Mobile bottom nav layout, responsive breakpoints, sticky header"
      contains: "--bottom-bar-height"
    - path: "css/main.css"
      provides: "iOS safe-area support"
      contains: "safe-area-inset-bottom"
    - path: "css/main.css"
      provides: "420px sub-breakpoint for label truncation"
      contains: "@media (max-width: 420px)"
    - path: "css/main.css"
      provides: "360px sub-breakpoint for icon-only mode"
      contains: "@media (max-width: 360px)"
    - path: "css/main.css"
      provides: "Sticky header"
      contains: "position: sticky"
  key_links:
    - from: "css/main.css"
      to: ".nav-container"
      via: "768px media query — position: fixed; bottom: 0"
      pattern: "position:\\s*fixed"
    - from: "css/main.css"
      to: ".shell"
      via: "padding-bottom uses --bottom-bar-height variable"
      pattern: "var\\(--bottom-bar-height\\)"
---

<objective>
Fix the conflicting CSS rules in the 768px media query, introduce the `--bottom-bar-height` CSS variable, add iOS safe-area support, add WCAG minimum tap-target sizing, introduce responsive sub-breakpoints for narrow viewports, and make the header sticky.

Purpose: Complete the 30% of mobile nav CSS that is missing or broken. The conflicting second `.tabs` block currently overrides the correct flex layout and breaks the bottom bar. The missing variable, safe-area support, and breakpoints are required by the Phase 28 acceptance criteria and by Phase 36's z-index coordination.
Output: An updated `css/main.css` where the 768px block is clean, the variable is defined, and two sub-breakpoints handle narrow screens.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

@css/main.css
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix conflicting CSS rules, add CSS variable and safe-area support</name>
  <files>css/main.css</files>
  <read_first>css/main.css</read_first>
  <action>
Read `css/main.css` carefully before making any changes.

Inside the `@media (max-width: 768px)` block, make the following targeted edits:

1. **Add `--bottom-bar-height` variable** — At the top of the 768px media query (or in the nearest `:root` block within it), add:
   ```css
   :root {
     --bottom-bar-height: 72px;
   }
   ```
   If a `:root` block already exists inside the 768px query, add the variable there. If not, add a new `:root { --bottom-bar-height: 72px; }` block at the start of the 768px query.

2. **Remove the conflicting second `.tabs` block** — There are two `.tabs` rule-sets inside the 768px media query. The FIRST one (correct) sets `display: flex; justify-content: space-around`. The SECOND one (lines ~273–278/281) sets `overflow-x: auto; justify-content: flex-start` — this overrides the first and breaks the layout. DELETE the entire second `.tabs` block. Do NOT touch the first `.tabs` block.

3. **Update `.shell` padding-bottom** — Find `.shell` inside the 768px query and change its `padding-bottom` value to `calc(var(--bottom-bar-height) + 8px)`. If no such rule exists yet, add it to the `.shell` block inside the 768px query.

4. **Add safe-area inset to `.nav-container`** — Inside the 768px query, find the `.nav-container` block and add:
   ```css
   padding-bottom: calc(env(safe-area-inset-bottom) + 8px);
   ```
   This ensures the bar is not obscured by the iOS home indicator in PWA standalone mode.

5. **Add `min-height: 44px` to `.tab`** — Inside the 768px query, find the `.tab` block and add `min-height: 44px;` if not already present. This satisfies the WCAG 2.1 minimum tap-target requirement.

Do NOT change any rules outside the 768px query in this task. Preserve all other existing rules exactly.
  </action>
  <verify>grep -n "bottom-bar-height\|safe-area-inset-bottom\|min-height: 44px" css/main.css</verify>
  <acceptance_criteria>
    - `css/main.css` contains `--bottom-bar-height: 72px`
    - `css/main.css` contains `safe-area-inset-bottom`
    - `css/main.css` contains `min-height: 44px` inside the 768px media query `.tab` block
    - `css/main.css` contains `calc(var(--bottom-bar-height)` in the `.shell` padding rule
    - There is exactly ONE `.tabs` block inside the 768px media query (the conflicting second block has been removed)
    - The remaining `.tabs` block contains `justify-content: space-around` (NOT `flex-start`)
  </acceptance_criteria>
  <done>CSS variable defined, safe-area supported, WCAG tap target met, conflicting .tabs block removed</done>
</task>

<task type="auto">
  <name>Task 2: Add 420px and 360px sub-breakpoints for narrow viewports</name>
  <files>css/main.css</files>
  <read_first>css/main.css</read_first>
  <action>
After the closing `}` of the `@media (max-width: 768px)` block, append two new media query blocks:

**420px breakpoint — truncated labels:**
```css
@media (max-width: 420px) {
  .tab {
    font-size: 0.55rem;
    min-width: 44px;
  }
  .tab-label {
    max-width: 6ch;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
```

**360px breakpoint — icon-only mode:**
```css
@media (max-width: 360px) {
  .tab-label {
    display: none;
  }
  .tab {
    font-size: 0;
    gap: 0;
    min-width: 44px;
  }
}
```

Note on `.tab-label`: The tab buttons in `index.html` contain raw text (e.g., "Dashboard"). Plan 28-2 will wrap that text in `<span class="tab-label">`. These CSS rules target `.tab-label` in anticipation of that change. The rules are safe to add now — they will simply have no visual effect until Plan 28-2 adds the spans. If `.tab-label` spans already exist at the time of execution, the rules will activate immediately.

Do NOT modify any rules above these new blocks.
  </action>
  <verify>grep -n "max-width: 420px\|max-width: 360px\|tab-label" css/main.css</verify>
  <acceptance_criteria>
    - `css/main.css` contains `@media (max-width: 420px)`
    - `css/main.css` contains `@media (max-width: 360px)`
    - `css/main.css` contains `.tab-label` with `text-overflow: ellipsis` inside the 420px block
    - `css/main.css` contains `.tab-label` with `display: none` inside the 360px block
    - The 360px block appears AFTER the 420px block in the file (correct cascade order)
  </acceptance_criteria>
  <done>Two sub-breakpoints added; narrow viewport truncation and icon-only mode defined</done>
</task>

<task type="auto">
  <name>Task 3: Make header sticky</name>
  <files>css/main.css</files>
  <read_first>css/main.css</read_first>
  <action>
Find the `header` rule in `css/main.css` (it may be inside or outside a media query — check both). Add the following properties to the `header` rule:

```css
position: sticky;
top: 0;
z-index: 100;
```

If `header` already has a `background` or `background-color` property, leave it unchanged. If it does NOT have one, add `background: var(--bg);` (this prevents page content from showing through the sticky header while scrolling). If the variable `--bg` does not exist in the file, use `background: var(--background, #fff);` as a safe fallback.

If there is no existing `header` rule at all (search for `^header` and `header {` in the file), create one:
```css
header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--bg, #fff);
}
```

This rule must be placed OUTSIDE and ABOVE the 768px media query so it applies at all viewport sizes (desktop and mobile).
  </action>
  <verify>grep -n "position: sticky\|top: 0" css/main.css</verify>
  <acceptance_criteria>
    - `css/main.css` contains `position: sticky` in the `header` rule
    - `css/main.css` contains `top: 0` in the `header` rule
    - `css/main.css` contains `z-index: 100` in the `header` rule
    - The sticky header rule is NOT nested inside a media query (applies to all viewports)
  </acceptance_criteria>
  <done>Header is sticky at all viewport sizes</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `grep -c "overflow-x: auto" css/main.css` returns 0 inside the 768px query (conflicting rule removed)
- [ ] `grep -n "bottom-bar-height" css/main.css` shows the variable definition
- [ ] `grep -n "safe-area-inset-bottom" css/main.css` shows the nav-container padding rule
- [ ] `grep -n "max-width: 420px" css/main.css` shows the breakpoint
- [ ] `grep -n "max-width: 360px" css/main.css` shows the breakpoint
- [ ] `grep -n "position: sticky" css/main.css` shows the header rule
- [ ] `grep -n "min-height: 44px" css/main.css` shows the .tab rule inside 768px query
</verification>

<success_criteria>

- All tasks completed
- All verification checks pass
- No errors or warnings introduced
- `css/main.css` contains `--bottom-bar-height: 72px`
- `css/main.css` contains `safe-area-inset-bottom`
- `css/main.css` contains `@media (max-width: 420px)` and `@media (max-width: 360px)`
- `css/main.css` contains `min-height: 44px` for `.tab` in 768px query
- Header has `position: sticky; top: 0; z-index: 100`
- No duplicate/conflicting `.tabs` rules in 768px query — only one block, using `justify-content: space-around`
</success_criteria>

<output>
After completion, create `.planning/phases/28-mobile-navigation-overhaul/28-01-SUMMARY.md`
</output>
