# Phase 05: PDF Bank Statement Import - User Acceptance Testing (UAT)

**Status:** COMPLETED
**Start Date:** 2026-03-01
**Last Updated:** 2026-03-01
**Version:** 1.2.0

## Test Cases

| ID | Description | Strategy | Result | Notes |
|----|-------------|----------|--------|-------|
| PDF-01 | Trigger PDF Import Modal | Manual | PASSED | Buttons present in all relevant tabs |
| PDF-02 | Auto-parse Lloyds/TSB CC | Manual | PASSED | Stabilized with fixed regex; descriptions are clean |
| PDF-03 | Auto-parse Santander Current | Manual | PASSED | Verified with new keyword-based credit detection |
| PDF-04 | Manual Mapping Fallback | Manual | PASSED | UI improved with skip-rows and 300-row preview |
| PDF-05 | In-line Editing & Bulk Actions | Manual | PASSED | Bulk apply and "Select All" header toggle verified |
| PDF-06 | Duplicate Detection | Manual | PASSED | correctly identifies transactions with same date/amount |
| PDF-07 | TSB Mortgage Logic | Automated | PASSED | Unit tests verify Capital Repaid = Payment - Interest |
| PDF-08 | Learning Rule | Manual | PASSED | Categories suggested based on past manual assignments |

## Results Summary
- **Total Tests:** 8
- **Passed:** 8
- **Failed:** 0
- **Partial:** 0
- **Skipped:** 0
- **Pending:** 0

## Issues Found & Status
1. **[FIXED] Amount Calculation:** Amounts were showing as pounds instead of pence (£3.42 vs £342). Fixed in `pdf-parser.js`.
2. **[FIXED] Lloyds Description Artifacts:** The parser was including the "Entry Date" (e.g., "JANUARY") in the description field. Fixed with improved regex in 05.1 stabilization.
3. **[FIXED] Select All Toggle:** The checkbox in the table header did not correctly toggle all rows. Fixed in 05.1 stabilization.
4. **[FIXED] Manual Mapping Visibility:** Initial preview was too short (10 rows). Increased to 300 rows with a "Skip Header" input.
5. **[FIXED] ReferenceErrors:** `fixedSpendRepository` and `toPence` were missing imports in `pdf-import.js`. Fixed in 05.1 stabilization.
