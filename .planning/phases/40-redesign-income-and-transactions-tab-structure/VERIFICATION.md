---
phase: 40-redesign-income-and-transactions-tab-structure
type: verification
status: gaps_found
verified_by: human
verified_date: 2026-03-18
---

# Phase 40 Verification

## Verification Outcome: GAPS FOUND

Human UAT completed 2026-03-18. Checks 1, 2, 4, 5, and 6 passed. Check 3 (expense row interactions) failed. Additional gaps identified during review.

---

## Passed Checks

| Check | Description | Result |
|-------|-------------|--------|
| 1 | Tab labels — "Income" and "Transactions" visible | PASS |
| 2 | Transactions tab merged view — IN/OUT pills, date sort | PASS |
| 4 | Heatmaps in Transactions tab | PASS |
| 5 | Dashboard heatmap position (below affordability cards) | PASS |
| 6 | No console errors across all tabs | PASS |

---

## Gaps (gap_closure plans required)

### GAP-01 — Remove Expenses tab
**Severity:** high
**Description:** The Expenses tab still exists as a separate tab. User expectation is that expense management is now unified inside the Transactions tab (consistent with how income transactions work). The Expenses tab should be removed.
**Acceptance:** Expenses tab button absent from nav bar; Expenses panel removed from DOM; "Add expense" flow accessible from within the Transactions tab.

### GAP-02 — Expense CRUD in Transactions tab
**Severity:** high
**Description:** Swipe-right (edit) and swipe-left (delete) interactions for expense rows in the Transactions tab do not work. This is a pre-condition for GAP-01 (only remove the Expenses tab once its full CRUD is operational in Transactions).
**Acceptance:** Swipe-right on non-debt expense row opens edit form; swipe-left opens delete confirmation; both actions commit correctly and re-render the merged list.

### GAP-03 — Income row interactions in Transactions tab
**Severity:** high
**Description:** Income-sourced transaction rows in the Transactions tab should behave like debt rows: no inline edit/delete; tapping an income row redirects to the Income tab. Currently this redirect does not occur.
**Acceptance:** Tapping an income row navigates to the Income tab; no swipe edit/delete affordance rendered on income rows.

### GAP-04 — Duplicate income entries bug
**Severity:** high
**Description:** When adding a new income source in the Income tab, multiple repeated "updated income" notifications and name/rule entries appear. Confirming one causes further duplicates to appear in the Transactions tab.
**Acceptance:** Adding one income source creates exactly one entry in the Income tab list; exactly one corresponding transaction row appears in the Transactions tab.

### GAP-05 — Tab icon and ordering
**Severity:** medium
**Description:** The Transactions tab has no icon. The Income tab should retain its existing icon. Tab order should be: Dashboard → Transactions → Income → Debts → (remaining tabs unchanged).
**Acceptance:** Transactions tab displays the existing expenses icon; Income tab icon unchanged; bottom nav order matches Dashboard → Transactions → Income → Debts.

---

## Out of Scope (planned as future phase)

The following items were raised during UAT but are new features beyond Phase 40 scope:

- Income tab redesign: card-per-source layout (matching debt tab pattern) with click-to-confirm-transaction modal
- Non-confirmed transaction indicator badge on both debt and income cards

---

## Next Step

Run `/gsd:plan-phase 40 --gaps` to generate gap closure plans for GAP-01 through GAP-05.
