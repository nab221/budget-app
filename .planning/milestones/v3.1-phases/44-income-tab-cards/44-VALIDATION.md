---
phase: 44
slug: income-tab-cards
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 44 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (resolved from node_modules; no explicit version pinned) |
| **Config file** | vitest.config.js (project root) |
| **Quick run command** | `npx vitest run src/ui/income-sources.test.js` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/ui/income-sources.test.js`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 44-01-01 | 01 | 0 | INCOME-01..05 | unit | `npx vitest run src/ui/income-sources.test.js` | ❌ W0 | ⬜ pending |
| 44-02-01 | 02 | 1 | INCOME-01 | unit | `npx vitest run src/ui/income-sources.test.js` | ❌ W0 | ⬜ pending |
| 44-02-02 | 02 | 1 | INCOME-01 | unit | `npx vitest run src/ui/income-sources.test.js` | ❌ W0 | ⬜ pending |
| 44-03-01 | 03 | 2 | INCOME-02 | unit | `npx vitest run src/ui/income-sources.test.js` | ❌ W0 | ⬜ pending |
| 44-03-02 | 03 | 2 | INCOME-02 | unit | `npx vitest run src/ui/income-sources.test.js` | ❌ W0 | ⬜ pending |
| 44-04-01 | 04 | 3 | INCOME-03,04,05 | unit | `npx vitest run src/ui/income-sources.test.js` | ❌ W0 | ⬜ pending |
| 44-04-02 | 04 | 3 | INCOME-03 | unit | `npx vitest run src/ui/income-sources.test.js` | ❌ W0 | ⬜ pending |
| 44-04-03 | 04 | 3 | INCOME-04 | unit | `npx vitest run src/ui/income-sources.test.js` | ❌ W0 | ⬜ pending |
| 44-04-04 | 04 | 3 | INCOME-05 | unit | `npx vitest run src/ui/income-sources.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/ui/income-sources.test.js` — new test file covering INCOME-01 through INCOME-05
- [ ] Mock pattern from `income-spending-settings.test.js` — `vi.mock('../db/repository.js', ...)` + `vi.mock('./render.js', ...)` + `vi.mock('../utils/haptics.js', ...)`
- [ ] `render.js` mock must include `modalUI: { init: vi.fn(), show: vi.fn(), close: vi.fn(), elements: {...} }` (same as `debts.test.js` mock)
- [ ] `incomeSourceRepository` mock must implement `get(id)` returning a source record and `getActive()` returning an array
- [ ] `incomeRepository` mock must implement `add(data)` and `getAll()` returning an array

*Existing infrastructure covers all other phase requirements — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Card click opens modal visually | INCOME-02 | DOM interaction in browser | Open Income tab, click a source card, verify modal appears with entries |
| Confirm button marks entry as received | INCOME-03 | End-to-end state persistence | Confirm an entry, reopen modal, verify "Received" badge appears |
| Date override saves correctly | INCOME-04 | Input interaction | Set a different date, save, reopen modal, verify new date shown |
| Amount override saves correctly | INCOME-05 | Input interaction | Change amount, save, verify stored amount matches input |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
