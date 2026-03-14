## Context
- source: previously saved as workspace root `.pr-body.md`
- related PR: #20 (`fix/debt-expense-pence-scaling`)
- commit: `9ad3b81` (merged via `0982c32` on 2026-03-13)
- milestone mapping: post-v2.7 hotfix (after v2.7 close-out)
- closest planning lineage: debt auto-payment generation work from Phase 18 (`.planning/phases/18-category-system-refactoring`) and milestone v2.2 Phase 05 debt-type separation

## Summary
- fix debt payment generation for loans/mortgages to persist expense amounts in pence
- remove incorrect fromPence conversion in debtRepository.generateLoanPayments
- add regression assertion to ensure generated linked expenses keep the expected pence amount

## Root cause
Generated loan/mortgage recurring expenses were inserted directly into db.recurrentExpenses with amount converted to pounds, while the DB stores amounts in pence.

## Validation
- npm test -- --run src/db/repository.test.js
- npm test -- --run