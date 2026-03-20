---
phase: 43-debt-history-modal
plan: "03"
subsystem: debt-ui
tags: [debt, payments, confirmation, heatmap, recurrent-expenses]
dependency_graph:
  requires: [43-02]
  provides: [getConfirmedPaymentMap, confirmLoanPayment, _renderLoanPaymentStatuses, window.confirmLoanPayment, window.showLoanPaymentPrompt, window.cancelLoanPaymentPrompt]
  affects: [src/ui/debts.js, recurrentExpenses DB table]
tech_stack:
  added: []
  patterns: [upsert-via-getAll-filter, post-render-DOM-update, inline-prompt-pattern]
key_files:
  created: []
  modified:
    - src/ui/debts.js
decisions:
  - "Used getAll+filter upsert pattern for confirmLoanPayment — consistent with existing recurrentExpense access patterns; no dedicated query by linkedDebtId exists"
  - "openHistoryModal fetches debt a second time (debtForType) to type-check before calling _renderLoanPaymentStatuses — avoids changing method signature"
  - "span.innerHTML used directly in _renderLoanPaymentStatuses per plan anti-pattern guidance — post-render DOM updates, not initial safeHTML template literals"
metrics:
  duration_minutes: 30
  completed_date: "2026-03-20"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
requirements: [DEBT-06, DEBT-07]
---

# Phase 43 Plan 03: Payment Confirmation Logic Summary

**One-liner:** JWT-free payment confirmation flow — upserts recurrentExpense with status:paid via getConfirmedPaymentMap lookup, populates Paid badge or inline amount-input prompt per history row, triggers heatmap refresh via window.app.renderAll().

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement getConfirmedPaymentMap and confirmLoanPayment | 08c21b6 | src/ui/debts.js |
| 2 | Wire inline confirm prompt and _renderLoanPaymentStatuses | 8966ac4 | src/ui/debts.js |

## What Was Built

**getConfirmedPaymentMap(debtId):** Loads all recurrentExpenses, filters by linkedDebtId + isDebtPayment, returns a Map keyed by paymentDate. Used both by confirmLoanPayment (upsert check) and _renderLoanPaymentStatuses (badge/button decision).

**confirmLoanPayment(debtId, paymentDate, amountPounds):** Upserts a recurrentExpense record. If a record exists for the debt+date, calls recurrentExpenseRepository.update; otherwise calls recurrentExpenseRepository.add with full shape (isDebtPayment:true, status:paid, linkedDebtId, frequency:monthly, isEssential:true). After save: triggerHaptic('success'), reopens modal, calls window.app.renderAll() for heatmap refresh.

**_renderLoanPaymentStatuses(debtId):** Iterates historical schedule entries from generateHistoricalSchedule, looks up each paymentDate in confirmedMap. Paid entries get a `<span class="badge badge-success">Paid</span>`; unconfirmed entries get a `<button onclick="showLoanPaymentPrompt(...)">Confirm Paid</button>`. Spans were placed by Plan 02's `_buildAmortisationModalHTML`.

**window.showLoanPaymentPrompt:** Replaces the span with an inline amount input (pre-filled with scheduled amount in pounds) plus Confirm and Cancel buttons. Stores original innerHTML in span.dataset.originalContent.

**window.cancelLoanPaymentPrompt:** Restores span.innerHTML from dataset.originalContent.

**openHistoryModal wiring:** After `await this.renderStatements(debtId)`, fetches debt and calls `_renderLoanPaymentStatuses` if debtType is loan or mortgage.

## Test Results

- DEBT-06a: getConfirmedPaymentMap returns Map with correct key — GREEN
- DEBT-06b: confirmLoanPayment creates new recurrentExpense when no record exists — GREEN
- DEBT-06c: confirmLoanPayment updates existing record when found — GREEN
- DEBT-07a: confirmLoanPayment uses user-supplied amountPounds — GREEN
- Full debts.test.js: 65/65 passing — no regressions

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- src/ui/debts.js modified with all required methods
- Commit 08c21b6 exists (getConfirmedPaymentMap + confirmLoanPayment)
- Commit 8966ac4 exists (_renderLoanPaymentStatuses + prompt functions)
- 65 debts tests passing
