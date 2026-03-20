---
phase: 42
slug: tab-button-uniformity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 42 — Validation Strategy

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
- **Before `/gsd:verify-work`:** Full suite must be green + manual browser verification across all 8 tabs at 390px viewport
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 42-01-01 | 01 | 1 | TABUI-01 | manual + regression | `npm test -- --run` | ✅ | ⬜ pending |
| 42-01-02 | 01 | 1 | TABUI-02 | manual + regression | `npm test -- --run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Note:** TABUI-01 and TABUI-02 are CSS visual rendering requirements. Vitest + jsdom does not implement the CSS cascade, computed styles from media queries, or `:active` pseudo-class visual states. Automated command confirms no JS regression only. Full verification requires Chrome DevTools at 390px viewport or real mobile device.

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

*No new test files or frameworks needed — both requirements are manual-only. The existing 722+ test suite detects any accidental JS regression from the CSS-only change.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All 8 tab buttons are identical height and shape in active and inactive states | TABUI-01 | jsdom does not compute CSS cascade or media query layout; `border-radius`, `box-shadow`, `padding` from `@media (max-width: 768px)` cannot be verified in jsdom | Open Chrome DevTools at 390px viewport. Tap through all 8 tabs. Observe each button maintains identical outer shape and height whether active or inactive. |
| Payoff tab button does not change shape or size when tapped | TABUI-02 | Requires `:active` pseudo-class CSS cascade with live browser layout engine; jsdom cannot simulate touch-triggered `:active` visual state | On Chrome DevTools at 390px (or real iOS device), tap the Payoff tab. Observe it does not grow, shrink, gain a pill background, or change border-radius on tap. Repeat for all 8 tabs. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
