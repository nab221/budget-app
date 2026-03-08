---
phase: 11
slug: modal-scaffold
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x |
| **Config file** | None detected — uses Vitest defaults via `"test": "vitest"` in package.json |
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
| 11-01-01 | 01 | 0 | MODAL-01, MODAL-02, MODAL-03, MODAL-04 | unit | `npx vitest run src/ui/debts.test.js` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 1 | MODAL-01 | unit | `npx vitest run src/ui/debts.test.js` | ❌ W0 | ⬜ pending |
| 11-02-02 | 02 | 1 | MODAL-02 | unit | `npx vitest run src/ui/debts.test.js` | ❌ W0 | ⬜ pending |
| 11-02-03 | 02 | 1 | MODAL-03 | unit | `npx vitest run src/ui/debts.test.js` | ❌ W0 | ⬜ pending |
| 11-02-04 | 02 | 1 | MODAL-04 | unit | `npx vitest run src/ui/debts.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/ui/debts.test.js` — stubs for MODAL-01, MODAL-02, MODAL-03, MODAL-04
- [ ] Vitest jsdom environment — add `// @vitest-environment jsdom` header to test file (jsdom already in devDependencies)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Esc key dismisses modal | MODAL-02 (dismiss paths) | Keyboard event simulation is brittle in jsdom | Open modal → press Esc → verify modal hidden |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
