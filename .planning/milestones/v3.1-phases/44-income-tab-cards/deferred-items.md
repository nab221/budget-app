# Deferred Items — Phase 44

## Pre-existing test failures (out of scope)

### tests/income-sources.test.js — 2 failing tests

These tests were already failing before Plan 03 execution, confirmed by git stash test.

**Failed tests:**
1. `pending income cards > render() uses getUpcomingIncomeEvents and produces .income-pending-card elements`
   - Expects `getUpcomingIncomeEvents` called during `render()` and `.income-pending-card` elements to appear
   - Plan 02 replaced the pending cards section with a card grid layout, so these no longer apply

2. `listener de-duplication: confirm-income > confirmIncome fires exactly once after three renders`
   - Expects `data-action="confirm-income"` buttons in pending cards
   - Plan 02 replaced pending cards with card grid; confirm-income action now lives in the modal

**Root cause:** `tests/income-sources.test.js` tests the old pending-card rendering pattern from Phase 39.1.
Plan 02 (card grid layout) rendered these stale. Plan 03 does not make them worse.

**Recommended fix:** Update or remove `tests/income-sources.test.js` — either delete the stale tests
or update them to test the new card grid + modal flow introduced in Plans 02–03.
