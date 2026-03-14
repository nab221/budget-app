# Phase 16 Context: Debt History UX Refinement

## Overview
Phase 16 focuses on polishing the Debt Tab UX, specifically addressing auto-population of edit fields and refining the layout and functionality of the Statement History modal.

## Requirements
- **EDIT-04**: Clicking "Edit" (pencil icon) on a debt row should auto-populate the modal fields with the current debt data.
- **HIST-01**: History modal table should be reviewed and refined to handle multi-line text (e.g., long descriptions) without messy wrapping.
- **HIST-02**: Edit button for statement rows in the history modal should use the standard pencil icon for consistency.
- **HIST-03**: Each statement in the history modal should have a "Mark Paid" button (e.g., a green tick icon).

## Decisions

### Edit Auto-population
- The modal fields should be populated from the debt object stored in the repository.
- This includes all type-specific fields (credit limit, property value, etc.).

### History Modal Layout
- Use `.tbl.sm` (already used in other tables) or a custom layout to handle multi-line text.
- Consider adding a `max-width` or fixed width to certain columns (Date, Amount) to allow more space for the description.

### "Mark Paid" Workflow
- Clicking the "Mark Paid" icon (green tick) will update the statement status and potentially the debt balance.
- This action should be accessible directly from the history table row.

## Deferred Ideas
*None identified yet.*
