# Phase 28 Context: Mobile Navigation Overhaul

## Objective
Make the main tab navigation permanently visible on all devices. On mobile, convert it to a fixed bottom bar with icons and labels. Make the header sticky. Eliminate the "disappearing tabs" regression reported for long-content pages.

## Background

### Problem
The current navigation (`#mainTabs` / `.tabs`) is positioned in normal document flow inside a `.nav-container`. On pages with many chart elements or long transaction tables (Dashboard, Expenses), the navigation scrolls off-screen and is not accessible without scrolling back to the top. On mobile this is a severe usability regression.

### Current Structure (index.html)
```html
<nav class="nav-container">
  <button id="mobileMenuBtn" class="mobile-menu-btn">☰</button>
  <div class="tabs" id="mainTabs">
    <button class="tab active" data-tab="dashboard">Dashboard</button>
    <button class="tab" data-tab="income">Income</button>
    ...
  </div>
</nav>
```
On mobile, the hamburger menu pattern is used — this must be replaced with a bottom tab bar.

### Target Design — Mobile (≤768px)
- Fixed bottom bar: `position: fixed; bottom: 0; left: 0; right: 0; z-index: 1000`
- Each tab: icon (emoji or SVG) + label text beneath
- Tab icons: Dashboard 🏠, Income 💰, Expenses 📋, Debts 💳, Payoff 📊, Assets 🏦, Childcare 👶, Settings ⚙️
- Height: ~56px (comfortable tap targets)
- All tab-panels must have `padding-bottom: 72px` to prevent content hiding behind the bar
- `#mobileMenuBtn` (hamburger): hidden on mobile when bottom bar is shown

### Target Design — Desktop (>768px)
- Keep existing horizontal tab bar at top — no change to desktop behaviour
- Make the header `position: sticky; top: 0; z-index: 100` so it persists on scroll

### Behaviour
- Active tab highlighted (colour accent, underline, or elevated icon)
- Tap switches tab-panel as before (existing JS logic in `src/app.js` reused)
- No hamburger menu on mobile — all 8 tabs visible simultaneously in the bottom bar (they can have short labels or icons-only if space is tight)

## Files to Change
- `css/main.css` — `.nav-container`, `.tabs`, `.tab`, `.tab-panel`, header sticky, mobile media query
- `index.html` — add icon markup to each tab button (or inject via JS), remove hamburger button visibility
- `src/app.js` — remove hamburger toggle logic (or guard it behind desktop-only condition)

## Acceptance Criteria
- [ ] On mobile, tabs are always visible at the bottom of the screen regardless of scroll position
- [ ] Each mobile tab shows an icon and a short label
- [ ] No tab-panel content is hidden behind the bottom bar (sufficient padding-bottom)
- [ ] On desktop, tabs remain horizontal at top — no visual regression
- [ ] Header is sticky on desktop and mobile
- [ ] Switching tabs works correctly (renders the correct panel)
- [ ] All 354+ Vitest tests pass (no JS logic changes that break tests)
- [ ] Manual cross-device check on iOS Safari and Android Chrome

## Technical Notes
- The bottom bar must not interfere with the Supabase magic link modal or notification toasts — ensure z-index ordering is correct
- On PWA standalone mode, the bottom bar must account for iOS safe-area insets: use `padding-bottom: env(safe-area-inset-bottom)` on the bar
- The `open` class on `#mainTabs` for mobile dropdown must be removed from the CSS logic once the bottom bar replaces it
