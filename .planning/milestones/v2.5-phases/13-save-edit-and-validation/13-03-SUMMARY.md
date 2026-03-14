---
phase: 13-save-edit-and-validation
plan: 13-03
subsystem: Debts UI
tags: [save-handler, inline-validation, edit-mode, modal-buttons]
requirements: [ADD-01, ADD-02, ADD-03, EDIT-01, EDIT-02]
tech-stack: [vanilla-js, vitest, jsdom]
key-files: [src/ui/debts.js]
key-decisions: [
  "Use inline validation spans instead of alerts for form errors",
  "Branch save logic by debt type to build accurate repository payloads",
  "Pre-populate all modal fields from DB record after modal opens in Edit mode",
  "Sync interestRate to apr for loans and mortgages to maintain strategy sort consistency"
]
metrics:
  duration: 15m
  completed_date: "2026-03-08"
---

# Phase 13 Plan 03: Save, Edit, and Validation Summary

Implemented the complete functional loop for debt management using the new modal architecture. This plan adds the Save and Add handlers, inline validation logic, and field pre-population for editing existing debts.

## Key Changes

### 1. Save Handler Implementation (`ADD-01`, `EDIT-01`)
- Added `_saveDebt()` to `debtUI` as the central entry point for both Add and Edit modes.
- Implemented type-specific payload building for all four debt types:
  - **Credit Card:** currentBalance, apr, creditLimit, minPayment, promoEndDate, postPromoApr.
  - **Mortgage:** propertyValue, currentBalance, termMonths, interestRate (set as apr), earlyRepaymentFee.
  - **Loan:** originalPrincipal, currentBalance, termMonths, interestRate (set as apr).
  - **Other:** currentBalance.
- Automated `apr` synchronization for amortizing debts to ensure consistent sorting in the payoff strategy.

### 2. Inline Validation (`ADD-02`)
- Introduced `_showFieldError(fieldId, message)` and `_clearFieldErrors()` helper methods.
- Replaced the legacy `alertWithHaptic()` pattern with inline `<span>` elements with class `field-error` that appear directly beneath failing fields.
- Guaranteed fresh errors by clearing previous messages at the start of every save attempt.

### 3. Edit Mode Pre-population (`EDIT-02`)
- Implemented `_populateEditFields(debt)` to set `.value` on all modal inputs based on a fetched debt record.
- Used `fromPence()` for currency fields to bridge the DB's integer storage with the UI's decimal inputs.
- Integrated pre-population into the `openDebtModal(id)` flow, ensuring it occurs after the modal DOM is written and the correct fieldset is revealed.

### 4. Modal Footer Wiring (`ADD-03`)
- Updated `openDebtModal` to pass the primary action button (either "Add" or "Save") in the `buttons` array to `modalUI.show()`.
- Verified that `_buildFormHTML()` produces fresh empty inputs for Add mode by default.

## Verification Results

### Automated Tests
Ran the expanded unit test suite in `src/ui/debts.test.js`:
- `MODAL-01` to `MODAL-04`: Scaffold and focus checks (PASSED)
- `TYPE-01` to `TYPE-04`: Fieldset visibility (PASSED)
- `EDIT-03`: Stored type pre-selection (PASSED)
- `ADD-01`: Add save path (PASSED)
- `ADD-02`: Inline validation check (PASSED)
- `ADD-03`: Fresh form check (PASSED)
- `EDIT-01`: Update save path (PASSED)
- `EDIT-02`: Field population check (PASSED)

Total: 14 tests, 14 passed.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED
- [x] All 14 tests passed.
- [x] `src/ui/debts.js` correctly imports and uses `fromPence`.
- [x] Repository `add`/`update` methods are called with plain float values.
- [x] `editingId` is correctly used to branch between `add` and `update`.
