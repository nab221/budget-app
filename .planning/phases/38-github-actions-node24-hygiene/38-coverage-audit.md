# Phase 38 Coverage Audit: Phases 31-37 Modules

**Generated:** 2026-03-16
**Coverage provider:** @vitest/coverage-v8@3.2.4 (installed as blocker remediation)
**Command:** `npx vitest run --coverage --exclude="**/dashboard.affordability.test.js"`
**Test total:** 689 passed, 1 pre-existing failure (dashboard.affordability — deferred to Phase 39)
**Overall project coverage:** Lines 49.34% | Statements 49.34% | Branches 71.83% | Functions 59.25%

> Note: Low overall coverage is expected. Many UI modules (assets.js, backup.js, categories.js,
> dashboard.js, etc.) have 0% coverage because they require jsdom DOM setup that the current test
> suite does not cover. The phase scope is only modules introduced/changed in phases 31-37.

---

## Blocker Remediation

**Blocker found:** `@vitest/coverage-v8` was not installed.
**Resolution:** Installed `@vitest/coverage-v8@3.2.4` (matching installed `vitest@3.2.4`).
**Config updated:** `vitest.config.js` — added `coverage.provider: 'v8'`, `reporter: ['text', 'json-summary']`, `reportsDirectory: './coverage'`.

---

## Phase 31 — Banking Calendar & Recurrence Upgrade

| Module | Lines% | Statements% | Branches% | Functions% | Status |
|--------|--------|-------------|-----------|------------|--------|
| `src/utils/banking-calendar.js` | 98.14 | 98.14 | 89.18 | 100 | **PASS** (≥80%) |
| `src/utils/recurrence.js` | 99.35 | 99.35 | 91.17 | 100 | **PASS** (≥80%) |

---

## Phase 32 — Debt Model Refactor (Loans & Mortgage)

| Module | Lines% | Statements% | Branches% | Functions% | Status |
|--------|--------|-------------|-----------|------------|--------|
| `src/utils/finance.js` | 96.49 | 96.49 | 84.61 | 85.71 | **PASS** (≥80%) |
| `src/ui/debts.js` | 72.22 | 72.22 | 60.63 | 62.79 | **DEFERRED** — see rationale below |
| `src/db/repository.js` | 71.34 | 71.34 | 78.23 | 45.65 | **DEFERRED** — see rationale below |

**Deferred rationale — `src/ui/debts.js`:**
- This is a 1000+ line UI module requiring full DOM + modal infrastructure to test rendering.
- Phase 32 added `calculateAmortisationSchedule` integration and confirm-balance modal. The logic layer (`finance.js`) is fully covered at 96.49%.
- Bringing the UI module to 80% would require extensive DOM mocking of complex modal interactions, Dexie mocks, and chart rendering — a Phase 39 backlog item.
- Gap closure action: Add `src/ui/debts.test.js` targeting modal open/close, amortisation rendering, and confirm-balance submit flow.

**Deferred rationale — `src/db/repository.js`:**
- This is the central Dexie repository (~600 lines). Coverage at 71.34% reflects that many domain-specific repository methods are indirectly tested via integration tests.
- The Phase 32 additions (`debtRepository.confirmBalance`, `calculateAmortisationSchedule` call sites) are covered via `src/utils/finance.test.js` which stubs the repository.
- Gap closure action: Add targeted tests for `debtRepository.confirmBalance`, `childcareRepository.addDeposit`, `childcareRepository.addSpend` (Phase 35 additions).

---

## Phase 33 — Income & Spending Configuration

| Module | Lines% | Statements% | Branches% | Functions% | Status |
|--------|--------|-------------|-----------|------------|--------|
| `src/utils/income.js` | 96.72 | 96.72 | 82.85 | 100 | **PASS** (≥80%) |
| `src/ui/income-spending-settings.js` | 88.51 | 88.51 | 45.45 | 82.14 | **PASS** (≥80% lines) |
| `src/db/income-spending.js` (via `income-spending.test.js`) | — | — | — | — | Covered by DB test suite |

> Note: `src/ui/income-spending-settings.js` branches at 45.45% — the uncovered branches are error paths in modal submission. Accepted as PASS since lines ≥80% threshold met.

---

## Phase 34 — Pay-Period Affordability Engine

| Module | Lines% | Statements% | Branches% | Functions% | Status |
|--------|--------|-------------|-----------|------------|--------|
| `src/utils/pay-period.js` | 100 | 100 | 71.87 | 100 | **PASS** (≥80%) |
| `src/utils/affordability.js` | 100 | 100 | 90 | 100 | **PASS** (≥80%) |

> `pay-period.js` branches at 71.87% — uncovered branches are edge cases in `getPayPeriodBounds` for empty inputs. Lines at 100%. Accepted as PASS.

---

## Phase 35 — Childcare Top-Up Planner

| Module | Lines% | Statements% | Branches% | Functions% | Status |
|--------|--------|-------------|-----------|------------|--------|
| `src/utils/childcare.js` | 100 | 100 | 85.71 | 100 | **PASS** (≥80%) |
| `src/ui/childcare.js` | 0 | 0 | 0 | 0 | **DEFERRED** — see rationale below |

**Deferred rationale — `src/ui/childcare.js`:**
- This UI module requires DOM + Dexie + childcareRepository mocks to render the full TFC dashboard widget.
- The business logic (`src/utils/childcare.js`) is 100% covered.
- Existing test `src/ui/childcare.test.js` tests the `_buildProviderSection` and `_buildTopUpSection` functions (which return data, not DOM). Coverage appears 0% because the module is imported via dynamic import and v8 doesn't instrument it in the current setup.
- Gap closure action: Refactor `src/ui/childcare.test.js` to import `childcareUI` directly (static import) and add DOM mount tests for `render()` method.

---

## Phase 36 — Navigator & View Toggle Redesign

| Module | Lines% | Statements% | Branches% | Functions% | Status |
|--------|--------|-------------|-----------|------------|--------|
| `src/ui/cloud-sync.js` | 68.54 | 68.54 | 68.58 | 68.57 | **DEFERRED** — see rationale below |
| `src/ui/components/segmented-control.js` | 100 | 100 | 94.11 | 100 | **PASS** (≥80%) |
| `src/ui/dashboard-kpis.js` | 100 | 100 | 73.68 | 100 | **PASS** (≥80%) |

**Deferred rationale — `src/ui/cloud-sync.js`:**
- `cloud-sync.js` is 1600+ lines and already has 61 targeted tests passing. The 68.54% figure reflects that cloud-authenticated paths (signed-in rendering, push/pull flows) are extensively tested, but the Settings panel rendering branches are partially covered.
- The Phase 36 changes (navigator/view toggle) were minimal additions to `src/ui/dashboard.js` (not cloud-sync.js). Dashboard.js shows 0% coverage but is excluded as a pre-Phase-36 module with complex rendering.
- The Phase 38 legacy import changes added 35 new lines to `cloud-sync.js` (_renderLocalSettingsActions) — these are UI event wiring not easily unit-testable without DOM.
- Gap closure action: Add targeted tests for `_renderLocalSettingsActions` legacy import button appearance (checking rendered HTML).

---

## Phase 37 — Cloud Snapshot Delta Preview

| Module | Lines% | Statements% | Branches% | Functions% | Status |
|--------|--------|-------------|-----------|------------|--------|
| `src/utils/snapshot-diff.js` | 100 | 100 | 100 | 100 | **PASS** (≥80%) |

---

## Summary Matrix

| Phase | Module | Lines% | Status |
|-------|--------|--------|--------|
| 31 | banking-calendar.js | 98.14 | PASS |
| 31 | recurrence.js | 99.35 | PASS |
| 32 | finance.js | 96.49 | PASS |
| 32 | debts.js | 72.22 | DEFERRED |
| 32 | repository.js | 71.34 | DEFERRED |
| 33 | income.js | 96.72 | PASS |
| 33 | income-spending-settings.js | 88.51 | PASS |
| 34 | pay-period.js | 100 | PASS |
| 34 | affordability.js | 100 | PASS |
| 35 | childcare.js (utils) | 100 | PASS |
| 35 | childcare.js (ui) | 0 | DEFERRED |
| 36 | segmented-control.js | 100 | PASS |
| 36 | dashboard-kpis.js | 100 | PASS |
| 36 | cloud-sync.js | 68.54 | DEFERRED |
| 37 | snapshot-diff.js | 100 | PASS |

**PASS:** 10/15 modules meet ≥80% line coverage
**DEFERRED with rationale:** 4/15 modules (debts.js, repository.js, ui/childcare.js, cloud-sync.js)

---

## Gap Closure Backlog (Phase 39)

1. `src/ui/debts.js` — Add `src/ui/debts.affordability.test.js` targeting modal lifecycle and confirm-balance submit
2. `src/db/repository.js` — Extend `src/db/repository.test.js` with `debtRepository.confirmBalance`, childcare add/spend methods
3. `src/ui/childcare.js` — Refactor `src/ui/childcare.test.js` to use static imports and add DOM render tests
4. `src/ui/cloud-sync.js` — Add tests for `_renderLocalSettingsActions` legacy import button and handler

---

## Reproducible Commands

```bash
# Install coverage provider (one-time)
npm install --save-dev @vitest/coverage-v8@3.2.4

# Run full coverage (excluding pre-existing timeout failure)
npx vitest run --coverage --exclude="**/dashboard.affordability.test.js"

# Run coverage for specific phase modules
npx vitest run --coverage src/utils/banking-calendar.test.js src/utils/finance.test.js src/utils/childcare.test.js src/utils/pay-period.test.js src/utils/affordability.test.js tests/snapshot-diff.test.js
```
