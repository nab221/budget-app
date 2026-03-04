# Phase 2.1.1 Summary: Security & Persistence UX Polish

## Goal
Address critical security fallbacks for non-secure environments and align the persistence/sync user experience with Milestone 2.1 standards.

## Deliverables
- [x] **SEC-01: Centralized UUID Generation**: Created `src/utils/security.js` with a robust `generateUUID` function that handles fallbacks (Crypto API -> Math.random).
- [x] **SEC-01: Global Refactor**: Updated `src/db/schema.js`, `src/db/repository.js`, `src/ui/expenses.js`, and `src/utils/recurrence.js` to use the centralized utility.
- [x] **SYNC-01: Refined Banner Logic**: Persistence banner now only shows when storage is non-persistent AND no file is synced.
- [x] **SYNC-02: Terminology Standardization**: Renamed "Reset Persistence" to "Disconnect File" across UI and internal logic.
- [x] **SYNC-03: Dynamic Header Hints**: Header now explicitly shows "Auto-saving to [fileName]" or "Local Storage (IndexedDB)" with persistence status.

## Impact
- **Reliability**: App no longer crashes in non-HTTPS environments due to missing `crypto.randomUUID`.
- **Clarity**: Users have clear feedback on where their data is being saved and how to manage file connections.
- **Maintainability**: Security logic is now centralized and standardized.

---
*Completed: 2026-03-04*
