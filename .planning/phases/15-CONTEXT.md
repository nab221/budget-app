# Phase 15 Context: Core CRUD & Filtering

## Overview
Phase 15 introduces edit capabilities for all transaction types and adds real-time search/filtering to the Income and Expenses tabs. This document captures the UI/UX decisions made to guide implementation.

## Decisions

### Edit Flow & Form Interaction
- **Update Mode**: When "Edit" is clicked, the existing entry form (e.g., at the top or bottom of the page) will transition into "Update" mode.
- **Scroll Behavior**: The page will automatically scroll to the entry form when a row is selected for editing to ensure user focus.
- **Mode Indicators**: "Update" mode will be clearly visible via:
  - Changing the form background color.
  - Updating the submit button text (e.g., "Save Changes").
  - Adding a visible "Cancel" button.
- **Single Edit**: Only one row can be edited at a time. Selecting a different row for editing while one is active will trigger a warning or prevent the action until the current edit is finished or cancelled.

### Filter/Search Placement & Scope
- **Placement**: Search and category filtering controls will be located directly above the main tables.
- **Independence**: Filter and search states are isolated per tab (Income vs. Expenses). Filtering in one tab does not affect the other.
- **Auto-Reset**: Active filters and search queries will automatically reset when the user switches between tabs or months.
- **Filter UI**: Category filtering will utilize a multi-select dropdown to allow users to view multiple specific categories simultaneously.

### Filtered Summaries & Calculation
- **Dynamic Summaries**: Category totals and summary cards on the page will dynamically update to reflect only the items currently visible based on active filters/search.
- **Running Balance**: The "Running Balance" (or overall month balance) will always reflect the full month's data, regardless of any active filters.
- **Interaction**: Filtering and search will apply in real-time as the user types or makes selections (no "Apply" button required).
- **No Results**: When no matches are found, the table will display a clear "No matches found" row or placeholder message.

### Feedback & Undo Flow
- **Success Feedback**: Upon a successful edit, the updated row will briefly flash or highlight to confirm the change was applied.
- **Cancel Confirmation**: Clicking "Cancel" during an edit will require a user confirmation (e.g., a simple dialog) to prevent accidental loss of changes.
- **Error Handling**: Failed updates will display an inline error message within the form area rather than using transient toast notifications.
- **Automatic Resort**: If an edit changes a field used for sorting (like Date), the row will automatically resort to its new position in the list upon saving.

## Deferred Ideas
*None identified during discussion.*
