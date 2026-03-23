---
phase: 19
slug: github-pages-ci-cd-deployment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.0.7 + build smoke tests |
| **Config file** | `vitest.config.js` |
| **Quick run command** | `npm run build && grep '/budget-app/assets' dist/index.html` |
| **Full suite command** | `npm run build && grep '/budget-app/assets' dist/index.html && cat dist/manifest.webmanifest` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build && grep '/budget-app/assets' dist/index.html`
- **After every plan wave:** Run full build smoke + manual URL check
- **Before `/gsd:verify-work`:** Live URL must load app and PWA must install
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| DEPLOY-01 | 01 | 1 | base config | smoke | `npm run build` | N/A — build script | ✅ green |
| DEPLOY-02 | 01 | 1 | asset paths | smoke | `Select-String '/budget-app/assets' dist/index.html` | N/A — build output | ✅ green |
| DEPLOY-03 | 01 | 1 | PWA manifest | smoke | `Select-String '"start_url":"/budget-app/"' dist/manifest.webmanifest` | N/A — build output | ✅ green |
| DEPLOY-04 | 02 | 2 | CI pipeline | manual | GitHub Actions UI | Exists in origin/main | ✅ green (workflow verified in YAML, live run pending push) |
| DEPLOY-05 | 02 | 2 | Live URL | manual | Browser visit https://nab221.github.io/budget-app/ | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — no new test files needed. This phase's verification is build output inspection + manual URL confirmation.

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GitHub Actions workflow runs green | DEPLOY-04 | Requires GitHub remote push + CI execution | Push to `main`, check Actions tab in GitHub UI |
| Live URL loads app | DEPLOY-05 | Requires deployed environment | Visit `https://nab221.github.io/budget-app/` in browser |
| PWA installs correctly | DEPLOY-05 | Requires deployed environment | Check install prompt appears, app works offline |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
