---
status: investigating
trigger: "Investigate issue: debt-id-mismatch-and-save-error"
created: 2024-05-23T10:00:00Z
updated: 2024-05-23T10:00:00Z
---

## Current Focus

hypothesis: DexieError2 at repository.js:252 is caused by a missing table in the transaction. `db.categories` is accessed but not listed in the transaction's tables.
test: Add `db.categories` to the transaction in `statementRepository.addWithExpense`.
expecting: Saving a statement should succeed.
next_action: Fix `statementRepository.addWithExpense` and verify.

## Symptoms

expected: Statements should be linked to the current cards, and saving should work.
actual: Statements are orphaned (ID mismatch), and saving crashes with DexieError.
errors: "[debts] Possible ID mismatch. First stmt in DB has debtId: 9", "Failed to save statement: DexieError2" at repository.js:252.
reproduction: Go to Debts, observe log mismatch, try to save a statement.
started: After v2.2 stabilization.

## Eliminated

## Evidence

- timestamp: 2024-05-23T10:10:00Z
  checked: src/db/repository.js
  found: Line 252 is `const category = await db.categories.where('name').equals('Credit Cards & Loans').first();`.
  implication: This call is inside a transaction `db.transaction('rw', [db.statements, db.recurrentExpenses], ...)` which does NOT include `db.categories`. This causes a DexieError (likely IncompatibleTableError or similar).


root_cause: 
fix: 
verification: 
files_changed: []
