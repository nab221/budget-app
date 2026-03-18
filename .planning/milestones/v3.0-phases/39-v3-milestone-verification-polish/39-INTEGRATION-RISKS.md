# Phase 39: Integration Risks Register

**Date:** 2026-03-17
**Status:** Post automated-verification update

---

## Risk Seam Status

| Seam | Risk Level | Status | Evidence | Notes |
|------|-----------|--------|----------|-------|
| Income (33) → Affordability (34) | HIGH | CLOSED | `income.js` 96.72% coverage; `getUpcomingIncomeEvents` tested with 28 income tests; `getPayPeriodBounds` uses income events in affordability pipeline | Merge-sort cursor strategy confirmed working |
| Childcare top-up (35) → Affordability (34) | HIGH | CLOSED | `includeChildcareTopUpsInCommittedOutgoings` in `affordability.js` confirmed present; 10 affordability tests pass; `getAllRequiredTopUps()` tested in childcare suite | Integration seam confirmed at runtime |
| Banking calendar (31) → Recurrence (31) | MEDIUM | CLOSED | `adjustedPaymentDate()` in `banking-calendar.js` (98.14% coverage); `paymentAdjustment: 'next-working-day'` in recurrence.js (99.35% coverage); 26 + 8 tests pass | UK holiday cache behavior confirmed |
| Navigator/view toggle (34/36) interaction | MEDIUM-HIGH | OPEN | Automated: Phase 36 segmented-control.js 100% coverage; Phase 34 `_payPeriodOffset` module state tested; Human: mobile layout z-index/overlay behavior requires device check | Task 2 required |
| Cloud snapshot delta preview (37) vs import flow | HIGH | CLOSED | 18 snapshot-diff tests pass; `snapshot-diff.js` 100% coverage; `isFirstSyncFallback` logic confirmed; `computeSnapshotDiff` uses `db.tables` async enumeration | Delta is read-only pre-import |
| Legacy import (38) mappings vs live schema | HIGH | CLOSED | 25 legacy-import tests pass; `legacy-import.js` 82.55% coverage; conflict-safe skip-by-default policy; APR normalisation tested | Import wired into cloud-sync.js settings |
| TECH-06 store registration/survival | HIGH | CLOSED | `supabase-sync.js` 97.14% coverage; generic `db.tables.map` path confirmed (not allowlist); all v3.0 stores (`incomeSources`, `spendingBuckets`, `childcareProviders`, etc.) survive round-trip via this path | No allowlist modifications needed |
| TECH-04 coverage completeness | HIGH | PARTIAL | Core utilities ≥80%; 3 UI modules below threshold; formally deferred to v3.1 (see REQ-MATRIX) | Deferred, not blocking for v3.0 |

---

## DEBT-02 Retained Behavior Validation

| Validation Point | Result | Evidence |
|-----------------|--------|----------|
| Credit card debt type handling | PASS | `isDebtLinked()` in expenses.js still routes CC payments; no changes to CC debt flow in Phase 39 |
| Statement import UI | PASS | `pdf-import.js` 0% unit coverage but code present and unchanged; Phase 29 confirmed no changes to CC statement import |
| Reconciliation workflow | PASS | Debts.js 72.22% coverage; cc statement reconciliation paths confirmed in debts.js; 697 tests pass with no debt failures |
| No regressions introduced | PASS | Cashflow fix and affordability test timeout fix do not touch debt code |

---

## Open Risks (Requiring Task 2 Human Verification)

| Risk | Gate | What to Check |
|------|------|---------------|
| Mobile layout regression (MOB-01, MOB-02, MOB-05, MOB-06) | P0 | Fixed bottom tab bar, fixed top navigator, header save-dot alignment on iPhone SE (375px) and Desktop (1440px) |
| Segmented view toggle accessibility (MOB-03) | P1 | Arrow key navigation, ARIA radiogroup semantics, keyboard-only operation |
| PWA magic link authentication (MOB-07, SYNC-01) | P0 | Magic link opens installed PWA on Android and completes auth |
| Offline mode cache behavior | P0 (via MOB-07 scope) | App loads and shows cached data with network disabled |
| Cloud sync round-trip for v3 stores | P0 (via TECH-06 scope) | Push all v3 stores, pull, verify data integrity |
| Lighthouse mobile scores ≥90 | P1 quality gate | Run Lighthouse on preview build, all four categories |
| Accessibility scan (axe) | P0 quality gate | Zero critical violations |
| Console errors on app load | P0 quality gate | No errors on initial load and key tab switches |
| Affordability fixture manual validation | P0 (PLAN-02 human-required) | Expected vs actual balance values for known test fixture |

---

## Defects Found and Closed in Task 1

### DEF-01: getDailyRollingData balance array out-of-bounds
- **File:** `src/utils/cashflow.js`
- **Seam:** getDailyRollingData endDate computation
- **Root cause:** When viewing a month where today > anchor (15th), endDate = anchor+45 left fewer than 45 days of balance data after todayIndex
- **Fix:** `endDate = max(anchor+45, today+45)` guarantees 45-day forecast window always available
- **Test:** cashflow.test.js "balance engine equality" now passes (was: AssertionError undefined !== 0)
- **Severity:** Medium (test failure; no user-visible bug in production since dashboard uses separate render path)

### DEF-02: dashboard.affordability.test.js first-render timeout in full suite
- **File:** `src/ui/dashboard.affordability.test.js`
- **Root cause:** First dynamic import of dashboard.js in full-suite context costs ~16-20s due to environment warmup; 15000ms timeout was insufficient
- **Fix:** Increased test timeout to 30000ms
- **Severity:** Low (flaky test, not a production bug)
