---
status: investigating
trigger: "Investigate and fix the SyntaxError in `src/ui/dashboard.js`: `calculateBalanceChain` is not exported from `src/db/repository.js`."
created: 2024-10-31T10:00:00Z
updated: 2024-10-31T10:00:00Z
---

## Current Focus

hypothesis: `calculateBalanceChain` is either missing or not exported in `src/db/repository.js`.
test: Check `src/db/repository.js` for the function and its export status.
expecting: Either the function is missing, named differently, or not exported.
next_action: Examine `src/db/repository.js`.

## Symptoms

expected: Dashboard should load and display correctly.
actual: "Uncaught SyntaxError: The requested module '/src/db/repository.js' does not provide an export named 'calculateBalanceChain' (at dashboard.js:13:3)"
errors: Uncaught SyntaxError (requested module does not provide export)
reproduction: Happens on every load. All dashboard features are broken.
started: Immediately after the previous fix for Vite syntax error in `dashboard.js`.

## Eliminated

## Evidence

- timestamp: 2024-10-31T10:05:00Z
  checked: `src/db/repository.js`
  found: `calculateBalanceChain` is imported from `../utils/finance.js` but NOT exported.
  implication: `dashboard.js` fails when trying to import it from `repository.js`.

- timestamp: 2024-10-31T10:06:00Z
  checked: `src/ui/dashboard.js`
  found: It imports `calculateBalanceChain` from `../db/repository.js` while also importing `simulatePayoff` and `calcMinPayment` from `../utils/finance.js`.
  implication: The import in `dashboard.js` is misplaced/inconsistent.

## Resolution

root_cause: `src/ui/dashboard.js` attempts to import `calculateBalanceChain` from `src/db/repository.js`, but `src/db/repository.js` does not export it (it only imports it for internal use).
fix: Update `src/ui/dashboard.js` to import `calculateBalanceChain` from `src/utils/finance.js`.
