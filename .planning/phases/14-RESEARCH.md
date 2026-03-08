# Phase 14 Research: UI Polish & Layout

## 1. Current Table Implementations & "Banner-style" Layouts
- **Current State:** Tables in `src/ui/expenses.js`, `src/ui/debts.js`, and `src/ui/dashboard.js` use a mix of styles. Some use `.tbl` classes, others have custom grid layouts.
- **"Banner-style":** This refers to the inline forms (e.g., `#debtFormContainer` in `debts.js`) and the "summary grid" (`.sum-grid`) which sometimes displays values above headings or in a non-standard row format.
- **Goal:** Shift all "add/fill" interactions to modals and ensure table rows are distinct, single-line (dynamic height) entries.

## 2. Existing Modal Infrastructure
- **Infrastructure:** `src/ui/render.js` contains a `modalUI` object:
    - `modalUI.show(title, content, footer)`
    - `modalUI.close()`
- **Usage:** Already used in `src/ui/debts.js` for some editing. It should be standardized for all new entry creations.

## 3. Dashboard Balance Cards
- **Location:** `src/ui/dashboard.js` -> `renderDashboard()`.
- **Classes:** Uses `.sum-grid` and `.sum-item`.
- **Unification:** `css/main.css` has some styles for `.balance-card`.
- **Plan:** Create or unify a `.dashboard-stat-card` class for:
    1. Running Balance
    2. Next Month Forecast
    3. 3-Month Forecast
- **Missing Data:** The logic needs to hide cards if `getMonthlyForecast` returns null/undefined for those periods.

## 4. Currency "k" Notation & Dynamic Font Scaling
- **"k" Notation:** `src/utils/currency.js` has `formatGBPShort`. This should be used on narrow screens.
- **Font Scaling:** `src/ui/render.js` has `adjustFontSize(element, value)`. This needs to be applied to the dashboard card values to prevent overflow.

## 5. Layout & Responsiveness
- **Mobile:** `.sum-grid` needs `flex-direction: column` or `grid-template-columns: 1fr` to stack cards.
- **Tables:** Ensure `overflow-x: auto` is handled or that rows wrap appropriately as per `14-CONTEXT.md`.

## 6. Verification Strategy
- **Breakpoints:** Test at 375px (mobile) and >1024px (desktop).
- **Dynamic Height:** Test with long category names in `src/ui/categories.js` or `src/ui/expenses.js` to ensure rows expand.
- **Missing Data:** Mock empty forecast data to verify cards are hidden.
