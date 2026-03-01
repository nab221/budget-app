# Phase 05-01: PDF Parsing Engine & Data Layer - Summary

## Execution Overview
- **Completed:** 2026-03-01
- **Focus:** Setting up the core PDF parsing engine and data layer enhancements.

## Tasks Completed
1. **Setup Parsing Infrastructure:**
   - Installed `pdfjs-dist`, `string-similarity`, and `date-fns`.
   - Created `src/utils/pdf-parser.js` with `pdfjs-dist` worker setup and coordinate-based text extraction logic.
   - Created `src/utils/string-similarity.js` as a wrapper for fuzzy matching.
   - Wrote unit tests confirming extraction logic and correct handling of scanned (no-text-layer) PDFs.
2. **Initial Parsers & Repository Enhancements:**
   - Updated `src/db/schema.js` to version 4 to include a `categoryMappings` table for learning categorizations.
   - Implemented `findDuplicates`, `suggestCategory`, and `updateCategorizationLearningRule` in `src/db/repository.js`.
   - Implemented initial regex-based auto-parsers for Lloyds/TSB Credit Card and Santander Current account in `src/utils/pdf-parser.js`.

## Deviations & Technical Decisions
- **Schema Update:** Added a new table `categoryMappings` in IndexedDB to support the categorization learning rule rather than trying to infer mappings purely from existing varying transaction descriptions.
- **Amounts:** We continue to extract amounts as parsed floats from the PDF, but rely on the repository to normalize them to integer pence during final import.

## Validation
- Unit tests for `pdf-parser` pass.
- Repository functions query and update the database correctly.
- Bank parsers correctly identify rows based on regex patterns.

## Next Steps
- Move to **05-02-PLAN.md** to build the Preview UI and Manual Mapping fallback, consuming these new data layer methods.