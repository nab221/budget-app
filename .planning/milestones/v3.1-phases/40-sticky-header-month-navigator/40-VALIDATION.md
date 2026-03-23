---
phase: 40
slug: sticky-header-month-navigator
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-18
---

# Phase 40 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + jsdom |
| **Config file** | `vitest.config.js` |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run`
- **After every plan wave:** Run `npm test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 40-01-01 | 01 | 1 | HEADER-01 | manual | N/A — DevTools audit, live browser | N/A | ⬜ pending |
| 40-01-02 | 01 | 1 | HEADER-01 | manual | N/A — CSS sticky requires browser render | N/A | ⬜ pending |
| 40-01-03 | 01 | 1 | HEADER-03 | unit | `npm test -- --run` | ✅ | ⬜ pending |
| 40-01-04 | 01 | 1 | HEADER-02 | manual | N/A — visual inspection in browser | N/A | ⬜ pending |
| 40-01-05 | 01 | 1 | HEADER-03 | unit | `npm test -- --run` | ✅ | ⬜ pending |
| 40-01-06 | 01 | 2 | MONNAV-01 | manual | N/A — requires live browser + banner trigger | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files required.

HEADER-01, HEADER-02, and MONNAV-01 are CSS layout/rendering behaviors that jsdom cannot simulate (no sticky positioning, no scroll events, no box-shadow rendering). These are covered by the browser verification checkpoint in Plan 40-02. HEADER-03 ResizeObserver wiring is covered by the existing test suite (app.js module covered by 453+ Vitest tests).

- The 453+ existing Vitest tests cover modified modules (`app.js`)
- Optional: unit test for ResizeObserver wiring if planner determines JS coverage is warranted

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Header sticks on all 8 tabs while scrolling | HEADER-01 | jsdom does not implement `position: sticky` or live layout | Open each of 8 tabs in Chrome DevTools device emulation (375px), scroll down, confirm header stays fixed |
| Shadow appears only when scrolled down | HEADER-02 | Visual CSS behavior; jsdom renders no box-shadow | Scroll down → shadow visible; scroll to top → shadow gone; check in both light and dark themes |
| Month navigator sticks below header, no overlap | MONNAV-01 | Requires live browser + notification banner triggered | Show `#persistence-warning` banner, scroll Income/Expenses tab, confirm .month-nav top aligns below header with no gap or overlap |
| Tab switch resets scroll to top | HEADER-03 (UX) | Browser scroll behavior; jsdom `window.scrollTo` is a no-op | Scroll down on any tab, switch tab, confirm page instantly shows top — no mid-scroll landing |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
