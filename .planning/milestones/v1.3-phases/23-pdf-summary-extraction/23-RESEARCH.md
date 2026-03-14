# Phase 23: PDF Summary Extraction - Research

**Researched:** 2026-03-02
**Domain:** PDF Parsing, Regex Data Extraction, Debt Management UI
**Confidence:** HIGH

## Summary

Phase 23 aims to automate the entry of monthly debt statements by extracting summary fields (Opening Balance, New Balance, Minimum Payment, and Due Date) from PDF bank statements. This builds upon the existing PDF transaction import logic in `src/utils/pdf-parser.js` and `src/ui/pdf-import.js`, repurposing the text extraction layer for high-level summary data rather than row-by-row transaction lists.

**Primary recommendation:** Implement a dedicated "Statement Mode" in the PDF import utility that uses targeted regex patterns to extract summary values from the joined text of a PDF, then pre-fills the statement entry form in the Debt UI for user verification.

## User Constraints (from CONTEXT.md)

*No CONTEXT.md found for Phase 23. Research is guided by ROADMAP.md and REQUIREMENTS.md.*

### Locked Decisions (from REQUIREMENTS.md)
- **DEBT-03.1**: Enhance `pdf-import.js` with a "Statement Summary" mode distinct from transaction parsing.
- **DEBT-03.2**: Implement regex-based extraction for key fields (Balance, Min Due, Due Date) across multiple UK bank formats.
- **DEBT-03.3**: Pre-fill the statement logging form with extracted data for user review.
- **DEBT-03.4**: Provide manual fallback and hint if extraction fails.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEBT-03.1 | "Statement Summary" mode | UI integration plan in `pdf-import.js` to switch between modes. |
| DEBT-03.2 | Regex-based extraction | Researched patterns for Barclays, HSBC, Lloyds, Santander, NatWest, Amex. |
| DEBT-03.3 | Pre-fill statement form | Strategy defined for `debts.js` to accept data objects for pre-filling. |
| DEBT-03.4 | Manual fallback/hint | Fallback logic identified for when regex fails to return matches. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pdfjs-dist | ^5.4.624 | PDF text extraction | Already integrated and working for transaction imports. |
| Regex | ES2020 | Pattern matching | Deterministic, local (no API cost/latency), and sufficient for structured bank summaries. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|--------------|
| date-fns | ^4.1.0 | Date normalization | For converting extracted date strings (e.g., "14 Aug 2025") into ISO format. |

## Architecture Patterns

### Recommended Integration Flow
1. **Trigger:** User clicks "Import PDF" button in the Debt Statement history view.
2. **Context:** `pdfImportUI` is opened with `mode = 'statement'` and `targetDebtId = X`.
3. **Extraction:** `extractTextFromPdf` retrieves text rows; `extractStatementSummary(rows)` joins text and applies regex.
4. **Handoff:** Data object `{ date, openingBalance, amount, minimumPayment, paymentDueDate }` is passed to `debtUI`.
5. **UI:** `debtUI.renderStmtForm()` is called with the pre-filled data; form is displayed for user confirmation.

### Recommended Project Structure
- `src/utils/pdf-parser.js`: Add `extractStatementSummary(rows)`.
- `src/ui/pdf-import.js`: Add mode-switching logic and `handleFileUploadForStatement(debtId)`.
- `src/ui/debts.js`: Add `prefillStatementForm(data)` to populate and show the inline form.

### Pattern: Summary Extraction Regex
Instead of parsing rows, join the entire PDF text into a single string (normalized with spaces) and use global/case-insensitive regex to find labels and their trailing values.

```javascript
// Example Extraction Logic
const text = rows.map(r => r.map(item => item.text).join(' ')).join('
');
const balanceMatch = text.match(/(?:New Balance|Closing Balance|Total Amount Due)[:\s]*£?([\d,]+\.\d{2})/i);
```

### Anti-Patterns to Avoid
- **Over-reliance on Column Order:** Summary fields are rarely in stable columns across banks; use labels (text) as anchors instead.
- **Direct Database Injection:** Always pre-fill a UI form first. Bank statements can be complex; users must verify the extraction before saving.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF Text Layer | Custom parser | `pdfjs-dist` | Already handles PDF versions, font encodings, and coordinates. |
| Date Parsing | Manual regex for every month | `date-fns` / `new Date()` | Handles locale-specific month names and leap years. |
| Currency Parsing | `parseFloat()` directly | `toPence()` (existing) | Avoids floating point errors by using integers (pence). |

## Common Pitfalls

### Pitfall 1: Scanned / Image-based PDFs
**What goes wrong:** `pdfjs-dist` returns no text items if the PDF is just an image.
**How to avoid:** Catch the "NO_TEXT_LAYER" error (already implemented) and provide a clear manual entry instruction.

### Pitfall 2: Date Format Ambiguity
**What goes wrong:** "01/02/2024" can be Feb 1st (UK) or Jan 2nd (US).
**How to avoid:** Since the app focuses on UK banks, default to `DD/MM/YYYY`. Use `date-fns` for explicit formatting.

### Pitfall 3: Multiple Matches
**What goes wrong:** A PDF might mention "Minimum Payment" in both a summary table and a late fee warning.
**How to avoid:** Take the first match or look for matches specifically near other summary keywords (e.g., within the first 2000 characters).

## Code Examples

### Standard Regex Patterns for UK Banks

| Field | Regex Pattern | Banks |
|-------|---------------|-------|
| **Statement Date** | `/(?:Statement Date|Produced On|Date of Statement)[:\s]*(\d{1,2}[-/\s](?:\d{1,2}|[a-z]{3})[-/\s]\d{2,4})/i` | Universal |
| **Opening Balance** | `/(?:Opening Balance|Previous Balance|Balance B\/F)[:\s]*£?([\d,]+\.\d{2})/i` | Barclays, HSBC, NatWest |
| **Closing Balance** | `/(?:Closing Balance|New Balance|Balance C\/F)[:\s]*£?([\d,]+\.\d{2})/i` | Barclays, Lloyds, Santander |
| **Min Payment** | `/(?:Minimum Payment|Min Payment Due)[:\s]*£?([\d,]+\.\d{2})/i` | Credit Cards (Universal) |
| **Due Date** | `/(?:Payment Due Date|Date when payment is needed|Payment due on)[:\s]*(\d{1,2}[-/\s](?:\d{1,2}|[a-z]{3})[-/\s]\d{2,4})/i` | Universal |

### Extraction Helper Concept
```javascript
export function extractStatementSummary(rows) {
  const text = rows.map(r => r.map(item => item.text).join(' ')).join(' ');
  const find = (regex) => {
    const m = text.match(regex);
    return m ? m[1].replace(/,/g, '') : null;
  };
  
  return {
    openingBalance: find(/(?:Opening|Previous) Balance[:\s]*£?([\d,]+\.\d{2})/i),
    closingBalance: find(/(?:Closing|New) Balance[:\s]*£?([\d,]+\.\d{2})/i),
    minPayment: find(/Minimum Payment(?: Due)?[:\s]*£?([\d,]+\.\d{2})/i),
    dueDate: find(/(?:Payment Due Date|Payment due on)[:\s]*(\d{1,2}\s[A-Za-z]{3,}\s\d{2,4})/i)
    // ... add logic to normalize dates using date-fns
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual Data Entry | PDF Summary Extraction | v1.3 | Reduces friction for tracking credit card statements. |
| Row-based Parsing | String-based Regex Matching | v1.3 | Simplifies extraction of non-tabular summary data. |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^3.0.7 |
| Config file | `vite.config.js` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEBT-03.2 | Regex correctly extracts fields from sample text | unit | `npm test src/utils/pdf-parser.test.js` | ❌ Wave 0 |
| DEBT-03.3 | Extracted data pre-fills UI form inputs | unit (JSDOM) | `npm test src/ui/debts.test.js` | ❌ Wave 0 |

### Wave 0 Gaps
- [ ] `src/utils/pdf-parser.test.js` — Test suite for `extractStatementSummary` with various bank text samples.
- [ ] `src/ui/debts.test.js` — Test suite for form pre-filling logic.

## Sources

### Primary (HIGH confidence)
- `src/utils/pdf-parser.js` - Existing PDF extraction logic.
- `src/ui/pdf-import.js` - Existing UI for imports.
- Official Bank Statement Samples (Barclays, HSBC, Lloyds) - Verified label terminology.

### Secondary (MEDIUM confidence)
- Web search for UK bank statement regex patterns - Used for broader bank coverage (NatWest, Santander).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Built on existing libraries.
- Architecture: HIGH - Clear path for integration with existing forms.
- Pitfalls: MEDIUM - Real-world PDFs can vary; regex needs to be robust.

**Research date:** 2026-03-02
**Valid until:** 2026-04-02
