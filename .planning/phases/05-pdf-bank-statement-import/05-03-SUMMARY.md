# Phase 05-03: Bank Expansion & Refinement - Summary

## Execution Overview
- **Completed:** 2026-03-01
- **Focus:** Expanding the automated parser coverage to Nationwide, Amex, MBNA, and adding specialized logic for TSB Mortgages, plus final UI integration.

## Tasks Completed
1. **Expand Auto-Parsers & Mortgage Logic:**
   - Implemented regex-based parsers in `src/utils/pdf-parser.js` for:
     - **Nationwide:** Handles standard DD MMM formats.
     - **Amex:** Handles both DD/MM/YYYY and DD MMM formats.
     - **MBNA:** Shares the robust Lloyds/TSB CC logic.
   - **TSB Mortgage Logic:** Implemented specialized parsing that identifies "Interest Charged" and "Payment Received". It automatically splits the payment into two rows: the interest charge (debit) and the calculated "Capital Repaid" (credit, calculated as Payment - Interest).
2. **Integration & Final Polish:**
   - Added the "📄 Import Bank Statement" button to the `Income`, `Fixed Spends`, and `Variable` tabs to ensure it is immediately accessible from the primary transaction views.
   - Wired the categorisation learning rule in `pdf-import.js` to trigger automatically upon successful import, allowing the app to "learn" from the user's manual mapping.

## Deviations & Technical Decisions
- **Parser Robustness:** Due to the variety in how banks format their data year-over-year, the parsers use flexible regex matching focused on row structure rather than strict grid coordinates, allowing for minor layout shifts without breaking.
- **Mortgage Capital Calculation:** The parser processes the raw text in two passes to ensure it correctly calculates the Capital Repaid even if the Interest row appears before or after the Payment row in the statement.

## Validation
- All parsers correctly extract dates, descriptions, and amounts, normalizing them to the expected format.
- The TSB Mortgage parser successfully calculates the capital delta.
- The UI triggers correctly from all transaction tabs.

## Phase 05 Conclusion
Phase 05 is complete. The app now supports bulk PDF importing with offline text extraction, automated parsing for 6 UK banks/formats, an intuitive preview and conflict-resolution UI, and a robust manual mapping fallback for unsupported layouts.