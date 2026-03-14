# Context: Phase 8 - Haptic Feedback

## Phase Goal
Implement a centralized haptic feedback utility (`src/utils/haptics.js`) and integrate tactile confirmation for all data-mutating actions, form validation failures, and critical UI state changes (Privacy Mode).

## Implementation Decisions

### 1. Pattern Definitions (Rhythmic)
The following vibration patterns (in ms) are locked:
- **tap**: `[10]` (Shortest possible pulse for UI interaction)
- **success**: `[30, 20, 30]` (Confident double-tap for save/confirm)
- **delete**: `[40, 15, 25, 15, 15]` (Staccato "crumple" feel for destructive actions)
- **error**: `[60, 40, 60]` (Heavy, slow rhythmic pulse for failures)

### 2. Validation Strategy
- **Mechanism**: Standard `alert()` calls for validation will be wrapped in `src/utils/haptics.js` as `alertWithHaptic(message, 'error')`.
- **Timing**: The haptic pulse must fire **synchronously before** the `alert()` call to ensure the vibration occurs before the main thread is blocked by the dialog.
- **Scope**: One pulse per submission attempt (reactive), not per individual invalid field.

### 3. Settings & Persistence
- **Storage**: Persist in `localStorage` under the key `budget_haptics_enabled`.
- **Default**: `true` (Enabled by default).
- **UI**: Add a checkbox to the "Settings" tab under a new "Preferences" section.
- **Feedback**: Toggling the setting to "Enabled" should trigger a `tap` haptic immediately.

### 4. UI Feedback Scope (Hybrid Rule)
Haptics are restricted to actions that **persist state** or **trigger risk**:
- **Include**:
  - Saving/Updating any record (Income, Expense, Debt, Asset, Target).
  - Deleting any record.
  - Toggling "Cleared" or "Reconciled" status.
  - Toggling **Privacy Mode** (security state change).
  - Form validation errors.
- **Exclude**:
  - Tab navigation.
  - Dashboard view changes (Current vs Month).
  - Filtering or searching.
  - Opening/closing modals.

### 5. Robustness & Constraints
- **Fallback**: Wrap `navigator.vibrate` in `try-catch` and check for support to ensure zero impact on desktop or iOS (where it will fail silently).
- **Debounce**: Success and Error patterns must be debounced by **300ms** per action type to prevent rapid-fire vibrations during accidental double-taps.
- **Duration**: Total pattern duration for 'error' is allowed at 160ms (overriding the general 150ms limit).

## Code Context
- **Utility Location**: `src/utils/haptics.js`
- **Settings UI**: `index.html` (markup) and `src/app.js` (listeners/population).
- **Integration Points**: 
  - `src/ui/expenses.js` (handleSaveExpense, deleteExpense, toggleExpCleared)
  - `src/ui/transactions.js` (Income mutations)
  - `src/ui/debts.js` (Debt mutations)
  - `src/ui/pwa-ux.js` (Privacy Mode toggle location)
  - `src/ui/render.js` (Global alert wrapper candidate)
