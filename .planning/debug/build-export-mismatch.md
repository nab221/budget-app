# Debug Session: Build Export Mismatch

## Symptoms
`npm run dev` and `vite build` fail with:
- `✘ [ERROR] No matching export in "src/utils/currency.js" for import "toPounds"`
- `✘ [ERROR] No matching export in "src/utils/currency.js" for import "formatCurrency"`
- `✘ [ERROR] No matching export in "src/ui/templates.js" for import "showModal"`
- `✘ [ERROR] No matching export in "src/ui/templates.js" for import "closeModal"`

## Investigation
- `src/utils/currency.js` exported `formatGBP` and `fromPence` but `expected-income.js` expected `formatCurrency` and `toPounds`.
- `src/ui/templates.js` had `showModal` and `closeModal` as methods on `templateUI` but they were not exported as standalone functions.
- `src/ui/expected-income.js` called `showModal` with an array of button objects in the footer argument, which the existing `modalUI.show` (in `render.js`) did not handle (it expected an HTML string).

## Root Cause
A mismatch between component expectations and utility exports/implementations, likely due to recent refactoring or new feature additions that didn't fully align with existing patterns.

## Fix
1.  **src/utils/currency.js**: Added `export const formatCurrency = formatGBP;` and `export const toPounds = fromPence;`.
2.  **src/ui/render.js**:
    - Updated `modalUI.show` to detect if `footer` is an array. If so, it dynamically creates buttons with the provided labels, classes, and `onClick` handlers.
    - Exported standalone `showModal` and `closeModal` functions that wrap `modalUI`.
3.  **src/ui/templates.js**: Re-exported `showModal` and `closeModal` from `render.js` to satisfy imports in `expected-income.js` and other components.

## Verification
- Ran `npx vite build` successfully (all modules transformed, build completed).
- Verified `expected-income.js` logic: `item.amount` (pence) correctly converted to pounds via `toPounds` alias and formatted via `formatCurrency` alias.
