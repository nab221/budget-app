# Research: Phase 8 - Haptic Feedback

## 1. Feature Overview
The goal is to implement a centralized haptic feedback utility and integrate it across the app for data-mutating actions, form validation failures, and critical UI state changes. This will improve tactile confirmation for mobile users.

## 2. API Analysis: `navigator.vibrate`
- **Support**: Supported in Chrome, Firefox, Opera on Android. Not supported on iOS Safari (vibration is generally reserved for system-level haptics or Taptic Engine API which isn't available to Web Apps in the same way).
- **Behavior**: Accepts a single number (ms) or an array of numbers (pulse, gap, pulse, gap...).
- **Safety**: Must be wrapped in `try-catch` or checked for existence (`'vibrate' in navigator`).
- **Blocking**: `navigator.vibrate` is non-blocking. However, the context requires haptics to fire *before* `alert()`, which is blocking.

## 3. Integration Points Mapping
Based on codebase grep and `08-CONTEXT.md`:

### Utility
- `src/utils/haptics.js`: New file.
- `alertWithHaptic(message, type)`: Wrapper for `alert()`.

### Settings & Storage
- `src/utils/storage.js`: Add `HAPTICS_ENABLED_KEY = 'budget_haptics_enabled'`.
- `index.html`: Add checkbox in Settings tab.
- `src/app.js`: Initialize from `localStorage`, add event listener for toggle.

### Expenses (`src/ui/expenses.js`)
- `handleSaveExpense()`: `success` on save, `error` on validation failure.
- `deleteExpense()`: `delete` on confirm.
- `toggleExpCleared()`: `tap` on toggle.
- `handleMarkAllPaid()`: `success` on completion.

### Income (`src/ui/transactions.js`)
- `handleSaveIncome()`: `success` on save, `error` on validation failure.
- `deleteIncome()`: `delete` on confirm.
- `toggleIncCleared()`: `tap` on toggle (if applicable).
- `handleReconcileIncome()`: `success` on success.

### Debts (`src/ui/debts.js`)
- `handleSaveDebt()`: `success` on save.
- `deleteDebt()`: `delete` on confirm.
- `handleSaveStatement()`: `success` on save.

### Privacy Mode (`src/app.js` & `src/ui/pwa-ux.js`)
- `togglePrivacyMode()`: `tap` on toggle.

### Validation Errors (Global)
- Many `alert()` calls in `src/ui/expenses.js`, `src/ui/transactions.js`, `src/ui/debts.js`, etc.

## 4. Implementation Details
- **Patterns**:
  - `tap`: `[10]`
  - `success`: `[30, 20, 30]`
  - `delete`: `[40, 15, 25, 15, 15]`
  - `error`: `[60, 40, 60]`
- **Debounce**: 300ms per action type.
- **Synchronicity**: Haptic must trigger before `alert()`.

## 5. Potential Pitfalls
- **iOS Safari**: Vibration will not work, but the app should not crash.
- **Desktop**: No vibration, but no errors.
- **Double Taps**: Rapid vibrations could be annoying; debouncing is essential.
- **Blocking Alert**: If `alert()` is called before `vibrate()`, the vibration might be delayed or skipped until the alert is dismissed in some browsers. Synchronous ordering is key.
