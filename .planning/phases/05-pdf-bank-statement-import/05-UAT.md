# Phase 05: PDF Bank Statement Import - User Acceptance Testing (UAT)

**Status:** IN_PROGRESS
**Start Date:** 2026-03-01
**Last Updated:** 2026-03-01
**Version:** 1.1.0

## Test Cases

| ID | Description | Strategy | Result | Notes |
|----|-------------|----------|--------|-------|
| PDF-01 | Trigger PDF Import Modal | Manual | PASSED | Buttons present in all relevant tabs |
| PDF-02 | Auto-parse Lloyds/TSB CC | Manual | FAILED | Auto-parse works but has description artifacts |
| PDF-03 | Auto-parse Santander Current | Manual | SKIPPED | User requested to skip for now |
| PDF-04 | Manual Mapping Fallback | Manual | PARTIAL | UI improved with skip-rows and 300-row preview |
| PDF-05 | In-line Editing & Bulk Actions | Manual | PARTIAL | Bulk apply works; "Select All" header toggle fails |
| PDF-06 | Duplicate Detection | Manual | PENDING | Not yet tested |
| PDF-07 | TSB Mortgage Logic | Manual | SKIPPED | User requested to skip for now |
| PDF-08 | Learning Rule | Manual | PENDING | Not yet tested |

## Results Summary
- **Total Tests:** 8
- **Passed:** 1
- **Failed:** 1
- **Partial:** 2
- **Skipped:** 2
- **Pending:** 2

## Issues Found & Status
1. **[FIXED] Amount Calculation:** Amounts were showing as pounds instead of pence (£3.42 vs £342). Fixed in `pdf-parser.js`.
2. **[OPEN] Lloyds Description Artifacts:** The parser is still including the "Entry Date" (e.g., "JANUARY") in the description field.
3. **[OPEN] Select All Toggle:** The checkbox in the table header does not correctly toggle all rows.
4. **[FIXED] Manual Mapping Visibility:** Initial preview was too short (10 rows). Increased to 300 rows with a "Skip Header" input.
