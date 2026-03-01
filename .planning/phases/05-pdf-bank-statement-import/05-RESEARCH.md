# Phase 05: PDF Bank Statement Import - Research

**Researched:** 2026-02-28
**Domain:** Browser-based PDF Parsing & Financial Data Extraction
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **In-line Editing:** Users must be able to edit descriptions and categories directly in the preview table before confirming the import.
- **Bulk Actions:** Support selecting multiple rows to apply a single category at once.
- **Visual Cues:** Highlight transactions without a determined category (e.g., yellow background).
- **Selection Memory:** The app will not remember unchecked states between different sessions.
- **Matching Rule:** Duplicates identified by **Date + Amount**. Description matching is "loose".
- **Conflict Review:** Detected duplicates moved to a separate section/tab.
- **Suggestion Engine:** Suggest categories based on history; mark with "Suggested" badge.
- **Learning Rule:** Update internal mapping of descriptions-to-categories immediately upon import.
- **Target Banks:** 
    - Credit: TSB, Nationwide, Lloyds, Amex, MBNA.
    - Current: Santander (Salary/DD focus).
- **TSB Mortgage:** Extract "Interest Charged" and "Capital Paid" (Interest is a debit, Payment is a credit; Capital = Payment - Interest).
- **Shared Accounts:** Import as single block (no per-person tagging).

### Claude's Discretion
- Implementation details for the fallback "Manual Column Mapping" UI.

### Deferred Ideas (OUT OF SCOPE)
- Manual Column Mapping implementation details (deferred to this research phase).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PDF-01 | Automatic parsing (Barclays, HSBC, etc) | Use `pdf.js` coordinate-based extraction + Regex patterns for UK banks. |
| PDF-02 | Preview and selection | Standard table-based UI with checkboxes and inline editing. |
| PDF-03 | Manual column mapping | Side-by-side mapping UI with data preview (Airtable-style). |
| PDF-04 | Image/Scanned detection | Check for empty text content in PDF pages. |
| PDF-05 | Category integration | Suggestion engine using Jaro-Winkler fuzzy matching. |
</phase_requirements>

## Summary
The primary challenge is the tabular nature of bank statements. Standard text-dumping libraries lose structure. The solution must use **coordinate-based extraction** via `pdf.js` to reconstruct rows and columns accurately. For banks like TSB Mortgage, specific logic is needed to derive Capital Repaid from the balance-affecting transactions.

**Primary recommendation:** Use `unpdf` (a browser-friendly `pdf.js` wrapper) to extract text items with `[x, y]` coordinates. Group items by Y-coordinate to form rows, then sort by X to identify columns.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pdfjs-dist` | Latest | PDF Extraction | Industry standard; provides coordinates for tabular data. |
| `string-similarity` | Latest | Fuzzy Matching | Implements Sorensen-Dice/Jaro-Winkler for "loose" description matching. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|--------------|
| `date-fns` | 3.x | Date Parsing | To handle various UK bank date formats (e.g., "02 Mar", "11-Apr"). |

**Installation:**
```bash
npm install pdfjs-dist string-similarity date-fns
```

## Architecture Patterns

### Coordinate-Based Extraction
1. Load PDF via `pdfjs-dist`.
2. For each page, get text items with their `transform` matrix (coordinates).
3. Group items where `Math.abs(y1 - y2) < threshold` (usually 2-5 pixels).
4. Sort each group by `x` coordinate.
5. Identify columns based on `x` ranges or relative ordering.

### Suggestion Engine Logic
1. Clean input description (remove numbers, "STORE", "LTD", etc.).
2. Calculate Jaro-Winkler distance against all previous unique `(description, category)` pairs.
3. If distance > 0.85, suggest the category.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF Parsing | Custom Byte Reader | `pdf.js` | PDF format is incredibly complex and versioned. |
| Fuzzy Matching | Custom Levenshtein | `string-similarity` | Efficiency and pre-tested financial string heuristics. |

## Common Pitfalls

- **Floating Point Errors:** Always convert amounts to pence integers immediately after parsing.
- **Multi-line Descriptions:** Some banks wrap descriptions across rows. Logic must detect if a row "looks" incomplete (e.g., missing amount) and merge with the next.
- **Scanned PDFs:** `pdf.js` will return no text for image-based PDFs. Must detect this and show an error/manual guidance.
- **Layout Shifts:** Bank layouts change yearly. The "Manual Mapping" UI is the critical safety net.

## Code Examples

### UK Bank Regex Patterns (Lloyds/TSB Example)
```javascript
// Matches: 02 Mar 24   TESCO STORES   12.50   450.00
const lloydsRegex = /^(\d{2}\s[A-Za-z]{3}\s\d{2})\s+(.+?)\s+([\d,]+\.\d{2})?\s+([\d,]+\.\d{2})?\s+([\d,]+\.\d{2})/;
```

### Manual Mapping UI Pattern
Show a sample of the first 3 rows from the PDF. Let the user select a dropdown for each detected "column":
- `[ Date ]` `[ Description ]` `[ Amount (Out) ]` `[ Amount (In) ]`

## Sources

### Primary (HIGH confidence)
- `pdf.js` Documentation - Coordinate-based extraction.
- UK Bank Statement Samples (TSB, Santander, Lloyds) - Observed patterns for interest and transaction layouts.

### Secondary (MEDIUM confidence)
- `string-similarity` benchmarks - Effectiveness for merchant descriptors.
- Financial UI patterns (Flatfile, Airtable) - Industry standard for import workflows.

## Metadata
**Confidence breakdown:**
- Standard stack: HIGH
- Architecture: HIGH
- Pitfalls: MEDIUM (Bank layouts vary)

**Research date:** 2026-02-28
**Valid until:** 2026-03-30 (Stable libraries)
