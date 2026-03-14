
# Phase 38 Context: Data Import & Migration Tools

## Objective
Add tools to import financial data from external sources: CSV import for transactions (income/expenses), OFX/QIF file import, and a legacy data migration path from the v1 app format. Provide validation and a dry-run preview before committing imported data.

## Background

### Why Import Tools Matter
New users want to bring in historical data from bank exports or spreadsheets. Existing users upgrading from v1 of the app need a migration path.

### Supported Import Formats
1. **Generic CSV** — columns: Date, Description, Amount, Type (income/expense), Category (optional)
2. **OFX (Open Financial Exchange)** — standard bank export format; widely supported by UK banks
3. **QIF (Quicken Interchange Format)** — older format, still used by some banks and accounting apps
4. **v1 legacy JSON** — the export format from v1 of this app (documented in `.planning/V1-EXPORT-FORMAT.md`)

### Import Flow
1. User selects file type and uploads file
2. Parser reads and validates the file
3. Dry-run preview: show table of records to be imported (with any validation warnings highlighted in amber)
4. User confirms → records are written to IndexedDB
5. Success toast: "Imported {N} records"
6. Error toast if any records failed (with count and option to download error log)

### Validation Rules
- Date must be a valid ISO date or parseable UK date (DD/MM/YYYY)
- Amount must be a positive number
- Type must be 'income' or 'expense' (case-insensitive); OFX/QIF use DEBIT/CREDIT which must be mapped
- Category: if provided and not matching an existing category name, create the category automatically OR flag for user review
- Duplicate detection: if a record with the same date + description + amount already exists, flag as potential duplicate (don't block import, but show warning)

### Legacy v1 Import
The v1 app exported a JSON object with keys:
```json
{
  "income": [...],
  "expenses": [...],
  "debts": [...],
  "categories": [...]
}
```
The v1 schema differs from v3 in several ways (documented in `.planning/V1-EXPORT-FORMAT.md`). The importer must map v1 fields to v3 fields and handle missing fields gracefully.

**Key v1→v3 field mappings:**
- `income[].date` → `income.date` (same format)
- `income[].amount` → `income.amount` (pence, same)
- `income[].source` → `income.description`
- `expenses[].date` → `oneOffExpenses.date`
- `expenses[].name` → `oneOffExpenses.description`
- `expenses[].amount` → `oneOffExpenses.amount` (pence, same)
- `expenses[].category` → look up `categories.id` by name, create if missing
- `debts[].name` → `debts.name`
- `debts[].balance` → `debts.outstandingBalance`
- `debts[].apr` → `debts.annualInterestRate` (convert % string to decimal: '4.9%' → 0.049)

### Data Integrity After Import
After any import completes, call `validateDataIntegrity()` (Phase 27 module) to check for orphaned records created by the import. If issues are found, show the integrity warning toast.

## New Module: src/utils/importers/
```
src/utils/importers/
  csv-importer.js
  ofx-importer.js
  qif-importer.js
  v1-legacy-importer.js
  import-validator.js
  index.js  (re-exports all importers)
```

## Files to Change
- `src/utils/importers/` — new directory with importer modules
- `src/ui/settings.js` — add "Import Data" section with file type selector and upload UI
- `src/ui/settings.test.js` — extend tests for import UI
- `src/db/repository.js` — bulk insert helpers for import
- `src/utils/data-integrity.js` — called after import (Phase 27 dependency)

## Acceptance Criteria
- [ ] Generic CSV import: parses Date, Description, Amount, Type, Category columns correctly
- [ ] OFX import: parses STMTTRN records, maps DEBIT/CREDIT to expense/income
- [ ] QIF import: parses D (date), T (amount), P (payee), L (category) fields
- [ ] v1 legacy JSON import: correctly maps all v1 fields to v3 schema
- [ ] v1 `debts[].apr` string ('4.9%') correctly converted to decimal (0.049)
- [ ] Dry-run preview shows all records before commit
- [ ] Duplicate records flagged with amber warning (not blocked)
- [ ] Invalid records highlighted with error detail
- [ ] Unknown categories created automatically (or flagged for review — implementation choice)
- [ ] `validateDataIntegrity()` called after import completes
- [ ] All 354+ existing Vitest tests pass
- [ ] Importer unit tests achieve ≥ 90% branch coverage

## Technical Notes
- OFX files use a semi-SGML format; a lightweight parser is needed. Check if `ofx-js` or similar is available on npm before writing a parser from scratch.
- QIF date format is typically MM/DD/YYYY (US format) but some UK exports use DD/MM/YYYY — detect and handle both
- The dry-run preview must not write to IndexedDB until the user confirms
- The `v1-legacy-importer.js` module must handle the case where `.planning/V1-EXPORT-FORMAT.md` documents additional fields not covered above
- APR conversion: strip the `%` character and divide by 100. Handle both `'4.9%'` and `'4.9'` (already decimal) inputs robustly.
