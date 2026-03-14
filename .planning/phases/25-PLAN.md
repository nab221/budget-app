# Phase 25 Plan: Technical Polish (Category Mapping & UI Testing)

## Objective
Resolve deferred technical gaps to improve data integrity during imports and ensure long-term stability through robust UI testing.

## Context
- **Fuzzy Mapping**: Currently, `importBackupData` only matches categories by exact name. If a user has "Groceries" locally and imports a file with "groceries", it creates a duplicate.
- **UI Testing**: While `jsdom` is configured, a comprehensive audit is needed to ensure all UI components are covered by regression tests and that the environment is stable across all test files.

## Tasks

### Task 1: Fuzzy & Case-Insensitive Category Deduplication
- **Goal**: Prevent duplicate categories during merge imports by using fuzzy matching.
- **Action**:
  - Update `src/db/backup.js` to use `string-similarity` for category name matching.
  - Implement case-insensitive matching first (e.g., "Food" === "food").
  - Implement a similarity threshold (e.g., > 0.9) to catch minor typos or pluralization differences (e.g., "Grocery" vs "Groceries").
  - Ensure `categoryIdMap` is correctly populated with the best local match.
- **Verification**:
  - Add unit tests to `tests/db/import-merge.test.js` covering case-insensitivity and fuzzy matching.

### Task 2: UI Test Suite Stabilization & Coverage Audit
- **Goal**: Ensure the `jsdom` environment is robust and all core UI components have regression tests.
- **Action**:
  - Run the full test suite (`npm test`) and identify any flakiness or resolution issues.
  - Audit existing UI tests (`src/ui/*.test.js`) for coverage of critical paths (Dashboard, Debts, Expenses).
  - Add missing regression tests for:
    - Theme switching logic.
    - Haptic feedback trigger points.
    - Privacy mode blurring.
  - Fix any environment-specific leaks between tests (e.g., shared `localStorage` or DOM state).
- **Verification**:
  - `npm test` runs to completion with 100% pass rate.

## Success Criteria
1. `importBackupData` successfully deduplicates categories with 90%+ name similarity.
2. The full UI test suite executes without environment-related failures.
3. Core UI features (Theme, Privacy, Haptics) have automated regression guards.

## Rollback Plan
- If fuzzy matching causes incorrect merges: Revert to exact-name matching and adjust the similarity threshold.
- If UI tests become slower/unstable: Isolated environment setup per test file instead of a global shared state.
