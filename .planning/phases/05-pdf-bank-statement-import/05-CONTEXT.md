# Phase 05 Context: PDF Bank Statement Import

## Core Logic & Implementation Decisions

### 1. Transaction Preview & UX
- **In-line Editing:** Users must be able to edit descriptions and categories directly in the preview table before confirming the import. Edits made here are saved as the "official" record.
- **Bulk Actions:** The UI must support selecting multiple rows to apply a single category at once (e.g., "Bulk Categorize").
- **Visual Cues:** Any transaction without a determined category must be highlighted (e.g., yellow background) to ensure they are addressed before import.
- **Selection Memory:** The app will not remember unchecked states between different sessions; the focus is on a clean, per-upload review.

### 2. Duplicate Detection & Conflict Handling
- **Matching Rule:** Duplicates are identified primarily by **Date + Amount**. Description matching should be "loose" (e.g., "TESCO STORES" and "TESCO" should flag as a potential match).
- **Conflict Review:** Detected duplicates must be moved to a separate "Review Conflicts" section or tab in the UI, rather than just being unchecked in the main list.

### 3. Categorization & Learning
- **Suggestion Engine:** The app must attempt to suggest categories based on existing transaction history.
- **Visual Distinction:** Suggested categories must be marked with a "Suggested" badge to distinguish them from manual or exact matches.
- **Learning Rule:** The app will update its internal mapping of descriptions-to-categories immediately upon a successful import to improve future accuracy.

### 4. Supported Banks & Granular Parsing
- **Target Banks:**
    - **Credit Cards:** TSB, Nationwide, Lloyds, Amex, MBNA.
    - **Current Account:** Santander (Primary focus on salary and direct debits).
    - **Special Case (TSB Mortgage):** The parser must extract "Interest Charged" and "Capital Paid" as distinct data points to track balance changes accurately.
- **Processing Logic:** The app must automatically distinguish between "Payments" (reducing balance) and "Purchases" for all credit card statements.
- **Shared Accounts:** For the Santander shared account, all transactions are imported as a single block (no per-person tagging required).

## Deferred Ideas
- **Manual Column Mapping:** Implementation details for the fallback "teach the app" UI are deferred to the Research phase to find the most ergonomic solution.

## Next Steps
- **Research Phase:** Analyze "scrubbed" text snippets from the user for the 6 target banks.
- **Implementation:** Build the `pdf-import.js` module and the Preview UI components.
