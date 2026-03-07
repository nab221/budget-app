# Phase 14 Research: UI Polish & Layout

## Current State Analysis

### 1. Dashboard Balance Panel
- **Current Layout**: 
  - `balanceCard` (flex-row) contains "Running Balance" and "3-Month Forecast".
  - `nextMonthCardHtml` (separate div) appears below `balanceCard`.
- **Issues**: Styles are inconsistent between the two. The order is not as required (Running Balance → Next Month → 3-Month Forecast).
- **Files**: `src/ui/dashboard.js`, `css/main.css`

### 2. Spacing and Density
- **Current Styles**: 
  - `sum-item`: `padding: 9px`.
  - `tbl th`, `tbl td`: `padding: 5px 4px`.
  - `card`: `padding: 14px`.
- **Requirement**: Increase breathing room. `14-CONTEXT.md` specifies consistent padding and row height without overlaps.
- **Files**: `css/main.css`

### 3. Entry Management (Forms)
- **Current Implementation**: Inline forms in `index.html` toggled via `display: none` in UI modules.
- **Issues**: Causes "tightness" and potential overlaps on small screens.
- **Requirement**: Move to pop-up modals.
- **Files**: `index.html`, `src/ui/income.js`, `src/ui/expenses.js`, `src/ui/debts.js`, `src/ui/assets.js`

### 4. Text Wrapping & "Clamping"
- **Current Styles**: Some elements use `.nw { white-space: nowrap; }`.
- **Requirement**: Ensure text wraps within cells. Row height must be dynamic.
- **Files**: `css/main.css`, `src/ui/render.js` (for row rendering).

### 5. Currency Formatting
- **Requirement**: "k" notation for large values on narrow screens.
- **Files**: `src/utils/currency.js`

## Proposed Changes

1. **CSS**: Increase `sum-item` and `tbl` padding. Add `balance-banner` card styles.
2. **Utils**: Add `formatGBPShort` and `adjustFontSize` helper.
3. **Modal**: Generalize `templateUI.showModal` to a common utility in `render.js`.
4. **UI Modules**: Refactor `income.js`, `expenses.js`, etc. to trigger modals instead of toggling inline forms.
5. **Dashboard**: Update `renderBalancePanel` to unified card-based layout.

---
*Created on: 2026-03-01*
