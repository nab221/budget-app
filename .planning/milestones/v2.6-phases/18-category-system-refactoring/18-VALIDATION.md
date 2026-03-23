---
phase: 18
slug: category-system-refactoring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vite.config.js` |
| **Quick run command** | `npm test -- --run tests/balance/dashboard-kpis.test.js` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run tests/balance/dashboard-kpis.test.js`
- **After every plan wave:** Run `npm test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | REQ-E | unit/DOM | `npm test -- --run` | ✅ | ⬜ pending |
| 18-01-02 | 01 | 1 | REQ-C | unit | `npm test -- --run tests/balance/dashboard-kpis.test.js` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Verify `tests/balance/dashboard-kpis.test.js` covers `ccPayments`/`loanPayments` with `debtType` field (REQ-C)

*If existing tests cover REQ-C, Wave 0 is a read-only verification pass — no new files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mark-Paid button shows "○ Pending" for unpaid expenses | REQ-E | DOM render; no browser test harness | Open Expenses tab, find unpaid recurrent expense, verify button text is "○ Pending" |
| Mark-Paid button shows "✓ Paid" for paid expenses | REQ-E | DOM render | Mark an expense as paid, verify button text changes to "✓ Paid" |
| Schema v17 `linkedDebtId` index works in browser | REQ-D | Dexie IndexedDB; not testable in Vitest | Add a loan/mortgage debt, delete it, confirm no orphan recurrentExpenses remain |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
