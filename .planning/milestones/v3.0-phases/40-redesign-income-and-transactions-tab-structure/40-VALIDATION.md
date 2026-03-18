---
phase: 40
slug: redesign-income-and-transactions-tab-structure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 40 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | vite.config.js |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run`
- **After every plan wave:** Run `npm test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 40-01-W0 | 01 | 0 | 40-02, 40-03, 40-04 | unit (scaffold) | `npm test -- --run tests/transactions-merged.test.js` | ❌ W0 | ⬜ pending |
| 40-02-01 | 02 | 1 | 40-01 | manual/smoke | n/a — label-only HTML change | N/A | ⬜ pending |
| 40-02-02 | 02 | 1 | 40-02 | unit | `npm test -- --run tests/transactions-merged.test.js` | ❌ W0 | ⬜ pending |
| 40-02-03 | 02 | 1 | 40-03 | unit | `npm test -- --run tests/transactions-merged.test.js` | ❌ W0 | ⬜ pending |
| 40-02-04 | 02 | 1 | 40-04 | unit | `npm test -- --run tests/transactions-merged.test.js` | ❌ W0 | ⬜ pending |
| 40-02-05 | 02 | 1 | 40-05 | manual/smoke | n/a — static HTML DOM reorder | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/transactions-merged.test.js` — RED stubs covering:
  - `renderAll()` with panelId `'transactions'` calls `transactionUI.render()` (REQ-40-02)
  - Merged transaction list contains both income and expense rows with `_rowType` tags (REQ-40-03)
  - `transactionUI.renderHeatmap()` calls `renderSpendingHeatmap` for both `transactionsIncomeHeatmapContainer` and `transactionsSpendingHeatmapContainer` (REQ-40-04)

*Existing `tests/income-sources.test.js` (6 tests) requires no changes for this phase.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Pay Sources" tab label shows "Income" | 40-01 | Label-only HTML change — no JS test covers static HTML | Open app, verify bottom nav tab shows "Income" not "Pay Sources" |
| Dashboard heatmaps appear below summary cards | 40-05 | Static HTML reorder — no JS test covers DOM order | Open Dashboard tab, scroll down — heatmaps should be after affordability section |
| Merged transactions list shows both IN and OUT rows in correct month | 40-03 | Visual tag rendering with correct colours | Open Transactions tab, add test income and expense in same month, verify IN/OUT tags |
| Expense rows in merged view show correct edit/delete/navigation behaviour | 40-03 | Debt-linked expense navigation requires click interaction | Tap debt-linked expense row → should navigate to Debts tab |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
