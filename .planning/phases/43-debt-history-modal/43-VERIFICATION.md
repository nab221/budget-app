---
phase: 43-debt-history-modal
verified: 2026-03-20T22:25:00Z
status: human_needed
score: 9/9 automated must-haves verified
human_verification:
  - test: "Open a loan or mortgage debt card history modal in the browser"
    expected: "A 'Payment History' section appears below the amortisation summary, with one row per expected payment date from loan start date up to today; each row shows the date and scheduled amount in GBP"
    why_human: "Visual rendering of modal list; cannot verify DOM output from Vitest alone"
  - test: "Open a loan/mortgage debt card with no paymentStartDate set"
    expected: "Modal shows 'No payment start date set.' message with a 'Set start date' edit button — no crash, no empty list"
    why_human: "Edge-case UI branch that requires a live debt record with missing paymentStartDate"
  - test: "Click 'Confirm Paid' on an unconfirmed payment row"
    expected: "Inline amount input appears pre-filled with the scheduled amount; user can edit the value; clicking Confirm submits the payment"
    why_human: "Inline prompt is rendered via DOM manipulation (_renderLoanPaymentStatuses); requires browser interaction"
  - test: "After confirming a payment, check the heatmap on the Dashboard tab"
    expected: "The heatmap cell for the confirmed payment date is now colored, reflecting the recorded recurrentExpense"
    why_human: "Heatmap rendering triggered via window.app.renderAll() — cannot verify color change without live app"
  - test: "Open a credit card debt card and confirm statement history still works"
    expected: "Statements load normally; mark-paid flow still works; no regression from Phase 43 changes"
    why_human: "Regression check on credit-card path of _buildHistoryModalHTML requires browser interaction"
---

# Phase 43: Debt History Modal — Verification Report

**Phase Goal:** Display a scrollable payment history for loan/mortgage debts and allow users to confirm individual past payments.
**Verified:** 2026-03-20T22:25:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | generateHistoricalSchedule filters amortisation schedule to entries with paymentDate <= today | VERIFIED | `debts.js:1037–1063`; DEBT-05a test passes (65/65 green) |
| 2 | generateHistoricalSchedule returns null when paymentStartDate is missing | VERIFIED | `debts.js:1038`; DEBT-05b test passes |
| 3 | _buildAmortisationModalHTML renders Payment History list with date, amount, and status span per entry | VERIFIED | `debts.js:1153–1218`; `<ul id="loan-history-list-${id}">`, `<span id="loan-pmt-status-…">` present |
| 4 | Missing paymentStartDate renders edit-debt hint, not a crash | VERIFIED | `debts.js:1155–1158`; "No payment start date set." + `Set start date` button |
| 5 | getConfirmedPaymentMap returns a Map keyed by payment date for a given debtId | VERIFIED | `debts.js:1065–1071`; DEBT-06a test passes |
| 6 | confirmLoanPayment creates a new recurrentExpense when no existing record exists | VERIFIED | `debts.js:1085–1101`; DEBT-06b test passes |
| 7 | confirmLoanPayment updates the existing record when one already exists for that debt+date | VERIFIED | `debts.js:1079–1084`; DEBT-06c test passes |
| 8 | confirmLoanPayment uses the user-supplied amountPounds, not the scheduled amount | VERIFIED | `debts.js:1082/1090`; DEBT-07a test passes |
| 9 | Full test suite passes with no regressions | VERIFIED | `npx vitest run src/ui/debts.test.js`: 65/65 passed |

**Score:** 9/9 truths verified (automated)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/ui/debts.test.js` | Test stubs for DEBT-05/06/07 with real assertions | VERIFIED | 6 test cases across 3 describe blocks; all 65 tests pass |
| `src/ui/debts.js` | `generateHistoricalSchedule`, `getConfirmedPaymentMap`, `confirmLoanPayment`, `_renderLoanPaymentStatuses`, `window.confirmLoanPayment` | VERIFIED | All 5 items present at lines 1037, 1065, 1073, 1109, 218 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `debtUI._buildAmortisationModalHTML` | `generateHistoricalSchedule` | `this.generateHistoricalSchedule(debt)` call | VERIFIED | `debts.js:1153` |
| `debtUI.openHistoryModal` | `_renderLoanPaymentStatuses` | `await this._renderLoanPaymentStatuses(debtId)` after debtType check | VERIFIED | `debts.js:990–994` |
| `loan-history list confirm button onclick` | `window.confirmLoanPayment` | `onclick="confirmLoanPayment(${debtId}, '${paymentDate}', …)"` | VERIFIED | `debts.js:229–230` |
| `confirmLoanPayment` | `recurrentExpenseRepository.add / update` | upsert via `getConfirmedPaymentMap` | VERIFIED | `debts.js:1079–1101` |
| `confirmLoanPayment` | `window.app.renderAll` | `if (window.app) window.app.renderAll()` | VERIFIED | `debts.js:1106` |
| `window.showLoanPaymentPrompt` | `window.cancelLoanPaymentPrompt` | registered in `setupEventListeners` | VERIFIED | `debts.js:222–238` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DEBT-05 | 43-01, 43-02, 43-04 | User can view payment history modal for loan/mortgage debts showing all expected past payment dates | SATISFIED | `generateHistoricalSchedule` implemented and tested; `_buildAmortisationModalHTML` renders history list; REQUIREMENTS.md marked `[x]` |
| DEBT-06 | 43-01, 43-03, 43-04 | User can confirm a historical loan/mortgage payment so it appears in the heatmap | SATISFIED | `confirmLoanPayment` upserts recurrentExpense with `status:paid`; calls `window.app.renderAll()`; DEBT-06a/b/c tests green; REQUIREMENTS.md marked `[x]` |
| DEBT-07 | 43-01, 43-03, 43-04 | User can adjust the payment amount before confirming | SATISFIED | `showLoanPaymentPrompt` renders editable amount input pre-filled with scheduled amount; `confirmLoanPayment` uses passed `amountPounds`; DEBT-07a test green; REQUIREMENTS.md marked `[x]` |

No orphaned requirements — only DEBT-05, DEBT-06, DEBT-07 are mapped to Phase 43 in REQUIREMENTS.md, and all three are covered by plans.

---

### Anti-Patterns Found

No blockers or stubs detected in phase-43 code paths.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

All `placeholder` matches in debts.js were HTML input placeholder attributes unrelated to Phase 43 logic.

---

### Commits Verified

All 6 implementation commits confirmed present in git log:

| Commit | Description |
|--------|-------------|
| `542133b` | test(43-01): add DEBT-05 failing test stubs and extend recurrentExpenseRepository mock |
| `884626e` | test(43-01): add DEBT-06 and DEBT-07 failing test stubs |
| `dcaf532` | feat(43-02): add generateHistoricalSchedule method to debtUI |
| `1c3aaee` | feat(43-02): extend _buildAmortisationModalHTML with payment history list |
| `08c21b6` | feat(43-03): implement getConfirmedPaymentMap and confirmLoanPayment |
| `8966ac4` | feat(43-03): wire inline confirm prompt and _renderLoanPaymentStatuses |

---

### Human Verification Required

All 9 automated must-haves are verified. The following items require browser testing to fully confirm goal achievement:

#### 1. Payment History List Renders in Modal

**Test:** Open a loan or mortgage debt card in the budget app. Tap/click its history button.
**Expected:** A "Payment History" section appears below the amortisation summary. One row per expected payment date from loan start date through today. Each row shows date (DD MMM YYYY format) and scheduled amount in GBP.
**Why human:** Modal HTML rendering and scroll behavior cannot be confirmed from Vitest.

#### 2. Missing Start Date — Edit Hint

**Test:** Open a loan/mortgage debt card that has no Payment Start Date configured.
**Expected:** Modal shows "No payment start date set." with a "Set start date" button. No crash, no blank modal.
**Why human:** Requires a live debt record with the missing field; automated tests mock the data.

#### 3. Inline Confirm Prompt (DEBT-07)

**Test:** Click "Confirm Paid" on any unconfirmed payment row.
**Expected:** Span is replaced with an amount input pre-filled with the scheduled amount (in pounds), plus "Confirm" and "Cancel" buttons.
**Why human:** DOM replacement via `showLoanPaymentPrompt` is post-render manipulation; Vitest does not exercise DOM.

#### 4. Heatmap Updates After Confirmation (DEBT-06)

**Test:** Edit the pre-filled amount if desired, click "Confirm". Then navigate to the Dashboard tab.
**Expected:** The heatmap cell for the confirmed payment date is now colored. The modal refreshes and shows a "Paid" badge on that row.
**Why human:** Heatmap cell coloring via `window.app.renderAll()` requires a live app session.

#### 5. Credit Card Regression

**Test:** Open a credit card debt card and verify its statement history modal still works normally.
**Expected:** Statements load; mark-paid flow works; no errors introduced by Phase 43 changes.
**Why human:** `_buildHistoryModalHTML` credit-card branch was not modified, but browser confirmation is standard regression practice.

---

### Summary

Phase 43 is fully implemented. All 9 automated must-haves pass — functions exist, are substantive, are wired, and all 65 tests are green (up from 59 before Phase 43). All three requirement IDs (DEBT-05, DEBT-06, DEBT-07) are satisfied by evidence in the codebase and marked complete in REQUIREMENTS.md.

The 5 human verification items above are standard browser checks for visual rendering, DOM manipulation, and heatmap integration — none indicate code defects. The phase goal is achieved pending human confirmation of the browser flows.

---

_Verified: 2026-03-20T22:25:00Z_
_Verifier: Claude (gsd-verifier)_
