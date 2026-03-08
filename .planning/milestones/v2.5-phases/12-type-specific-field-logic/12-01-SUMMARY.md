---
phase: 12-type-specific-field-logic
plan: "01"
subsystem: testing
tags: [vitest, jsdom, tdd, red-phase, debt-ui]

# Dependency graph
requires:
  - phase: 11-modal-scaffold
    provides: openDebtModal, _closeDebtModal, MODAL-01 through MODAL-04 tests passing
provides:
  - 5 failing RED tests for TYPE-01, TYPE-02, TYPE-03, TYPE-04, EDIT-03 in debts.test.js
  - describe('debtUI type-specific fieldsets') block establishing fieldset test contract
affects: [12-02-PLAN, plan-02-fieldset-implementation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "buildFieldsetDOM() shared helper injects 4 fieldset divs + type select into jsdom for each test"
    - "debtRepository.get.mockResolvedValueOnce() per-test override pattern for EDIT-03 async path"

key-files:
  created: []
  modified:
    - src/ui/debts.test.js

key-decisions:
  - "Tests inject fieldsets manually into document.body (not via openDebtModal) because modalUI.show is mocked and does not set innerHTML — DOM state is owned by each test"
  - "EDIT-03 uses mockResolvedValueOnce on debtRepository.get to override the default mock (credit-card) with a mortgage debt, testing the async openDebtModal(id) path"
  - "Import debtRepository directly from the vi.mock so test can call .mockResolvedValueOnce on the stub"

patterns-established:
  - "fieldset DOM IDs: fieldset-credit-card, fieldset-mortgage, fieldset-loan, fieldset-other"
  - "Test contract: _onTypeChange() takes no args, reads debtTypeInput value from DOM, toggles hidden class"

requirements-completed: [TYPE-01, TYPE-02, TYPE-03, TYPE-04, EDIT-03]

# Metrics
duration: 1min
completed: 2026-03-08
---

# Phase 12 Plan 01: Type-Specific Fieldset Tests (RED) Summary

**5 failing TDD tests establishing the behavioral contract for _onTypeChange() fieldset show/hide and async openDebtModal(id) pre-selection**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-03-08T10:22:10Z
- **Completed:** 2026-03-08T10:23:06Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `describe('debtUI type-specific fieldsets')` with 5 new RED-phase tests
- TYPE-01 through TYPE-04: each verifies `_onTypeChange()` shows exactly one fieldset and hides the other three
- EDIT-03: verifies `openDebtModal(id)` is async and pre-selects the stored debt's type fieldset
- All 4 existing MODAL tests continue to pass (no regression)
- RED state confirmed: 5 new tests fail with `_onTypeChange is not a function` and type select not set to mortgage

## Task Commits

Each task was committed atomically:

1. **Task 1: Phase 12 fieldset show/hide tests (RED)** - `456ef2e` (test)

## Files Created/Modified
- `src/ui/debts.test.js` - Added import for `debtRepository`, `buildFieldsetDOM` helper, and `describe('debtUI type-specific fieldsets')` block with 5 tests

## Decisions Made
- Tests inject fieldsets manually into `document.body` (not via `openDebtModal`) because `modalUI.show` is mocked and does not set `innerHTML` — each test owns its own DOM state
- EDIT-03 uses `mockResolvedValueOnce` to override the default `debtRepository.get` mock so it returns a mortgage debt instead of credit-card
- Imported `debtRepository` directly from the vi.mock factory at the top of the file so the mock instance is accessible for per-test overrides

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- RED tests committed and confirmed failing (5 failures, 4 passes)
- Plan 02 can now implement `_onTypeChange()`, expand `_buildFormHTML()` with 4 fieldsets, and make `openDebtModal(id)` async to turn all 5 tests GREEN

## Self-Check: PASSED
- src/ui/debts.test.js: FOUND
- 12-01-SUMMARY.md: FOUND
- commit 456ef2e: FOUND

---
*Phase: 12-type-specific-field-logic*
*Completed: 2026-03-08*
