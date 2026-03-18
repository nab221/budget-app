# Phase 39: Metrics Report

**Date:** 2026-03-17
**Status:** Automated section complete — Lighthouse/axe sections PENDING (Task 2)

---

## Test Counts

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Total test files | 37 | >=35 | PASS |
| Total tests | 697 | >=400 | PASS |
| Failing tests | 0 | 0 | PASS |
| Test files before Phase 27 | ~35 (354 tests) | — | Reference |
| Tests added in Phases 27-38 | +343 | — | Reference |

---

## Coverage Summary

**Provider:** @vitest/coverage-v8@3.2.4

| Category | Value | Threshold | Status |
|----------|-------|-----------|--------|
| All files (overall) | 53.35% | N/A (many UI files have 0%) | Informational |
| Core utility modules (>=80% target) | 10/13 modules | >=80% each | PARTIAL |
| New modules Phase 31-38 (TECH-04) | See breakdown | >=80% | PARTIAL — 3 deferred |

### Module Coverage Breakdown (New Modules — Phase 31-38)

| Module | Stmts% | Funcs% | Target | Status |
|--------|--------|--------|--------|--------|
| utils/banking-calendar.js | 98.14% | 100% | >=80% | PASS |
| utils/recurrence.js (additions) | 99.35% | 100% | >=80% | PASS |
| utils/income.js | 96.72% | 100% | >=80% | PASS |
| utils/pay-period.js | 100% | 100% | >=80% | PASS |
| utils/affordability.js | 100% | 100% | >=80% | PASS |
| utils/childcare.js | 100% | 100% | >=80% | PASS |
| utils/snapshot-diff.js | 100% | 100% | >=80% | PASS |
| utils/legacy-import.js | 82.55% | 100% | >=80% | PASS |
| utils/supabase-sync.js | 97.14% | 93.75% | >=80% | PASS |
| ui/components/segmented-control.js | 100% | 100% | >=80% | PASS |
| db/repository.js (additions) | 76.28% | 48.91% | >=80% | BELOW — deferred to v3.1 |
| ui/childcare.js | 0% | 0% | >=80% | BELOW — deferred to v3.1 |
| ui/cloud-sync.js | 68.54% | 68.57% | >=80% | BELOW — deferred to v3.1 |

---

## Lighthouse Scores (PENDING — Task 2)

Run: `npx lhci autorun` or DevTools Lighthouse on `http://localhost:4173` with Mobile preset.

| Category | Score | Threshold | Status |
|----------|-------|-----------|--------|
| Performance | PENDING | >=90 | PENDING |
| Accessibility | PENDING | >=90 | PENDING |
| Best Practices | PENDING | >=90 | PENDING |
| SEO | PENDING | >=90 | PENDING |

Report path: `____________________`

---

## Accessibility (axe) — PENDING (Task 2)

| Violation Level | Count | Threshold | Status |
|----------------|-------|-----------|--------|
| Critical | PENDING | 0 | PENDING |
| Serious | PENDING | — | PENDING |
| Moderate | PENDING | — | Informational |

---

## Build Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Build time | 30.34s | Includes vite + PWA generateSW |
| Main JS bundle | 1,302.15 kB (gzip: 377.84 kB) | Pre-existing, exceeds 500kB warning |
| CSS bundle | 20.58 kB (gzip: 5.22 kB) | Normal |
| PWA precache entries | 9 (1327.64 KiB) | PWA service worker generated |
| Dynamic import warnings | 4 (pre-existing) | Code-splitting opportunity for v3.1 |

---

## Release Thresholds (for Go/No-Go)

| Gate | Threshold | Current | Status |
|------|-----------|---------|--------|
| Tests | 0 failures | 0 failures | PASS |
| Build | Succeeds | PASS | PASS |
| Lighthouse Performance | >=90 | PENDING | PENDING |
| Lighthouse Accessibility | >=90 | PENDING | PENDING |
| Lighthouse Best Practices | >=90 | PENDING | PENDING |
| Lighthouse SEO | >=90 | PENDING | PENDING |
| axe critical violations | 0 | PENDING | PENDING |
| Console errors on load | 0 | PENDING | PENDING |
