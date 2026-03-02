# Project Roadmap: Budget App Porting v1.4

This roadmap focuses on porting the File System Access API integration from the legacy `budget-app.html` monolith to the modern modular architecture (`src/` and `index.html`).

## Phases

- [ ] **Phase 1: Repository Refactor** - Centralize all database mutations and integrate `triggerSync()` in `src/db/repository.js`.
- [ ] **Phase 2: Sync Manager Implementation** - Implement debounced background sync orchestration in `src/utils/sync-manager.js`.
- [ ] **Phase 3: File System Storage Utility** - Port `FileSystemHandle` persistence and permission lifecycle management to `src/utils/storage.js`.
- [ ] **Phase 4: Sync UI Integration** - Integrate Local File Sync UI elements in `index.html` and `src/ui/backup.js`.
- [ ] **Phase 5: Sync Resilience Logic** - Implement robust error handling and exponential backoff for cloud-synced folder locks.
- [ ] **Phase 6: Legacy Cleanup & Validation** - Archive `budget-app.html` and perform final end-to-end verification.

## Phase Details

### Phase 1: Repository Refactor
**Goal**: Centralize all database mutations and enable sync triggers.
**Depends on**: Nothing
**Requirements**: REPO-01, REPO-03
**Success Criteria** (what must be TRUE):
  1. All database writes in `src/db/repository.js` call `triggerSync()`.
  2. `src/db/repository.js` provides methods for all necessary budget operations.
  3. No functional regressions in existing app features.
**Plans**:
- [ ] 01-01-PLAN.md — Category and Statement Repositories refactor
- [ ] 01-02-PLAN.md — Childcare and Snapshot Repositories refactor
- [ ] 01-03-PLAN.md — Expected Income, Net Worth refactor and Final Audit

### Phase 2: Sync Manager Implementation
**Goal**: Orchestrate debounced background sync operations.
**Depends on**: Phase 1
**Requirements**: SYNC-01, SYNC-02, SYNC-04
**Success Criteria** (what must be TRUE):
  1. `src/utils/sync-manager.js` provides a debounced `scheduleSync` function (2-5s).
  2. A full database export is triggered automatically after mutations.
  3. The sync operation occurs without blocking the main UI thread.
**Plans**: TBD

### Phase 3: File System Storage Utility
**Goal**: Securely store and retrieve local file handles across sessions.
**Depends on**: Phase 2
**Requirements**: FS-01, FS-02, FS-03, FS-04
**Success Criteria** (what must be TRUE):
  1. User can pick a local file and have its handle persisted in IndexedDB.
  2. The handle survives page reloads and browser restarts.
  3. App successfully queries and requests permissions for the handle on load.
**Plans**: TBD

### Phase 4: Sync UI Integration
**Goal**: User interface for local file sync configuration.
**Depends on**: Phase 3
**Requirements**: UI-01, UI-02, UI-03, UI-04
**Success Criteria** (what must be TRUE):
  1. "Local File Sync" section appears in the Backup settings of `index.html`.
  2. User can select a file and see its name and current sync status.
  3. Manual "Re-connect" button is functional for handles with lost permission.
**Plans**: TBD

### Phase 5: Sync Resilience Logic
**Goal**: Robust handling of file lock errors (e.g., OneDrive/Dropbox).
**Depends on**: Phase 4
**Requirements**: SYNC-03
**Success Criteria** (what must be TRUE):
  1. Sync retries automatically if `NoModificationAllowedError` occurs.
  2. Exponential backoff (e.g., 1s, 2s, 4s...) is applied to retries.
  3. Permanent sync failures are clearly reported to the user via the UI.
**Plans**: TBD

### Phase 6: Legacy Cleanup & Validation
**Goal**: Remove legacy code and verify the final integrated feature.
**Depends on**: Phase 5
**Requirements**: REPO-02, DOCS-01, DOCS-02, VAL-01, VAL-02
**Success Criteria** (what must be TRUE):
  1. `budget-app.html` is safely moved to an archive location.
  2. README is updated with clear instructions for the new feature.
  3. Data is verified to be consistent between IndexedDB and the local file after multiple sessions.
**Plans**: TBD

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Repository Refactor | 0/3 | Not started | - |
| 2. Sync Manager Implementation | 0/1 | Not started | - |
| 3. File System Storage Utility | 0/1 | Not started | - |
| 4. Sync UI Integration | 0/1 | Not started | - |
| 5. Sync Resilience Logic | 0/1 | Not started | - |
| 6. Legacy Cleanup & Validation | 0/1 | Not started | - |
