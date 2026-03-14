# 21-PLAN.md — Deduplicate Merge Logic on File Import

## Strategy

Unify the disparate import logic into a single, robust utility in `src/db/backup.js`. Replace the basic `confirm()` prompts with a unified custom modal (`templateUI`) that offers an explicit "Overwrite vs Merge" choice.

## User Review Required

> [!IMPORTANT]
> - **Category Deduplication**: During Merge, if a category name matches (e.g., "Salary"), we will reuse the existing local ID rather than creating a duplicate. This ensures incoming records (income/expenses) correctly point to the local category.
> - **Schema Guard**: If a user tries to import a file from a *newer* version of the app (detected by `schema_version`), we will block the import to prevent data corruption.

---

## Proposed Changes

### 1. Database Layer (`src/db/backup.js`)

#### [NEW] `importBackupData(data, options)`
- **`options`**: `{ mode: 'overwrite' | 'merge', restoreSettings: boolean }`
- **Validation**:
    - Check `data.schema_version` (added to exports). Reject if `data.schema_version > current_db_version`.
    - Check `data.version` (backup format).
    - Check for presence of at least one table (e.g., `data.income` or `data.oneOffExpenses`).
- **Logic**:
    - Use a single `db.transaction('rw', db.tables, ...)`.
    - **Mode: Overwrite**: `await table.clear()` before `bulkPut`.
    - **Mode: Merge**:
        - Use `bulkPut` for most tables (File wins on ID match).
        - **Category Deduplication**: Special handling for `categories` and `categoryMappings`. Find existing by name; map incoming IDs to local IDs for any linked records in the same transaction.
- **Settings**: Restore `localStorage` if `restoreSettings: true`.

### 2. UI Layer (`src/ui/backup.js` & `src/ui/file-sync.js`)

#### [UPD] Unified Prompt Utility
- Create a shared helper in `src/ui/backup.js` that uses `templateUI.showModal` to present the Overwrite/Merge choice.
- The footer will contain two primary actions: `[Merge]` and `[Overwrite]`, plus `[Cancel]`.

#### [UPD] `src/ui/backup.js`
- Update `executeImport` to call the unified utility with `restoreSettings: mode === 'overwrite'`.

#### [UPD] `src/ui/file-sync.js`
- Replace `confirm()` in `loadFromData` with the new unified prompt.
- Update to call `importBackupData` with `restoreSettings: false`.

### 3. Data Export (`src/ui/backup.js`)
- Update the export envelope in `backupUI.executeExport` to include `schema_version: db.verno`.

---

## Verification Plan

### Automated Tests
- Create `tests/db/import-merge.test.js` using Vitest.
- **Test Cases**:
    - `Overwrite`: Check that local data is cleared and replaced.
    - `Merge`: Check that local data is retained, new data added, and IDs matching file data are updated.
    - `Category Dedupe`: Check that "Salary" from file merges with "Salary" locally without duplication.
    - `Schema Guard`: Check that importing a v99 schema fails safely.

### Manual Verification
1. Export a budget file.
2. Add a unique expense locally.
3. Import the file using **Merge**: Verify the unique expense remains.
4. Import the file using **Overwrite**: Verify the unique expense is gone.
5. Verify settings (Theme) are NOT restored on Merge.
