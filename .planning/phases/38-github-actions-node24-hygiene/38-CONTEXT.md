# Phase 38 Context: GitHub Actions Node.js 24, Legacy Import & Technical Hygiene

## Scope Correction
An earlier draft of this file described a full Data Import & Migration Tool suite (CSV/OFX/QIF). That broad suite belongs in a future milestone. Phase 38 in the v3.0 roadmap covers three tightly-scoped tasks: upgrade the CI pipeline to Node.js 24, add a v2.x legacy JSON data import path in Settings, and complete the test-coverage audit across all new v3.0 modules.

## Objective
Upgrade GitHub Actions to Node.js 24, ship a v2.x-to-v3.0 JSON data import path, and verify that all new modules from Phases 31–37 reach ≥80% line coverage.

## Background

### Node.js 24 Upgrade (TECH-01)
The Node.js 20 LTS EOL date approaches. GitHub Actions workflows must move to Node.js 24 before June 2, 2026. While updating, check the `actions/setup-node` version and upgrade to `v4` if still on an older version.

### Legacy v2.x Data Import (INTEGRITY-02)
Users upgrading from v2.x of the app (simpler IndexedDB schema without income sources, spending buckets, or affordability settings) need a migration path. The import flow in Settings:
1. "Import v2.x Data" button in the Settings panel
2. File picker for a v2.x IndexedDB export JSON (produced by the existing `src/db/backup.js` module running against a v2 DB)
3. Validate: check for known v2.x field shapes; report incompatibilities before committing data
4. Map: transform v2.x records to v3.0 schema field names
5. Write: merge into the current DB — do not overwrite records that already exist in v3 (skip or prompt on conflict)
6. Show: summary of imported records vs skipped records

Key v2.x → v3.0 field mappings that differ:
- `income[].source` → `income.description`
- `expenses[]` rows (flat) → `oneOffExpenses` table
- `debts[].balance` → `debts.outstandingBalance`
- `debts[].apr` (e.g. `'4.9%'` string) → `debts.annualInterestRate` (decimal `0.049`)

### Test Coverage Audit (TECH-04)
Run `vitest --coverage` across all modules introduced in Phases 31–37 and confirm each reaches ≥80% line coverage. Identify and fill the gaps with targeted tests before the milestone closes.

Expected coverage gaps (based on phase scope):
- `src/utils/income.js` (Phase 33)
- `src/ui/income-spending-settings.js` (Phase 33)
- `src/utils/pay-period.js` (Phase 34)
- `src/utils/snapshot-diff.js` (Phase 37)

## Files to Change
- `.github/workflows/deploy.yml` — update `node-version` to `'24'`, upgrade `actions/setup-node` to `v4`
- `src/ui/settings.js` — add "Import v2.x Data" section
- `src/utils/legacy-import.js` — new module: v2.x → v3.0 transform and DB write logic
- `tests/legacy-import.test.js` — new test file

## Acceptance Criteria
- [ ] GitHub Actions workflow uses `node-version: '24'`
- [ ] `actions/setup-node` is at v4 or later
- [ ] "Import v2.x Data" button appears in Settings panel
- [ ] File picker accepts a v2.x JSON export
- [ ] Import validates field shapes and reports incompatibilities before writing
- [ ] Known v2.x → v3.0 field mappings are applied correctly (income.source, expenses→oneOffExpenses, debts.balance, debts.apr)
- [ ] Import does not overwrite existing v3.0 records
- [ ] Import summary shown to user after completion
- [ ] `legacy-import.test.js` achieves ≥ 80% line coverage
- [ ] All new v3.0 modules (Phases 31–37) reach ≥ 80% line coverage per `vitest --coverage`
- [ ] All existing Vitest tests pass

## Technical Notes
- The v2.x export format is the output of `src/db/backup.js` applied to a v2 IndexedDB — read its current output shape carefully before writing field mappings
- APR conversion: strip `%` and divide by 100; handle inputs that are already a decimal float
- The legacy importer must fail gracefully if the file is not a recognised v2.x format — show a clear user-facing error
