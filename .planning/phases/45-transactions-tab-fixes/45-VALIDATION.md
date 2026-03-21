---
phase: 45
slug: transactions-tab-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 45 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (jsdom environment) |
| **Config file** | `vitest.config.js` |
| **Quick run command** | `npx vitest run src/ui/transactions.test.js` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/ui/transactions.test.js`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 45-01-01 | 01 | 0 | TRANS-01–08 | unit setup | `npx vitest run src/ui/transactions.test.js` | ❌ W0 | ⬜ pending |
| 45-02-01 | 02 | 1 | TRANS-01 | unit | `npx vitest run src/ui/transactions.test.js` | ❌ W0 | ⬜ pending |
| 45-02-02 | 02 | 1 | TRANS-02 | unit | `npx vitest run src/ui/transactions.test.js` | ❌ W0 | ⬜ pending |
| 45-02-03 | 02 | 1 | TRANS-03 | unit | `npx vitest run src/ui/transactions.test.js` | ❌ W0 | ⬜ pending |
| 45-02-04 | 02 | 1 | TRANS-04 | unit | `npx vitest run src/ui/transactions.test.js` | ❌ W0 | ⬜ pending |
| 45-03-01 | 03 | 1 | TRANS-05 | unit | `npx vitest run src/ui/transactions.test.js` | ❌ W0 | ⬜ pending |
| 45-03-02 | 03 | 1 | TRANS-06 | unit | `npx vitest run src/ui/transactions.test.js` | ❌ W0 | ⬜ pending |
| 45-03-03 | 03 | 1 | TRANS-07 | unit (DOM assert) | `npx vitest run src/ui/transactions.test.js` | ❌ W0 | ⬜ pending |
| 45-03-04 | 03 | 1 | TRANS-08 | unit | `npx vitest run src/ui/transactions.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/ui/transactions.test.js` — stubs for TRANS-01 through TRANS-08 (follow `src/ui/expenses.test.js` mock pattern)

*Mock pattern: mock `../db/repository.js`, `./render.js`, `../utils/haptics.js`, `../utils/currency.js`*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mark Paid button shows ✓ Paid styling visually | TRANS-01 | CSS class visual state | Load app, find expense row, click Mark Paid, verify button turns green/success |
| Confirm Received button shows ✓ Received styling | TRANS-02 | CSS class visual state | Load app, find income row, click Confirm, verify button turns green/success |
| Unified Add modal presents income/expense choice | TRANS-04 | Modal interaction flow | Click + Add, verify modal opens with two buttons: Income, Expense |
| Sort order button text updates on toggle | TRANS-05 | Button label change | Click sort button, verify label switches between "↓ Newest First" / "↑ Oldest First" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
