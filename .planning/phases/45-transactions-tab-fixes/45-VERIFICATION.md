---
phase: 45-transactions-tab-fixes
verified: 2026-03-22T00:00:00Z
status: gaps_found
score: 5/8 must-haves verified
gaps:
  - truth: "User can mark an expense transaction as paid and see the status update in-place"
    status: failed
    reason: "window.toggleExpenseStatus is defined in expenses.js and calls this.render() which re-renders the Expenses tab, not the Transactions tab. The Transactions tab row does not update in-place after toggle."
    artifacts:
      - path: "src/ui/expenses.js"
        issue: "Line 270: toggleExpenseStatus calls this.render() where this=expensesUI — the Transactions tab is not re-rendered"
      - path: "src/ui/transactions.js"
        issue: "Line 538: btn-mark-paid onclick calls window.toggleExpenseStatus which belongs to expensesUI scope"
    missing:
      - "After toggling expense status, transactionUI.render() must be triggered (either by dispatching app:refresh from toggleExpenseStatus, or by adding a transactions-scoped toggle that calls transactionUI.render())"

  - truth: "Income row action buttons show only an Income redirect button (matching debt redirect pattern)"
    status: failed
    reason: "Income rows in Transactions tab still render Confirm/Received + Edit + Delete buttons. Human verification found the correct redirect behaviour occurs on row-tap but the explicit redesign (remove Confirm/Edit/Delete, replace with single redirect arrow button) was not implemented."
    artifacts:
      - path: "src/ui/transactions.js"
        issue: "Lines 507-513: income action cell renders btn-confirm-income + btn-edit + btn-delete — Confirm and Edit/Delete should be replaced with a single Income redirect button (arrow icon + 'Income' label) matching the debt row redirect pattern"
    missing:
      - "Remove btn-confirm-income, btn-edit, btn-delete from income rows in Transactions tab"
      - "Add a redirect button (e.g. U+2197 + 'Income' label) that navigates to the Income Sources tab, consistent with debt row redirect pattern (line 522 onclick navigates to debts tab)"

  - truth: "Category filter works without runtime errors and is scoped to categories present in current month"
    status: failed
    reason: "Two issues: (1) handleCategoryChange is referenced in renderCategoryFilter template at line 421 via onchange='transactionUI.handleCategoryChange(this)' but the method is never defined in the transactionUI object — throws 'handleCategoryChange is not a function' at runtime. (2) clearCategoryFilter is also called on line 427 but is also not defined as a method."
    artifacts:
      - path: "src/ui/transactions.js"
        issue: "Line 421: onchange calls transactionUI.handleCategoryChange(this) — method does not exist in transactionUI object"
        issue2: "Line 427: onclick calls transactionUI.clearCategoryFilter() — method does not exist in transactionUI object"
    missing:
      - "Define handleCategoryChange(checkbox) method on transactionUI: toggles checkbox value in this.selectedCategories array, calls this.render()"
      - "Define clearCategoryFilter() method on transactionUI: clears this.selectedCategories array, calls this.render()"
      - "Scope category filter to categories present in the current month's transactions (not all categories in the DB)"
---

# Phase 45: Transactions Tab Fixes — Verification Report

**Phase Goal:** Fix the Transactions tab so all 8 TRANS requirements are met
**Verified:** 2026-03-22
**Status:** GAPS FOUND
**Re-verification:** No — initial verification

## Source of Truth

This verification incorporates human browser verification results from `45-04-SUMMARY.md` (verified 2026-03-22) and cross-references against the actual codebase state.

---

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | TRANS-01: User marks expense as paid and row updates in-place | FAILED | toggleExpenseStatus (expenses.js:270) calls expensesUI.render() — Transactions tab not re-rendered |
| 2 | TRANS-02: Income rows show only a redirect button (no Confirm/Edit/Delete) | FAILED | Income action cell (transactions.js:507-513) still renders Confirm + Edit + Delete buttons |
| 3 | TRANS-03: Exactly one reconciliation mode button visible | DEFERRED | toggleExpReconBtn confirmed absent from index.html; reconciliation feature itself is legacy/unclear — deferred per 45-04-SUMMARY |
| 4 | TRANS-04: Single Add button opens type-selection modal | VERIFIED | index.html line 157: #addTransBtn present; openAddTypeModal() exists (transactions.js:161-172) and calls modalUI.show with Income/Expense options |
| 5 | TRANS-05: Sort order toggle re-orders transaction list | VERIFIED | sortOrder: 'desc' property at line 27; _buildMergedRows sort comparator at lines 370-373 negates cmp when sortOrder==='asc'; sortOrderBtn wired at lines 77-84 |
| 6 | TRANS-06: Expense amounts show − prefix; income amounts show + prefix | VERIFIED | transactions.js line 505: `+${formatGBP(...)}` for income; line 534: `\u2212${formatGBP(...)}` for expense |
| 7 | TRANS-07: Search bar placeholder reads "Search transactions" | VERIFIED | index.html line 168: placeholder="Search transactions" confirmed |
| 8 | TRANS-08: Category filter works and includes all non-system categories | FAILED | handleCategoryChange and clearCategoryFilter called in template but not defined as methods — throws at runtime |

**Score: 4/8 truths verified** (TRANS-03 deferred, not counted as pass or fail for this phase)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/ui/transactions.js` | All 8 TRANS fixes implemented | PARTIAL | TRANS-04/05/06/07 implemented; TRANS-01 re-render broken; TRANS-02 redesign missing; TRANS-08 methods missing |
| `index.html` | #addTransBtn, sortOrderBtn, placeholder fix, #toggleExpReconBtn removed | VERIFIED | All 4 HTML changes confirmed present |
| `src/ui/transactions.test.js` | 9 test stubs for TRANS-01 through TRANS-08 | VERIFIED | File exists with 9 stubs; all passed automated gate (744/744 vitest) |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| btn-mark-paid onclick | window.toggleExpenseStatus | direct call | PARTIAL | Function exists but re-renders wrong tab (expenses, not transactions) |
| btn-confirm-income onclick | window.toggleIncCleared | direct call | WIRED | toggleIncCleared (line 148) calls this.render() correctly |
| openAddTypeModal | modalUI.show | direct call (line 169) | WIRED | Confirmed |
| sortOrderBtn.onclick | this.render() | via setupEventListeners (line 82) | WIRED | Confirmed |
| renderCategoryFilter template | transactionUI.handleCategoryChange | onchange attr (line 421) | NOT WIRED | Method not defined on transactionUI — runtime error |
| renderCategoryFilter template | transactionUI.clearCategoryFilter | onclick attr (line 427) | NOT WIRED | Method not defined on transactionUI — runtime error |
| filterTransactions | this.selectedCategories | renderTransactions lines 457-463 | PARTIAL | Wiring correct but selectedCategories never mutated (handleCategoryChange missing) |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TRANS-01 | 45-02 | Mark expense as paid, row updates in-place | BLOCKED | toggleExpenseStatus renders Expenses tab, not Transactions tab |
| TRANS-02 | 45-02 | Confirm income as received (redirect button pattern) | BLOCKED | Income rows still show Confirm/Edit/Delete; redirect-only redesign not implemented |
| TRANS-03 | 45-02 | Single reconciliation mode button | DEFERRED | #toggleExpReconBtn removed; full legacy-button cleanup deferred to future |
| TRANS-04 | 45-02 | Single Add button with type selector | SATISFIED | #addTransBtn + openAddTypeModal confirmed working |
| TRANS-05 | 45-03 | Sort order toggle | SATISFIED | sortOrder property + _buildMergedRows comparator + button wiring confirmed |
| TRANS-06 | 45-03 | ± amount prefixes | SATISFIED | + prefix on income, − prefix on expense confirmed in source |
| TRANS-07 | 45-03 | Search placeholder "Search transactions" | SATISFIED | index.html confirmed |
| TRANS-08 | 45-03 | Category filter includes all non-system categories | BLOCKED | handleCategoryChange not defined — filtering throws at runtime |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/ui/transactions.js | 421 | `transactionUI.handleCategoryChange(this)` called but method not defined | Blocker | Category filter throws at runtime — TRANS-08 broken |
| src/ui/transactions.js | 427 | `transactionUI.clearCategoryFilter()` called but method not defined | Blocker | Clear filter button throws at runtime |
| src/ui/expenses.js | 270 | toggleExpenseStatus calls `this.render()` (expensesUI scope only) | Blocker | Mark Paid on Transactions tab does not update the visible row |
| src/ui/transactions.js | 507-513 | Income action cell: Confirm + Edit + Delete buttons remain | Warning | TRANS-02 redesign (redirect-only) not completed per human verification |

---

## Human Verification Already Completed

The 45-04 plan was a human browser verification checkpoint. Results are incorporated directly:

| Req | Human Result | Automated Evidence Agrees? |
|-----|-------------|---------------------------|
| TRANS-01 | FAIL — row does not re-render | Yes — toggleExpenseStatus renders expensesUI, not transactionUI |
| TRANS-02 | FAIL (redesign needed) — Confirm/Edit/Delete visible, redirect missing | Yes — code shows all 3 buttons still present |
| TRANS-03 | DEFERRED — legacy feature | Yes — button removed from HTML, feature deferred |
| TRANS-04 | PASS | Yes — confirmed in code and HTML |
| TRANS-05 | PASS | Yes — confirmed in code |
| TRANS-06 | PASS | Yes — confirmed in code |
| TRANS-07 | PASS | Yes — confirmed in HTML |
| TRANS-08 | FAIL — handleCategoryChange not a function | Yes — method absent from transactionUI object |

---

## Gaps Summary

Three gaps block goal achievement:

**Gap 1 — TRANS-01: Expense row does not re-render after toggle**
Root cause: `window.toggleExpenseStatus` is owned by `expensesUI` (expenses.js). When it calls `this.render()` at line 270, `this` is `expensesUI`, so the Expenses tab re-renders but the visible Transactions tab row stays stale. Fix requires either dispatching `app:refresh` from `toggleExpenseStatus` (so transactionUI.render() is triggered via its app:refresh listener at line 38), or defining a transactions-scoped toggle that calls transactionUI.render() directly after the DB update.

**Gap 2 — TRANS-02: Income rows need redirect-only action button**
Root cause: The original implementation kept Confirm + Edit + Delete buttons on income rows. Human verification revealed the requirement is for a single redirect button (arrow + "Income" label) matching the debt row pattern (line 522 onclick navigates to debts tab). The Confirm action for income belongs on the Income Sources tab, not the Transactions tab. All three action buttons must be removed and replaced with one redirect button.

**Gap 3 — TRANS-08: handleCategoryChange and clearCategoryFilter not defined**
Root cause: The `renderCategoryFilter` template references `transactionUI.handleCategoryChange(this)` and `transactionUI.clearCategoryFilter()` as onclick/onchange handlers, but neither method was added to the `transactionUI` object. The `filterTransactions` utility is correctly wired in `renderTransactions`, but `this.selectedCategories` is never mutated because the handler that would populate it does not exist. Additionally, the filter should be scoped to categories present in the current month's transactions (not all non-system categories in the DB).

**TRANS-03 (deferred — not a gap to close this phase):**
The duplicate `#toggleExpReconBtn` was removed. The remaining legacy buttons (Reconciliation Mode, Mark All As Paid, Trigger Recurrence) are acknowledged as legacy UI with unclear purpose — logged for future milestone planning per 45-04-SUMMARY decision.

---

*Verified: 2026-03-22*
*Verifier: Claude (gsd-verifier)*
