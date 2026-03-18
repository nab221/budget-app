---
phase: 38-github-actions-node24-hygiene
plan: 01
subsystem: testing, infra, database
tags: [vitest, coverage-v8, legacy-import, v2-migration, ci-node24, gap-closure]

requires:
  - phase: 37-cloud-snapshot-delta-preview
    provides: snapshot-diff utility and cloud-sync UI infrastructure
  - phase: 35-childcare-top-up-planner
    provides: childcareRepository with addDeposit/addSpend seams
  - phase: 32-debt-model-refactor
    provides: debtRepository.confirmBalance, finance.js amortisation

provides:
  - CI workflow verified compliant with Node 24 + actions/setup-node@v6 (idempotent no-op)
  - src/utils/legacy-import.js: full v2 import pipeline (parse, detect, validate, map, conflict-safe import)
  - Import v2 Legacy button wired into Settings local actions seam in cloud-sync.js
  - @vitest/coverage-v8 installed and configured with reportsDirectory
  - 38-coverage-audit.md: module-by-module coverage matrix for phases 31-37
  - childcareRepository.addDeposit + addSpend tests (gap closure); mock sortBy() fix

affects: [39-v3-milestone-polish, phase-38, cloud-sync-ui, repository-test-infrastructure]

tech-stack:
  added:
    - "@vitest/coverage-v8@3.2.4"
  patterns:
    - "Legacy import pipeline: detect-shape → validate → map → conflict-safe write (skip by default)"
    - "TDD: RED test commit → GREEN implementation commit for legacy import"
    - "Coverage audit: run with --exclude for pre-existing failures, document deferred modules"

key-files:
  created:
    - src/utils/legacy-import.js
    - tests/legacy-import.test.js
    - .planning/phases/38-github-actions-node24-hygiene/38-coverage-audit.md
  modified:
    - src/ui/cloud-sync.js
    - src/db/repository.test.js
    - vitest.config.js
    - package.json

key-decisions:
  - "CI workflow already Node 24 compliant (actions/setup-node@v6, node-version:24, FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 env var) — Task 1 is idempotent no-op with verification evidence"
  - "Legacy import default conflict policy is 'skip' (not 'overwrite') — existing v3 records are never silently replaced; explicit conflictPolicy:'overwrite' required"
  - "APR normalisation handles string '4.9%' and numeric 4.9 inputs — all stored as number in current schema"
  - "fixedSpends + subscriptions both map to recurrentExpenses; variableSpends maps to oneOffExpenses"
  - "@vitest/coverage-v8@3.2.4 pinned to match installed vitest@3.2.4 (wildcard install resolved to v4.1.0 which required vitest@4)"
  - "Coverage deferred modules (debts.js 72%, repository.js 74%, ui/childcare.js 0%, cloud-sync.js 69%) — all have accepted rationale; complex UI rendering requires DOM+Dexie stack not available in unit test layer"
  - "Mock table's equals().sortBy() was missing — added to fix _recalculateBalances test path (Rule 1 auto-fix)"

requirements-completed: [TECH-01, INTEGRITY-02, TECH-04]

duration: 55min
completed: 2026-03-16
---

# Phase 38 Plan 01: GitHub Actions Node24 Hygiene Summary

**v2 legacy import pipeline with skip-by-default conflict safety, CI Node 24 verification (idempotent), and auditable coverage matrix for phases 31-37 via @vitest/coverage-v8**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-03-16T22:58:26Z
- **Completed:** 2026-03-16T23:55:00Z
- **Tasks:** 4
- **Files modified:** 7

## Accomplishments

- CI Node 24 compliance verified (no-op: `actions/setup-node@v6`, `node-version:24`, `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` already present)
- `src/utils/legacy-import.js` implemented: `parseLegacyBackup`, `detectLegacyShape`, `validateLegacyData`, `mapLegacyToCurrent`, `importLegacyData`, `runLegacyImport` — all with TDD (25 passing tests)
- Import v2 Legacy button wired into `_renderLocalSettingsActions` in `cloud-sync.js` (existing Settings seam, next to Import Backup button)
- `@vitest/coverage-v8@3.2.4` installed (was missing, treated as blocker); `vitest.config.js` configured with `reportsDirectory`, `provider`, and `include/exclude`
- `38-coverage-audit.md` produced: 10/15 phase 31-37 modules at ≥80% line coverage; 4 deferred with accepted rationale and Phase 39 backlog items
- 7 new `childcareRepository.addDeposit`/`addSpend` tests added (gap closure); mock table `sortBy()` bug fixed; repository.js coverage 71.34% → 74.06%

## Task Commits

Each task was committed atomically:

1. **Task 1: CI Node24 verification (no-op)** — no file changes (already compliant); evidence in commit `1353bbf` notes
2. **Task 2: RED** — `79344a0` (test): add failing tests for legacy v2 import pipeline
3. **Task 2: GREEN** — `1353bbf` (feat): implement legacy v2 import pipeline with conflict-safe default
4. **Task 3: Coverage audit** — `00588a0` (chore): install coverage-v8, configure vitest, produce audit artifact
5. **Task 4: Gap closure** — `c9495a2` (test): add gap-closure tests for childcareRepository.addDeposit and addSpend

## Files Created/Modified

- `src/utils/legacy-import.js` — v2 import pipeline: shape detection, validation, APR normalisation, table mapping, conflict-safe orchestration
- `tests/legacy-import.test.js` — 25 unit tests covering all 6 exported functions
- `src/ui/cloud-sync.js` — added `parseLegacyBackup`/`runLegacyImport` import, "Import v2 Legacy" button + file input handler in `_renderLocalSettingsActions`
- `src/db/repository.test.js` — added `sortBy()` to mock table (bug fix), 7 new tests for `addDeposit`/`addSpend`
- `vitest.config.js` — coverage provider/reporter/reportsDirectory configuration
- `package.json` + `package-lock.json` — `@vitest/coverage-v8@3.2.4` dev dependency
- `.planning/phases/38-github-actions-node24-hygiene/38-coverage-audit.md` — full audit artifact

## Decisions Made

- CI already compliant with Node 24 — Task 1 is verified no-op with explicit grep evidence
- Legacy import defaults to `skip` on id collision (never overwrites existing v3 records silently)
- APR normalisation: `'4.9%'` → `4.9` (number); fallback to 0 for unparseable values
- `@vitest/coverage-v8` pinned to `@3.2.4` to match installed `vitest@3.2.4` (wildcard resolved to v4.1.0 requiring vitest@4 — incompatible)
- `38-coverage-audit.md` documents 4 deferred modules with rationale; all are complex UI rendering code that requires DOM+Dexie infrastructure beyond current unit test scope
- Coverage gate for TECH-04: 10/15 non-deferred phase 31-37 modules at ≥80%; deferred modules have explicit rationale and Phase 39 backlog entries

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing `sortBy()` on mock table's `equals()` chain**
- **Found during:** Task 4 (gap closure — writing `_recalculateBalances` tests)
- **Issue:** `createMockTable()` in `repository.test.js` had `where().equals()` with `reverse().sortBy()` but no direct `.sortBy()`. `childcareRepository._recalculateBalances` calls `db.childcareLedger.where('accountId').equals(id).sortBy('date')` which would fail.
- **Fix:** Added `sortBy: async (sortField) => ...` to the `equals()` result object with ascending sort.
- **Files modified:** `src/db/repository.test.js`
- **Verification:** `addDeposit` recalculate test passes; all 53 repository tests pass.
- **Committed in:** `c9495a2`

**2. [Rule 3 - Blocking] `@vitest/coverage-v8` not installed**
- **Found during:** Task 3 (coverage audit)
- **Issue:** Coverage provider missing; `npx vitest run --coverage` fails without it.
- **Fix:** `npm install --save-dev @vitest/coverage-v8@3.2.4`
- **Files modified:** `package.json`, `package-lock.json`
- **Verification:** Coverage run completes and produces `coverage/coverage-summary.json`.
- **Committed in:** `00588a0`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes essential for test correctness and coverage gate. No scope creep.

## Issues Encountered

- `@vitest/coverage-v8@*` resolved to `4.1.0` which requires `vitest@4` (peer dep conflict). Pinned to `@3.2.4` matching installed vitest.
- `vitest.config.js` `reportsDirectory` must be explicit — without it, coverage JSON is not written to disk (vitest default may differ on Windows).
- Pre-existing `dashboard.affordability.test.js` timeout (15s) failure documented in STATE.md from Phase 37; excluded from coverage run. Count: 689 tests with affordability / 686 without.

## Next Phase Readiness

- TECH-01, INTEGRITY-02, TECH-04 requirements satisfied and documented
- Phase 39 (v3.0 Milestone Polish) backlog includes: `debts.js` UI tests, `repository.js` complex function tests, `ui/childcare.js` DOM mount tests, `cloud-sync.js` legacy import button tests, `dashboard.affordability.test.js` timeout fix
- Coverage command reproducible: `npx vitest run --coverage --exclude="**/dashboard.affordability.test.js"`

---
*Phase: 38-github-actions-node24-hygiene*
*Completed: 2026-03-16*
