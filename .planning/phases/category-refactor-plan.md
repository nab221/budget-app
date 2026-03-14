# Category Refactor Implementation Plan

Date: 2026-03-09
Sources used: `.planning/phases/category_refactoring_instructions.md`, `.planning/phases/category-refactor-research.md`

## Scope Guardrails
- Treat all prior phase plans/research as untrusted and ignored.
- Preserve existing category IDs and transaction `categoryId` links.
- Migrate group semantics only: `fixed|variable -> expenses`, preserve `system`, ensure `income` exists.

## Task Breakdown (Strict Order)

### Task 1 - Fix category CRUD method mismatches in Settings UI
Files touched:
- `src/ui/categories.js`
- `src/db/repository.js`

Implementation:
- Resolve broken add flow (`addCategory` missing): either update UI to `categoryRepository.add({ group, name })` or add wrapper method in repository.
- Resolve delete/in-use mismatches by ensuring `categoryRepository.isCategoryInUse(id)` and `categoryRepository.deleteCategory(id)` are valid (recommended to add wrappers in repository for backward compatibility and centralized behavior).
- Keep behavior and user messaging unchanged except for removing runtime errors.

Acceptance criteria:
- Clicking `+ Add Category` no longer throws `addCategory is not a function`.
- Deleting a category no longer throws missing method errors.
- In-use safeguard still blocks deletion for categories referenced by transactions.

Test commands/checks:
- `npm test -- src/db/repository.test.js`
- Manual: open Settings, add category in each group option, then attempt delete for both used and unused category.
- Browser console shows no repository method errors in category operations.

Commit boundary (required):
- Commit immediately after passing checks.
- Suggested commit: `fix(categories): restore add/delete/in-use repository contract`

Risk controls:
- Prefer wrapper methods to avoid hidden callers breaking.
- Keep base repository methods untouched to minimize regression.

Rollback notes:
- Revert this commit only: `git revert <task1_commit_sha>`.
- UI returns to prior behavior if rollback needed; no data migration involved yet.

---

### Task 2 - Add Dexie v18 migration for group semantics and income default
Files touched:
- `src/db/schema.js`

Implementation:
- Add schema version `v18` with existing stores unchanged except migration logic in `upgrade()`.
- In upgrade:
  - Map category group `fixed` and `variable` to `expenses`.
  - Preserve `system` categories unchanged.
  - Ensure at least one income category exists; add `{ group: 'income', name: 'Salary' }` only when none exists.
- Make migration idempotent for partially migrated states.

Acceptance criteria:
- Existing DB upgrades to v18 without data loss.
- All legacy `fixed|variable` categories become `expenses`.
- At least one `income` category exists post-upgrade.

Test commands/checks:
- `npm test -- src/db/repository.test.js`
- Add/execute migration-focused test case covering v17 -> v18 conversion.
- Manual check in IndexedDB devtools: verify post-upgrade groups are `expenses|income|system` only.

Commit boundary (required):
- Commit immediately after migration checks pass.
- Suggested commit: `feat(db): add v18 category group migration and income default`

Risk controls:
- No category deletion in migration; modify group field only.
- Guard `Salary` insert with existence check to avoid duplicates.

Rollback notes:
- Dexie schema upgrades are effectively one-way in user browsers.
- Code rollback is possible (`git revert <task2_commit_sha>`), but DB downgrade is not; use backup/restore if recovery is needed.

---

### Task 3 - Update default category seeding to income/expenses/system
Files touched:
- `src/db/repository.js`

Implementation:
- Refactor `seedDefaultCategories()` defaults:
  - Merge old fixed+variable defaults under `group: 'expenses'`.
  - Add `Salary` under `group: 'income'`.
  - Keep `Opening Balance` under `group: 'system'`.
- Keep seed behavior safe for non-empty category tables.

Acceptance criteria:
- Fresh installs seed categories with correct groups (`income`, `expenses`, `system`).
- Existing installs with categories are not duplicated or reset.

Test commands/checks:
- `npm test -- src/db/repository.test.js`
- Manual: clear app data, relaunch app, inspect seeded categories.

Commit boundary (required):
- Commit immediately after checks pass.
- Suggested commit: `feat(categories): seed income and unified expense defaults`

Risk controls:
- Preserve seed guard (`count > 0` short-circuit) to prevent duplicates.
- Keep category names stable where possible to avoid downstream label regressions.

Rollback notes:
- Revert commit: `git revert <task3_commit_sha>`.
- For local validation DB, clear IndexedDB and reseed to restore expected baseline.

---

### Task 4 - Refactor Settings category management UI to Income/Expenses
Files touched:
- `index.html`
- `src/ui/categories.js`

Implementation:
- Replace Settings selector options `fixed/variable` with `income/expenses`.
- Update labels/hints and section headings to "Income Categories" and "Expense Categories".
- Update category list rendering filters from fixed/variable to income/expenses.
- Remove or replace stale `fixCat/varCat/subCat` updater logic with currently active refresh wiring.

Acceptance criteria:
- Settings tab displays only Income and Expense category management semantics.
- Added categories appear in the correct new list immediately.
- No references to fixed/variable remain in Settings UX text.

Test commands/checks:
- `npm test`
- Manual: open Settings and verify selector values, headings, and list rendering after add/delete actions.
- `rg "fixed|variable" src/ui/categories.js index.html` returns no UX-facing legacy text requiring migration (except intended comments if any).

Commit boundary (required):
- Commit immediately after checks pass.
- Suggested commit: `refactor(settings): switch category management UI to income/expenses`

Risk controls:
- Keep DOM IDs stable unless all consumers are updated in same step.
- Validate no dead selector references remain in JS.

Rollback notes:
- Revert commit: `git revert <task4_commit_sha>`.
- If partial UI rollback causes mismatch, re-apply Task 4 as a full unit (do not cherry-pick fragments).

---

### Task 5 - Restrict Income flows to income category pool
Files touched:
- `src/ui/transactions.js`

Implementation:
- Limit income create/edit dropdown population to categories where `group === 'income'`.
- Limit income category filter options to income categories.
- Preserve display stability for legacy rows whose `categoryId` points to non-income category (display existing name without offering wrong-group categories for new selection).

Acceptance criteria:
- Income forms and income filters show only income categories for new interactions.
- Existing income rows still render category names without breakage.

Test commands/checks:
- `npm test`
- Manual: create/edit income transaction, verify only income categories shown.
- Manual: apply income category filter and verify expected rows.

Commit boundary (required):
- Commit immediately after checks pass.
- Suggested commit: `feat(income): scope income forms and filters to income categories`

Risk controls:
- Handle empty income category set gracefully (after migration this should not occur, but UI should not crash).
- Do not mutate historical transaction category IDs in this step.

Rollback notes:
- Revert commit: `git revert <task5_commit_sha>`.
- If rollback is needed after Task 2, migration remains valid and harmless.

---

### Task 6 - Restrict Expense flows to expense category pool
Files touched:
- `src/ui/expenses.js`

Implementation:
- Limit expense create/edit dropdown population to categories where `group === 'expenses'`.
- Limit expense category filter options to expense categories.
- Keep system categories excluded from normal expense selection unless explicitly needed.

Acceptance criteria:
- Expense forms and filters show only expense categories.
- Expense create/edit/filter behavior remains functional.

Test commands/checks:
- `npm test`
- Manual: create/edit recurrent and one-off expense, verify category list scope.
- Manual: expense category filter works with scoped options.

Commit boundary (required):
- Commit immediately after checks pass.
- Suggested commit: `feat(expenses): scope expense forms and filters to expense categories`

Risk controls:
- Validate both recurrent and one-off flows after dropdown changes.
- Ensure debt-related category lookups remain intact.

Rollback notes:
- Revert commit: `git revert <task6_commit_sha>`.

---

### Task 7 - Redesign PDF import category grouping/routing for new semantics
Files touched:
- `src/ui/pdf-import.js`

Implementation:
- Replace fixed/variable option grouping in import UI with expenses/income.
- Remove routing dependency on fixed/variable groups.
- Introduce explicit transaction target selection (recommended: recurrent vs one-off) where needed so import classification is no longer inferred from legacy group names.

Acceptance criteria:
- Import UI reflects new category groups.
- Import still creates correct transaction type and category assignments without fixed/variable logic.

Test commands/checks:
- `npm test`
- Manual: import a sample PDF line mapped to an expense category and verify correct transaction destination.
- Manual: import mapped to income category and verify income destination.

Commit boundary (required):
- Commit immediately after checks pass.
- Suggested commit: `refactor(pdf-import): remove fixed-variable routing dependency`

Risk controls:
- Keep mapping by `categoryId` as canonical to preserve learned mappings.
- Add defensive fallback for unknown groups to avoid dropped imports.

Rollback notes:
- Revert commit: `git revert <task7_commit_sha>`.
- If user-facing import regression appears, temporarily disable auto-classification path and retain manual confirmation.

---

### Task 8 - Update/extend tests for migration and new grouping behavior
Files touched:
- `src/db/repository.test.js`
- Any category-related UI test files that assert fixed/variable semantics

Implementation:
- Replace legacy fixed/variable fixtures and expectations with income/expenses equivalents.
- Add explicit migration test coverage for v17 -> v18 category conversion and Salary insertion rule.
- Add regression checks for group-scoped dropdown behavior where test infrastructure allows.

Acceptance criteria:
- Test suite validates new category semantics and migration safety.
- No failing assertions rely on fixed/variable taxonomy.

Test commands/checks:
- `npm test`
- Optional focused run: `npm test -- src/db/repository.test.js`

Commit boundary (required):
- Commit immediately after checks pass.
- Suggested commit: `test(categories): cover v18 migration and scoped category behavior`

Risk controls:
- Keep tests deterministic (explicit fixtures, no shared DB state leakage).
- Ensure migration tests assert id-preserving behavior.

Rollback notes:
- Revert commit: `git revert <task8_commit_sha>`.
- If urgent release needed, keep prior passing tests but do not ship without at least migration smoke checks.

## Global Risk Controls
- Pre-task safety snapshot: export backup before Task 2 and before Task 7 (`Backup/Restore` feature).
- After each task commit: run smoke checks for Add/Edit/Delete in Income and Expenses tabs.
- Enforce one-task-per-commit to keep rollback surgical.
- Do not combine schema migration and broad UI refactors in one commit.

## Rollback Strategy (Cross-Step)
1. Preferred: `git revert` the specific failing task commit.
2. For DB migration side effects: restore from backup rather than attempting IndexedDB downgrade.
3. If multiple tasks fail in sequence: revert in reverse order (latest first), re-run smoke checks, then re-apply corrected tasks.

## Definition of Done
- All 8 tasks completed in order with one commit per task.
- Category Settings add/delete flow works without missing-method errors.
- DB migration to v18 verified on existing data.
- Fresh seed uses `income|expenses|system` semantics.
- Income and Expense UIs consume scoped category pools.
- PDF import no longer depends on fixed/variable routing.
- Tests updated and passing for refactored category model.
