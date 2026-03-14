# Phase 36 Context: Navigator & View Toggle Redesign

## Objective
Redesign the Dashboard and tab navigators for a modern, consistent experience. Replace the `<select>` view dropdown with a segmented radio toggle. Make the pay-period navigator sticky/fixed. Ensure heatmap year navigation is clean and correct.

## Background

### Current Navigator Issues
1. The `<select>` dropdown for "Month View / Year to Date / All Time" is visually inconsistent with the rest of the app's modern aesthetic
2. The navigator (month picker + view selector) is not fixed — it scrolls away on long pages
3. On mobile, the navigator is positioned after heatmaps, making it hard to find
4. The heatmap year navigation (if it has year arrows) is not clearly connected to the view state

### Current DOM Structure (Dashboard)
```html
<!-- Phase 17 reflow: month picker + view select -->
<div style="display:flex; justify-content:center; ...">
  <div id="dashboardMonthPicker" class="month-nav"></div>
  <select id="viewSelect">
    <option value="current">Month View</option>
    <option value="ytd">Year to Date</option>
    <option value="all">All Time</option>
  </select>
</div>
```

## New Design: Segmented Control (Radio Toggle)

Replace `<select id="viewSelect">` with:
```html
<div class="view-toggle" role="radiogroup" aria-label="View period">
  <button class="view-toggle-btn active" data-view="current" role="radio" aria-checked="true">Month</button>
  <button class="view-toggle-btn" data-view="ytd" role="radio" aria-checked="false">YTD</button>
  <button class="view-toggle-btn" data-view="all" role="radio" aria-checked="false">All Time</button>
</div>
```

CSS: pill-shaped container, active button has filled background, smooth transition. No border, no dropdown arrow. Clean, iOS-style segmented control.

## Pay-Period Navigator

The pay-period navigator (from Phase 34) should be part of a **unified navigator bar** that sits just below the fixed header:
```
┌────────────────────────────────────────────┐
│  ‹ March 2026  ›    [ Month | YTD | All ]  │
│  Pay period: 25 Feb → 24 Mar               │
└────────────────────────────────────────────┘
```
- On mobile: this bar is `position: sticky; top: [header-height]` so it remains visible below the fixed header
- On desktop: stays in the content flow (can be sticky or static depending on UX preference)

## Heatmap Year Navigation
- Add year navigation arrows `‹ 2025 ›` above each heatmap
- Clicking arrows re-renders the heatmap for the selected year
- Heatmap data must be filtered strictly to the selected year before rendering (Phase 27 started this; Phase 36 ensures it is correct in the navigator-driven flow)
- Default selected year = current year

## Files to Change
- `css/main.css` — `.view-toggle`, `.view-toggle-btn`, segmented control styles, navigator bar styles
- `index.html` — replace `<select id="viewSelect">` with `.view-toggle` markup, add navigator bar HTML
- `src/ui/dashboard.js` — update view select event listener to handle `.view-toggle-btn` clicks; add heatmap year state management
- `src/ui/heatmap.js` — accept year parameter from navigator, filter data strictly

## Acceptance Criteria
- [ ] View toggle is a segmented control (pill buttons), not a `<select>` dropdown
- [ ] Active view is visually highlighted; switching works correctly for all three views
- [ ] Navigator bar is sticky below the header on mobile
- [ ] Month navigation arrows work as before
- [ ] Heatmap shows a year navigation (`‹ 2024 ›`) and re-renders when changed
- [ ] Heatmap year is independent of the month-view selector (different controls)
- [ ] No cross-year heatmap split (fully fixed from Phase 27)
- [ ] Segmented control is keyboard accessible (arrow keys navigate between options)
- [ ] All existing dashboard tests pass

## Technical Notes
- The `#viewSelect` element ID is referenced in `src/ui/dashboard.js` event listeners — update all references
- Ensure the navigator bar's sticky top offset accounts for the fixed header height (CSS variable: `--header-height`)
- Segmented control transitions: use `transition: background-color 0.2s ease` — respect `prefers-reduced-motion`
