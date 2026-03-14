# Phase 22 Research: Export Reminder Includes Unsynced Settings Warning

## Current State Analysis

### Export Reminder Logic
- **Location:** `src/ui/pwa-ux.js`
- **Current Message:** "Your last data export was {days} days ago. Export now to keep your data safe."
- **Trigger:** `checkExportReminder()` checks `last_export_timestamp` in `localStorage`.
- **UI Element:** `#export-reminder` in `index.html`.

### Backup/Export Logic
- **Location:** `src/ui/backup.js`
- **Current Scope:** Only IndexedDB tables via `db.tables.map(t => t.name)`.
- **Settings:** Not currently included in the `.json` export payload.

### Storage Constants
- **Location:** `src/utils/storage.js`
- **Existing Keys:**
    - `BALANCE_START_DATE_KEY`
    - `BALANCE_OPENING_AMOUNT_KEY`
    - `PRIVACY_MODE_KEY`
    - `HAPTICS_ENABLED_KEY`
    - `THEME_KEY`
    - `PAYOFF_EXTRA_KEY`
    - `PAYOFF_STRATEGY_KEY`

## Proposed Changes

### 1. Update `src/ui/pwa-ux.js`
- Modify `_showExportReminder(daysSince)` to append the "unsynced settings" warning if `isConfigured()` (Cloud Sync active) is true.
- Import `isConfigured` from `../utils/supabase-sync.js`.

### 2. Update `src/ui/backup.js`
- In `executeExport()`, collect specified `localStorage` keys into a `settings` object.
- Include the `settings` object in the backup JSON envelope.
- In `executeImport()`, iterate over the `settings` object (if present) and restore them to `localStorage`.

### 3. Verification Points
- Confirm `isConfigured()` correctly detects Supabase presence.
- Ensure `localStorage` keys are correctly mapped to constants.
- Verify the backup JSON structure remains compatible with older versions (envelope approach).

## Conclusion
The implementation requires surgical updates to `src/ui/pwa-ux.js` and `src/ui/backup.js`. The logic for detecting cloud sync is already available in `src/utils/supabase-sync.js`.
