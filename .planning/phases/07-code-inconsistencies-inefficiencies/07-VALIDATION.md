---
phase: 7
slug: code-inconsistencies-inefficiencies
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-07
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.0.7 |
| **Config file** | none — Vitest uses vite.config.js defaults; jsdom set per-file via docblock |
| **Quick run command** | `npm test -- --run src/utils/cashflow.test.js` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run src/utils/cashflow.test.js`
- **After every plan wave:** Run `npm test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-W0-01 | W0 | 0 | exit condition | integration | `npm test -- --run src/utils/cashflow.test.js` | ❌ W0 | ⬜ pending |
| 7-W0-02 | W0 | 0 | advanceNextDate | unit | `npm test -- --run src/utils/recurrence.test.js` | ❌ W0 | ⬜ pending |
| 7-01-01 | 01 | 1 | paid filter | unit | `npm test -- --run src/utils/cashflow.test.js` | ✅ | ⬜ pending |
| 7-01-02 | 01 | 1 | balance unification | integration | `npm test -- --run src/utils/cashflow.test.js` | ❌ W0 | ⬜ pending |
| 7-02-01 | 02 | 1 | advanceNextDate all freq | unit | `npm test -- --run src/utils/recurrence.test.js` | ❌ W0 | ⬜ pending |
| 7-02-02 | 02 | 1 | cycleCurrent gating | unit | `npm test -- --run src/utils/recurrence.test.js` | ❌ W0 | ⬜ pending |
| 7-03-01 | 03 | 2 | dead code removed | smoke | `npm test -- --run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/utils/recurrence.test.js` — add stubs/tests for `advanceNextDate` (all 5 frequencies: weekly, biweekly, monthly, quarterly, annually + cycleCurrent gating for isDebtPayment)
- [ ] `src/utils/cashflow.test.js` — add integration test asserting `calculateForecast` and `getDailyRollingData` return identical closing balance for the same date (days 0–44)
- [ ] `src/utils/cashflow.test.js` — remove `aggregateRollingOverview` describe block (lines 157–226) once function is deleted in Wave 2

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rolling Overview chart visually matches 45-day table closing balance | exit condition | Chart rendering requires browser DOM | Open dashboard, compare chart day-0 balance with table row 0 closing balance |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
