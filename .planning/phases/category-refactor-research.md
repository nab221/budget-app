# Category Refactor Research (Fresh)

Date: 2026-03-09
Scope source: `.planning/phases/category_refactoring_instructions.md` only (no prior phase docs used)

## Current-State Findings

1. Confirmed method mismatch bug in settings add flow.
- `src/ui/categories.js:38` calls `categoryRepository.addCategory(group, name)`.
- `src/db/repository.js:20` defines base `add(data)`, but no `addCategory` wrapper exists in `categoryRepository` (`src/db/repository.js:441`).
- Result: `+ Add Category` in Settings is currently broken as described.

2. Additional method mismatches exist in delete flow.
- `src/ui/categories.js:64` calls `categoryRepository.isCategoryInUse(id)`.
- `src/ui/categories.js:75` calls `categoryRepository.deleteCategory(id)`.
- `src/db/repository.js:20` only provides base `delete(id)` and no `isCategoryInUse` or `deleteCategory` on `categoryRepository`.
- This is a second functional gap in category management and should be resolved in same pass.

3. Category model is still fixed/variable/system at seed and UI level.
- Schema stores `categories: '++id, name, group'` through v17 with no group-semantic migration yet: `src/db/schema.js:538`.
- Default seed uses fixed/variable/system: `src/db/repository.js:450`.
- Settings UI group selector is fixed/variable and lists are fixed/variable: `index.html:361`, `index.html:370`, `index.html:374`.
- Category settings renderer filters by fixed/variable: `src/ui/categories.js:113`, `src/ui/categories.js:118`.

4. Income and expense forms currently share one category pool.
- Income form dropdown loads all categories: `src/ui/transactions.js:177`, `src/ui/transactions.js:206`.
- Income filter also loads all categories and explicitly comments this behavior: `src/ui/transactions.js:366`, `src/ui/transactions.js:367`.
- Expense form dropdown also loads all categories: `src/ui/expenses.js:338`, `src/ui/expenses.js:367`.
- Expense category filter lists all categories: `src/ui/expenses.js:542`.

5. Import logic has hard dependency on fixed vs variable.
- PDF import options are grouped by fixed/variable: `src/ui/pdf-import.js:339`, `src/ui/pdf-import.js:344`.
- Import routing logic depends on group value:
  - fixed -> recurrent expense: `src/ui/pdf-import.js:439`
  - variable -> one-off expense: `src/ui/pdf-import.js:451`
  - else fallback -> income: `src/ui/pdf-import.js:455`
- This path must be redesigned once fixed/variable become expenses/income.

6. Legacy dropdown wiring remains in category UI and appears stale.
- `src/ui/categories.js:145` updates `fixCat/varCat/subCat` dropdowns.
- Those IDs are not present in current `index.html` (no `fixCat`, `varCat`, `subCat` found).
- This suggests legacy/dead wiring that can hide regressions and should be cleaned or replaced with active refresh hooks.

## Current Category Flow Map

1. Data layer.
- Schema table: `categories` with `id/name/group` (`src/db/schema.js:538`).
- Seed entrypoint called on app init: `categoryRepository.seedDefaultCategories()` (`src/app.js:212`).
- Current seed groups: fixed/variable/system (`src/db/repository.js:450`).

2. Settings UI flow.
- Static controls in Settings: `catGroup`, `catName`, `addCatBtn` in `index.html:361`.
- `categoryUI` bind + add/delete handlers: `src/ui/categories.js:23`.
- Render list split by fixed vs variable: `src/ui/categories.js:109`.

3. Income flow.
- Create/update modal uses full category set for `incCat`: `src/ui/transactions.js:177`.
- Save stores `categoryId` on income rows: `src/ui/transactions.js:249`.
- Income filter by category uses same full category set: `src/ui/transactions.js:366`.

4. Expense flow.
- Create/update modal uses full category set for `expCat`: `src/ui/expenses.js:338`.
- Save stores `categoryId` on recurrent/one-off rows: `src/ui/expenses.js:452`.
- Expense filter options also built from full category set: `src/ui/expenses.js:542`.

5. Import/filtering/learning flow.
- PDF import suggestions use category mappings by `categoryId` (id-based, not group-based): `src/db/repository.js:410`.
- PDF import final routing is group-based and currently tied to fixed/variable: `src/ui/pdf-import.js:439`.
- Generic list filtering uses selected category IDs and category name map, not group labels: `src/utils/filtering.js:12`.

## Required Change List (Files and Code Paths)

1. `src/db/schema.js`
- Add v18 schema block with same stores and `upgrade()`.
- In upgrade:
  - map `group: 'fixed'|'variable'` -> `'expenses'`
  - preserve `group: 'system'`
  - ensure at least one income category (seed `Salary` if none)
- Keep migration idempotent for partially migrated data.

2. `src/db/repository.js`
- Update `seedDefaultCategories()` defaults:
  - expense defaults -> `group: 'expenses'`
  - add income default(s), minimum `Salary` -> `group: 'income'`
  - keep `Opening Balance` as `group: 'system'`
- Fix category API mismatch either by:
  - changing UI to base methods (`add`, `delete`) and adding explicit in-use checker, or
  - adding wrappers (`addCategory`, `deleteCategory`, `isCategoryInUse`) for backward compatibility.
- Recommended: add wrappers now to avoid hidden callers breaking.

3. `src/ui/categories.js`
- Replace invalid calls (`addCategory`, `deleteCategory`, `isCategoryInUse`) with supported API or new wrappers.
- Refactor rendering split from fixed/variable to income/expenses (+ optional separate read-only system list).
- Remove stale `fixCat/varCat/subCat` updater logic or replace with active-tab refresh trigger strategy.

4. `index.html`
- Settings text and `catGroup` options: fixed/variable -> income/expenses.
- Rename list containers/headings from fixed/variable to income/expense.

5. `src/ui/transactions.js` (Income)
- Restrict income form category options to `group === 'income'`.
- Restrict income category filter to income categories.
- Preserve display for existing records pointing at non-income categories (legacy IDs), but block new selection of wrong group.

6. `src/ui/expenses.js` (Expenses)
- Restrict expense form category options to `group === 'expenses'` (and optionally allow system only if explicitly intended).
- Restrict expense category filter to expense categories to avoid noise from income categories.

7. `src/ui/pdf-import.js`
- Replace fixed/variable option grouping with expenses/income grouping.
- Redesign import routing rule because old mapping (fixed->recurrent, variable->one-off) becomes invalid after migration.
- Suggested approach: choose target transaction type explicitly in UI (`recurrent` vs `one-off`) instead of inferring from category group.

8. `src/db/repository.test.js` (and any category-related UI tests)
- Update fixtures/assertions that create fixed/variable categories (e.g., `src/db/repository.test.js:351`, `src/db/repository.test.js:622`).
- Add migration tests for v17->v18 and seed behavior for fresh DB.

## Migration Considerations and Edge Cases

1. Backward compatibility and data safety.
- Existing transaction rows store `categoryId`; renaming group values does not change IDs, so relationships remain intact.
- Migration should not delete categories; only rewrite group values and add missing income default.

2. Backup-restore edge case (important).
- Backup import does raw `clear + bulkAdd` (`src/db/backup.js:31`) and does not run a normalization step.
- If a v17-style backup (fixed/variable groups) is restored into an already-v18 DB, those legacy group values can reappear without a Dexie version upgrade trigger.
- Mitigation: run group-normalization post-restore or call a repository-level normalization routine after import.

3. Existing manual income categories.
- If users already created ad-hoc income-like categories under fixed/variable, auto-migration will map them to expenses.
- Decide whether to auto-reclassify by heuristic (risky) or leave as expenses and let users move manually.
- Safer default: no heuristic reclassification; only guarantee `Salary` exists.

4. PDF import behavior regression risk.
- Current logic uses category group to decide recurrent vs one-off expense.
- After unified `expenses` group, this decision must move to explicit user choice or another rule; otherwise imports will misclassify.

5. System category handling.
- Keep `Opening Balance` as `system` and excluded from normal income/expense category pickers unless explicitly required.

## Suggested Implementation Order

1. Add migration and seed updates first.
- Implement schema v18 upgrade in `src/db/schema.js`.
- Update `seedDefaultCategories()` and category repository API compatibility in `src/db/repository.js`.

2. Fix Settings category CRUD and group UI.
- Update `src/ui/categories.js` and `index.html` together.

3. Enforce group-scoped dropdowns in core forms.
- Update `src/ui/transactions.js` (income-only categories).
- Update `src/ui/expenses.js` (expense-only categories).

4. Refactor PDF import classification logic.
- Update `src/ui/pdf-import.js` after group migration semantics are stable.

5. Update tests and run full regression.
- Update repository/UI tests for new group values and migration.

## Validation Checklist

1. Bug fixes.
- `+ Add Category` works in Settings with no console error.
- Category delete path works and in-use guard works as intended.

2. Migration correctness.
- On existing DB (with fixed/variable), upgrade to v18 maps all fixed/variable -> expenses.
- `system` categories remain unchanged.
- `Salary` income category exists after upgrade (created only if missing).

3. Fresh install defaults.
- New DB seeds with income + expenses + system categories in expected groups.

4. Group-scoped UX.
- Income form/filter show only income categories.
- Expense form/filter show only expense categories.
- Settings lists show Income Categories and Expense Categories correctly.

5. Import behavior.
- PDF import category options show updated groups.
- Import still creates correct transaction types after fixed/variable removal.

6. Backward compatibility.
- Legacy transactions keep category labels via unchanged category IDs.
- Backup restore does not leave legacy fixed/variable groups unresolved.

7. Regression smoke.
- Income add/edit/delete still works.
- Expense add/edit/delete still works.
- Debt-linked payment category lookup (`Credit Cards & Loans`) still resolves.
- Category filters still function in income and expenses tabs.
