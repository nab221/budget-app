---
phase: 16-debt-history-ux-refinement
plan: "02"
subsystem: ui
tags: [debts, history-modal, sticky-columns, table-layout, date-format, currency-abbreviation, tdd]

requires:
  - phase: 16-01
    provides: EDIT-04 field population fixes; debt history modal scaffold with modalUI

provides:
  - History modal table with 10 fixed-width columns, sticky Date (left) and Actions (right) columns
  - Scroll hint indicator (fades after 2s) on history modal open
  - Date values formatted as "08 Mar" in statement rows
  - Opening/Closing values >= £1,000 abbreviated as "£X.Xk" in statement rows
  - Edit button in statement rows is pencil icon (✏️) with title tooltip, not text "Edit"

affects:
  - Any future work on the debts history modal (debts.js:_buildHistoryModalHTML, renderStatements)

tech-stack:
  added: []
  patterns:
    - "Inline <style> block injected into modal HTML for scoped component styles"
    - "fmtDate helper: en-GB locale toLocaleDateString with day:'2-digit', month:'short'"
    - "abbrevGBP helper: inline abbreviation for pence values, threshold at 1000 pounds"

key-files:
  created: []
  modified:
    - src/ui/debts.js
    - src/ui/debts.test.js

key-decisions:
  - "Scoped CSS injected as <style> inside modal HTML rather than global stylesheet — avoids class conflicts and keeps modal self-contained"
  - "abbrevGBP applied only to Opening and Closing columns — other currency columns (Int, Fees, Min Due, Paid) retain full formatGBP for precision"
  - "paymentDueDate and actualPaymentDate also formatted via fmtDate for consistency"
  - "Used <table><tbody> wrapper in tests instead of bare <tbody> — jsdom strips invalid bare tbody from body innerHTML"

patterns-established:
  - "History table sticky pattern: first-child sticky left z-index:2, last-child sticky right z-index:2, both using background:var(--bg)"
  - "Scroll hint via class toggle + setTimeout 2000ms: add class on open, remove after delay"

requirements-completed: [HIST-01, HIST-02]

duration: 7min
completed: 2026-03-08
---

# Phase 16 Plan 02: History Table Layout and Pencil Icon Summary

**Fixed-width sticky-column history table with "08 Mar" date formatting, "£1.5k" value abbreviation, and pencil icon replacing text "Edit" in statement rows**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-03-08T14:26:07Z
- **Completed:** 2026-03-08T14:33:00Z
- **Tasks:** 2 (HIST-01, HIST-02)
- **Files modified:** 2

## Accomplishments

- History modal table now has 10 fixed-width columns totalling ~665px with a horizontal scroll wrapper
- Date column sticks to the left, Actions column sticks to the right during horizontal scroll
- Scroll hint indicator (`→ scroll`) appears on modal open and fades after 2 seconds
- Statement dates display as "08 Mar" (en-GB short format); Opening/Closing values >= £1,000 shown as "£1.5k"
- Edit button in every statement row is now ✏️ icon with `title="Edit statement"` for accessibility

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Tests for HIST-01/02** - `15524b0` (test)
2. **Task 1+2 (GREEN): Implementation** - `cef2364` (feat) — HIST-01 table layout + HIST-02 pencil icon implemented together (same renderStatements function)

_Note: TDD tasks share a RED commit (tests for both tasks written together) and a GREEN commit (implementation for both tasks in same function)._

## Files Created/Modified

- `src/ui/debts.js` — `_buildHistoryModalHTML`: added `stmtTableWrapper` div with `position:relative`; injected scoped `<style>` block with `.stmt-tbl` sticky rules and scroll hint pseudo-element; added explicit widths on all 10 `<th>` elements; `openHistoryModal`: added scroll hint class toggle with 2s timeout; `renderStatements`: added `fmtDate` and `abbrevGBP` helpers, applied to date/opening/closing columns, changed Edit button to ✏️ with title attribute
- `src/ui/debts.test.js` — Added HIST-01 describe (5 tests: stmtTableWrapper, sticky, 10 th elements, "08 Mar" date, "£1.5k" abbreviation) and HIST-02 describe (2 tests: no ">Edit<", contains ✏️); added `statementRepository` to top-level imports; fixed jsdom tbody DOM issue by wrapping in `<table>`

## Decisions Made

- Scoped CSS injected as `<style>` inside modal HTML rather than adding to global stylesheet — keeps the modal self-contained and avoids class conflicts with other tables
- `abbrevGBP` applied only to Opening and Closing columns — other columns (Int, Fees, Min Due, Paid) retain full `formatGBP` for precision since they are typically smaller values
- `paymentDueDate` and `actualPaymentDate` also apply `fmtDate` for visual consistency across all date columns

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] jsdom bare tbody DOM issue in test setup**
- **Found during:** Task 1 RED phase
- **Issue:** `document.body.innerHTML = '<tbody id="stmtBody-modal"></tbody>'` caused jsdom to strip the `<tbody>` (invalid as direct `<body>` child), making `getElementById` return null
- **Fix:** Changed test DOM setup to `<table><tbody id="stmtBody-modal"></tbody></table>` in all affected tests
- **Files modified:** `src/ui/debts.test.js`
- **Verification:** Tests pass with correct tbody found after `renderStatements`
- **Committed in:** `15524b0` (test commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — test infrastructure bug)
**Impact on plan:** Minor fix to test DOM setup; no production code impact. All planned functionality delivered.

## Issues Encountered

- jsdom does not accept bare `<tbody>` as a direct child of `<body>` — resolved by wrapping in `<table>` in test setup. No production impact.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- History modal is fully polished: sticky columns, correct widths, scroll UX, formatted values, pencil icon
- Phase 16 (both plans 16-01 and 16-02) is complete
- Ready for next milestone (v2.6 planning or audit of v2.5 dead code)

---
*Phase: 16-debt-history-ux-refinement*
*Completed: 2026-03-08*
