---
phase: 12-type-specific-field-logic
plan: "02"
subsystem: ui
tags: [vitest, jsdom, tdd, green-phase, debt-ui, fieldsets, modal]

# Dependency graph
requires:
  - phase: 12-01
    provides: 5 failing RED tests (TYPE-01 to TYPE-04, EDIT-03) establishing fieldset contract
  - phase: 11-modal-scaffold
    provides: openDebtModal, _closeDebtModal, MODAL-01 through MODAL-04 passing
provides:
  - _onTypeChange() method that toggles hidden class on 4 fieldsets by type select value
  - 4 independent fieldsets in _buildFormHTML() (credit-card, mortgage, loan, other)
  - async openDebtModal(id) pre-selecting correct fieldset in Edit mode
  - FIELD_IDS extended with all 16 Phase 12 field IDs
affects: [12-03-save-wiring, 12-04-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "_onTypeChange() reads FIELD_IDS.type select value, iterates fieldsets object, uses classList[bool ? 'remove' : 'add'] idiom"
    - "Phase 12 async openDebtModal: await debtRepository.get(id) called AFTER modalUI.show() so DOM fieldsets exist"
    - "safeHTML template tag used for entire _buildFormHTML() return value — all 4 fieldsets in one template literal"

key-files:
  created: []
  modified:
    - src/ui/debts.js

key-decisions:
  - "_onTypeChange() called after modalUI.show() in all paths (Add and Edit) — fieldset elements created by show(), do not exist before it"
  - "toggleDebtTypeFields() removed entirely — referenced ccOnlyFields/loanOnlyFields IDs belonging to old inline form, dead code once _onTypeChange() in place"
  - "openDebtModal made async; debtRepository.get(id) awaited only in Edit path (id !== null)"

patterns-established:
  - "fieldset-{type} DOM IDs used by _onTypeChange(): fieldset-credit-card, fieldset-mortgage, fieldset-loan, fieldset-other"
  - "FIELD_IDS as single source of truth for all 18 input IDs (name, type + 16 Phase 12 fields)"

requirements-completed: [TYPE-01, TYPE-02, TYPE-03, TYPE-04, EDIT-03]

# Metrics
duration: 5min
completed: 2026-03-08
---

# Phase 12 Plan 02: Type-Specific Field Logic (GREEN) Summary

**4 independent fieldsets in _buildFormHTML(), _onTypeChange() toggle via classList, and async openDebtModal() pre-selection — turning 5 RED tests GREEN with all 9 debts tests passing**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-08T10:25:00Z
- **Completed:** 2026-03-08T10:26:30Z
- **Tasks:** 2 (combined into single commit — same file, changes interleaved)
- **Files modified:** 1

## Accomplishments
- Extended FIELD_IDS with all 16 Phase 12 field IDs (6 credit card, 5 mortgage, 4 loan, 1 other)
- Replaced Phase 11 scaffold _buildFormHTML() with 4 independent fieldsets; credit-card visible by default, others have class="hidden"
- Added _onTypeChange() method — reads type select, removes 'hidden' from matching fieldset, adds it to the other three; handles null getElementById gracefully
- Made openDebtModal() async; after modalUI.show(), awaits debtRepository.get(id) in Edit mode, sets type select value, calls _onTypeChange()
- Removed toggleDebtTypeFields() (dead code referencing old inline form IDs)
- All 9 debts tests pass (4 MODAL + 5 TYPE/EDIT); full suite 159/159 green

## Task Commits

Each task was committed atomically:

1. **Task 1+2: Implement _onTypeChange, 4 fieldsets, async openDebtModal** - `a303485` (feat)

## Files Created/Modified
- `src/ui/debts.js` - FIELD_IDS extended; _buildFormHTML() with 4 fieldsets; _onTypeChange() added; openDebtModal() made async with Phase 12 pre-selection logic; toggleDebtTypeFields() removed

## Decisions Made
- Tasks 1 and 2 changes are interleaved in the same file; single commit captures both rather than artificial split
- _onTypeChange() placed between _closeDebtModal() and _buildFormHTML() for logical grouping

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- GREEN state confirmed: all TYPE/EDIT tests pass, no MODAL regressions
- Plan 03 (save wiring) can now read FIELD_IDS to build save payload for each debt type
- No blockers

## Self-Check: PASSED
- src/ui/debts.js: FOUND
- 12-02-SUMMARY.md: FOUND
- commit a303485: FOUND

---
*Phase: 12-type-specific-field-logic*
*Completed: 2026-03-08*
