---
phase: 32-debt-model-refactor-loans-mortgage
verified: 2026-03-15T21:40:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Open a loan or mortgage debt card, click the modal"
    expected: "6-row amortisation table visible (Outstanding Balance, Monthly Payment, APR%, Projected Payoff, Remaining Term, Total Interest). No 'Log Statement' or 'Import PDF' buttons."
    why_human: "safeHTML renders to DOM — modal content can only be confirmed in a live browser"
  - test: "Click 'Confirm Current Balance', enter a value that differs by >5% from current, click Submit"
    expected: "window.confirm dialog appears with a percentage-difference message before saving"
    why_human: "window.confirm interaction requires a running browser session"
  - test: "Click a credit card debt card"
    expected: "Original statement history modal with 'Log Statement' and 'Import PDF' buttons — no amortisation table"
    why_human: "Modal content rendered at runtime cannot be asserted without DOM"
---

# Phase 32: Debt Model Refactor — Loans & Mortgage Verification Report

**Phase Goal:** Remove statement-based tracking for loans and mortgages. Replace with a predictive amortisation model. This frees the UI from requiring PDF/CSV imports for loan management.
**Verified:** 2026-03-15T21:40:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | `calculateAmortisationSchedule()` returns correct month-by-month schedule | VERIFIED | Function exists at `src/utils/finance.js:590`, substantive implementation with integer-pence arithmetic, 14 tests all pass |
| 2 | Schedule includes `projectedPayoffDate`, `remainingTermMonths`, `totalInterestRemaining` | VERIFIED | Return shape confirmed at lines 649–654 of `finance.js`; tests assert all three fields |
| 3 | Guard throws when monthly payment does not cover interest | VERIFIED | `finance.js:602–605` — throws `'Monthly payment does not cover interest — loan will never be repaid'`; test GUARD assert confirmed |
| 4 | Final schedule entry brings balance to zero (clamped, not negative) | VERIFIED | `finance.js:626` — `newBalance <= 0 ? 0 : newBalance` pattern confirmed |
| 5 | `paymentDayOfMonth` controls the day within each payment month | VERIFIED | `finance.js:629` — `setDate(addMonths(start, month), paymentDayOfMonth)` confirmed |
| 6 | Loan/mortgage debt cards show amortisation data; no import/statement buttons | VERIFIED | `debts.js:1131–1134` — branches to `_buildAmortisationModalHTML` for `loan`, `mortgage`, `personal-loan`; that method contains no Log Statement or Import PDF buttons |
| 7 | Confirm Current Balance button opens modal; saving updates debt and shows toast | VERIFIED | `debts.js:1069–1127` — `openConfirmBalanceForm()` toggles hidden form; `submitConfirmBalance()` validates, calls `debtRepository.confirmBalance()`, calls `notificationUI.success()` |
| 8 | Warning shown when confirmed balance differs from computed balance by >5% | VERIFIED | `debts.js:1099–1106` — `diffRatio > CONFIRM_BALANCE_WARNING_THRESHOLD` triggers `window.confirm` with percentage; constant is `0.05` confirmed at line 16 |

**Score:** 8/8 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/finance.js` | `calculateAmortisationSchedule()` exported pure function | VERIFIED | Lines 590–655, exported, substantive, 65 lines of real implementation |
| `src/utils/finance.test.js` | TDD test suite — `describe calculateAmortisationSchedule` | VERIFIED | Line 437 — `describe('calculateAmortisationSchedule', ...)`, 14 tests |
| `src/db/schema.js` | Dexie v20 migration with `paymentDayOfMonth` on debts | VERIFIED | Line 559 — `db.version(20).stores(...)`, line 563 — `paymentDayOfMonth` in debts index, line 578 — upgrade callback sets default 1 |
| `src/db/repository.js` | `confirmBalance()` helper on `debtRepository` | VERIFIED | Line 229 — `async confirmBalance(id, newBalancePence)` — reads debt, updates `currentBalance`, triggers sync, returns `{ previousBalance, newBalance }` |
| `src/ui/debts.js` | Conditional modal — amortisation panel for loan/mortgage, statement panel for credit-card | VERIFIED | Lines 1009–1067 — `_buildAmortisationModalHTML`; lines 1130–1134 — `_buildHistoryModalHTML` branch |
| `src/ui/debts.test.js` | Tests for conditional modal rendering and confirm flow | VERIFIED | Lines 1199–1340 — 8 tests (AMORT-01 to AMORT-05, CB-VALID-01 to CB-VALID-03) |
| `src/db/repository.test.js` | Tests for `confirmBalance()` | VERIFIED | Lines 804–837 — 3 tests (DEBT-CB-01, CB-02, CB-03) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/utils/finance.test.js` | `src/utils/finance.js` | named import `calculateAmortisationSchedule` | WIRED | `finance.test.js:2` imports `calculateAmortisationSchedule` from `./finance`; 14 tests call it |
| `src/ui/debts.js` | `src/utils/finance.js` | `import { calculateAmortisationSchedule }` | WIRED | `debts.js:4` — import confirmed; called at lines 1014 and 1113 |
| `src/ui/debts.js` | `src/db/repository.js` | `debtRepository.confirmBalance()` | WIRED | `debts.js:1108` — `await debtRepository.confirmBalance(debtId, newBalancePence)` |
| `src/db/schema.js` | debts store | `db.version(20).stores` with `paymentDayOfMonth` | WIRED | `schema.js:559–578` — version 20 block present with upgrade callback |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| DEBT-01 | 32-01-PLAN, 32-02-PLAN | Loans/mortgages use predictive amortisation model; remove import/statement buttons | SATISFIED | `calculateAmortisationSchedule()` implemented and wired into UI; `_buildHistoryModalHTML` branches loan/mortgage types to amortisation panel with no statement controls |
| DEBT-03 | 32-02-PLAN | Confirm/update balance with 5% threshold warning | SATISFIED | `submitConfirmBalance()` validates, checks 5% via `CONFIRM_BALANCE_WARNING_THRESHOLD = 0.05`, calls `window.confirm`, then `debtRepository.confirmBalance()` |

**Orphaned requirements check:** REQUIREMENTS.md maps only DEBT-01 and DEBT-03 to Phase 32. Both are claimed by the plans. No orphaned requirements.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No TODO/FIXME/placeholder comments or stub returns found in the four modified source files (`finance.js`, `schema.js`, `repository.js`, `debts.js`).

---

### Human Verification Required

#### 1. Amortisation modal visual rendering

**Test:** Navigate to the Debts tab. Open a personal loan or mortgage debt card modal.
**Expected:** 6-row table showing Outstanding Balance, Monthly Payment, Interest Rate (APR%), Projected Payoff, Remaining Term (months), Total Interest Remaining. No "Log Statement" or "Import PDF" buttons visible.
**Why human:** `_buildAmortisationModalHTML` renders via `safeHTML` to the live DOM — modal content cannot be verified without a browser session.

#### 2. Confirm Balance 5% threshold warning

**Test:** In the amortisation modal, click "Confirm Current Balance", enter a balance that differs from the current balance by more than 5%, and click Submit.
**Expected:** A `window.confirm` dialog appears stating the percentage difference before proceeding. Clicking OK shows a success toast with the new payoff date.
**Why human:** `window.confirm` is a browser-native modal — cannot be triggered or asserted via static analysis.

#### 3. Credit card modal regression check

**Test:** Open a credit card debt card modal.
**Expected:** Statement history flow with "Log Statement" button visible and "Import PDF" button. No amortisation table displayed.
**Why human:** Modal rendering is runtime-only.

---

### Summary

Phase 32 goal is achieved. All automated checks pass:

- `calculateAmortisationSchedule()` is a substantive, fully-tested pure function in `src/utils/finance.js` (65 lines of real algorithm, 14 dedicated tests, correct integer-pence arithmetic, payoff guard, 600-month safety cap).
- Schema v20 is present in `src/db/schema.js` with `paymentDayOfMonth` added to the debts store and a migration upgrade callback defaulting existing records to `1`.
- `debtRepository.confirmBalance()` is implemented in `src/db/repository.js` with 3 TDD tests.
- `_buildHistoryModalHTML()` in `src/ui/debts.js` correctly branches: `loan`, `mortgage`, and legacy `personal-loan` types all go to `_buildAmortisationModalHTML()`; only `credit-card` (default) uses the existing statement flow.
- `submitConfirmBalance()` validates inline (zero check, not-less-than-current check), applies the 5% divergence check via `window.confirm`, calls `debtRepository.confirmBalance()`, recalculates the schedule for payoff display, and shows a success toast.
- All 453 Vitest tests pass (428 pre-existing + 25 new tests from this phase).
- All 4 documented commits (`cfcc19c`, `0efb2e8`, `4d915c5`, `0f21ade`) are verified in git history.

Both DEBT-01 and DEBT-03 requirements are fully satisfied. Three items require human verification in a browser session (amortisation modal rendering, 5% threshold confirm dialog, credit card regression).

---

_Verified: 2026-03-15T21:40:00Z_
_Verifier: Claude (gsd-verifier)_
