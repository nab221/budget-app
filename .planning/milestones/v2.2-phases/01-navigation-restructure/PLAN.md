# Phase 1: Navigation Restructure

**Goal**: Transform Dashboard into a top-level tab and reposition navigation.

## Status
The core restructuring of `index.html` and `src/app.js` has already been implemented. This phase now focuses on verification, styling refinement, and implementing the mobile-responsive menu.

## Tasks

### 1. Verification of Existing Changes
- [ ] Verify `index.html` has Dashboard as the first tab in `#mainTabs`.
- [ ] Verify Dashboard HTML is inside a `tab-panel` in `#tab-content`.
- [ ] Verify `#mainTabs` is at the top of the shell.
- [ ] Verify `src/app.js` handles the `dashboard` tab correctly.
- [ ] Verify Dashboard is the default active tab on load.

### 2. Styling & UX
- [ ] Refine `.tabs` styling in `main.css` for horizontal scroll and prominence.
- [ ] Implement the mobile-responsive hamburger menu (NAV-07).
  - [ ] Add CSS for `.mobile-menu-btn` and media queries for `< 768px`.
  - [ ] Ensure menu closes after tab selection.

### 3. Verification
- [ ] App loads without error.
- [ ] Dashboard tab is active by default.
- [ ] Switching to other tabs works correctly.
- [ ] Responsive view (< 768px) shows hamburger menu and toggles correctly.

## Testing Strategy
- **Manual Verification**: Check layout in browser at various screen widths.
- **Console Check**: Ensure no initialization errors.
- **Tab Flow**: Navigate through all tabs to ensure `renderDashboard` or specific tab renders are called appropriately.
