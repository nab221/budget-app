---
status: investigating
trigger: "Investigate issue: expected-income-currency-mismatch. Summary: Expected income generated predictions are in pounds instead of pence, resulting in values 100x larger than expected."
created: 2024-12-16T15:00:00Z
updated: 2024-12-16T15:00:00Z
---

## Current Focus

hypothesis: Predictions are being stored as decimal pounds instead of integer pence because conversion to pence is missing in the prediction generation logic.
test: Examine `src/ui/expected-income.js` and `src/utils/cashflow.js` for "Generate Predictions" logic.
expecting: Find code that stores predictions without multiplying by 100 or correctly handling pence.
next_action: Search for "Generate Predictions" in the codebase to find the entry point.

## Symptoms

expected: Predicted income entries should be stored in integer pence.
actual: Predicted income entries are stored in pounds (e.g., £2000.00 instead of 200000 pence).
errors: Logical data inflation; no crash reported.
reproduction: Go to "Cash Flow" tab. Click "🪄 Generate Predictions". Observe the generated table values or database entries.
started: New feature; first used after recent UI fixes.

## Eliminated

## Evidence

## Resolution

root_cause: 
fix: 
verification: 
files_changed: []
