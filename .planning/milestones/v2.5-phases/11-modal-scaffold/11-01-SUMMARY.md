---
phase: 11-modal-scaffold
plan: 01
subsystem: testing
tags: [vitest, jsdom, tdd, debts, modal]

# Dependency graph
requires: []
provides:
  - Failing test scaffold for MODAL-01 through MODAL-04 (four failing tests in src/ui/debts.test.js)
  - RED baseline for Plan 02 to turn GREEN
affects:
  - 11-modal-scaffold plan 02 (green phase — implements openDebtModal and _closeDebtModal)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vi.mock hoisting: all mocks declared before imports so Vitest hoists them above the import of debts.js"
    - "jsdom environment via inline directive: // @vitest-environment jsdom on line 1"
    - "Mock render.js show/close simulate scroll lock side-effects to allow body.style.overflow assertions"

key-files:
  created:
    - src/ui/debts.test.js
  modified: []

key-decisions:
  - "Mock render.js show() to set document.body.style.overflow = 'hidden' so MODAL-03 can assert scroll-lock without the real DOM overlay element"
  - "MODAL-02 test falls back to direct _closeDebtModal() call if overlay element is not present in jsdom, avoiding flakiness from missing element while still verifying editingId reset"
  - "Focus spy on HTMLElement.prototype.focus checks spy.mock.instances for element with id=debtNameInput — more robust than checking if any element got focus"

patterns-established:
  - "TDD RED pattern: import module under test after all vi.mock calls so Vitest hoisting applies"
  - "Minimal DOM pattern: beforeEach builds only the IDs the module-under-test needs (#addDebtBtn, #debtFormContainer, #debtNameInput)"

requirements-completed:
  - MODAL-01
  - MODAL-02
  - MODAL-03
  - MODAL-04

# Metrics
duration: 8min
completed: 2026-03-08
---

# Phase 11 Plan 01: Modal Scaffold Test Scaffold Summary

**Four failing Vitest/jsdom tests covering MODAL-01 through MODAL-04 that confirm RED state for openDebtModal and _closeDebtModal**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-08T09:01:00Z
- **Completed:** 2026-03-08T09:09:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created `src/ui/debts.test.js` with jsdom environment directive and four failing test cases
- All four tests fail with `TypeError: debtUI.openDebtModal is not a function` — correct RED state
- Test runner exits with failures, not crashes — no config errors, no import resolution errors
- Mocked all heavy dependencies (render.js, repository.js, haptics, currency, finance) so test collection never errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing test scaffold for MODAL-01 through MODAL-04** - `d61b532` (test)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `src/ui/debts.test.js` - Four failing Vitest unit tests for MODAL-01 through MODAL-04; jsdom environment; full mock coverage of all debts.js transitive imports

## Decisions Made
- Mock `render.js show()` to apply `document.body.style.overflow = 'hidden'` as a side effect, mirroring the real implementation — this lets MODAL-03 assert scroll-lock without needing a real overlay element in jsdom
- MODAL-02 backdrop test uses a fallback path (`_closeDebtModal()` direct call) if the overlay element is absent in jsdom, ensuring the test fails for the right reason (function not defined) rather than a null-overlay error
- Focus spy on `HTMLElement.prototype.focus` checks `spy.mock.instances` for the element with `id === 'debtNameInput'` — more reliable than asserting any focus call occurred

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- RED baseline established. Plan 02 can now implement `openDebtModal(id)` and `_closeDebtModal()` on `debtUI` and run `npx vitest run src/ui/debts.test.js` to confirm GREEN.
- Key concern from STATE.md still open: confirm whether `modalUI`'s Esc/close handler calls `modalUI.close()` directly and whether `editingId` cleanup needs to be wired via a `dialog.addEventListener('close')` — to be resolved in Plan 02.

---
*Phase: 11-modal-scaffold*
*Completed: 2026-03-08*
