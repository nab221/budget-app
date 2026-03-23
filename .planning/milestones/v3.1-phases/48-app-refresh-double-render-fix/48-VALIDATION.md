---
phase: 48
slug: app-refresh-double-render-fix
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 48 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (jsdom environment) |
| **Config file** | `vitest.config.js` |
| **Quick run command** | `npx vitest run src/ui/expenses.test.js` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/ui/expenses.test.js`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 48-01-01 | 01 | 0 | PERF-01 | unit | `npx vitest run src/ui/expenses.test.js` | ✅ (extend) | ⬜ pending |
| 48-01-02 | 01 | 1 | PERF-01 | unit | `npx vitest run src/ui/expenses.test.js` | ✅ | ⬜ pending |
| 48-01-03 | 01 | 1 | PERF-01 | unit | `npx vitest run src/ui/expenses.test.js` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] New test block in `src/ui/expenses.test.js` — PERF-01 double-render prevention tests:
  - `toggleExpenseStatus` calls `expensesUI.render()` exactly once
  - `toggleExpenseStatus` calls `window.transactionUI.render()` exactly once
  - `toggleExpenseStatus` does NOT dispatch `app:refresh`

*No new test files required — extend the existing `expenses.test.js`.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Mark Paid" button text updates to "✓ Paid" in Transactions tab after toggle | PERF-01 | Requires real DOM interaction across tabs | Open Transactions tab → click "Mark Paid" → confirm button text changes immediately without page reload |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
