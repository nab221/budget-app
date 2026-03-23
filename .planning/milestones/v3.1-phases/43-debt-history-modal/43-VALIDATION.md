---
phase: 43
slug: debt-history-modal
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 43 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | vitest.config.js (project root) |
| **Quick run command** | `npx vitest run src/ui/debts.test.js` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds (quick), ~350 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/ui/debts.test.js`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 43-01-W0 | 01 | 0 | DEBT-05 | unit stub | `npx vitest run src/ui/debts.test.js` | ❌ W0 | ⬜ pending |
| 43-01-01 | 01 | 1 | DEBT-05 | unit | `npx vitest run src/ui/debts.test.js` | ❌ W0 | ⬜ pending |
| 43-01-02 | 01 | 1 | DEBT-05 | unit | `npx vitest run src/ui/debts.test.js` | ❌ W0 | ⬜ pending |
| 43-02-01 | 02 | 1 | DEBT-06 | unit | `npx vitest run src/ui/debts.test.js` | ❌ W0 | ⬜ pending |
| 43-02-02 | 02 | 1 | DEBT-06 | unit | `npx vitest run src/ui/debts.test.js` | ❌ W0 | ⬜ pending |
| 43-03-01 | 03 | 1 | DEBT-07 | unit | `npx vitest run src/ui/debts.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/ui/debts.test.js` — new test stubs for `generateHistoricalSchedule` (DEBT-05), `getConfirmedPaymentMap` (DEBT-06), `confirmLoanPayment` (DEBT-06, DEBT-07)
- [ ] Mock for `recurrentExpenseRepository.getAll` returns loan payment fixtures (currently returns `[]`)

*Existing `debts.test.js` infrastructure — jsdom, vi.mock for render.js, repository.js, schema.js — is already in place and reusable.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Payment history modal opens from debt card button | DEBT-05 | DOM interaction / modal open requires browser | Open app, tap a loan/mortgage debt card, confirm "Payment History" button appears and modal opens with expected payment rows |
| Confirmed payment appears on heatmap | DEBT-06 | Heatmap is a visual canvas element | Confirm a payment, navigate to Dashboard, verify the payment date cell is colored on the heatmap |
| Missing `paymentStartDate` shows hint message | DEBT-05 | UI state / edge case | Open a debt with no paymentStartDate; verify modal shows "No start date set" message with edit link |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
