---
phase: 16
slug: debt-history-ux-refinement
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^3.0.7 |
| **Config file** | none (auto-detected via package.json `"test": "vitest"`) |
| **Quick run command** | `npx vitest run src/ui/debts.test.js` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/ui/debts.test.js`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | EDIT-04 | unit | `npx vitest run src/ui/debts.test.js` | ✅ | ⬜ pending |
| 16-01-02 | 01 | 1 | EDIT-04 | unit | `npx vitest run src/ui/debts.test.js` | ✅ | ⬜ pending |
| 16-01-03 | 01 | 1 | EDIT-04 | unit | `npx vitest run src/ui/debts.test.js` | ✅ | ⬜ pending |
| 16-01-04 | 01 | 1 | EDIT-04 | unit | `npx vitest run src/ui/debts.test.js` | ✅ | ⬜ pending |
| 16-01-05 | 01 | 1 | HIST-02 | unit | `npx vitest run src/ui/debts.test.js` | ✅ | ⬜ pending |
| 16-01-06 | 01 | 1 | HIST-01 | unit | `npx vitest run src/ui/debts.test.js` | ✅ | ⬜ pending |
| 16-01-07 | 01 | 1 | HIST-03 | unit | `npx vitest run src/ui/debts.test.js` | ✅ | ⬜ pending |
| 16-01-08 | 01 | 1 | HIST-03 | unit | `npx vitest run src/ui/debts.test.js` | ✅ | ⬜ pending |
| 16-01-09 | 01 | 1 | HIST-03 | unit | `npx vitest run src/ui/debts.test.js` | ✅ | ⬜ pending |
| 16-01-10 | 01 | 1 | HIST-03 | unit | `npx vitest run src/ui/debts.test.js` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* `src/ui/debts.test.js` exists with `// @vitest-environment jsdom` and all mocks in place. New `it()` blocks slot into existing `describe` suites. No new setup files needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sticky Date/Actions columns stay visible while scrolling | HIST-01 | CSS `position: sticky` visual behavior not testable in jsdom | Open history modal, scroll table left/right, verify Date column stays on left and Actions stays on right |
| Scroll edge shadows visible at scroll boundaries | HIST-01 | CSS box-shadow visual effect not testable in jsdom | Open history modal, verify shadow on right edge initially, no shadow when scrolled to end |
| Scroll indicator fades after ~2s | HIST-01 | CSS/setTimeout visual fade not verifiable in unit tests | Open history modal, observe horizontal scroll hint fades within 2 seconds |
| Haptic feedback on Mark Paid confirm | HIST-03 | `triggerHaptic` requires device hardware | On mobile, confirm vibration on Mark Paid confirm |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
