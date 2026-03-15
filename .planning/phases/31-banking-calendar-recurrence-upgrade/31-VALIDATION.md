---
phase: 31
slug: banking-calendar-recurrence-upgrade
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.0.7 |
| **Config file** | `vite.config.js` (vitest config inline) |
| **Quick run command** | `npx vitest run src/utils/banking-calendar.test.js src/utils/recurrence.test.js` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds (quick), ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/utils/banking-calendar.test.js src/utils/recurrence.test.js`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green (393+ tests)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 31-01-01 | 01 | 0 | TECH-02 | unit | `npx vitest run src/utils/banking-calendar.test.js` | ❌ Wave 0 | ⬜ pending |
| 31-01-02 | 01 | 1 | TECH-02 | unit | `npx vitest run src/utils/banking-calendar.test.js` | ❌ Wave 0 | ⬜ pending |
| 31-01-03 | 01 | 1 | TECH-02 | unit | `npx vitest run src/utils/banking-calendar.test.js` | ❌ Wave 0 | ⬜ pending |
| 31-01-04 | 01 | 1 | TECH-02 | unit | `npx vitest run src/utils/banking-calendar.test.js` | ❌ Wave 0 | ⬜ pending |
| 31-02-01 | 02 | 1 | TECH-03 | unit | `npx vitest run src/utils/recurrence.test.js` | ✅ | ⬜ pending |
| 31-02-02 | 02 | 1 | TECH-03 | unit | `npx vitest run src/utils/recurrence.test.js` | ✅ | ⬜ pending |
| 31-02-03 | 02 | 1 | PLAN-03 | unit | `npx vitest run src/utils/recurrence.test.js` | ✅ | ⬜ pending |
| 31-02-04 | 02 | 1 | TECH-03 | unit | `npm test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/utils/banking-calendar.js` — new module with static 2025-2027 holiday data bundled
- [ ] `src/utils/banking-calendar.test.js` — stubs covering all TECH-02 acceptance criteria: `isUKBankHoliday`, `isWorkingDay`, `nextWorkingDay`, `adjustedPaymentDate`, cache/refresh behaviour

*Rationale: The module and its tests don't exist yet; Wave 0 creates both together so subsequent tasks have runnable test infrastructure.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Refresh bank holidays" button in Settings | TECH-02 | Requires browser + network to validate localStorage update | Open Settings → Preferences → click "Refresh bank holidays" → confirm no error toast, re-open DevTools Application → localStorage to see updated `uk_bank_holidays_cache` key |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
