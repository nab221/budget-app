# 21-CONTEXT.md — Deduplicate Merge Logic on File Import

## Phase 21: Deduplicate Merge Logic on File Import

### Decisions

#### 1. Merge Strategy & Conflict Handling
- **Strategy**: Simple ID-based upsert (`bulkPut`) for all entities except categories.
- **Deletions**: Local items not present in the import file are **retained** during a Merge. A merge never deletes data.
- **Conflict Rule**: In a Merge, the incoming file's record wins if IDs match (overwrite existing local record with the same ID).
- **Explanation**: The UI must explicitly state: *"Overwrite replaces all local data. Merge adds new records and updates existing ones by ID — it never deletes."*

#### 2. UX & Prompting
- **Unification**: Manual file upload (Import button) and File-Sync/OPFS load flows must use the same logic and prompts.
- **UI Component**: Replace all raw `confirm()` and `alert()` calls with `templateUI` custom modals for a consistent UX.
- **Choice**: Both flows will offer a clear choice between **Overwrite** and **Merge**.

#### 3. Scoped Settings Migration
- **Device-Specific**: Settings (theme, privacy mode, haptics) are **device-specific** for file-sync and OPFS imports. Do not restore them automatically.
- **Manual Import**: Restore settings **only** during manual backup imports, and **only** if the user chooses **Overwrite**.
- **Merge Rule**: Settings are **never** restored or overwritten during a "Merge" operation, regardless of the source.

#### 4. Transaction & Integrity Guardrails
- **Validation (Pre-Transaction)**:
    - Verify valid JSON structure.
    - Check that the `schema_version` in the file is ≤ current DB version (reject/warn if newer).
    - Verify presence of at least one core table key (e.g., `income`, `oneOffExpenses`) to prevent unrelated JSON imports.
- **Category Deduplication**: During Merge, `categories` and `categoryMappings` must be deduplicated by **name** to avoid creating duplicate "Groceries" or "Salary" entries.

### Code Context

#### Integration Points
- `src/db/backup.js`: Host the unified `importBackupData(data, options)` utility.
- `src/ui/backup.js`: Update to use the new modal and unified import utility.
- `src/ui/file-sync.js`: Update `loadFromData` to use the new modal and unified import utility.

#### Reusable Assets
- `templateUI.showModal`: For the Overwrite/Merge choice dialog.
- `db.transaction('rw', ...)`: For atomic import/merge operations.
- `categoryRepository.getByName`: (To be verified) for name-based deduplication.

---
**Next Step**: Run `research-phase 21` to map out the exact code changes and category deduplication logic.
