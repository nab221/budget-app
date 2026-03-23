---
phase: 49
slug: reconciliation-mode-legacy-button-audit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 49 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (project default) |
| **Config file** | `vitest.config.js` (project root) |
| **Quick run command** | `npx vitest run src/ui/transactions.test.js` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/ui/transactions.test.js`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 49-01-01 | 01 | 0 | RECON-01 | unit | `npx vitest run src/ui/transactions.test.js` | ❌ W0 | ⬜ pending |
| 49-01-02 | 01 | 0 | RECON-02 | unit | `npx vitest run src/ui/transactions.test.js` | ❌ W0 | ⬜ pending |
| 49-01-03 | 01 | 1 | RECON-01 | unit | `npx vitest run src/ui/transactions.test.js` | ✅ after W0 | ⬜ pending |
| 49-01-04 | 01 | 1 | RECON-02 | unit | `npx vitest run src/ui/transactions.test.js` | ✅ after W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/ui/transactions.test.js` — add RECON-01 describe block asserting `#markAllPaidBtn` is null and `#triggerRecurrenceBtn` is null in Transactions tab DOM
- [ ] `src/ui/transactions.test.js` — add RECON-02 describe block asserting `toggleReconciliationMode()` flips `reconciliationMode` and toggles `hidden` class on `#incReconHeader`

*(Existing test file exists — gaps are new describe blocks within the existing file, not a new file)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reconciliation header KPIs render correctly in browser | RECON-02 | DOM rendering with live data requires browser | Open Transactions tab → click Reconciliation Mode → verify Cleared/Month Total/Difference values display |
| No visual layout breakage after button removal | RECON-01 | Visual regression not automatable in jsdom | Open Transactions tab → verify toolbar looks correct with only Reconciliation Mode button remaining |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
