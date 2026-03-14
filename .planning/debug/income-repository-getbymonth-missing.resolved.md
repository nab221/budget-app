---
status: investigating
trigger: "The app fails to initialize with a TypeError: incomeRepository.getByMonth is not a function in src/ui/transactions.js."
created: 2026-03-04T12:00:00.000Z
updated: 2026-03-04T12:00:00.000Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: incomeRepository is missing the getByMonth method, possibly due to a recent refactoring or name mismatch.
test: Examine src/ui/transactions.js and src/db/repository.js to verify the definition and usage of incomeRepository.getByMonth.
expecting: Either getByMonth is missing from the repository, or it was renamed, or incomeRepository is not correctly initialized.
next_action: Examine src/ui/transactions.js at line 361.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: The app should initialize and render the transactions UI without errors.
actual: TypeError: incomeRepository.getByMonth is not a function at src/ui/transactions.js:361:45.
errors: TypeError: incomeRepository.getByMonth is not a function
    at Object.renderIncome (http://localhost:5173/src/ui/transactions.js:361:45)
    at Object.render (http://localhost:5173/src/ui/transactions.js:296:16)
    at async Object.init (http://localhost:5173/src/ui/transactions.js:27:5)
    at async init (http://localhost:5173/src/app.js:146:3)
reproduction: Start the app and observe the console error during initialization.
started: 2026-03-04

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause:
fix:
verification:
files_changed: []
