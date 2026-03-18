# Phase 39: Requirement-to-Evidence Matrix

**Generated:** 2026-03-17
**Suite result:** 697 tests passed, 0 failures (37 test files)
**Build result:** PASS (vite build, 30.34s, PWA generateSW)

## Legend
- **PASS** — Automated or human evidence confirms requirement is met
- **FAIL** — Evidence shows requirement is not met; release blocker
- **DEFERRED** — Formally deferred to v3.1 with note in STATE.md
- **PENDING** — Requires human verification (Task 2)

---

## P0 Requirements

| ID | Description | Priority | Status | Evidence | Blocker |
|----|-------------|----------|--------|----------|---------|
| PLAN-01 | Current balance entry | P0 | PASS | `db.userPreferences` key-value store, `getSafetyBuffer`/`setSafetyBuffer`; dashboard `getLatestDailySnapshot` and balance-entry modal; 697 tests pass | None |
| PLAN-02 | Pay-period affordability view | P0 | PENDING | `src/utils/pay-period.js` 100% stmt coverage, 31 tests pass; `src/utils/affordability.js` 100% stmt; human fixture verification still required | Task 2 human check |
| PLAN-06 | Income configuration | P0 | PASS | `src/utils/income.js` 96.72% coverage; 28 income tests pass; `incomeSources` store created schema v21; multi-source merge-sort cursor tested | None |
| DEBT-01 | Loan/mortgage projection model | P0 | PASS | `src/utils/finance.js` 96.49% coverage; `calculateAmortisationSchedule` 14 TDD tests pass; amortisation modal in debts.js; 453+ Vitest tests covering this seam | None |
| DEBT-02 | Credit card statements retained (non-regression sentinel) | P0 | PASS | `src/ui/debts.js` 72.22% coverage; statement flow untouched since Phase 29; debts.js uses `isDebtLinked()` check; no regressions in 697-test suite | None |
| MOB-01 | Fixed bottom tab bar | P0 | PENDING | CSS rules present; human device check required on iPhone SE (375px) | Task 2 human check |
| MOB-02 | Fixed top nav/pay-period bar | P0 | PENDING | `--header-height` CSS var; sticky-top logic in dashboard.js; human check required | Task 2 human check |
| MOB-04 | Income tab mobile fix | P0 | PENDING | Swipe gestures in transactions.js; human narrow viewport check required | Task 2 human check |
| MOB-05 | Expenses tab mobile fix | P0 | PENDING | `isDebtLinked()` in expenses.js; badge-chip CSS; human check required | Task 2 human check |
| MOB-06 | Header layout fix | P0 | PENDING | Phase 27 CSS fix applied; human visual check required | Task 2 human check |
| MOB-07 | Magic link auth on PWA/mobile | P0 | PENDING | Phase 30 magic-link fix (emailRedirectTo, navigateFallbackDenylist); human Android/iOS check required | Task 2 human check |
| NAV-01 | Tabs always visible | P0 | PENDING | Fixed bottom tab bar CSS; human scroll test required | Task 2 human check |
| NAV-02 | Navigator always fixed/visible | P0 | PENDING | Phase 36 sticky header logic; human check required | Task 2 human check |
| NAV-03 | Heatmap year boundary fix | P0 | PASS | Phase 27 removes prior-year fetch at 4 heatmap call sites; dashboard.js confirmed; no regression in 697-test suite | None |
| SYNC-01 | Magic link PWA fix | P0 | PENDING | Duplicate of MOB-07; human check required | Task 2 human check |
| SYNC-02 | Cloud sync init/listener safety | P0 | PASS | `_previewListenerBound` guard; `_authListenerBound` guard; 61 cloud-sync tests pass; cloud-sync.js 68.54% coverage; no listener regressions | None |
| TECH-06 | Cloud sync store registration | P0 | PASS | `supabase-sync.js` 97.14% coverage; generic `db.tables.map` path (not allowlist); all v3.0 stores survive round-trip; tested in supabase-sync.test.js | None |
| INTEGRITY-01 | Referential integrity validator | P0 | PASS | `src/utils/data-integrity.js` 98.14% coverage; validateDataIntegrity() runs on startup, after cloud pull, after file import; 3 trigger points confirmed in Phase 27 | None |

## P1 Requirements

| ID | Description | Priority | Status | Evidence | Blocker |
|----|-------------|----------|--------|----------|---------|
| PLAN-03 | Banking calendar awareness | P1 | PASS | `src/utils/banking-calendar.js` 98.14% coverage; `src/utils/recurrence.js` 99.35% coverage; 26 banking-calendar tests + 8 recurrence TDD tests pass; adjustedPaymentDate() confirmed | None |
| PLAN-04 | Spending buckets | P1 | PASS | `spendingBuckets` store schema v21; `spendingBucketRepository.getAll()` in dashboard; prorating in affordability.js (100% coverage); 10 affordability tests pass | None |
| PLAN-05 | Pay-period navigator | P1 | PENDING | `_payPeriodOffset` module state; prev/next nav wired; human visual check of navigator display required | Task 2 human check |
| DEBT-03 | Debt snapshot confirmation | P1 | PASS | `CONFIRM_BALANCE_WARNING_THRESHOLD=0.05`; submitConfirmBalance validates; 11 TDD tests pass; 453+ tests cover this seam | None |
| DEBT-04 | Expense link for debt payments | P1 | PASS | `isDebtLinked()` in expenses.js; row.onclick navigates to Debts tab; 6 expenses tests pass | None |
| CHILD-01 | Childcare required top-up planner | P0 | PASS | `getAllRequiredTopUps()` in childcareRepository; 11 childcare UI tests + 28 childcare utility tests pass; childcare.js tested | None |
| CHILD-02 | Childcare top-up in pay-period view | P1 | PASS | `includeChildcareTopUpsInCommittedOutgoings` in affordability.js; 10 affordability tests pass; integration seam confirmed | None |
| CHILD-03 | Entitlement period display | P1 | PASS | `getEntitlementPeriod()` in childcare.js (100% coverage); surfaced in childcare UI; 28 utility tests cover period calculation | None |
| MOB-03 | Segmented view toggle | P1 | PENDING | Phase 36 radio-control component (100% stmt coverage); WAI-ARIA radiogroup; human accessibility check required | Task 2 human check |
| NAV-04 | Cloud snapshot delta preview | P1 | PASS | `snapshot-diff.js` 100% coverage; 18 snapshot-diff tests pass; `isFirstSyncFallback` logic; cloud-sync.js 68.54% coverage | None |
| TECH-01 | GitHub Actions Node.js 24 | P1 | PASS | Phase 38 confirmed Node 24 compliant (actions/setup-node@v6, node-version:24, FORCE_JAVASCRIPT_ACTIONS_TO_NODE24) | None |
| TECH-02 | Banking calendar utility | P1 | PASS | `src/utils/banking-calendar.js` 98.14% stmt coverage; 26 tests; `nextWorkingDay`, `adjustedPaymentDate` confirmed working | None |
| TECH-03 | Recurrence working-day support | P1 | PASS | `recurrence.js` 99.35% coverage; `paymentAdjustment: 'next-working-day'` tested; advanceNextDate returns predictedPaymentDate | None |
| TECH-04 | Test coverage >=80% for new modules | P1 | PARTIAL | Phase 31-37 core utilities all exceed 80%; deferred modules: `ui/childcare.js` 0% (UI-only, mocked in integration), `ui/cloud-sync.js` 68.54%, `db/repository.js` 76.28% | See note below |
| INTEGRITY-02 | Legacy data import | P2 | PASS | `src/utils/legacy-import.js` 82.55% coverage; 25 legacy-import tests pass; v2 import pipeline confirmed in Phase 38 | None |

### TECH-04 Disposition
Three modules below the 80% threshold:
- `ui/childcare.js`: 0% — no direct unit tests; covered via integration/manual path only. Formally deferred to v3.1.
- `ui/cloud-sync.js`: 68.54% — 61 existing tests cover happy paths; edge cases (error states, offline) not unit tested. Formally deferred to v3.1.
- `db/repository.js`: 76.28% — large file with many paths; core paths tested. Formally deferred to v3.1.

These deferrals are recorded in STATE.md under "Phase 39 P1 Deferrals (v3.1)".

---

## DEBT-02 Non-Regression Sentinel

| Check | Result | Evidence |
|-------|--------|----------|
| Credit card statement flow code unchanged | PASS | `src/ui/debts.js` 72.22% coverage; isDebtLinked() check preserved; no debts.js changes in Phase 39 |
| debts.js test suite passes | PASS | 697 total tests pass; no debts-related failures |
| Statement import/reconciliation code paths | PASS | PDF import UI untouched; cc-statement reconciliation logic in debts.js line range confirmed present |

---

## Cross-Phase Integration Seams

| Seam | Status | Evidence |
|------|--------|----------|
| Income (Phase 33) → Affordability (Phase 34) | PASS | `income.js` 96.72% coverage; `getUpcomingIncomeEvents` tested; `getPayPeriodBounds` uses income events |
| Childcare top-up (Phase 35) → Affordability (Phase 34) | PASS | `includeChildcareTopUpsInCommittedOutgoings` in affordability.js; 10 affordability tests pass |
| Banking calendar (Phase 31) → Recurrence (Phase 31) | PASS | `adjustedPaymentDate()` tested in 26 banking-calendar tests and 8 recurrence tests |
| Cloud sync round-trip (Phase 27/37) | PENDING | Automated: 61 cloud-sync tests pass; human round-trip check required in Task 2 |
| Snapshot delta preview (Phase 37) | PASS | 18 snapshot-diff tests pass; `snapshot-diff.js` 100% coverage |
| Legacy import (Phase 38) | PASS | 25 legacy-import tests pass; `legacy-import.js` 82.55% coverage |
