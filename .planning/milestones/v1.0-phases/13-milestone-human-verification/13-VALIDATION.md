---
phase: 13
slug: milestone-human-verification
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^3.0.7 |
| **Config file** | none — reads from `package.json` |
| **Quick run command** | `npx vitest run src/ui/debts.test.js` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/ui/debts.test.js`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | ADD-01 | unit | `npx vitest run src/ui/debts.test.js` | ✅ | ⬜ pending |
| 13-01-02 | 01 | 1 | ADD-02 | unit | `npx vitest run src/ui/debts.test.js` | ✅ | ⬜ pending |
| 13-01-03 | 01 | 1 | ADD-03 | unit | `npx vitest run src/ui/debts.test.js` | ✅ | ⬜ pending |
| 13-01-04 | 01 | 1 | EDIT-01 | unit | `npx vitest run src/ui/debts.test.js` | ✅ | ⬜ pending |
| 13-01-05 | 01 | 1 | EDIT-02 | unit | `npx vitest run src/ui/debts.test.js` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

`src/ui/debts.test.js` exists with all mocks in place — no new stubs or fixtures required.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Add button label shows "Add", Save button shows "Save" depending on mode | ADD-01, EDIT-01 | Button label visual check | Open modal in Add mode, verify "Add" button; open in Edit mode, verify "Save" button |
| Error spans appear visually below the correct field | ADD-02 | CSS positioning check | Submit empty name, verify red error text appears directly below the Name field |
| Modal closes after successful save | ADD-01, EDIT-01 | DOM teardown visual | Add or save a debt, verify modal dismisses and list re-renders |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
