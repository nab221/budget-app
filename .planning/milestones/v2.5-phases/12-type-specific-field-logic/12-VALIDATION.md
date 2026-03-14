---
phase: 12
slug: type-specific-field-logic
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^3.0.7 |
| **Config file** | none — vitest reads from package.json `"test": "vitest"` |
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
| 12-01-01 | 01 | 1 | TYPE-01 to TYPE-04 | unit | `npx vitest run src/ui/debts.test.js` | ✅ extend existing | ⬜ pending |
| 12-01-02 | 01 | 1 | TYPE-01 | unit | `npx vitest run src/ui/debts.test.js` | ✅ extend existing | ⬜ pending |
| 12-01-03 | 01 | 1 | TYPE-02 | unit | `npx vitest run src/ui/debts.test.js` | ✅ extend existing | ⬜ pending |
| 12-01-04 | 01 | 1 | TYPE-03 | unit | `npx vitest run src/ui/debts.test.js` | ✅ extend existing | ⬜ pending |
| 12-01-05 | 01 | 1 | TYPE-04 | unit | `npx vitest run src/ui/debts.test.js` | ✅ extend existing | ⬜ pending |
| 12-02-01 | 02 | 2 | EDIT-03 | unit | `npx vitest run src/ui/debts.test.js` | ✅ extend existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

All mocks (modalUI, safeHTML, debtRepository) are already wired in `src/ui/debts.test.js`. Phase 12 tests are additions to the existing `describe` block — no new test files or framework setup needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual fieldset visibility in real browser | TYPE-01 to TYPE-04 | jsdom does not compute CSS — `hidden` class toggled but not visually verified | Open Add modal, cycle through each type in the select, confirm only that type's fieldset is visible |
| Edit modal fieldset pre-selection in real browser | EDIT-03 | jsdom does not compute CSS | Open Edit modal for a non-Credit Card debt, confirm correct fieldset shows without touching the type select |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
