---
phase: 41
slug: bottom-nav-consistency-ios-safe-area
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 41 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + jsdom |
| **Config file** | `vitest.config.js` |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run`
- **After every plan wave:** Run `npm test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green + manual browser checklist completed
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 41-01-01 | 01 | 1 | BOTNAV-03 | manual | N/A | N/A | ⬜ pending |
| 41-01-02 | 01 | 1 | BOTNAV-01 | manual | N/A | N/A | ⬜ pending |
| 41-01-03 | 01 | 1 | BOTNAV-02 | manual | N/A | N/A | ⬜ pending |
| 41-02-01 | 02 | 1 | BOTNAV-04 | unit + manual | `npm test -- --run` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Note: BOTNAV-01, BOTNAV-02, BOTNAV-03 are CSS layout / iOS rendering requirements that cannot be automated in jsdom. They must be verified in Chrome DevTools (390px) for baseline, and Safari responsive design mode or real iPhone for BOTNAV-03.*

---

## Wave 0 Requirements

- [ ] Optional: unit test stub for `_showUpdateBar()` in `src/ui/pwa-ux.js` — covers DOM element creation with `className === 'update-bar'` appended to `document.body`

*No new test infrastructure required — existing Vitest + jsdom setup covers BOTNAV-04 unit testing.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bottom nav fixed and visible on all 8 tabs while scrolling | BOTNAV-01 | jsdom does not implement `position: fixed` layout | Open each of 8 tabs on mobile (390px), scroll to bottom — confirm nav bar never moves |
| Last content item fully visible above bottom nav | BOTNAV-02 | Requires browser layout engine + scroll behavior | On Transactions and Income tabs, scroll to bottom — confirm last row is fully above nav bar |
| iOS safe-area padding respected on iPhone with home indicator | BOTNAV-03 | `env(safe-area-inset-bottom)` requires Safari/iOS WebKit; Chrome DevTools returns 0 even with viewport-fit=cover | Test on real iPhone or Safari responsive design mode — confirm nav does not overlap home indicator |
| PWA update bar appears above nav bar (not overlapping it) | BOTNAV-04 (visual) | Visual positioning of fixed element above another fixed element requires live browser | Trigger update bar (or manually create `#pwa-update-bar` via DevTools) — confirm bar sits above nav bar on mobile |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
