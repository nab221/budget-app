---
gap_closure: true
phase: 09-stabilization
plan: 09-STAB
status: complete
depends_on: [09-03]
---

# Plan: Phase 09 - Swipe Stabilization (Gaps found in UAT)

This plan fixes the four major gaps identified during Phase 09 User Acceptance Testing (UAT) to ensure swipe gestures are mobile-safe and follow the "reveal-and-tap" mandate.

## Sub-tasks

1. **Refactor `onEnd` and Implement `closeAllRows`** (SWP-05)
   - [ ] In `src/ui/expenses.js`, modify `SwipeHandler.onEnd` so it does *not* auto-trigger actions.
   - [ ] If threshold is met, keep the row translated (open) so buttons are clickable.
   - [ ] Add `closeAllRows` to the `expensesUI` object to reset all row transforms.
   - [ ] Ensure any click/tap on the row content *closes* the row if it's open.

2. **Implement Single-Row-Open Coordination** (SWP-06)
   - [ ] Add a `currentOpenRow` reference to `expensesUI`.
   - [ ] In `SwipeHandler.handleTouchStart`, if a new row starts swiping, close the currently open row first.

3. **Implement Locked Row "Thud" Feedback** (SWP-07)
   - [ ] Remove early return for `reconciled-row` in `setupGestures`.
   - [ ] In `onSwipe`, if the row is reconciled/locked, limit translation to 20px.
   - [ ] On `onEnd` for locked rows, trigger `error` haptic and snap back.

4. **Update Edge Guardrail and Touch-Only Scope** (SWP-08)
   - [ ] Update `edgeThreshold` to 40px in `expenses.js`.
   - [ ] Ensure `SwipeHandler` effectively ignores non-touch interactions if not already handled.

## Success Criteria
- [ ] Swiping a row and releasing keeps it open at 80px offset if threshold met.
- [ ] Deletion/Clearing only happens when the revealed button is explicitly tapped.
- [ ] Starting a swipe on row B automatically closes row A.
- [ ] Reconciled rows move slightly (20px) and pulse/thud back; they cannot be fully swiped.
- [ ] iOS edge swipes (within 40px) do not trigger row movement.
