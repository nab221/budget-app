# Phase 38 Research: GitHub Actions Node.js 24, Legacy Import & Technical Hygiene

Date: 2026-03-15
Scope: TECH-01, TECH-04, INTEGRITY-02

## Key findings

1. GitHub Actions Node target is already compliant and ahead of the roadmap minimum.
- `.github/workflows/deploy.yml` is already using `node-version: 24`.
- `.github/workflows/deploy.yml` is already using `actions/setup-node@v6` (newer than the Phase 38 requirement to be at least v4).
- No additional workflow files exist under `.github/workflows/**`, so TECH-01 appears complete unless policy requires pinning to exact major versions elsewhere.

2. There is no `src/ui/settings.js` seam in the current repository.
- Settings tab markup is in `index.html` under `<div class="tab-panel" data-panel="settings">`.
- Settings runtime composition is in `src/app.js` (`window.app.renderAll()` routes settings rendering to `categoryUI` and `targetsUI`).
- Current backup/import actions are wired through `src/ui/backup.js` and surfaced in settings via `src/ui/cloud-sync.js` (`_renderLocalSettingsActions` injects Local Export/Import buttons).
- Practical insertion seam for a new "Import v2.x Data" action is `src/ui/cloud-sync.js` next to `settingsLocalImportBtn`, with hidden file input wiring similar to `#importFile`.

3. Current backup/export envelope shape is v1 backup format with table snapshot in `data`.
- Export shape from `src/ui/backup.js` is:
  - `version` (currently `1`)
  - `encrypted` (boolean)
  - `schema_version` (from `db.verno`)
  - `settings` (selected localStorage keys)
  - `data` (object keyed by table name, each value array of records)
- `importBackupData()` in `src/db/backup.js` expects the table object (`content.data`) and supports merge/overwrite modes.
- Merge mode currently uses `bulkPut` for most tables (incoming record can win on id collision), which does not satisfy INTEGRITY-02 legacy requirement to avoid overwriting existing v3 data.

4. v2.x-to-current schema mapping is feasible, but roadmap field names do not perfectly match current live schema names.
- Current schema in `src/db/schema.js` (v20) and repositories in `src/db/repository.js` still use:
  - `income.source` (not `income.description`)
  - `debts.currentBalance` (not `debts.outstandingBalance`)
  - `debts.apr` and `interestRate` variants (not strictly `annualInterestRate`)
- Legacy mapping logic should support alias output and normalize to the *actual* persisted fields in this repo to avoid writing incompatible records.
- v2-era stores (`fixedSpends`, `variableSpends`, `subscriptions`, earlier `debts.amount`) are visible in migration history in `src/db/schema.js`; these are strong format fingerprints for compatibility checks.

5. Coverage audit seam is currently blocked and phase-31-37 gaps are material.
- `npx vitest run --coverage` currently fails with missing dependency: `@vitest/coverage-v8`.
- Planned modules from phases 31-37 that are absent in current tree (likely 0% or N/A coverage):
  - `src/utils/income.js`
  - `src/ui/income-spending-settings.js`
  - `src/utils/pay-period.js`
  - `src/utils/snapshot-diff.js`
  - `src/ui/components/segmented-control.js`
- Existing covered seam examples do exist (for example `src/utils/banking-calendar.test.js`), but TECH-04 cannot be verified until coverage provider is installed and missing planned modules are either implemented or formally deferred.

## Assumptions to carry into planning

1. TECH-01 will be treated as verification-only unless CI governance requires extra hardening.
- Assumption: no change needed in `.github/workflows/deploy.yml` for Node/setup-node versions.
- Optional hardening may still be planned (for example explicit quoting or action pinning policy), but not required by acceptance criteria.

2. "Settings UI" work for Phase 38 must target existing seams rather than creating an unnecessary `settings.js` rewrite.
- Assumption: add legacy import affordance in `src/ui/cloud-sync.js` local settings actions and/or directly in `index.html` settings panel section.

3. Legacy importer must be a dedicated transform layer, not a direct call to `importBackupData()` with raw legacy payload.
- Assumption: new `src/utils/legacy-import.js` will perform validation + transform + conflict-safe merge plan before any write.

4. Requirement wording for v2->v3 field names will be interpreted as compatibility intent, not exact property-name mandate.
- Assumption: final write model follows current schema (`source`, `currentBalance`, `apr`) with alias support so imported data remains consistent with existing repository methods.

5. TECH-04 is a two-step effort: tooling fix first, then module-by-module audit.
- Assumption: install and configure Vitest coverage provider before setting per-module thresholds.

## Anti-patterns to avoid

1. Do not route legacy JSON straight into `importBackupData()`.
- Why: current merge behavior (`bulkPut`) can overwrite by id and bypass legacy-shape compatibility checks.

2. Do not treat missing docs/file as evidence of non-existence without checking actual runtime seams.
- Why: there is no `src/ui/settings.js`, but settings behavior is spread across `index.html`, `src/app.js`, `src/ui/cloud-sync.js`, and `src/ui/backup.js`.

3. Do not hard-code a single v2 payload signature.
- Why: migration history indicates multiple old store shapes; validator should detect supported variants and return actionable incompatibility reasons.

4. Do not couple mapping logic to UI event handlers.
- Why: keep import logic pure and testable in `src/utils/legacy-import.js`; UI should only orchestrate file pick, preview, confirmation, and result display.

5. Do not run TECH-04 audit without a reproducible coverage command.
- Why: current failure (`Cannot find dependency '@vitest/coverage-v8'`) means any threshold claim would be non-verifiable.

## Proposed legacy-import.js API

```js
// src/utils/legacy-import.js

/**
 * Parse and validate a selected v2 backup file content.
 * Accepts either full backup envelope or raw table map.
 */
export function parseLegacyBackup(jsonText) {
  // returns { ok, envelope, tableData, detectedVersion, issues[] }
}

/**
 * Detect whether incoming payload matches supported v2 signatures.
 * Example signatures: fixedSpends/variableSpends/subscriptions stores,
 * debts.amount-only rows, income.source field presence.
 */
export function detectLegacyShape(tableData) {
  // returns { isLegacyV2, confidence: 'high'|'medium'|'low', reasons[] }
}

/**
 * Validate required records/fields and report compatibility issues
 * before any database write.
 */
export function validateLegacyData(tableData) {
  // returns { valid, errors[], warnings[], stats }
}

/**
 * Transform v2 tables into current v20-compatible table arrays.
 * Must normalize field aliases and convert APR string percent to numeric.
 */
export function mapLegacyToCurrent(tableData, options = {}) {
  // returns {
  //   mappedTables,
  //   mappingReport: {
  //     importedCounts,
  //     skippedCounts,
  //     fieldConversions,
  //     warnings
  //   }
  // }
}

/**
 * Merge mapped records with no overwrite of existing v3 records.
 * Collision strategy defaults to skip, with optional callback hook for prompts.
 */
export async function importLegacyData(db, mappedTables, options = {}) {
  // options: {
  //   onConflict?: (ctx) => 'skip'|'replace'|'merge',
  //   dryRun?: boolean,
  //   restoreSettings?: boolean
  // }
  // returns {
  //   imported: { [table]: number },
  //   skipped: { [table]: number },
  //   conflicts: Array<{table, key, reason}>,
  //   warnings: string[]
  // }
}

/**
 * High-level orchestrator for UI.
 */
export async function runLegacyImport({ db, fileText, onProgress, onConflict }) {
  // returns unified summary for modal/toast rendering
}
```

Mapping behavior to enforce in API implementation:
- Income: accept `source` and alias `description`; persist to current schema field used by app (`source`) while preserving alias metadata only if needed.
- Expenses: map legacy flat `expenses`/`fixedSpends`/`variableSpends` rows into `oneOffExpenses` and/or `recurrentExpenses` based on available recurrence hints.
- Debts:
  - map `balance` -> `currentBalance` (current schema)
  - parse `apr` string like `"4.9%"` to numeric rate format expected by repository (`4.9` percentage in current debt model), with guard for decimal input.
- Conflicts: default `skip` existing records unless explicit user confirmation chooses otherwise.

## Files to change with rationale

1. `.github/workflows/deploy.yml` (optional, verify-only)
- Rationale: confirm no drift from Node 24 and modern setup-node action; currently already compliant.

2. `src/ui/cloud-sync.js`
- Rationale: existing settings-local actions are already injected here; best place to add dedicated "Import v2.x Data" button and click flow.

3. `index.html`
- Rationale: optional explicit settings affordance if you want import action visible in main settings panel independent of cloud section rendering.

4. `src/ui/backup.js`
- Rationale: reuse file picker/decryption UX patterns, but avoid overloading standard backup import path with legacy mapping side effects.

5. `src/utils/legacy-import.js` (new)
- Rationale: isolate validation, shape detection, mapping, and conflict-safe write logic for high testability.

6. `tests/legacy-import.test.js` (new)
- Rationale: enforce >80% line coverage for legacy mapping and conflict policies; easiest way to de-risk INTEGRITY-02.

7. `src/ui/cloud-sync.test.js` and/or new `src/ui/legacy-import.test.js`
- Rationale: verify settings-button placement, file selection wiring, validation errors, confirmation flow, and summary messaging.

8. `package.json`
- Rationale: add coverage provider for TECH-04 (`@vitest/coverage-v8`) and optional explicit coverage script.

9. Optional targeted tests for unresolved Phase 31-37 seams
- `tests/snapshot-diff.test.js` (if module added)
- `src/ui/dashboard.view-toggle.test.js` / segmented control tests (if module added)
- Rationale: close known historical gaps and satisfy TECH-04 matrix.

## Test strategy with concrete commands

Baseline setup:

```bash
npm ci
npm i -D @vitest/coverage-v8
```

Legacy import TDD loop:

```bash
npx vitest run tests/legacy-import.test.js
npx vitest run src/ui/cloud-sync.test.js -t "Import v2.x Data"
```

Coverage audit execution:

```bash
npx vitest run --coverage --reporter=verbose
```

Targeted follow-up for likely under-threshold or missing phase modules:

```bash
# Existing phase seam sanity checks
npx vitest run src/utils/banking-calendar.test.js src/utils/recurrence.test.js

# When implemented in this repo, run these explicitly
npx vitest run tests/income.test.js tests/snapshot-diff.test.js src/utils/pay-period.test.js src/ui/dashboard.view-toggle.test.js
```

Quality gates to enforce in plan:
- Gate A (tooling): coverage command runs successfully in CI and local.
- Gate B (INTEGRITY-02): legacy import tests include validation failure, mapping conversion, no-overwrite conflict, and summary output cases.
- Gate C (TECH-04): each Phase 31-37 target module has line coverage >= 80%, or is explicitly marked deferred with rationale and no false coverage claims.
