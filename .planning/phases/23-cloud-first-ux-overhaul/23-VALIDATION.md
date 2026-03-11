---
phase: 23
slug: cloud-first-ux-overhaul
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-11
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | vitest.config.js |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run`
- **After every plan wave:** Run `npm test`
- **Before /gsd:verify-work:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 23-01-01 | 01 | 1 | SYNC-UX-01 | Unit | `npm test src/ui/cloud-sync.test.js` | ✅ | ⬜ pending |
| 23-01-02 | 01 | 1 | SYNC-UX-01 | Manual | `n/a` | ✅ | ⬜ pending |
| 23-01-03 | 01 | 1 | SYNC-UX-01 | Manual | `n/a` | ✅ | ⬜ pending |
| 23-01-04 | 01 | 2 | SYNC-UX-01 | Unit | `npm test src/ui/cloud-sync.test.js` | ✅ | ⬜ pending |
| 23-01-05 | 01 | 3 | SYNC-UX-01 | Manual | `n/a` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/ui/cloud-sync.test.js` — Unit test for cloud sync UI logic

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Header Visuals | SYNC-UX-01 | Visual layout | Verify `#cloudSyncActionsHeader` appears in the top bar with correct icons. |
| Button Visibility | SYNC-UX-01 | UI State | Verify local Export/Import buttons hide when Supabase is configured. |
| Tab Redirection | SYNC-UX-01 | Interactive behavior | Verify "Sign In" button in header redirects to Settings tab. |

---

## Validation Sign-Off

- [x] All tasks have <automated> verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending 2026-03-11
