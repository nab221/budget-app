# Phase 36 Context: Navigator & View Toggle Redesign

## Scope Correction
An earlier draft of this file described Asset Tracker Enhancements — that work belongs in a future milestone. Phase 36 in the v3.0 roadmap is the Navigator & View Toggle Redesign as defined below.

## Objective
Replace the `<select>` month-select with a modern segmented control for the three view modes (This Month / Year to Date / All Time). Ensure the pay-period navigator added in Phase 34 is always visible without requiring the user to scroll on both desktop and mobile.

## Background

### Current State
The dashboard uses a `<select class="month-select">` element to navigate between calendar months alongside a `_selectedView` variable ('current' | 'ytd' | 'all'). There is no visible dedicated view-mode toggle — view switching happens silently through code paths. The pay-period navigator from Phase 34 is rendered in-flow and scrolls out of view as the user moves down the page.

### Segmented Control — View Toggle (MOB-03)
Replace the implicit view-mode switcher with a prominent `<div class="segmented-control">` component:
- Three segments: **This Month** | **Year to Date** | **All Time**
- Active segment: filled background in accent colour, white text
- Inactive segments: outline style, secondary text colour
- Keyboard accessible: arrow keys cycle between segments; Enter/Space activates
- Touch target height ≥ 44 px

The month navigator (`← [month select] →`) remains visible only in **This Month** mode; it is hidden in **Year to Date** and **All Time** modes.

### Navigator Fixed Position (NAV-02)
The pay-period navigator from Phase 34 must remain visible without scrolling:
- Desktop: `position: sticky; top: [header height]`
- Mobile: `position: fixed; top: [header height]; left: 0; right: 0; z-index: 999`
- Add sufficient `padding-top` to the dashboard content area on mobile to prevent content being hidden behind the fixed navigator.

## Files to Change
- `src/ui/components/segmented-control.js` — new shared component
- `src/ui/dashboard.js` — replace view-toggle with segmented control, wire keyboard events
- `css/main.css` — segmented control styles, navigator sticky/fixed positioning

## Acceptance Criteria
- [ ] Segmented control renders with 3 segments: "This Month", "Year to Date", "All Time"
- [ ] Active segment has filled accent-colour background and white text
- [ ] Clicking/tapping a segment updates the dashboard view range immediately
- [ ] Left/right arrow keys navigate between segments
- [ ] Enter or Space activates the focused segment
- [ ] Month navigator is hidden when view mode is "Year to Date" or "All Time"
- [ ] Pay-period navigator (Phase 34) is visible without scrolling on desktop and mobile
- [ ] No content is obscured by the fixed navigator on mobile
- [ ] No visual regression on desktop layout
- [ ] All existing Vitest tests pass
- [ ] Manual check on mobile required (HUMAN-VERIFICATION-REQUIRED)

## Technical Notes
- Keep `segmented-control.js` as a pure vanilla-JS component with no framework dependencies
- Emit a `change` event or accept an `onChange` callback to decouple the component from the dashboard module
- z-index layering: pay-period navigator `999`, bottom nav bar `1000` — keep navigator below bottom nav on mobile
- Heatmap year-boundary rendering fix (NAV-03): if Phase 27 did not fully resolve the year-wrap bug in the heatmap, patch it here before shipping the redesign
