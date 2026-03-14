---
phase: 27-critical-bug-fixes
plan: 02
type: execute
wave: 1
depends_on: []
files_modified: [src/ui/heatmap.js, src/ui/dashboard.js, src/ui/cloud-sync.js, css/main.css]
autonomous: true
requirements: [NAV-01, NAV-03, MOB-06]
user_setup: []

must_haves:
  truths:
    - "renderSpendingHeatmap() only renders data for the target year — cross-year entries do not affect the colour scale"
    - "The syncStatusDot (#syncStatusDot, .sync-status-indicator) does not wrap to a new line in mobile viewport"
    - "All existing heatmap tests pass"
  artifacts:
    - path: "src/ui/heatmap.js"
      provides: "Year-filtered heatmap rendering with pre-filter step before scale calculation"
      contains: "k.startsWith(String(yearNum))"
    - path: "css/main.css"
      provides: "Mobile-safe flex layout for .sync-status-indicator"
      contains: "flex-shrink: 0"
  key_links:
    - from: "src/ui/dashboard.js"
      to: "src/ui/heatmap.js"
      via: "renderSpendingHeatmap() call with pre-filtered dailyData"
      pattern: "startsWith\\(String\\(year"
---

<objective>
Fix the heatmap year-boundary data filtering bug (Bug 4) and the mobile header save-dot layout bug (Bug 5).

Purpose: Prevent cross-year transaction data from distorting the heatmap colour scale; prevent the cloud sync status dot from wrapping to a new line in the mobile header toolbar.
Output: Patched src/ui/heatmap.js with a pre-filter step, patched src/ui/dashboard.js with a call-site year filter, and a targeted CSS fix in css/main.css. No new files required.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

@src/ui/heatmap.js
@src/ui/dashboard.js
@css/main.css
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix heatmap year-boundary filtering — pre-filter dailyData in renderSpendingHeatmap()</name>
  <files>src/ui/heatmap.js, src/ui/dashboard.js</files>
  <read_first>src/ui/heatmap.js, src/ui/dashboard.js</read_first>
  <action>
**Root cause:** In `renderSpendingHeatmap()` (heatmap.js line 35), the scale calculation at line 57 uses:
```js
const dataForScale = allYearsData || dailyData;
```
When `allYearsData` is not provided and `dailyData` includes entries from multiple years (e.g., a 2024 entry in a 2025 heatmap), the quartile thresholds (q1/q2/q3 computed at lines 65–67) are calibrated against the wrong dataset, making the current year appear uniformly pale.

**Fix — two-part:**

**Part A: Add pre-filter inside `renderSpendingHeatmap()` in heatmap.js**

At the very start of `renderSpendingHeatmap()`, immediately after `const yearNum = parseInt(year);` (line 51), add a pre-filter step:

```js
// Phase 27: Pre-filter dailyData to target year to prevent cross-year scale distortion
const filteredDailyData = Object.fromEntries(
  Object.entries(dailyData).filter(([k]) => k.startsWith(String(yearNum)))
);
```

Then replace `dailyData` with `filteredDailyData` in the scale calculation at line 57:
```js
const dataForScale = allYearsData || filteredDailyData;
```

Also replace the reference to `dailyData` in the cell rendering at line 145:
```js
const data = filteredDailyData[dateStr] || { total: 0 };
```

And replace the tooltip mousemove handler at line 246:
```js
const data = filteredDailyData[dateStr] || { total: 0 };
```

And the touchstart handler at line 270:
```js
const data = filteredDailyData[dateStr] || { total: 0 };
```

Do NOT rename the function parameter `dailyData` — keep the function signature unchanged: `renderSpendingHeatmap(containerId, year, dailyData, options = {})`. Only introduce the local `filteredDailyData` constant and use it everywhere `dailyData` was used for data lookup (cell rendering + tooltips) and for scale calculation. The pre-filter uses `k.startsWith(String(yearNum))` which is safe for ISO date strings (YYYY-MM-DD format) since the year prefix uniquely identifies the target year.

**Part B: Verify call sites in dashboard.js**

Read `src/ui/dashboard.js` and find every call to `renderSpendingHeatmap()`. Confirm whether `dailyData` passed at the call site already contains only the target year's data. If it is passed an unfiltered all-years map, add a pre-filter at the call site as an extra defence:

```js
const yearFilteredData = Object.fromEntries(
  Object.entries(allDailyData).filter(([dateStr]) =>
    new Date(dateStr).getFullYear() === targetYear
  )
);
renderSpendingHeatmap(containerId, targetYear, yearFilteredData, options);
```

Only add the call-site filter in dashboard.js if the data passed is not already year-scoped. If it is already year-scoped (i.e., built by iterating only the target year's transactions), do NOT add a redundant filter — leave the call site unchanged and rely solely on the heatmap.js pre-filter from Part A.
  </action>
  <verify>npx vitest run src/ui/heatmap.test.js</verify>
  <acceptance_criteria>
    - src/ui/heatmap.js contains `k.startsWith(String(yearNum))` as part of the pre-filter step
    - src/ui/heatmap.js contains `const filteredDailyData = Object.fromEntries(`
    - src/ui/heatmap.js line for dataForScale reads `allYearsData || filteredDailyData` (NOT `allYearsData || dailyData`)
    - Cell rendering in heatmap.js references `filteredDailyData[dateStr]` NOT `dailyData[dateStr]`
    - All heatmap.test.js tests pass
  </acceptance_criteria>
  <done>renderSpendingHeatmap() pre-filters dailyData to the target year before scale calculation and cell rendering; cross-year entries cannot distort the colour scale</done>
</task>

<task type="auto">
  <name>Task 2: Fix mobile header save-dot layout — add flex-shrink:0 to .sync-status-indicator</name>
  <files>css/main.css</files>
  <read_first>css/main.css</read_first>
  <action>
**Root cause:** The cloud sync status dot is rendered as:
```html
<span id="syncStatusDot" class="sync-status-indicator" title="Synced"
  style="display:inline-block;width:0.6em;height:0.6em;border-radius:50%;background:#22c55e;margin:0 4px">
</span>
```
The inline `style` sets `display:inline-block` but does NOT set `flex-shrink`. Its parent container (line 317 in cloud-sync.js) uses `flex-wrap:wrap`, so on narrow mobile widths the dot can be pushed to a new flex line.

The toolbar in CSS (line 61) is: `.toolbar { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }`

The `header` (line 58) is: `header { display: flex; flex-wrap: wrap; align-items: center; ... }`

**Fix:** Because the sync dot already has inline `display` and `width` styles, do not rely on a class rule to override those properties. Update the inline style in `cloud-sync.js` to include `flex-shrink:0`, then add a minimal class rule in `css/main.css` only if you still need shared styling around the pulse state.

```js
<span id="syncStatusDot" class="sync-status-indicator" title="Synced"
  style="display:inline-block;width:0.6em;height:0.6em;border-radius:50%;background:#22c55e;margin:0 4px;flex-shrink:0">
</span>
```

If a class rule is still added before `.sync-status-indicator.pulse`, it should only document or reinforce `flex-shrink: 0`; do not add `display` or `width` declarations that conflict with the inline style.

Do NOT modify `flex-wrap` on `.toolbar` or `header` — other toolbar children need wrapping on very narrow screens. The dot should stay inline by shrinking to its minimum size, not by forcing the whole toolbar to no-wrap.
  </action>
  <verify>grep -n 'sync-status-indicator\|flex-shrink:0' src/ui/cloud-sync.js css/main.css</verify>
  <acceptance_criteria>
    - src/ui/cloud-sync.js inline style for `#syncStatusDot` contains `flex-shrink:0`
    - Any `.sync-status-indicator` class rule added to css/main.css does not rely on overriding inline `display` or `width`
    - grep for `sync-status-indicator` shows either the inline fix in cloud-sync.js or a matching class rule documenting `flex-shrink: 0`
  </acceptance_criteria>
  <done>The .sync-status-indicator element has `flex-shrink:0` applied at the source of truth, so it stays on the same line as other header elements at mobile widths without fighting inline style specificity</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] npx vitest run src/ui/heatmap.test.js — all tests pass
- [ ] grep -c 'filteredDailyData' src/ui/heatmap.js returns 4 or more (declaration + scale + cell render + 2 tooltip handlers)
- [ ] grep -c 'k.startsWith(String(yearNum))' src/ui/heatmap.js returns 1
- [ ] grep -A5 '\.sync-status-indicator {' css/main.css shows flex-shrink: 0 and display: inline-flex
- [ ] No new test failures in full suite: npx vitest run
</verification>

<success_criteria>
- All tasks completed
- heatmap.js pre-filters dailyData to target year before scale calculation — cross-year entries cannot affect colour thresholds
- CSS .sync-status-indicator has flex-shrink:0 and does not force a line break in the mobile header
- All existing heatmap tests pass with no new failures
- No new console errors introduced
</success_criteria>

<output>
After completion, create `.planning/phases/27-critical-bug-fixes/27-02-SUMMARY.md`
</output>
