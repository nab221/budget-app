# Phase 22 Plan: Export Reminder Includes Unsynced Settings Warning

## Objective
Verify and finalize the implementation of the export reminder warning and settings inclusion in manual backups.

## Strategy
1. **Verify Existing Logic:** The logic appears to be already implemented in `src/ui/pwa-ux.js` and `src/ui/backup.js`.
2. **Gap Analysis:** Check if all specified keys are correctly handled and if the warning message matches the requirement exactly.
3. **Verification Loop:** Perform manual and/or automated tests to ensure export/import works as expected.

## Step-by-Step Execution

### 1. Code Review & Verification
- [x] **PWA UX:** Check `_showExportReminder` in `src/ui/pwa-ux.js` for the extra sentence.
- [x] **Backup Export:** Check `executeExport` in `src/ui/backup.js` for the `settings` object construction.
- [x] **Backup Import:** Check `executeImport` in `src/ui/backup.js` for `localStorage` restoration.
- [x] **Constants:** Verify all keys in `src/utils/storage.js` are used.

### 2. Manual Verification (Simulated)
- Set mock `localStorage` values for all setting keys.
- Call `executeExport()` and inspect the resulting JSON blob.
- Clear `localStorage`.
- Call `executeImport()` with the JSON blob.
- Verify `localStorage` is restored correctly.
- Toggle `isConfigured()` (mocking env vars) and verify the reminder text changes.

### 3. Finalization
- Ensure `LAST_EXPORT_KEY` is correctly imported/exported across modules.
- Confirm `isConfigured()` accurately reflects Supabase presence.

## Verification Checklist
- [ ] Export reminder banner shows the extra sentence ONLY when Supabase is configured.
- [ ] Manual export includes the expanded `settings` object.
- [ ] Manual import restores all settings (Theme, Haptics, etc.).
- [ ] Old backups (without `settings`) still import correctly (forward compatibility).
