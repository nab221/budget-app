---
phase: 27
plan: "03"
subsystem: data-integrity
tags: [data-integrity, fk-validation, dexie, cloud-sync, startup]
dependency_graph:
  requires: ["27-01", "27-02"]
  provides: ["INTEGRITY-01"]
  affects: ["src/utils/data-integrity.js", "src/utils/data-integrity.test.js", "src/app.js", "src/ui/cloud-sync.js"]
tech_stack:
  added: []
  patterns: ["fire-and-forget .then() for non-blocking async", "Dexie bulkGet/bulkDelete for O(1) batch FK checks", "vi.hoisted stable mocks for Vitest"]
key_files:
  created:
    - src/utils/data-integrity.js
    - src/utils/data-integrity.test.js
  modified:
    - src/app.js
    - src/ui/cloud-sync.js
decisions:
  - "Used vi.hoisted() for stable table mock objects instead of factory function in vi.mock() body — avoids mock reset destroying the table() factory"
  - "validateDataIntegrity() is fire-and-forget (.then()) in both call sites — never blocks UI render or pull completion"
  - "cloud-sync.test.js db mock has no .table() method; validator catches the error gracefully — confirmed test suite passes (393 tests)"
metrics:
  duration_seconds: 646
  completed_date: "2026-03-14"
  tasks_completed: 3
  files_changed: 4
---

# Phase 27 Plan 03: Data Integrity Validator Summary

FK validation engine with fire-and-forget startup and post-pull integration using Dexie bulkGet/bulkDelete across 7 referential integrity rules.

## What Was Built

Created `src/utils/data-integrity.js` with a complete FK validation engine and wired it non-blocking into both app startup and the cloud pull success path.

### Data integrity module (`src/utils/data-integrity.js`)

- `FK_RULES` array defines 7 FK relationships: statements→debts, childcareLedger→childcareAccounts, recurrentExpenses→statements (nullable), recurrentExpenses→categories (nullable), oneOffExpenses→categories (nullable), income→categories (nullable), categoryMappings→categories (non-nullable)
- `validateDataIntegrity()`: iterates all rules, uses `db.table().toArray()` + `bulkGet()` for efficient batch lookup, returns `{ valid: boolean, issues: Array<Issue> }`
- `cleanOrphanedRecords(issues)`: groups by store, deduplicates, runs `bulkDelete()` inside a Dexie transaction
- Tables missing in older schema versions are skipped silently via try/catch

### Unit tests (`src/utils/data-integrity.test.js`)

- 20 tests covering all 7 FK paths — each has a valid-parent case and an orphan-parent case
- cleanOrphanedRecords: tests bulkDelete grouping + deduplication, early-exit on empty/null
- Uses `vi.hoisted()` to create stable table mocks that survive between test resets

### App startup integration (`src/app.js`)

- Import added after existing utility imports
- Fire-and-forget `.then()` call placed after `Promise.all([...])` + success log
- `notificationUI.warning()` called with issue count if `valid === false`; 8s duration

### Cloud-sync post-pull hook (`src/ui/cloud-sync.js`)

- Import added; `notificationUI` was already imported (no duplicate)
- Fire-and-forget `.then()` call placed after `await this._refreshSection()` in `_executePullSync()` success path, before `return null`
- Warning message includes " after sync" to distinguish from startup warning

## Verification Results

| Check | Result |
|-------|--------|
| `export async function` count in data-integrity.js | 2 |
| `childStore:` count (FK_RULES entries) | 7 |
| `validateDataIntegrity` import in app.js | Present (line 35) |
| `validateDataIntegrity().then(` in app.js | Present (line 249) |
| `await validateDataIntegrity` in app.js | 0 (non-blocking confirmed) |
| `validateDataIntegrity` import in cloud-sync.js | Present (line 20) |
| `validateDataIntegrity().then(` in cloud-sync.js | Present (line 870) |
| `await validateDataIntegrity` in cloud-sync.js | 0 (non-blocking confirmed) |
| All new tests pass | 20/20 |
| Full suite (no regressions) | 393/393 |

## Deviations from Plan

None — plan executed exactly as written.

The `cloud-sync.test.js` suite emits `[data-integrity] Skipping ...: db.table is not a function` to stderr during tests that trigger `_executePullSync()`. These are expected: the existing cloud-sync test mock provides `db = { verno: 1 }` without a `.table()` method. The validator catches the error, logs the warning, and the tests all pass. No test failures, no behavior change.

## Decisions Made

1. **vi.hoisted stable mocks**: Used `vi.hoisted()` to create table mock objects outside the `vi.mock()` factory. This ensures mock references remain stable and individual `.mockReset()` + `.mockResolvedValue([])` calls work reliably per test without destroying the `db.table()` factory function.

2. **Fire-and-forget placement**: `validateDataIntegrity().then()` placed after `console.log('Budget App initialized successfully.')` in app.js (post-Promise.all) and after `await this._refreshSection()` in cloud-sync.js — both positions ensure the validator runs only after the UI is fully ready.

3. **No await in either call site**: Confirmed zero `await validateDataIntegrity` occurrences in both files. This matches the plan's explicit requirement and preserves startup/sync performance.

## Self-Check: PASSED

- `src/utils/data-integrity.js` — exists, 138 lines
- `src/utils/data-integrity.test.js` — exists, 246 lines
- Task commits: 34185b4, 5cc60b7, a92a8c0
- Full test suite: 393 tests passed
